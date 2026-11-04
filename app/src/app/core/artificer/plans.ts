import { ClassOption, DndClass, Item } from '../models/compendium';

/**
 * Artificer magic item plans (Replicate Magic Item, 2024). Each plan is an option of the group
 * `magic-item-plan` that points at a compendium item. Three of the options stand for a kind of
 * item (Common magic item, Uncommon / Rare Wondrous Item): the player picks the item, and the
 * choice is stored as "<rarity>:<itemId>" in character.choices.options, one per plan.
 */
export const PLAN_GROUP = 'magic-item-plan';

const PICK_ID = /^(common|uncommon|rare):(.+)$/;

export const isPickId = (id: string) => PICK_ID.test(id);
export const pickId = (rarity: string, itemId: string) => `${rarity}:${itemId}`;
export const isPlanChoice = (id: string) => id.startsWith(`${PLAN_GROUP}/`) || isPickId(id);

export function parsePickId(id: string): { rarity: string; itemId: string } | null {
  const m = PICK_ID.exec(id);
  return m ? { rarity: m[1], itemId: m[2] } : null;
}

const numberIn = (cls: DndClass, column: RegExp, level: number): number | null => {
  const col = cls.progression.columns.find((c) => column.test(c));
  const n = col ? parseInt(cls.progression.rows[level - 1]?.values[col] ?? '', 10) : NaN;
  return Number.isNaN(n) ? null : n;
};

/** Plans known and magic items that can exist at once, from the class table at a level. */
export function planCounts(cls: DndClass, level: number): { known: number; items: number } | null {
  const known = numberIn(cls, /plans known/i, level);
  const items = numberIn(cls, /magic items/i, level);
  return known === null ? null : { known, items: items ?? known };
}

export interface ResolvedPlan {
  /** Option id ("magic-item-plan/bag-of-holding") or "<rarity>:<itemId>". */
  id: string;
  /** English name, translated with the data pipes. */
  name: string;
  itemId: string;
  /** null: varies (a picked item decides). */
  attunement: boolean | null;
}

export function resolvePlan(
  id: string,
  options: ReadonlyMap<string, ClassOption>,
  items: ReadonlyMap<string, Item>,
): ResolvedPlan | null {
  const pick = parsePickId(id);
  if (pick) {
    const item = items.get(pick.itemId);
    return item
      ? {
          id,
          name: item.name,
          itemId: item.id,
          attunement: item.magic ? item.magic.attunement : null,
        }
      : null;
  }
  const o = options.get(id);
  if (!o || o.group !== PLAN_GROUP || !o.itemId) return null;
  return { id, name: o.name, itemId: o.itemId, attunement: o.attunement ?? null };
}

/** The plans a character knows, in the order chosen; ids that no longer resolve are skipped. */
export function knownPlans(
  chosen: readonly string[],
  options: ReadonlyMap<string, ClassOption>,
  items: ReadonlyMap<string, Item>,
): ResolvedPlan[] {
  return chosen
    .filter(isPlanChoice)
    .map((id) => resolvePlan(id, options, items))
    .filter((p): p is ResolvedPlan => !!p);
}

/** Plans in a list of option ids: the fixed ones of the group plus the picked items. */
export function plansTaken(
  chosen: readonly string[],
  groupOptions: readonly ClassOption[],
): number {
  const ids = new Set(groupOptions.map((o) => o.id));
  return chosen.filter((id) => ids.has(id) || isPickId(id)).length;
}

/** Whether an item can be learned through a "kind of item" plan: not a Potion, Scroll or cursed. */
export function isPickable(item: Item, pick: NonNullable<ClassOption['itemPick']>): boolean {
  const m = item.magic;
  if (!m || m.rarity !== pick.rarity) return false;
  if (pick.wondrous ? m.type !== 'wondrous item' : m.type === 'potion' || m.type === 'scroll')
    return false;
  return !/\bcurse[ds]?\b/i.test(`${item.description} ${m.subtype ?? ''}`);
}

/** Items that fill a pick plan, minus those already learned (a different item each time). */
export function pickableItems(
  items: Iterable<Item>,
  pick: NonNullable<ClassOption['itemPick']>,
  taken: readonly string[],
): Item[] {
  const used = new Set(taken.map((id) => parsePickId(id)?.itemId).filter(Boolean));
  return [...items]
    .filter((i) => isPickable(i, pick) && !used.has(i.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Kind of item" plans a class level has unlocked, in table order. */
export function pickSlots(groupOptions: readonly ClassOption[], level: number): ClassOption[] {
  return groupOptions
    .filter((o) => o.itemPick && (o.prerequisites?.level ?? 1) <= level)
    .sort((a, b) => (a.prerequisites?.level ?? 1) - (b.prerequisites?.level ?? 1));
}

/** How many of the plans known before a level up are not known after it (one may be replaced). */
export function plansReplaced(before: readonly string[], after: readonly string[]): number {
  const now = new Set(after);
  return before.filter((id) => isPlanChoice(id) && !now.has(id)).length;
}
