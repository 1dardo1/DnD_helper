import rawItems from '../../../../../data/items.json';
import { newCharacter } from '../models/character';
import { Item } from '../models/compendium';
import { computeSheet, RulesData } from '../rules/engine';
import { attacksFor } from '../rules/attacks';
import { addItem, setGear, toggleEquip, wearArmor } from './inventory';
import {
  armorSlot,
  armorStats,
  baseCandidates,
  bonusOptions,
  fixedBonus,
  gearChoices,
  gearKind,
  gearOf,
  magicBonus,
  wornGear,
} from './magic-base';

const all = rawItems as unknown as Item[];
const items = new Map(all.map((i) => [i.id, i]));
const get = (id: string) => items.get(id)!;
const ids = (list: Item[]) => list.map((i) => i.id);

describe('magic bases (data audit)', () => {
  const magic = all.filter((i) => gearKind(i));

  it('finds the generic weapons, armor and shields of the data', () => {
    expect(magic.length).toBeGreaterThan(250);
    for (const id of ['weapon-1-2-or-3', 'armor-1-2-or-3', 'shield-1-2-or-3', 'snipers-bracelet'])
      expect(gearKind(get(id))).not.toBeNull();
    expect(gearKind(get('ammunition-1-2-or-3'))).toBe('ammunition');
    expect(gearKind(get('longsword'))).toBeNull();
    expect(gearKind(get('bag-of-holding'))).toBeNull();
  });

  it('gives every one of them something to choose from, of the right kind', () => {
    for (const item of magic) {
      const c = baseCandidates(item, all);
      expect(c.length, item.id).toBeGreaterThan(0);
      for (const b of c) {
        const kind = gearKind(item)!;
        if (kind === 'weapon') expect(b.weapon?.damage.length, item.id).toBeGreaterThan(0);
        if (kind === 'armor')
          expect(b.armor && b.armor.kind !== 'shield', `${item.id} ${b.id}`).toBe(true);
        if (kind === 'shield') expect(b.armor?.kind, item.id).toBe('shield');
        expect(b.edition, item.id).not.toBe('2014');
        expect(b.magic, item.id).toBeFalsy();
      }
    }
  });

  it('knows the base of the magic items that name one', () => {
    expect(ids(baseCandidates(get('vorpal-sword'), all))).toEqual([
      'glaive',
      'greatsword',
      'longsword',
      'scimitar',
    ]);
    expect(ids(baseCandidates(get('armor-of-invulnerability'), all))).toEqual(['plate-armor']);
    expect(ids(baseCandidates(get('elven-chain'), all))).toEqual(['chain-mail', 'chain-shirt']);
    expect(ids(baseCandidates(get('shield-1-2-or-3'), all))).toEqual(['shield']);
    expect(ids(baseCandidates(get('mace-of-smiting'), all))).toEqual(['mace']);
    expect(ids(baseCandidates(get('dragontooth-dagger'), all))).toEqual(['dagger']);
  });

  it('filters armor by weight and exclusions', () => {
    const kinds = (id: string) => new Set(baseCandidates(get(id), all).map((b) => b.armor!.kind));
    expect(kinds('armor-1-2-or-3')).toEqual(new Set(['light', 'medium', 'heavy']));
    expect(kinds('armor-of-safeguarding')).toEqual(new Set(['heavy']));
    const mithral = ids(baseCandidates(get('mithral-armor'), all));
    expect(mithral).toContain('chain-mail');
    expect(mithral).not.toContain('hide-armor');
    expect(mithral).not.toContain('leather-armor');
  });

  it('filters weapons by what the text asks for', () => {
    const w = (id: string) => baseCandidates(get(id), all);
    const any = w('weapon-1-2-or-3');
    expect(any.length).toBeGreaterThan(30);
    expect(ids(any)).toContain('longsword');
    expect(ids(any)).toContain('longbow');
    expect(w('trick-weapon').every((b) => !b.weapon!.ranged)).toBe(true);
    expect(
      w('returning-weapon').every((b) => b.weapon!.properties.some((p) => /^thrown/i.test(p))),
    ).toBe(true);
    expect(ids(w('snipers-bracelet')).sort()).toEqual(
      ['heavy-crossbow', 'light-crossbow', 'longbow', 'musket', 'pistol', 'shortbow'].sort(),
    );
    const ammo = baseCandidates(get('ammunition-1-2-or-3'), all);
    expect(ids(ammo)).toContain('arrows');
    expect(ammo.every((b) => !b.weapon!.damage.length)).toBe(true);
  });

  it('asks only when there is something to choose', () => {
    expect(gearChoices(get('vorpal-sword'), all)?.bases.length).toBe(4);
    expect(gearChoices(get('mace-of-smiting'), all)).toBeNull();
    expect(gearChoices(get('shield-1-2-or-3'), all)?.bonuses.map((o) => o.bonus)).toEqual([
      1, 2, 3,
    ]);
    expect(gearChoices(get('longsword'), all)).toBeNull();
  });

  it('reads the bonus of each item', () => {
    expect(bonusOptions(get('weapon-1-2-or-3')).map((o) => [o.bonus, o.rarity])).toEqual([
      [1, 'uncommon'],
      [2, 'rare'],
      [3, 'very rare'],
    ]);
    expect(bonusOptions(get('armor-1-2-or-3')).map((o) => o.bonus)).toEqual([1, 2, 3]);
    expect(magicBonus(get('weapon-1-2-or-3'), { bonus: 2 })).toBe(2);
    expect(magicBonus(get('weapon-1-2-or-3'), {})).toBe(1);
    expect(fixedBonus(get('vorpal-sword'))).toBe(3);
    expect(fixedBonus(get('dagger-of-venom'))).toBe(1);
    expect(fixedBonus(get('dwarven-plate'))).toBe(2);
    expect(fixedBonus(get('efreeti-chain'))).toBe(3);
    expect(fixedBonus(get('elven-chain'))).toBe(1);
    expect(fixedBonus(get('shield-of-the-cavalier'))).toBe(2);
    // conditional bonuses are not counted
    expect(fixedBonus(get('arrow-catching-shield'))).toBe(0);
    expect(fixedBonus(get('pariahs-shield'))).toBe(0);
    expect(fixedBonus(get('fedifensor'))).toBe(0);
    expect(fixedBonus(get('armor-of-resistance'))).toBe(0);
  });

  it('removes the Strength requirement and stealth penalty of mithral armor', () => {
    const plate = gearOf({ baseId: 'plate-armor' }, get('mithral-armor'), items)!;
    expect(armorStats(plate)).toMatchObject({
      baseAC: 18,
      strength: null,
      stealthDisadvantage: false,
    });
    const plain = gearOf({ baseId: 'plate-armor' }, get('armor-of-resistance'), items)!;
    expect(armorStats(plain)).toMatchObject({ strength: 15, stealthDisadvantage: true });
  });
});

