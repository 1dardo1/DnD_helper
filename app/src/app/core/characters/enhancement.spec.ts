import rawItems from '../../../../../data/items.json';
import { Character, InventoryEntry, newCharacter } from '../models/character';
import { Item } from '../models/compendium';
import { attacksFor } from '../rules/attacks';
import { Sheet } from '../rules/sheet';
import { applyStartingEquipment } from '../rules/starting-equipment';
import { enhancementHosts, enhancementsByHost, hostOf } from './enhancement';
import { addItem, removeEntry, setGear } from './inventory';
import { baseCandidates, enhancementOf, gearKind } from './magic-base';

const all = rawItems as unknown as Item[];
const items = new Map(all.map((i) => [i.id, i]));
const get = (id: string) => items.get(id)!;
const ch = (): Character => newCharacter('A', 'x');

/** Plain inventory with the given items (the entry id is the item id, as addItem does). */
function carrying(...list: [string, Partial<InventoryEntry>?][]): Character {
  let c = ch();
  for (const [id, extra] of list) {
    c = addItem(c, get(id), '', { baseId: extra?.baseId, bonus: extra?.bonus });
  }
  return c;
}

describe('Repeating Shot as an upgrade of a weapon of the inventory', () => {
  const spec = () => enhancementOf(get('repeating-shot'))!;

  it('is no weapon with a compendium base', () => {
    expect(spec()).toMatchObject({ property: 'ammunition', bonus: 1, rangedOnly: true });
    expect(gearKind(get('repeating-shot'))).toBeNull();
    expect(baseCandidates(get('repeating-shot'), all)).toEqual([]);
    expect(enhancementOf(get('longbow'))).toBeNull();
    expect(enhancementOf(get('snipers-bracelet'))).toBeNull();
  });

  it('lists only the carried weapons with the Ammunition property', () => {
    let c = carrying(['longsword'], ['longbow'], ['dagger']);
    c = addItem(c, get('snipers-bracelet'), '', { baseId: 'light-crossbow' });
    const hosts = enhancementHosts(get('repeating-shot'), c.inventory, items);
    expect(hosts.map((h) => h.entry.id).sort()).toEqual(['longbow', 'snipers-bracelet']);
    // the magic weapon is told by its base
    expect(hosts.find((h) => h.entry.id === 'snipers-bracelet')!.gear.base!.id).toBe(
      'light-crossbow',
    );
  });

  it('has no host in an inventory without ammunition weapons, or with an unresolved base', () => {
    expect(
      enhancementHosts(get('repeating-shot'), carrying(['longsword']).inventory, items),
    ).toEqual([]);
    // Sniper's Bracelet with its base not chosen yet (several fit): not a host
    const c = carrying(['snipers-bracelet']);
    expect(enhancementHosts(get('repeating-shot'), c.inventory, items)).toEqual([]);
  });

  it('stores the link and keeps entries of other hosts apart', () => {
    let c = carrying(['longbow'], ['shortbow']);
    c = addItem(c, get('repeating-shot'), '', { onEntryId: 'longbow' });
    c = addItem(c, get('repeating-shot'), '', { onEntryId: 'shortbow' });
    c = addItem(c, get('repeating-shot'), '', { onEntryId: 'shortbow' });
    const ups = c.inventory.filter((e) => e.itemId === 'repeating-shot');
    expect(ups.map((e) => [e.onEntryId, e.qty])).toEqual([
      ['longbow', 1],
      ['shortbow', 2],
    ]);
    // another host
    c = setGear(c, ups[0].id, { onEntryId: 'shortbow' });
    expect(c.inventory.find((e) => e.id === ups[0].id)!.onEntryId).toBe('shortbow');
  });

  it('breaks when the host is removed, and works again with another', () => {
    let c = carrying(['longbow'], ['shortbow']);
    c = addItem(c, get('repeating-shot'), '', { onEntryId: 'longbow' });
    const up = c.inventory.find((e) => e.itemId === 'repeating-shot')!;
    expect(hostOf(up, c.inventory, items).state).toBe('ok');
    c = removeEntry(c, 'longbow', items);
    const after = c.inventory.find((e) => e.itemId === 'repeating-shot')!;
    expect(hostOf(after, c.inventory, items).state).toBe('broken');
    expect(enhancementsByHost(c.inventory, items).size).toBe(0);
    c = setGear(c, after.id, { onEntryId: 'shortbow' });
    expect(enhancementsByHost(c.inventory, items).get('shortbow')).toHaveLength(1);
  });

  it('is not linked at all until a host is chosen', () => {
    const c = addItem(carrying(['longbow']), get('repeating-shot'));
    const up = c.inventory.find((e) => e.itemId === 'repeating-shot')!;
    expect(hostOf(up, c.inventory, items).state).toBe('none');
  });
});

