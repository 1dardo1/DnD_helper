import { Ability, ClassOption, Entry, Feat, Item, Spell } from '../../core/models/compendium';

/**
 * The default order of the lists (compendium, wizard and level-up pickers, the sheet), after the
 * name shown:
 * - spells by level, and in each level first those without concentration;
 * - feats that raise an ability first (Ability Score Improvement, then by ability: STR, DEX,
 *   CON, INT, WIS, CHA; the fewer abilities to choose from, the sooner), then the rest;
 * - class options (invocations, blood curses, mutagens...) by the class level they require
 *   (none = level 1);
 * - items: mundane before magic; mundane ones as in the Player's Handbook (weapons: simple melee,
 *   simple ranged, martial melee, martial ranged, others, ammunition; armor: light, medium, heavy;
 *   then shields, gear,
 *   tools, mounts, poisons); magic ones by name.
 * Other types (and plain objects such as species lineages) keep the name order.
 */
const ABILITY_ORDER: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** Item categories in the order of the Player's Handbook (magic items, "other", last). */
const ITEM_CATEGORIES = ['weapon', 'armor', 'shield', 'gear', 'tool', 'mount', 'poison', 'other'];
const WEAPON_KINDS = ['simple', 'martial'];
const ARMOR_KINDS = ['light', 'medium', 'heavy', 'shield'];

/** Position in a list; unknown values after the known ones. */
function rank(list: readonly string[], value: string | null | undefined): number {
  const i = value ? list.indexOf(value) : -1;
  return i < 0 ? list.length : i;
}

function itemKey(i: Item): number[] {
  if (i.magic) return [1];
  // ammunition and explosives (no damage of their own) after the weapons
  const sub = i.weapon
    ? i.weapon.damage?.length
      ? rank(WEAPON_KINDS, i.weapon.kind) * 2 + (i.weapon.ranged ? 1 : 0)
      : 2 * (WEAPON_KINDS.length + 1)
    : i.armor
      ? rank(ARMOR_KINDS, i.armor.kind)
      : 0;
  return [0, rank(ITEM_CATEGORIES, i.category), sub];
}

function key(e: Entry): number[] {
  switch (e.type) {
    case 'spell': {
      const s = e as Spell;
      return [s.level, s.concentration ? 1 : 0];
    }
    case 'feat': {
      const f = e as Feat;
      if (f.id === 'ability-score-improvement') return [0, -1, 0];
      const from = f.abilityIncrease?.from ?? [];
      if (!from.length) return [1, 0, 0];
      return [0, Math.min(...from.map((a) => ABILITY_ORDER.indexOf(a))), from.length];
    }
    case 'option':
      return [(e as ClassOption).prerequisites?.level ?? 1];
    case 'item':
      return itemKey(e as Item);
    default:
      return [];
  }
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Sorted by the name shown, then by the order of its type (a stable sort keeps the names). */
export function defaultOrder<T>(items: readonly T[], shownName: (e: T) => string): T[] {
  const byName = [...items].sort((a, b) => shownName(a).localeCompare(shownName(b)));
  const keys = new Map(byName.map((e) => [e, key((e ?? {}) as Entry)]));
  return byName.sort((a, b) => compare(keys.get(a)!, keys.get(b)!));
}

/**
 * Order of the compendium's group cards: feats by the level at which a character gets each kind
 * (origin at 1, fighting style at 1–2, general from 4, epic boons at 19), items as in the
 * Player's Handbook. Groups not listed go after them, the biggest first.
 */
const GROUP_ORDER: Partial<Record<string, readonly string[]>> = {
  'feat:category': ['origin', 'fighting-style', 'general', 'racial', 'epic-boon'],
  'item:category': ITEM_CATEGORIES,
};

export interface GroupCard {
  value: string;
  label: string;
  count: number;
}

/** Group cards in their default order: see GROUP_ORDER; classes by name; else the biggest first. */
export function groupOrder<G extends GroupCard>(type: string, facet: string, groups: G[]): G[] {
  const fixed = GROUP_ORDER[`${type}:${facet}`] ?? [];
  return [...groups].sort(
    (a, b) =>
      rank(fixed, a.value) - rank(fixed, b.value) ||
      (facet === 'class' ? 0 : b.count - a.count) ||
      a.label.localeCompare(b.label),
  );
}
