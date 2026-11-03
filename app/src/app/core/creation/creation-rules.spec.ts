import { newCharacter } from '../models/character';
import { Background, DndClass, Feat, Spell, Spellcasting } from '../models/compendium';
import {
  backgroundIncreasesValid,
  expertiseCount,
  featSlots,
  featsForSlot,
  featIssues,
  maxSpellLevel,
  multiclassIssues,
  pointBuyCost,
  review,
  skillPicks,
  spellListOf,
  spellsFor,
  toolChoices,
} from './creation-rules';
import { Sheet } from '../rules/sheet';

const rows = (features: Record<number, string[]>, slots?: (lvl: number) => number[]) =>
  Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    proficiencyBonus: null,
    features: features[i + 1] ?? [],
    values: {},
  }));

const fighter = {
  id: 'fighter',
  name: 'Fighter',
  subclassLevel: 3,
  subclassTitle: 'Fighter Subclass',
  proficiencies: {
    armor: [],
    weapons: [],
    tools: [],
    skills: { choose: 2, from: ['athletics', 'acrobatics', 'perception'] },
  },
  progression: {
    columns: [],
    rows: rows({
      1: ['Fighting Style', 'Second Wind'],
      4: ['Ability Score Improvement'],
      6: ['Ability Score Improvement'],
      19: ['Epic Boon'],
    }),
  },
  spellcasting: null,
} as unknown as DndClass;

const feat = (id: string, category: string, level?: number) =>
  ({ id, name: id, category, prerequisites: level ? { raw: '', level } : null }) as unknown as Feat;

