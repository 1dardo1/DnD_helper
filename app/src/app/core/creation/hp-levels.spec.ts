import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import species from '../../../../../data/species.json';
import { Character, newCharacter, normalizeCharacter } from '../models/character';
import { Background, DndClass, Feat, Item, Species } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import {
  averageHp,
  clampHp,
  ClassEntry,
  hpBreakdown,
  hpMethodAt,
  firstLevelHouseRule,
  freeLevels,
  levelHp,
  rollHitDie,
  spreadHpTotal,
  withFirstLevelMax,
  withFixedAll,
  withHpMethod,
  withMethodEverywhere,
} from './hp-levels';
import { addLevel } from './level-up';

const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

const DATA: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: new Map(),
  species: map<Species>(species),
  backgrounds: map<Background>(backgrounds),
  feats: map<Feat>(feats),
  items: map<Item>(items),
};

/** CON 14 (+2). */
function pc(entries: Character['classes']): Character {
  return {
    ...newCharacter('Test', 'pc'),
    classes: entries,
    abilityScores: {
      method: 'manual',
      base: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    },
  };
}

const hpMax = (c: Character) => computeSheet(c, DATA).hitPoints.max;

describe('hit points per level', () => {
  it('uses the 2024 hit dice and averages of the classes', () => {
    const dice = Object.fromEntries(
      (classes as unknown as DndClass[])
        .filter((c) => c.edition === '2024')
        .map((c) => [c.id, c.hitDie]),
    );
    expect(dice['wizard']).toBe(6);
    expect(dice['rogue']).toBe(8);
    expect(dice['fighter']).toBe(10);
    expect(dice['barbarian']).toBe(12);
    expect([6, 8, 10, 12].map(averageHp)).toEqual([4, 5, 6, 7]);
  });

  it('rolls inside 1..die and clamps typed values', () => {
    expect(rollHitDie(8, () => 0)).toBe(1);
    expect(rollHitDie(8, () => 0.999)).toBe(8);
    expect(clampHp(0, 8)).toBe(1);
    expect(clampHp('99', 8)).toBe(8);
    expect(clampHp('abc', 8)).toBeNull();
    expect(clampHp(5.4, 8)).toBe(5);
  });

  it('level 1 of the starting class is the full die when no method was chosen for it', () => {
    expect(levelHp({ hp: [3] }, 0, 10, true)).toBe(10);
    expect(levelHp({ hp: [null, null] }, 1, 10, true)).toBe(6);
    expect(levelHp({ hp: [3] }, 0, 10, false)).toBe(3); // multiclass level 1 is not max
  });

  it('sets a method per level: average stores null, roll/fixed store the value', () => {
    const k: ClassEntry = { id: 'fighter', level: 3, subclassId: null, hp: [null, null, null] };
    const a = withHpMethod(k, 1, 10, 'roll', 9);
    const b = withHpMethod(a, 2, 10, 'fixed', 99);
    const c = withHpMethod(b, 1, 10, 'average');
    expect(a.hp).toEqual([null, 9, null]);
    expect(b.hp).toEqual([null, 9, 10]); // clamped to the die
    expect(b.hpMethod).toEqual([null, 'roll', 'fixed']);
    expect(c.hp).toEqual([null, null, 10]);
    expect(hpMethodAt(c, 1)).toBe('average');
    expect(hpMethodAt(k, 1)).toBeNull();
    expect(k.hp).toEqual([null, null, null]); // not mutated
  });

  it('applies the same fixed value to several levels', () => {
    const k: ClassEntry = {
      id: 'fighter',
      level: 4,
      subclassId: null,
      hp: [null, null, null, null],
    };
    const out = withFixedAll(k, [1, 2, 3], 10, 8);
    expect(out.hp).toEqual([null, 8, 8, 8]);
    expect(out.hpMethod).toEqual([null, 'fixed', 'fixed', 'fixed']);
  });

  it('adds up per method in the sheet (CON +2)', () => {
    let k: Character['classes'][number] = {
      id: 'fighter',
      level: 3,
      subclassId: null,
      hp: [null, null, null],
    };
    k = withHpMethod(k, 1, 10, 'roll', 3); // 3 + 2
    k = withHpMethod(k, 2, 10, 'average'); // 6 + 2
    // level 1: 10 + 2 = 12
    expect(hpMax(pc([k]))).toBe(12 + 5 + 8);
    k = withHpMethod(k, 2, 10, 'fixed', 10);
    expect(hpMax(pc([k]))).toBe(12 + 5 + 12);
  });

  it('a multiclass level uses the die of the class it is taken in', () => {
    const fighter = { id: 'fighter', level: 1, subclassId: null, hp: [null] };
    const up = addLevel(pc([fighter]), 'wizard').character; // wizard d6 at level 1: average 4
    expect(up.classes[1].hp).toEqual([null]);
    expect(hpMax(up)).toBe(12 + 6);
    const rolled = { ...up.classes[1], ...withHpMethod(up.classes[1], 0, 6, 'roll', 6) };
    expect(hpMax(pc([fighter, rolled]))).toBe(12 + 8);
    // a value above the d6 is clamped when set, and the engine counts what was stored
    expect(withHpMethod(up.classes[1], 0, 6, 'fixed', 10).hp).toEqual([6]);
  });

  it('breakdown matches the sheet and keeps Tough-style bonuses apart', () => {
    const k = withHpMethod(
      { id: 'fighter', level: 2, subclassId: null, hp: [null, null] } as ClassEntry,
      1,
      10,
      'roll',
      7,
    );
    const ch = pc([k]);
    const sheet = computeSheet(ch, DATA);
    expect(sheet.hitPoints.levels).toEqual(
      hpBreakdown([k], (id) => DATA.classes.get(id)?.hitDie, 2),
    );
    expect(sheet.hitPoints.levels.map((r) => [r.level, r.method, r.gained, r.total])).toEqual([
      [1, null, 10, 12],
      [2, 'roll', 7, 9],
    ]);
    expect(sheet.hitPoints.bonus).toBe(0);
    const tough = {
      ...ch,
      choices: { ...ch.choices, feats: ['tough'] },
    };
    const t = computeSheet(tough, DATA);
    expect(t.hitPoints.bonus).toBe(t.hitPoints.max - 21);
  });

  it('old characters (numbers only) keep their values; the method list is normalized', () => {
    const old = normalizeCharacter({
      ...newCharacter('Old', 'pc'),
      classes: [{ id: 'fighter', level: 3, subclassId: null, hp: [null, 8, null] }],
    });
    expect(old?.classes[0].hpMethod).toBeUndefined();
    expect(hpMethodAt(old!.classes[0], 1)).toBeNull();
    expect(hpMax(pc(old!.classes))).toBe(12 + 10 + 8);
    const odd = normalizeCharacter({
      ...newCharacter('Odd', 'pc'),
      classes: [
        { id: 'fighter', level: 3, subclassId: null, hp: [null, 8], hpMethod: ['x', 'roll'] },
      ],
    });
    expect(odd?.classes[0].hpMethod).toEqual([null, 'roll']);
    const none = normalizeCharacter({ ...newCharacter('N', 'pc'), classes: [{ id: 'fighter' }] });
    expect(none?.classes[0].hp).toEqual([]);
  });

  it('leveling up keeps the methods of the earlier levels', () => {
    const k = withHpMethod(
      { id: 'fighter', level: 2, subclassId: null, hp: [null, null] } as ClassEntry,
      1,
      10,
      'roll',
      7,
    );
    const up = addLevel(pc([k]), 'fighter').character.classes[0];
    expect(up.hp).toEqual([null, 7, null]);
    expect(up.hpMethod).toEqual([null, 'roll', null]);
  });
});

