import { Injectable, computed, inject, signal } from '@angular/core';

import { ConflictError, DataSource, DataSourceError } from '../data/data-source';
import { SettingsService } from '../settings/settings.service';
import { LocalDb } from '../storage/local-db';
import { CustomBackground, HOMEBREW_DIR, normalizeCustomBackground } from './custom-background';
import {
  BackgroundImportPlan,
  HomebrewRecord,
  HomebrewSyncResult,
  decideMissingRemote,
  decideRemoteChange,
  emptySyncResult,
  idOf,
  needsRead,
  pathOf,
  planBackgroundImport,
  toPush,
} from './homebrew-sync';

/**
 * The user's own backgrounds: on this device (IndexedDB, store "homebrew") and, when GitHub is
 * set up, as homebrew/backgrounds/<id>.json in the repo. Not part of the extracted compendium
 * (data/), which the extractor regenerates; CompendiumService merges them into the background list.
 * Last writer wins (updatedAt); no authentication, the "DM approved" tick is an honour system.
 */
@Injectable({ providedIn: 'root' })
export class HomebrewStore {
  private readonly db = inject(LocalDb);
  private readonly settings = inject(SettingsService);

  private readonly records = signal<HomebrewRecord[]>([]);
  private loaded?: Promise<void>;

  /** Changes with every write: lists and details reload when it does. */
  readonly revision = signal(0);
  /** Not marked for deletion, by name. */
  readonly backgrounds = computed(() =>
    this.records()
      .filter((r) => r.status !== 'pending-delete')
      .map((r) => r.background)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  /** Changes not uploaded yet. */
  readonly pending = computed(() => this.records().filter((r) => r.status !== 'synced').length);

  load(): Promise<void> {
    this.loaded ??= this.db.getAll<HomebrewRecord>('homebrew').then((rs) => {
      const valid: HomebrewRecord[] = [];
      for (const r of rs) {
        const background = normalizeCustomBackground(r?.background);
        if (background) valid.push({ ...r, background });
      }
      this.records.set(valid);
      this.revision.update((n) => n + 1);
    });
    return this.loaded;
  }

  async get(id: string): Promise<CustomBackground | undefined> {
    await this.load();
    return this.backgrounds().find((b) => b.id === id);
  }

  /** Saves on the device (the sync uploads it). */
  async save(background: CustomBackground): Promise<CustomBackground> {
    await this.load();
    const previous = this.find(background.id);
    await this.write({
      background,
      status: 'local',
      baseSha: previous?.baseSha ?? null,
    });
    return background;
  }

  /** The "the DM approved it" tick. Counts as an edit (so it syncs). */
  async setApproved(id: string, approved: boolean): Promise<void> {
    const r = this.find(id);
    if (!r || r.background.dmApproved === approved) return;
    await this.save({
      ...r.background,
      dmApproved: approved,
      updatedAt: new Date().toISOString(),
      updatedBy: this.deviceName(),
    });
  }

  /** Marks for deletion; one never uploaded is simply removed. */
  async remove(id: string): Promise<void> {
    await this.load();
    const r = this.find(id);
    if (!r) return;
    if (!r.baseSha) await this.forget(id);
    else await this.write({ ...r, status: 'pending-delete' });
  }

  /** From a backup file: new ones and those edited later than here (see planBackgroundImport). */
  async importBackgrounds(incoming: CustomBackground[]): Promise<BackgroundImportPlan> {
    await this.load();
    const plan = planBackgroundImport(
      incoming,
      this.records()
        .filter((r) => r.status !== 'pending-delete')
        .map((r) => r.background),
    );
    for (const background of plan.toWrite) {
      const previous = this.find(background.id);
      await this.write({ background, status: 'local', baseSha: previous?.baseSha ?? null });
    }
    return plan;
  }

  // -- sync -------------------------------------------------------------------------------------

  /** Pull then push. Network problems throw a DataSourceError (the caller reports them). */
  async sync(source: DataSource): Promise<HomebrewSyncResult> {
    await this.load();
    const result = emptySyncResult();
    const files = await source.listJson(HOMEBREW_DIR);
    const inRepo = new Map(files.map((f) => [idOf(f.path), f.sha]));

    for (const file of files) {
      const id = idOf(file.path);
      const local = this.find(id);
      if (!needsRead(local, file.sha)) continue;
      const remote = await this.readRemote(source, id);
      if (!remote) continue;
      inRepo.set(id, remote.sha);
      const action = decideRemoteChange(local, remote.background);
      if (action === 'keep-local') {
        await this.write({ ...local!, baseSha: remote.sha });
      } else {
        await this.write({ background: remote.background, status: 'synced', baseSha: remote.sha });
        if (action === 'add') result.added++;
        else result.updated++;
      }
    }

    if (!source.canWrite) return result;
    for (const r of toPush(this.records(), inRepo)) {
      const id = r.background.id;
      try {
        if (decideMissingRemote(r) === 'forget') {
          const sha = inRepo.get(id);
          if (sha) {
            await source.deleteFile(pathOf(id), sha, `Trasfondo: borrar "${r.background.name}"`);
            result.deleted++;
          }
          await this.forget(id);
        } else if (await this.upload(source, r, inRepo.get(id) ?? null)) {
          result.uploaded++;
        }
      } catch (e) {
        if (!(e instanceof DataSourceError)) throw e;
        // offline, GitHub down, or the file changed meanwhile: the next sync tries again
      }
    }
    return result;
  }

  // -- internals ----------------------------------------------------------------------------------

  /** Uploads one background; if the repo changed under it, the later of the two wins. */
  private async upload(
    source: DataSource,
    r: HomebrewRecord,
    sha: string | null,
  ): Promise<boolean> {
    const message = `Trasfondo: guardar "${r.background.name}" desde ${r.background.updatedBy}`;
    let written;
    try {
      written = await source.writeJson(pathOf(r.background.id), r.background, sha, message);
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      const remote = await this.readRemote(source, r.background.id);
      if (!remote) return false;
      if (decideRemoteChange(r, remote.background) === 'take-remote') {
        await this.write({ background: remote.background, status: 'synced', baseSha: remote.sha });
        return false;
      }
      written = await source.writeJson(pathOf(r.background.id), r.background, remote.sha, message);
    }
    const current = this.find(r.background.id);
    // edited again while the commit was on its way: that edit goes in the next one
    const edited = current && current.background !== r.background;
    await this.write({
      background: edited ? current.background : r.background,
      status: edited ? 'local' : 'synced',
      baseSha: written.sha,
    });
    return true;
  }

  private async readRemote(
    source: DataSource,
    id: string,
  ): Promise<{ background: CustomBackground; sha: string } | null> {
    const file = await source.readJsonWithSha<unknown>(pathOf(id));
    const background = normalizeCustomBackground(file?.content);
    return file && background && background.id === id ? { background, sha: file.sha } : null;
  }

  private find(id: string): HomebrewRecord | undefined {
    return this.records().find((r) => r.background.id === id);
  }

  private deviceName(): string {
    return this.settings.settings().deviceName || navigator.platform || 'device';
  }

  private async forget(id: string): Promise<void> {
    await this.db.delete('homebrew', id);
    this.records.update((rs) => rs.filter((r) => r.background.id !== id));
    this.revision.update((n) => n + 1);
  }

  private async write(record: HomebrewRecord): Promise<void> {
    await this.db.put('homebrew', record.background.id, record);
    this.records.update((rs) => [
      ...rs.filter((r) => r.background.id !== record.background.id),
      record,
    ]);
    this.revision.update((n) => n + 1);
  }
}
