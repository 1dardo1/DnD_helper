import { Character, Coins, InventoryEntry } from '../models/character';
import { Item } from '../models/compendium';
import { toggleEquip } from '../characters/inventory';
import { GearChoice, armorSlot, bonusOptions } from '../characters/magic-base';

/**
 * Starting equipment as the 2024 books give it: "Choose A or B: (A) Chain Mail, 8 Javelins, ...
 * and 4 GP; or (B) 155 GP". Each package becomes lines matched to compendium items, plus gold;
 * the gold left can be spent in the shop (any item with a price, magic items at the DMG price).
 */

export interface PackageLine {
  /** The book's words ("8 Javelins", "Oil (3 flasks)"). */
  text: string;
  /** Matched compendium item, or null (then `name` is kept as a hand-written entry). */
  itemId: string | null;
  name: string;
  qty: number;
  /** "Artisan's Tools (same as above)": the tool chosen earlier for that slot. */
  chosenTool: boolean;
}

export interface EquipmentPackage {
  letter: string;
  lines: PackageLine[];
  /** Gold pieces in the package. */
  gold: number;
}

/**
 * An item bought in the shop. Magic weapons and armor carry the base (and the +1, +2 or +3) the
 * player chose, and the same item with another base is another line.
 */
export interface BoughtItem extends Pick<GearChoice, 'baseId' | 'bonus'> {
  itemId: string;
  qty: number;
  /** An upgrade of a weapon (Repeating Shot): the weapon it goes on, which is already carried. */
  host?: HostRef;
}

/** A weapon of the starting inventory, told by its item and base (entries have no id yet). */
export interface HostRef {
  itemId: string;
  baseId?: string;
}

const sameHost = (a?: HostRef, b?: HostRef) => a?.itemId === b?.itemId && a?.baseId === b?.baseId;

export const sameBought = (
  a: BoughtItem,
  itemId: string,
  gear: Pick<BoughtItem, 'baseId' | 'bonus' | 'host'> = {},
) =>
  a.itemId === itemId &&
  a.baseId === gear.baseId &&
  a.bonus === gear.bonus &&
  sameHost(a.host, gear.host);

/** What the wizard remembers of the choice (letters), and what was bought with the gold. */
export interface StartingChoice {
  class: string | null;
  background: string | null;
  bought: BoughtItem[];
  /** 'gold': no packages, only their gold, to buy everything (absent: the book's packages). */
  mode?: 'packages' | 'gold';
}

/** The package that is only gold ("(B) 50 GP"), if there is one. */
export function goldOnlyPackage(list: EquipmentPackage[] | null): EquipmentPackage | null {
  const gold = (list ?? []).filter((p) => p.lines.length === 0);
  return gold.sort((a, b) => b.gold - a.gold)[0] ?? null;
}

/**
 * What the shop sells: items with a price, without the 2014 version of an item that 2024 also
 * has ("Potion of Healing (common)" 2014 next to "Potion of Healing" 2024), sorted by name.
 */
