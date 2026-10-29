import { Injectable, computed, inject, signal } from '@angular/core';

import { DataSource } from '../data/data-source';
import { Character, CharacterRecord, normalizeCharacter } from '../models/character';
import { SettingsService } from '../settings/settings.service';
import { LocalDb } from '../storage/local-db';

/**
 * Characters stored on this device. Every save goes here first (it works without a connection)
 * and marks the character as 'local' — not saved to the cloud yet. pull() brings the repo's
 * characters here; pushing local changes to the repo comes with the sync engine (next phase).
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

  load(): Promise<void> {
    this.loaded ??= this.db
      .getAll<CharacterRecord>('characters')
      .then((rs) => this.records.set(rs));
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
      status: 'local',
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
      await this.db.delete('characters', id);
      this.records.update((rs) => rs.filter((r) => r.character.id !== id));
      return;
    }
    await this.write({ ...record, status: 'pending-delete' });
  }

  /**
   * Brings the repo's characters onto the device (the download half of the sync):
   * - new in the repo → stored as 'synced'
   * - changed in the repo, unchanged here → updated, still 'synced'
   * - 'sent' and the repo now has exactly what was sent → confirmed, 'synced'
   * - changed in the repo AND here → 'conflict', keeping both versions for the user to choose
   * Never overwrites local changes and never deletes anything.
   */
  async pull(source: DataSource): Promise<{ added: number; updated: number; conflicts: number }> {
    await this.load();
    const result = { added: 0, updated: 0, conflicts: 0 };
    for (const file of await source.listJson('characters')) {
      const id = file.path.replace(/^characters\//, '').replace(/\.json$/, '');
      const local = this.records().find((r) => r.character.id === id);
      if (local && (local.baseSha === file.sha || local.status === 'conflict')) continue;
      if (local?.status === 'sent' && local.sentSha === file.sha) {
        await this.write({ ...local, status: 'synced', baseSha: file.sha, sentSha: null });
        continue;
      }
      if (local?.status === 'pending-delete') continue;
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
        await this.write({ ...local, status: 'conflict', remote, baseSha: remoteFile.sha });
      }
    }
    return result;
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
