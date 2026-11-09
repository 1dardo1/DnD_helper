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
import { pickKey, traitChoice, traitChoiceKey, traitPicks } from './trait-choices';

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
  traitChoices: Record<string, string> = {},
  traitPicks: Record<string, string[]> = {},
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
    choices: {
      ...c.choices,
      traitChoices,
      traitPicks,
      weaponMasteries: ['battleaxe', 'club', 'dagger'],
    },
  };
}

const profSkills = (sheet: ReturnType<typeof computeSheet>) =>
  sheet.skills.filter((s) => s.proficiency !== 'none').map((s) => s.id);
const warnKeys = (sheet: ReturnType<typeof computeSheet>, k: string) =>
  sheet.warnings.filter((w) => w.key === k).map((w) => w.params?.['trait']);

describe('which traits are a choice (found in the text, no fixed list)', () => {
  it('finds exactly the creation-time choices in the real data, and none that is re-chosen', () => {
    const found: string[] = [];
    for (const s of species as Species[]) {
      for (const t of s.traits) if (traitChoice(t.description)) found.push(`${s.id}:${t.name}`);
      for (const v of s.variants.filter((x) => !x.reprint))
        for (const t of v.traits)
          if (traitChoice(t.description)) found.push(`${s.id}:${v.name}:${t.name}`);
    }
    expect(found.sort()).toEqual(
      [
        'custom-lineage:Variable Trait',
        'gnome:Gnomish Lineage',
        'goblin:Goblin (Plane Shift: Zendikar):Tribe',
        'goliath:Giant Ancestry',
        'half-elf:Half-Elf Versatility',
        'kobold:Kobold Legacy',
        'shifter:Shifting',
      ].sort(),
    );
  });

  it('a trait that is re-chosen at every rest/use is left as text (Fey Gift, Duskling...)', () => {
    for (const [id, name] of [
      ['hobgoblin', 'Fey Gift'],
      ['duskling', 'Inner Magic'],
      ['aasimar', 'Celestial Revelation'],
      ['deep-imaskari-ua', 'Aura of Unlight'],
    ]) {
      const t = DATA.species.get(id)!.traits.find((x) => x.name === name)!;
      expect(traitChoice(t.description)).toBeNull();
    }
  });
});

describe('Goblin (Plane Shift: Zendikar): Tribe, end to end', () => {
  const variant = 'Goblin (Plane Shift: Zendikar)';
  const key = traitChoiceKey('goblin', variant, 'Tribe');

  it('is a selectable variant, and its Tribe text really holds three options', () => {
    const v = DATA.species.get('goblin')!.variants.find((x) => x.name === variant)!;
    expect(v.reprint).toBeFalsy();
    const tribe = v.traits.find((t) => t.name === 'Tribe')!;
    expect(traitChoice(tribe.description)?.options.map((o) => o.name)).toEqual([
      'Grotag Tribe',
      'Lavastep Tribe',
      'Tuktuk Tribe',
    ]);
  });

  it('none of the tribes asks for a further pick', () => {
    const tribe = DATA.species
      .get('goblin')!
      .variants.find((x) => x.name === variant)!
      .traits.find((t) => t.name === 'Tribe')!;
    for (const o of traitChoice(tribe.description)!.options) expect(traitPicks(o.text)).toEqual([]);
  });

  it('Tuktuk: thieves tools only, not the Grotag skill', () => {
    const sheet = computeSheet(build('goblin', variant, { [key]: 'Tuktuk Tribe' }), DATA);
    expect(sheet.proficiencies.tools).toContain("Thieves' Tools");
    expect(profSkills(sheet)).not.toContain('animal-handling');
    expect(sheet.warnings).toEqual([]);
  });

  it('Grotag: Animal Handling, not thieves tools', () => {
    const sheet = computeSheet(build('goblin', variant, { [key]: 'Grotag Tribe' }), DATA);
    expect(profSkills(sheet)).toContain('animal-handling');
    expect(sheet.proficiencies.tools).not.toContain("Thieves' Tools");
  });

  it('nothing chosen: none of the three apply and it warns', () => {
    const sheet = computeSheet(build('goblin', variant, {}), DATA);
    expect(profSkills(sheet)).not.toContain('animal-handling');
    expect(sheet.proficiencies.tools).not.toContain("Thieves' Tools");
    expect(warnKeys(sheet, 'sheet.warn.traitChoiceMissing')).toEqual(['Tribe']);
  });

  it('the Grit trait of the variant (fire and psychic resistance) applies whichever tribe', () => {
    const sheet = computeSheet(build('goblin', variant, {}), DATA);
    expect(sheet.resistances).toEqual(expect.arrayContaining(['Fire', 'Psychic']));
  });
});

