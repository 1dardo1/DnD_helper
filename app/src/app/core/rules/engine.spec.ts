import { Character, newCharacter } from '../models/character';
import { Background, DndClass, Feat, Feature, Item, Species, Subclass } from '../models/compendium';
import { RulesData, computeSheet } from './engine';

// -- tiny fixtures ----------------------------------------------------------------------

function feature(name: string, level: number): Feature {
  return { name, level, description: `${name} text` };
}

function cls(id: string, over: Partial<DndClass> = {}): DndClass {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    proficiencyBonus: null,
    features: [],
    values: {} as Record<string, string>,
  }));
  return {
    id,
    type: 'class',
    name: id[0].toUpperCase() + id.slice(1),
    edition: '2024',
    source: null,
    description: '',
    url: '',
    hitDie: 10,
    primaryAbility: ['STR'],
    savingThrows: ['STR', 'CON'],
    proficiencies: {
      armor: ['Light'],
      weapons: ['Simple'],
      tools: [],
      skills: { choose: 2, from: [] },
    },
    startingEquipment: '',
    multiclass: { prerequisites: [], proficienciesGained: null },
    subclassTitle: `${id} Subclass`,
    subclassLevel: 3,
    subclassFeatureLevels: [3],
    progression: { columns: [], rows },
    spellcasting: null,
    features: [],
    ...over,
  };
}

function caster(id: string, kind: 'full' | 'half' | 'pact', slotsByLevel: number[][]): DndClass {
  return cls(id, {
    savingThrows: ['INT', 'WIS'],
    spellcasting: {
      ability: 'INT',
      kind,
      preparation: 'prepared',
      cantripsByLevel: null,
      preparedByLevel: null,
      slotsByLevel,
    },
  });
}

function data(entries: {
  classes?: DndClass[];
  subclasses?: Subclass[];
  species?: Species[];
  backgrounds?: Background[];
  feats?: Feat[];
  items?: Item[];
}): RulesData {
  const map = <T extends { id: string }>(xs: T[] = []) => new Map(xs.map((x) => [x.id, x]));
  return {
    classes: map(entries.classes),
    subclasses: map(entries.subclasses),
    species: map(entries.species),
    backgrounds: map(entries.backgrounds),
    feats: map(entries.feats),
    items: map(entries.items),
  };
}

function character(over: Partial<Character>): Character {
  return { ...newCharacter('Test', 'test'), ...over };
}

const scores = { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 };

// -- tests --------------------------------------------------------------------------------

