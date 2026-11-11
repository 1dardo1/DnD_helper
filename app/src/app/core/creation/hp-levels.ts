import type { Character } from '../models/character';

/**
 * Hit points gained per class level and the method used for each: a roll of the class's hit die,
 * its average, or a fixed value the player chose. The numbers live in `ClassEntry.hp` (null = the
 * average, as always); the method in the optional `ClassEntry.hpMethod`, so older characters
 * (numbers only) keep working: no method = "the stored value".
 */

export type ClassEntry = Character['classes'][number];
export type HpMethod = 'roll' | 'average' | 'fixed';
export const HP_METHODS: HpMethod[] = ['roll', 'average', 'fixed'];

/** Average of a hit die (2024 PHB: half the die, rounded up: d6 4, d8 5, d10 6, d12 7). */
export function averageHp(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1;
}

/** One roll of the hit die. */
export function rollHitDie(hitDie: number, rng: () => number = Math.random): number {
  return Math.min(hitDie, Math.floor(rng() * hitDie) + 1);
}

/** Keeps a typed value inside 1..die; null when it isn't a number. */
export function clampHp(raw: unknown, hitDie: number): number | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n), 1), hitDie);
}

export function isHpMethod(x: unknown): x is HpMethod {
  return x === 'roll' || x === 'average' || x === 'fixed';
}

/** Method recorded for level index `i` (0-based) of the class; null = none (older character). */
export function hpMethodAt(k: Pick<ClassEntry, 'hpMethod'>, i: number): HpMethod | null {
  const m = k.hpMethod?.[i];
  return isHpMethod(m) ? m : null;
}

/**
 * The hit points a level gives before Constitution. Level 1 of the starting class is the full die
 * (the rule); only a method chosen for it on purpose (a house rule) changes that, and a roll not
 * made yet keeps the full die meanwhile. Older characters (no method) always get the full die.
 */
export function levelHp(
  k: Pick<ClassEntry, 'hp' | 'hpMethod'>,
  i: number,
  hitDie: number,
  first: boolean,
): number {
  if (first && i === 0) {
    const m = hpMethodAt(k, 0);
    if (!m) return hitDie;
    if (m === 'average') return averageHp(hitDie);
    return k.hp[0] ?? hitDie;
  }
  return k.hp[i] ?? averageHp(hitDie);
}

/** Level 1 of the starting class goes by a house rule (not the full die of the rule). */
export function firstLevelHouseRule(k: Pick<ClassEntry, 'hpMethod'>): boolean {
  return hpMethodAt(k, 0) !== null;
}

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

/** Resizes hp and hpMethod to the class level (extra levels are empty = average). */
export function resizeHp(k: ClassEntry, level: number): void {
  k.hp = Array.from({ length: level }, (_, i) => k.hp[i] ?? null);
  if (k.hpMethod) k.hpMethod = Array.from({ length: level }, (_, i) => k.hpMethod![i] ?? null);
}

/**
 * Sets how level index `i` got its hit points. 'average' stores null; 'roll' and 'fixed' store
 * `value` (clamped to the die; null = not rolled yet, which counts as the average meanwhile).
 */
export function withHpMethod(
  k: ClassEntry,
  i: number,
  hitDie: number,
  method: HpMethod,
  value: number | null = null,
): ClassEntry {
  const hpMethod = Array.from({ length: k.hp.length }, (_, j) => hpMethodAt(k, j));
  const hp = [...k.hp];
  hpMethod[i] = method;
  hp[i] = method === 'average' ? null : clampHp(value, hitDie);
  return { ...k, hp, hpMethod };
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

/** Normalizes the stored method list of a class entry (older files have none). */
export function normalizeHpMethod(k: {
  hp?: (number | null)[];
  hpMethod?: unknown;
}): (HpMethod | null)[] | undefined {
  const raw = k.hpMethod;
  if (!Array.isArray(raw)) return undefined;
  const n = k.hp?.length ?? raw.length;
  return Array.from({ length: n }, (_, i) => (isHpMethod(raw[i]) ? raw[i] : null));
}

export interface HpLevelRow {
  classId: string;
  /** Level in that class (1-based). */
  level: number;
  die: number;
  /** null = older character, only the stored value. */
  method: HpMethod | null;
  /** Level 1 of the starting class with the full die of the rule (not a house rule). */
  max: boolean;
  /** Hit points the die/choice gives. */
  gained: number;
  /** Constitution modifier. */
  con: number;
  /** What the level adds to the maximum (at least 1). */
  total: number;
}

/** Per-level breakdown, in the order the classes were taken. */
export function hpBreakdown(
  classes: ClassEntry[],
  dieOf: (classId: string) => number | undefined,
  conMod: number,
): HpLevelRow[] {
  const rows: HpLevelRow[] = [];
  classes.forEach((k, ci) => {
    const die = dieOf(k.id);
    if (!die) return;
    for (let i = 0; i < k.level; i++) {
      const first = ci === 0 && i === 0;
      const gained = levelHp(k, i, die, first);
      rows.push({
        classId: k.id,
        level: i + 1,
        die,
        method: hpMethodAt(k, i),
        max: first && !firstLevelHouseRule(k),
        gained,
        con: conMod,
        total: Math.max(gained + conMod, 1),
      });
    }
  });
  return rows;
}
