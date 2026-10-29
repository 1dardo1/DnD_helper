import { Ability } from '../models/compendium';

export const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** The 18 skills and the ability each one uses. */
export const SKILL_ABILITY: Record<string, Ability> = {
  acrobatics: 'DEX',
  'animal-handling': 'WIS',
  arcana: 'INT',
  athletics: 'STR',
  deception: 'CHA',
  history: 'INT',
  insight: 'WIS',
  intimidation: 'CHA',
  investigation: 'INT',
  medicine: 'WIS',
  nature: 'INT',
  perception: 'WIS',
  performance: 'CHA',
  persuasion: 'CHA',
  religion: 'INT',
  'sleight-of-hand': 'DEX',
  stealth: 'DEX',
  survival: 'WIS',
};

/**
 * Spell slots by caster level for multiclass spellcasters (Player's Handbook "Multiclass
 * Spellcaster" table; the same as a full caster's). Index 0 = caster level 1.
 */
export const MULTICLASS_SLOTS: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
].map((row) => [...row, ...Array(9 - row.length).fill(0)]);

export function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(totalLevel: number): number {
  return 2 + Math.floor((Math.max(totalLevel, 1) - 1) / 4);
}
