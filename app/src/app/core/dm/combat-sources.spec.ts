import { Monster } from '../models/compendium';
import { emptyCombat, setPlayerName } from './combat';
import { addEncounter } from './combat-sources';

const goblin = {
  id: 'goblin-warrior',
  name: 'Goblin Warrior',
  ac: 15,
  hp: 10,
  hitDice: '3d6',
  initiative: 2,
  abilities: { STR: 8, DEX: 15, CON: 10, INT: 10, WIS: 8, CHA: 8 },
  xp: 50,
} as unknown as Monster;

const encounter = {
  id: 'e1',
  name: 'Ambush',
  party: [{ level: 3, characterId: 'ana' }, { level: 3, name: 'Bo' }, { level: 3 }],
  monsters: [
    { monsterId: 'goblin-warrior', count: 2 },
    { monsterId: 'unknown', count: 1 },
  ],
  notes: '',
};

describe('addEncounter', () => {
  it('adds one player per party member (named if known) and the monsters', () => {
    const s = addEncounter(
      emptyCombat(0),
      encounter,
      new Map([['goblin-warrior', goblin]]),
      new Map([['ana', 'Ana']]),
    );
    expect(s.players.map((p) => [p.name, p.initiative])).toEqual([
      ['Ana', null],
      ['Bo', null],
      ['', null],
    ]);
    expect(s.monsters.map((m) => [m.name, m.number, m.ac, m.hp, m.initBonus])).toEqual([
      ['Goblin Warrior', 1, 15, 10, 2],
      ['Goblin Warrior', 2, 15, 10, 2],
    ]);
    expect([s.encounterId, s.encounterName]).toEqual(['e1', 'Ambush']);
  });

  it('added to a combat in progress, keeps its players and only adds the missing ones', () => {
    let s = setPlayerName(emptyCombat(2), 'p1', 'Zoe');
    s = addEncounter(s, encounter, new Map([['goblin-warrior', goblin]]), new Map());
    expect(s.players.map((p) => p.name)).toEqual(['Zoe', '', '']);
    expect(s.monsters.length).toBe(2);
  });
});
