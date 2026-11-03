import { defaultOrder, groupOrder } from './entry-order';

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

  it('orders class options by the level they require (none = 1), then by name', () => {
    const option = (name: string, level?: number) =>
      ({
        id: name,
        type: 'option',
        name,
        prerequisites: level ? { raw: `Level ${level}+`, level } : null,
      }) as never;
    const list = [
      option('Witch Sight', 15),
      option('Mask of Many Faces', 2),
      option('Thirsting Blade', 5),
      option('Pact of the Tome'),
      option('Agonizing Blast', 2),
      option('Armor of Shadows', 1),
    ];
    expect(names(defaultOrder(list, (o: { name: string }) => o.name))).toEqual([
      'Armor of Shadows',
      'Pact of the Tome',
      'Agonizing Blast',
      'Mask of Many Faces',
      'Thirsting Blade',
      'Witch Sight',
    ]);
  });

  it('puts mundane items first, in the Player Handbook order, and magic ones after', () => {
    const item = (name: string, category: string, extra: object = {}) =>
      ({ id: name, type: 'item', name, category, ...extra }) as never;
    const weapon = (kind: string | null, ranged: boolean) => ({
      weapon: { kind, ranged, damage: [{ dice: '1d6', type: 'piercing' }], properties: [] },
    });
    const armor = (kind: string) => ({ armor: { kind } });
    const list = [
      item('+1 Longsword', 'weapon', { ...weapon('martial', false), magic: { rarity: 'rare' } }),
      item('Bag of Holding', 'other', { magic: { rarity: 'uncommon' } }),
      item('Rope', 'gear'),
      item('Plate Armor', 'armor', armor('heavy')),
      item('Leather Armor', 'armor', armor('light')),
      item('Shield', 'shield', armor('shield')),
      item('Longbow', 'weapon', weapon('martial', true)),
      item('Longsword', 'weapon', weapon('martial', false)),
      item('Shortbow', 'weapon', weapon('simple', true)),
      item('Club', 'weapon', weapon('simple', false)),
      item('Tinker Tools', 'tool'),
      item('Arrows', 'weapon', { weapon: { kind: 'martial', ranged: false, damage: [] } }),
    ];
    expect(names(defaultOrder(list, (i: { name: string }) => i.name))).toEqual([
      'Club',
      'Shortbow',
      'Longsword',
      'Longbow',
      'Arrows',
      'Leather Armor',
      'Plate Armor',
      'Shield',
      'Rope',
      'Tinker Tools',
      '+1 Longsword',
      'Bag of Holding',
    ]);
  });

  it('keeps the name order for other types and plain objects', () => {
    const list = [{ name: 'Wood Elf' }, { name: 'Drow' }, { name: 'High Elf' }];
    expect(names(defaultOrder(list, (x) => x.name))).toEqual(['Drow', 'High Elf', 'Wood Elf']);
  });
});

describe('groupOrder', () => {
  const card = (value: string, count: number) => ({ value, label: value, count });

  it('orders feat categories by the level a character gets them', () => {
    const cards = [
      card('general', 192),
      card('origin', 39),
      card('epic-boon', 36),
      card('racial', 27),
      card('fighting-style', 19),
      card('mystery', 50),
    ];
    expect(groupOrder('feat', 'category', cards).map((c) => c.value)).toEqual([
      'origin',
      'fighting-style',
      'general',
      'racial',
      'epic-boon',
      'mystery',
    ]);
  });

  it('orders item categories as in the Player Handbook, magic items last', () => {
    const cards = [card('other', 764), card('gear', 122), card('weapon', 276), card('armor', 90)];
    expect(groupOrder('item', 'category', cards).map((c) => c.value)).toEqual([
      'weapon',
      'armor',
      'gear',
      'other',
    ]);
  });

  it('keeps classes by name and other groups from the biggest', () => {
    const classes = [card('wizard', 30), card('bard', 10)];
    expect(groupOrder('subclass', 'class', classes).map((c) => c.value)).toEqual([
      'bard',
      'wizard',
    ]);
    const options = [card('metamagic', 10), card('eldritch-invocation', 30)];
    expect(groupOrder('option', 'group', options).map((c) => c.value)).toEqual([
      'eldritch-invocation',
      'metamagic',
    ]);
  });
});
