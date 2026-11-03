import { defaultOrder } from './entry-order';

const spell = (name: string, level: number, concentration: boolean) =>
  ({ id: name, type: 'spell', name, level, concentration }) as never;
const feat = (name: string, from: string[] | null, id = name) =>
  ({
    id,
    type: 'feat',
    name,
    abilityIncrease: from ? { choose: 1, from, amount: 1, max: 20 } : null,
  }) as never;
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe('defaultOrder', () => {
  it('orders spells by level, then without concentration first, then by name', () => {
    const list = [
      spell('Haste', 3, true),
      spell('Fireball', 3, false),
      spell('Bless', 1, true),
      spell('Shield', 1, false),
      spell('Light', 0, false),
      spell('Counterspell', 3, false),
    ];
    expect(names(defaultOrder(list, (s: { name: string }) => s.name))).toEqual([
      'Light',
      'Shield',
      'Bless',
      'Counterspell',
      'Fireball',
      'Haste',
    ]);
  });

  it('puts feats that raise an ability first, by ability, then the rest', () => {
    const list = [
      feat('Alert', null),
      feat('Telepathic', ['INT', 'WIS', 'CHA']),
      feat('Actor', ['CHA']),
      feat('Athlete', ['STR', 'DEX']),
      feat('Heavy Armor Master', ['STR']),
      feat('Ability Score Improvement', null, 'ability-score-improvement'),
      feat('Durable', ['CON']),
      feat('Crusher', ['STR', 'CON']),
    ];
    expect(names(defaultOrder(list, (f: { name: string }) => f.name))).toEqual([
      'Ability Score Improvement',
      'Heavy Armor Master',
      'Athlete',
      'Crusher',
      'Durable',
      'Telepathic',
      'Actor',
      'Alert',
    ]);
  });
});
