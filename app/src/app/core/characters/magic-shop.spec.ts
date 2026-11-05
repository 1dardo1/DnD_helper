import rawItems from '../../../../../data/items.json';
import { newCharacter } from '../models/character';
import { Item } from '../models/compendium';
import { computeSheet } from '../rules/engine';
import {
  applyStartingEquipment,
  itemIndex,
  shopCatalog,
  shopPriceCp,
} from '../rules/starting-equipment';

const all = rawItems as unknown as Item[];
const items = new Map(all.map((i) => [i.id, i]));
const get = (id: string) => items.get(id)!;

describe('magic gear in the starting shop', () => {
  const rich = { ...newCharacter('A', 'x'), money: { cp: 0, sp: 0, ep: 0, gp: 99999, pp: 0 } };

  it('prices "+1, +2 or +3" items by the bonus chosen', () => {
    const armor = get('armor-1-2-or-3');
    expect(shopPriceCp(armor, 1)).toBe(4000 * 100);
    expect(shopPriceCp(armor, 2)).toBe(40000 * 100);
    expect(shopPriceCp(armor, 3)).toBe(200000 * 100);
    expect(shopPriceCp(get('weapon-1-2-or-3'), 3)).toBe(40000 * 100);
    expect(shopPriceCp(get('weapon-1-2-or-3'))).toBe(400 * 100);
  });

  it('sells the generic magic items once', () => {
    const ids = shopCatalog(all).map((i) => i.id);
    expect(ids).toContain('weapon-1-2-or-3');
    expect(ids).toContain('snipers-bracelet');
    expect(ids).not.toContain('shield-1-2-3');
  });

  it('puts the bought base and bonus in the inventory and wears the armor bought', () => {
    const choice = {
      class: null,
      background: null,
      bought: [
        { itemId: 'armor-1-2-or-3', qty: 1, baseId: 'breastplate', bonus: 1 },
        { itemId: 'armor-1-2-or-3', qty: 1, baseId: 'plate-armor', bonus: 2 },
        { itemId: 'weapon-1-2-or-3', qty: 1, baseId: 'longsword', bonus: 3 },
        { itemId: 'shield-1-2-or-3', qty: 1, bonus: 1 },
      ],
    };
    const c = applyStartingEquipment(
      rich,
      choice,
      { class: null, background: null },
      items,
      { class: [], background: [] },
      itemIndex(all),
    );
    expect(c.inventory.map((e) => [e.itemId, e.baseId, e.bonus, e.equipped])).toEqual([
      ['armor-1-2-or-3', 'breastplate', 1, true],
      ['armor-1-2-or-3', 'plate-armor', 2, false],
      ['weapon-1-2-or-3', 'longsword', 3, false],
      ['shield-1-2-or-3', undefined, 1, true],
    ]);
    // breastplate 14 + 1, DEX 10 adds nothing; the shield 2 + 1
    const sheet = computeSheet(c, {
      classes: new Map(),
      subclasses: new Map(),
      species: new Map(),
      backgrounds: new Map(),
      feats: new Map(),
      items,
    });
    expect(sheet.armorClass.value).toBe(14 + 1 + 3);
  });
});
