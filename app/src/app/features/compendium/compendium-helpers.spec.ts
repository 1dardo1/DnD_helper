import { term } from '../../core/i18n/glossary';
import { Entry, Item, Spellcasting } from '../../core/models/compendium';
import { applyFilters, filterChoices, filterValues } from './compendium-filters';
import { normalise, rankName, searchDocs } from './compendium-search';
import { armorDex, prerequisitesText, slotsText, weaponProperty } from './entry-format';

const spell = (id: string, level: number, school: string, classes: string[], edition = '2024') =>
  ({ id, type: 'spell', name: id, edition, level, school, classes }) as unknown as Entry;
const item = (id: string, magic?: { rarity: string | null }) =>
  ({
    id,
    type: 'item',
    name: id,
    edition: '2024',
    category: magic ? 'other' : 'gear',
    magic,
  }) as unknown as Entry;

describe('compendium filters', () => {
  const spells = [
    spell('fireball', 3, 'evocation', ['wizard', 'sorcerer']),
    spell('light', 0, 'evocation', ['cleric', 'wizard'], '2014'),
    spell('charm-person', 1, 'enchantment', ['bard']),
    spell('wish', 9, 'conjuration', ['wizard']),
    spell('bless', 1, 'enchantment', ['cleric']),
    spell('heal', 6, 'evocation', ['cleric']),
    spell('mage-armor', 1, 'abjuration', ['wizard']),
    spell('ward', 10, 'abjuration', ['wizard']),
  ];

  it('offers each value once, levels in numeric order', () => {
    expect(filterChoices(spells, 'level')).toEqual(['0', '1', '3', '6', '9', '10']);
    expect(filterChoices(spells, 'class')).toEqual(['bard', 'cleric', 'sorcerer', 'wizard']);
    expect(filterChoices(spells, 'edition')).toEqual(['2014', '2024']);
  });

  it('keeps entries that match every selected filter', () => {
    const ids = (list: Entry[]) => list.map((e) => e.id);
    expect(ids(applyFilters(spells, { class: 'wizard', school: 'evocation' }))).toEqual([
      'fireball',
      'light',
    ]);
    expect(ids(applyFilters(spells, { level: '1', class: '' }))).toEqual([
      'charm-person',
      'bless',
      'mage-armor',
    ]);
    expect(applyFilters(spells, {})).toBe(spells);
  });

  it('tells magic items from mundane ones and sorts rarities in game order', () => {
    const items = [
      item('rope'),
      item('wand', { rarity: 'rare' }),
      item('pot', { rarity: 'common' }),
    ];
    expect(filterValues(items[0], 'magic')).toEqual(['mundane']);
    expect(filterValues(items[0], 'rarity')).toEqual([]);
    expect(filterChoices(items, 'rarity')).toEqual(['common', 'rare']);
    expect(applyFilters(items, { magic: 'magic' }).map((e) => e.id)).toEqual(['wand', 'pot']);
  });
});

describe('compendium search', () => {
  it('normalises case, accents and spaces', () => {
    expect(normalise('  Bola  de Fuégo ')).toBe('bola de fuego');
  });

  it('ranks exact, prefix, word start and inner matches', () => {
    expect(rankName('fireball', 'fireball')).toBe(0);
    expect(rankName('fireball', 'fire')).toBe(1);
    expect(rankName('delayed blast fireball', 'fire')).toBe(2);
    expect(rankName('delayed blast fireball', 'ball')).toBe(3);
    expect(rankName('delayed blast fireball', 'blast delayed')).toBe(3);
    expect(rankName('fireball', 'ice')).toBeNull();
  });

  it('finds by any name, then by text, best first', () => {
    const e = (id: string) => ({ id, name: id }) as Entry;
    const docs = [
      { entry: e('delayed-blast-fireball'), names: ['delayed blast fireball'], text: 'boom' },
      { entry: e('fireball'), names: ['fireball', 'bola de fuego'], text: 'boom' },
      { entry: e('burning-hands'), names: ['burning hands'], text: 'a thin sheet of fire' },
    ];
    const ids = (q: string, text: boolean) =>
      searchDocs(docs, q, text, (x) => x.id).map((h) => h.entry.id);
    expect(ids('Fire', false)).toEqual(['fireball', 'delayed-blast-fireball']);
    expect(ids('fire', true)).toEqual(['fireball', 'delayed-blast-fireball', 'burning-hands']);
    expect(ids('BOLA de fuégo', false)).toEqual(['fireball']);
    expect(ids(' ', true)).toEqual([]);
  });
});

describe('entry format', () => {
  it('translates weapon properties and their details', () => {
    expect(weaponProperty('es', 'Ammunition (Range 80/320; Arrow)')).toBe(
      'Munición (distancia 80/320; flecha)',
    );
    expect(weaponProperty('es', 'Versatile (1d8)')).toBe('Versátil (1d8)');
    expect(weaponProperty('en', 'Reload (6 shots)')).toBe('Reload (6 shots)');
  });

  it('describes how Dexterity counts for armor', () => {
    const armor = (kind: string, dexCap: number | null) =>
      ({ kind, dexCap, baseAC: 10, strength: null, stealthDisadvantage: false }) as NonNullable<
        Item['armor']
      >;
    expect(armorDex(armor('light', null))).toBe('full');
    expect(armorDex(armor('medium', 2))).toBe('cap');
    expect(armorDex(armor('heavy', 0))).toBe('none');
    expect(armorDex(armor('shield', null))).toBeNull();
  });

  it('writes spell slots up to the highest level', () => {
    const sc = {
      slotsByLevel: [
        [2, 0, 0],
        [0, 0, 0],
        [4, 3, 2],
      ],
    } as Spellcasting;
    expect(slotsText(sc, 1)).toBe('2');
    expect(slotsText(sc, 2)).toBe('—');
    expect(slotsText(sc, 3)).toBe('4 / 3 / 2');
  });

  it('writes multiclass prerequisites', () => {
    const groups = [
      { anyOf: ['STR', 'DEX'] as const, min: 13 },
      { anyOf: ['WIS'] as const, min: 13 },
    ];
    expect(prerequisitesText(groups as never, (a) => a.toLowerCase(), 'or', 'and')).toBe(
      'str or dex 13 and wis 13',
    );
  });
});

describe('term', () => {
  it('shows id-like values as words in English and translates them in Spanish', () => {
    expect(term('en', 'featCategory', 'fighting-style')).toBe('Fighting style');
    expect(term('es', 'featCategory', 'fighting-style')).toBe('estilo de combate');
    expect(term('en', 'school', 'evocation')).toBe('evocation');
  });
});
