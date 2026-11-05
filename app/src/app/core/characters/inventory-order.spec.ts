import { InventoryEntry } from '../models/character';
import { displayOrder, groupEntries, moveGroup } from './inventory-order';

const e = (id: string, extra: Partial<InventoryEntry> = {}): InventoryEntry =>
  ({ id, qty: 1, equipped: false, ...extra }) as InventoryEntry;
const ids = (l: InventoryEntry[]) => l.map((x) => x.id);

describe('inventory order', () => {
  it('keeps the stored order when nothing is equipped or linked', () => {
    expect(ids(displayOrder([e('a'), e('b'), e('c')]))).toEqual(['a', 'b', 'c']);
  });

  it('equipped entries go first, keeping their order', () => {
    const inv = [e('a'), e('b', { equipped: true }), e('c'), e('d', { equipped: true })];
    expect(ids(displayOrder(inv))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('an upgrade sits right below its weapon, wherever it was stored', () => {
    const inv = [e('up', { onEntryId: 'bow' }), e('x'), e('bow'), e('y')];
    expect(ids(displayOrder(inv))).toEqual(['x', 'bow', 'up', 'y']);
  });

  it('the upgrade follows its weapon up when it is equipped', () => {
    const inv = [e('x'), e('up', { onEntryId: 'bow' }), e('bow', { equipped: true })];
    expect(ids(displayOrder(inv))).toEqual(['bow', 'up', 'x']);
  });

  it('an upgrade without a weapon in the inventory stays where it is', () => {
    const inv = [e('a'), e('up', { onEntryId: 'gone' }), e('b')];
    expect(ids(displayOrder(inv))).toEqual(['a', 'up', 'b']);
    expect(groupEntries(inv)).toHaveLength(3);
  });

  it('moves a weapon with its upgrade', () => {
    const inv = [e('a'), e('bow'), e('up', { onEntryId: 'bow' }), e('c')];
    expect(ids(moveGroup(inv, 'bow', -1))).toEqual(['bow', 'up', 'a', 'c']);
    expect(ids(moveGroup(inv, 'bow', 1))).toEqual(['a', 'c', 'bow', 'up']);
    expect(ids(moveGroup(inv, 'a', 1))).toEqual(['bow', 'up', 'a', 'c']);
  });

  it('an attached upgrade cannot move on its own', () => {
    const inv = [e('bow'), e('up', { onEntryId: 'bow' }), e('c')];
    expect(moveGroup(inv, 'up', 1)).toBe(inv);
  });

  it('does not cross from the equipped half to the rest', () => {
    const inv = [e('a', { equipped: true }), e('b')];
    expect(moveGroup(inv, 'a', 1)).toBe(inv);
    expect(moveGroup(inv, 'b', -1)).toBe(inv);
    const two = [e('a', { equipped: true }), e('b', { equipped: true }), e('c')];
    expect(ids(moveGroup(two, 'b', -1))).toEqual(['b', 'a', 'c']);
  });
});
