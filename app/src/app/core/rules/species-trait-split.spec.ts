import species from '../../../../../data/species.json';

type Sp = { name: string; edition: string; traits: { name: string; description: string }[] };

// Named traits that follow a trait with options are traits of their own (the scraper must not
// nest them in the options): Goliath's Large Form / Powerful Build, Hexblood's Hex Magic.
describe('species traits not nested in an options trait', () => {
  const find = (name: string) =>
    (species as Sp[]).find((s) => s.name === name && s.edition === '2024')!;

  it('Goliath has Large Form and Powerful Build as separate traits', () => {
    const g = find('Goliath');
    expect(g.traits.map((t) => t.name)).toEqual(['Giant Ancestry', 'Large Form', 'Powerful Build']);
    expect(g.traits[0].description).not.toContain('Large Form');
    expect(g.traits[1].description).toContain('change your size to Large');
  });

  it('Hexblood has Hex Magic as a separate trait', () => {
    const h = find('Hexblood');
    expect(h.traits.map((t) => t.name)).toEqual(['Eerie Token', 'Hex Magic']);
    expect(h.traits[0].description).not.toContain('Hex Magic');
  });
});
