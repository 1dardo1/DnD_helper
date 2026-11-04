import {
  CombatState,
  MonsterInfo,
  addCombatant,
  addMonsters,
  applyDamage,
  applyHealing,
  concentrationDc,
  defeatedXp,
  downState,
  emptyCombat,
  moveCombatant,
  nextTurn,
  normalizeCombat,
  previousTurn,
  removeCombatant,
  rollHitDice,
  rollMonsterInitiative,
  setConditionRounds,
  setInitiative,
  setTemp,
  sortByInitiative,
  startCombat,
  tickConditions,
  toggleCombatCondition,
  updateCombatant,
} from './combat';

const goblin: MonsterInfo = {
  id: 'goblin-warrior',
  name: 'Goblin Warrior',
  ac: 15,
  hp: 10,
  hitDice: '3d6',
  initiative: 2,
  dex: 15,
  xp: 50,
};
const bugbear: MonsterInfo = {
  id: 'bugbear-warrior',
  name: 'Bugbear Warrior',
  ac: 14,
  hp: 33,
  hitDice: '6d8 + 6',
  initiative: null,
  dex: 14,
  xp: 200,
};

/** Rolls the given numbers in turn. */
const rolls =
  (...values: number[]) =>
  () =>
    values.shift() ?? 10;

const names = (s: CombatState) => s.combatants.map((c) => c.name + (c.number ?? ''));
const current = (s: CombatState) => names(s)[s.turn];

function party(): CombatState {
  let s = addMonsters(emptyCombat(), goblin, 2);
  s = addCombatant(s, { kind: 'custom', name: 'Ana', ac: 16, hpMax: 20, initBonus: 3, dex: 16 });
  s = addCombatant(s, { kind: 'custom', name: 'Bo', initBonus: 1 });
  return s;
}

/** party() with rolls 20, 15, 10, 5: Goblin 1, Goblin 2, Ana, Bo. */
function rolled(): CombatState {
  let s = party();
  s.combatants.forEach((c, i) => (s = setInitiative(s, c.id, 20 - 5 * i)));
  return s;
}

describe('adding combatants', () => {
  it('numbers monsters after those of the same kind already there', () => {
    let s = addMonsters(emptyCombat(), goblin, 3);
    s = addMonsters(s, bugbear, 1);
    s = removeCombatant(s, s.combatants[2].id);
    s = addMonsters(s, goblin, 2);
    expect(names(s)).toEqual([
      'Goblin Warrior1',
      'Goblin Warrior2',
      'Bugbear Warrior1',
      'Goblin Warrior3',
      'Goblin Warrior4',
    ]);
    expect(new Set(s.combatants.map((c) => c.id)).size).toBe(5);
  });

  it('takes AC, HP, initiative bonus (or DEX modifier) and XP from the monster', () => {
    const s = addMonsters(addMonsters(emptyCombat(), goblin, 1), bugbear, 1);
    const [g, b] = s.combatants;
    expect([g.ac, g.hp, g.hpMax, g.initBonus, g.xp]).toEqual([15, 10, 10, 2, 50]);
    expect(b.initBonus).toBe(2);
  });

  it('can roll hit points from the hit dice', () => {
    expect(rollHitDice('6d8 + 6', 33, () => 1)).toBe(12);
    expect(rollHitDice('2d6 - 5', 2, () => 1)).toBe(1);
    expect(rollHitDice('weird', 7, () => 1)).toBe(7);
    const s = addMonsters(emptyCombat(), bugbear, 2, (m) => rollHitDice(m.hitDice, m.hp, (d) => d));
    expect(s.combatants.map((c) => c.hp)).toEqual([54, 54]);
  });

  it('keeps untracked AC and HP of custom entries as null', () => {
    const s = addCombatant(emptyCombat(), { kind: 'custom', name: ' Bo ' });
    expect(s.combatants[0]).toMatchObject({ name: 'Bo', ac: null, hp: null, hpMax: null });
  });
});

