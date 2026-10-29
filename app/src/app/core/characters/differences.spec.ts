import { newCharacter } from '../models/character';
import { RulesData } from '../rules/engine';
import { describeDifferences } from './differences';

const empty: RulesData = {
  classes: new Map(),
  subclasses: new Map(),
  species: new Map(),
  backgrounds: new Map(),
  feats: new Map([['tough', { name: 'Tough' } as never]]),
  items: new Map(),
};

describe('describeDifferences', () => {
  it('lists only what changed, in game terms', () => {
    const base = { ...newCharacter('Thorin', 'pc'), id: 't' };
    const mine = {
      ...base,
      notes: 'mine',
      choices: { ...base.choices, feats: ['tough'] },
      state: { ...base.state, hpCurrent: 3 },
    };
    const theirs = { ...base, notes: 'theirs', updatedAt: '2020-01-01T00:00:00Z' };
    expect(describeDifferences(mine, theirs, empty)).toEqual([
      { label: 'conflict.field.hp', mine: '3 / 0', theirs: '0 / 0' },
      { label: 'conflict.field.feats', mine: 'Tough', theirs: '—' },
      { label: 'conflict.field.notes', mine: 'mine', theirs: 'theirs' },
    ]);
  });

  it('is empty when only the save date differs', () => {
    const base = newCharacter('Thorin', 'pc');
    expect(describeDifferences(base, { ...base, updatedAt: 'x', updatedBy: 'y' }, empty)).toEqual(
      [],
    );
  });
});
