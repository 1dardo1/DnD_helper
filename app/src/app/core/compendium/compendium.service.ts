import { Injectable, inject, signal } from '@angular/core';

import { DATA_FILES, DataMeta, EntryByType, EntryType } from '../models/compendium';
import { RepositoryService } from '../data/repository.service';
import { HomebrewStore } from '../homebrew/homebrew-store.service';
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
  private readonly homebrew = inject(HomebrewStore);

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
    if (type === 'background') return this.withCustomBackgrounds() as Promise<EntryByType[T][]>;
    return this.file(type, '') as Promise<EntryByType[T][]>;
  }

  /** The official backgrounds plus the user's own (HomebrewStore), flagged `custom`. */
  private async withCustomBackgrounds(): Promise<EntryByType['background'][]> {
    const [official] = await Promise.all([
      this.file('background', '') as Promise<EntryByType['background'][]>,
      this.homebrew.load(),
    ]);
    return [...official, ...this.homebrew.backgrounds()];
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

  /** Try the data source again after a failed load (keeps the device copy, if any). */
  retry(): Promise<DataMeta> {
    this.reset();
    return this.getMeta();
  }

  /** Forget everything cached (memory and device) and download again on next use. */
  async refresh(): Promise<void> {
    this.reset();
    await this.db.clear('compendium');
  }

  /**
   * With data already on the device, how long the network gets to answer data/meta.json before
   * the device's copy is used: a weak connection (one bar, a crowded Wi-Fi) shouldn't keep every
   * page waiting. A later answer is still saved, for the next start.
   */
  metaTimeoutMs = 4000;

  private async loadMeta(): Promise<DataMeta> {
    const source = this.repo.source();
    if (source) {
      const network = source.readJson<DataMeta>('data/meta.json');
      network.catch(() => undefined); // handled below; not an "uncaught" error meanwhile
      const cached = await this.db.get<DataMeta>('compendium', 'meta');
      try {
        const meta = cached ? await withTimeout(network, this.metaTimeoutMs) : await network;
        await this.db.put('compendium', 'meta', meta);
        this.offline.set(false);
        return meta;
      } catch (e) {
        if (cached) {
          network.then((m) => this.db.put('compendium', 'meta', m)).catch(() => undefined);
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

/** The promise's value, or a rejection once `ms` have passed without one. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
