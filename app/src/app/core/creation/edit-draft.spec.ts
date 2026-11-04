import { Character, newCharacter } from '../models/character';
import {
  DraftStorage,
  EditDraft,
  editDraftKey,
  merge3,
  readEditDraft,
  removeEditDraft,
  restoreEditDraft,
  sameContent,
  writeEditDraft,
} from './edit-draft';

class MemoryStorage implements DraftStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function thorin(): Character {
  return {
    ...newCharacter('Thorin', 'pc'),
    id: 'thorin',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function draftOf(base: Character, character: Character): EditDraft {
  return { base, character, savedAt: '2026-01-02T00:00:00.000Z' };
}

describe('edit draft storage', () => {
  it('writes, reads back and removes a draft under a key per character', () => {
    const storage = new MemoryStorage();
    const base = thorin();
    const character = { ...base, name: 'Thorin II' };
    expect(writeEditDraft(storage, { base, character }, new Date('2026-01-03T00:00:00Z'))).toBe(
      true,
    );
    expect([...storage.map.keys()]).toEqual(['dnd-helper.draft.edit.thorin']);
    expect(editDraftKey('thorin')).toBe('dnd-helper.draft.edit.thorin');

    const read = readEditDraft(storage, 'thorin');
    expect(read?.character.name).toBe('Thorin II');
    expect(read?.base.name).toBe('Thorin');
    expect(read?.savedAt).toBe('2026-01-03T00:00:00.000Z');
    expect(readEditDraft(storage, 'other')).toBeNull();

    removeEditDraft(storage, 'thorin');
    expect(readEditDraft(storage, 'thorin')).toBeNull();
  });

  it('ignores broken or foreign entries and survives storage errors', () => {
    const storage = new MemoryStorage();
    storage.setItem(editDraftKey('thorin'), '{not json');
    expect(readEditDraft(storage, 'thorin')).toBeNull();
    storage.setItem(
      editDraftKey('thorin'),
      JSON.stringify(draftOf({ ...thorin(), id: 'x' }, thorin())),
    );
    expect(readEditDraft(storage, 'thorin')).toBeNull();

    const full: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(writeEditDraft(full, { base: thorin(), character: thorin() })).toBe(false);
    expect(writeEditDraft(null, { base: thorin(), character: thorin() })).toBe(false);
    expect(readEditDraft(null, 'thorin')).toBeNull();
  });
});

describe('sameContent', () => {
  it('ignores who saved it, when, and the key order', () => {
    const a = thorin();
    const b = { ...a, updatedAt: '2030-01-01T00:00:00.000Z', updatedBy: 'phone', dataVersion: 'x' };
    expect(sameContent(a, b)).toBe(true);
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as Character;
    expect(sameContent(a, reordered)).toBe(true);
    expect(sameContent(a, { ...a, notes: 'beard' })).toBe(false);
  });
});

describe('restoreEditDraft', () => {
  it('restores a draft with changes over an unchanged character', () => {
    const stored = thorin();
    const r = restoreEditDraft(draftOf(stored, { ...stored, name: 'Thorin II' }), stored);
    expect(r?.character.name).toBe('Thorin II');
    expect(r?.outdated).toBe(false);
    expect(r?.conflicts).toEqual([]);
    expect(r?.base).toBe(stored);
  });

  it('has nothing to restore without a draft or when it matches the saved character', () => {
    const stored = thorin();
    expect(restoreEditDraft(null, stored)).toBeNull();
    expect(restoreEditDraft(draftOf(stored, stored), stored)).toBeNull();
    // the same change was saved meanwhile (e.g. from another device)
    const saved = { ...stored, name: 'Thorin II', updatedAt: '2026-02-01T00:00:00.000Z' };
    expect(restoreEditDraft(draftOf(stored, { ...stored, name: 'Thorin II' }), saved)).toBeNull();
  });

  it('brings in what changed in the saved character meanwhile and warns', () => {
    const base = thorin();
    const stored: Character = {
      ...base,
      updatedAt: '2026-02-01T00:00:00.000Z',
      state: { ...base.state, hpCurrent: 3 },
    };
    const r = restoreEditDraft(draftOf(base, { ...base, name: 'Thorin II' }), stored);
    expect(r?.outdated).toBe(true);
    expect(r?.conflicts).toEqual([]);
    expect(r?.character.name).toBe('Thorin II');
    expect(r?.character.state.hpCurrent).toBe(3);
    expect(r?.character.updatedAt).toBe(stored.updatedAt);
    expect(r?.base).toBe(stored);
  });

  it('keeps the draft where both changed the same field, and lists it', () => {
    const base = thorin();
    const stored = { ...base, notes: 'theirs', updatedAt: '2026-02-01T00:00:00.000Z' };
    const r = restoreEditDraft(draftOf(base, { ...base, notes: 'mine' }), stored);
    expect(r?.character.notes).toBe('mine');
    expect(r?.outdated).toBe(true);
    expect(r?.conflicts).toEqual(['notes']);
  });

  it('a new updatedAt with the same content is not an older version', () => {
    const base = thorin();
    const stored = { ...base, updatedAt: '2026-02-01T00:00:00.000Z' };
    const r = restoreEditDraft(draftOf(base, { ...base, name: 'Thorin II' }), stored);
    expect(r?.outdated).toBe(false);
  });
});

describe('merge3', () => {
  it('merges objects field by field and arrays as a whole', () => {
    const base = { a: 1, b: { x: 1, y: 1 }, list: [1] };
    const mine = { a: 2, b: { x: 2, y: 1 }, list: [1, 2] };
    const theirs = { a: 1, b: { x: 1, y: 3 }, list: [1, 3] };
    expect(merge3(base, mine, theirs)).toEqual({
      value: { a: 2, b: { x: 2, y: 3 }, list: [1, 2] },
      conflicts: ['list'],
    });
  });

  it('takes fields added on either side', () => {
    expect(merge3({}, { a: 1 }, { b: 2 }).value).toEqual({ a: 1, b: 2 });
  });
});
