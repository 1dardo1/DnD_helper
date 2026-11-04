import { Injectable, computed, inject, signal } from '@angular/core';

import { ConflictError, DataSource, DataSourceError } from '../data/data-source';
import { LocalDb } from '../storage/local-db';
import { Encounter, newEncounter, newEncounterId, normalizeEncounter } from './encounter';
import {
  ENCOUNTERS_DIR,
  EncounterFile,
  VaultKey,
  encounterIdOf,
  encounterPath,
  isEncounterFile,
  openEncounter,
  sealEncounter,
  unlockEncounter,
} from './encounter-crypto';
import {
  EncounterRecord,
  keyIdOf,
  mergeRemote,
  missingInRepo,
  needsDownload,
  pushAction,
} from './encounter-sync';
import { EncounterVault } from './encounter-vault.service';

/** An encounter whose key isn't unlocked on this device: only its id and date are known. */
export interface LockedEncounter {
  id: string;
  updatedAt: string;
  /** It's protected with the DM's password (not one of its own). */
  dmPassword: boolean;
}

export interface EncounterSyncResult {
  downloaded: number;
  uploaded: number;
  deleted: number;
  /** Changes that can't be uploaded until a password is entered. */
  waiting: number;
}

/** Saving an encounter whose key is locked (it can't be encrypted). */
export class EncounterLockedError extends Error {
  constructor(id: string) {
    super(`Encounter ${id} is locked`);
    this.name = 'EncounterLockedError';
  }
}

/**
 * The DM's encounters: on this device (IndexedDB, store "encounters", kept encrypted) and in the
 * repo (encounters/<id>.json, encrypted with the DM's password or one of its own; see
 * encounter-crypto.ts and encounter-sync.ts). Their content is decrypted in memory once the key
 * is unlocked (EncounterVault).
 *
 * Other DM tools read them by id, e.g. the combat tracker: `await store.get(id)` (undefined while
 * locked).
 */
@Injectable({ providedIn: 'root' })
export class EncounterStore {
  private readonly db = inject(LocalDb);
  readonly vault = inject(EncounterVault);

  private readonly records = signal<EncounterRecord[]>([]);
  /** Decrypted content by id (memory only). */
  private readonly opened = signal<ReadonlyMap<string, Encounter>>(new Map());
  private loaded?: Promise<void>;

  /** The last sync's problem with encounters, if any. */
  readonly syncError = signal<string | null>(null);
  readonly lastResult = signal<EncounterSyncResult | null>(null);

  /** Every encounter that can be opened, the most recently changed first. */
  readonly all = computed(() => {
    const opened = this.opened();
    return this.records()
      .filter((r) => r.status !== 'pending-delete')
      .flatMap((r) => opened.get(r.id) ?? r.plain ?? [])
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
  });

