/**
 * Encounter difficulty with the 2024 rules (Dungeon Master's Guide 2024, chapter 3 "DM's
 * Toolbox" → "Combat Encounters", table "XP Budget per Character"):
 *
 * 1. Pick a difficulty (Low, Moderate or High) and look up the XP budget per character of each
 *    character's level; the encounter's budget is the sum over the characters.
 * 2. The encounter's XP is the sum of the XP of its monsters (as in their stat blocks). Unlike the
 *    2014 rules there's no multiplier for the number of monsters.
 *
 * Pure functions, no Angular: the encounter builder and the combat tracker share them.
 */

export type Difficulty = 'low' | 'moderate' | 'high';
/** Where an encounter falls: within a budget, above High, or nothing to fight yet. */
export type DifficultyRating = Difficulty | 'aboveHigh' | 'none';

export const DIFFICULTIES: readonly Difficulty[] = ['low', 'moderate', 'high'];

/**
 * DMG 2024, "XP Budget per Character": [Low, Moderate, High] for character levels 1–20
 * (index 0 = level 1).
 */
export const XP_BUDGET_PER_CHARACTER: readonly (readonly [number, number, number])[] = [
  [50, 75, 100], // 1
  [100, 150, 200], // 2
  [150, 225, 400], // 3
  [250, 375, 500], // 4
  [500, 750, 1100], // 5
  [600, 1000, 1400], // 6
  [750, 1300, 1700], // 7
  [1000, 1700, 2100], // 8
  [1300, 2000, 2600], // 9
  [1600, 2300, 3100], // 10
  [1900, 2900, 4100], // 11
  [2200, 3700, 4700], // 12
  [2600, 4200, 5400], // 13
  [2900, 4900, 6200], // 14
  [3300, 5400, 7800], // 15
  [3800, 6100, 9800], // 16
  [4500, 7200, 11700], // 17
  [5000, 8700, 14200], // 18
  [5500, 10700, 17200], // 19
  [6400, 13200, 22000], // 20
];

export type Budget = Record<Difficulty, number>;

/** XP budget of one character of this level (levels outside 1–20 are clamped). */
export function characterBudget(level: number): Budget {
  const i = Math.min(20, Math.max(1, Math.round(level) || 1)) - 1;
  const [low, moderate, high] = XP_BUDGET_PER_CHARACTER[i];
  return { low, moderate, high };
}

/** The party's budget: the sum of each character's budget. */
export function partyBudget(levels: readonly number[]): Budget {
  const total: Budget = { low: 0, moderate: 0, high: 0 };
  for (const level of levels) {
    const b = characterBudget(level);
    total.low += b.low;
    total.moderate += b.moderate;
    total.high += b.high;
  }
  return total;
}

/** Sum of the monsters' XP times how many of each; unknown monsters count 0. */
export function encounterXp(
  monsters: readonly { monsterId: string; count: number }[],
  xpOf: (monsterId: string) => number | undefined,
): number {
  return monsters.reduce((sum, m) => sum + (xpOf(m.monsterId) ?? 0) * Math.max(0, m.count), 0);
}

/**
 * The lowest difficulty whose budget the encounter fits in (XP ≤ budget), or "aboveHigh". "none"
 * with no monsters or no party.
 */
export function rateEncounter(xp: number, budget: Budget): DifficultyRating {
  if (xp <= 0 || budget.high <= 0) return 'none';
  if (xp <= budget.low) return 'low';
  if (xp <= budget.moderate) return 'moderate';
  if (xp <= budget.high) return 'high';
  return 'aboveHigh';
}

/**
 * XP each character earns when the party defeats the encounter: the total split evenly, rounded
 * down (2024 rules: the XP of the defeated monsters is divided among the characters).
 */
export function xpPerCharacter(xp: number, characters: number): number {
  return characters > 0 ? Math.floor(xp / characters) : 0;
}

/**
 * The scale of the gauge: a bit beyond High (or the encounter, if it's bigger), so the High mark
 * isn't at the very end. Positions are fractions 0–1 of it.
 */
export function gaugeScale(
  xp: number,
  budget: Budget,
): {
  max: number;
  marks: Record<Difficulty, number>;
  fill: number;
} {
  const max = Math.max(budget.high * 1.25, xp, 1);
  return {
    max,
    marks: {
      low: budget.low / max,
      moderate: budget.moderate / max,
      high: budget.high / max,
    },
    fill: Math.min(1, xp / max),
  };
}
