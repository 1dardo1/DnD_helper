import { Encounter } from '../../core/dm/encounter';
import {
  Budget,
  DifficultyRating,
  encounterXp,
  partyBudget,
  rateEncounter,
  xpPerCharacter,
} from '../../core/dm/encounter-difficulty';

export interface EncounterStats {
  characters: number;
  creatures: number;
  xp: number;
  budget: Budget;
  rating: DifficultyRating;
  xpEach: number;
}

/** The numbers of an encounter, given the XP of each monster by id. */
export function encounterStats(e: Encounter, xpById: ReadonlyMap<string, number>): EncounterStats {
  const xp = encounterXp(e.monsters, (id) => xpById.get(id));
  const budget = partyBudget(e.party.map((p) => p.level));
  return {
    characters: e.party.length,
    creatures: e.monsters.reduce((n, m) => n + m.count, 0),
    xp,
    budget,
    rating: rateEncounter(xp, budget),
    xpEach: xpPerCharacter(xp, e.party.length),
  };
}

/** i18n key of a rating ("Moderado"). */
export const RATING_KEY: Record<DifficultyRating, string> = {
  none: 'encounter.rating.none',
  low: 'encounter.rating.low',
  moderate: 'encounter.rating.moderate',
  high: 'encounter.rating.high',
  aboveHigh: 'encounter.rating.aboveHigh',
};
