import type { PlayState } from './play-state';

/**
 * Concentration: the spell the character keeps up (state.concentration). Pure functions; the
 * sheet saves the result.
 */
export interface Concentration {
  spellId: string;
  /** When it started (ISO date-time); optional. */
  since?: string;
}

/** Why the concentration ended without the player choosing it. */
export type ConcentrationLoss = 'hp' | 'condition' | 'rest';

/**
 * Conditions that break Concentration: Incapacitated (its text in the compendium: "your
 * Concentration is broken") and those whose text says "You are Incapacitated".
 */
export const BREAKING_CONDITIONS = [
  'incapacitated',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious',
] as const;

/** From a saved file: anything that isn't a spell id becomes "none" (null). */
export function normalizeConcentration(raw: unknown): Concentration | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { spellId?: unknown; since?: unknown };
  if (typeof r.spellId !== 'string' || !r.spellId) return null;
  const out: Concentration = { spellId: r.spellId };
  if (typeof r.since === 'string' && r.since) out.since = r.since;
  return out;
}

/**
 * Rule of Concentration (Player's Handbook 2024, "Spells"): when you take damage, make a
 * Constitution saving throw; the DC is 10 or half the damage taken, whichever number is higher.
 * (The text of the rule is not in the compendium data; Incapacitated and the conditions that
 * include it are.) Half is rounded down.
 */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(Math.max(0, damage) / 2));
}

/** Starts concentrating on a spell; `replaced` is the spell it stopped concentrating on. */
export function startConcentration(
  state: PlayState,
  spellId: string,
  now: Date = new Date(),
): { state: PlayState; replaced: string | null } {
  const prev = state.concentration?.spellId ?? null;
  if (prev === spellId) return { state, replaced: null };
  return {
    state: { ...state, concentration: { spellId, since: now.toISOString() } },
    replaced: prev,
  };
}

/** Stops concentrating (no-op if not concentrating). */
export function dropConcentration(state: PlayState): PlayState {
  if (!state.concentration) return state;
  const { concentration: _c, ...rest } = state;
  return rest;
}

/** Whether a condition (or several) of the state breaks Concentration. */
export function hasBreakingCondition(conditions: readonly string[]): boolean {
  return conditions.some((c) => (BREAKING_CONDITIONS as readonly string[]).includes(c));
}

/**
 * After any change of the state: Concentration ends at 0 HP and with an incapacitating
 * condition. `reason` is set when it ended (so the sheet can say so).
 */
export function settleConcentration(
  state: PlayState,
  maxHp: number,
): { state: PlayState; lost: { spellId: string; reason: ConcentrationLoss } | null } {
  const c = state.concentration;
  if (!c) return { state, lost: null };
  if (Math.min(state.hpCurrent ?? maxHp, maxHp) === 0) {
    return { state: dropConcentration(state), lost: { spellId: c.spellId, reason: 'hp' } };
  }
  if (hasBreakingCondition(state.conditions)) {
    return { state: dropConcentration(state), lost: { spellId: c.spellId, reason: 'condition' } };
  }
  return { state, lost: null };
}

/** A rest (1 hour or more) ends the concentration. */
export function endOnRest(state: PlayState): {
  state: PlayState;
  lost: { spellId: string; reason: ConcentrationLoss } | null;
} {
  const c = state.concentration;
  if (!c) return { state, lost: null };
  return { state: dropConcentration(state), lost: { spellId: c.spellId, reason: 'rest' } };
}
