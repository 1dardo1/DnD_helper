import { HOMEBREW_DIR, CustomBackground } from './custom-background';

/**
 * Decisions of the synchronisation of custom backgrounds with the repo (homebrew/backgrounds/).
 * Simple on purpose: the last writer wins, by `updatedAt`. Pure functions; HomebrewStore does the I/O.
 *
 *   local → (push) → synced      pending-delete → (push) → forgotten
 */
export type HomebrewStatus = 'local' | 'synced' | 'pending-delete';

export interface HomebrewRecord {
  background: CustomBackground;
  status: HomebrewStatus;
  /** Sha of the repo file this record is based on (null: never uploaded). */
  baseSha: string | null;
}

export interface HomebrewSyncResult {
  added: number;
  updated: number;
  uploaded: number;
  deleted: number;
}

export const emptySyncResult = (): HomebrewSyncResult => ({
  added: 0,
  updated: 0,
  uploaded: 0,
  deleted: 0,
});

export const pathOf = (id: string) => `${HOMEBREW_DIR}/${id}.json`;
export const idOf = (path: string) => path.replace(/^.*\//, '').replace(/\.json$/, '');

const time = (iso: string) => Date.parse(iso) || 0;

/**
 * Whether the repo file has to be read: it's new here, or changed since this device last saw it.
 * A background marked for deletion is not read (the push decides).
 */
export function needsRead(local: HomebrewRecord | undefined, fileSha: string): boolean {
  if (!local) return true;
  if (local.status === 'pending-delete') return false;
  return local.baseSha !== fileSha;
}

export type RemoteChange = 'add' | 'take-remote' | 'keep-local';

/**
 * The repo has a version this device hasn't seen. A synced background simply takes it; one with
 * changes here keeps whichever was written later (equal times: the repo's, which every device sees).
 */
export function decideRemoteChange(
  local: HomebrewRecord | undefined,
  remote: CustomBackground,
): RemoteChange {
  if (!local) return 'add';
  if (local.status === 'synced') return 'take-remote';
  return time(remote.updatedAt) >= time(local.background.updatedAt) ? 'take-remote' : 'keep-local';
}

/** A local record whose file is gone from the repo: deleted elsewhere. Safe choice: upload it again. */
export function decideMissingRemote(local: HomebrewRecord): 'upload' | 'forget' {
  return local.status === 'pending-delete' ? 'forget' : 'upload';
}

/** The records that have something to send: edited ones, and synced ones whose file vanished. */
export function toPush(
  records: readonly HomebrewRecord[],
  inRepo: ReadonlyMap<string, string>,
): HomebrewRecord[] {
  return records.filter(
    (r) =>
      r.status === 'local' ||
      r.status === 'pending-delete' ||
      (r.status === 'synced' && !inRepo.has(r.background.id)),
  );
}

// -- backups -------------------------------------------------------------------------------------

export interface BackgroundImportPlan {
  /** To write on this device: new ones, and those in the file edited later than here. */
  toWrite: CustomBackground[];
  added: number;
  updated: number;
  skipped: number;
}

/** What importing backgrounds from a backup does: the most recently edited version of each id wins. */
export function planBackgroundImport(
  incoming: readonly CustomBackground[],
  existing: readonly CustomBackground[],
): BackgroundImportPlan {
  const latest = new Map<string, CustomBackground>();
  for (const b of incoming) {
    const seen = latest.get(b.id);
    if (!seen || time(b.updatedAt) > time(seen.updatedAt)) latest.set(b.id, b);
  }
  const here = new Map(existing.map((b) => [b.id, b]));
  const plan: BackgroundImportPlan = { toWrite: [], added: 0, updated: 0, skipped: 0 };
  for (const b of latest.values()) {
    const mine = here.get(b.id);
    if (!mine) {
      plan.toWrite.push(b);
      plan.added++;
    } else if (time(b.updatedAt) > time(mine.updatedAt)) {
      plan.toWrite.push(b);
      plan.updated++;
    } else plan.skipped++;
  }
  return plan;
}