describe('initiative', () => {
  it('sorts by roll, then bonus, then DEX, then the order they had; unrolled last', () => {
    let s = party();
    const [g1, g2, ana, bo] = s.combatants.map((c) => c.id);
    s = setInitiative(s, g1, 12);
    s = setInitiative(s, g2, 15);
    s = setInitiative(s, ana, 12);
    s = sortByInitiative(s);
    expect(names(s)).toEqual(['Goblin Warrior2', 'Ana', 'Goblin Warrior1', 'Bo']);
    // same roll and bonus: higher DEX first
    s = updateCombatant(s, g1, { initBonus: 3, dex: 17 });
    expect(names(sortByInitiative(s)).slice(1, 3)).toEqual(['Goblin Warrior1', 'Ana']);
    s = setInitiative(s, bo, 1);
    expect(names(sortByInitiative(s)).at(-1)).toBe('Bo');
  });

  it('keeps ties settled by hand when sorting again', () => {
    let s = party();
    for (const c of s.combatants)
      s = updateCombatant(s, c.id, { initiative: 10, initBonus: 0, dex: 10 });
    s = moveCombatant(s, s.combatants[3].id, -1);
    expect(names(sortByInitiative(s))).toEqual(names(s));
    expect(moveCombatant(s, s.combatants[0].id, -1)).toBe(s);
  });

  it('rolls d20 + bonus for monsters only, those not rolled yet unless all', () => {
    let s = setInitiative(party(), 'c1', 30);
    s = rollMonsterInitiative(s, rolls(5));
    expect(s.combatants.map((c) => [c.name + (c.number ?? ''), c.initiative])).toEqual([
      ['Goblin Warrior1', 30],
      ['Goblin Warrior2', 7],
      ['Ana', null],
      ['Bo', null],
    ]);
    s = rollMonsterInitiative(s, rolls(1, 2), { all: true });
    expect(s.combatants.map((c) => c.initiative)).toEqual([4, 3, null, null]);
  });

  it('rolls once per kind of monster when asked', () => {
    let s = addMonsters(addMonsters(emptyCombat(), goblin, 3), bugbear, 1);
    s = rollMonsterInitiative(s, rolls(10, 3), { perGroup: true });
    expect(s.combatants.map((c) => c.initiative)).toEqual([12, 12, 12, 5]);
  });

  it('keeps the turn on whoever had it when the order changes', () => {
    let s = startCombat(party());
    s = nextTurn(s);
    const who = current(s);
    s = moveCombatant(s, s.combatants[s.turn].id, 1);
    expect(current(s)).toBe(who);
    s = setInitiative(s, s.combatants[s.turn].id, 25);
    expect(current(sortByInitiative(s))).toBe(who);
  });
});

describe('turns and rounds', () => {
  it('starts at round 1 with the highest roll and wraps into a new round', () => {
    let s = party();
    s = setInitiative(s, 'c3', 20);
    s = nextTurn(s); // starts the combat
    expect([s.round, current(s)]).toEqual([1, 'Ana']);
    for (let i = 0; i < 3; i++) s = nextTurn(s);
    expect(s.round).toBe(1);
    s = nextTurn(s);
    expect([s.round, s.turn, current(s)]).toEqual([2, 0, 'Ana']);
  });

  it('goes back, also across rounds, but not before the start', () => {
    let s = startCombat(party());
    s = previousTurn(s);
    expect([s.round, s.turn]).toEqual([1, 0]);
    s = nextTurn(nextTurn(nextTurn(nextTurn(s))));
    expect([s.round, s.turn]).toEqual([2, 0]);
    s = previousTurn(s);
    expect([s.round, s.turn]).toEqual([1, 3]);
  });

  it('skips defeated monsters but not characters at 0 HP', () => {
    let s = startCombat(rolled());
    s = updateCombatant(s, 'c2', { hp: 0 });
    s = updateCombatant(s, 'c3', { hp: 0 });
    s = nextTurn(s);
    expect(current(s)).toBe('Ana');
    expect(downState(s.combatants[1])).toBe('dead');
    expect(downState(s.combatants[2])).toBe('unconscious');
    s = previousTurn(s);
    expect(current(s)).toBe('Goblin Warrior1');
  });

  it('removing a combatant keeps the turn on the right one', () => {
    let s = nextTurn(nextTurn(startCombat(rolled()))); // Ana's turn
    s = removeCombatant(s, 'c1');
    expect(current(s)).toBe('Ana');
    s = removeCombatant(s, 'c3');
    expect(current(s)).toBe('Bo');
    s = removeCombatant(s, 'c4');
    expect(current(s)).toBe('Goblin Warrior2');
  });
});

