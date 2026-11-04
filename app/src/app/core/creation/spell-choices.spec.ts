import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { Character, newCharacter, normalizeCharacter } from '../models/character';
import { DndClass, Spell, Subclass } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import { review } from './creation-rules';
import { addLevel } from './level-up';
import {
  SpellCaster,
  UNASSIGNED,
  chosenForOthers,
  countsFor,
  dropClassSpells,
  flatSpells,
  isChosenFor,
  replaceSpellFor,
  sharedCount,
  spellCasters,
  spellFields,
  spellMarks,
  spellsByClassOf,
  toggleSpellFor,
} from './spell-choices';

const sp = (id: string, level: number, classes: string[]) =>
  [id, { level, classes }] as [string, Pick<Spell, 'level' | 'classes'>];

const SPELLS = new Map([
  sp('mage-hand', 0, ['artificer', 'warlock', 'wizard']),
  sp('booming-blade', 0, ['artificer', 'warlock', 'wizard']),
  sp('frostbite', 0, ['artificer', 'warlock', 'wizard']),
  sp('guidance', 0, ['artificer', 'cleric']),
  sp('eldritch-blast', 0, ['warlock']),
  sp('cure-wounds', 1, ['artificer', 'cleric']),
  sp('hex', 1, ['warlock']),
  sp('shield', 1, ['wizard']),
  sp('bless', 1, ['cleric']),
]);

const art: SpellCaster = { classId: 'artificer', list: 'artificer', cantrips: 2, prepared: 2 };
const lock: SpellCaster = { classId: 'warlock', list: 'warlock', cantrips: 2, prepared: 2 };

describe('spell choices by class', () => {
  it('picks and drops a spell for one class only', () => {
    let by = toggleSpellFor({}, 'warlock', 'mage-hand', true);
    expect(isChosenFor(by, 'warlock', 'mage-hand')).toBe(true);
    expect(isChosenFor(by, 'artificer', 'mage-hand')).toBe(false);
    expect(chosenForOthers(by, 'artificer', 'mage-hand')).toEqual(['warlock']);
    // the same spell for the other class too: two picks, one spell on the list
    by = toggleSpellFor(by, 'artificer', 'mage-hand', true);
    expect(spellFields(by).spells).toEqual(['mage-hand']);
    expect(sharedCount(by)).toBe(1);
    // dropping it for one class keeps the other's pick
    by = toggleSpellFor(by, 'warlock', 'mage-hand', false);
    expect(isChosenFor(by, 'artificer', 'mage-hand')).toBe(true);
    expect(spellFields(by).spells).toEqual(['mage-hand']);
    by = toggleSpellFor(by, 'artificer', 'mage-hand', false);
    expect(spellFields(by)).toEqual({ spells: [], spellsByClass: {} });
  });

  it('never picks twice in a class and swaps inside the class', () => {
    let by = toggleSpellFor({}, 'warlock', 'hex', true);
    by = toggleSpellFor(by, 'warlock', 'hex', true);
    expect(by['warlock']).toEqual(['hex']);
    by = toggleSpellFor(by, 'artificer', 'cure-wounds', true);
    expect(replaceSpellFor(by, 'warlock', 'hex', 'eldritch-blast')['warlock']).toEqual([
      'eldritch-blast',
    ]);
    // the swap leaves the other class alone, and refuses to take what the class already has
    expect(replaceSpellFor(by, 'warlock', 'hex', 'eldritch-blast')['artificer']).toEqual([
      'cure-wounds',
    ]);
    expect(replaceSpellFor(by, 'warlock', 'cure-wounds', 'hex')).toBe(by);
    expect(replaceSpellFor(by, 'warlock', 'hex', 'hex')).toBe(by);
  });

  it('forgets the picks of a class without touching a shared spell of another', () => {
    const by = {
      artificer: ['mage-hand', 'guidance'],
      warlock: ['mage-hand'],
    };
    const left = dropClassSpells(by, 'warlock');
    expect(flatSpells(left)).toEqual(['mage-hand', 'guidance']);
  });

  it('counts the picks of each class on its own (the bug: 3 shared with 2 + 2)', () => {
    // three cantrips both lists have, split 2 for the Artificer and 1 for the Warlock
    const by = {
      artificer: ['mage-hand', 'booming-blade'],
      warlock: ['frostbite', 'eldritch-blast'],
    };
    expect(countsFor(by, art, SPELLS)).toEqual({ cantrips: 2, leveled: 0 });
    expect(countsFor(by, lock, SPELLS)).toEqual({ cantrips: 2, leveled: 0 });
    expect(spellFields(by).spells).toHaveLength(4);
  });

  it('notes a spell picked for another class, without selecting it', () => {
    const by = { warlock: ['mage-hand', 'frostbite'], artificer: ['frostbite'] };
    const marks = spellMarks(
      by,
      [art, lock],
      (id) => id.toUpperCase(),
      (also, cls) => `${also ? 'also' : 'already'} ${cls}`,
    );
    expect(marks['artificer']).toEqual({
      'mage-hand': 'already WARLOCK',
      frostbite: 'also WARLOCK',
    });
    expect(marks['warlock']).toEqual({ frostbite: 'also ARTIFICER' });
  });

  describe('migration of a flat list', () => {
    const migrate = (spells: string[], casters = [art, lock]) =>
      spellsByClassOf({ spells }, casters, SPELLS);

    it('gives a spell to the only class that has it', () => {
      expect(migrate(['eldritch-blast', 'hex', 'guidance', 'cure-wounds'])).toEqual({
        warlock: ['eldritch-blast', 'hex'],
        artificer: ['guidance', 'cure-wounds'],
      });
    });

    it('fills the first class up to its allowance, then the next', () => {
      // 3 cantrips on both lists: 2 + 1 (the bug's scenario), no class over its limit
      const by = migrate(['mage-hand', 'booming-blade', 'frostbite']);
      expect(by).toEqual({ artificer: ['mage-hand', 'booming-blade'], warlock: ['frostbite'] });
      // exclusive spells are placed first, so they are not crowded out by shared ones
      const by2 = migrate(['mage-hand', 'booming-blade', 'guidance', 'eldritch-blast']);
      expect(by2['artificer']).toEqual(['guidance', 'mage-hand']);
      expect(by2['warlock']).toEqual(['eldritch-blast', 'booming-blade']);
    });

    it('sends the leftovers to the first class that has them and never loses a spell', () => {
      const all = ['mage-hand', 'booming-blade', 'frostbite', 'guidance', 'eldritch-blast', 'hex'];
      const by = migrate(all);
      expect(new Set(flatSpells(by))).toEqual(new Set(all));
      expect(migrate(['shield', 'bless'], [art, lock])).toEqual({
        [UNASSIGNED]: ['shield', 'bless'],
      });
      expect(migrate(['mage-hand'], [])).toEqual({ [UNASSIGNED]: ['mage-hand'] });
      // everything full: the spell still goes to the first class that has it
      const full = migrate(
        ['mage-hand', 'booming-blade', 'frostbite', 'guidance'],
        [
          { ...art, cantrips: 1 },
          { ...lock, cantrips: 1 },
        ],
      );
      expect(full['artificer']).toContain('guidance');
      expect(flatSpells(full)).toHaveLength(4);
    });

    it('is stable: running it over its own result changes nothing', () => {
      const by = migrate(['mage-hand', 'booming-blade', 'frostbite', 'eldritch-blast']);
      const again = spellsByClassOf(spellFields(by), [art, lock], SPELLS);
      expect(again).toEqual(by);
    });

    it('keeps the recorded picks and places only what an older app version added or removed', () => {
      const stored = {
        spells: ['mage-hand', 'hex', 'eldritch-blast'],
        spellsByClass: { artificer: ['mage-hand', 'cure-wounds'], warlock: ['mage-hand', 'hex'] },
      };
      const by = spellsByClassOf(stored, [art, lock], SPELLS);
      // cure-wounds was removed from the flat list; eldritch-blast was added
      expect(by).toEqual({
        artificer: ['mage-hand'],
        warlock: ['mage-hand', 'hex', 'eldritch-blast'],
      });
    });
  });
});

