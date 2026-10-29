import { Injectable, signal } from '@angular/core';

/**
 * Minimal key-value store on IndexedDB, the browser's on-device database.
 * compendium → cached data/*.json (to work offline); characters → CharacterRecord by id.
 * Where IndexedDB isn't available (some private modes, tests) it keeps data in memory
 * for the session and says so through `persistent`.
 */
export type StoreName = 'compendium' | 'characters';

const DB_NAME = 'dnd-helper';
const DB_VERSION = 1;
const STORES: StoreName[] = ['compendium', 'characters'];

@Injectable({ providedIn: 'root' })
export class LocalDb {
  private db?: Promise<IDBDatabase | null>;
  private readonly memory = new Map<StoreName, Map<string, unknown>>(
    STORES.map((s) => [s, new Map()]),
  );

  /** False when data only lives until the page is closed. */
  readonly persistent = signal(true);

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    if (!(await this.open()))
      return structuredClone(this.memory.get(store)!.get(key)) as T | undefined;
    return this.run(store, 'readonly', (s) => s.get(key));
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    if (!(await this.open())) return structuredClone([...this.memory.get(store)!.values()]) as T[];
    return this.run(store, 'readonly', (s) => s.getAll());
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    if (!(await this.open())) {
      this.memory.get(store)!.set(key, structuredClone(value));
      return;
    }
    await this.run(store, 'readwrite', (s) => s.put(value, key));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    if (!(await this.open())) {
      this.memory.get(store)!.delete(key);
      return;
    }
    await this.run(store, 'readwrite', (s) => s.delete(key));
  }

  async clear(store: StoreName): Promise<void> {
    if (!(await this.open())) {
      this.memory.get(store)!.clear();
      return;
    }
    await this.run(store, 'readwrite', (s) => s.clear());
  }

  private open(): Promise<IDBDatabase | null> {
    this.db ??= new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    }).then((db) => {
      this.persistent.set(!!db);
      return db;
    });
    return this.db;
  }

  private async run<R>(
    store: StoreName,
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest,
  ): Promise<R> {
    const db = (await this.open())!;
    return new Promise<R>((resolve, reject) => {
      const req = op(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as R);
      req.onerror = () => reject(req.error);
    });
  }
}
