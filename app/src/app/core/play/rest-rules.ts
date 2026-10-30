/**
 * What each class resource gets back on a rest (2024 rules).
 *
 * A Long Rest always recovers every use of every resource, so the table only says what a Short
 * Rest does. Resources not listed here recover on a Long Rest only.
 *
 *   short: 'all' → every expended use;  n → n expended uses;  0 → nothing
 *   shortFromLevel: the short-rest recovery needs this class level (Bard's Font of Inspiration)
 *   passive: a number in the class table that isn't spent (Weapon Mastery, Invocations known...)
 *
 * Keys are resource names normalised with restKey(): lowercase, single spaces.
 */
export interface RestRule {
  short: Recovery;
  shortFromLevel?: number;
  passive?: boolean;
}

export type Recovery = 'all' | number;

export const REST_RULES: Record<string, RestRule> = {
  // -- class table columns --
  rages: { short: 1 },
  'channel divinity': { short: 1 }, // Cleric and Paladin
  'wild shape': { short: 1 },
  'second wind': { short: 1 },
  'focus points': { short: 'all' },
  'sorcery points': { short: 0 },
  'favored enemy': { short: 0 }, // free Hunter's Mark casts
  // -- uses that come from a feature, not from a column (see playResources) --
  'bardic inspiration': { short: 'all', shortFromLevel: 5 },
  'action surge': { short: 'all' },
  'blood maledict': { short: 'all' },
  'stroke of luck': { short: 'all' },
  'hybrid transformation': { short: 'all' }, // Blood Hunter, Order of the Lycan
  // -- numbers in the class tables that are not spent --
  'weapon mastery': { short: 0, passive: true },
  'plans known': { short: 0, passive: true },
  'magic items': { short: 0, passive: true },
  'blood curses known': { short: 0, passive: true },
  'eldritch invocations': { short: 0, passive: true },
};

/** Long rest only. */
const DEFAULT_RULE: RestRule = { short: 0 };

export function restKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function restRule(name: string): RestRule {
  return REST_RULES[restKey(name)] ?? DEFAULT_RULE;
}

/** Uses still expended after recovering `recovery` of `used`. */
export function recover(used: number, recovery: Recovery): number {
  return recovery === 'all' ? 0 : Math.max(0, used - recovery);
}
