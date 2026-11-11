import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import species from '../../../../../data/species.json';
import spells from '../../../../../data/spells.json';
import { Character, newCharacter } from '../models/character';
import { Background, DndClass, Feat, Item, Species, Spell } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import { STEPS, Step, review } from './creation-rules';
import {
  noteTarget,
  pendingBySteps,
  progressOf,
  stepState,
  stepViews,
  wizardSteps,
} from './wizard-steps';
import { summarize } from './wizard-summary';

const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

const DATA: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: new Map(),
  species: map<Species>(species),
  backgrounds: map<Background>(backgrounds),
  feats: map<Feat>(feats),
  items: map<Item>(items),
};
const SPELLS = map<Spell>(spells);

/** What the wizard passes to review() for a character. */
function notesOf(ch: Character) {
  const sheet = computeSheet(ch, DATA);
  return review(ch, {
    classes: ch.classes.map((k) => DATA.classes.get(k.id)),
    subclasses: ch.classes.map(() => undefined),
    background: ch.background ? DATA.backgrounds.get(ch.background.id) : undefined,
    species: ch.species ? DATA.species.get(ch.species.id) : undefined,
    sheet,
    feats: DATA.feats,
    spells: SPELLS,
  });
}

/** A Soldier human Fighter 1 with everything chosen (as the wizard would leave it). */
function fighter(): Character {
  const c = newCharacter('Brann', 'test');
  return {
    ...c,
    classes: [{ id: 'fighter', level: 1, subclassId: null, hp: [null] }],
    background: { id: 'soldier', abilityIncreases: { STR: 2, CON: 1 } },
    species: { id: 'human', variant: null },
    size: 'Medium',
    abilityScores: {
      method: 'standard',
      base: { STR: 15, DEX: 13, CON: 14, INT: 8, WIS: 12, CHA: 10 },
    },
    choices: {
      ...c.choices,
      skills: ['acrobatics', 'perception'],
      languages: ['Draconic', 'Dwarvish'],
      weaponMasteries: ['longsword', 'greatsword', 'javelin'],
      toolChoices: [{ slot: 'background', tools: ['Dice'] }],
      featSlots: [
        { slot: 'species', featId: 'alert' },
        { slot: 'fighter:1', featId: 'defense' },
      ],
      traitPicks: { 'human:skillful#skill': ['insight'] },
    },
  };
}

