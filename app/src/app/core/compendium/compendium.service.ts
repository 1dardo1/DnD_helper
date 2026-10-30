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
  private readonly files = new Map<string, Promise<unknown[]>>();

  /** True when the data shown comes from the device cache because the repo couldn't be reached. */
  readonly offline = signal(false);

  getMeta(): Promise<DataMeta> {
    this.meta ??= this.loadMeta().catch((e) => {
      this.meta = undefined;
      throw e;
    });
    return this.meta;
  }

  /** The entries in English: what the rules use. */
  all<T extends EntryType>(type: T): Promise<EntryByType[T][]> {
    return this.file(type, '') as Promise<EntryByType[T][]>;
  }

  /**
   * The same entries translated (data/es/*.json): same ids and structure, only the texts people
   * read change. Only for showing them; see DataTextService.
   */
  translated<T extends EntryType>(type: T, language: string): Promise<EntryByType[T][]> {
    return this.file(type, `${language}/`) as Promise<EntryByType[T][]>;
  }

  private file(type: EntryType, folder: string): Promise<unknown[]> {
    const key = folder + type;
    if (!this.files.has(key)) {
      const p = this.loadFile(type, folder).catch((e) => {
        this.files.delete(key);
        throw e;
      });
      this.files.set(key, p);
    }
    return this.files.get(key)!;
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

  private async loadFile(type: EntryType, folder: string): Promise<unknown[]> {
    const meta = await this.getMeta();
    const key = `file:${folder}${type}`;
    const cached = await this.db.get<CachedFile<unknown>>('compendium', key);
    // A new extraction or a new translation run downloads the files again.
    const version = `${meta.generatedAt}|${meta.translatedAt ?? ''}`;
    if (cached && cached.generatedAt === version) return cached.entries;
    const source = this.repo.source();
    if (!source) {
      if (cached) return cached.entries;
      throw new Error('no data source configured');
    }
    try {
      const entries = await source.readJson<unknown[]>(`data/${folder}${DATA_FILES[type]}.json`);
      await this.db.put('compendium', key, { generatedAt: version, entries });
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
