import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import monsters from '../../../../../data/monsters.json';
import options from '../../../../../data/options.json';
import spells from '../../../../../data/spells.json';
import species from '../../../../../data/species.json';
import subclasses from '../../../../../data/subclasses.json';
import { Character, newCharacter } from '../models/character';
import {
  Background,
  ClassOption,
  DndClass,
  Feat,
  Item,
  Monster,
  Spell,
  Species,
  Subclass,
} from '../models/compendium';
import { RulesData, computeSheet } from './engine';
import { Sheet } from './sheet';

/**
 * The real compendium for tests (rules never invented: the specs read the same texts the app
 * shows). Only specs import this file.
 */
const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

export const REAL: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: map<Subclass>(subclasses),
  species: map<Species>(species),
  backgrounds: map<Background>(backgrounds),
  feats: map<Feat>(feats),
  items: map<Item>(items),
  options: map<ClassOption>(options),
};

export const REAL_SPELLS = spells as unknown as Spell[];
export const REAL_MONSTERS = monsters as unknown as Monster[];
export const REAL_CLASSES = classes as unknown as DndClass[];
export const REAL_SUBCLASSES = subclasses as unknown as Subclass[];

export type Scores = Record<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', number>;

export const SCORES: Scores = { STR: 16, DEX: 14, CON: 14, INT: 12, WIS: 14, CHA: 14 };

/** A single-class character of the given level (and subclass) with the given scores. */
export function hero(
  classId: string,
  level: number,
  subclassId: string | null = null,
  over: Partial<Character['choices']> & { scores?: Partial<Scores>; speciesId?: string } = {},
): Character {
  const c = newCharacter('Test', 'test');
  const { scores, speciesId, ...choices } = over;
  return {
    ...c,
    classes: [{ id: classId, level, subclassId, hp: [] }],
    species: { id: speciesId ?? 'human', variant: null },
    background: { id: 'soldier', abilityIncreases: {} },
    abilityScores: { method: 'standard', base: { ...SCORES, ...scores } },
    choices: { ...c.choices, weaponMasteries: [], ...choices },
  };
}

export function sheetOf(
  classId: string,
  level: number,
  subclassId: string | null = null,
  over: Parameters<typeof hero>[3] = {},
): Sheet {
  return computeSheet(hero(classId, level, subclassId, over), REAL);
}
