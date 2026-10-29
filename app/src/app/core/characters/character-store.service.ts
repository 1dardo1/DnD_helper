import { Injectable, computed, inject, signal } from '@angular/core';

import { Character, CharacterRecord } from '../models/character';
import { SettingsService } from '../settings/settings.service';
import { LocalDb } from '../storage/local-db';

/**
 * Characters stored on this device. Every save goes here first (it works without a connection)
 * and marks the character as 'local' — not saved to the cloud yet. Pushing to the repo and
 * confirming it (local → sent → synced, conflicts) is the sync engine's job (next phase).
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
