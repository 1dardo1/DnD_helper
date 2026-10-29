import { Injectable, inject, signal } from '@angular/core';

import { DATA_FILES, DataMeta, EntryByType, EntryType } from '../models/compendium';
import { RepositoryService } from '../data/repository.service';
import { LocalDb } from '../storage/local-db';

interface CachedFile<T> {
  generatedAt: string;
  entries: T[];
}

/**
 * The compendium (data/*.json). Files are cached on the device and downloaded again only when
 * data/meta.json says there's a new extraction, so it keeps working without a connection.
 */
@Injectable({ providedIn: 'root' })
export class CompendiumService {
  private readonly repo = inject(RepositoryService);
  private readonly db = inject(LocalDb);

  private meta?: Promise<DataMeta>;
  private readonly files = new Map<EntryType, Promise<unknown[]>>();

  /** True when the data shown comes from the device cache because the repo couldn't be reached. */
  readonly offline = signal(false);

  getMeta(): Promise<DataMeta> {
    this.meta ??= this.loadMeta().catch((e) => {
      this.meta = undefined;
      throw e;
    });
    return this.meta;
  }

  all<T extends EntryType>(type: T): Promise<EntryByType[T][]> {
    if (!this.files.has(type)) {
      const p = this.loadFile(type).catch((e) => {
        this.files.delete(type);
        throw e;
      });
      this.files.set(type, p);
    }
    return this.files.get(type) as Promise<EntryByType[T][]>;
  }

  async get<T extends EntryType>(type: T, id: string): Promise<EntryByType[T] | undefined> {
    return (await this.all(type)).find((e) => e.id === id);
  }

  /** Re-check the data source on next use (e.g. after changing Settings); the device cache stays. */
  reset(): void {
    this.meta = undefined;
    this.files.clear();
  }

  /** Forget everything cached (memory and device) and download again on next use. */
  async refresh(): Promise<void> {
    this.reset();
    await this.db.clear('compendium');
  }

  private async loadMeta(): Promise<DataMeta> {
    const source = this.repo.source();
    if (source) {
      try {
        const meta = await source.readJson<DataMeta>('data/meta.json');
        await this.db.put('compendium', 'meta', meta);
        this.offline.set(false);
        return meta;
      } catch (e) {
        const cached = await this.db.get<DataMeta>('compendium', 'meta');
        if (cached) {
          this.offline.set(true);
          return cached;
        }
        throw e;
      }
    }
    const cached = await this.db.get<DataMeta>('compendium', 'meta');
    if (cached) return cached;
    throw new Error('no data source configured');
  }

  private async loadFile(type: EntryType): Promise<unknown[]> {
    const meta = await this.getMeta();
    const key = `file:${type}`;
    const cached = await this.db.get<CachedFile<unknown>>('compendium', key);
    if (cached && cached.generatedAt === meta.generatedAt) return cached.entries;
    const source = this.repo.source();
    if (!source) {
      if (cached) return cached.entries;
      throw new Error('no data source configured');
    }
    try {
      const entries = await source.readJson<unknown[]>(`data/${DATA_FILES[type]}.json`);
      await this.db.put('compendium', key, { generatedAt: meta.generatedAt, entries });
      return entries;
    } catch (e) {
      if (cached) {
        this.offline.set(true);
        return cached.entries;
      }
      throw e;
    }
  }
}
