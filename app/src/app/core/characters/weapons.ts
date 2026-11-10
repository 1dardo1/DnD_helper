import { InventoryEntry } from '../models/character';
import { Item } from '../models/compendium';
import { WeaponEntry } from '../rules/attacks';
import { enhancementsByHost } from './enhancement';
import { gearKind, gearOf } from './magic-base';

/**
 * The inventory entries that are weapons, as the attacks table needs them: the base weapon of a
 * magic one with its bonus, and the upgrades on it (Repeating Shot). Ammunition (a weapon without
 * damage nor properties) is no attack. Shared by the attacks table and the combat tab.
 */
export function weaponEntriesOf(
  inventory: InventoryEntry[],
  items: Map<string, Item>,
): WeaponEntry[] {
  const byHost = enhancementsByHost(inventory, items);
  const out: WeaponEntry[] = [];
  for (const e of inventory) {
    const item = e.itemId ? items.get(e.itemId) : undefined;
    const gear = gearOf(e, item, items);
    const base = gear?.base;
    if (gear?.kind !== 'weapon' || !base?.weapon) continue;
    if (!base.weapon.damage.length && !base.weapon.properties.length) continue;
    out.push({
      id: e.id,
      equipped: e.equipped,
      item: base,
      magic: item && gearKind(item) ? { item, bonus: gear.bonus } : undefined,
      upgrades: (byHost.get(e.id) ?? []).map((u) => ({
        item: u.item,
        bonus: u.spec.bonus,
        rangedOnly: u.spec.rangedOnly,
        ignoresLoading: u.spec.ignoresLoading,
        freeAmmo: u.spec.freeAmmo,
      })),
    });
  }
  return out;
}
