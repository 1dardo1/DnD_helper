import { Ability, DndClass } from '../models/compendium';
import { ABILITY_WORDS } from './trait-effects';

/**
 * A class modifier its text names and lets the player pick (Blood Hunter, Hunter's Bane:
 * "**Hemocraft save DC** = 8 + your proficiency bonus + your Hemocraft modifier (your choice
 * between Intelligence and Wisdom)"). Other features then read "your Hemocraft modifier" (Dark
 * Augmentation, Brand of Castigation) and the Profane Soul casts with it.
 */
export interface ClassKeyAbility {
  /** The name the text gives it ("Hemocraft"). */
  name: string;
  choices: Ability[];
}

const KEY_DC =
  /\*\*(\w+) save DC\*\* = 8 \+ your proficiency bonus \+ your \1 modifier \(your choice between (\w+) and (\w+)\)/i;

export function classKeyAbility(cls: DndClass): ClassKeyAbility | null {
  for (const f of cls.features) {
    const m = KEY_DC.exec(f.description ?? '');
    const a = m && ABILITY_WORDS[m[2].toLowerCase()];
    const b = m && ABILITY_WORDS[m[3].toLowerCase()];
    if (m && a && b) return { name: m[1], choices: [a, b] };
  }
  return null;
}

/** The pick of the player, or the higher of the two (the first one on a tie). */
export function keyAbilityPick(
  key: ClassKeyAbility,
  picked: Ability | null | undefined,
  score: (a: Ability) => number,
): Ability {
  if (picked && key.choices.includes(picked)) return picked;
  return key.choices.reduce((best, a) => (score(a) > score(best) ? a : best));
}