describe('hit points in the wizard: house rule for level 1, all levels at once, a written total', () => {
  const die = (id: string) => DATA.classes.get(id)?.hitDie;
  const fighter3: ClassEntry = {
    id: 'fighter',
    level: 3,
    subclassId: null,
    hp: [null, null, null],
  };
  const rogue2: ClassEntry = { id: 'rogue', level: 2, subclassId: null, hp: [null, null] };

  it('level 1 of the starting class: the full die unless a house rule is chosen for it', () => {
    // older characters: a stored number without a method still gets the full die
    expect(levelHp({ hp: [3] }, 0, 10, true)).toBe(10);
    const rolled = withHpMethod(fighter3, 0, 10, 'roll', 4);
    expect(firstLevelHouseRule(rolled)).toBe(true);
    expect(levelHp(rolled, 0, 10, true)).toBe(4);
    expect(levelHp(withHpMethod(fighter3, 0, 10, 'average'), 0, 10, true)).toBe(6);
    // chosen "roll" but not rolled yet: the full die meanwhile
    expect(levelHp(withHpMethod(fighter3, 0, 10, 'roll'), 0, 10, true)).toBe(10);
    const back = withFirstLevelMax(rolled);
    expect(firstLevelHouseRule(back)).toBe(false);
    expect(levelHp(back, 0, 10, true)).toBe(10);
    // the sheet (real data): Fighter 1, CON +2 → 12, or 6 with an average level 1
    expect(hpMax(pc([{ ...fighter3, level: 1, hp: [null] }]))).toBe(12);
    const avg1 = withHpMethod({ ...fighter3, level: 1, hp: [null] }, 0, 10, 'average');
    expect(hpMax(pc([avg1]))).toBe(8);
    expect(hpBreakdown([avg1], die, 2)[0]).toEqual(
      expect.objectContaining({ max: false, method: 'average', gained: 6, total: 8 }),
    );
  });

  it('rolls or averages every level but level 1 of the rule, in every class', () => {
    expect(freeLevels([fighter3, rogue2])).toEqual([
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ]);
    const rolled = withMethodEverywhere([fighter3, rogue2], die, 'roll', () => 0.999);
    expect(rolled[0].hp).toEqual([null, 10, 10]);
    expect(rolled[1].hp).toEqual([8, 8]);
    expect(rolled[1].hpMethod).toEqual(['roll', 'roll']);
    const avg = withMethodEverywhere(rolled, die, 'average');
    expect(avg[0].hp).toEqual([null, null, null]);
    expect(avg[0].hpMethod).toEqual([null, 'average', 'average']);
    // Fighter 3 / Rogue 2 with CON +2: 10 + 6 + 6 + 5 + 5 + 5 × 2 = 42
    expect(hpMax(pc(avg))).toBe(42);
  });

  it('spreads a written maximum over the levels as evenly as the dice allow', () => {
    // 50 = level 1 (10 + 2) + 4 levels × CON 2 + 30 of dice → 8, 8, 7, 7
    const r = spreadHpTotal([fighter3, rogue2], die, 2, 0, 50);
    expect(r.off).toBe(0);
    expect(hpMax(pc(r.classes))).toBe(50);
    expect(r.classes[0].hp).toEqual([null, 8, 8]);
    expect(r.classes[1].hp).toEqual([7, 7]);
    expect(r.classes[1].hpMethod).toEqual(['fixed', 'fixed']);
    // more than the dice can give: every level at its die, and how far it stays
    const high = spreadHpTotal([fighter3, rogue2], die, 2, 0, 100);
    expect(high.classes[1].hp).toEqual([8, 8]);
    expect(high.off).toBe(100 - 56);
    // a level 1 character: its only level takes the value as a house rule
    const one = spreadHpTotal([{ ...fighter3, level: 1, hp: [null] }], die, 2, 0, 9);
    expect(one.off).toBe(0);
    expect(firstLevelHouseRule(one.classes[0])).toBe(true);
    expect(hpMax(pc(one.classes))).toBe(9);
  });
});