describe('Kobold: Kobold Legacy, with the skill picked inside Craftiness', () => {
  const key = traitChoiceKey('kobold', null, 'Kobold Legacy');

  it('Craftiness: needs one of the five skills, and gives only the picked one', () => {
    const none = computeSheet(build('kobold', null, { [key]: 'Craftiness' }), DATA);
    expect(warnKeys(none, 'sheet.warn.traitPickMissing')).toEqual(['Kobold Legacy']);

    const ok = computeSheet(
      build('kobold', null, { [key]: 'Craftiness' }, { [pickKey(key, 'skill')]: ['medicine'] }),
      DATA,
    );
    expect(profSkills(ok)).toContain('medicine');
    expect(warnKeys(ok, 'sheet.warn.traitPickMissing')).toEqual([]);
    expect(ok.warnings).toEqual([]);
  });

  it('a skill outside the list the text names (Athletics) is ignored', () => {
    const sheet = computeSheet(
      build('kobold', null, { [key]: 'Craftiness' }, { [pickKey(key, 'skill')]: ['athletics'] }),
      DATA,
    );
    expect(warnKeys(sheet, 'sheet.warn.traitPickMissing')).toEqual(['Kobold Legacy']);
  });

  it('picks made for Craftiness do not carry over to Defiance', () => {
    const sheet = computeSheet(
      build('kobold', null, { [key]: 'Defiance' }, { [pickKey(key, 'skill')]: ['medicine'] }),
      DATA,
    );
    expect(profSkills(sheet)).not.toContain('medicine');
    expect(sheet.warnings).toEqual([]);
  });

  it('nothing chosen: no legacy applies and it warns', () => {
    const sheet = computeSheet(build('kobold', null), DATA);
    expect(warnKeys(sheet, 'sheet.warn.traitChoiceMissing')).toEqual(['Kobold Legacy']);
  });
});

describe('Half-Elf: Half-Elf Versatility', () => {
  const key = traitChoiceKey('half-elf', null, 'Half-Elf Versatility');

  it('Skill Versatility: two skills of the player choice', () => {
    const opt = 'Skill Versatility (General)';
    const none = computeSheet(build('half-elf', null, { [key]: opt }), DATA);
    expect(warnKeys(none, 'sheet.warn.traitPickMissing')).toEqual(['Half-Elf Versatility']);
    const one = computeSheet(
      build('half-elf', null, { [key]: opt }, { [pickKey(key, 'skill')]: ['arcana'] }),
      DATA,
    );
    expect(warnKeys(one, 'sheet.warn.traitPickMissing')).toEqual(['Half-Elf Versatility']);
    const two = computeSheet(
      build('half-elf', null, { [key]: opt }, { [pickKey(key, 'skill')]: ['arcana', 'history'] }),
      DATA,
    );
    expect(profSkills(two)).toEqual(expect.arrayContaining(['arcana', 'history']));
    expect(warnKeys(two, 'sheet.warn.traitPickMissing')).toEqual([]);
    const three = computeSheet(
      build(
        'half-elf',
        null,
        { [key]: opt },
        { [pickKey(key, 'skill')]: ['arcana', 'history', 'nature'] },
      ),
      DATA,
    );
    expect(profSkills(three)).not.toContain('nature');
  });

  it('Swim Speed: only that option (a swim speed), none of the other heritages', () => {
    const sheet = computeSheet(
      build('half-elf', null, { [key]: 'Swim Speed (Aquatic Elf Heritage)' }),
      DATA,
    );
    expect(sheet.speed['swim']).toBe(30);
    expect(sheet.speed['walk']).toBe(30);
    expect(sheet.warnings).toEqual([]);
  });

  it('Fleet of Foot: walking speed 35 and no swim speed', () => {
    const sheet = computeSheet(
      build('half-elf', null, { [key]: 'Fleet of Foot (Wood Elf Heritage)' }),
      DATA,
    );
    expect(sheet.speed['walk']).toBe(35);
    expect(sheet.speed['swim']).toBeUndefined();
  });

  it('nothing chosen: none apply (no swim speed, no 35 ft) and it warns', () => {
    const sheet = computeSheet(build('half-elf', null), DATA);
    expect(sheet.speed['swim']).toBeUndefined();
    expect(sheet.speed['walk']).toBe(30);
    expect(warnKeys(sheet, 'sheet.warn.traitChoiceMissing')).toEqual(['Half-Elf Versatility']);
  });
});

