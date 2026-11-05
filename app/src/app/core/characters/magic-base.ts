import { Character, InventoryEntry } from '../models/character';
import { Item } from '../models/compendium';

/**
 * Magic weapons and armor have no stats of their own: "Weapon, +1, +2 or +3" is any simple or
 * martial weapon, "Armor of Resistance" any light, medium or heavy armor, "Vorpal Sword" any
 * sword. The player picks the real weapon or armor (the base, an item of the compendium) and
 * the magic item behaves as that item plus its bonus. All of it is derived here from the data
 * (the "Weapon (Any Simple or Martial)" subtype of each item), so nothing depends on the scraper.
 */

export type GearKind = 'weapon' | 'armor' | 'shield' | 'ammunition';
type ArmorStats = NonNullable<Item['armor']>;

/** The part of an inventory entry that says which base and bonus were chosen. */
export type GearChoice = Pick<InventoryEntry, 'baseId' | 'bonus'>;

/** Magic items that are listed as weapons but have their own stats (a boomerang...). */
const NO_BASE = new Set(['storm-boomerang']);
/** Items whose subtype is empty in the data: what the description calls them. */
const SUBTYPE_FALLBACK: Record<string, string> = {
  'dragontooth-dagger': 'dagger',
  'poison-soaked-kukri': 'dagger',
};

const AMMUNITION = /^(any )?(ammunition|arrows?|sling bullets?|bolts?|bullets?|needles?)$/i;

/** Which kind of base a magic item needs; null: none (not a magic weapon, armor or shield). */
export function gearKind(item: Item | undefined): GearKind | null {
  if (!item?.magic || item.weapon || item.armor || NO_BASE.has(item.id)) return null;
  const type = item.magic.type;
  const sub = subtype(item);
  if (type === 'shield') return 'shield';
  if (type === 'armor') return /^shield\b/i.test(sub) ? 'shield' : 'armor';
  if (type === 'weapon') return AMMUNITION.test(sub) ? 'ammunition' : 'weapon';
  return null;
}

function subtype(item: Item): string {
  return (item.magic?.subtype ?? SUBTYPE_FALLBACK[item.id] ?? '').trim();
}

/** Armor or shield slot of an item (mundane or magic); null: it is not worn. */
export function armorSlot(item: Item | undefined): 'armor' | 'shield' | null {
  if (item?.armor) return item.armor.kind === 'shield' ? 'shield' : 'armor';
  const kind = gearKind(item);
  return kind === 'armor' || kind === 'shield' ? kind : null;
}

// -- the bases -----------------------------------------------------------------------------------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const hasProp = (i: Item, name: string) =>
  !!i.weapon?.properties.some((p) => norm(p).startsWith(name));

/** The 2014 duplicates and the magic items are never a base. */
const mundane = (i: Item) => !i.magic && i.edition !== '2014';

const isAmmunition = (i: Item) =>
  !!i.weapon &&
  i.weapon.damage.length === 0 &&
  i.weapon.properties.length === 0 &&
  /\b(arrows?|bolts?|bullets?|needles?)\b/i.test(i.name);

/** A weapon that makes attacks: with damage, simple or martial (no explosives, no energy guns). */
const isWeapon = (i: Item) =>
  mundane(i) &&
  !!i.weapon &&
  i.weapon.damage.length > 0 &&
  (i.weapon.kind === 'simple' || i.weapon.kind === 'martial') &&
  !i.weapon.properties.some((p) => /energy cell/i.test(p));

const isMelee = (i: Item) => !i.weapon?.ranged;

const SWORDS = new Set(['greatsword', 'longsword', 'shortsword', 'rapier', 'scimitar']);

