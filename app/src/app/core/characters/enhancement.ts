import { InventoryEntry } from '../models/character';
import { Item } from '../models/compendium';
import { EnhancementSpec, Gear, enhancementOf, gearOf } from './magic-base';

/**
 * Upgrades of a weapon the character already owns (Repeating Shot...). The host is another entry
 * of the inventory that is a weapon with the property the upgrade asks for: a plain Longbow or a
 * magic weapon whose base is resolved (Sniper's Bracelet with a Longbow). The link is the id of
 * that entry (InventoryEntry.onEntryId); if the entry is deleted, or stops fitting, the upgrade
 * keeps its place in the inventory but has no effect until another host is chosen.
 *
 * Bonuses: the upgrade's +N is added to the one of the host weapon (they are bonuses of two
 * different magic items and neither text forbids stacking).
 */

export interface Host {
  entry: InventoryEntry;
  gear: Gear;
}

const hasProperty = (base: Item, property: string) =>
  !!base.weapon?.properties.some((p) => p.toLowerCase().startsWith(property));

/** The entry as a host for this upgrade: a weapon with a resolved base that has the property. */
export function asHost(
  spec: EnhancementSpec,
  entry: InventoryEntry,
  items: Map<string, Item>,
): Host | null {
  const item = entry.itemId ? items.get(entry.itemId) : undefined;
  if (!item || enhancementOf(item)) return null;
  const gear = gearOf(entry, item, items);
  if (!gear || gear.kind !== 'weapon' || !gear.base || !hasProperty(gear.base, spec.property))
    return null;
  return { entry, gear };
}

/** The entries of the inventory this upgrade can go on. */
export function enhancementHosts(
  item: Item | undefined,
  inventory: InventoryEntry[],
  items: Map<string, Item>,
): Host[] {
  const spec = enhancementOf(item);
  if (!spec) return [];
  return inventory.flatMap((e) => {
    const h = asHost(spec, e, items);
    return h ? [h] : [];
  });
}

export type HostState =
  | { state: 'ok'; host: Host }
  /** No weapon chosen (yet). */
  | { state: 'none' }
  /** The weapon it was on is gone, or no longer fits. */
  | { state: 'broken' };

export function hostOf(
  entry: InventoryEntry,
  inventory: InventoryEntry[],
  items: Map<string, Item>,
): HostState {
  const spec = enhancementOf(entry.itemId ? items.get(entry.itemId) : undefined);
  if (!spec || !entry.onEntryId) return { state: 'none' };
  const target = inventory.find((e) => e.id === entry.onEntryId && e !== entry);
  const host = target ? asHost(spec, target, items) : null;
  return host ? { state: 'ok', host } : { state: 'broken' };
}

export interface AppliedEnhancement {
  item: Item;
  spec: EnhancementSpec;
}

/** For each weapon entry, the upgrades that act on it. */
export function enhancementsByHost(
  inventory: InventoryEntry[],
  items: Map<string, Item>,
): Map<string, AppliedEnhancement[]> {
  const out = new Map<string, AppliedEnhancement[]>();
  for (const e of inventory) {
    const item = e.itemId ? items.get(e.itemId) : undefined;
    const spec = enhancementOf(item);
    if (!item || !spec) continue;
    const h = hostOf(e, inventory, items);
    if (h.state !== 'ok') continue;
    out.set(h.host.entry.id, [...(out.get(h.host.entry.id) ?? []), { item, spec }]);
  }
  return out;
}
