import { Injectable, computed, inject, signal } from '@angular/core';

import { LocalDb } from '../storage/local-db';
import { Encounter, newEncounter, normalizeEncounter } from './encounter';

/**
 * The DM's encounters, saved on this device (IndexedDB, store "encounters"); not synced with the
 * repo. Other DM tools read them by id, e.g. the combat tracker: `await store.get(id)`.
 */
@Injectable({ providedIn: 'root' })
export class EncounterStore {
  private readonly db = inject(LocalDb);
  private readonly items = signal<Encounter[]>([]);
  private loaded?: Promise<void>;

  /** Every encounter, the most recently changed first. */
  readonly all = computed(() =>
    [...this.items()].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name),
    ),
  );

  load(): Promise<void> {
    this.loaded ??= this.db
      .getAll<Encounter>('encounters')
      .then((list) => this.items.set(list.filter((e) => e?.id).map(normalizeEncounter)));
    return this.loaded;
  }

  /** The encounter with this id (a copy: change it and save()), or undefined. */
  async get(id: string): Promise<Encounter | undefined> {
    await this.load();
    const e = this.items().find((x) => x.id === id);
    return e ? structuredClone(e) : undefined;
  }

  /** A new empty encounter, already saved. */
  async create(name: string): Promise<Encounter> {
    await this.load();
    const e = newEncounter(name);
    await this.write(e);
    return structuredClone(e);
  }

  /** Saves (creates or replaces) an encounter, stamping updatedAt. Returns what was stored. */
  async save(encounter: Encounter): Promise<Encounter> {
    await this.load();
    const e = normalizeEncounter({ ...encounter, updatedAt: new Date().toISOString() });
    await this.write(e);
    return structuredClone(e);
  }

  /** A copy with a new id and the given name, saved; undefined if the original doesn't exist. */
  async duplicate(id: string, name: string): Promise<Encounter | undefined> {
    const original = await this.get(id);
    if (!original) return undefined;
    const fresh = newEncounter(name);
    const copy: Encounter = {
      ...original,
      id: fresh.id,
      name,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
    };
    await this.write(copy);
    return structuredClone(copy);
  }

  async remove(id: string): Promise<void> {
    await this.load();
    await this.db.delete('encounters', id);
    this.items.update((list) => list.filter((e) => e.id !== id));
  }

  private async write(e: Encounter): Promise<void> {
    await this.db.put('encounters', e.id, e);
    this.items.update((list) => [...list.filter((x) => x.id !== e.id), e]);
  }
}