describe('creation rules', () => {
  it("prices point buy like the Player's Handbook", () => {
    expect(pointBuyCost({ STR: 15, DEX: 15, CON: 15, INT: 8, WIS: 8, CHA: 8 })).toBe(27);
    expect(pointBuyCost({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })).toBe(0);
    expect(pointBuyCost({ STR: 16, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })).toBe(Infinity);
  });

  it('accepts +2/+1 or +1/+1/+1 to the background abilities only', () => {
    const bg = { abilityScores: ['STR', 'DEX', 'CON'] } as unknown as Background;
    expect(backgroundIncreasesValid(bg, { STR: 2, CON: 1 })).toBe(true);
    expect(backgroundIncreasesValid(bg, { STR: 1, DEX: 1, CON: 1 })).toBe(true);
    expect(backgroundIncreasesValid(bg, { STR: 2, DEX: 2 })).toBe(false);
    expect(backgroundIncreasesValid(bg, { STR: 2, WIS: 1 })).toBe(false);
    expect(backgroundIncreasesValid(bg, {})).toBe(false);
  });

  it('finds the feat choices a class grants up to a level', () => {
    expect(featSlots(fighter, 6).map((s) => [s.slot, s.kind])).toEqual([
      ['fighter:1', 'fighting-style'],
      ['fighter:4', 'asi'],
      ['fighter:6', 'asi'],
    ]);
    expect(featSlots(fighter, 20).map((s) => s.kind)).toContain('epic-boon');
  });

  it('reads the "Ability Score Improvemnt" typo in the Blood Hunter table as an ASI', () => {
    const rows = Array.from({ length: 16 }, (_, i) => ({
      level: i + 1,
      features: i === 15 ? ['Ability Score Improvemnt'] : [],
    }));
    const hunter = { id: 'blood-hunter', progression: { rows } } as unknown as DndClass;
    expect(featSlots(hunter, 16).map((s) => [s.slot, s.kind])).toEqual([
      ['blood-hunter:16', 'asi'],
    ]);
  });

  it('offers Ability Score Improvement first, then every general feat', () => {
    const feats = [
      feat('tough', 'general', 4),
      feat('ability-score-improvement', 'general', 4),
      feat('alert', 'origin'),
      feat('archery', 'fighting-style'),
      feat('late', 'general', 8),
    ];
    expect(featsForSlot('asi', feats).map((f) => f.id)).toEqual([
      'ability-score-improvement',
      'late',
      'tough',
    ]);
    expect(featsForSlot('fighting-style', feats).map((f) => f.id)).toEqual(['archery']);
  });

  it("adds the racial feats of the character's species at ASI levels", () => {
    const racial = (id: string, species: string[]) =>
      ({ ...feat(id, 'racial', 4), prerequisites: { raw: '', level: 4, species } }) as Feat;
    const feats = [
      feat('tough', 'general', 4),
      racial('elven-accuracy', ['elf', 'half-elf']),
      racial('dwarven-fortitude', ['dwarf']),
    ];
    expect(featsForSlot('asi', feats, 'elf').map((f) => f.id)).toEqual(['elven-accuracy', 'tough']);
    expect(featsForSlot('asi', feats, 'human').map((f) => f.id)).toEqual(['tough']);
    expect(featsForSlot('asi', feats).map((f) => f.id)).toEqual(['tough']);
    expect(featsForSlot('epic-boon', feats, 'elf')).toEqual([]);
  });

  it('counts Expertise picks', () => {
    const rogue = {
      progression: { rows: rows({ 1: ['Expertise', 'Sneak Attack'], 6: ['Expertise'] }) },
    } as unknown as DndClass;
    expect(expertiseCount(rogue, 5)).toBe(2);
    expect(expertiseCount(rogue, 6)).toBe(4);
  });

  it('lists the spells of a list up to the highest slot level, also for subclass casters', () => {
    const sc = {
      slotsByLevel: Array.from({ length: 20 }, (_, i) =>
        i < 2 ? [2, 0, 0, 0, 0, 0, 0, 0, 0] : [4, 2, 0, 0, 0, 0, 0, 0, 0],
      ),
    } as unknown as Spellcasting;
    const spell = (id: string, level: number, classes = ['wizard']) =>
      ({ id, name: id, level, classes }) as unknown as Spell;
    const all = [
      spell('light', 0),
      spell('magic-missile', 1),
      spell('misty-step', 2),
      spell('fireball', 3),
      spell('cure-wounds', 1, ['cleric']),
    ];
    expect(maxSpellLevel(sc, 3)).toBe(2);
    const { cantrips, leveled } = spellsFor('wizard', sc, 3, all);
    expect(cantrips.map((s) => s.id)).toEqual(['light']);
    expect(leveled.map((s) => s.id)).toEqual(['magic-missile', 'misty-step']);
    // an Eldritch Knight (fighter) uses the wizard list named in its subclass table
    const ek = { id: 'fighter', spellcasting: null } as unknown as DndClass;
    expect(spellListOf(ek, { ...sc, spellList: 'wizard' })).toBe('wizard');
  });

  it('says what is still missing, step by step', () => {
    const ch = {
      ...newCharacter('', 'pc'),
      classes: [{ id: 'fighter', level: 4, subclassId: null, hp: [] }],
    };
    const m = review(ch, { classes: [fighter], sheet: null, feats: new Map(), spells: new Map() });
    expect(m.class).toEqual([
      { key: 'create.missing.subclass', params: { title: 'Fighter Subclass' }, kind: 'missing' },
    ]);
    expect(m.background.map((x) => x.key)).toEqual(['create.missing.background']);
    expect(m.species.map((x) => x.key)).toEqual([
      'create.missing.species',
      'create.missing.languages',
    ]);
    expect(m.choices).toEqual([
      { key: 'create.missing.skills', params: { count: 2 }, kind: 'missing' },
      { key: 'create.missing.feats', params: { count: 2 }, kind: 'missing' },
    ]);
    expect(m.details.map((x) => x.key)).toEqual(['create.missing.name']);
  });
});

/** A sheet with just what the requirement checks read. */
function sheetWith(scores: Partial<Record<string, number>>, over: Partial<Sheet> = {}): Sheet {
  const abilities = Object.fromEntries(
    ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((a) => [a, { score: scores[a] ?? 10 }]),
  );
  return {
    totalLevel: 4,
    abilities,
    spellcasting: { classes: [], slots: [], pact: null },
    proficiencies: { armor: ['Light armor'], weapons: [], tools: [] },
    ...over,
  } as unknown as Sheet;
}

