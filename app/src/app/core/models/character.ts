import { Ability } from './compendium';

/**
 * A character file (characters/<id>.json). It stores choices only; everything derivable
 * (modifiers, proficiency bonus, slots...) is computed by the rules engine when loaded.
 */
export interface Character {
  schemaVersion: 1;
  id: string;
  name: string;
  /** meta.generatedAt of the data the character was built with. */
  dataVersion: string | null;
  /** When and from which device (Settings → device name) it was last edited. */
  updatedAt: string;
  updatedBy: string;
  species: { id: string; variant: string | null } | null;
  background: { id: string; abilityIncreases: Partial<Record<Ability, number>> } | null;
  classes: { id: string; level: number; subclassId: string | null; hp: number[] }[];
  abilityScores: {
    method: 'standard' | 'point-buy' | 'roll' | 'manual';
    base: Record<Ability, number>;
  } | null;
  choices: { skills: string[]; feats: string[]; options: string[]; spells: string[] };
  equipment: string;
  state: {
    hpCurrent: number | null;
    hpTemp: number;
    spentSlots: number[];
    resources: Record<string, number>;
  };
  notes: string;
}

/**
 * Where a character stands with respect to the repository ("the cloud").
 *
 * local          → only on this device, or changed here since the last save to the repo
 * sent           → commit sent to GitHub, not yet confirmed by reading it back
 * synced         → the repo file is identical to the local copy
 * conflict       → the repo has a different version than the one this device started from
 * pending-delete → deleted here; the repo file will be removed on the next sync
 */
export type SyncStatus = 'local' | 'sent' | 'synced' | 'conflict' | 'pending-delete';

/** What the device stores for each character. */
export interface CharacterRecord {
  character: Character;
  status: SyncStatus;
  /** Git blob sha of the repo version this local copy is based on (null if never in the repo). */
  baseSha: string | null;
  /** Git blob sha of the content sent in the last commit, while status is 'sent'. */
  sentSha: string | null;
  /** The repo version, while status is 'conflict'. */
  remote: Character | null;
}

export function newCharacter(name: string, device: string): Character {
  const slug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // "José" → "jose"
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'character';
  return {
    schemaVersion: 1,
    id: `${slug}-${Date.now()}`,
    name,
    dataVersion: null,
    updatedAt: new Date().toISOString(),
    updatedBy: device,
    species: null,
    background: null,
    classes: [],
    abilityScores: null,
    choices: { skills: [], feats: [], options: [], spells: [] },
    equipment: '',
    state: { hpCurrent: null, hpTemp: 0, spentSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0], resources: {} },
    notes: '',
  };
}
