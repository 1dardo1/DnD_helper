import { Encounter } from './encounter';
import { EncounterFile } from './encounter-crypto';

/**
 * How an encounter is kept on the device (IndexedDB, store "encounters") and how it's
 * synchronised with the repo. Pure functions: EncounterStore applies them.
 *
 * On the device an encounter is kept encrypted too (`file`, exactly what goes to the repo); it's
 * decrypted in memory once its key is unlocked. `plain` only holds encounters made before the
 * DM's password existed, until it's set or unlocked.
 *
 * Encounters have a single author (the DM), so a version that changed on two devices isn't kept
 * twice as characters are: the latest change (updatedAt) wins, and a change made here wins over a
 * deletion made elsewhere (nothing edited is lost silently).
 */
export type EncounterStatus = 'local' | 'synced' | 'pending-delete';

export interface EncounterRecord {
  id: string;
  /** Encrypted content: the repo's version, or this device's latest (status 'local'). */
  file: EncounterFile | null;
  /** Only for encounters saved before there was a password (older versions of the app). */
  plain?: Encounter | null;
  status: EncounterStatus;
  /** Sha of the repo version this one is based on (null: never uploaded). */
  baseSha: string | null;
  updatedAt: string;
}

/** Id of the key that encrypts it (the salt), null if it isn't encrypted yet. */
export function keyIdOf(r: EncounterRecord): string | null {
  return r.file?.enc.salt ?? null;
}

/** After listing the repo: whether the file of an encounter needs to be read. */
export function needsDownload(local: EncounterRecord | undefined, remoteSha: string): boolean {
  if (!local) return true;
  if (local.baseSha === remoteSha) return false;
  // deleted here: the deletion is uploaded instead
  return local.status !== 'pending-delete';
}

/** A repo version that differs from ours: take it, or keep ours (uploaded next). */
export function mergeRemote(
  local: EncounterRecord | undefined,
  remoteUpdatedAt: string,
): 'take-remote' | 'keep-local' {
  if (!local || local.status === 'synced') return 'take-remote';
  if (local.status === 'pending-delete') return 'keep-local';
  return local.updatedAt >= remoteUpdatedAt ? 'keep-local' : 'take-remote';
}

/** An encounter of ours that isn't in the repo. */
export function missingInRepo(local: EncounterRecord): 'forget' | 'upload-as-new' | 'keep' {
  if (local.status === 'pending-delete') return 'forget';
  if (local.status === 'synced') return local.baseSha ? 'forget' : 'keep'; // deleted elsewhere
  // changed here: deleted elsewhere meanwhile, but this change isn't lost
  return local.baseSha ? 'upload-as-new' : 'keep';
}

/** What to send for one encounter. 'wait': it can't be encrypted until a password is entered. */
export function pushAction(
  r: EncounterRecord,
  repoSha: string | null,
): 'upload' | 'delete' | 'forget' | 'wait' | 'none' {
  if (r.status === 'pending-delete') return repoSha ? 'delete' : 'forget';
  if (r.status !== 'local') return 'none';
  return r.file ? 'upload' : 'wait';
}