// -- review: the exact scenario of the report ------------------------------------------------

function cls(id: string, cantrips: number, prepared: number): DndClass {
  return {
    id,
    name: id,
    subclassLevel: 3,
    subclassTitle: 'x',
    proficiencies: { armor: [], weapons: [], tools: [], skills: { choose: 0, from: [] } },
    progression: {
      columns: [],
      rows: Array.from({ length: 20 }, (_, i) => ({
        level: i + 1,
        proficiencyBonus: null,
        features: [],
        values: {},
      })),
    },
    multiclass: { gains: { armor: [], weapons: [], tools: [], skill: null, instrument: false } },
    spellcasting: {
      ability: 'INT',
      cantripsByLevel: Array(20).fill(cantrips),
      preparedByLevel: Array(20).fill(prepared),
      slotsByLevel: Array.from({ length: 20 }, () => [2]),
    },
  } as unknown as DndClass;
}

describe('review of a multiclass caster', () => {
  const classes = [cls('artificer', 2, 2), cls('warlock', 2, 2)];
  const ch = (choices: Partial<Character['choices']>): Character => ({
    ...newCharacter('Mix', 'pc'),
    classes: [
      { id: 'artificer', level: 1, subclassId: null, hp: [] },
      { id: 'warlock', level: 1, subclassId: null, hp: [] },
    ],
    choices: { ...newCharacter('', '').choices, ...choices },
  });
  const issues = (c: Character) =>
    review(c, { classes, sheet: null, feats: new Map(), spells: SPELLS as Map<string, Spell> })
      .choices.filter((n) => n.kind === 'issue')
      .map((n) => `${n.key}:${n.params?.['cls']}`);

  it('does not flag 3 shared cantrips picked as 2 + 1', () => {
    const c = ch({
      spells: ['mage-hand', 'booming-blade', 'frostbite'],
      spellsByClass: { artificer: ['mage-hand', 'booming-blade'], warlock: ['frostbite'] },
    });
    expect(issues(c)).toEqual([]);
  });

  it('does not flag an old flat list either (the migration spreads it over both classes)', () => {
    expect(issues(ch({ spells: ['mage-hand', 'booming-blade', 'frostbite'] }))).toEqual([]);
    // 4 shared cantrips with 2 + 2 are fine too
    expect(issues(ch({ spells: ['mage-hand', 'booming-blade', 'frostbite', 'guidance'] }))).toEqual(
      [],
    );
  });

  it('still flags a class with more picks than its allowance', () => {
    const c = ch({
      spells: ['mage-hand', 'booming-blade', 'frostbite'],
      spellsByClass: { warlock: ['mage-hand', 'booming-blade', 'frostbite'] },
    });
    expect(issues(c)).toEqual(['create.issue.tooManyCantrips:warlock']);
  });

  it('counts a cantrip picked for both classes as a pick of each', () => {
    const c = ch({
      spells: ['mage-hand'],
      spellsByClass: { artificer: ['mage-hand'], warlock: ['mage-hand'] },
    });
    expect(issues(c)).toEqual([]);
    expect(c.choices.spells).toHaveLength(1);
  });
});

