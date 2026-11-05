import { Item } from '../models/compendium';

/**
 * Crafting rules of the 2024 books, as written in the compendium rules "Crafting Non-Magical
 * Items" (equipment/crafting-non-magical-items) and "Crafting Magical Items"
 * (magic-item/crafting-magical-items). What the data does not say is left out on purpose.
 */

const CP_PER: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** The cost of an item in copper pieces (null: it has none). */
export function costInCp(item: Pick<Item, 'cost'>): number | null {
  const c = item.cost;
  if (!c || !(c.unit in CP_PER)) return null;
  return Math.round(c.amount * CP_PER[c.unit]);
}

/** Copper pieces as whole coins, biggest first ("12 gp 5 sp"). */
export function coinsFromCp(cp: number): { gp: number; sp: number; cp: number } {
  const n = Math.max(0, Math.floor(cp));
  return { gp: Math.floor(n / 100), sp: Math.floor((n % 100) / 10), cp: n % 10 };
}

export interface MundaneCraft {
  priceCp: number;
  /** Raw materials: half the purchase cost, rounded down. */
  materialsCp: number;
  /** Days of 8 hours working alone: purchase cost in GP / 10, a fraction up to a day. */
  days: number;
}

export function mundaneCraft(priceCp: number): MundaneCraft {
  return {
    priceCp,
    materialsCp: Math.floor(priceCp / 2),
    days: priceCp > 0 ? Math.max(1, Math.ceil(priceCp / 100 / 10)) : 0,
  };
}

/** Time when several characters work together: the time divided by the number of them. */
export function sharedDays(days: number, workers: number): number {
  return Math.round((days / Math.max(1, Math.floor(workers))) * 100) / 100;
}

export const MAGIC_RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary'] as const;
export type CraftRarity = (typeof MAGIC_RARITIES)[number];

/** Magic Item Crafting Time and Cost table. */
export const MAGIC_CRAFT: Record<CraftRarity, { days: number; gp: number }> = {
  common: { days: 5, gp: 50 },
  uncommon: { days: 10, gp: 200 },
  rare: { days: 50, gp: 2000 },
  'very rare': { days: 125, gp: 20000 },
  legendary: { days: 250, gp: 100000 },
};

export function craftRarity(r: string | null | undefined): CraftRarity | null {
  const k = (r ?? '').toLowerCase().trim();
  return (MAGIC_RARITIES as readonly string[]).includes(k) ? (k as CraftRarity) : null;
}

/** Time and cost of a magic item; a consumable (other than a Spell Scroll) takes half of both. */
export function magicCraft(rarity: CraftRarity, consumable: boolean): { days: number; gp: number } {
  const t = MAGIC_CRAFT[rarity];
  return consumable ? { days: t.days / 2, gp: t.gp / 2 } : { ...t };
}

/** Magic Item Tools table: tool ids by item category. */
const MAGIC_TOOLS: Record<string, string[]> = {
  armor: ['leatherworkers-tools', 'smiths-tools', 'weavers-tools'],
  shield: ['leatherworkers-tools', 'smiths-tools', 'weavers-tools'],
  potion: ['alchemists-supplies', 'herbalism-kit'],
  ring: ['jewelers-tools'],
  rod: ['woodcarvers-tools'],
  scroll: ['calligraphers-supplies'],
  staff: ['woodcarvers-tools'],
  wand: ['woodcarvers-tools'],
  weapon: ['leatherworkers-tools', 'smiths-tools', 'woodcarvers-tools'],
  'wondrous item': ['tinkers-tools'],
};

export function magicTools(type: string | null | undefined): string[] {
  return MAGIC_TOOLS[(type ?? '').toLowerCase()] ?? [];
}

/** Items made of a base object (armor, weapon): its whole purchase cost is paid or crafted too. */
export function needsBaseItem(type: string | null | undefined): boolean {
  return ['armor', 'shield', 'weapon'].includes((type ?? '').toLowerCase());
}

/** Potions and scrolls are used up: the crafting time and cost are halved (not Spell Scrolls). */
export function isConsumableType(type: string | null | undefined): boolean {
  return ['potion', 'scroll'].includes((type ?? '').toLowerCase());
}

/** Magic items that cast spells: the crafter must have them prepared every day of the work. */
export function castsSpells(item: Pick<Item, 'description'>): boolean {
  return /\bcast(ing)?\b|bound into this/i.test(item.description);
}

/** Items the crafting page lists: mundane with a cost (not mounts), and magic items. */
export function isCraftable(item: Item): boolean {
  if (item.magic) return true;
  return item.category !== 'mount' && costInCp(item) !== null;
}
