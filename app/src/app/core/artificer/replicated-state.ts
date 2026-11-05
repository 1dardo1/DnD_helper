import { removeEntry, uniqueId } from '../characters/inventory';
import { dropCharges } from './tinker';
import type { Character } from '../models/character';
import type { Item } from '../models/compendium';

/**
 * Items created with the Artificer's Replicate Magic Item. They are kept in character.state.replicated
 * (oldest first) next to their inventory entries (source 'replicate'). Rules (2024): each item is
 * based on a different plan; going over the maximum ("Magic Items" in the class table) makes the
 * oldest vanish; the items stay until then (they are not lost at a Long Rest). Pure functions.
 */
export interface ReplicatedItem {
  planId: string;
  itemId: string;
  /** InventoryEntry.id of the created item. */
  inventoryId: string;
  /** ISO date. */
  createdAt: string;
}

/** Key in state.resources for Transmute Magic Item (once per Long Rest; a Long Rest clears it). */
export const TRANSMUTE_KEY = 'artificer:transmute-magic-item';

export function normalizeReplicated(raw: unknown): ReplicatedItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReplicatedItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Partial<ReplicatedItem>;
    if (typeof x.planId !== 'string' || typeof x.itemId !== 'string') continue;
    if (typeof x.inventoryId !== 'string' || seen.has(x.inventoryId)) continue;
    seen.add(x.inventoryId);
    out.push({
      planId: x.planId,
      itemId: x.itemId,
      inventoryId: x.inventoryId,
      createdAt: typeof x.createdAt === 'string' ? x.createdAt : '',
    });
  }
  return out;
}

/** The created items that are still in the inventory (one deleted by hand no longer counts). */
export function createdItems(ch: Character): ReplicatedItem[] {
  const ids = new Set(ch.inventory.map((e) => e.id));
  return (ch.state.replicated ?? []).filter((r) => ids.has(r.inventoryId));
}

export interface PlanRef {
  planId: string;
  itemId: string;
  /** English name of the plan (shown in the inventory). */
  name: string;
}

export interface CreateResult {
  character: Character;
  /** Items that vanished to make room (oldest first). */
  vanished: ReplicatedItem[];
  created: ReplicatedItem | null;
  /** 'duplicate': an item from this plan already exists. */
  reason?: 'duplicate';
}

function withState(ch: Character, replicated: ReplicatedItem[]): Character {
  const { replicated: _old, ...rest } = ch.state;
  return { ...ch, state: replicated.length ? { ...rest, replicated } : rest };
}

/** Creates the item of a plan in the inventory; over `max`, the oldest ones vanish first. */
export function createReplicated(
  ch: Character,
  plan: PlanRef,
  max: number,
  items: Map<string, Item>,
  now: Date = new Date(),
): CreateResult {
  let list = createdItems(ch);
  if (list.some((r) => r.planId === plan.planId))
    return { character: ch, vanished: [], created: null, reason: 'duplicate' };
  let c = ch;
  const vanished: ReplicatedItem[] = [];
  while (list.length >= Math.max(1, max)) {
    const oldest = list[0];
    vanished.push(oldest);
    c = removeEntry(c, oldest.inventoryId, items);
    list = list.slice(1);
  }
  const id = uniqueId(c.inventory, `replicated-${plan.itemId}`);
  const created: ReplicatedItem = {
    planId: plan.planId,
    itemId: plan.itemId,
    inventoryId: id,
    createdAt: now.toISOString(),
  };
  c = {
    ...c,
    inventory: [
      ...c.inventory,
      {
        id,
        itemId: plan.itemId,
        name: plan.name,
        qty: 1,
        equipped: false,
        source: 'replicate',
        planId: plan.planId,
      },
    ],
  };
  return { character: withState(c, [...list, created]), vanished, created };
}

/** Removes a created item (the player lets it go, or swaps it at a Long Rest). */
export function removeReplicated(
  ch: Character,
  inventoryId: string,
  items: Map<string, Item>,
): Character {
  const rest = createdItems(ch).filter((r) => r.inventoryId !== inventoryId);
  return withState(dropCharges(removeEntry(ch, inventoryId, items), inventoryId), rest);
}

/**
 * Transmute Magic Item (Artificer 6): a created item becomes another one based on a plan known,
 * once per Long Rest. It keeps its place (age) in the list. null: not allowed (used already,
 * the plan is in use, or the item isn't one of the created).
 */
export function transformReplicated(
  ch: Character,
  inventoryId: string,
  plan: PlanRef,
  items: Map<string, Item>,
): Character | null {
  const list = createdItems(ch);
  const old = list.find((r) => r.inventoryId === inventoryId);
  if (!old || !canTransmute(ch) || list.some((r) => r.planId === plan.planId)) return null;
  const without = dropCharges(removeEntry(ch, inventoryId, items), inventoryId);
  const id = uniqueId(without.inventory, `replicated-${plan.itemId}`);
  const at = ch.inventory.findIndex((e) => e.id === inventoryId);
  const inventory = [...without.inventory];
  inventory.splice(Math.min(Math.max(at, 0), inventory.length), 0, {
    id,
    itemId: plan.itemId,
    name: plan.name,
    qty: 1,
    equipped: false,
    source: 'replicate',
    planId: plan.planId,
  });
  const replicated = list.map((r) =>
    r === old ? { ...r, planId: plan.planId, itemId: plan.itemId, inventoryId: id } : r,
  );
  const c = withState({ ...without, inventory }, replicated);
  return { ...c, state: { ...c.state, resources: { ...c.state.resources, [TRANSMUTE_KEY]: 1 } } };
}

export function canTransmute(ch: Pick<Character, 'state'>): boolean {
  return !(ch.state.resources[TRANSMUTE_KEY] > 0);
}

/**
 * "Change items" after a Long Rest: removes the chosen created items, then creates one item per
 * plan (in order; the oldest vanish if that goes over `max`). Returns every item that vanished.
 */
export function changeReplicated(
  ch: Character,
  remove: readonly string[],
  create: readonly PlanRef[],
  max: number,
  items: Map<string, Item>,
  now: Date = new Date(),
): { character: Character; vanished: ReplicatedItem[] } {
  let c = ch;
  const vanished: ReplicatedItem[] = [];
  for (const id of remove) {
    const r = createdItems(c).find((x) => x.inventoryId === id);
    if (!r) continue;
    vanished.push(r);
    c = removeReplicated(c, id, items);
  }
  create.forEach((plan, i) => {
    const res = createReplicated(c, plan, max, items, new Date(now.getTime() + i));
    c = res.character;
    vanished.push(...res.vanished);
  });
  return { character: c, vanished };
}

// -- Long Rest ----------------------------------------------------------------------------------

/**
 * After a Long Rest an Artificer who knows plans is asked whether to keep the created items
 * (the default) or change them. `level` is the Artificer level (0 = not an Artificer).
 */
export function promptAfterLongRest(state: Character['state'], level: number): Character['state'] {
  const next = { ...state };
  if (level >= 2) next.replicatePrompt = true;
  else delete next.replicatePrompt;
  return next;
}

/** The prompt was answered (keep all) or dismissed: it won't show again until the next rest. */
export function dismissReplicatePrompt(state: Character['state']): Character['state'] {
  const next = { ...state };
  delete next.replicatePrompt;
  return next;
}
