import items from '../../../../../data/items.json';
import { longRest } from '../play/play-state';
import { newCharacter, normalizeCharacter } from '../models/character';
import { Item } from '../models/compendium';
import { createReplicated, createdItems } from './replicated-state';
import {
  DRAIN_KEY,
  availableSlotLevels,
  availableTempSlots,
  canCharge,
  canDrain,
  chargeMagicItem,
  chargesLeft,
  drainMagicItem,
  drainSlotLevel,
  maxCharges,
  setCharges,
  setTempSlotSpent,
} from './tinker';

const itemMap = new Map((items as unknown as Item[]).map((i) => [i.id, i]));
const SLOTS = [4, 3, 3, 0, 0, 0, 0, 0, 0];

function withItem(itemId: string, max = 6) {
  const base = newCharacter('Tinker', 'test');
  base.classes = [{ id: 'artificer', level: 6, subclassId: null, hp: [] }];
  const res = createReplicated(
    base,
    { planId: `p-${itemId}`, itemId, name: itemMap.get(itemId)!.name },
    max,
    itemMap,
  );
  return { ch: res.character, id: res.created!.inventoryId };
}

describe('Magic Item Tinker: charges', () => {
  it('reads the maximum charges from the item text', () => {
    expect(maxCharges(itemMap.get('wand-of-web'))).toBe(7);
    expect(maxCharges(itemMap.get('staff-of-healing'))).toBe(10);
    expect(maxCharges(itemMap.get('bag-of-holding'))).toBeNull();
    expect(maxCharges(undefined)).toBeNull();
  });

  it('set charges clamps and a full item stores nothing', () => {
    const { ch, id } = withItem('wand-of-web');
    expect(chargesLeft(ch, id, 7)).toBe(7);
    const low = setCharges(ch, id, 2, 7);
    expect(chargesLeft(low, id, 7)).toBe(2);
    expect(setCharges(low, id, -5, 7).state.charges?.[id]).toBe(0);
    expect(setCharges(low, id, 99, 7).state.charges).toBeUndefined();
  });

  it('Charge: spends the slot and regains charges equal to its level, up to the maximum', () => {
    const { ch, id } = withItem('wand-of-web');
    const low = setCharges(ch, id, 1, 7);
    expect(canCharge(low, id, itemMap)).toBe(true);
    const a = chargeMagicItem(low, id, { kind: 'slot', level: 2 }, SLOTS, itemMap)!;
    expect(chargesLeft(a, id, 7)).toBe(3);
    expect(a.state.spentSlots[1]).toBe(1);
    const b = chargeMagicItem(
      setCharges(a, id, 6, 7),
      id,
      { kind: 'slot', level: 3 },
      SLOTS,
      itemMap,
    )!;
    expect(chargesLeft(b, id, 7)).toBe(7);
    expect(b.state.charges).toBeUndefined();
  });

  it('Charge: refuses when no slot is left, for items without charges and for other items', () => {
    const { ch, id } = withItem('wand-of-web');
    const spent = { ...ch, state: { ...ch.state, spentSlots: [0, 3, 0, 0, 0, 0, 0, 0, 0] } };
    expect(chargeMagicItem(spent, id, { kind: 'slot', level: 2 }, SLOTS, itemMap)).toBeNull();
    expect(chargeMagicItem(ch, id, { kind: 'slot', level: 4 }, SLOTS, itemMap)).toBeNull();
    expect(availableSlotLevels(spent.state, SLOTS)).toEqual([1, 3]);
    const bag = withItem('bag-of-holding');
    expect(chargeMagicItem(bag.ch, bag.id, { kind: 'slot', level: 1 }, SLOTS, itemMap)).toBeNull();
    expect(chargeMagicItem(ch, 'nope', { kind: 'slot', level: 1 }, SLOTS, itemMap)).toBeNull();
  });
});

