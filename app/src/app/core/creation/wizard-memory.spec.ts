import { newCharacter } from '../models/character';
import {
  MemoryStorage,
  clearLevelUp,
  clearStep,
  readLevelUp,
  readStep,
  writeLevelUp,
  writeStep,
} from './wizard-memory';

function fakeStorage(): MemoryStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('wizard memory', () => {
  const steps = ['class', 'species', 'spells'] as const;

  it('remembers the step per scope and ignores unknown ones', () => {
    const st = fakeStorage();
    expect(readStep(st, 'new', steps)).toBeNull();
    writeStep(st, 'new', 'spells');
    writeStep(st, 'abc', 'bogus');
    expect(readStep(st, 'new', steps)).toBe('spells');
    expect(readStep(st, 'abc', steps)).toBeNull();
    clearStep(st, 'new');
    expect(readStep(st, 'new', steps)).toBeNull();
  });

  it('works without storage', () => {
    expect(readStep(null, 'new', steps)).toBeNull();
    expect(() => writeStep(null, 'new', 'class')).not.toThrow();
  });

  it('restores a level up only for the same saved character', () => {
    const st = fakeStorage();
    const draft = newCharacter('Elara', 'dev');
    writeLevelUp(st, draft.id, {
      classId: 'wizard',
      step: 'choices',
      hpMode: 'roll',
      draft,
      base: 'T1',
    });
    const m = readLevelUp(st, draft.id, 'T1');
    expect(m?.classId).toBe('wizard');
    expect(m?.step).toBe('choices');
    expect(m?.hpMode).toBe('roll');
    expect(m?.draft.name).toBe('Elara');
    // the character was saved meanwhile: the old level up no longer applies
    expect(readLevelUp(st, draft.id, 'T2')).toBeNull();
    clearLevelUp(st, draft.id);
    expect(readLevelUp(st, draft.id, 'T1')).toBeNull();
  });

  it('ignores corrupt data', () => {
    const st = fakeStorage();
    st.setItem('dnd-helper.level-up.x', '{nope');
    expect(readLevelUp(st, 'x', '')).toBeNull();
  });
});
