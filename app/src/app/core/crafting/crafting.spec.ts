import { Item } from '../models/compendium';
import {
  castsSpells,
  coinsFromCp,
  costInCp,
  craftRarity,
  isCraftable,
  magicCraft,
  magicTools,
  mundaneCraft,
  sharedDays,
} from './crafting';

describe('crafting', () => {
  it('mundane: materials are half the price, 1 day per 10 gp (rounded up)', () => {
    // the rule's examples: Plate Armor 1,500 gp -> 750 gp; Heavy Crossbow 50 gp -> 5 days
    const plate = mundaneCraft(150000);
    expect(plate.materialsCp).toBe(75000);
    expect(plate.days).toBe(150);
    expect(mundaneCraft(5000).days).toBe(5);
    expect(mundaneCraft(1500).days).toBe(2);
    expect(mundaneCraft(5).days).toBe(1);
    expect(mundaneCraft(5).materialsCp).toBe(2);
  });

  it('assistants divide the time', () => {
    expect(sharedDays(10, 2)).toBe(5);
    expect(sharedDays(5, 2)).toBe(2.5);
    expect(sharedDays(5, 0)).toBe(5);
  });

  it('converts costs to copper and back', () => {
    expect(costInCp({ cost: { amount: 15, unit: 'sp' } })).toBe(150);
    expect(costInCp({ cost: { amount: 2, unit: 'gp' } })).toBe(200);
    expect(costInCp({ cost: null })).toBeNull();
    expect(coinsFromCp(1275)).toEqual({ gp: 12, sp: 7, cp: 5 });
  });

  it('magic items: table by rarity, halved when consumable', () => {
    expect(magicCraft('rare', false)).toEqual({ days: 50, gp: 2000 });
    expect(magicCraft('uncommon', true)).toEqual({ days: 5, gp: 100 });
    expect(magicCraft('legendary', false)).toEqual({ days: 250, gp: 100000 });
    expect(craftRarity('Very Rare')).toBe('very rare');
    expect(craftRarity('artifact')).toBeNull();
    expect(craftRarity('varies')).toBeNull();
  });

  it('magic item tools by category', () => {
    expect(magicTools('ring')).toEqual(['jewelers-tools']);
    expect(magicTools('Wondrous Item')).toEqual(['tinkers-tools']);
    expect(magicTools('potion')).toEqual(['alchemists-supplies', 'herbalism-kit']);
    expect(magicTools('unknown')).toEqual([]);
  });

  it('spots items that cast spells and what can be crafted', () => {
    expect(castsSpells({ description: 'you can cast Fireball from it.' })).toBe(true);
    expect(castsSpells({ description: 'A +1 bonus to attack rolls.' })).toBe(false);
    const mount = { category: 'mount', cost: { amount: 1, unit: 'gp' } } as Item;
    const rope = { category: 'gear', cost: { amount: 1, unit: 'gp' } } as Item;
    const free = { category: 'gear', cost: null } as Item;
    expect([isCraftable(mount), isCraftable(rope), isCraftable(free)]).toEqual([
      false,
      true,
      false,
    ]);
  });
});
