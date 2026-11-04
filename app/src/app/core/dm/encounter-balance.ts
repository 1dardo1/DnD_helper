/**
 * Balancing advice for an encounter, with the 2024 rules (Dungeon Master's Guide 2024, chapter 3
 * "DM's Toolbox" → "Combat Encounters"): the DM picks a difficulty, its XP budget is the sum of the
 * characters' budgets, and the monsters' XP should be within it. An encounter "is" a difficulty
 * when its XP is above the previous difficulty's budget and within its own (rateEncounter):
 *
 *   Low: 1…Low budget · Moderate: above Low…Moderate budget · High: above Moderate…High budget
 *
 * From that: how many XP are missing or over, how many more or fewer of each monster already in
 * the encounter would land it in the target band (the smallest change), and compendium monsters
 * that fit the XP left. Pure functions, no Angular.
 */
import { Budget, Difficulty, partyBudget } from './encounter-difficulty';

/** What the advice needs of a monster. */
export interface BalanceMonster {
  id: string;
  xp: number;
  cr: number;
  creatureType: string;
}

export type BalanceStatus = 'noParty' | 'below' | 'onTarget' | 'above';

/** Change the number of one of the encounter's monsters: delta > 0 adds, < 0 removes. */
export interface Adjustment {
  monsterId: string;
  delta: number;
  xpAfter: number;
  creaturesAfter: number;
}

/** A monster not in the encounter that, `count` of them, lands it in the target band. */
export interface Fit {
  monsterId: string;
  count: number;
  xpAfter: number;
  /** Same creature type as one already in the encounter. */
  sameType: boolean;
}

export type BalanceWarning =
  | { kind: 'highCr'; monsterId: string; cr: number; level: number }
  | { kind: 'manyCreatures'; creatures: number; characters: number }
  | { kind: 'aboveHigh' };

export interface Balance {
  target: Difficulty;
  /** XP budget of the target difficulty. */
  budget: number;
  /** The encounter reaches the target above this many XP (the previous difficulty's budget). */
  floor: number;
  xp: number;
  /** XP to reach the target band (> 0 when below it), 0 within it. */
  missing: number;
  /** XP over the target budget (> 0 when above it). */
  over: number;
  /** XP left before the target budget is spent (0 when above). */
  room: number;
  status: BalanceStatus;
  adjustments: Adjustment[];
  fits: Fit[];
  warnings: BalanceWarning[];
}

export interface BalanceInput {
  levels: readonly number[];
  monsters: readonly { monsterId: string; count: number }[];
  target: Difficulty;
  /** The compendium's monsters, to look up those of the encounter and suggest others. */
  compendium: readonly BalanceMonster[];
  /** How many fits to suggest. */
  maxFits?: number;
}

/**
 * More creatures than this many per character makes the warning appear. A rule of thumb, not a
 * DMG rule: many creatures make a fight long and its outcome harder to predict (each one acts and
 * the dice swing more), which the 2024 DMG's encounter guidance warns about in general terms.
 */
export const MANY_CREATURES_PER_CHARACTER = 2;

/** The band (floor, budget] of a difficulty. */
export function targetBand(budget: Budget, target: Difficulty): { floor: number; budget: number } {
  if (target === 'low') return { floor: 0, budget: budget.low };
  if (target === 'moderate') return { floor: budget.low, budget: budget.moderate };
  return { floor: budget.moderate, budget: budget.high };
}

/** Whether this many XP lands in the band. */
function inBand(xp: number, band: { floor: number; budget: number }): boolean {
  return xp > band.floor && xp <= band.budget;
}

/**
 * The smallest change in the number of one monster (XP each `xp`, `count` in the encounter) that
 * lands the encounter's total in the band; 0 if it's already there, null if no number of that
 * monster can do it (it's worth too many XP for the band, or removing them all isn't enough).
 */
export function smallestChange(
  total: number,
  xp: number,
  count: number,
  band: { floor: number; budget: number },
): number | null {
  if (inBand(total, band)) return 0;
  if (xp <= 0) return null;
  if (total <= band.floor) {
    const add = Math.floor((band.floor - total) / xp) + 1;
    return total + add * xp <= band.budget ? add : null;
  }
  const remove = Math.ceil((total - band.budget) / xp);
  return remove <= count && total - remove * xp > band.floor ? -remove : null;
}

