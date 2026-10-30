import { Injectable, computed, inject, signal } from '@angular/core';

import { ConflictError, DataSource, DataSourceError } from '../data/data-source';
import { Character, CharacterRecord, normalizeCharacter } from '../models/character';
import { SettingsService } from '../settings/settings.service';
import { LocalDb } from '../storage/local-db';

export interface SyncResult {
  added: number;
  updated: number;
  uploaded: number;
  deleted: number;
  conflicts: number;
}

/**
 * Characters stored on this device, and their synchronisation with the repo ("the cloud").
 *
 * Every save goes to the device first (works offline) as 'local'. pull() brings repo changes here,
 * push() sends local changes to the repo, one commit per character:
 *   local → (commit) → sent → (read back, same sha) → synced
 * If the repo changed meanwhile, the commit is refused and the character becomes 'conflict',
 * keeping both versions until the user picks one. Nothing is ever overwritten silently.
 */
@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly db = inject(LocalDb);
  private readonly settings = inject(SettingsService);

  private readonly records = signal<CharacterRecord[]>([]);
  private loaded?: Promise<void>;

  readonly all = computed(() =>
    this.records()
      .filter((r) => r.status !== 'pending-delete')
      .sort((a, b) => a.character.name.localeCompare(b.character.name)),
  );
  readonly conflicts = computed(() => this.all().filter((r) => r.status === 'conflict'));
  /** Characters with changes not confirmed in the repo yet. */
  readonly pending = computed(
    () => this.records().filter((r) => r.status !== 'synced' && r.status !== 'conflict').length,
  );

  load(): Promise<void> {
    // Records saved by an older version of the app get the fields added since.
    this.loaded ??= this.db.getAll<CharacterRecord>('characters').then((rs) =>
      this.records.set(
        rs.map((r) => ({
          ...r,
          character: normalizeCharacter(r.character) ?? r.character,
          remote: r.remote ? (normalizeCharacter(r.remote) ?? r.remote) : r.remote,
        })),
      ),
    );
    return this.loaded;
  }

  async get(id: string): Promise<CharacterRecord | undefined> {
    await this.load();
    return this.records().find((r) => r.character.id === id);
  }

  /** Saves on the device and marks the character as pending upload. */
  async save(character: Character): Promise<CharacterRecord> {
    await this.load();
    const previous = this.records().find((r) => r.character.id === character.id);
    const record: CharacterRecord = {
      character: {
        ...character,
        updatedAt: new Date().toISOString(),
        updatedBy: this.deviceName(),
      },
      // a conflict stays a conflict until the user resolves it
      status: previous?.status === 'conflict' ? 'conflict' : 'local',
      baseSha: previous?.baseSha ?? null,
      sentSha: null,
      remote: previous?.remote ?? null,
    };
    await this.write(record);
    return record;
  }

  /** Marks for deletion; a never-uploaded character is simply removed. */
  async remove(id: string): Promise<void> {
    const record = await this.get(id);
    if (!record) return;
    if (!record.baseSha) {
      await this.forget(id);
      return;
    }
    await this.write({ ...record, status: 'pending-delete' });
  }

  // -- conflicts --------------------------------------------------------------------

  /** Keep this device's version: it will replace the repo's on the next push. */
  async keepLocal(id: string): Promise<void> {
    const r = await this.get(id);
    if (r?.status !== 'conflict') return;
    // baseSha already points at the repo version, so the commit will be accepted
    await this.write({ ...r, status: 'local', remote: null, sentSha: null });
  }

  /** Keep the repo's version, discarding this device's changes. */
  async keepRemote(id: string): Promise<void> {
    const r = await this.get(id);
    if (r?.status !== 'conflict' || !r.remote) return;
    await this.write({ ...r, character: r.remote, status: 'synced', remote: null, sentSha: null });
  }

  /** Keep both: the repo's version stays as is, this device's becomes a new character "(copy)". */
  async keepBoth(id: string, copySuffix: string): Promise<Character | undefined> {
    const r = await this.get(id);
    if (r?.status !== 'conflict' || !r.remote) return undefined;
    const copy: Character = {
      ...r.character,
      id: `${id}-${Date.now()}`,
      name: `${r.character.name} (${copySuffix})`,
    };
    await this.write({ ...r, character: r.remote, status: 'synced', remote: null, sentSha: null });
    await this.write({
      character: copy,
      status: 'local',
      baseSha: null,
      sentSha: null,
      remote: null,
    });
    return copy;
  }

  // -- sync -------------------------------------------------------------------------

  /** Download: new and changed repo characters, confirmations, and conflicts. Never deletes. */
  async pull(source: DataSource): Promise<SyncResult> {
    await this.load();
    const result = emptyResult();
    for (const file of await source.listJson('characters')) {
      const id = idOf(file.path);
      const local = this.records().find((r) => r.character.id === id);
      if (local && (local.baseSha === file.sha || local.status === 'conflict')) continue;
      if (local?.status === 'pending-delete') continue;
      if (local?.status === 'sent' && local.sentSha === file.sha) {
        await this.confirm(local, file.sha);
        continue;
      }
      const remoteFile = await source.readJsonWithSha<unknown>(file.path);
      const remote = normalizeCharacter(remoteFile?.content);
      if (!remoteFile || !remote) continue;
      if (!local) {
        result.added++;
        await this.write({
          character: remote,
          status: 'synced',
          baseSha: remoteFile.sha,
          sentSha: null,
          remote: null,
        });
      } else if (local.status === 'synced') {
        result.updated++;
        await this.write({ ...local, character: remote, baseSha: remoteFile.sha });
      } else {
        result.conflicts++;
        await this.write({
          ...local,
          status: 'conflict',
          remote,
          baseSha: remoteFile.sha,
          sentSha: null,
        });
      }
    }
    return result;
  }

  /**
   * Upload: one commit per character with local changes, then reads it back to confirm.
   * Network problems leave the character as it was, to retry on the next sync.
   */
  async push(source: DataSource): Promise<SyncResult> {
    await this.load();
    const result = emptyResult();
    if (!source.canWrite) return result;
    const inRepo = new Map((await source.listJson('characters')).map((f) => [idOf(f.path), f]));
    for (const r of [...this.records()]) {
      const path = pathOf(r.character.id);
      const repoSha = inRepo.get(r.character.id)?.sha ?? null;
      try {
        if (r.status === 'sent') {
          // A commit sent earlier and never confirmed (e.g. the app was closed).
          if (repoSha && repoSha === r.sentSha) {
            await this.confirm(r, repoSha);
            continue;
          }
          if (repoSha !== r.baseSha) {
            result.conflicts += await this.markConflict(source, r);
            continue;
          }
          // the commit never made it: send it again below
        }
        if (r.status === 'local' || r.status === 'sent') {
          const message = `Personaje: guardar "${r.character.name}" desde ${r.character.updatedBy}`;
          const written = await source.writeJson(path, r.character, r.baseSha, message);
          const edited = this.editedSince(r);
          if (edited) {
            // saved again while the commit was on its way: that edit goes in the next commit
            await this.write({ ...edited, baseSha: written.sha, sentSha: null });
            result.uploaded++;
            continue;
          }
          const sent: CharacterRecord = { ...r, status: 'sent', sentSha: written.sha };
          await this.write(sent);
          await this.verify(source, sent);
          result.uploaded++;
        } else if (r.status === 'pending-delete') {
          if (!repoSha) {
            await this.forget(r.character.id);
          } else if (repoSha !== r.baseSha) {
            // Changed elsewhere after this device deleted it: keep the other version, don't lose it.
            await this.restoreFromRepo(source, r);
          } else {
            await source.deleteFile(path, repoSha, `Personaje: borrar "${r.character.name}"`);
            await this.forget(r.character.id);
            result.deleted++;
          }
        }
      } catch (e) {
        if (e instanceof ConflictError) {
          if (r.status === 'pending-delete') await this.restoreFromRepo(source, r);
          else result.conflicts += await this.markConflict(source, r);
        } else if (!(e instanceof DataSourceError)) {
          throw e;
        }
        // DataSourceError (offline, GitHub down...): try again next time
      }
    }
    return result;
  }

  // -- internals ----------------------------------------------------------------------

  /** After a commit: read the file back; 'synced' only when the repo has exactly what was sent. */
  private async verify(source: DataSource, r: CharacterRecord): Promise<void> {
    const file = await source
      .listJson('characters')
      .then((fs) => fs.find((f) => idOf(f.path) === r.character.id));
    if (file && file.sha === r.sentSha) await this.confirm(r, file.sha);
  }

  private async confirm(r: CharacterRecord, sha: string): Promise<void> {
    const edited = this.editedSince(r);
    if (edited) {
      await this.write({ ...edited, baseSha: sha, sentSha: null });
      return;
    }
    await this.write({ ...r, status: 'synced', baseSha: sha, sentSha: null, remote: null });
  }

  /** The current record, if the character was saved again after `r` was read (sync is async). */
  private editedSince(r: CharacterRecord): CharacterRecord | null {
    const current = this.records().find((x) => x.character.id === r.character.id);
    return current && current.character !== r.character ? current : null;
  }

  private async markConflict(source: DataSource, r: CharacterRecord): Promise<number> {
    const file = await source.readJsonWithSha<unknown>(pathOf(r.character.id));
    const remote = normalizeCharacter(file?.content);
    if (!file || !remote) {
      // the repo copy is gone: what's here is the only version, upload it as new
      await this.write({ ...r, status: 'local', baseSha: null, sentSha: null });
      return 0;
    }
    await this.write({ ...r, status: 'conflict', remote, baseSha: file.sha, sentSha: null });
    return 1;
  }

  private async restoreFromRepo(source: DataSource, r: CharacterRecord): Promise<void> {
    const file = await source.readJsonWithSha<unknown>(pathOf(r.character.id));
    const remote = normalizeCharacter(file?.content);
    if (!file || !remote) {
      await this.forget(r.character.id);
      return;
    }
    await this.write({
      character: remote,
      status: 'synced',
      baseSha: file.sha,
      sentSha: null,
      remote: null,
    });
  }

  private async forget(id: string): Promise<void> {
    await this.db.delete('characters', id);
    this.records.update((rs) => rs.filter((r) => r.character.id !== id));
  }

  private deviceName(): string {
    return this.settings.settings().deviceName || navigator.platform || 'device';
  }

  private async write(record: CharacterRecord): Promise<void> {
    await this.db.put('characters', record.character.id, record);
    this.records.update((rs) => [
      ...rs.filter((r) => r.character.id !== record.character.id),
      record,
    ]);
  }
}

function emptyResult(): SyncResult {
  return { added: 0, updated: 0, uploaded: 0, deleted: 0, conflicts: 0 };
}

function pathOf(id: string): string {
  return `characters/${id}.json`;
}

function idOf(path: string): string {
  return path.replace(/^characters\//, '').replace(/\.json$/, '');
}