describe('spell casters of a character', () => {
  it('reads the list and the allowances from the class level', () => {
    const c = { classes: [{ id: 'artificer', level: 5, subclassId: null, hp: [] }] };
    const out = spellCasters(
      c,
      new Map([['artificer', cls('artificer', 3, 6)]]),
      new Map<string, Subclass>(),
    );
    expect(out).toEqual([{ classId: 'artificer', list: 'artificer', cantrips: 3, prepared: 6 }]);
  });
});

// -- old saved characters behave as before ----------------------------------------------------

describe('saved characters', () => {
  const root = join(process.cwd(), '..');
  const read = <T>(f: string): T[] => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
  const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const rules = (): RulesData => ({
    classes: byId(read<DndClass>('classes.json')),
    subclasses: byId(read<Subclass>('subclasses.json')),
    species: byId(read<never>('species.json')),
    backgrounds: byId(read<never>('backgrounds.json')),
    feats: byId(read<never>('feats.json')),
    items: byId(read<never>('items.json')),
  });
  const spells = byId(read<Spell>('spells.json'));
  const files = readdirSync(join(root, 'characters')).filter((f) => f.endsWith('.json'));

  it('finds the saved characters', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('the sheet of every saved character is the same with its spells assigned to classes', () => {
    const data = rules();
    for (const f of files) {
      const old = normalizeCharacter(
        JSON.parse(readFileSync(join(root, 'characters', f), 'utf8')),
      )!;
      const casters = spellCasters(old, data.classes, data.subclasses);
      const by = spellsByClassOf(old.choices, casters, spells);
      const migrated: Character = { ...old, choices: { ...old.choices, ...spellFields(by) } };
      expect(computeSheet(migrated, data), f).toEqual(computeSheet(old, data));
      // nothing lost, and the flat list written back still has every spell
      expect(new Set(migrated.choices.spells), f).toEqual(new Set(old.choices.spells));
    }
  });

  it('an old multiclass character with shared cantrips loads without false problems', () => {
    const data = rules();
    const old = normalizeCharacter({
      ...newCharacter('Mix', 'pc'),
      classes: [
        { id: 'artificer', level: 1, subclassId: null, hp: [] },
        { id: 'warlock', level: 1, subclassId: null, hp: [] },
      ],
      choices: {
        ...newCharacter('', '').choices,
        spells: ['mage-hand', 'booming-blade', 'frostbite'],
      },
    })!;
    const casters = spellCasters(old, data.classes, data.subclasses);
    const by = spellsByClassOf(old.choices, casters, spells);
    expect(Object.values(by).map((x) => x.length)).toEqual([2, 1]);
  });

  it("a level up into a second caster keeps the first one's picks and starts the new one empty", () => {
    const data = rules();
    const old = normalizeCharacter({
      ...newCharacter('Art', 'pc'),
      classes: [{ id: 'artificer', level: 1, subclassId: null, hp: [] }],
      choices: { ...newCharacter('', '').choices, spells: ['mage-hand', 'booming-blade'] },
    })!;
    const withBy = {
      ...old,
      choices: {
        ...old.choices,
        ...spellFields(
          spellsByClassOf(old.choices, spellCasters(old, data.classes, data.subclasses), spells),
        ),
      },
    };
    const lvl = addLevel(withBy, 'warlock').character;
    const casters = spellCasters(lvl, data.classes, data.subclasses);
    expect(casters.map((c) => c.classId)).toEqual(['artificer', 'warlock']);
    let by = spellsByClassOf(lvl.choices, casters, spells);
    expect(by).toEqual({ artificer: ['mage-hand', 'booming-blade'] });
    // the Warlock takes mage-hand as its own pick; the Artificer's stays
    by = toggleSpellFor(by, 'warlock', 'mage-hand', true);
    expect(countsFor(by, casters[0], spells).cantrips).toBe(2);
    expect(countsFor(by, casters[1], spells).cantrips).toBe(1);
    expect(spellFields(by).spells).toEqual(['mage-hand', 'booming-blade']);
  });
});
