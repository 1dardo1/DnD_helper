import { Entry, EntryType } from '../../core/models/compendium';
import {
  ENTRY_FACETS,
  FACET_KINDS,
  FacetKey,
  FacetKind,
  facetKind,
  facetValues,
} from './entry-facets';
import { applyFacets } from './picker-filters';

const TYPES = Object.keys(ENTRY_FACETS) as EntryType[];

/** Facets where every entry has exactly one of two exclusive values: no ✕, no O/Y. */
const BINARY: [EntryType, FacetKey][] = [
  ['spell', 'concentration'],
  ['spell', 'ritual'],
  ['feat', 'repeatable'],
  ['option', 'prerequisite'],
  ['item', 'magic'],
  ['monster', 'legendary'],
  ['monster', 'spellcaster'],
];

describe('facet kinds', () => {
  it('every facet of every type declares its kind, and nothing else is declared', () => {
    for (const type of TYPES) {
      const declared = Object.keys(FACET_KINDS[type]).sort();
      expect(declared).toEqual([...ENTRY_FACETS[type]].sort());
    }
  });

  it('classifies every facet of every type (the table to review)', () => {
    const table = TYPES.flatMap((type) =>
      ENTRY_FACETS[type].map((key) => `${type}.${key}: ${facetKind(type, key)}`),
    );
    for (const type of TYPES)
      for (const key of ENTRY_FACETS[type])
        expect(['binary', 'single', 'multi'] as FacetKind[]).toContain(facetKind(type, key));
  });

  it('only the yes/no facets present in every entry are binary', () => {
    const binary = TYPES.flatMap((type) =>
      ENTRY_FACETS[type]
        .filter((key) => facetKind(type, key) === 'binary')
        .map((key) => [type, key]),
    );
    expect(binary.map((b) => b.join('.')).sort()).toEqual(BINARY.map((b) => b.join('.')).sort());
  });

  it('facets only some entries have (attunement, stealth, weapon facets) keep their ✕', () => {
    expect(facetKind('item', 'attunement')).toBe('single');
    expect(facetKind('item', 'stealth')).toBe('single');
    expect(facetKind('item', 'weaponRange')).toBe('single');
  });

  it('single-valued facets do not combine, multi-valued ones do', () => {
    expect(facetKind('spell', 'school')).toBe('single');
    expect(facetKind('spell', 'level')).toBe('single');
    expect(facetKind('monster', 'creatureType')).toBe('single');
    expect(facetKind('spell', 'class')).toBe('multi');
    expect(facetKind('spell', 'components')).toBe('multi');
    expect(facetKind('monster', 'resistance')).toBe('multi');
  });

  it('an undeclared facet falls back to multi (everything on)', () => {
    expect(facetKind('rule', 'damage')).toBe('multi');
  });
});

describe('binary facets', () => {
  const e = (type: string, extra: object) =>
    ({ id: 'x', type, edition: '2024', ...extra }) as Entry;
  // one entry per side of each binary facet
  const pairs: Record<string, [Entry, Entry]> = {
    'spell.concentration': [
      e('spell', { concentration: true }),
      e('spell', { concentration: false }),
    ],
    'spell.ritual': [e('spell', { ritual: true }), e('spell', { ritual: false })],
    'feat.repeatable': [e('feat', { repeatable: true }), e('feat', { repeatable: false })],
    'option.prerequisite': [
      e('option', { prerequisites: { level: 5 } }),
      e('option', { prerequisites: null }),
    ],
    'item.magic': [e('item', { magic: { rarity: 'Rare' } }), e('item', { magic: null })],
    'monster.legendary': [e('monster', { legendary: true }), e('monster', { legendary: false })],
    'monster.spellcaster': [
      e('monster', { spellcasting: true }),
      e('monster', { spellcasting: false }),
    ],
  };

  for (const [type, key] of BINARY) {
    it(`${type}.${key}: each entry has exactly one of two values`, () => {
      const [a, b] = pairs[`${type}.${key}`];
      const [va, vb] = [facetValues(a, key), facetValues(b, key)];
      expect(va.length).toBe(1);
      expect(vb.length).toBe(1);
      expect(va[0]).not.toBe(vb[0]);
    });

    it(`${type}.${key}: excluding one value equals ticking the other`, () => {
      const [a, b] = pairs[`${type}.${key}`];
      const items = [a, b];
      const values = (i: number, k: string) => facetValues(items[i], k as FacetKey);
      const texts = ['', ''];
      const [va, vb] = [facetValues(a, key)[0], facetValues(b, key)[0]];
      // an old link with "!value" keeps working: it keeps the entries without that value
      expect(applyFacets(items, texts, values, { [key]: `!${va}` }, '')).toEqual([b]);
      expect(applyFacets(items, texts, values, { [key]: vb }, '')).toEqual([b]);
      expect(applyFacets(items, texts, values, { [key]: `!${vb}` }, '')).toEqual([a]);
    });
  }
});

describe('applyFacets with exclusions on partial facets', () => {
  it('excluding "yes" keeps the entries that have no value at all (so it is not the same as "no")', () => {
    const items = ['attuned', 'free', 'mundane'];
    const has: Record<string, string[]> = { attuned: ['yes'], free: ['no'], mundane: [] };
    const values = (i: number) => has[items[i]];
    const texts = ['', '', ''];
    expect(applyFacets(items, texts, values, { attunement: '!yes' }, '')).toEqual([
      'free',
      'mundane',
    ]);
    expect(applyFacets(items, texts, values, { attunement: 'no' }, '')).toEqual(['free']);
  });
});
