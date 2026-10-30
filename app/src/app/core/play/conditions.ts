import { PlayState } from './play-state';

/**
 * The conditions of the 2024 rules (Exhaustion goes apart: it has levels). Their names and
 * explanations are UI texts: cond.<id> and cond.<id>.text.
 */
export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const MAX_EXHAUSTION = 6;

export function toggleCondition(state: PlayState, id: Condition): PlayState {
  const on = state.conditions.includes(id);
  return {
    ...state,
    conditions: on ? state.conditions.filter((c) => c !== id) : [...state.conditions, id],
  };
}

export function setExhaustion(state: PlayState, level: number): PlayState {
  return { ...state, exhaustion: Math.min(MAX_EXHAUSTION, Math.max(0, Math.floor(level) || 0)) };
}

/** Exhaustion (2024): −2 per level to d20 Tests, −5 ft of Speed per level; level 6 is death. */
export function exhaustionEffects(level: number): { d20: number; speed: number; dead: boolean } {
  return { d20: -2 * level, speed: -5 * level, dead: level >= MAX_EXHAUSTION };
}
