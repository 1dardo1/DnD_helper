import { newCharacter, normalizeCharacter } from '../models/character';
import { Item } from '../models/compendium';
import { addItem, removeEntry, setQty, toggleEquip, wearArmor, wearShield } from './inventory';

const item = (id: string, extra: Partial<Item>) => ({ id, name: id, ...extra }) as Item;
const chain = item('chain-mail', { armor: { kind: 'heavy', baseAC: 16 } as Item['armor'] });
const leather = item('leather-armor', { armor: { kind: 'light', baseAC: 11 } as Item['armor'] });
const shield = item('shield', { armor: { kind: 'shield', baseAC: 2 } as Item['armor'] });
const sword = item('longsword', { weapon: {} as Item['weapon'] });
const items = new Map([chain, leather, shield, sword].map((i) => [i.id, i]));

describe('inventory', () => {
  it('adds compendium items (stacking) and hand-written ones', () => {
    let c = addItem(newCharacter('A', 'x'), sword);
    c = addItem(c, sword);
    c = addItem(c, null, 'Cuerda de cáñamo');
    expect(c.inventory.map((e) => [e.id, e.itemId, e.qty])).toEqual([
      ['longsword', 'longsword', 2],
      ['cuerda-de-canamo', null, 1],
    ]);
    expect(setQty(c, 'longsword', 0).inventory[0].qty).toBe(1);
  });

  it('wears one armor and one shield, and keeps equipped in step', () => {
    let c = [chain, leather, shield].reduce((ch, i) => addItem(ch, i), newCharacter('A', 'x'));
    c = toggleEquip(c, 'chain-mail', items);
    c = toggleEquip(c, 'shield', items);
    expect(c.equipped).toEqual({ armorId: 'chain-mail', shield: true });
    c = toggleEquip(c, 'leather-armor', items);
    expect(c.equipped.armorId).toBe('leather-armor');
    expect(c.inventory.find((e) => e.id === 'chain-mail')!.equipped).toBe(false);
    c = removeEntry(c, 'shield', items);
    expect(c.equipped.shield).toBe(false);
  });

  it('keeps the wizard armor and shield pickers and the inventory in step', () => {
    let c = [chain, leather, shield].reduce((ch, i) => addItem(ch, i), newCharacter('A', 'x'));
    c = wearArmor(c, 'chain-mail', items);
    c = wearShield(c, true, items);
    expect(c.equipped).toEqual({ armorId: 'chain-mail', shield: true });
    c = wearArmor(c, 'leather-armor', items);
    expect(c.inventory.map((e) => [e.itemId, e.equipped])).toEqual([
      ['chain-mail', false],
      ['leather-armor', true],
      ['shield', true],
    ]);
    c = wearArmor(c, null, items);
    c = wearShield(c, false, items);
    expect(c.equipped).toEqual({ armorId: null, shield: false });
    expect(c.inventory.every((e) => !e.equipped)).toBe(true);
  });

  it('only wears armor and shields the character carries', () => {
    const bare = addItem(newCharacter('A', 'x'), sword);
    expect(wearArmor(bare, 'chain-mail', items)).toBe(bare);
    const c = wearShield(bare, true, items);
    expect(c.equipped).toEqual({ armorId: null, shield: false });
    expect(c.inventory.map((e) => e.itemId)).toEqual(['longsword']);
  });

  it('gives old characters an inventory with what they wore', () => {
    const old = { ...newCharacter('A', 'x'), equipped: { armorId: 'chain-mail', shield: true } };
    delete (old as Partial<typeof old>).inventory;
    expect(normalizeCharacter(old)!.inventory.map((e) => [e.itemId, e.equipped])).toEqual([
      ['chain-mail', true],
      ['shield', true],
    ]);
  });
});
