import {
  Ability,
  ClassOption,
  Entry,
  Feat,
  Item,
  Monster,
  Spell,
} from '../../core/models/compendium';
import { requiredSpecies, speciesNames } from './racial-feats';

/**
 * The default order of the lists (compendium, wizard and level-up pickers, the sheet), after the
 * name shown:
 * - spells by level, and in each level first those without concentration;
 * - feats that raise an ability first (Ability Score Improvement, then by ability: STR, DEX,
 *   CON, INT, WIS, CHA; the fewer abilities to choose from, the sooner), then the rest, then the
 *   racial feats by the species they require (the first by name) and their name;
 * - class options (invocations, blood curses, mutagens...) by the class level they require
 *   (none = level 1);
 * - items: mundane before magic; mundane ones as in the Player's Handbook (weapons: simple melee,
 *   simple ranged, martial melee, martial ranged, others, ammunition; armor: light, medium, heavy;
 *   then shields, gear,
 *   tools, mounts, poisons); magic ones by name.
 * - species by popularity (SPECIES_POPULARITY), the rest by name;
 * - subclasses by their class (shown name), then by name;
 * - monsters by challenge rating (the easiest first), then by name.
 * Other types (and plain objects such as species lineages) keep the name order.
 */
const ABILITY_ORDER: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/**
 * Species by how often players choose them (D&D Beyond's character data: human and elf first,
 * then dragonborn, tiefling, half-elf...); the rest go after, by name.
 */
const SPECIES_POPULARITY = [
  'human',
  'elf',
  'dragonborn',
  'tiefling',
  'half-elf',
  'dwarf',
  'half-orc',
  'aasimar',
  'halfling',
  'tabaxi',
  'gnome',
  'goliath',
  'orc',
  'firbolg',
  'warforged',
  'genasi',
  'air-genasi',
  'earth-genasi',
  'fire-genasi',
  'water-genasi',
  'kenku',
  'changeling',
  'tortle',
  'lizardfolk',
  'goblin',
  'bugbear',
  'kobold',
  'harengon',
  'shifter',
  'fairy',
  'satyr',
  'owlin-scc',
  'yuan-ti',
  'triton',
  'githyanki',
  'aarakocra',
  'hobgoblin',
  'eladrin',
  'sea-elf',
  'shadar-kai',
  'deep-gnome',
  'duergar',
  'githzerai',
  'centaur',
  'minotaur',
  'kalashtar',
  'dhampir',
  'hexblood',
  'reborn',
  'autognome',
  'astral-elf',
  'plasmoid',
  'thri-kreen',
  'giff',
  'hadozee',
];

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
      if (requiredSpecies(f).length) return [2, 0, 0];
      if (f.id === 'ability-score-improvement') return [0, -1, 0];
      const from = f.abilityIncrease?.from ?? [];
      if (!from.length) return [1, 0, 0];
      return [0, Math.min(...from.map((a) => ABILITY_ORDER.indexOf(a))), from.length];
    }
    case 'species':
      return [rank(SPECIES_POPULARITY, e.id)];
    case 'option':
      return [(e as ClassOption).prerequisites?.level ?? 1];
    case 'item':
      return itemKey(e as Item);
    case 'monster':
      return [(e as Monster).cr];
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

/**
 * Sorted by the name shown, then by the order of its type (a stable sort keeps the names).
 * `speciesName` gives the shown name of a species id, to order the racial feats.
 */
export function defaultOrder<T>(
  items: readonly T[],
  shownName: (e: T) => string,
  speciesName: (id: string) => string = (id) => id,
  className: (id: string) => string = (id) => id,
): T[] {
  const byName = [...items].sort((a, b) => shownName(a).localeCompare(shownName(b)));
  const keys = new Map(byName.map((e) => [e, key((e ?? {}) as Entry)]));
  // racial feats by the species they require; subclasses by their class
  const group = new Map(
    byName.map((e) => {
      const entry = (e ?? {}) as Entry & { classId?: string };
      const g =
        entry.type === 'subclass'
          ? className(entry.classId ?? '')
          : (speciesNames(entry, speciesName)[0] ?? '');
      return [e, g];
    }),
  );
  return byName.sort(
    (a, b) => compare(keys.get(a)!, keys.get(b)!) || group.get(a)!.localeCompare(group.get(b)!),
  );
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
  /** Class options: the shown name of the class the group belongs to. */
  classLabel?: string;
}

/**
 * Group cards in their default order: see GROUP_ORDER; class options by class then name; classes
 * by name; else the biggest first.
 */
export function groupOrder<G extends GroupCard>(type: string, facet: string, groups: G[]): G[] {
  const fixed = GROUP_ORDER[`${type}:${facet}`] ?? [];
  const byClass = type === 'option' && facet === 'group';
  return [...groups].sort(
    (a, b) =>
      rank(fixed, a.value) - rank(fixed, b.value) ||
      (byClass ? (a.classLabel ?? '').localeCompare(b.classLabel ?? '') : 0) ||
      (facet === 'class' || byClass ? 0 : b.count - a.count) ||
      a.label.localeCompare(b.label),
  );
}
