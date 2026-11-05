import { Character, InventoryEntry } from '../models/character';
import { Item } from '../models/compendium';
import { GearChoice, armorSlot, gearKind } from './magic-base';

/**
 * Inventory changes. Equipping armor or a shield also sets character.equipped, which the rules
 * engine reads for Armor Class: only one armor and one shield can be worn at a time.
 */

const isShield = (item: Item | undefined) => armorSlot(item) === 'shield';
const isArmor = (item: Item | undefined) => armorSlot(item) === 'armor';

export function canEquip(item: Item | undefined): boolean {
  const kind = gearKind(item);
  return !!item && (!!item.weapon || !!item.armor || (!!kind && kind !== 'ammunition'));
}

/**
 * Adds an item (stacking with the same one). Magic weapons and armor carry the base and bonus
 * chosen (core/characters/magic-base.ts): the same item with another base is another entry.
 */
export function addItem(
  ch: Character,
  item: Item | null,
  name = '',
  gear: GearChoice = {},
): Character {
  const same = ch.inventory.find((e) =>
    item
      ? e.itemId === item.id &&
        e.baseId === gear.baseId &&
        e.bonus === gear.bonus &&
        e.onEntryId === gear.onEntryId
      : e.name === name,
  );
  const inventory = same
    ? ch.inventory.map((e) => (e === same ? { ...e, qty: e.qty + 1 } : e))
    : [
        ...ch.inventory,
        {
          id: uniqueId(ch.inventory, item?.id ?? slug(name)),
          itemId: item?.id ?? null,
          name: item ? '' : name.trim(),
          qty: 1,
          equipped: false,
          ...(item && gear.baseId ? { baseId: gear.baseId } : {}),
          ...(item && gear.bonus ? { bonus: gear.bonus } : {}),
          ...(item && gear.onEntryId ? { onEntryId: gear.onEntryId } : {}),
        },
      ];
  return { ...ch, inventory };
}

/** Changes the base, the bonus and/or the host weapon of a magic weapon, armor or upgrade (undefined: leave as is). */
export function setGear(ch: Character, id: string, gear: GearChoice): Character {
  return {
    ...ch,
    inventory: ch.inventory.map((e) => {
      if (e.id !== id) return e;
      const { baseId, bonus, onEntryId, ...rest } = e;
      const next = { baseId, bonus, onEntryId, ...gear };
      return {
        ...rest,
        ...(next.baseId ? { baseId: next.baseId } : {}),
        ...(next.bonus ? { bonus: next.bonus } : {}),
        ...(next.onEntryId ? { onEntryId: next.onEntryId } : {}),
      };
    }),
  };
}

export function removeEntry(ch: Character, id: string, items: Map<string, Item>): Character {
  const entry = ch.inventory.find((e) => e.id === id);
  const after = entry?.equipped ? toggleEquip(ch, id, items) : ch;
  return { ...after, inventory: after.inventory.filter((e) => e.id !== id) };
}

/** Moves an entry up (-1) or down (+1) in the inventory: the player's own order. */
export function moveEntry(ch: Character, id: string, delta: number): Character {
  const from = ch.inventory.findIndex((e) => e.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ch.inventory.length) return ch;
  const inventory = [...ch.inventory];
  [inventory[from], inventory[to]] = [inventory[to], inventory[from]];
  return { ...ch, inventory };
}

export function setQty(ch: Character, id: string, qty: number): Character {
  const n = Math.max(1, Math.floor(qty) || 1);
  return { ...ch, inventory: ch.inventory.map((e) => (e.id === id ? { ...e, qty: n } : e)) };
}

export function toggleEquip(ch: Character, id: string, items: Map<string, Item>): Character {
  const entry = ch.inventory.find((e) => e.id === id);
  if (!entry) return ch;
  const item = entry.itemId ? items.get(entry.itemId) : undefined;
  const on = !entry.equipped;
  const inventory = ch.inventory.map((e) => {
    if (e.id === id) return { ...e, equipped: on };
    // putting on an armor (or a shield) takes off the one worn before
    const other = e.itemId ? items.get(e.itemId) : undefined;
    if (
      on &&
      e.equipped &&
      ((isArmor(item) && isArmor(other)) || (isShield(item) && isShield(other)))
    )
      return { ...e, equipped: false };
    return e;
  });
  const equipped = { ...ch.equipped };
  if (isArmor(item)) equipped.armorId = on ? item!.id : null;
  if (isShield(item)) equipped.shield = on;
  return { ...ch, inventory, equipped };
}

/**
 * Wear this armor (null: none), as the wizard's armor picker does. Only armor the character
 * carries can be worn: an armor that isn't in the inventory changes nothing.
 */
export function wearArmor(
  ch: Character,
  armorId: string | null,
  items: Map<string, Item>,
): Character {
  // an inventory entry id (two magic armors can be the same item), or an item id
  const wearable = (e: InventoryEntry) => isArmor(e.itemId ? items.get(e.itemId) : undefined);
  const entry = armorId
    ? (ch.inventory.find((e) => e.id === armorId && wearable(e)) ??
      ch.inventory.find((e) => e.itemId === armorId && wearable(e)))
    : undefined;
  if (armorId && !entry) return ch;
  const c: Character = {
    ...ch,
    inventory: ch.inventory.map((e) =>
      isArmor(e.itemId ? items.get(e.itemId) : undefined) ? { ...e, equipped: false } : e,
    ),
    equipped: { ...ch.equipped, armorId: null },
  };
  return entry ? toggleEquip(c, entry.id, items) : c;
}

/** Use a shield or not, as the wizard's checkbox does: only one the character carries. */
export function wearShield(ch: Character, on: boolean, items: Map<string, Item>): Character {
  const entry = ch.inventory.find((e) => isShield(e.itemId ? items.get(e.itemId) : undefined));
  if (!entry) return { ...ch, equipped: { ...ch.equipped, shield: false } };
  return entry.equipped === on ? ch : toggleEquip(ch, entry.id, items);
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}

export function uniqueId(list: InventoryEntry[], base: string): string {
  let id = base;
  for (let n = 2; list.some((e) => e.id === id); n++) id = `${base}-${n}`;
  return id;
}