describe('condition durations', () => {
  it('counts down at the start of the combatant turn and ends at 0', () => {
    let s = startCombat(rolled()); // Goblin 1's turn
    const ana = s.combatants[2].id;
    let a = toggleCombatCondition(s.combatants[2], 'frightened');
    a = toggleCombatCondition(a, 'prone');
    a = setConditionRounds(a, 'frightened', 2);
    s = updateCombatant(s, ana, { conditions: a.conditions });
    s = nextTurn(s); // Goblin 2
    expect(s.combatants[2].conditions).toHaveLength(2);
    s = nextTurn(s); // Ana: 2 → 1
    expect(s.combatants[2].conditions).toEqual([
      { id: 'frightened', rounds: 1 },
      { id: 'prone', rounds: null },
    ]);
    s = nextTurn(nextTurn(nextTurn(s))); // Bo, Goblin 1, Goblin 2
    expect(s.combatants[2].conditions).toHaveLength(2);
    s = nextTurn(s); // Ana again: ends
    expect(s.combatants[2].conditions).toEqual([{ id: 'prone', rounds: null }]);
    // going back undoes that countdown
    s = previousTurn(s);
    expect(s.combatants[2].conditions).toEqual([
      { id: 'frightened', rounds: 1 },
      { id: 'prone', rounds: null },
    ]);
  });

  it('toggles off and treats empty or invalid durations as "until removed"', () => {
    let c = addCombatant(emptyCombat(), { kind: 'custom', name: 'X' }).combatants[0];
    c = toggleCombatCondition(c, 'poisoned');
    expect(setConditionRounds(c, 'poisoned', 0).conditions[0].rounds).toBeNull();
    expect(setConditionRounds(c, 'poisoned', 3.7).conditions[0].rounds).toBe(3);
    expect(toggleCombatCondition(c, 'poisoned').conditions).toEqual([]);
    expect(tickConditions([{ id: 'prone', rounds: 1 }])).toEqual([]);
  });
});

describe('hit points', () => {
  const ogre = () =>
    addCombatant(emptyCombat(), { kind: 'custom', name: 'O', hpMax: 30, temp: 5 }).combatants[0];

  it('temporary HP absorb damage first; HP stop at 0', () => {
    let c = applyDamage(ogre(), 8);
    expect([c.hp, c.temp]).toEqual([27, 0]);
    c = applyDamage(c, 100);
    expect(c.hp).toBe(0);
    expect(applyDamage(c, -3)).toBe(c);
  });

  it('heals up to the maximum, from 0 too', () => {
    let c = applyDamage(ogre(), 40);
    c = applyHealing(c, 4);
    expect(c.hp).toBe(4);
    expect(applyHealing(c, 100).hp).toBe(30);
  });

  it('new temporary HP replace the old ones', () => {
    expect(setTemp(ogre(), 3).temp).toBe(3);
    expect(setTemp(ogre(), -1).temp).toBe(0);
  });

  it('leaves untracked HP alone', () => {
    const c = addCombatant(emptyCombat(), { kind: 'custom', name: 'P' }).combatants[0];
    expect(applyDamage(c, 5).hp).toBeNull();
    expect(applyHealing(c, 5)).toBe(c);
  });

  it('Concentration DC: half the damage, 10 to 30', () => {
    expect([concentrationDc(5), concentrationDc(25), concentrationDc(100)]).toEqual([10, 12, 30]);
  });
});

describe('totals and saving', () => {
  it('adds up the XP of defeated monsters, removed ones included', () => {
    let s = addMonsters(addMonsters(emptyCombat(), goblin, 3), bugbear, 1);
    s = updateCombatant(s, 'c1', { hp: 0 });
    s = updateCombatant(s, 'c4', { hp: 0 });
    expect(defeatedXp(s)).toBe(250);
    s = removeCombatant(s, 'c1');
    s = removeCombatant(s, 'c2');
    expect(defeatedXp(s)).toBe(250);
  });

  it('reads back a saved state and rejects junk', () => {
    const s = startCombat(party());
    expect(normalizeCombat(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(normalizeCombat({ combatants: [{ id: 'x', kind: 'custom', name: 'A' }] })).toMatchObject(
      { round: 0, combatants: [{ conditions: [], temp: 0 }] },
    );
    expect(normalizeCombat('nope')).toBeUndefined();
  });
});
