/**
 * How a level's hit points were obtained, and the check of the stored list. Apart from
 * hp-levels.ts because the character model (in the app's first load) only needs this: the rest of
 * the hit points rules go with the sheet and the wizard, in their own chunks.
 */
export type HpMethod = 'roll' | 'average' | 'fixed';

export function isHpMethod(x: unknown): x is HpMethod {
  return x === 'roll' || x === 'average' || x === 'fixed';
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
