import { newCharacter } from '../models/character';
import { Item } from '../models/compendium';
import {
  applyStartingEquipment,
  coinsFromCp,
  goldOnlyPackage,
  shopCatalog,
  itemIndex,
  parseStartingEquipment,
  shopPriceCp,
} from './starting-equipment';

const item = (id: string, name: string, extra: Partial<Item> = {}): Item =>
  ({
    id,
    type: 'item',
    name,
    edition: '2024',
    category: 'gear',
    cost: null,
    weight: null,
    ...extra,
  }) as unknown as Item;

const all = [
  item('chain-mail', 'Chain Mail', {
    category: 'armor',
    armor: { kind: 'heavy', baseAC: 16, dexCap: 0, strength: 13, stealthDisadvantage: true },
  }),
  item('shield', 'Shield', {
    category: 'shield',
    armor: { kind: 'shield', baseAC: 2, dexCap: null, strength: null, stealthDisadvantage: false },
  }),
  item('javelin', 'Javelin', { cost: { amount: 5, unit: 'sp' } }),
  item('javelin-of-lightning', 'Javelin of Lightning', {
    magic: {
      rarity: 'uncommon',
      type: 'weapon',
      subtype: null,
      attunement: false,
      attunementBy: null,
    },
  }),
  item('dungeoneers-pack', "Dungeoneer's Pack", { cost: { amount: 12, unit: 'gp' } }),
  item('oil', 'Oil'),
  item('pouch', 'Pouch'),
  item('dice-set', 'Dice Set'),
  item('potion-of-healing', 'Potion of Healing', {
    magic: {
      rarity: 'common',
      type: 'potion',
      subtype: null,
      attunement: false,
      attunementBy: null,
    },
  }),
];
const byId = new Map(all.map((i) => [i.id, i]));
const index = itemIndex(all);

describe('starting equipment', () => {
  const fighter =
    "Choose A, B, or C: (A) Chain Mail, Shield, 8 Javelins, Dungeoneer's Pack and 4 GP; (B) Oil (3 flasks), 2 Pouches, Gaming Set (same as above), 11 GP; or (C) 155 GP";

  it('reads the packages, quantities and gold', () => {
    const p = parseStartingEquipment(fighter, index)!;
    expect(p.map((x) => [x.letter, x.gold])).toEqual([
      ['A', 4],
      ['B', 11],
      ['C', 155],
    ]);
    expect(p[0].lines.map((l) => [l.itemId, l.qty])).toEqual([
      ['chain-mail', 1],
      ['shield', 1],
      ['javelin', 8],
      ['dungeoneers-pack', 1],
    ]);
    expect(p[1].lines.map((l) => [l.itemId, l.qty, l.chosenTool])).toEqual([
      ['oil', 3, false],
      ['pouch', 2, false],
      [null, 1, true],
    ]);
    expect(parseStartingEquipment('- (a) a martial weapon or (b) two simple weapons', index)).toBe(
      null,
    );
  });

  it('prices magic items by rarity, consumables at half', () => {
    expect(shopPriceCp(byId.get('javelin')!)).toBe(50);
    expect(shopPriceCp(byId.get('javelin-of-lightning')!)).toBe(40000);
    expect(shopPriceCp(byId.get('potion-of-healing')!)).toBe(5000);
    expect(shopPriceCp(byId.get('oil')!)).toBe(null);
    expect(coinsFromCp(1234)).toEqual({ pp: 0, gp: 12, ep: 0, sp: 3, cp: 4 });
  });

  it('fills the inventory, wears armor and shield, keeps hand-added items and counts gold', () => {
    const packages = { class: parseStartingEquipment(fighter, index), background: null };
    let ch = newCharacter('x', '');
    ch = {
      ...ch,
      inventory: [{ id: 'rope', itemId: null, name: 'Rope', qty: 1, equipped: false }],
    };
    const tools = { class: ['Dice Set'], background: [] };
    const a = applyStartingEquipment(
      ch,
      { class: 'A', background: null, bought: [{ itemId: 'javelin', qty: 2 }] },
      packages,
      byId,
      tools,
      index,
    );
    expect(a.inventory.map((e) => [e.id, e.qty, e.equipped])).toEqual([
      ['rope', 1, false],
      ['chain-mail', 1, true],
      ['shield', 1, true],
      ['javelin', 10, false],
      ['dungeoneers-pack', 1, false],
    ]);
    expect(a.equipped).toEqual({ armorId: 'chain-mail', shield: true });
    expect(a.money).toEqual({ pp: 0, gp: 3, ep: 0, sp: 0, cp: 0 });

    const b = applyStartingEquipment(
      a,
      { class: 'B', background: null, bought: [] },
      packages,
      byId,
      tools,
      index,
    );
    expect(b.inventory.map((e) => [e.id, e.qty])).toEqual([
      ['rope', 1],
      ['oil', 3],
      ['pouch', 2],
      ['dice-set', 1],
    ]);
    expect(b.equipped).toEqual({ armorId: null, shield: false });
    expect(b.money?.gp).toBe(11);
  });

  it('finds the gold-only package and sells each item once (2024 over 2014)', () => {
    const p = parseStartingEquipment(fighter, index)!;
    expect(goldOnlyPackage(p)?.letter).toBe('C');
    expect(goldOnlyPackage(null)).toBe(null);
    const old = item('potion-of-healing-common', 'Potion of Healing (common)', {
      edition: '2014',
      cost: { amount: 50, unit: 'gp' },
    });
    const abacus = item('abacus', 'Abacus', { edition: '2014', cost: { amount: 2, unit: 'gp' } });
    const ids = shopCatalog([...all, old, abacus]).map((i) => i.id);
    expect(ids).toContain('potion-of-healing');
    expect(ids).toContain('abacus');
    expect(ids).not.toContain('potion-of-healing-common');
    expect(ids).not.toContain('oil');
  });
});
