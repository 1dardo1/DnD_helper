import {
  ClassEntry,
  firstLevelHouseRule,
  hpBreakdown,
  hpMethodAt,
  rollHitDie,
  withHpMethod,
} from './hp-levels';

/**
 * Hit points actions of the creation wizard on many levels at once: the same fixed value, a roll
 * or the average everywhere, a maximum written by hand spread over the levels, and level 1 of the
 * starting class back to the rule. Apart from hp-levels.ts because the character model (in the
 * app's first load) uses that one: these are only needed with the wizard's chunk.
 */

/** Back to the rule for level 1 of the starting class: the full die. */
export function withFirstLevelMax(k: ClassEntry): ClassEntry {
  const hpMethod = Array.from({ length: k.hp.length }, (_, j) =>
    j === 0 ? null : hpMethodAt(k, j),
  );
  return { ...k, hp: [null, ...k.hp.slice(1)], hpMethod };
}

/**
 * The levels a "for every level" action changes, as [class index, level index]: all of them but
 * level 1 of the starting class while it follows the rule (the full die).
 */
export function freeLevels(classes: readonly ClassEntry[]): [number, number][] {
  const out: [number, number][] = [];
  classes.forEach((k, ci) => {
    for (let i = 0; i < k.level; i++)
      if (!(ci === 0 && i === 0 && !firstLevelHouseRule(k))) out.push([ci, i]);
  });
  return out;
}

/** Rolls (or takes the average of) every free level of every class at once. */
export function withMethodEverywhere(
  classes: readonly ClassEntry[],
  dieOf: (classId: string) => number | undefined,
  method: 'roll' | 'average',
  rng: () => number = Math.random,
): ClassEntry[] {
  const out = classes.map((k) => ({ ...k }));
  for (const [ci, i] of freeLevels(classes)) {
    const die = dieOf(out[ci].id);
    if (!die) continue;
    out[ci] = withHpMethod(
      out[ci],
      i,
      die,
      method,
      method === 'roll' ? rollHitDie(die, rng) : null,
    );
  }
  return out;
}

/**
 * A maximum the player writes (rolled at the table, the DM's number...), spread over the free
 * levels as fixed values, as evenly as the dice allow (each level 1 to its die). `others` is what
 * the maximum has besides the levels (Tough, Dwarven Toughness...). With only level 1 (the rule),
 * that level takes the value as a house rule. `off`: how far the result is from what was asked
 * (0 = exact; it can't go below 1 or above the die on any level).
 */
export function spreadHpTotal(
  classes: readonly ClassEntry[],
  dieOf: (classId: string) => number | undefined,
  conMod: number,
  others: number,
  total: number,
): { classes: ClassEntry[]; off: number } {
  const out = classes.map((k) => ({ ...k }));
  let free = freeLevels(out).filter(([ci]) => !!dieOf(out[ci].id));
  if (!free.length && out[0] && dieOf(out[0].id)) {
    // a level 1 character: its only level takes the value (a house rule)
    out[0] = withHpMethod(out[0], 0, dieOf(out[0].id)!, 'fixed', dieOf(out[0].id)!);
    free = [[0, 0]];
  }
  const fixedPart = hpBreakdown(out, dieOf, conMod)
    .filter((r) => !free.some(([ci, i]) => out[ci].id === r.classId && i === r.level - 1))
    .reduce((n, r) => n + r.total, 0);
  // what the free levels' dice have to add up to
  let dice = total - others - fixedPart - conMod * free.length;
  const dies = free.map(([ci]) => dieOf(out[ci].id)!);
  const values = dies.map(() => 1);
  dice -= values.length;
  // one point at a time to the level with the most room left: as even as the dice allow
  while (dice > 0) {
    let best = -1;
    for (let j = 0; j < values.length; j++)
      if (values[j] < dies[j] && (best < 0 || values[j] < values[best])) best = j;
    if (best < 0) break;
    values[best]++;
    dice--;
  }
  free.forEach(([ci, i], j) => {
    out[ci] = withHpMethod(out[ci], i, dies[j], 'fixed', values[j]);
  });
  const got = hpBreakdown(out, dieOf, conMod).reduce((n, r) => n + r.total, 0) + others;
  return { classes: out, off: total - got };
}

/** The same fixed value on every level in `levels` (0-based indexes). */
export function withFixedAll(
  k: ClassEntry,
  levels: number[],
  hitDie: number,
  value: number,
): ClassEntry {
  let out = k;
  for (const i of levels) out = withHpMethod(out, i, hitDie, 'fixed', value);
  return out;
}