function weaponFilter(sub: string): (i: Item) => boolean {
  const s = norm(sub);
  if (s === 'firearm')
    return (i) => !!i.weapon?.properties.some((p) => /bullet/i.test(p)) && !!i.weapon?.ranged;
  if (!s.startsWith('any')) {
    const names = new Set(
      s
        .split(/,|\bor\b/)
        .map((n) => n.trim())
        .filter(Boolean),
    );
    return (i) => names.has(norm(i.name));
  }
  const preds: ((i: Item) => boolean)[] = [];
  if (/\bmelee\b/.test(s)) preds.push(isMelee);
  if (/one-handed/.test(s)) preds.push((i) => !hasProp(i, 'two-handed'));
  if (/finesse/.test(s)) preds.push((i) => hasProp(i, 'finesse'));
  if (/ammunition property/.test(s)) preds.push((i) => hasProp(i, 'ammunition'));
  if (/thrown property/.test(s)) preds.push((i) => hasProp(i, 'thrown'));
  if (/ranged or thrown/.test(s)) preds.push((i) => !!i.weapon?.ranged || hasProp(i, 'thrown'));
  if (/martial weapon$/.test(s)) preds.push((i) => i.weapon?.kind === 'martial');
  if (/bludgeoning/.test(s))
    preds.push((i) => i.weapon!.damage.some((d) => /bludgeoning/i.test(d.type)));
  if (/\bsword\b/.test(s)) preds.push((i) => SWORDS.has(norm(i.name)));
  if (/\bbow\b/.test(s)) preds.push((i) => /^(short|long)bow$/.test(norm(i.name)));
  if (/\bcrossbow\b/.test(s)) preds.push((i) => /crossbow/.test(norm(i.name)));
  if (/ammunition or melee/.test(s)) preds.push(isMelee);
  return (i) => preds.every((p) => p(i));
}

/** "Studded Leather Armor" → "studded leather", "Chain Mail" → "chain", "Plate" → "plate". */
const armorKey = (name: string) => norm(name).replace(/ (armor|mail)$/, '');

function armorFilter(sub: string): (i: Item) => boolean {
  const s = norm(sub);
  const kinds = new Set(s.match(/\b(light|medium|heavy)\b/g) ?? []);
  if (kinds.size || /^any\b/.test(s)) {
    const noHide = /(except|but not) hide/.test(s);
    return (i) =>
      (!kinds.size || kinds.has(i.armor!.kind)) && !(noHide && norm(i.name) === 'hide armor');
  }
  const keys = new Set(
    s
      .split(/,|\bor\b/)
      .map((n) => armorKey(n.trim()))
      .filter(Boolean),
  );
  return (i) => keys.has(armorKey(i.name));
}

/**
 * The items of the compendium that can be the base of a magic weapon, armor, shield or
 * ammunition (as its subtype says), the 2024 version of each. When the subtype names nothing the
 * compendium has, any weapon or armor is allowed, so there is always something to choose.
 */