describe('wizard steps', () => {
  it('has the spells step only for casters', () => {
    expect(wizardSteps(false)).toEqual(STEPS.filter((s) => s !== 'spells'));
    expect(wizardSteps(true)).toEqual(STEPS);
    expect(wizardSteps(true).indexOf('spells')).toBe(wizardSteps(true).indexOf('choices') + 1);
  });

  it('tells the state of a step: to do, with warnings, done or optional', () => {
    const missing = { key: 'create.missing.skills', kind: 'missing' as const };
    const issue = { key: 'create.issue.rareLanguage', kind: 'issue' as const };
    expect(stepState([missing, issue], false, true)).toBe('todo');
    expect(stepState([issue], false, true)).toBe('warn');
    expect(stepState([], false, true)).toBe('done');
    // nothing chosen yet: pending, unless the step can be skipped
    expect(stepState([], false, false)).toBe('todo');
    expect(stepState([], true, false)).toBe('optional');
  });

  it('a new character starts with every required step to do and the equipment optional', () => {
    const blank = { ...newCharacter('', 'test'), classes: [] };
    const steps = wizardSteps(false);
    const views = stepViews(steps, notesOf(blank), (s) =>
      s === 'equipment' ? false : s === 'choices' || s === 'hp' ? blank.classes.length > 0 : true,
    );
    const state = Object.fromEntries(views.map((v) => [v.id, v.state]));
    expect(state).toEqual({
      class: 'todo',
      background: 'todo',
      species: 'todo',
      abilities: 'todo',
      hp: 'todo',
      choices: 'todo',
      equipment: 'optional',
      details: 'todo',
    });
    expect(progressOf(views)).toEqual({ done: 0, total: 8 });
  });

  it('a Soldier human Fighter with everything chosen has every step done (real data)', () => {
    const ch = fighter();
    const notes = notesOf(ch);
    const views = stepViews(wizardSteps(false), notes, () => true);
    expect(views.filter((v) => v.state !== 'done').map((v) => [v.id, v.missing, v.issues])).toEqual(
      [],
    );
    expect(pendingBySteps(wizardSteps(false), notes)).toEqual([]);
  });

  it('lists what is missing with where to solve it, in the order of the steps', () => {
    const ch = fighter();
    ch.choices.skills = ['acrobatics'];
    ch.choices.languages = [];
    ch.name = '';
    const pending = pendingBySteps(wizardSteps(false), notesOf(ch));
    expect(pending.map((g) => [g.step, g.items.map((i) => i.target.anchor)])).toEqual([
      ['species', ['languages']],
      ['choices', ['skills']],
      ['details', ['name']],
    ]);
  });

  it('sends a multiclass requirement to the ability scores, and feat or tool picks to their part', () => {
    expect(
      noteTarget(
        { key: 'create.issue.multiclass', kind: 'issue', params: { cls: 'Wizard' } },
        'class',
      ),
    ).toEqual({ step: 'abilities', anchor: 'abilities' });
    const featPick = { key: 'create.missing.feat.spell', kind: 'missing' as const };
    expect(noteTarget(featPick, 'background').anchor).toBe('bg-feat');
    expect(noteTarget(featPick, 'species').anchor).toBe('species-feat');
    expect(noteTarget(featPick, 'choices').anchor).toBe('feats');
    const tools = { key: 'create.missing.tools', kind: 'missing' as const };
    expect(noteTarget(tools, 'background' as Step).anchor).toBe('bg-tools');
    expect(noteTarget(tools, 'choices').anchor).toBe('tools');
    // an unknown note goes to the top of its step
    expect(noteTarget({ key: 'x', kind: 'missing' }, 'equipment')).toEqual({
      step: 'equipment',
      anchor: 'equipment',
    });
  });

  it('flags a level set to be rolled that was not rolled yet, in the hit points step', () => {
    const ch = fighter();
    ch.classes = [
      {
        id: 'fighter',
        level: 3,
        subclassId: null,
        hp: [null, null, 7],
        hpMethod: [null, 'roll', 'roll'],
      },
    ];
    ch.choices.featSlots = [
      { slot: 'species', featId: 'alert' },
      { slot: 'fighter:1', featId: 'defense' },
    ];
    const notes = notesOf(ch);
    expect(notes.hp).toEqual([
      { key: 'create.missing.hpRoll', params: { cls: 'Fighter', level: 2 }, kind: 'missing' },
    ]);
    expect(noteTarget(notes.hp[0], 'hp')).toEqual({ step: 'hp', anchor: 'hp' });
  });

  it('asks a Wizard 1 for its cantrips and prepared spells in the spells step (real data)', () => {
    const ch = fighter();
    ch.classes = [{ id: 'wizard', level: 1, subclassId: null, hp: [null] }];
    ch.choices.weaponMasteries = [];
    ch.choices.featSlots = [{ slot: 'species', featId: 'alert' }];
    ch.choices.skills = ['arcana', 'history'];
    const before = notesOf(ch);
    // Wizard table, level 1: 3 cantrips, 4 prepared spells
    expect(before.spells).toEqual([
      { key: 'create.missing.cantrips', params: { cls: 'Wizard', count: 3 }, kind: 'missing' },
      { key: 'create.missing.spells', params: { cls: 'Wizard', count: 4 }, kind: 'missing' },
    ]);
    ch.choices.spells = ['fire-bolt', 'light', 'mage-hand', 'magic-missile', 'shield', 'sleep'];
    ch.choices.spellsByClass = { wizard: [...ch.choices.spells] };
    expect(notesOf(ch).spells).toEqual([
      { key: 'create.missing.spells', params: { cls: 'Wizard', count: 1 }, kind: 'missing' },
    ]);
  });
});

describe('wizard summary (real data)', () => {
  const ctx = (ch: Character) => ({
    classes: DATA.classes,
    subclasses: DATA.subclasses,
    feats: DATA.feats,
    spells: SPELLS,
    background: ch.background ? DATA.backgrounds.get(ch.background.id) : undefined,
  });

  it('a Fighter: saves, skills from background, class and species, and feats by source', () => {
    const ch = fighter();
    const s = summarize(ch, computeSheet(ch, DATA), ctx(ch));
    expect(s.abilitiesSet).toBe(true);
    expect(s.saves).toEqual(['STR', 'CON']);
    // Soldier: Athletics, Intimidation; Fighter: Acrobatics, Perception; Skillful: Insight
    expect(s.skills.map((k) => k.id).sort()).toEqual([
      'acrobatics',
      'athletics',
      'insight',
      'intimidation',
      'perception',
    ]);
    // STR 15 + 2 = 17 (+3) and proficiency +2
    expect(s.skills.find((k) => k.id === 'athletics')?.modifier).toBe(5);
    expect(s.feats.map((f) => [f.id, f.from, f.level ?? null])).toEqual([
      ['savage-attacker', 'background', null],
      ['alert', 'species', null],
      ['defense', 'class', 1],
    ]);
    expect(s.spells).toEqual([]);
  });

  it('says what is not decided yet: scores, spells picked of the allowance', () => {
    const ch = fighter();
    ch.abilityScores = null;
    ch.classes = [{ id: 'wizard', level: 1, subclassId: null, hp: [null] }];
    ch.choices.spells = ['fire-bolt', 'magic-missile'];
    ch.choices.spellsByClass = { wizard: ['fire-bolt', 'magic-missile'] };
    const s = summarize(ch, computeSheet(ch, DATA), ctx(ch));
    expect(s.abilitiesSet).toBe(false);
    expect(s.spells).toEqual([
      expect.objectContaining({
        classId: 'wizard',
        cantrips: { chosen: 1, max: 3 },
        prepared: { chosen: 1, max: 4 },
        ability: 'INT',
      }),
    ]);
  });
});
