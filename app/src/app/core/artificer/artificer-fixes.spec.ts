import { newCharacter, normalizeCharacter } from '../models/character';
import { Item } from '../models/compendium';
import { REAL } from '../rules/real-data.testing';
import { extraPlanOf, planCounts } from './plans';
import { createReplicated, planBonus } from './replicated-state';
import { drainSlotLevel } from './tinker';

const items = REAL.items as Map<string, Item>;
const artificer = REAL.classes.get('artificer')!;

describe('Artificer plans: the bonus, Drain and Armor Replication', () => {
  it('a "Weapon +2" plan makes a +2 weapon', () => {
    expect(planBonus({ name: 'Weapon +2' })).toBe(2);
    expect(planBonus({ name: 'Bag of Holding' })).toBeNull();
    const ch = {
      ...newCharacter('A', 'a'),
      classes: [{ id: 'artificer', level: 10, subclassId: null, hp: [] }],
    };
    const res = createReplicated(
      ch,
      { planId: 'magic-item-plan/weapon-plus-2', itemId: 'weapon-1-2-or-3', name: 'Weapon +2' },
      4,
      items,
    );
    expect(res.character.inventory.at(-1)?.bonus).toBe(2);
  });

  it('one made before the fix gets the bonus of its name when loaded', () => {
    const raw = {
      ...newCharacter('A', 'a'),
      id: 'x',
      inventory: [
        {
          id: 'r',
          itemId: 'weapon-1-2-or-3',
          name: 'Weapon +2',
          qty: 1,
          equipped: false,
          source: 'replicate',
        },
      ],
    };
    expect(normalizeCharacter(raw)?.inventory[0].bonus).toBe(2);
  });

  it('Drain: the rarity of the bonus ("Uncommon (+1), Rare (+2), or Very Rare (+3)")', () => {
    const weapon = items.get('weapon-1-2-or-3');
    expect(drainSlotLevel(weapon, 1)).toBe(2);
    expect(drainSlotLevel(weapon, 2)).toBe(2);
    expect(drainSlotLevel(weapon, 3)).toBeNull();
    // Armor: "Rare(+1), Very Rare (+2)"
    expect(drainSlotLevel(items.get('armor-1-2-or-3'), 1)).toBe(2);
    expect(drainSlotLevel(items.get('armor-1-2-or-3'), 2)).toBeNull();
  });

  it('Armor Replication: one more plan and one more item, of the Armor category, from level 9', () => {
    const armorer = REAL.subclasses.get('artificer/armorer-ua')!;
    expect(extraPlanOf(armorer, 8)).toBeNull();
    expect(extraPlanOf(armorer, 9)).toEqual({ category: 'Armor', item: true });
    const base = planCounts(artificer, 9)!;
    const withSub = planCounts(artificer, 9, armorer)!;
    expect(withSub.known).toBe(base.known + 1);
    expect(withSub.items).toBe(base.items + 1);
  });
});
