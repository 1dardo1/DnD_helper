import { InventoryEntry } from '../models/character';

/** A top-level row of the inventory with the upgrades linked to it (Repeating Shot...). */
export interface EntryGroup {
  entry: InventoryEntry;
  /** Entries linked to this one with onEntryId: they travel with it, right below. */
  attached: InventoryEntry[];
}

/**
 * Groups the inventory: an entry linked (onEntryId) to another entry of the inventory is attached
 * to it; the rest are groups of their own. Equipped groups come first, then the rest; inside each
 * half the stored order is kept (that is the player's own order).
 */
export function groupEntries(inventory: InventoryEntry[]): EntryGroup[] {
  const byId = new Map(inventory.map((e) => [e.id, e]));
  const hostId = (e: InventoryEntry): string | null =>
    e.onEntryId && e.onEntryId !== e.id && byId.has(e.onEntryId) ? e.onEntryId : null;
  const attachedTo = new Map<string, InventoryEntry[]>();
  const children = new Set<InventoryEntry>();
  for (const e of inventory) {
    const h = hostId(e);
    // a host that is itself linked would make a chain: that entry stays a plain one
    if (h && !hostId(byId.get(h)!)) {
      children.add(e);
      attachedTo.set(h, [...(attachedTo.get(h) ?? []), e]);
    }
  }
  const groups = inventory
    .filter((e) => !children.has(e))
    .map((entry) => ({ entry, attached: attachedTo.get(entry.id) ?? [] }));
  return [...groups.filter((g) => g.entry.equipped), ...groups.filter((g) => !g.entry.equipped)];
}

/** The inventory as it is listed: equipped first, upgrades right below their weapon. */
export function displayOrder(inventory: InventoryEntry[]): InventoryEntry[] {
  return groupEntries(inventory).flatMap((g) => [g.entry, ...g.attached]);
}

/**
 * Moves a group one place up (-1) or down (+1) among the groups with the same equipped state
 * (the upgrades go with their weapon). Returns the inventory in display order, or the same array
 * when it cannot move. An attached entry cannot be moved on its own.
 */
export function moveGroup(
  inventory: InventoryEntry[],
  id: string,
  delta: -1 | 1,
): InventoryEntry[] {
  const groups = groupEntries(inventory);
  const from = groups.findIndex((g) => g.entry.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= groups.length) return inventory;
  if (!!groups[from].entry.equipped !== !!groups[to].entry.equipped) return inventory;
  [groups[from], groups[to]] = [groups[to], groups[from]];
  return groups.flatMap((g) => [g.entry, ...g.attached]);
}