export function balanceEncounter(input: BalanceInput): Balance {
  const { levels, monsters, target, compendium } = input;
  const byId = new Map(compendium.map((m) => [m.id, m]));
  const fullBudget = partyBudget(levels);
  const band = targetBand(fullBudget, target);
  const xp = monsters.reduce((n, m) => n + (byId.get(m.monsterId)?.xp ?? 0) * m.count, 0);
  const creatures = monsters.reduce((n, m) => n + m.count, 0);
  const characters = levels.length;

  const status: BalanceStatus = !characters
    ? 'noParty'
    : xp <= band.floor
      ? 'below'
      : xp <= band.budget
        ? 'onTarget'
        : 'above';
  const balance: Balance = {
    target,
    budget: band.budget,
    floor: band.floor,
    xp,
    missing: status === 'below' ? band.floor + 1 - xp : 0,
    over: status === 'above' ? xp - band.budget : 0,
    room: Math.max(0, band.budget - xp),
    status,
    adjustments: [],
    fits: [],
    warnings: [],
  };
  if (status === 'noParty') return balance;

  // -- more or fewer of the monsters already there --
  if (status !== 'onTarget') {
    for (const m of monsters) {
      const mon = byId.get(m.monsterId);
      if (!mon) continue;
      const delta = smallestChange(xp, mon.xp, m.count, band);
      if (!delta) continue;
      balance.adjustments.push({
        monsterId: m.monsterId,
        delta,
        xpAfter: xp + delta * mon.xp,
        creaturesAfter: creatures + delta,
      });
    }
    // fewest creatures changed first, then the result closest to the budget
    balance.adjustments.sort(
      (a, b) =>
        Math.abs(a.delta) - Math.abs(b.delta) ||
        band.budget - a.xpAfter - (band.budget - b.xpAfter),
    );
  }

  // -- other monsters that fit the XP left --
  const average = levels.reduce((n, l) => n + l, 0) / characters;
  const maxCreatures = Math.max(1, MANY_CREATURES_PER_CHARACTER * characters);
  if (status !== 'above') {
    const present = new Set(monsters.map((m) => m.monsterId));
    const types = new Set(
      monsters.flatMap((m) => byId.get(m.monsterId)?.creatureType ?? []).map((t) => t),
    );
    const fits: Fit[] = [];
    for (const mon of compendium) {
      if (present.has(mon.id) || mon.xp <= 0 || mon.cr > average) continue;
      // how many to reach the band; one when it's already there
      const count = status === 'below' ? Math.floor((band.floor - xp) / mon.xp) + 1 : 1;
      const xpAfter = xp + count * mon.xp;
      if (!inBand(xpAfter, band) || creatures + count > maxCreatures) continue;
      fits.push({ monsterId: mon.id, count, xpAfter, sameType: types.has(mon.creatureType) });
    }
    fits.sort(
      (a, b) =>
        Number(b.sameType) - Number(a.sameType) ||
        a.count - b.count ||
        b.xpAfter - a.xpAfter ||
        a.monsterId.localeCompare(b.monsterId),
    );
    balance.fits = fits.slice(0, input.maxFits ?? 6);
  }

  // -- warnings --
  // DMG 2024, ch. 3 "Combat Encounters": a creature whose CR is above the characters' level can
  // deal enough damage at once to drop a character.
  for (const m of monsters) {
    const mon = byId.get(m.monsterId);
    if (mon && mon.cr > average)
      balance.warnings.push({
        kind: 'highCr',
        monsterId: mon.id,
        cr: mon.cr,
        level: Math.round(average * 10) / 10,
      });
  }
  if (creatures > maxCreatures)
    balance.warnings.push({ kind: 'manyCreatures', creatures, characters });
  // DMG 2024: High is the top budget; beyond it the guide gives no difficulty.
  if (xp > fullBudget.high) balance.warnings.push({ kind: 'aboveHigh' });
  return balance;
}
