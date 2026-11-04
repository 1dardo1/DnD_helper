import { Character, normalizeCharacter } from '../models/character';

/**
 * Unsaved edits of an existing character, kept in this browser (one key per character) so that
 * leaving the edit wizard, reloading or closing the app never loses them. Pure helpers: the
 * storage is passed in, so they can be tested without a browser.
 */
export const EDIT_DRAFT_PREFIX = 'dnd-helper.draft.edit.';

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface EditDraft {
  /** The character as it is in the wizard. */
  character: Character;
  /** The saved character the edits started from (to bring in what changed there meanwhile). */
  base: Character;
  /** When the draft was last written (ISO). */
  savedAt: string;
}

/** A draft ready to go back into the wizard. */
export interface RestoredDraft {
  character: Character;
  /** The saved character the restored draft is now based on (the current one). */
  base: Character;
  /** The saved character changed since the draft was started (another device, the sheet...). */
  outdated: boolean;
  /** Fields changed both in the draft and in the saved character: the draft's value was kept. */
  conflicts: string[];
}

/** Fields that say who saved when, not what the character is. */
const META_FIELDS = new Set(['updatedAt', 'updatedBy', 'dataVersion']);

export function editDraftKey(id: string): string {
  return EDIT_DRAFT_PREFIX + id;
}

/** localStorage, or null where it can't be used (private mode, blocked site data...). */
export function browserStorage(): DraftStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readEditDraft(storage: DraftStorage | null, id: string): EditDraft | null {
  try {
    const raw = storage?.getItem(editDraftKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EditDraft>;
    const character = normalizeCharacter(parsed.character);
    const base = normalizeCharacter(parsed.base);
    if (!character || !base || character.id !== id || base.id !== id) return null;
    return { character, base, savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '' };
  } catch {
    return null;
  }
}

/** Returns false if it could not be stored (then the edits only live in the open page). */
export function writeEditDraft(
  storage: DraftStorage | null,
  draft: Omit<EditDraft, 'savedAt'>,
  now = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const value: EditDraft = { ...draft, savedAt: now.toISOString() };
    storage.setItem(editDraftKey(draft.character.id), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeEditDraft(storage: DraftStorage | null, id: string): void {
  try {
    storage?.removeItem(editDraftKey(id));
  } catch {
    // nothing to remove
  }
}

/** Same character, ignoring when and where it was saved. */
export function sameContent(a: Character, b: Character): boolean {
  return stable(withoutMeta(a)) === stable(withoutMeta(b));
}

/**
 * What to put back in the wizard when editing `stored` and a draft exists, or null when there is
 * nothing pending (no draft, or it has no change). Whatever changed in the saved character since
 * the draft started (hit points spent on the sheet, a sync from another device) is brought in,
 * field by field; where both changed the same field, the draft wins and the field is reported.
 */
export function restoreEditDraft(draft: EditDraft | null, stored: Character): RestoredDraft | null {
  if (!draft || draft.character.id !== stored.id) return null;
  const outdated = draft.base.updatedAt !== stored.updatedAt && !sameContent(draft.base, stored);
  const { value, conflicts } = outdated
    ? merge3(draft.base, draft.character, stored)
    : { value: draft.character, conflicts: [] };
  const character = { ...(value as Character), updatedAt: stored.updatedAt };
  if (sameContent(character, stored)) return null;
  return { character, base: stored, outdated, conflicts };
}

/**
 * Three-way merge of plain JSON values: objects field by field (recursively), anything else
 * (numbers, strings, arrays) as a whole. Returns the merged value and the paths changed on both
 * sides to different values, where `mine` was kept.
 */
export function merge3(
  base: unknown,
  mine: unknown,
  theirs: unknown,
  path = '',
): { value: unknown; conflicts: string[] } {
  if (stable(mine) === stable(theirs)) return { value: mine, conflicts: [] };
  if (stable(mine) === stable(base)) return { value: theirs, conflicts: [] };
  if (stable(theirs) === stable(base)) return { value: mine, conflicts: [] };
  if (isObject(mine) && isObject(theirs)) {
    const b = isObject(base) ? base : {};
    const out: Record<string, unknown> = {};
    const conflicts: string[] = [];
    for (const key of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      if (!path && META_FIELDS.has(key)) {
        out[key] = mine[key];
        continue;
      }
      const r = merge3(b[key], mine[key], theirs[key], path ? `${path}.${key}` : key);
      if (r.value !== undefined) out[key] = r.value;
      conflicts.push(...r.conflicts);
    }
    return { value: out, conflicts };
  }
  return { value: mine, conflicts: [path] };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function withoutMeta(c: Character): Record<string, unknown> {
  return Object.fromEntries(Object.entries(c).filter(([k]) => !META_FIELDS.has(k)));
}

/** JSON with object keys sorted, so key order never counts as a change. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_, x: unknown) =>
    isObject(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
}
