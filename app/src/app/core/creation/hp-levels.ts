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

/** The hit points a level gives before Constitution (level 1 of the starting class: the full die). */
export function levelHp(
  k: Pick<ClassEntry, 'hp'>,
  i: number,
  hitDie: number,
  first: boolean,
): number {
  if (first && i === 0) return hitDie;
  return k.hp[i] ?? averageHp(hitDie);
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
  /** True for the level 1 of the starting class (always the full die). */
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
        method: first ? null : hpMethodAt(k, i),
        max: first,
        gained,
        con: conMod,
        total: Math.max(gained + conMod, 1),
      });
    }
  });
  return rows;
}
