import { Character, normalizeCharacter } from '../models/character';

/**
 * What the creation wizard and the level-up screen keep, besides the character draft, so that
 * opening an entry of the compendium and coming back (the page is rebuilt) finds everything as it
 * was: the step the user was on and, for the level up, the draft itself. Lives in the tab's
 * sessionStorage: it is not a draft to keep, only the way back from a detour. Pure helpers: the
 * storage is passed in.
 */
export type MemoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STEP_PREFIX = 'dnd-helper.wizard-step.';
const LEVEL_UP_PREFIX = 'dnd-helper.level-up.';

/** sessionStorage, or null where it can't be used. */
export function sessionMemory(): MemoryStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The wizard step left open for `scope` ('new' or a character id), if it is one of `valid`. */
export function readStep<T extends string>(
  storage: MemoryStorage | null,
  scope: string,
  valid: readonly T[],
): T | null {
  try {
    const v = storage?.getItem(STEP_PREFIX + scope);
    return v && (valid as readonly string[]).includes(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

export function writeStep(storage: MemoryStorage | null, scope: string, step: string): void {
  try {
    storage?.setItem(STEP_PREFIX + scope, step);
  } catch {
    // nothing to remember it with
  }
}

export function clearStep(storage: MemoryStorage | null, scope: string): void {
  try {
    storage?.removeItem(STEP_PREFIX + scope);
  } catch {
    // nothing to clear
  }
}

/** The level up in progress. */
export interface LevelUpMemory {
  classId: string;
  step: string;
  hpMode: 'average' | 'roll';
  draft: Character;
  /** `updatedAt` of the saved character it started from: a different one means it's stale. */
  base: string;
}

export function readLevelUp(
  storage: MemoryStorage | null,
  id: string,
  base: string,
): LevelUpMemory | null {
  try {
    const raw = storage?.getItem(LEVEL_UP_PREFIX + id);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<LevelUpMemory>;
    const draft = normalizeCharacter(m.draft);
    if (!draft || draft.id !== id || m.base !== base || !m.classId) return null;
    return {
      classId: m.classId,
      step: typeof m.step === 'string' ? m.step : 'class',
      hpMode: m.hpMode === 'roll' ? 'roll' : 'average',
      draft,
      base,
    };
  } catch {
    return null;
  }
}

export function writeLevelUp(storage: MemoryStorage | null, id: string, m: LevelUpMemory): void {
  try {
    storage?.setItem(LEVEL_UP_PREFIX + id, JSON.stringify(m));
  } catch {
    // nothing to remember it with
  }
}

export function clearLevelUp(storage: MemoryStorage | null, id: string): void {
  try {
    storage?.removeItem(LEVEL_UP_PREFIX + id);
  } catch {
    // nothing to clear
  }
}
