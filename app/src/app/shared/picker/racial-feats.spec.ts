import { requiredSpecies, sectionsBySpecies, speciesNames } from './racial-feats';

const racial = (name: string, species: string[]) =>
  ({
    id: name,
    type: 'feat',
    name,
    category: 'racial',
    prerequisites: { raw: 'Level 4+, …', level: 4, species },
  }) as never;
const general = (name: string) =>
  ({ id: name, type: 'feat', name, category: 'general', prerequisites: null }) as never;
const NAMES: Record<string, string> = { elf: 'Elfo', 'half-elf': 'Medio elfo', human: 'Humano' };
const speciesName = (id: string) => NAMES[id] ?? id;
const shown = (e: { name: string }) => e.name;

describe('racial feats', () => {
  it('reads the required species of racial feats only', () => {
    expect(requiredSpecies(racial('Prodigy', ['human', 'half-elf']))).toEqual([
      'human',
      'half-elf',
    ]);
    expect(requiredSpecies(general('Alert'))).toEqual([]);
    expect(requiredSpecies({ type: 'spell' } as never)).toEqual([]);
    expect(requiredSpecies(null)).toEqual([]);
    expect(speciesNames(racial('Prodigy', ['human', 'half-elf']), speciesName)).toEqual([
      'Humano',
      'Medio elfo',
    ]);
  });

  it('groups by species, sorted by its name, a feat in each of its species', () => {
    const list = [
      racial('Prodigy', ['half-elf', 'human']),
      racial('Wood Elf Magic', ['elf']),
      racial('Elven Accuracy', ['elf', 'half-elf']),
    ];
    const sections = sectionsBySpecies(list, speciesName, shown)!;
    expect(sections.map((s) => [s.label, s.items.map(shown)])).toEqual([
      ['Elfo', ['Elven Accuracy', 'Wood Elf Magic']],
      ['Humano', ['Prodigy']],
      ['Medio elfo', ['Elven Accuracy', 'Prodigy']],
    ]);
  });

  it('keeps the other entries first, and gives null without racial feats', () => {
    const sections = sectionsBySpecies(
      [general('Tough'), racial('Dragon Fear', ['dragonborn']), general('Alert')],
      speciesName,
      shown,
    )!;
    expect(sections.map((s) => [s.species, s.items.map(shown)])).toEqual([
      [null, ['Tough', 'Alert']],
      ['dragonborn', ['Dragon Fear']],
    ]);
    expect(sectionsBySpecies([general('Alert')], speciesName, shown)).toBeNull();
  });
});
