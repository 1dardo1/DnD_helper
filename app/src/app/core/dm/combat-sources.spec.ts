import { Monster } from '../models/compendium';
import { emptyCombat } from './combat';
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

describe('addEncounter', () => {
  it('adds the party (known characters with their numbers) and the monsters', () => {
    const s = addEncounter(
      emptyCombat(),
      {
        id: 'e1',
        name: 'Ambush',
        party: [{ level: 3, characterId: 'ana' }, { level: 3, name: 'Bo' }, { level: 3 }],
        monsters: [
          { monsterId: 'goblin-warrior', count: 2 },
          { monsterId: 'unknown', count: 1 },
        ],
        notes: '',
      },
      new Map([['goblin-warrior', goblin]]),
      new Map([['ana', { kind: 'character' as const, name: 'Ana', ac: 16, hpMax: 20 }]]),
      'Player',
    );
    expect(s.combatants.map((c) => [c.kind, c.name, c.number, c.ac])).toEqual([
      ['character', 'Ana', null, 16],
      ['custom', 'Bo', null, null],
      ['custom', 'Player 3', null, null],
      ['monster', 'Goblin Warrior', 1, 15],
      ['monster', 'Goblin Warrior', 2, 15],
    ]);
    expect([s.encounterId, s.encounterName]).toEqual(['e1', 'Ambush']);
  });
});
