import { PlayState, setPactSpent, setResourceUsed, setSpentSlots } from '../play/play-state';
import { Sheet } from '../rules/sheet';
import type { Cost } from './combat-actions';

/** Uses left of a counter (state.resources keeps the uses spent). */
export function usesLeft(state: PlayState, key: string, max: number): number {
  return max - Math.min(state.resources[key] ?? 0, max);
}

/** Spell slots (shared and Pact Magic) of a level or higher still unspent. */
export function slotsLeft(sheet: Sheet, state: PlayState, level: number): number {
  let n = 0;
  sheet.spellcasting.slots.forEach((max, i) => {
    if (i + 1 >= level) n += Math.max(0, max - (state.spentSlots[i] ?? 0));
  });
  const pact = sheet.spellcasting.pact;
  if (pact && pact.level >= level) n += Math.max(0, pact.slots - state.pactSlotsSpent);
  return n;
}

/**
 * Where casting a spell of this level goes: a Pact Magic slot first for a Warlock spell (they are
 * all of the pact's level), otherwise the lowest shared slot of that level or higher, then a pact
 * slot. null: nothing left.
 */
export function slotFor(
  sheet: Sheet,
  state: PlayState,
  level: number,
  preferPact: boolean,
): { pact: true; level: number } | { pact: false; level: number } | null {
  const pact = sheet.spellcasting.pact;
  const pactOk = !!pact && pact.level >= level && state.pactSlotsSpent < pact.slots;
  if (preferPact && pactOk) return { pact: true, level: pact!.level };
  const slots = sheet.spellcasting.slots;
  for (let l = level; l <= slots.length; l++)
    if ((slots[l - 1] ?? 0) > (state.spentSlots[l - 1] ?? 0)) return { pact: false, level: l };
  return pactOk ? { pact: true, level: pact!.level } : null;
}

/** How many uses a cost has left now (slots of that level or higher). */
export function leftOf(sheet: Sheet, state: PlayState, cost: Cost): number {
  return cost.k === 'resource'
    ? usesLeft(state, cost.key, cost.max)
    : slotsLeft(sheet, state, cost.level);
}

/** The state after paying a cost once (unchanged when nothing is left). */
export function spend(sheet: Sheet, state: PlayState, cost: Cost): PlayState {
  if (cost.k === 'resource') {
    const used = Math.min(state.resources[cost.key] ?? 0, cost.max);
    return used >= cost.max ? state : setResourceUsed(state, cost.key, used + 1, cost.max);
  }
  const slot = slotFor(sheet, state, cost.level, cost.pact);
  if (!slot) return state;
  if (slot.pact)
    return setPactSpent(state, state.pactSlotsSpent + 1, sheet.spellcasting.pact!.slots);
  const max = sheet.spellcasting.slots[slot.level - 1];
  return setSpentSlots(state, slot.level, (state.spentSlots[slot.level - 1] ?? 0) + 1, max);
}

/** Gives one use of a counter back (an undo of the spend button). */
export function refund(state: PlayState, cost: Cost): PlayState {
  if (cost.k !== 'resource') return state;
  const used = Math.min(state.resources[cost.key] ?? 0, cost.max);
  return used <= 0 ? state : setResourceUsed(state, cost.key, used - 1, cost.max);
}
