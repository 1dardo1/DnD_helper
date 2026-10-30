import { Character, newCharacter } from '../models/character';
import { ClassOption, DndClass, Feat } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import {
  addLevel,
  averageHp,
  levelGains,
  multiclassNotes,
  multiclassSkillOptions,
  newFeatures,
  newNotes,
  sheetChanges,
  slotAbility,
  slotPicks,
  spellsGrow,
  withHpGained,
  withLevelHp,
  withSlotAbility,
  withSlotFeat,
} from './level-up';

const rows = (
  features: Record<number, string[]>,
  values: (lvl: number) => Record<string, string>,
) =>
  Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    proficiencyBonus: null,
    features: features[i + 1] ?? [],
    values: values(i + 1),
  }));

function cls(id: string, over: Partial<DndClass> = {}): DndClass {
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
      armor: [],
      weapons: [],
      tools: [],
      skills: { choose: 2, from: ['athletics'] },
    },
    startingEquipment: '',
    multiclass: {
      prerequisites: [{ anyOf: ['STR'], min: 13 }],
      proficienciesGained: null,
      gains: {
        armor: ['Light armor'],
        weapons: [],
        tools: [],
        skill: null,
        instrument: false,
        origin: 'text',
      },
    },
    subclassTitle: 'Subclass',
    subclassLevel: 3,
    subclassFeatureLevels: [3],
    progression: { columns: [], rows: rows({}, () => ({})) },
    spellcasting: null,
    features: [],
    ...over,
  };
}

const fighter = cls('fighter', {
  progression: {
    columns: [],
    rows: rows(
      { 1: ['Fighting Style'], 4: ['Ability Score Improvement'], 6: ['Ability Score Improvement'] },
      () => ({}),
    ),
  },
  features: [
    { name: 'Second Wind', level: 1, description: '' },
    { name: 'Extra Attack', level: 5, description: '' },
  ],
});

const wizard = cls('wizard', {
  hitDie: 6,
  primaryAbility: ['INT'],
  multiclass: {
    prerequisites: [{ anyOf: ['INT'], min: 13 }],
    proficienciesGained: null,
    gains: {
      armor: [],
      weapons: [],
      tools: [],
      skill: null,
      instrument: false,
      origin: 'estimate',
    },
  },
  spellcasting: {
    ability: 'INT',
    kind: 'full',
    preparation: 'prepared',
    cantripsByLevel: [3, 3, 3, 4, ...Array(16).fill(4)],
    preparedByLevel: [4, 5, 6, 7, ...Array(16).fill(8)],
    slotsByLevel: [
      [2, 0, 0, 0, 0, 0, 0, 0, 0],
      [3, 0, 0, 0, 0, 0, 0, 0, 0],
      [4, 2, 0, 0, 0, 0, 0, 0, 0],
      ...Array(17).fill([4, 3, 0, 0, 0, 0, 0, 0, 0]),
    ],
  },
});

const warlock = cls('warlock', {
  progression: {
    columns: ['Eldritch Invocations'],
    rows: rows({}, (l) => ({ 'Eldritch Invocations': l === 1 ? '1' : l < 5 ? '3' : '5' })),
  },
});

const option = (id: string, group: string, classId: string) =>
  ({ id, name: id, group, classId, subclassId: null, prerequisites: null }) as ClassOption;

const asi = {
  id: 'ability-score-improvement',
  name: 'Ability Score Improvement',
  category: 'general',
  description: '',
} as unknown as Feat;

const data: RulesData = {
  classes: new Map([fighter, wizard, warlock].map((c) => [c.id, c])),
  subclasses: new Map(),
  species: new Map(),
  backgrounds: new Map(),
  feats: new Map([[asi.id, asi]]),
  items: new Map(),
};

function thorin(level = 3): Character {
  return {
    ...newCharacter('Thorin', 'pc'),
    classes: [{ id: 'fighter', level, subclassId: null, hp: Array(level).fill(null) }],
    abilityScores: {
      method: 'manual',
      base: { STR: 15, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 8 },
    },
  };
}

