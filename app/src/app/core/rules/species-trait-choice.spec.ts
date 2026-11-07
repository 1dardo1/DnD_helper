import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import options from '../../../../../data/options.json';
import species from '../../../../../data/species.json';
import subclasses from '../../../../../data/subclasses.json';
import { Character, newCharacter } from '../models/character';
import {
  Background,
  ClassOption,
  DndClass,
  Feat,
  Item,
  Species,
  Subclass,
} from '../models/compendium';
import { RulesData, computeSheet } from './engine';
import { traitChoiceKey } from './trait-choices';

const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

const DATA: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: map<Subclass>(subclasses),
  species: map<Species>(species),
  backgrounds: map<Background>(backgrounds),
  feats: map<Feat>(feats),
  items: map<Item>(items),
  options: map<ClassOption>(options),
};

function build(
  speciesId: string,
  variant: string | null,
  traitChoices: Record<string, string>,
): Character {
  const c = newCharacter('Test', 'test');
  return {
    ...c,
    classes: [{ id: 'fighter', level: 1, subclassId: null, hp: [] }],
    species: { id: speciesId, variant },
    background: { id: 'soldier', abilityIncreases: {} },
    abilityScores: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
    },
    choices: { ...c.choices, traitChoices },
  };
}

describe('Gnome: Gnomish Lineage (Forest Gnome / Rock Gnome)', () => {
  const key = traitChoiceKey('gnome', null, 'Gnomish Lineage');

  it("Forest Gnome: gives Minor Illusion and Speak with Animals, not Rock Gnome's spells", () => {
    const sheet = computeSheet(build('gnome', null, { [key]: 'Forest Gnome' }), DATA);
    const names = sheet.featSpells.map((s) => s.name);
    expect(names).toContain('Minor Illusion');
    expect(names).toContain('Speak with Animals');
    expect(names).not.toContain('Mending');
    expect(names).not.toContain('Prestidigitation');
    expect(sheet.warnings).toEqual([]);
  });

  it("Rock Gnome: doesn't give Forest Gnome's spells", () => {
    const sheet = computeSheet(build('gnome', null, { [key]: 'Rock Gnome' }), DATA);
    const names = sheet.featSpells.map((s) => s.name);
    expect(names).not.toContain('Minor Illusion');
    expect(names).not.toContain('Speak with Animals');
    expect(sheet.warnings).toEqual([]);
  });

  it("nothing chosen: neither lineage's spells, and a warning to choose one", () => {
    const sheet = computeSheet(build('gnome', null, {}), DATA);
    const names = sheet.featSpells.map((s) => s.name);
    expect(names).not.toContain('Minor Illusion');
    expect(names).not.toContain('Mending');
    expect(sheet.warnings).toEqual([
      { key: 'sheet.warn.traitChoiceMissing', params: { trait: 'Gnomish Lineage' } },
    ]);
  });
});

describe('Goblin (Plane Shift: Zendikar): Tribe (Grotag / Lavastep / Tuktuk)', () => {
  const variant = 'Goblin (Plane Shift: Zendikar)';
  const key = traitChoiceKey('goblin', variant, 'Tribe');

  it("Grotag: only its own benefit (Animal Handling), not the other tribes'", () => {
    const sheet = computeSheet(build('goblin', variant, { [key]: 'Grotag Tribe' }), DATA);
    const ids = sheet.skills.filter((s) => s.proficiency !== 'none').map((s) => s.id);
    expect(ids).toContain('animal-handling');
  });

  it('Lavastep: not the Grotag skill', () => {
    const sheet = computeSheet(build('goblin', variant, { [key]: 'Lavastep Tribe' }), DATA);
    const ids = sheet.skills.filter((s) => s.proficiency !== 'none').map((s) => s.id);
    expect(ids).not.toContain('animal-handling');
  });

  it('nothing chosen: no tribe benefit at all, and a warning to choose one', () => {
    const sheet = computeSheet(build('goblin', variant, {}), DATA);
    const ids = sheet.skills.filter((s) => s.proficiency !== 'none').map((s) => s.id);
    expect(ids).not.toContain('animal-handling');
    expect(sheet.warnings).toEqual([
      { key: 'sheet.warn.traitChoiceMissing', params: { trait: 'Tribe' } },
    ]);
  });

  it('is now a real, selectable variant (not a flavor-only reprint of the base Goblin)', () => {
    const goblin = DATA.species.get('goblin')!;
    const v = goblin.variants.find((x) => x.name === variant)!;
    expect(v.reprint).toBeFalsy();
  });
});

describe('Goliath: Giant Ancestry', () => {
  const key = traitChoiceKey('goliath', null, 'Giant Ancestry');

  it('grants the use counter either way, gated by the choice when none is made', () => {
    const withChoice = computeSheet(
      build('goliath', null, { [key]: "Fire's Burn (Fire Giant)" }),
      DATA,
    );
    expect(withChoice.featUses.some((u) => u.feat === 'Giant Ancestry' && u.max === 2)).toBe(true);
    expect(withChoice.warnings).toEqual([]);

    const none = computeSheet(build('goliath', null, {}), DATA);
    expect(none.warnings).toEqual([
      { key: 'sheet.warn.traitChoiceMissing', params: { trait: 'Giant Ancestry' } },
    ]);
  });
});