describe('attacks with an upgrade', () => {
  const sheet = () =>
    ({
      proficiencyBonus: 2,
      abilities: { STR: { modifier: 0 }, DEX: { modifier: 3 } },
      proficiencies: { weapons: ['Simple weapons', 'Martial weapons'] },
    }) as unknown as Sheet;
  const up = {
    item: get('repeating-shot'),
    bonus: 1,
    rangedOnly: true,
    ignoresLoading: true,
    freeAmmo: true,
  };
  const row = (id: string, ups: (typeof up)[], magic?: { item: Item; bonus: number }) =>
    attacksFor(sheet(), [{ id, equipped: true, item: get(id), upgrades: ups, magic }])[0];

  it('adds +1 to the attack and the damage of a bow', () => {
    const plain = row('longbow', []);
    const upgraded = row('longbow', [up]);
    expect(upgraded.bonus).toBe(plain.bonus + 1);
    expect(plain.damage).toBe('1d8+3');
    expect(upgraded.damage).toBe('1d8+4');
    expect(upgraded.upgrades).toEqual([
      { name: 'Repeating Shot', plus: 1, applied: true, ignoresLoading: false, freeAmmo: true },
    ]);
  });

  it('ignores Loading only when the weapon has it', () => {
    expect(row('heavy-crossbow', [up]).upgrades[0].ignoresLoading).toBe(true);
    expect(row('shortbow', [up]).upgrades[0].ignoresLoading).toBe(false);
  });

  it('does not give the ranged bonus to the melee use of a Thrown weapon', () => {
    // not a host of this upgrade, but the rule of the row is the same
    const plain = row('javelin', []);
    const upgraded = row('javelin', [up]);
    expect(upgraded.bonus).toBe(plain.bonus);
    expect(upgraded.damage).toBe(plain.damage);
    expect(upgraded.upgrades[0].applied).toBe(false);
  });

  it('adds to the bonus of a magic host weapon', () => {
    const magic = { item: get('weapon-1-2-or-3'), bonus: 1 };
    const plain = row('longbow', [], magic);
    const upgraded = row('longbow', [up], magic);
    expect(plain.magic).toBe(1);
    expect(upgraded.magic).toBe(2);
    expect(upgraded.bonus).toBe(plain.bonus + 1);
  });
});

describe('Repeating Shot in the starting shop', () => {
  const rich = { ...newCharacter('A', 'x'), money: { cp: 0, sp: 0, ep: 0, gp: 99999, pp: 0 } };
  const apply = (bought: never[]) =>
    applyStartingEquipment(
      rich,
      { class: null, background: null, bought },
      { class: null, background: null },
      items,
      { class: [], background: [] },
      new Map(),
    );

  it('links the upgrade to the weapon bought with it', () => {
    const c = apply([
      { itemId: 'longbow', qty: 1 },
      { itemId: 'repeating-shot', qty: 1, host: { itemId: 'longbow' } },
    ] as never);
    const up = c.inventory.find((e) => e.itemId === 'repeating-shot')!;
    expect(up.onEntryId).toBe('longbow');
    expect(hostOf(up, c.inventory, items).state).toBe('ok');
  });

  it('links to a magic weapon by item and base', () => {
    const c = apply([
      { itemId: 'snipers-bracelet', qty: 1, baseId: 'longbow' },
      { itemId: 'repeating-shot', qty: 1, host: { itemId: 'snipers-bracelet', baseId: 'longbow' } },
    ] as never);
    const up = c.inventory.find((e) => e.itemId === 'repeating-shot')!;
    expect(hostOf(up, c.inventory, items).state).toBe('ok');
  });

  it('keeps the upgrade without effect if its weapon is given back', () => {
    const c = apply([{ itemId: 'repeating-shot', qty: 1, host: { itemId: 'longbow' } }] as never);
    const up = c.inventory.find((e) => e.itemId === 'repeating-shot')!;
    expect(up.onEntryId).toBeUndefined();
    expect(hostOf(up, c.inventory, items).state).toBe('none');
  });
});
