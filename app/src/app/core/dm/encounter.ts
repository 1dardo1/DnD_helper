/**
 * A combat encounter prepared by the DM: who fights (the party, by level) and against what
 * (compendium monsters, with how many of each). Stored on this device only (EncounterStore).
 */
export interface Encounter {
  id: string;
  name: string;
  /** One entry per character. characterId/name when it was taken from a saved character. */
  party: PartyMember[];
  monsters: EncounterMonster[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartyMember {
  /** Character level, 1–20 (total level for a multiclassed character). */
  level: number;
  characterId?: string;
  name?: string;
}

export interface EncounterMonster {
  /** Id of a compendium monster (data/monsters.json). */
  monsterId: string;
  /** 1 or more. */
  count: number;
}

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}

/** A new, empty encounter. */
export function newEncounter(name: string, now = new Date()): Encounter {
  const at = now.toISOString();
  return {
    id: `enc-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    party: [],
    monsters: [],
    notes: '',
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * A stored encounter made valid: levels within 1–20, counts of 1 or more (monsters at 0 dropped,
 * repeated monsters merged), missing fields filled in.
 */
export function normalizeEncounter(e: Partial<Encounter> & { id: string }): Encounter {
  const monsters: EncounterMonster[] = [];
  for (const m of e.monsters ?? []) {
    const count = Math.floor(Number(m?.count) || 0);
    if (!m?.monsterId || count < 1) continue;
    const same = monsters.find((x) => x.monsterId === m.monsterId);
    if (same) same.count += count;
    else monsters.push({ monsterId: m.monsterId, count });
  }
  const at = e.updatedAt ?? e.createdAt ?? new Date(0).toISOString();
  return {
    id: e.id,
    name: e.name ?? '',
    party: (e.party ?? []).map((p) => ({
      ...(p.characterId ? { characterId: p.characterId } : {}),
      ...(p.name ? { name: p.name } : {}),
      level: clampLevel(Number(p.level)),
    })),
    monsters,
    notes: e.notes ?? '',
    createdAt: e.createdAt ?? at,
    updatedAt: at,
  };
}
