import { Sheet } from '../rules/sheet';

/**
 * When prepared spells can be changed (2024 rules):
 *  - after a Long Rest, the whole list (Cleric, Druid, Wizard, Artificer) or one spell (Paladin,
 *    Ranger);
 *  - on gaining a level in the class, one spell (Bard, Sorcerer, Warlock and the subclass casters:
 *    Eldritch Knight, Arcane Trickster, Warrior of the Mystic Arts, Order of the Profane Soul).
 */
export interface SwapRule {
  longRest: 'any' | 'one' | null;
  levelUp: 'one' | null;
}

const BY_CLASS: Record<string, SwapRule> = {
  artificer: { longRest: 'any', levelUp: null },
  cleric: { longRest: 'any', levelUp: null },
  druid: { longRest: 'any', levelUp: null },
  wizard: { longRest: 'any', levelUp: null },
  paladin: { longRest: 'one', levelUp: null },
  ranger: { longRest: 'one', levelUp: null },
  bard: { longRest: null, levelUp: 'one' },
  sorcerer: { longRest: null, levelUp: 'one' },
  warlock: { longRest: null, levelUp: 'one' },
};

/** Casters through a subclass, and classes not listed: one spell when gaining a level. */
const DEFAULT_RULE: SwapRule = { longRest: null, levelUp: 'one' };

export function swapRule(classId: string): SwapRule {
  return BY_CLASS[classId] ?? DEFAULT_RULE;
}

/** What each caster of the sheet may change after a Long Rest. */
export function swapsAfterLongRest(sheet: Sheet): Record<string, 'any' | 'one'> {
  const out: Record<string, 'any' | 'one'> = {};
  for (const c of sheet.spellcasting.classes) {
    const rule = swapRule(c.classId).longRest;
    if (rule) out[c.classId] = rule;
  }
  return out;
}

/** Replace one spell id with another, keeping the order. */
export function replaceSpell(spells: string[], out: string, inn: string): string[] {
  if (!out || !inn || out === inn || spells.includes(inn)) return spells;
  return spells.map((id) => (id === out ? inn : id));
}
