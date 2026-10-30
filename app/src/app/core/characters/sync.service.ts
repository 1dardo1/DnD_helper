import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { RepositoryService } from '../data/repository.service';
import { Character, CharacterRecord } from '../models/character';
import { CharacterStore, SyncResult } from './character-store.service';

const EVERY_MS = 5 * 60 * 1000;
/** Quiet period after in-game changes before uploading them (one commit per burst of taps). */
const SOON_MS = 5 * 1000;

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

/**
 * Decides when characters are synchronised with the repo: when the app opens, when the
 * connection comes back, every few minutes while it's open, and right after a save.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly store = inject(CharacterStore);
  private readonly repo = inject(RepositoryService);

  readonly state = signal<SyncState>('idle');
  readonly lastSync = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly lastResult = signal<SyncResult | null>(null);

  private running: Promise<void> | null = null;
  private again = false;
  private started = false;
  private soon: ReturnType<typeof setTimeout> | null = null;

  /** Call once (the app shell does). */
  start(destroyRef: DestroyRef): void {
    if (this.started) return;
    this.started = true;
    const onOnline = () => void this.sync();
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => void this.sync(), EVERY_MS);
    destroyRef.onDestroy(() => {
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
      if (this.soon) clearTimeout(this.soon);
      this.soon = null;
      this.started = false;
    });
    void this.sync();
  }

  /** Saves on the device, then tries to upload it straight away. */
  async save(character: Character): Promise<CharacterRecord> {
    const record = await this.store.save(character);
    void this.sync();
    return record;
  }

  /**
   * Saves on the device and uploads once no other change has come for a few seconds: for the
   * in-game state, which changes with every tap.
   */
  async saveSoon(character: Character): Promise<CharacterRecord> {
    const record = await this.store.save(character);
    if (this.soon) clearTimeout(this.soon);
    this.soon = setTimeout(() => {
      this.soon = null;
      void this.sync();
    }, SOON_MS);
    return record;
  }

  /** Marks for deletion on the device, then tries to remove it from the repo. */
  async remove(id: string): Promise<void> {
    await this.store.remove(id);
    void this.sync();
  }

  /** Pull then push. Calls made while a sync is running queue one more round. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.running;
  }

  private async run(): Promise<void> {
    const source = this.repo.source();
    if (!source) return;
    if (!navigator.onLine) {
      this.state.set('offline');
      return;
    }
    this.state.set('syncing');
    try {
      const pulled = await this.store.pull(source);
      const pushed = await this.store.push(source);
      this.lastResult.set({
        added: pulled.added,
        updated: pulled.updated,
        uploaded: pushed.uploaded,
        deleted: pushed.deleted,
        conflicts: pulled.conflicts + pushed.conflicts,
      });
      this.lastSync.set(new Date().toISOString());
      this.lastError.set(null);
      this.state.set('idle');
    } catch (e) {
      this.lastError.set((e as Error).message);
      this.state.set(navigator.onLine ? 'error' : 'offline');
    }
  }
}