describe('Custom Lineage: Variable Trait (darkvision or a skill)', () => {
  const key = traitChoiceKey('custom-lineage', null, 'Variable Trait');
  const skillOpt = 'Proficiency in one skill of your choice';

  it('the skill option asks for one skill; the darkvision one does not', () => {
    const split = traitChoice(
      DATA.species.get('custom-lineage')!.traits.find((t) => t.name === 'Variable Trait')!
        .description,
    )!;
    expect(split.options.map((o) => o.name)).toEqual([
      'Darkvision with a range of 60 feet',
      skillOpt,
    ]);
    const sheet = computeSheet(
      build('custom-lineage', null, { [key]: skillOpt }, { [pickKey(key, 'skill')]: ['stealth'] }),
      DATA,
    );
    expect(profSkills(sheet)).toContain('stealth');
    const dv = computeSheet(
      build('custom-lineage', null, { [key]: 'Darkvision with a range of 60 feet' }),
      DATA,
    );
    expect(warnKeys(dv, 'sheet.warn.traitPickMissing')).toEqual([]);
  });
});

describe('Shifter: Shifting (Beasthide / Longtooth / Swiftstride / Wildhunt)', () => {
  const key = traitChoiceKey('shifter', null, 'Shifting');

  it('only the chosen benefit is read; nothing chosen warns', () => {
    const t = DATA.species.get('shifter')!.traits.find((x) => x.name === 'Shifting')!;
    expect(traitChoice(t.description)?.options.map((o) => o.name)).toEqual([
      'Beasthide',
      'Longtooth',
      'Swiftstride',
      'Wildhunt',
    ]);
    const sheet = computeSheet(build('shifter', null, { [key]: 'Wildhunt' }), DATA);
    expect(warnKeys(sheet, 'sheet.warn.traitChoiceMissing')).toEqual([]);
    expect(
      warnKeys(computeSheet(build('shifter', null), DATA), 'sheet.warn.traitChoiceMissing'),
    ).toEqual(['Shifting']);
  });
});

describe('Picks inside plain species traits (skills / damage type of your choice)', () => {
  it('Human Skillful: one skill of the player choice, none until picked', () => {
    const key = traitChoiceKey('human', null, 'Skillful');
    const none = computeSheet(build('human', null), DATA);
    expect(warnKeys(none, 'sheet.warn.traitPickMissing')).toContain('Skillful');
    const sheet = computeSheet(
      build('human', null, {}, { [pickKey(key, 'skill')]: ['arcana'] }),
      DATA,
    );
    expect(profSkills(sheet)).toContain('arcana');
    expect(warnKeys(sheet, 'sheet.warn.traitPickMissing')).not.toContain('Skillful');
  });

  it('Centaur Natural Affinity: one of four named skills only', () => {
    const key = traitChoiceKey('centaur', null, 'Natural Affinity');
    const sheet = computeSheet(
      build('centaur', null, {}, { [pickKey(key, 'skill')]: ['medicine', 'arcana'] }),
      DATA,
    );
    expect(profSkills(sheet)).toContain('medicine');
    expect(profSkills(sheet)).not.toContain('arcana');
  });

  it('Reborn Strange Endurance: resistance to the one damage type picked', () => {
    const key = traitChoiceKey('reborn', null, 'Strange Endurance');
    const none = computeSheet(build('reborn', null), DATA);
    expect(warnKeys(none, 'sheet.warn.traitPickMissing')).toContain('Strange Endurance');
    expect(none.resistances).not.toContain('Cold');
    const sheet = computeSheet(
      build('reborn', null, {}, { [pickKey(key, 'resistance')]: ['Necrotic', 'Cold'] }),
      DATA,
    );
    expect(sheet.resistances).toContain('Necrotic');
    expect(sheet.resistances).not.toContain('Cold');
  });

  it('a skill the player re-picks at every rest (Kalashtar) is a pick marked to change on rests', () => {
    const t = DATA.species.get('kalashtar')!.traits.find((x) => x.name === 'Severed from Dreams')!;
    expect(traitPicks(t.description)).toEqual([
      { kind: 'skill', count: 1, from: null, rest: 'long' },
    ]);
  });
});