describe('computeSheet', () => {
  const barbarian = cls('barbarian', {
    hitDie: 12,
    progression: {
      columns: ['Rages', 'Rage Damage'],
      rows: Array.from({ length: 20 }, (_, i) => ({
        level: i + 1,
        proficiencyBonus: null,
        features: [],
        values: { Rages: i < 2 ? '2' : '3', 'Rage Damage': '+2' },
      })),
    },
    features: [
      feature('Rage', 1),
      feature('Unarmored Defense', 1),
      feature('Fast Movement', 5),
      feature('Brutal Strike', 9),
    ],
  });
  const dwarf: Species = {
    id: 'dwarf',
    type: 'species',
    name: 'Dwarf',
    edition: '2024',
    source: null,
    description: '',
    url: '',
    creatureType: 'humanoid',
    size: ['Medium'],
    speed: { walk: 30 },
    darkvision: 120,
    traits: [feature('Darkvision', 1), feature('Dwarven Toughness', 1)],
    variants: [],
  };
  const soldier: Background = {
    id: 'soldier',
    type: 'background',
    name: 'Soldier',
    edition: '2024',
    source: null,
    description: '',
    url: '',
    abilityScores: ['STR', 'DEX', 'CON'],
    feat: 'Savage Attacker',
    featId: 'savage-attacker',
    skills: ['athletics', 'intimidation'],
    tools: 'Gaming Set',
    equipment: '',
  };
  const savage: Feat = {
    id: 'savage-attacker',
    type: 'feat',
    name: 'Savage Attacker',
    edition: '2024',
    source: null,
    description: 'Once per turn...',
    url: '',
    category: 'origin',
    prerequisites: null,
    repeatable: false,
    abilityIncrease: null,
  };

  it('computes a single-class character', () => {
    const sheet = computeSheet(
      character({
        classes: [{ id: 'barbarian', level: 5, subclassId: null, hp: [] }],
        species: { id: 'dwarf', variant: null },
        background: { id: 'soldier', abilityIncreases: { STR: 2, CON: 1 } },
        abilityScores: { method: 'standard', base: scores },
        choices: { ...newCharacter('x', 'x').choices, skills: ['perception'] },
      }),
      data({ classes: [barbarian], species: [dwarf], backgrounds: [soldier], feats: [savage] }),
    );

    expect(sheet.totalLevel).toBe(5);
    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.abilities.STR).toMatchObject({ score: 17, modifier: 3 });
    expect(sheet.abilities.CON).toMatchObject({ score: 15, modifier: 2 });
    expect(sheet.savingThrows.STR).toEqual({ proficient: true, modifier: 6 });
    expect(sheet.savingThrows.DEX).toEqual({ proficient: false, modifier: 2 });
    // background skills + chosen skills
    expect(sheet.skills.find((s) => s.id === 'athletics')).toMatchObject({
      proficiency: 'full',
      modifier: 6,
    });
    expect(sheet.skills.find((s) => s.id === 'stealth')).toMatchObject({
      proficiency: 'none',
      modifier: 2,
    });
    expect(sheet.passivePerception).toBe(10 + 1 + 3);
    // 12 at level 1, then 7 (average of d12) × 4, + CON 2 × 5, + Dwarven Toughness 1 × 5
    expect(sheet.hitPoints.max).toBe(12 + 7 * 4 + 2 * 5 + 5);
    expect(sheet.hitPoints.hitDice).toEqual([{ die: 12, count: 5 }]);
    // Unarmored Defense: 10 + DEX 2 + CON 2
    expect(sheet.armorClass.value).toBe(14);
    // Fast Movement at level 5
    expect(sheet.speed['walk']).toBe(40);
    expect(sheet.darkvision).toBe(120);
    // features up to level 5 only, plus species traits and the background's origin feat
    const names = sheet.features.map((f) => f.name);
    expect(names).toContain('Fast Movement');
    expect(names).not.toContain('Brutal Strike');
    expect(names).toContain('Dwarven Toughness');
    expect(names).toContain('Savage Attacker');
    expect(sheet.resources).toEqual([
      { classId: 'barbarian', name: 'Rages', value: '3' },
      { classId: 'barbarian', name: 'Rage Damage', value: '+2' },
    ]);
    expect(sheet.warnings).toEqual(['Barbarian: no barbarian Subclass chosen']);
  });

  it('uses rolled hit points when given and never less than 1 per level', () => {
    const sheet = computeSheet(
      character({
        classes: [{ id: 'barbarian', level: 3, subclassId: null, hp: [null, 1, 12] }],
        abilityScores: { method: 'manual', base: { ...scores, CON: 3 } }, // CON -4
      }),
      data({ classes: [barbarian] }),
    );
    // level 1: 12-4 = 8, level 2: max(1-4, 1) = 1, level 3: 12-4 = 8
    expect(sheet.hitPoints.max).toBe(17);
  });

  it('applies armor with a Dexterity cap and a shield', () => {
    const breastplate: Item = {
      id: 'breastplate',
      type: 'item',
      name: 'Breastplate',
      edition: '2024',
      source: null,
      description: '',
      url: '',
      category: 'armor',
      cost: null,
      weight: 20,
      armor: { kind: 'medium', baseAC: 14, dexCap: 2, strength: null, stealthDisadvantage: false },
    };
    const sheet = computeSheet(
      character({
        classes: [{ id: 'fighter', level: 1, subclassId: null, hp: [] }],
        abilityScores: { method: 'manual', base: { ...scores, DEX: 18 } },
        equipped: { armorId: 'breastplate', shield: true },
      }),
      data({ classes: [cls('fighter')], items: [breastplate] }),
    );
    expect(sheet.armorClass.value).toBe(14 + 2 + 2);
  });

  it('caps ability scores at 20', () => {
    const sheet = computeSheet(
      character({
        abilityScores: { method: 'manual', base: { ...scores, STR: 19 } },
        choices: {
          ...newCharacter('x', 'x').choices,
          abilityIncreases: [{ source: 'ability-score-improvement', ability: 'STR', amount: 2 }],
        },
      }),
      data({}),
    );
    expect(sheet.abilities.STR.score).toBe(20);
  });

  it('gives expertise double and Jack of All Trades half proficiency', () => {
    const bard = cls('bard', { features: [feature('Jack of All Trades', 2)] });
    const sheet = computeSheet(
      character({
        classes: [{ id: 'bard', level: 2, subclassId: null, hp: [] }],
        abilityScores: { method: 'manual', base: scores },
        choices: { ...newCharacter('x', 'x').choices, skills: ['stealth'], expertise: ['stealth'] },
      }),
      data({ classes: [bard] }),
    );
    expect(sheet.skills.find((s) => s.id === 'stealth')).toMatchObject({
      proficiency: 'expertise',
      modifier: 2 + 4,
    });
    expect(sheet.skills.find((s) => s.id === 'arcana')).toMatchObject({
      proficiency: 'half',
      modifier: 0 + 1,
    });
  });

  it('combines spell slots of several casters and keeps Pact Magic apart', () => {
    const full = Array.from({ length: 20 }, () => [9, 9, 9, 9, 9, 9, 9, 9, 9]); // ignored when multiclassing
    const wizard = caster('wizard', 'full', full);
    const paladin = caster('paladin', 'half', full);
    const warlockSlots = Array.from({ length: 20 }, (_, i) =>
      i < 2 ? [2, 0, 0, 0, 0, 0, 0, 0, 0] : [0, 2, 0, 0, 0, 0, 0, 0, 0],
    );
    const warlock = caster('warlock', 'pact', warlockSlots);
    const sheet = computeSheet(
      character({
        classes: [
          { id: 'wizard', level: 3, subclassId: null, hp: [] },
          { id: 'paladin', level: 3, subclassId: null, hp: [] },
          { id: 'warlock', level: 3, subclassId: null, hp: [] },
        ],
        abilityScores: { method: 'manual', base: { ...scores, INT: 16 } },
      }),
      data({ classes: [wizard, paladin, warlock] }),
    );
    // caster level = wizard 3 + paladin ceil(3/2) = 5 → 4, 3, 2
    expect(sheet.spellcasting.slots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasting.pact).toEqual({ slots: 2, level: 2 });
    // PB at level 9 is +4; INT 16 → +3
    expect(sheet.spellcasting.classes[0]).toMatchObject({
      classId: 'wizard',
      saveDc: 8 + 4 + 3,
      attack: 7,
    });
    // saving throws come from the first class only
    expect(sheet.savingThrows.INT.proficient).toBe(true);
  });

  it('uses the class table for a single caster', () => {
    const slots = Array.from({ length: 20 }, (_, i) => [i + 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    const sheet = computeSheet(
      character({ classes: [{ id: 'paladin', level: 2, subclassId: null, hp: [] }] }),
      data({ classes: [caster('paladin', 'half', slots)] }),
    );
    expect(sheet.spellcasting.slots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('warns about ids that are not in the compendium instead of failing', () => {
    const sheet = computeSheet(
      character({
        classes: [{ id: 'mystic', level: 1, subclassId: null, hp: [] }],
        species: { id: 'unknown', variant: null },
        choices: { ...newCharacter('x', 'x').choices, feats: ['ghost-feat'] },
      }),
      data({}),
    );
    expect(sheet.totalLevel).toBe(0);
    expect(sheet.warnings).toEqual([
      'Class "mystic" is not in the compendium',
      'Species "unknown" is not in the compendium',
      'Feat "ghost-feat" is not in the compendium',
    ]);
  });

  it('includes subclass features up to the class level', () => {
    const sub: Subclass = {
      id: 'barbarian/path-of-the-zealot',
      type: 'subclass',
      name: 'Path of the Zealot',
      edition: '2024',
      source: null,
      description: '',
      url: '',
      classId: 'barbarian',
      shortName: 'Zealot',
      features: [feature('Divine Fury', 3), feature('Fanatical Focus', 6)],
      spells: null,
    };
    const sheet = computeSheet(
      character({ classes: [{ id: 'barbarian', level: 5, subclassId: sub.id, hp: [] }] }),
      data({ classes: [barbarian], subclasses: [sub] }),
    );
    const subFeatures = sheet.features
      .filter((f) => f.source.type === 'subclass')
      .map((f) => f.name);
    expect(subFeatures).toEqual(['Divine Fury']);
    expect(sheet.classes).toEqual([
      { id: 'barbarian', name: 'Barbarian', level: 5, subclass: 'Path of the Zealot' },
    ]);
    expect(sheet.warnings).toEqual([]);
  });
});