export function shopCatalog(items: Iterable<Item>): Item[] {
  const all = [...items].filter((i) => shopPriceCp(i) !== null);
  // "Potion of Healing (common)", "Shield, +1, +2, +3" vs "Shield, +1, +2, or +3"
  const base = (i: Item) =>
    norm(i.name)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/,\s*or\s+/g, ', ');
  const newer = new Set(all.filter((i) => i.edition === '2024').map(base));
  return all
    .filter((i) => i.edition === '2024' || !newer.has(base(i)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Items by normalised name, the 2024 version first (and no magic item over a mundane one). */
export function itemIndex(items: Iterable<Item>): Map<string, Item> {
  const rank = (i: Item) => (i.magic ? 2 : 0) + (i.edition === '2024' ? 0 : 1);
  const out = new Map<string, Item>();
  for (const i of items) {
    // "Lantern, Hooded" is also found as "Hooded Lantern"
    const n = norm(i.name);
    const flipped = /^([^,]+), ([^,]+)$/.exec(n);
    for (const k of flipped ? [n, `${flipped[2]} ${flipped[1]}`] : [n]) {
      const old = out.get(k);
      if (!old || rank(i) < rank(old)) out.set(k, i);
    }
  }
  return out;
}

/** "Javelins" → javelin, "Pouches" → pouch, "Torches" → torch, "Arrows" → arrows. */
function lookup(name: string, index: Map<string, Item>): Item | null {
  const n = norm(name);
  for (const k of [n, n.replace(/s$/, ''), n.replace(/es$/, ''), n.replace(/ies$/, 'y')]) {
    const hit = index.get(k);
    if (hit) return hit;
  }
  return null;
}

/** Splits at commas outside parentheses. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

function parseLine(text: string, index: Map<string, Item>): PackageLine {
  const clean = text.replace(/^and\s+/i, '').trim();
  const chosenTool = /\babove\b/i.test(clean);
  let qty = 1;
  let rest = clean;
  const lead = /^(\d+)\s+(.*)$/.exec(rest);
  if (lead) {
    qty = Number(lead[1]);
    rest = lead[2];
  }
  const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(rest);
  const base = paren ? paren[1] : rest;
  const detail = paren?.[2] ?? '';
  // "Oil (3 flasks)", "Rations (3 days' worth)", "Parchment (10 sheets)"
  const inner = /^(\d+)\s+(flasks?|days?|sheets?)\b/i.exec(detail);
  if (inner && !lead) qty = Number(inner[1]);
  const item = lookup(base, index) ?? (detail && !inner ? lookup(detail, index) : null);
  return { text: clean, itemId: item?.id ?? null, name: item ? item.name : clean, qty, chosenTool };
}

/** The packages of a "Choose A or B: (A) ...; or (B) 50 GP" text, or null if it isn't one. */
export function parseStartingEquipment(
  text: string | null | undefined,
  index: Map<string, Item>,
): EquipmentPackage[] | null {
  if (!text || !/^\s*Choose\b/i.test(text)) return null;
  const body = text.replace(/^[^:]*:\s*/, '');
  const parts = body.split(/;\s*(?:or\s+)?(?=\([A-Z]\))|\s+or\s+(?=\([A-Z]\))/);
  const out: EquipmentPackage[] = [];
  for (const part of parts) {
    const m = /^\(([A-Z])\)\s*([\s\S]*)$/.exec(part.trim());
    if (!m) continue;
    // "... Dungeoneer's Pack and 11 GP"
    const content = m[2].replace(/\s+and\s+(?=\d[\d,]*\s*GP\b)/gi, ', ').replace(/[.;]\s*$/, '');
    let gold = 0;
    const lines: PackageLine[] = [];
    for (const piece of splitTop(content)) {
      const g = /^(?:and\s+)?(\d[\d,]*)\s*GP\b/i.exec(piece);
      if (g) gold += Number(g[1].replace(/,/g, ''));
      else lines.push(parseLine(piece, index));
    }
    out.push({ letter: m[1], lines, gold });
  }
  return out.length >= 2 ? out : null;
}

// -- prices ------------------------------------------------------------------------------------

const COIN_CP: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** Magic item prices by rarity (2024 Dungeon Master's Guide), in gold. */
export const MAGIC_PRICE_GP: Record<string, number> = {
  common: 100,
  uncommon: 400,
  rare: 4000,
  'very rare': 40000,
  legendary: 200000,
};

/** Shop price in copper: the listed cost, or the DMG price by rarity (half for consumables). */
export function shopPriceCp(item: Item, bonus?: number): number | null {
  if (item.cost) {
    const rate = COIN_CP[item.cost.unit.toLowerCase()];
    return rate === undefined ? null : item.cost.amount * rate;
  }
  // "Weapon, +1, +2 or +3": the rarity (and the price) go with the bonus, the lowest one by default
  const options = bonusOptions(item);
  const rarity =
    (options.find((o) => o.bonus === bonus) ?? options[0])?.rarity ??
    item.magic?.rarity ??
    undefined;
  const gp = rarity ? MAGIC_PRICE_GP[rarity] : undefined;
  if (gp === undefined) return null;
  const consumable = /potion|scroll/.test(item.magic!.type);
  return (consumable ? gp / 2 : gp) * 100;
}

/** Copper pieces as gold, silver and copper coins. */
export function coinsFromCp(cp: number): Coins {
  const n = Math.max(0, Math.round(cp));
  return { pp: 0, gp: Math.floor(n / 100), ep: 0, sp: Math.floor((n % 100) / 10), cp: n % 10 };
}

export function coinsToCp(c: Coins | undefined): number {
  if (!c) return 0;
  return c.cp + c.sp * 10 + c.ep * 50 + c.gp * 100 + c.pp * 1000;
}

/** Gold of the chosen packages minus what was bought, in copper. */
export function goldLeftCp(
  choice: StartingChoice,
  packages: { class: EquipmentPackage[] | null; background: EquipmentPackage[] | null },
  items: Map<string, Item>,
): number {
  const gold = (['class', 'background'] as const).reduce(
    (sum, k) => sum + (packages[k]?.find((p) => p.letter === choice[k])?.gold ?? 0),
    0,
  );
  const spent = choice.bought.reduce((sum, b) => {
    const it = items.get(b.itemId);
    return sum + (it ? (shopPriceCp(it, b.bonus) ?? 0) * b.qty : 0);
  }, 0);
  return gold * 100 - spent;
}

// -- the character -----------------------------------------------------------------------------

/**
 * Rebuilds what the starting equipment puts in the inventory (entries with source 'start'),
 * keeping what was added by hand, and sets the coins to the gold left. The first armor and the
 * shield of the packages are worn.
 */
export function applyStartingEquipment(
  ch: Character,
  choice: StartingChoice,
  packages: { class: EquipmentPackage[] | null; background: EquipmentPackage[] | null },
  items: Map<string, Item>,
  chosenTools: { class: string[]; background: string[] },
  index: Map<string, Item>,
): Character {
  const inventory: InventoryEntry[] = ch.inventory.filter((e) => e.source !== 'start');
  // the weapon each bought upgrade goes on, until the whole inventory is there
  const hosts = new Map<string, HostRef>();
  const add = (
    itemId: string | null,
    name: string,
    qty: number,
    gear: Pick<BoughtItem, 'baseId' | 'bonus' | 'host'> = {},
  ) => {
    const same = inventory.find(
      (e) =>
        e.source === 'start' &&
        (itemId
          ? e.itemId === itemId &&
            e.baseId === gear.baseId &&
            e.bonus === gear.bonus &&
            sameHost(hosts.get(e.id), gear.host)
          : e.name === name),
    );
    if (same) {
      same.qty += qty;
      return;
    }
    const base = itemId ?? slug(name);
    let id = base;
    for (let n = 2; inventory.some((e) => e.id === id); n++) id = `${base}-${n}`;
    inventory.push({
      id,
      itemId,
      name: itemId ? '' : name,
      qty,
      equipped: false,
      source: 'start',
      ...(itemId && gear.baseId ? { baseId: gear.baseId } : {}),
      ...(itemId && gear.bonus ? { bonus: gear.bonus } : {}),
    });
    if (gear.host) hosts.set(id, gear.host);
  };
  for (const k of ['class', 'background'] as const) {
    const pkg = packages[k]?.find((p) => p.letter === choice[k]);
    for (const line of pkg?.lines ?? []) {
      if (line.chosenTool && chosenTools[k].length) {
        for (const tool of chosenTools[k]) {
          const it = lookup(tool, index);
          add(it?.id ?? null, it ? '' : tool, 1);
        }
      } else add(line.itemId, line.name, line.qty);
    }
  }
  for (const b of choice.bought)
    if (items.has(b.itemId))
      add(b.itemId, '', b.qty, { baseId: b.baseId, bonus: b.bonus, host: b.host });
  // link each upgrade to its weapon; if the weapon is not carried any more it stays without one
  for (const [id, ref] of hosts) {
    const target = inventory.find(
      (e) => e.id !== id && e.itemId === ref.itemId && e.baseId === ref.baseId,
    );
    const entry = inventory.find((e) => e.id === id);
    if (entry && target) entry.onEntryId = target.id;
  }

  let out: Character = {
    ...ch,
    inventory,
    choices: { ...ch.choices, startingEquipment: choice },
    money: coinsFromCp(goldLeftCp(choice, packages, items)),
  };
  // what is worn must still be carried; then wear the packages' armor and shield
  const has = (id: string | null) => !!id && inventory.some((e) => e.itemId === id && e.equipped);
  out = {
    ...out,
    equipped: {
      armorId: has(out.equipped.armorId) ? out.equipped.armorId : null,
      shield: out.equipped.shield && inventory.some((e) => e.equipped && isShield(items, e)),
    },
  };
  const fresh = inventory.filter((e) => e.source === 'start' && e.itemId);
  const armor = fresh.find((e) => armorSlot(items.get(e.itemId!)) === 'armor');
  if (armor && !out.equipped.armorId) out = toggleEquip(out, armor.id, items);
  const shield = fresh.find((e) => isShield(items, e));
  if (shield && !out.equipped.shield) out = toggleEquip(out, shield.id, items);
  return out;
}

const isShield = (items: Map<string, Item>, e: InventoryEntry) =>
  !!e.itemId && armorSlot(items.get(e.itemId)) === 'shield';

function slug(s: string): string {
  return (
    norm(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}
