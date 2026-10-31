import {
  activeFacets,
  applyFacets,
  matchesQuery,
  modeKey,
  selectedValues,
  toggleValue,
} from './picker-filters';

describe('picker filters', () => {
  const items = ['fireball', 'bola-de-fuego', 'light', 'mage-armor'];
  // normalised search texts (English + translated name)
  const texts = ['fireball bola de fuego', 'x', 'light luz', 'mage armor armadura de mago'];
  const facets: Record<string, string[]>[] = [
    { level: ['3'], school: ['evocation'] },
    { level: ['3'], school: ['evocation'] },
    { level: ['0'], school: ['evocation'] },
    { level: ['1'], school: ['abjuration'] },
  ];
  const values = (i: number, key: string) => facets[i][key] ?? [];

  it('matches every word of the query, ignoring case and accents', () => {
    expect(matchesQuery('mage armor armadura de mago', 'Armadura MAGO')).toBe(true);
    expect(matchesQuery('light luz', 'lúz')).toBe(true);
    expect(matchesQuery('light luz', 'luz fuego')).toBe(false);
    expect(matchesQuery('anything', '  ')).toBe(true);
  });

  it('keeps the items matching the query and every selected facet', () => {
    expect(applyFacets(items, texts, values, {}, '')).toEqual(items);
    expect(applyFacets(items, texts, values, { level: '3' }, '')).toEqual([
      'fireball',
      'bola-de-fuego',
    ]);
    expect(applyFacets(items, texts, values, { school: 'evocation', level: '' }, 'luz')).toEqual([
      'light',
    ]);
    expect(applyFacets(items, texts, values, { school: 'abjuration' }, 'fuego')).toEqual([]);
  });

  it('matches any of several values chosen in one facet, or all of them in "and" mode', () => {
    expect(applyFacets(items, texts, values, { level: '0,1' }, '')).toEqual([
      'light',
      'mage-armor',
    ]);
    const effects = [['fire'], ['fire', 'healing'], ['healing'], ['other']];
    const effect = (i: number) => effects[i];
    expect(applyFacets(items, texts, effect, { effect: 'fire,healing' }, '')).toEqual(
      items.slice(0, 3),
    );
    expect(
      applyFacets(items, texts, effect, { effect: 'fire,healing', [modeKey('effect')]: 'and' }, ''),
    ).toEqual(['bola-de-fuego']);
    expect(selectedValues('fire,,healing')).toEqual(['fire', 'healing']);
    expect(selectedValues('')).toEqual([]);
    expect(toggleValue('fire', 'healing')).toBe('fire,healing');
    expect(toggleValue('fire,healing', 'fire')).toBe('healing');
    expect(toggleValue(undefined, 'other')).toBe('other');
  });

  it('counts the facets with a value', () => {
    expect(activeFacets({ level: '3', school: '', ritual: 'yes', levelMode: 'and' })).toBe(2);
    expect(activeFacets({})).toBe(0);
  });
});
