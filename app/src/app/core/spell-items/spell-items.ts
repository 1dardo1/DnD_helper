import { uniqueId } from '../characters/inventory';
import { Character } from '../models/character';
import { Item, Spell } from '../models/compendium';

/**
 * Items that hold a spell the player picks when adding them to the inventory: Spell Scrolls and
 * the Enspelled armor, staff and weapon (2024 DMG). The limits and the table of save DC and attack
 * bonus come from the item's own text, so they follow the data.
 */

export interface SpellLevelRow {
  /** 0: cantrip. */
  level: number;
  rarity: string;
  dc: number;
  attack: number;
}

export interface SpellBinding {
  kind: 'scroll' | 'bound';
  minLevel: number;
  maxLevel: number;
  /** Schools the spell must belong to (lowercase); null: any. */
  schools: string[] | null;
  /** DC and attack bonus by spell level. */
  table: SpellLevelRow[];
}

const ROW = /^\|\s*(Cantrip|\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*\+?(-?\d+)\s*\|/gim;

/** Rows of a "Spell Level | Rarity | Save DC | Attack Bonus" table in a description. */
export function parseLevelTable(description: string): SpellLevelRow[] {
  const rows: SpellLevelRow[] = [];
  for (const m of description.matchAll(ROW)) {
    rows.push({
      level: /cantrip/i.test(m[1]) ? 0 : Number(m[1]),
      rarity: m[2].toLowerCase(),
      dc: Number(m[3]),
      attack: Number(m[4]),
    });
  }
  return rows;
}

/** "Abjuration or Illusion", "Conjuration, Divination, Evocation, Necromancy, or Transmutation". */
function parseSchools(description: string): string[] | null {
  const m = /must belong to the ([^.]*?) school/i.exec(description);
  if (!m) return null;
  const list = m[1]
    .split(/,|\bor\b/i)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

/** The spell choice this item asks for, or null when it isn't one of those items. */
export function spellBinding(item: Item | null | undefined): SpellBinding | null {
  if (!item) return null;
  const d = item.description;
  if (item.id === 'spell-scroll') {
    const table = parseLevelTable(d);
    return {
      kind: 'scroll',
      minLevel: 0,
      maxLevel: table.length ? Math.max(...table.map((r) => r.level)) : 9,
      schools: null,
      table,
    };
  }
  // "Spell Scroll (Cantrip)" and "Spell Scroll (Level 1)": one fixed level, DC and bonus in the text
  const fixed = /^spell-scroll-(cantrip|level-(\d))$/.exec(item.id);
  if (fixed) {
    const level = fixed[1] === 'cantrip' ? 0 : Number(fixed[2]);
    const dc = /save DC is (\d+)/i.exec(d);
    const atk = /attack bonus is \+?(-?\d+)/i.exec(d);
    return {
      kind: 'scroll',
      minLevel: level,
      maxLevel: level,
      schools: null,
      table: dc && atk ? [{ level, rarity: '', dc: Number(dc[1]), attack: Number(atk[1]) }] : [],
    };
  }
  if (/^enspelled-(armor|staff|weapon)$/.test(item.id)) {
    const max = /spell of level (\d+) or lower/i.exec(d);
    return {
      kind: 'bound',
      minLevel: 0,
      maxLevel: max ? Number(max[1]) : 8,
      schools: parseSchools(d),
      table: parseLevelTable(d),
    };
  }
  return null;
}

/** The spell fits what the item allows (level and school). */
export function spellAllowed(b: SpellBinding, spell: Pick<Spell, 'level' | 'school'>): boolean {
  return (
    spell.level >= b.minLevel &&
    spell.level <= b.maxLevel &&
    (!b.schools || b.schools.includes(spell.school.toLowerCase()))
  );
}

/** Rarity, DC and attack bonus for a spell of that level, when the item's text gives them. */
export function levelStats(b: SpellBinding, level: number): SpellLevelRow | undefined {
  return b.table.find((r) => r.level === level);
}

/** Adds the item holding that spell; the same item with the same spell just adds one to the count. */
export function addSpellItem(ch: Character, item: Item, spellId: string): Character {
  const same = ch.inventory.find((e) => e.itemId === item.id && e.spellId === spellId);
  if (same) {
    return {
      ...ch,
      inventory: ch.inventory.map((e) => (e === same ? { ...e, qty: e.qty + 1 } : e)),
    };
  }
  return {
    ...ch,
    inventory: [
      ...ch.inventory,
      {
        id: uniqueId(ch.inventory, `${item.id}-${spellId}`),
        itemId: item.id,
        name: '',
        qty: 1,
        equipped: false,
        spellId,
      },
    ],
  };
}

/** A scroll is used up: one fewer, and the entry goes away with the last one. */
export function consumeSpellItem(ch: Character, entryId: string): Character {
  return {
    ...ch,
    inventory: ch.inventory.flatMap((e) =>
      e.id !== entryId ? [e] : e.qty > 1 ? [{ ...e, qty: e.qty - 1 }] : [],
    ),
  };
}

export function isScroll(item: Item | null | undefined): boolean {
  return spellBinding(item)?.kind === 'scroll';
}