describe('level up', () => {
  it('adds a level to an existing class or a new class at the end', () => {
    const ch = thorin(3);
    const up = addLevel(ch, 'fighter');
    expect(up.index).toBe(0);
    expect(up.character.classes[0]).toEqual({
      id: 'fighter',
      level: 4,
      subclassId: null,
      hp: [null, null, null, null],
    });
    expect(ch.classes[0].level).toBe(3); // the original is untouched
    const multi = addLevel(ch, 'wizard');
    expect(multi.index).toBe(1);
    expect(multi.character.classes[1]).toEqual({
      id: 'wizard',
      level: 1,
      subclassId: null,
      hp: [null],
    });
  });

  it('stores the hit points of the new level (null = average)', () => {
    const up = addLevel(thorin(3), 'fighter').character;
    expect(withLevelHp(up, 0, 7).classes[0].hp).toEqual([null, null, null, 7]);
    expect(averageHp(10)).toBe(6);
    expect(averageHp(6)).toBe(4);
    expect(averageHp(12)).toBe(7);
  });

  it('knows what the new class level asks for', () => {
    const ch = thorin(3);
    const g = levelGains(fighter, 4, ch.classes[0], undefined, []);
    expect(g.isNewClass).toBe(false);
    expect(g.needsSubclass).toBe(true); // reached level 3 without one
    expect(g.featSlots.map((s) => s.slot)).toEqual(['fighter:4']);
    expect(g.tableFeatures).toEqual(['Ability Score Improvement']);
    expect(g.spells).toBeNull();
    expect(g.multiclass).toBeNull();
    const chosen = { ...ch.classes[0], subclassId: 'fighter/champion' };
    expect(levelGains(fighter, 5, chosen, undefined, []).featSlots).toEqual([]);
    expect(levelGains(fighter, 5, chosen, undefined, []).needsSubclass).toBe(false);
  });

  it('counts the new spells of a caster and its multiclass gains', () => {
    const g = levelGains(wizard, 1, undefined, undefined, []);
    expect(g.spells?.cantrips).toEqual({ before: 0, after: 3 });
    expect(g.spells?.prepared).toEqual({ before: 0, after: 4 });
    expect(g.spells?.maxLevel).toEqual({ before: 0, after: 1 });
    expect(g.multiclass?.estimated).toBe(true);
    expect(spellsGrow(g.spells)).toBe(true);
    const at3 = levelGains(
      wizard,
      3,
      { id: 'wizard', level: 2, subclassId: null, hp: [] },
      undefined,
      [],
    );
    expect(at3.spells?.maxLevel).toEqual({ before: 1, after: 2 });
    // the starting class grants no multiclass proficiencies
    expect(levelGains(wizard, 1, undefined, undefined, [], true).multiclass).toBeNull();
  });

  it('offers the option groups that grow at this level', () => {
    const opts = [option('agonizing-blast', 'eldritch-invocation', 'warlock')];
    const entry = { id: 'warlock', level: 4, subclassId: 'x', hp: [] };
    const g5 = levelGains(warlock, 5, entry, undefined, opts);
    expect(g5.optionGroups.map((g) => [g.group, g.before, g.count])).toEqual([
      ['eldritch-invocation', 3, 5],
    ]);
    expect(levelGains(warlock, 4, { ...entry, level: 3 }, undefined, opts).optionGroups).toEqual(
      [],
    );
    expect(levelGains(warlock, 1, undefined, undefined, opts).optionGroups[0].before).toBe(0);
  });

  it('counts the new Expertise picks', () => {
    const rogue = cls('rogue', {
      progression: { columns: [], rows: rows({ 1: ['Expertise'], 6: ['Expertise'] }, () => ({})) },
    });
    expect(
      levelGains(rogue, 6, { id: 'rogue', level: 5, subclassId: 'r', hp: [] }, undefined, [])
        .expertise,
    ).toBe(2);
    expect(
      levelGains(rogue, 5, { id: 'rogue', level: 4, subclassId: 'r', hp: [] }, undefined, [])
        .expertise,
    ).toBe(0);
  });

  it('warns about multiclassing requirements without blocking', () => {
    const sheet = computeSheet(thorin(3), data);
    const notes = multiclassNotes([fighter], wizard, sheet);
    expect(notes.map((n) => [n.key, n.params])).toEqual([
      ['create.issue.multiclass', { cls: 'Wizard', what: 'INT 13' }],
      ['create.issue.multiclassEstimated', { cls: 'Wizard' }],
    ]);
  });

  it('lists the skills a multiclass grants', () => {
    const rogue = cls('rogue', {
      proficiencies: {
        armor: [],
        weapons: [],
        tools: [],
        skills: { choose: 4, from: ['stealth'] },
      },
    });
    expect(multiclassSkillOptions(rogue, { skill: 'list' } as never)).toEqual(['stealth']);
    expect(multiclassSkillOptions(rogue, { skill: 'any' } as never)).toHaveLength(18);
    expect(multiclassSkillOptions(rogue, null)).toEqual([]);
  });

  it('stores a feat slot and its ability increases like the wizard', () => {
    let ch = addLevel(thorin(3), 'fighter').character;
    ch = withSlotFeat(ch, 'fighter:4', asi.id);
    expect(slotPicks(asi).picks).toBe(2);
    ch = withSlotAbility(ch, 'fighter:4', 0, 'STR', 2);
    ch = withSlotAbility(ch, 'fighter:4', 1, 'STR', 2);
    expect(ch.choices.abilityIncreases).toEqual([
      { source: asi.id, ability: 'STR', amount: 2, slot: 'fighter:4' },
    ]);
    expect(slotAbility(ch, 'fighter:4', 1)).toBe('STR');
    ch = withSlotAbility(ch, 'fighter:4', 1, 'CON', 2);
    expect(ch.choices.abilityIncreases.map((i) => [i.ability, i.amount])).toEqual([
      ['STR', 1],
      ['CON', 1],
    ]);
    // another feat drops the picks of the previous one
    expect(withSlotFeat(ch, 'fighter:4', 'tough').choices.abilityIncreases).toEqual([]);
  });

  it('shows what changes on the sheet, and the new features', () => {
    const before = thorin(5);
    let after = withSlotFeat(addLevel(before, 'fighter').character, 'fighter:6', asi.id);
    after = withSlotAbility(after, 'fighter:6', 0, 'STR', 2);
    after = withSlotAbility(after, 'fighter:6', 1, 'STR', 2);
    const b = computeSheet(before, data);
    const a = computeSheet(after, data);
    expect(sheetChanges(b, a).map((c) => [c.what, c.ref ?? '', c.before, c.after])).toEqual([
      ['level', '', '5', '6'],
      ['hp', '', '44', '52'],
      ['pb', '', '+3', '+3'],
      ['hitDice', '', '5d10', '6d10'],
      ['ability', 'STR', '15', '17'],
    ]);
    expect(newFeatures(b, a).map((f) => f.name)).toEqual(['Ability Score Improvement']);
    const at5 = computeSheet(addLevel(thorin(4), 'fighter').character, data);
    expect(newFeatures(computeSheet(thorin(4), data), at5).map((f) => f.name)).toEqual([
      'Extra Attack',
    ]);
  });

  it('shows new spell slots and spellcasting when multiclassing into a caster', () => {
    const before = thorin(3);
    const after = addLevel(before, 'wizard').character;
    const changes = sheetChanges(computeSheet(before, data), computeSheet(after, data));
    expect(changes.find((c) => c.what === 'slots')).toEqual({
      what: 'slots',
      before: '—',
      after: '2',
    });
    expect(changes.find((c) => c.what === 'cantrips')).toMatchObject({
      classId: 'wizard',
      before: '—',
      after: '3',
    });
  });

  it('keeps only the notes the level brought', () => {
    const old = [{ key: 'a', kind: 'missing' as const }];
    const now = [...old, { key: 'b', params: { count: 1 }, kind: 'missing' as const }];
    expect(newNotes(old, now).map((n) => n.key)).toEqual(['b']);
  });

  it('raises current hit points with the maximum', () => {
    const ch = thorin(3);
    expect(withHpGained(ch, 6)).toBe(ch); // null = at maximum
    const hurt = { ...ch, state: { ...ch.state, hpCurrent: 10 } };
    expect(withHpGained(hurt, 6).state.hpCurrent).toBe(16);
  });
});
