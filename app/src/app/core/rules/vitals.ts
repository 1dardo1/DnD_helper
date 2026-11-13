import { Character } from '../models/character';
import { RulesData, computeSheet } from './engine';

/** The two numbers the character list shows at a glance (hit points and armor class). */
export interface Vitals {
  hp: number;
  hpMax: number;
  ac: number;
}

/**
 * Hit points and AC of a character, computed by the same engine as the sheet (nothing stored).
 * Returns null when the sheet cannot be computed, so one broken character never breaks the list.
 */
export function vitalsOf(ch: Character, data: RulesData): Vitals | null {
  try {
    const sheet = computeSheet(ch, data);
    return {
      hp: sheet.hitPoints.current,
      hpMax: sheet.hitPoints.max,
      ac: sheet.armorClass.value,
    };
  } catch {
    return null;
  }
}
