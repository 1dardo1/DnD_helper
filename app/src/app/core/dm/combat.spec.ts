import type { Monster } from '../models/compendium';
import {
  CombatState,
  MonsterInfo,
  addAlly,
  addMonsters,
  applyDamage,
  applyHealing,
  canMove,
  emptyCombat,
  hasCombat,
  initiativeOrder,
  isDefeated,
  monsterGroups,
  moveInOrder,
  normalizeCombat,
  removeLastOf,
  removeMonster,
  resetUse,
  rollMonsterInitiative,
  setHp,
  setInitiative,
  setPlayerCount,
  setPlayerName,
  setTemp,
  toggleUse,
  updateMonster,
  usedOf,
} from './combat';

const goblin: MonsterInfo = {
  id: 'goblin-warrior',
  name: 'Goblin Warrior',
  ac: 15,
  hp: 10,
  initiative: 2,
  dex: 15,
};
const bugbear: MonsterInfo = {
  id: 'bugbear-warrior',
  name: 'Bugbear Warrior',
  ac: 14,
  hp: 33,
  initiative: 2,
  dex: 14,
};
const dragon: MonsterInfo = {
  id: 'adult-red-dragon',
  name: 'Adult Red Dragon',
  ac: 19,
  hp: 256,
  initiative: 12,
  dex: 10,
};

/** Rolls the given values in turn. */
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const ids = (s: CombatState) => initiativeOrder(s).map((e) => e.id);

function table(): CombatState {
  let s = emptyCombat(4);
  s = addMonsters(s, goblin, 3);
  s = addMonsters(s, bugbear, 1);
  s = addMonsters(s, dragon, 1);
  return s;
}

