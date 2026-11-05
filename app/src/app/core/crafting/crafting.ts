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

/** Magic ammunition: arrows, bolts, bullets... one shot and the magic is gone. */
const AMMUNITION_NAME = /\b(ammunition|arrows?|bolts?|bullets?)\b/i;
/** What the descriptions of one-use items say ("enough for one use", "single-use effect"...). */
const ONE_USE_TEXT = new RegExp(
  [
    String.raw`enough (of it |of the \w+ )?for (one|a single) (use|application|dose)`,
    String.raw`\bsingle[- ]use\b`,
    String.raw`\bone[- ]use\b`,
    String.raw`\bis consumed when (its|the) magic`,
    String.raw`ammunition (is no longer magical|becomes nonmagical)`,
    String.raw`explodes[^.]{0,60}on impact and is destroyed`,
  ].join('|'),
  'i',
);

/**
 * Whether a magic item is used up, so crafting it takes half the time and cost: potions, oils and
 * scrolls (by type), magic ammunition, and items whose text says they hold a single use (dusts,
 * perfumes, feather tokens, beads that explode...). Items that merely lose charges, can be
 * destroyed in combat or "regain expended charges" are not consumables.
 */
export function isConsumable(item: Pick<Item, 'name' | 'description' | 'magic'>): boolean {
  const m = item.magic;
  if (!m) return false;
  if (isConsumableType(m.type)) return true;
  if (m.type.toLowerCase() === 'weapon' && AMMUNITION_NAME.test(item.name)) return true;
  return ONE_USE_TEXT.test(item.description);
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

// -- sections ---------------------------------------------------------------------------------

/** Mundane sections (the compendium's categories, with gear told apart a bit more). */
export const MUNDANE_SECTIONS = [
  'weapon',
  'armor',
  'shield',
  'tool',
  'kit',
  'pack',
  'ammunition',
  'focus',
  'gear',
  'poison',
] as const;

/** One section per magic item type; a magic shield is listed with the armor. */
export const MAGIC_SECTIONS = [
  'magic:armor',
  'magic:weapon',
  'magic:potion',
  'magic:ring',
  'magic:rod',
  'magic:staff',
  'magic:wand',
  'magic:scroll',
  'magic:wondrous item',
] as const;

export type CraftSection = (typeof MUNDANE_SECTIONS)[number] | (typeof MAGIC_SECTIONS)[number];
export const CRAFT_SECTIONS: readonly CraftSection[] = [...MUNDANE_SECTIONS, ...MAGIC_SECTIONS];

export function isMagicSection(s: string): boolean {
  return s.startsWith('magic:');
}

/** The spellcasting focuses and the component pouch among the gear. */
const FOCUS_IDS = new Set(['arcane-focus', 'druidic-focus', 'holy-symbol', 'component-pouch']);

/**
 * The section of the crafting page an item is listed in. Mundane items follow the compendium's
 * categories (weapons, armor, shields, tools, gear, poisons) with tools and gear told apart a bit
 * more (kits, adventurer's packs, ammunition, focuses); magic items go by their type.
 */
export function craftSection(item: Pick<Item, 'id' | 'category' | 'magic'>): CraftSection {
  if (item.magic) {
    const t = item.magic.type.toLowerCase();
    return (t === 'shield' ? 'magic:armor' : `magic:${t}`) as CraftSection;
  }
  switch (item.category) {
    case 'weapon':
    case 'armor':
    case 'shield':
    case 'poison':
      return item.category;
    case 'tool':
      return /(^|-)kit$/.test(item.id) ? 'kit' : 'tool';
    default:
      if (item.id.endsWith('-pack')) return 'pack';
      if (item.id === 'ammunition') return 'ammunition';
      if (FOCUS_IDS.has(item.id)) return 'focus';
      return 'gear';
  }
}

/** Items per section, in the order of `CRAFT_SECTIONS`; empty sections are left out. */
export function groupBySection<T extends Pick<Item, 'id' | 'category' | 'magic'>>(
  items: readonly T[],
): { section: CraftSection; items: T[] }[] {
  const map = new Map<CraftSection, T[]>();
  for (const i of items) {
    const s = craftSection(i);
    map.set(s, [...(map.get(s) ?? []), i]);
  }
  // a magic type the data might get later still shows up, after the known ones
  const extra = [...map.keys()].filter((s) => !CRAFT_SECTIONS.includes(s));
  return [...CRAFT_SECTIONS.filter((s) => map.has(s)), ...extra].map((section) => ({
    section,
    items: map.get(section)!,
  }));
}

// -- profile: what the list shows and filters by ----------------------------------------------

export type Requirement = 'arcana' | 'spells' | 'base';

export interface CraftProfile {
  section: CraftSection;
  /** Raw materials in copper pieces (null: it depends on the rarity or level picked). */
  cp: number | null;
  days: number | null;
  /** Rarity in the crafting table (null: varies, artifact...); mundane items have none. */
  rarity: CraftRarity | null;
  consumable: boolean;
  /** Ids of the tools that can craft it (magic items only; the data gives none for mundane). */
  tools: string[];
  requirements: Requirement[];
}

/** Everything the list needs about an item, deduced from its data. Pure. */
export function craftProfile(item: Item): CraftProfile {
  const section = craftSection(item);
  if (!item.magic) {
    const price = costInCp(item);
    const m = price === null ? null : mundaneCraft(price);
    return {
      section,
      cp: m?.materialsCp ?? null,
      days: m?.days ?? null,
      rarity: null,
      consumable: false,
      tools: [],
      requirements: [],
    };
  }
  const type = item.magic.type;
  const rarity = craftRarity(item.magic.rarity);
  const consumable = isConsumable(item);
  // a Spell Scroll takes the time and cost of its spell level, not the rarity table
  const f = rarity && item.id !== 'spell-scroll' ? magicCraft(rarity, consumable) : null;
  const requirements: Requirement[] = ['arcana'];
  if (castsSpells(item)) requirements.push('spells');
  if (needsBaseItem(type)) requirements.push('base');
  return {
    section,
    cp: f ? f.gp * 100 : null,
    days: f?.days ?? null,
    rarity,
    consumable,
    tools: magicTools(type),
    requirements,
  };
}

/** Price ranges of the materials, in gold. */
export type CostBucket = 'le10' | '10-100' | '100-1000' | '1000-10000' | 'gt10000' | 'none';
export const COST_BUCKETS: CostBucket[] = [
  'le10',
  '10-100',
  '100-1000',
  '1000-10000',
  'gt10000',
  'none',
];

export function costBucket(cp: number | null): CostBucket {
  if (cp === null) return 'none';
  const gp = cp / 100;
  if (gp <= 10) return 'le10';
  if (gp <= 100) return '10-100';
  if (gp <= 1000) return '100-1000';
  if (gp <= 10000) return '1000-10000';
  return 'gt10000';
}

/** Crafting time ranges, in days. */
export type TimeBucket = 'le1' | '2-5' | '6-10' | '11-50' | '51-125' | 'gt125' | 'none';
export const TIME_BUCKETS: TimeBucket[] = [
  'le1',
  '2-5',
  '6-10',
  '11-50',
  '51-125',
  'gt125',
  'none',
];

export function timeBucket(days: number | null): TimeBucket {
  if (days === null) return 'none';
  if (days <= 1) return 'le1';
  if (days <= 5) return '2-5';
  if (days <= 10) return '6-10';
  if (days <= 50) return '11-50';
  if (days <= 125) return '51-125';
  return 'gt125';
}

export type CraftSort = 'name' | 'cost-asc' | 'cost-desc' | 'time-asc' | 'time-desc';
export const CRAFT_SORTS: CraftSort[] = ['name', 'cost-asc', 'cost-desc', 'time-asc', 'time-desc'];

/** Sorts rows by name, cost or time (those without a figure go last); ties go by name. */
export function sortRows<T>(
  rows: readonly T[],
  sort: CraftSort,
  profile: (row: T) => Pick<CraftProfile, 'cp' | 'days'>,
  name: (row: T) => string,
): T[] {
  const byName = (a: T, b: T) => name(a).localeCompare(name(b));
  if (sort === 'name') return [...rows].sort(byName);
  const [field, dir] = sort.split('-') as ['cost' | 'time', 'asc' | 'desc'];
  const val = (r: T) => (field === 'cost' ? profile(r).cp : profile(r).days);
  return [...rows].sort((a, b) => {
    const [x, y] = [val(a), val(b)];
    if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
    return (dir === 'asc' ? x - y : y - x) || byName(a, b);
  });
}
