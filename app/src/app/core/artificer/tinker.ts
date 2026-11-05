import type { Character } from '../models/character';
import type { Item } from '../models/compendium';
import { createdItems, removeReplicated } from './replicated-state';

/**
 * Magic Item Tinker (Artificer 6), the parts that touch charges and spell slots:
 * Charge Magic Item (spend a slot, the created item regains that many charges) and Drain Magic
 * Item (the created item vanishes and becomes a temporary slot of level 1 or 2 until the next
 * Long Rest, once per Long Rest). Pure functions over the character.
 */

/** Key in state.resources for Drain Magic Item (once per Long Rest; a Long Rest clears it). */
export const DRAIN_KEY = 'artificer:drain-magic-item';

/** An extra spell slot from Drain Magic Item; it disappears at the end of a Long Rest. */
export interface TempSlot {
  level: number;
  spent: boolean;
}

export function normalizeTempSlots(raw: unknown): TempSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: TempSlot[] = [];
  for (const r of raw) {
    const x = r as Partial<TempSlot> | null;
    if (!x || typeof x.level !== 'number' || x.level < 1 || x.level > 9) continue;
    out.push({ level: Math.floor(x.level), spent: x.spent === true });
  }
  return out;
}

export function normalizeCharges(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
  return out;
}

/** Maximum charges of a magic item, read from its text ("has 3 charges"); null: no charges. */
export function maxCharges(item: Pick<Item, 'description'> | undefined): number | null {
  const text = item?.description ?? '';
  const m =
    /\b(?:has|holds|with|contains|bears|maximum of)\s+(\d+)\s+(?:maximum\s+)?charges?\b/i.exec(
      text,
    ) ?? /\b(\d+)\s+(?:maximum\s+)?charges\b/i.exec(text);
  const n = m ? parseInt(m[1], 10) : NaN;
  return n > 0 ? n : null;
}

/** Charges left (unrecorded = full). */
export function chargesLeft(
  ch: Pick<Character, 'state'>,
  inventoryId: string,
  max: number,
): number {
  return Math.min(max, ch.state.charges?.[inventoryId] ?? max);
}

function withCharges(ch: Character, charges: Record<string, number>): Character {
  const { charges: _old, ...rest } = ch.state;
  return { ...ch, state: Object.keys(charges).length ? { ...rest, charges } : rest };
}

/** Manual change of the charges of a created item (clamped to 0..max). */
export function setCharges(
  ch: Character,
  inventoryId: string,
  value: number,
  max: number,
): Character {
  const n = Math.min(max, Math.max(0, Math.floor(value) || 0));
  const charges = { ...(ch.state.charges ?? {}) };
  if (n >= max) delete charges[inventoryId];
  else charges[inventoryId] = n;
  return withCharges(ch, charges);
}

/** Forgets the charges of an inventory entry that is gone. */
export function dropCharges(ch: Character, inventoryId: string): Character {
  if (!ch.state.charges || !(inventoryId in ch.state.charges)) return ch;
  const { [inventoryId]: _gone, ...rest } = ch.state.charges;
  return withCharges(ch, rest);
}

// -- Charge Magic Item ----------------------------------------------------------------------

/** Where the slot that is spent comes from: a normal slot of a level or an extra (Drain) one. */
export type SlotSource = { kind: 'slot'; level: number } | { kind: 'temp'; index: number };

/** Slot levels (1-9) with a slot left; `slots` is the maximum per level (index 0 = level 1). */
export function availableSlotLevels(
  state: Pick<Character['state'], 'spentSlots'>,
  slots: readonly number[],
): number[] {
  const out: number[] = [];
  slots.forEach((max, i) => {
    if (max - Math.min(max, state.spentSlots[i] ?? 0) > 0) out.push(i + 1);
  });
  return out;
}

/** Extra slots (Drain) not spent yet, with their index in state.tempSlots. */
export function availableTempSlots(state: Pick<Character['state'], 'tempSlots'>) {
  return (state.tempSlots ?? []).map((s, index) => ({ ...s, index })).filter((s) => !s.spent);
}

/** Whether a created item has charges that can be restored (it is not full). */
export function canCharge(ch: Character, inventoryId: string, items: Map<string, Item>): boolean {
  const r = createdItems(ch).find((x) => x.inventoryId === inventoryId);
  const max = maxCharges(r && items.get(r.itemId));
  return !!max && chargesLeft(ch, inventoryId, max) < max;
}

/**
 * Charge Magic Item: spends a slot and the item regains charges equal to its level (never over
 * the maximum). null: not a created item with charges, or the slot is not available.
 */
export function chargeMagicItem(
  ch: Character,
  inventoryId: string,
  source: SlotSource,
  slots: readonly number[],
  items: Map<string, Item>,
): Character | null {
  const r = createdItems(ch).find((x) => x.inventoryId === inventoryId);
  const max = maxCharges(r && items.get(r.itemId));
  if (!max) return null;
  let state = ch.state;
  let level: number;
  if (source.kind === 'slot') {
    level = source.level;
    const cap = slots[level - 1] ?? 0;
    const spent = Math.min(cap, state.spentSlots[level - 1] ?? 0);
    if (level < 1 || cap - spent <= 0) return null;
    const spentSlots = [...state.spentSlots];
    while (spentSlots.length < 9) spentSlots.push(0);
    spentSlots[level - 1] = spent + 1;
    state = { ...state, spentSlots };
  } else {
    const t = state.tempSlots?.[source.index];
    if (!t || t.spent) return null;
    level = t.level;
    state = {
      ...state,
      tempSlots: state.tempSlots!.map((s, i) => (i === source.index ? { ...s, spent: true } : s)),
    };
  }
  return setCharges({ ...ch, state }, inventoryId, chargesLeft(ch, inventoryId, max) + level, max);
}

// -- Drain Magic Item -----------------------------------------------------------------------

/** Level of the slot a created item gives when drained: Common 1, Uncommon or Rare 2. */
export function drainSlotLevel(item: Pick<Item, 'magic'> | undefined): number | null {
  switch (item?.magic?.rarity?.toLowerCase()) {
    case 'common':
      return 1;
    case 'uncommon':
    case 'rare':
      return 2;
    default:
      return null;
  }
}

export function canDrain(ch: Pick<Character, 'state'>): boolean {
  return !(ch.state.resources[DRAIN_KEY] > 0);
}

/**
 * Drain Magic Item: the created item vanishes and its energy becomes a temporary slot, once per
 * Long Rest. null: used already, not a created item, or its rarity is too high.
 */
export function drainMagicItem(
  ch: Character,
  inventoryId: string,
  items: Map<string, Item>,
): Character | null {
  const r = createdItems(ch).find((x) => x.inventoryId === inventoryId);
  const level = drainSlotLevel(r && items.get(r.itemId));
  if (!r || !level || !canDrain(ch)) return null;
  const c = removeReplicated(ch, inventoryId, items);
  return {
    ...c,
    state: {
      ...c.state,
      tempSlots: [...(c.state.tempSlots ?? []), { level, spent: false }],
      resources: { ...c.state.resources, [DRAIN_KEY]: 1 },
    },
  };
}

/** Marks an extra slot as spent or not (the slot checkboxes of the play panel). */
export function setTempSlotSpent(
  state: Character['state'],
  index: number,
  spent: boolean,
): Character['state'] {
  if (!state.tempSlots?.[index]) return state;
  return {
    ...state,
    tempSlots: state.tempSlots.map((s, i) => (i === index ? { ...s, spent } : s)),
  };
}