describe('setting up', () => {
  it('starts with four unnamed players and nothing worth keeping', () => {
    const s = emptyCombat();
    expect(s.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(hasCombat(s)).toBe(false);
    expect(hasCombat(setPlayerName(s, 'p2', 'Ana'))).toBe(true);
    expect(hasCombat(addMonsters(s, goblin, 1))).toBe(true);
  });

  it('numbers the monsters of each kind and groups them', () => {
    let s = table();
    expect(s.monsters.map((m) => `${m.monsterId}#${m.number}`)).toEqual([
      'goblin-warrior#1',
      'goblin-warrior#2',
      'goblin-warrior#3',
      'bugbear-warrior#1',
      'adult-red-dragon#1',
    ]);
    expect(s.monsters[0]).toMatchObject({ ac: 15, hp: 10, hpMax: 10, temp: 0, initBonus: 2 });
    s = removeLastOf(s, 'goblin-warrior');
    expect(monsterGroups(s).map((g) => [g.monsterId, g.count])).toEqual([
      ['goblin-warrior', 2],
      ['bugbear-warrior', 1],
      ['adult-red-dragon', 1],
    ]);
    s = addMonsters(s, goblin, 1);
    expect(s.monsters.filter((m) => m.monsterId === 'goblin-warrior').map((m) => m.number)).toEqual(
      [1, 2, 3],
    );
    expect(addMonsters(s, goblin, 0)).toBe(s);
  });

  it('without an initiative bonus in the data, uses the Dexterity modifier', () => {
    const s = addMonsters(emptyCombat(0), { ...goblin, initiative: null, dex: 8 }, 1);
    expect(s.monsters[0].initBonus).toBe(-1);
  });

  it('adds and removes players at the end', () => {
    let s = setPlayerName(emptyCombat(2), 'p2', 'Bo');
    s = setPlayerCount(s, 3);
    expect(s.players.map((p) => [p.id, p.name])).toEqual([
      ['p1', ''],
      ['p2', 'Bo'],
      ['p3', ''],
    ]);
    s = setPlayerCount(s, 1);
    expect(s.players.map((p) => p.id)).toEqual(['p1']);
    expect(setPlayerCount(s, -3).players).toEqual([]);
  });

  it('removing the shown monster clears the selection', () => {
    let s: CombatState = { ...table(), selectedId: 'm5' };
    s = removeMonster(s, 'm5');
    expect(s.selectedId).toBeNull();
    expect(removeMonster(s, 'nope')).toBe(s);
  });
});

describe('initiative', () => {
  it('rolls once per kind of monster by default, d20 + bonus', () => {
    const s = rollMonsterInitiative(table(), rolls(10, 5, 3));
    expect(s.monsters.map((m) => m.initiative)).toEqual([12, 12, 12, 7, 15]);
  });

  it('or once per monster', () => {
    const s = rollMonsterInitiative({ ...table(), perMonster: true }, rolls(1, 2, 3, 4, 5));
    expect(s.monsters.map((m) => m.initiative)).toEqual([3, 4, 5, 6, 17]);
  });

  it('a monster added later joins the roll of its kind', () => {
    let s = rollMonsterInitiative(table(), rolls(10, 5, 3));
    s = addMonsters(s, goblin, 1);
    expect(s.monsters.at(-1)?.initiative).toBe(12);
    s = addMonsters(s, { ...goblin, id: 'goblin-boss' }, 1);
    expect(s.monsters.at(-1)?.initiative).toBeNull();
  });

  it('can roll only for those still without a roll', () => {
    let s = rollMonsterInitiative(table(), rolls(10, 5, 3));
    s = setInitiative(s, 'm8', null);
    s = addMonsters(s, { ...goblin, id: 'goblin-boss' }, 1);
    s = rollMonsterInitiative(s, rolls(1), { missing: true });
    expect(s.monsters.map((m) => m.initiative)).toEqual([12, 12, 12, 3, 15, 3]);
  });

  it('sorts everyone in one column, the unrolled at the end', () => {
    let s = rollMonsterInitiative(table(), rolls(10, 5, 3)); // goblins 12, bugbear 7, dragon 15
    s = setInitiative(s, 'p1', 18);
    s = setInitiative(s, 'p2', 7);
    s = setInitiative(s, 'p3', 3);
    expect(ids(s)).toEqual(['p1', 'm9', 'm5', 'm6', 'm7', 'p2', 'm8', 'p3', 'p4']);
    // a changed value re-sorts
    s = setInitiative(s, 'p3', 20);
    expect(ids(s).slice(0, 2)).toEqual(['p3', 'p1']);
    expect(initiativeOrder(s).at(-1)).toEqual({ kind: 'player', id: 'p4', initiative: null });
  });

  it('ties: players first, then the higher bonus, then Dexterity', () => {
    let s = addMonsters(emptyCombat(1), { ...goblin, initiative: 1, dex: 18 }, 1); // m2
    s = addMonsters(s, { ...bugbear, initiative: 3 }, 1); // m3
    s = addMonsters(s, { ...dragon, id: 'x', initiative: 1, dex: 20 }, 1); // m4
    for (const id of ['p1', 'm2', 'm3', 'm4']) s = setInitiative(s, id, 10);
    expect(ids(s)).toEqual(['p1', 'm3', 'm4', 'm2']);
  });

  it('settles ties by hand, only among equal values', () => {
    let s = emptyCombat(3);
    s = setInitiative(s, 'p1', 15);
    s = setInitiative(s, 'p2', 15);
    s = setInitiative(s, 'p3', 9);
    const order = initiativeOrder(s);
    expect(canMove(order, 'p2', -1)).toBe(true);
    expect(canMove(order, 'p2', 1)).toBe(false);
    expect(canMove(order, 'p1', -1)).toBe(false);
    s = moveInOrder(s, 'p2', -1);
    expect(ids(s)).toEqual(['p2', 'p1', 'p3']);
    expect(moveInOrder(s, 'p3', -1)).toBe(s);
    // a new value for one of them forgets its place
    s = setInitiative(s, 'p2', 4);
    expect(ids(s)).toEqual(['p1', 'p3', 'p2']);
  });

  it('a new roll forgets the ties settled for monsters', () => {
    let s = rollMonsterInitiative(table(), rolls(10, 5, 3));
    s = moveInOrder(s, 'm7', -1);
    expect(
      ids(s)
        .filter((id) => id.startsWith('m'))
        .slice(1, 4),
    ).toEqual(['m5', 'm7', 'm6']);
    s = rollMonsterInitiative(s, rolls(10, 5, 3));
    expect(s.ties).toEqual({});
  });
});

describe('hit points', () => {
  const m = () => table().monsters[4];

  it('temporary HP absorb damage first; HP stop at 0', () => {
    let d = setTemp(m(), 10);
    d = applyDamage(d, 25);
    expect([d.hp, d.temp]).toEqual([241, 0]);
    d = applyDamage(d, 999);
    expect(d.hp).toBe(0);
    expect(isDefeated(d)).toBe(true);
    expect(applyDamage(d, -3)).toBe(d);
  });

  it('heals up to the maximum; temporary HP replace, not add', () => {
    let d = applyDamage(m(), 50);
    d = applyHealing(d, 80);
    expect(d.hp).toBe(256);
    d = setTemp(setTemp(d, 5), 3);
    expect(d.temp).toBe(3);
    expect(setHp(d, 300).hp).toBe(256);
    expect(setHp(d, -2).hp).toBe(0);
    expect(setHp(d, 40).hp).toBe(40);
  });
});

describe('limited uses', () => {
  it('ticks boxes from the left and unticks back', () => {
    let d = table().monsters[4];
    d = toggleUse(d, 'legendary', 0, 3);
    expect(usedOf(d, 'legendary')).toBe(1);
    d = toggleUse(d, 'legendary', 2, 3);
    expect(usedOf(d, 'legendary')).toBe(3);
    d = toggleUse(d, 'legendary', 1, 3);
    expect(usedOf(d, 'legendary')).toBe(1);
    d = toggleUse(d, 'actions:2', 0, 1);
    expect(d.used).toEqual({ legendary: 1, 'actions:2': 1 });
    d = resetUse(d, 'legendary');
    expect(d.used).toEqual({ 'actions:2': 1 });
    expect(resetUse(d, 'legendary')).toBe(d);
  });

  it('keeps the uses of each monster apart', () => {
    let s = table();
    s = updateMonster(s, 'm5', (x) => toggleUse(x, 'actions:0', 0, 1));
    expect(s.monsters.map((x) => usedOf(x, 'actions:0'))).toEqual([1, 0, 0, 0, 0]);
  });
});

describe('saved state', () => {
  it('reads back what was saved and ignores the old tracker', () => {
    const s = rollMonsterInitiative(table(), rolls(4));
    expect(normalizeCombat(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(normalizeCombat({ combatants: [], round: 2 })).toBeUndefined();
    expect(normalizeCombat(null)).toBeUndefined();
  });

  it('a combat saved before allies existed loads without the ally fields', () => {
    const old = JSON.parse(JSON.stringify(table()));
    const loaded = normalizeCombat(old);
    expect(loaded).toEqual(table());
    expect(loaded!.monsters.every((m) => !m.ally && m.owner === undefined)).toBe(true);
  });

  it('keeps an ally with its owner and its stat block', () => {
    const s = addAlly(table(), bat, 'Lía');
    const loaded = normalizeCombat(JSON.parse(JSON.stringify(s)));
    expect(loaded).toEqual(s);
    expect(loaded!.monsters.at(-1)).toMatchObject({ ally: true, owner: 'Lía', statBlock: bat });
  });
});

// -- allies: summoned creatures and the Eldritch Cannon ------------------------------------------

const bat = {
  id: 'bat',
  name: 'Bat',
  ac: 12,
  hp: 1,
  initiative: null,
  abilities: { STR: 2, DEX: 15, CON: 8, INT: 2, WIS: 12, CHA: 6 },
} as unknown as Monster;

describe('allies', () => {
  it('adds an ally with its own stat block, full hit points and no initiative yet', () => {
    const s = addAlly(emptyCombat(0), bat, ' Lía ');
    expect(s.monsters).toHaveLength(1);
    expect(s.monsters[0]).toMatchObject({
      ally: true,
      owner: 'Lía',
      monsterId: 'bat',
      name: 'Bat',
      ac: 12,
      hpMax: 1,
      hp: 1,
      initBonus: 2,
      initiative: null,
      statBlock: bat,
    });
  });

  it('without a name there is no owner', () => {
    expect(addAlly(emptyCombat(0), bat).monsters[0].owner).toBeUndefined();
    expect(addAlly(emptyCombat(0), bat, '  ').monsters[0].owner).toBeUndefined();
  });

  it('stays apart from the monsters of its kind: numbering, groups and removal', () => {
    let s = addMonsters(emptyCombat(0), goblin, 2);
    s = addAlly(s, { ...bat, id: goblin.id, name: goblin.name } as Monster, 'Ana');
    expect(monsterGroups(s).map((g) => [g.monsterId, g.count])).toEqual([['goblin-warrior', 2]]);
    s = removeLastOf(s, 'goblin-warrior');
    expect(s.monsters.filter((m) => m.ally)).toHaveLength(1);
    expect(s.monsters.filter((m) => !m.ally).map((m) => m.number)).toEqual([1]);
    s = addMonsters(s, goblin, 1);
    expect(s.monsters.filter((m) => !m.ally).map((m) => m.number)).toEqual([1, 2]);
  });

  it('rolls its own initiative, not the roll of the monsters of its kind', () => {
    let s = addMonsters(emptyCombat(0), goblin, 2);
    s = addAlly(s, { ...bat, id: goblin.id, name: goblin.name } as Monster, 'Ana');
    s = rollMonsterInitiative(s, rolls(10, 5));
    expect(s.monsters.map((m) => m.initiative)).toEqual([12, 12, 7]);
  });

  it('a new roll for those missing one only gives the ally its own', () => {
    let s = rollMonsterInitiative(addMonsters(emptyCombat(0), goblin, 1), rolls(10));
    s = addAlly(s, bat, 'Lía');
    s = rollMonsterInitiative(s, rolls(3), { missing: true });
    expect(s.monsters.map((m) => m.initiative)).toEqual([12, 5]);
  });

  it('is ordered with the others by its initiative, and can be damaged like a monster', () => {
    let s = rollMonsterInitiative(addMonsters(emptyCombat(0), dragon, 1), rolls(5));
    s = addAlly(s, bat, 'Lía');
    s = rollMonsterInitiative(s, rolls(20), { missing: true });
    const ally = s.monsters.find((m) => m.ally)!;
    expect(ids(s)[0]).toBe(ally.id);
    s = updateMonster(s, ally.id, (m) => applyDamage(m, 1));
    expect(isDefeated(s.monsters.find((m) => m.ally)!)).toBe(true);
  });
});
