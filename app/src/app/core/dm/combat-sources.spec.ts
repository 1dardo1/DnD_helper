import monstersData from '../../../../../data/monsters.json';
import spellsData from '../../../../../data/spells.json';
import { cannonHpMax, cannonMonster } from '../artificer/cannon';
import { proficiencyBonus } from '../rules/tables';
import { Monster, Spell } from '../models/compendium';
import { SummonCatalog, buildCatalog } from '../summons/catalog';
import { addAlly, emptyCombat, setPlayerName } from './combat';
import {
  CANNON_MONSTER_ID,
  addEncounter,
  cannonOf,
  casterContext,
  isCannon,
  summonMonster,
} from './combat-sources';

const catalog: SummonCatalog = buildCatalog(
  spellsData as unknown as Spell[],
  monstersData as unknown as Monster[],
);

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

describe('summons as allies (real data)', () => {
  // the caster: a level 5 caster (PB 3) with spellcasting modifier +3
  const caster = { level: 5, spellMod: 3 };
  const warrior = catalog.spells.get('summon-warrior-spirit-ua')!;
  const option = (name: string) => warrior.options.find((o) => o.name.includes(name))!;

  it('works out the caster numbers: PB from the level, spell attack and save DC from the modifier', () => {
    expect(casterContext(3, caster)).toMatchObject({
      slotLevel: 3,
      pb: 3,
      spellAttack: 6,
      spellDc: 14,
      spellMod: 3,
      totalLevel: 5,
    });
  });

  it('a summon added at a slot level has the hit points and AC its stat block gives there', () => {
    // Warrior Spirit (data): AC 13 + spell level (+2 Fighter only); HP 30 (Barbarian and
    // Fighter) or 20 (Monk) + 10 for each spell level above 3rd.
    const barbarian = summonMonster(warrior, option('Barbarian'), catalog, 5, caster)!;
    let s = addAlly(emptyCombat(0), barbarian, 'Lía');
    expect(s.monsters[0]).toMatchObject({ hpMax: 50, hp: 50, ac: 18, owner: 'Lía', ally: true });

    const barbarianLow = summonMonster(warrior, option('Barbarian'), catalog, 3, caster)!;
    expect([barbarianLow.hp, barbarianLow.ac]).toEqual([30, 16]);

    const fighter = summonMonster(warrior, option('Fighter'), catalog, 3, caster)!;
    expect([fighter.hp, fighter.ac]).toEqual([30, 18]);

    s = addAlly(s, summonMonster(warrior, option('Monk'), catalog, 3, caster)!);
    expect(s.monsters[1]).toMatchObject({ hpMax: 20, hp: 20, ac: 16, ally: true });
    expect(s.monsters[1].owner).toBeUndefined();
  });

  it('an option that is not in the catalog gives no creature', () => {
    expect(
      summonMonster(
        warrior,
        { ...option('Monk'), kind: 'monster', monsterId: 'nope' },
        catalog,
        3,
        caster,
      ),
    ).toBeNull();
  });
});

describe('the Eldritch Cannon as an ally', () => {
  it('at Artificer level 9 has the hit points and AC of cannon.ts, and its explosive damage', () => {
    const s = addAlly(emptyCombat(0), cannonOf(9, 3), '');
    const cannon = s.monsters[0];
    expect(cannon).toMatchObject({
      monsterId: CANNON_MONSTER_ID,
      ac: 18,
      hpMax: 45,
      hp: 45,
      ally: true,
    });
    expect(cannon.hpMax).toBe(cannonHpMax(9));
    expect(isCannon(cannon)).toBe(true);
    // cannon.ts with the Artificer's save DC: 8 + PB 4 + Intelligence 3 = 15
    expect(cannon.statBlock).toEqual(cannonMonster({ size: 'Small', aspect: 'legs' }, 9, 15, 3));
    const flame = cannon.statBlock!.actions.find((a) => a.name === 'Flamethrower')!;
    expect(flame.description).toContain('DC 15');
    expect(flame.description).toContain('13 (3d8)');
    expect(cannon.statBlock!.reactions.map((r) => r.name)).toEqual(['Detonate']);
  });

  it('below level 9 the damage has no extra die and there is no Detonate', () => {
    const cannon = cannonOf(5, 3);
    expect(cannon.hp).toBe(25);
    const flame = cannon.actions.find((a) => a.name === 'Flamethrower')!;
    expect(flame.description).toContain('9 (2d8)');
    expect(cannon.reactions).toEqual([]);
  });
});