describe('magic gear in the inventory', () => {
  const rules = (): RulesData => ({
    classes: new Map(),
    subclasses: new Map(),
    species: new Map(),
    backgrounds: new Map(),
    feats: new Map(),
    items,
  });
  const base = () => newCharacter('A', 'x');

  it('is its own entry for each base and bonus', () => {
    let c = addItem(base(), get('armor-1-2-or-3'), '', { baseId: 'chain-mail', bonus: 1 });
    c = addItem(c, get('armor-1-2-or-3'), '', { baseId: 'chain-mail', bonus: 1 });
    c = addItem(c, get('armor-1-2-or-3'), '', { baseId: 'breastplate', bonus: 2 });
    expect(c.inventory.map((e) => [e.id, e.baseId, e.bonus, e.qty])).toEqual([
      ['armor-1-2-or-3', 'chain-mail', 1, 2],
      ['armor-1-2-or-3-2', 'breastplate', 2, 1],
    ]);
    expect(setGear(c, 'armor-1-2-or-3', { baseId: 'plate-armor' }).inventory[0]).toMatchObject({
      baseId: 'plate-armor',
      bonus: 1,
    });
  });

  it('works out the armor class from the base armor plus the bonus', () => {
    let c = addItem(base(), get('armor-1-2-or-3'), '', { baseId: 'chain-mail', bonus: 2 });
    c = toggleEquip(c, 'armor-1-2-or-3', items);
    expect(c.equipped.armorId).toBe('armor-1-2-or-3');
    expect(armorSlot(get('armor-1-2-or-3'))).toBe('armor');
    expect(wornGear(c, items)).toMatchObject({ armorBonus: 2, shield: 0 });
    const sheet = computeSheet(c, rules());
    expect(sheet.armorClass.value).toBe(18);
    expect(sheet.armorClass.formula).toBe('16 + 2');
    // another base through the same entry
    const leather = setGear(c, 'armor-1-2-or-3', { baseId: 'studded-leather-armor' });
    expect(computeSheet(leather, rules()).armorClass.formula).toBe('12 + DEX + 2');
  });

  it('takes the only base there is (Armor of Invulnerability) and the item bonus (Dwarven Plate)', () => {
    let c = addItem(base(), get('armor-of-invulnerability'));
    c = toggleEquip(c, 'armor-of-invulnerability', items);
    expect(computeSheet(c, rules()).armorClass.value).toBe(18);
    c = addItem(base(), get('dwarven-plate'), '', { baseId: 'plate-armor' });
    c = toggleEquip(c, 'dwarven-plate', items);
    expect(computeSheet(c, rules()).armorClass.value).toBe(18 + 2);
  });

  it('asks for a base when several fit: no AC yet, and says so', () => {
    let c = addItem(base(), get('armor-of-resistance'));
    c = toggleEquip(c, 'armor-of-resistance', items);
    const sheet = computeSheet(c, rules());
    expect(sheet.armorClass.formula).toBe('10 + DEX');
    expect(sheet.warnings).toEqual([
      { key: 'sheet.warn.armorBase', params: { name: 'Armor of Resistance' } },
    ]);
  });

  it('a magic shield adds 2 plus its bonus, with any armor', () => {
    let c = addItem(base(), get('shield-1-2-or-3'), '', { bonus: 2 });
    c = addItem(c, get('leather-armor'));
    c = toggleEquip(c, 'shield-1-2-or-3', items);
    c = toggleEquip(c, 'leather-armor', items);
    const sheet = computeSheet(c, rules());
    expect(sheet.armorClass.value).toBe(11 + 4);
    expect(sheet.armorClass.formula).toBe('11 + DEX + 2 + shield');
  });

  it('wears one of two magic armors of the same item by entry id', () => {
    let c = addItem(base(), get('armor-1-2-or-3'), '', { baseId: 'chain-mail', bonus: 1 });
    c = addItem(c, get('armor-1-2-or-3'), '', { baseId: 'plate-armor', bonus: 1 });
    c = wearArmor(c, 'armor-1-2-or-3-2', items);
    expect(c.inventory.map((e) => e.equipped)).toEqual([false, true]);
    expect(computeSheet(c, rules()).armorClass.value).toBe(19);
  });

  it('makes a magic weapon attack as its base with the bonus', () => {
    const sheet = computeSheet(base(), rules());
    const gear = gearOf({ baseId: 'longsword', bonus: 2 }, get('weapon-1-2-or-3'), items)!;
    expect(gear).toMatchObject({ kind: 'weapon', bonus: 2, unresolved: false });
    const [a] = attacksFor(sheet, [
      { id: 'w', equipped: true, item: gear.base!, magic: { item: gear.item, bonus: gear.bonus } },
    ]);
    expect(a).toMatchObject({
      name: 'Weapon, +1, +2 or +3',
      base: 'Longsword',
      damage: '1d8+2',
      magic: 2,
      mastery: 'Sap',
    });
    expect(a.versatile).toBe('1d10+2');
  });

  it('keeps an unknown or wrong base from counting', () => {
    expect(gearOf({ baseId: 'chain-mail' }, get('weapon-1-2-or-3'), items)!.unresolved).toBe(true);
    expect(gearOf({ baseId: 'gone' }, get('armor-of-resistance'), items)!.base).toBeNull();
  });
});