describe('requirements', () => {
  it('explains why a feat is not available', () => {
    const gwm = {
      name: 'Great Weapon Master',
      prerequisites: {
        raw: '',
        level: 4,
        abilities: [{ ability: 'STR', min: 13 }],
        abilitiesMode: 'all',
      },
    } as unknown as Feat;
    expect(featIssues(gwm, sheetWith({ STR: 15 }), null)).toEqual([]);
    expect(featIssues(gwm, sheetWith({ STR: 12 }), null).map((n) => n.key)).toEqual([
      'create.issue.featAbility',
    ]);
    const war = {
      prerequisites: { raw: '', spellcasting: true, proficiency: ['medium armor'] },
    } as unknown as Feat;
    expect(featIssues(war, sheetWith({}), null).map((n) => n.key)).toEqual([
      'create.issue.featSpellcasting',
      'create.issue.featProficiency',
    ]);
    const elven = { prerequisites: { raw: '', species: ['elf', 'half-elf'] } } as unknown as Feat;
    expect(featIssues(elven, sheetWith({}), 'elf')).toEqual([]);
    expect(featIssues(elven, sheetWith({}), 'dwarf').map((n) => n.key)).toEqual([
      'create.issue.featSpecies',
    ]);
  });

  it('needs 13 in the primary ability of every class to multiclass', () => {
    const a = {
      name: 'Paladin',
      multiclass: {
        prerequisites: [
          { anyOf: ['STR'], min: 13 },
          { anyOf: ['CHA'], min: 13 },
        ],
      },
    } as unknown as DndClass;
    const b = {
      name: 'Fighter',
      multiclass: { prerequisites: [{ anyOf: ['STR', 'DEX'], min: 13 }] },
    } as unknown as DndClass;
    expect(multiclassIssues([a], sheetWith({}))).toEqual([]); // single class: no requirement
    expect(multiclassIssues([a, b], sheetWith({ STR: 14, CHA: 13 }))).toEqual([]);
    expect(
      multiclassIssues([a, b], sheetWith({ STR: 8, DEX: 14, CHA: 13 })).map((n) => n.params),
    ).toEqual([{ cls: 'Paladin', what: 'STR 13' }]);
  });

  it('adds one skill pick per later class that grants one when multiclassing', () => {
    const rogue = {
      id: 'rogue',
      proficiencies: { skills: { choose: 4, from: ['stealth'] } },
      multiclass: {
        proficienciesGained:
          "- Gain the following traits: Hit Point Die, proficiency in one skill of your choice from the Rogue's skill list.",
      },
    } as unknown as DndClass;
    const bard = {
      id: 'bard',
      proficiencies: { skills: { choose: 3, from: [] } },
      multiclass: {
        proficienciesGained:
          '- Gain the following traits: Hit Point Die, proficiency in one skill of your choice, proficiency with one Musical Instrument of your choice.',
      },
    } as unknown as DndClass;
    expect(skillPicks([fighter, rogue]).count).toBe(3);
    expect(skillPicks([fighter, rogue]).from).toContain('stealth');
    expect(skillPicks([fighter, bard]).from).toHaveLength(18);
    expect(toolChoices([fighter, bard], undefined).map((t) => [t.slot, t.count])).toEqual([
      ['multiclass:bard', 1],
    ]);
  });

  it('finds "choose one kind of" tool choices', () => {
    const bg = { tools: 'Choose one kind of Gaming Set' } as unknown as Background;
    const bard = {
      id: 'bard',
      proficiencies: { tools: ['Choose 3 Musical Instruments'] },
      multiclass: {},
    } as unknown as DndClass;
    const monk = {
      id: 'monk',
      proficiencies: { tools: ["Choose one type of Artisan's Tools or Musical Instrument"] },
      multiclass: {},
    } as unknown as DndClass;
    expect(toolChoices([bard], bg).map((t) => [t.slot, t.count, t.options.length])).toEqual([
      ['background', 1, 4],
      ['class:bard', 3, 10],
    ]);
    expect(toolChoices([monk], undefined)[0].options).toHaveLength(27);
  });
});
