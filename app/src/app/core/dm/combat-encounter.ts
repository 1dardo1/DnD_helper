import { InjectionToken } from '@angular/core';

/**
 * What the combat tracker reads of an encounter made with the encounter builder
 * (core/dm/encounter.ts, EncounterStore). Kept here, structurally the same, so the tracker doesn't
 * depend on the builder's files.
 */
export interface CombatEncounter {
  id: string;
  name: string;
  party: { level: number; characterId?: string; name?: string }[];
  monsters: { monsterId: string; count: number }[];
  notes: string;
}

/** Where encounters are read from. EncounterStore fits it as it is. */
export interface EncounterSource {
  get(id: string): Promise<CombatEncounter | undefined>;
}

/**
 * Encounters for /dm/combat?encounter=<id>. Until the encounter builder is wired in, there are
 * none. Wiring: `factory: () => inject(EncounterStore)` (from ./encounter-store.service).
 */
export const ENCOUNTER_SOURCE = new InjectionToken<EncounterSource>('ENCOUNTER_SOURCE', {
  providedIn: 'root',
  factory: () => ({ get: async () => undefined }),
});