describe('Magic Item Tinker: Drain Magic Item', () => {
  it('slot level by rarity', () => {
    expect(drainSlotLevel(itemMap.get('wand-of-smiles'))).toBe(1);
    expect(drainSlotLevel(itemMap.get('wand-of-web'))).toBe(2);
    expect(drainSlotLevel(itemMap.get('staff-of-healing'))).toBe(2);
    expect(drainSlotLevel(itemMap.get('wand-of-polymorph'))).toBeNull();
    expect(drainSlotLevel(undefined)).toBeNull();
  });

  it('removes the item, gives a temporary slot and marks it used', () => {
    const { ch, id } = withItem('wand-of-web');
    const low = setCharges(ch, id, 1, 7);
    const next = drainMagicItem(low, id, itemMap)!;
    expect(createdItems(next)).toHaveLength(0);
    expect(next.inventory.some((e) => e.id === id)).toBe(false);
    expect(next.state.charges).toBeUndefined();
    expect(next.state.tempSlots).toEqual([{ level: 2, spent: false }]);
    expect(canDrain(next)).toBe(false);
    expect(next.state.resources[DRAIN_KEY]).toBe(1);
  });

  it('only once per Long Rest, and not for Very Rare items', () => {
    const a = withItem('wand-of-web');
    const b = withItem('wand-of-smiles');
    const both = {
      ...a.ch,
      inventory: [...a.ch.inventory, ...b.ch.inventory],
      state: { ...a.ch.state, replicated: [...a.ch.state.replicated!, ...b.ch.state.replicated!] },
    };
    const once = drainMagicItem(both, a.id, itemMap)!;
    expect(drainMagicItem(once, b.id, itemMap)).toBeNull();
    const poly = withItem('wand-of-polymorph');
    expect(drainMagicItem(poly.ch, poly.id, itemMap)).toBeNull();
  });

  it('the extra slot can pay for Charge Magic Item and be spent by hand', () => {
    const a = withItem('wand-of-web');
    const b = withItem('wand-of-smiles');
    const both = {
      ...a.ch,
      inventory: [...a.ch.inventory, ...b.ch.inventory],
      state: { ...a.ch.state, replicated: [...a.ch.state.replicated!, ...b.ch.state.replicated!] },
    };
    const drained = drainMagicItem(both, b.id, itemMap)!;
    expect(availableTempSlots(drained.state)).toHaveLength(1);
    const low = setCharges(drained, a.id, 0, 7);
    const c = chargeMagicItem(low, a.id, { kind: 'temp', index: 0 }, SLOTS, itemMap)!;
    expect(chargesLeft(c, a.id, 7)).toBe(1);
    expect(c.state.tempSlots).toEqual([{ level: 1, spent: true }]);
    expect(availableTempSlots(c.state)).toHaveLength(0);
    expect(chargeMagicItem(c, a.id, { kind: 'temp', index: 0 }, SLOTS, itemMap)).toBeNull();
    expect(setTempSlotSpent(c.state, 0, false).tempSlots![0].spent).toBe(false);
  });

  it('a Long Rest removes the extra slots and allows draining again', () => {
    const { ch, id } = withItem('wand-of-web');
    const next = drainMagicItem(ch, id, itemMap)!;
    const rested = longRest(next.state);
    expect(rested.tempSlots).toBeUndefined();
    expect(canDrain({ state: rested })).toBe(true);
  });

  it('state survives normalizing the character (saving and syncing)', () => {
    const { ch, id } = withItem('wand-of-web');
    const low = setCharges(ch, id, 3, 7);
    const drained = drainMagicItem(withItem('wand-of-smiles').ch, 'x', itemMap);
    expect(drained).toBeNull();
    const state = { ...low.state, tempSlots: [{ level: 2, spent: true }] };
    const back = normalizeCharacter(JSON.parse(JSON.stringify({ ...low, state })))!;
    expect(back.state.charges).toEqual({ [id]: 3 });
    expect(back.state.tempSlots).toEqual([{ level: 2, spent: true }]);
    const junk = normalizeCharacter({
      ...low,
      state: { ...low.state, charges: { a: -1, b: 'x' }, tempSlots: [{ level: 12 }, 4] },
    })!;
    expect(junk.state.charges).toBeUndefined();
    expect(junk.state.tempSlots).toBeUndefined();
  });
});
