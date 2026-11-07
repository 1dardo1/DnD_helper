import { DIFFICULTIES, Difficulty } from './encounter-difficulty';

/**
 * A combat encounter prepared by the DM: who fights (the party, by level) and against what
 * (compendium monsters, with how many of each). Kept by EncounterStore: on the device, and in the
 * repo encrypted with the DM's password (encounter-crypto.ts).
 */
export interface Encounter {
  id: string;
  name: string;
  /**
   * Free-text folder name the DM put this encounter in, for organizing the encounter list
   * (core/organize/folders.ts); null/absent = no folder. It's encrypted and synced with the rest
   * of the encounter (encounter-crypto.ts), not a separate entity. The list of folders the DM has
   * created is a local-only preference (core/organize/folder-prefs.ts), not synced.
   */
  folder?: string | null;
  /** One entry per character. characterId/name when it was taken from a saved character. */
  party: PartyMember[];
  monsters: EncounterMonster[];
  notes: string;
  /** The difficulty the DM aims for (the balancing advice); Moderate when missing. */
  target?: Difficulty;
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

/**
 * A random id ("enc-" and 16 hex digits). It names the encounter's file in the public repo, so it
 * says nothing about the encounter (not its name, nor when it was created).
 */
export function newEncounterId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `enc-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** A new, empty encounter. */
export function newEncounter(name: string, now = new Date()): Encounter {
  const at = now.toISOString();
  return {
    id: newEncounterId(),
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
  const folder = typeof e.folder === 'string' && e.folder.trim() ? e.folder.trim() : null;
  return {
    id: e.id,
    name: e.name ?? '',
    ...(folder ? { folder } : {}),
    party: (e.party ?? []).map((p) => ({
      ...(p.characterId ? { characterId: p.characterId } : {}),
      ...(p.name ? { name: p.name } : {}),
      level: clampLevel(Number(p.level)),
    })),
    monsters,
    notes: e.notes ?? '',
    ...(e.target && DIFFICULTIES.includes(e.target) ? { target: e.target } : {}),
    createdAt: e.createdAt ?? at,
    updatedAt: at,
  };
}
