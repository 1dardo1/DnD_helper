import { applyDamage, applyHealing, toggleUse, usedOf } from '../dm/combat';
import { Monster } from '../models/compendium';
import { REAL_MONSTERS } from '../rules/real-data.testing';
import { summonedBlocks } from '../combat/combat-actions';
import {
  SummonsState,
  creatureOf,
  setSummoned,
  summonedCount,
  updateCreature,
} from './summon-state';

// The combat tab's summoned blocks (features/characters/combat-tab.ts) are these pure functions:
// the block of each creature out (summonedBlocks) and the change a card makes on it (updateCreature).
// Real monsters from data/monsters.json.

const monster = (id: string): Monster => REAL_MONSTERS.find((m) => m.id === id)!;
const KEY = 'spell:find-familiar|imp';

/** The state after the creature is summoned (full HP, nothing spent). */
function summoned(): SummonsState {
  return setSummoned(undefined, KEY, true);
}

function blockOf(s: SummonsState | undefined, id: string) {
  const creature = creatureOf(s, KEY);
  return summonedBlocks([
    { key: KEY, label: monster(id).name, monster: monster(id), state: creature },
  ]);
}

describe('combat tab: the creatures summoned now (real monsters)', () => {
  it('a creature marked on shows its block: its name and its full hit points', () => {
    const imp = monster('imp');
    const [block] = blockOf(summoned(), 'imp');
    expect(block.label).toBe('Imp');
    expect(block.monster.id).toBe('imp');
    expect(block.instance.ac).toBe(imp.ac);
    expect(block.instance.hpMax).toBe(imp.hp);
    expect(block.instance.hp).toBe(imp.hp);
  });

  it('damage and healing on its block change the damage kept in the sheet state', () => {
    const imp = monster('imp');
    let s = summoned();

    s = updateCreature(s, KEY, imp, (m) => applyDamage(m, 4));
    expect(creatureOf(s, KEY).damage).toBe(4);
    expect(blockOf(s, 'imp')[0].instance.hp).toBe(imp.hp - 4);
    expect(creatureOf(s, KEY).on).toBe(true);

    s = updateCreature(s, KEY, imp, (m) => applyHealing(m, 3));
    expect(creatureOf(s, KEY).damage).toBe(1);
    expect(blockOf(s, 'imp')[0].instance.hp).toBe(imp.hp - 1);

    // healing never goes over the maximum
    s = updateCreature(s, KEY, imp, (m) => applyHealing(m, 50));
    expect(creatureOf(s, KEY).damage).toBe(0);
    expect(blockOf(s, 'imp')[0].instance.hp).toBe(imp.hp);
  });

  it('spending a limited use of its block raises the count used', () => {
    const bat = monster('bat');
    const useKey = 'bat-use-test';
    const k = 'spell:find-familiar|bat';
    let s = setSummoned(undefined, k, true);
    s = updateCreature(s, k, bat, (m) => toggleUse(m, useKey, 0, 2));
    expect(creatureOf(s, k).used[useKey]).toBe(1);
    const [block] = summonedBlocks([
      { key: k, label: bat.name, monster: bat, state: creatureOf(s, k) },
    ]);
    expect(usedOf(block.instance, useKey)).toBe(1);
  });

  it('no creature out: no block and no count', () => {
    expect(summonedCount(undefined)).toBe(0);
    expect(summonedBlocks([])).toEqual([]);
    // a creature marked off (or never summoned) is not a block either
    expect(blockOf(setSummoned(summoned(), KEY, false), 'imp')).toEqual([]);
    expect(summonedCount(setSummoned(summoned(), KEY, false))).toBe(0);
  });
});