export function baseCandidates(item: Item, all: Iterable<Item>): Item[] {
  const kind = gearKind(item);
  if (!kind) return [];
  const list = [...all];
  const sub = subtype(item);
  let out: Item[];
  if (kind === 'shield') out = list.filter((i) => mundane(i) && i.armor?.kind === 'shield');
  else if (kind === 'armor') {
    const armors = list.filter((i) => mundane(i) && i.armor && i.armor.kind !== 'shield');
    const f = armorFilter(sub);
    out = armors.filter(f);
    if (!out.length) out = armors;
  } else if (kind === 'ammunition') {
    const ammo = list.filter((i) => mundane(i) && isAmmunition(i));
    const stem = /arrow/i.test(sub)
      ? /arrow/i
      : /sling/i.test(sub)
        ? /sling/i
        : /bolt/i.test(sub)
          ? /bolt/i
          : null;
    out = stem ? ammo.filter((i) => stem.test(i.name)) : ammo;
    if (!out.length) out = ammo;
  } else {
    const weapons = list.filter(isWeapon);
    out = weapons.filter(weaponFilter(sub));
    if (!out.length) out = weapons;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// -- the bonus -----------------------------------------------------------------------------------

/** One of the "+1, +2 or +3" a generic item comes in, with the rarity that goes with it. */
export interface BonusOption {
  bonus: number;
  rarity: string;
}

/** "Uncommon (+1), Rare (+2), or Very Rare (+3)" → the three bonuses; none for other items. */
export function bonusOptions(item: Item | undefined): BonusOption[] {
  const raw = item?.magic?.raw;
  if (typeof raw !== 'string' || !gearKind(item)) return [];
  const out = [
    ...raw.matchAll(/(very rare|uncommon|common|rare|legendary)\s*\(\s*\+(\d)\s*\)/gi),
  ].map((m) => ({ bonus: Number(m[2]), rarity: m[1].toLowerCase() }));
  return out.length > 1 ? out : [];
}

/** Bonuses that apply only sometimes (against ranged attacks, in an area...): not counted. */
const CONDITIONAL = new Set([
  'bloodrage-greataxe',
  'duskcrusher',
  'fedifensor',
  'hammer-of-runic-focus',
  'repeating-shot',
  'star-razor',
]);

const ATTACK_BONUS =
  /\+(\d)\s+(?:bonus\s+)?(?:to|on)\s+attack(?:\s+rolls?)?\s+and\s+(?:to\s+)?damage(?:\s+rolls?)?/i;
const ATTACK_BONUS_B = /\+(\d)\s+bonus\s+(?:to|on)\s+attack\s+rolls?\s+(?:and|or)\s+damage/i;
const AC_BONUS = /\+(\d)\s+bonus\s+to\s+(?:AC|Armor Class)\b(?!\s+(?:against|for every))/i;
const AC_BONUS_B = /(?:adds a|is a) \+(\d)(?: to the user's AC| shield)/i;

/** The +N a magic item always has (written in its text), 0 if none. */
export function fixedBonus(item: Item | undefined): number {
  const kind = gearKind(item);
  if (!kind || bonusOptions(item).length || CONDITIONAL.has(item!.id)) return 0;
  const text = item!.description ?? '';
  if (kind === 'weapon') {
    const m = ATTACK_BONUS.exec(text) ?? ATTACK_BONUS_B.exec(text);
    return m ? Number(m[1]) : 0;
  }
  if (kind === 'armor' || kind === 'shield') {
    const m = AC_BONUS.exec(text) ?? AC_BONUS_B.exec(text);
    return m ? Number(m[1]) : 0;
  }
  return 0;
}

/** The bonus of this entry: the chosen one for "+1, +2 or +3" items, else the item's own. */
export function magicBonus(item: Item | undefined, choice?: GearChoice): number {
  const options = bonusOptions(item);
  if (options.length)
    return options.find((o) => o.bonus === choice?.bonus)?.bonus ?? options[0].bonus;
  return fixedBonus(item);
}

// -- an entry as a weapon, an armor or a shield --------------------------------------------------

export interface Gear {
  kind: GearKind;
  /** What is in the inventory (the magic item, or the plain weapon or armor itself). */
  item: Item;
  /** The weapon or armor it behaves as; null while the player has not chosen (several fit). */
  base: Item | null;
  /** Bonus to attack and damage (weapons) or to Armor Class (armor, shields). */
  bonus: number;
  /** Magic item whose base is still to be chosen. */
  unresolved: boolean;
}

/**
 * What an inventory entry is as equipment: a plain weapon, armor or shield is its own base; a
 * magic one uses the base chosen (entry.baseId) or, when only one item fits, that one.
 * null: not a weapon, armor or shield.
 */
export function gearOf(
  choice: GearChoice | undefined,
  item: Item | undefined,
  items: Map<string, Item>,
): Gear | null {
  if (!item) return null;
  if (item.armor)
    return {
      kind: item.armor.kind === 'shield' ? 'shield' : 'armor',
      item,
      base: item,
      bonus: 0,
      unresolved: false,
    };
  if (item.weapon) return { kind: 'weapon', item, base: item, bonus: 0, unresolved: false };
  const kind = gearKind(item);
  if (!kind) return null;
  let base = choice?.baseId ? (items.get(choice.baseId) ?? null) : null;
  if (base && !fits(base, kind)) base = null;
  if (!base) {
    const only = baseCandidates(item, items.values());
    base = only.length === 1 ? only[0] : null;
  }
  return { kind, item, base, bonus: magicBonus(item, choice), unresolved: !base };
}

function fits(base: Item, kind: GearKind): boolean {
  if (kind === 'armor') return !!base.armor && base.armor.kind !== 'shield';
  if (kind === 'shield') return base.armor?.kind === 'shield';
  if (kind === 'ammunition') return isAmmunition(base);
  return !!base.weapon;
}

/**
 * The armor stats of a gear: the base's, except that mithral armor and the like drop the
 * Strength requirement and the Stealth disadvantage their text says they remove.
 */
export function armorStats(gear: Gear): ArmorStats | null {
  const a = gear.base?.armor;
  if (!a) return null;
  if (gear.item === gear.base) return a;
  const text = gear.item.description ?? '';
  const mithral = /the mithral version of the armor doesn't/i.test(text);
  const quiet = /(?:doesn't|does not) impose disadvantage on (?:your )?Dexterity \(Stealth\)/i.test(
    text,
  );
  return {
    ...a,
    strength: mithral ? null : a.strength,
    stealthDisadvantage: mithral || quiet ? false : a.stealthDisadvantage,
  };
}

/** What the character wears: the armor with its bonus, and the shield. */
export interface WornGear {
  armor: ArmorStats | null;
  armorBonus: number;
  /** A magic armor is worn but its base is not chosen: it gives no AC yet. */
  unresolved: string | null;
  /** Armor Class of the shield (2 + its own bonus), 0 when none. */
  shield: number;
}

export function wornGear(ch: Character, items: Map<string, Item>): WornGear {
  const wearing = (slot: 'armor' | 'shield') =>
    ch.inventory.find((e) => e.equipped && e.itemId && armorSlot(items.get(e.itemId)) === slot);
  let armorEntry: GearChoice | undefined = wearing('armor');
  let armorItem = armorEntry ? items.get((armorEntry as InventoryEntry).itemId!) : undefined;
  if (!armorItem && ch.equipped.armorId) {
    armorItem = items.get(ch.equipped.armorId);
    armorEntry = undefined;
  }
  const armorGear = gearOf(armorEntry, armorItem, items);
  const armor = armorGear && armorGear.kind === 'armor' ? armorGear : null;

  let shield = 0;
  if (ch.equipped.shield) {
    const entry = wearing('shield');
    const g = entry ? gearOf(entry, items.get(entry.itemId!), items) : null;
    shield = (g?.base?.armor?.baseAC ?? 2) + (g?.bonus ?? 0);
  }
  return {
    armor: armor ? armorStats(armor) : null,
    armorBonus: armor && !armor.unresolved ? armor.bonus : 0,
    unresolved: armor?.unresolved ? armor.item.name : null,
    shield,
  };
}

/**
 * What adding this item to the inventory asks: the bases to choose from (more than one) and the
 * "+1, +2 or +3" options. null: nothing to ask, it can be added as it is.
 */
export function gearChoices(
  item: Item | undefined,
  all: Iterable<Item>,
): { bases: Item[]; bonuses: BonusOption[] } | null {
  if (!item || !gearKind(item)) return null;
  const bases = baseCandidates(item, all);
  const bonuses = bonusOptions(item);
  return bases.length > 1 || bonuses.length > 1 ? { bases, bonuses } : null;
}

/** Magic items the app needs a base for, to audit the data. */
export function needsBase(item: Item): boolean {
  return gearKind(item) !== null;
}
