import { InjectionToken, inject } from '@angular/core';

import { EncounterStore } from './encounter-store.service';

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
  /** It exists but is protected and not unlocked on this device (call after get). */
  isLocked?(id: string): boolean;
}

/** Encounters for /dm/combat?encounter=<id>: those of the encounter builder (tests may swap it). */
export const ENCOUNTER_SOURCE = new InjectionToken<EncounterSource>('ENCOUNTER_SOURCE', {
  providedIn: 'root',
  factory: () => {
    const store = inject(EncounterStore);
    return {
      get: (id) => store.get(id),
      isLocked: (id) => store.locked().some((l) => l.id === id),
    };
  },
});
