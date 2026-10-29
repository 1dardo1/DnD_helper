import { Injectable } from '@angular/core';

/**
 * Minimal key-value store on IndexedDB, the browser's on-device database.
 * compendium → cached data/*.json (to work offline); characters → CharacterRecord by id.
 */
export type StoreName = 'compendium' | 'characters';

const DB_NAME = 'dnd-helper';
const DB_VERSION = 1;
const STORES: StoreName[] = ['compendium', 'characters'];

@Injectable({ providedIn: 'root' })
export class LocalDb {
  private db?: Promise<IDBDatabase>;

  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.run(store, 'readonly', (s) => s.get(key));
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return this.run(store, 'readonly', (s) => s.getAll());
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    await this.run(store, 'readwrite', (s) => s.put(value, key));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    await this.run(store, 'readwrite', (s) => s.delete(key));
  }

  async clear(store: StoreName): Promise<void> {
    await this.run(store, 'readwrite', (s) => s.clear());
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  private async run<R>(
    store: StoreName,
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest,
  ): Promise<R> {
    const db = await this.open();
    return new Promise<R>((resolve, reject) => {
      const req = op(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as R);
      req.onerror = () => reject(req.error);
    });
  }
}