  /** Encounters this device can't open yet (no password entered). */
  readonly locked = computed<LockedEncounter[]>(() => {
    const opened = this.opened();
    const dm = this.dmSalt();
    return this.records()
      .filter((r) => r.status !== 'pending-delete' && !opened.has(r.id) && !r.plain && r.file)
      .map((r) => ({ id: r.id, updatedAt: r.updatedAt, dmPassword: keyIdOf(r) === dm }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  /** Changes not in the repo yet. */
  readonly pending = computed(() => this.records().filter((r) => r.status !== 'synced').length);
  /** Saved before there was a password: waiting for one to be encrypted and uploaded. */
  readonly unprotected = computed(() => this.records().filter((r) => !r.file).length);

  load(): Promise<void> {
    this.loaded ??= Promise.all([
      this.vault.load(),
      this.db.getAll<EncounterRecord | Encounter>('encounters'),
    ]).then(async ([, list]) => {
      this.records.set(list.filter((x) => x?.id).map(toRecord));
      await this.openAll();
    });
    return this.loaded;
  }

  /** The encounter with this id (a copy: change it and save()), or undefined (also if locked). */
  async get(id: string): Promise<Encounter | undefined> {
    await this.load();
    const r = this.record(id);
    if (!r || r.status === 'pending-delete') return undefined;
    const e = this.opened().get(id) ?? r.plain;
    return e ? structuredClone(e) : undefined;
  }

  /** Whether it has a password of its own (rather than the DM's). */
  hasOwnPassword(id: string): boolean {
    const r = this.record(id);
    const keyId = r && keyIdOf(r);
    return !!keyId && keyId !== this.dmSalt();
  }

  /**
   * A new empty encounter, already saved, protected with this key (the DM's by default). Without
   * any key unlocked it stays on this device until there's a password.
   */
  async create(name: string, key?: VaultKey): Promise<Encounter> {
    await this.load();
    const e = newEncounter(name);
    await this.store(e, key ?? this.vault.dmKey(), null);
    return structuredClone(e);
  }

  /** Saves (creates or replaces) an encounter, stamping updatedAt. Returns what was stored. */
  async save(encounter: Encounter): Promise<Encounter> {
    await this.load();
    const previous = this.record(encounter.id);
    const keyId = previous && keyIdOf(previous);
    const key = keyId ? this.vault.key(keyId) : this.vault.dmKey();
    if (keyId && !key) throw new EncounterLockedError(encounter.id);
    const e = normalizeEncounter({ ...encounter, updatedAt: new Date().toISOString() });
    await this.store(e, key, previous?.baseSha ?? null);
    return structuredClone(e);
  }

  /** A copy with a new id and the given name (same password), saved; undefined if not found. */
  async duplicate(id: string, name: string): Promise<Encounter | undefined> {
    const original = await this.get(id);
    if (!original) return undefined;
    const r = this.record(id)!;
    const at = new Date().toISOString();
    const copy: Encounter = {
      ...original,
      id: newEncounterId(),
      name,
      createdAt: at,
      updatedAt: at,
    };
    const keyId = keyIdOf(r);
    await this.store(copy, keyId ? this.vault.key(keyId) : this.vault.dmKey(), null);
    return structuredClone(copy);
  }

  /** Removes it here, and from the repo on the next sync. */
  async remove(id: string): Promise<void> {
    await this.load();
    const r = this.record(id);
    if (!r) return;
    if (r.baseSha) await this.write({ ...r, status: 'pending-delete' });
    else await this.forget(id);
    this.opened.update((m) => without(m, id));
  }

  // -- passwords ------------------------------------------------------------------------------

  /** Sets the DM's password the first time; encounters made without one get protected with it. */
  async createDmPassword(password: string, remember: boolean, iterations?: number): Promise<void> {
    await this.load();
    await this.vault.createDmPassword(password, remember, iterations);
    await this.openAll();
  }

  /** Unlocks the DM's password: false if it's wrong. */
  async unlockDm(password: string, remember: boolean): Promise<boolean> {
    await this.load();
    const key = await this.vault.unlockDm(password, remember);
    if (key) await this.openAll();
    return !!key;
  }

  /** Opens a locked encounter with its password (and every other one with the same): false if wrong. */
  async unlock(id: string, password: string, remember: boolean): Promise<boolean> {
    await this.load();
    const file = this.record(id)?.file;
    if (!file) return false;
    const found = await unlockEncounter(file, password);
    if (!found) return false;
    await this.vault.addKey(found.key, remember);
    await this.openAll();
    return true;
  }

  /** Protects an encounter with this key (a password of its own, or the DM's). */
  async setKey(id: string, key: VaultKey): Promise<void> {
    await this.load();
    const r = this.record(id);
    const e = this.opened().get(id) ?? r?.plain;
    if (!r || !e) throw new EncounterLockedError(id);
    await this.store({ ...e, updatedAt: new Date().toISOString() }, key, r.baseSha);
  }

  /**
   * A new DM's password: the encounters protected with the old one are encrypted again with the
   * new one (and uploaded on the next sync). The old one must be unlocked.
   */
  async changeDmPassword(password: string, remember: boolean, iterations?: number): Promise<void> {
    await this.load();
    const { old, key } = await this.vault.changeDmPassword(password, remember, iterations);
    for (const r of this.records()) {
      if (r.status === 'pending-delete' || keyIdOf(r) !== old.id) continue;
      const e = this.opened().get(r.id) ?? (r.file && (await openEncounter(r.file, old)));
      if (e) await this.store({ ...e, updatedAt: new Date().toISOString() }, key, r.baseSha);
    }
  }

  /** Forgets the keys on this device: every encounter locks until a password is entered again. */
  async lock(): Promise<void> {
    await this.load();
    await this.vault.lock();
    this.opened.set(new Map());
  }

  // -- sync -------------------------------------------------------------------------------------

  /** The DM's password, then download, then upload. Only against a repo that can be written. */
  async sync(source: DataSource): Promise<EncounterSyncResult> {
    await this.load();
    const result: EncounterSyncResult = { downloaded: 0, uploaded: 0, deleted: 0, waiting: 0 };
    if (!source.canWrite) return result;
    try {
      await this.vault.sync(source);
      await this.openAll();
      result.downloaded = await this.pull(source);
      const pushed = await this.push(source);
      result.uploaded = pushed.uploaded;
      result.deleted = pushed.deleted;
      result.waiting = pushed.waiting;
      this.syncError.set(null);
      this.lastResult.set(result);
    } catch (e) {
      this.syncError.set((e as Error).message);
      if (!(e instanceof DataSourceError)) throw e;
    }
    return result;
  }

  /** Download: new and changed encounters (the latest change wins), and deletions. */
  async pull(source: DataSource): Promise<number> {
    await this.load();
    let downloaded = 0;
    const listed = await source.listJson(ENCOUNTERS_DIR);
    const inRepo = new Set<string>();
    for (const f of listed) {
      const id = encounterIdOf(f.path);
      inRepo.add(id);
      if (!needsDownload(this.record(id), f.sha)) continue;
      const remote = await source.readJsonWithSha<unknown>(f.path);
      if (!remote || !isEncounterFile(remote.content) || remote.content.id !== id) continue;
      const current = this.record(id);
      if (mergeRemote(current, remote.content.updatedAt) === 'keep-local') {
        if (current) await this.write({ ...current, baseSha: remote.sha });
        continue;
      }
      await this.write({
        id,
        file: remote.content,
        plain: null,
        status: 'synced',
        baseSha: remote.sha,
        updatedAt: remote.content.updatedAt,
      });
      this.opened.update((m) => without(m, id));
      downloaded++;
    }
    for (const r of this.records()) {
      if (inRepo.has(r.id)) continue;
      const action = missingInRepo(r);
      if (action === 'forget') {
        await this.forget(r.id);
        this.opened.update((m) => without(m, r.id));
      } else if (action === 'upload-as-new') {
        await this.write({ ...r, baseSha: null });
      }
    }
    await this.openAll();
    return downloaded;
  }

  /** Upload: one commit per changed or deleted encounter. Errors are retried on the next sync. */
  async push(source: DataSource): Promise<Omit<EncounterSyncResult, 'downloaded'>> {
    await this.load();
    const result = { uploaded: 0, deleted: 0, waiting: 0 };
    if (!source.canWrite) return result;
    const inRepo = new Map(
      (await source.listJson(ENCOUNTERS_DIR)).map((f) => [encounterIdOf(f.path), f.sha]),
    );
    for (const r of [...this.records()]) {
      const repoSha = inRepo.get(r.id) ?? null;
      const path = encounterPath(r.id);
      try {
        switch (pushAction(r, repoSha)) {
          case 'upload': {
            // The commit message says nothing about the encounter either.
            const written = await source.writeJson(
              path,
              r.file,
              repoSha,
              `Encuentro: guardar ${r.id}`,
            );
            const current = this.record(r.id);
            if (current && current.file !== r.file) {
              // saved again while uploading: that change goes in the next commit
              await this.write({ ...current, baseSha: written.sha });
            } else if (current) {
              await this.write({ ...current, status: 'synced', baseSha: written.sha });
            }
            result.uploaded++;
            break;
          }
          case 'delete':
            await source.deleteFile(path, repoSha!, `Encuentro: borrar ${r.id}`);
            await this.forget(r.id);
            result.deleted++;
            break;
          case 'forget':
            await this.forget(r.id);
            break;
          case 'wait':
            result.waiting++;
            break;
        }
      } catch (e) {
        // ConflictError: changed in the repo meanwhile, the next sync downloads it and decides.
        // DataSourceError (offline, GitHub down...): try again next time.
        if (!(e instanceof ConflictError) && !(e instanceof DataSourceError)) throw e;
      }
    }
    return result;
  }

  // -- internals --------------------------------------------------------------------------------

  private dmSalt(): string | null {
    return this.vault.dmKeyId();
  }

  private record(id: string): EncounterRecord | undefined {
    return this.records().find((r) => r.id === id);
  }

  /**
   * Saves a version of an encounter as pending upload: encrypted with the key, or as it is when
   * there's no key yet (it then stays on this device).
   */
  private async store(e: Encounter, key: VaultKey | undefined, baseSha: string | null) {
    const file: EncounterFile | null = key ? await sealEncounter(e, key) : null;
    await this.write({
      id: e.id,
      file,
      plain: file ? null : e,
      status: 'local',
      baseSha,
      updatedAt: e.updatedAt,
    });
    this.opened.update((m) => new Map(m).set(e.id, e));
  }

  /**
   * Decrypts what the unlocked keys open, and protects with the DM's key the encounters saved
   * before there was a password.
   */
  private async openAll(): Promise<void> {
    const dmKey = this.vault.dmKey();
    for (const r of this.records()) {
      if (r.status === 'pending-delete') continue;
      if (!r.file) {
        if (r.plain && dmKey) await this.store(r.plain, dmKey, r.baseSha);
        continue;
      }
      if (this.opened().has(r.id)) continue;
      const key = this.vault.key(keyIdOf(r));
      const e = key && (await openEncounter(r.file, key));
      if (e) this.opened.update((m) => new Map(m).set(r.id, e));
    }
  }

  private async forget(id: string): Promise<void> {
    await this.db.delete('encounters', id);
    this.records.update((list) => list.filter((r) => r.id !== id));
  }

  private async write(r: EncounterRecord): Promise<void> {
    await this.db.put('encounters', r.id, r);
    this.records.update((list) => [...list.filter((x) => x.id !== r.id), r]);
  }
}

/** A stored item as a record: older versions of the app stored the Encounter itself. */
function toRecord(x: EncounterRecord | Encounter): EncounterRecord {
  if ('status' in x) return x;
  const plain = normalizeEncounter(x);
  return {
    id: plain.id,
    file: null,
    plain,
    status: 'local',
    baseSha: null,
    updatedAt: plain.updatedAt,
  };
}

function without<V>(m: ReadonlyMap<string, V>, id: string): ReadonlyMap<string, V> {
  if (!m.has(id)) return m;
  const next = new Map(m);
  next.delete(id);
  return next;
}
