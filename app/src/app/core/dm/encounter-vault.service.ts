import { Injectable, computed, inject, signal } from '@angular/core';

import { ConflictError, DataSource, DataSourceError } from '../data/data-source';
import { LocalDb } from '../storage/local-db';
import {
  DM_KEY_PATH,
  DmKeyFile,
  VaultKey,
  isDmKeyFile,
  keyFromPassword,
  makeDmKeyFile,
  newKeyParams,
  unlockDmKey,
} from './encounter-crypto';

/** The DM's password as this device knows it: its public part (dm/key.json) and its sync state. */
interface DmState {
  kind: 'dm';
  file: DmKeyFile;
  /** Sha of the repo's dm/key.json this one is based on; null if never seen there. */
  sha: string | null;
  /** Set or changed here, not uploaded yet. */
  pending: boolean;
}

/** A key the DM asked to remember on this device (a non-extractable CryptoKey, not the password). */
interface StoredKey extends VaultKey {
  kind: 'key';
}

const DM_ID = 'dm';
const storedKeyId = (id: string) => `key:${id}`;

/**
 * The keys that open the DM's encounters. Passwords are never stored: each one is turned into a
 * key (PBKDF2, slow on purpose) which stays in memory for the session, or in IndexedDB as a
 * non-extractable CryptoKey when the DM asks to remember it on this device.
 *
 * "The DM's password" is the default one for every encounter: set once (dm/key.json in the repo
 * carries its salt and a check, so any device can verify it), it opens all of them. An encounter
 * can also have a password of its own (its key is identified by its salt, as any other).
 */
@Injectable({ providedIn: 'root' })
export class EncounterVault {
  private readonly db = inject(LocalDb);
  private readonly keys = signal<ReadonlyMap<string, VaultKey>>(new Map());
  private readonly dm = signal<DmState | null>(null);
  private loaded?: Promise<void>;

  /** The DM's password exists (on this device or in the repo). */
  readonly hasDmPassword = computed(() => !!this.dm());
  /** Id (salt) of the DM's key, also while locked. */
  readonly dmKeyId = computed(() => this.dm()?.file.salt ?? null);
  /** The DM's key, when unlocked on this device. */
  readonly dmKey = computed(() => {
    const d = this.dm();
    return d ? this.keys().get(d.file.salt) : undefined;
  });
  /** Ids of the keys unlocked on this device. */
  readonly unlocked = computed(() => new Set(this.keys().keys()));

  load(): Promise<void> {
    this.loaded ??= this.db.getAll<DmState | StoredKey>('keys').then((items) => {
      const keys = new Map<string, VaultKey>();
      for (const item of items) {
        if (item?.kind === 'dm' && isDmKeyFile(item.file)) this.dm.set(item);
        if (item?.kind === 'key' && item.key) {
          const { kind: _, ...key } = item;
          keys.set(key.id, key);
        }
      }
      this.keys.update((k) => new Map([...keys, ...k]));
    });
    return this.loaded;
  }

  key(id: string | null | undefined): VaultKey | undefined {
    return id ? this.keys().get(id) : undefined;
  }

  /** Sets the DM's password the first time. */
  async createDmPassword(
    password: string,
    remember: boolean,
    iterations?: number,
  ): Promise<VaultKey> {
    await this.load();
    if (this.dm()) throw new Error('The DM password already exists');
    const key = await keyFromPassword(password, newKeyParams(iterations));
    await this.setDm({ kind: 'dm', file: await makeDmKeyFile(key), sha: null, pending: true });
    await this.addKey(key, remember);
    return key;
  }

  /** The DM's key if the password is right (and it stays unlocked), or null. */
  async unlockDm(password: string, remember: boolean): Promise<VaultKey | null> {
    await this.load();
    const d = this.dm();
    if (!d) return null;
    const key = await unlockDmKey(d.file, password);
    if (key) await this.addKey(key, remember);
    return key;
  }

  /**
   * A new DM's password (the current one must be unlocked). Returns the old and new keys: the
   * encounters protected with the old one have to be encrypted again with the new one.
   */
  async changeDmPassword(
    password: string,
    remember: boolean,
    iterations?: number,
  ): Promise<{ old: VaultKey; key: VaultKey }> {
    await this.load();
    const old = this.dmKey();
    const d = this.dm();
    if (!old || !d) throw new Error('The DM password is locked');
    const key = await keyFromPassword(password, newKeyParams(iterations));
    await this.setDm({ kind: 'dm', file: await makeDmKeyFile(key), sha: d.sha, pending: true });
    await this.addKey(key, remember);
    return { old, key };
  }

  /** A key for a password of its own (one encounter). */
  async newKey(password: string, remember: boolean, iterations?: number): Promise<VaultKey> {
    const key = await keyFromPassword(password, newKeyParams(iterations));
    await this.addKey(key, remember);
    return key;
  }

  async addKey(key: VaultKey, remember: boolean): Promise<void> {
    await this.load();
    this.keys.update((k) => new Map(k).set(key.id, key));
    if (remember) {
      try {
        await this.db.put<StoredKey>('keys', storedKeyId(key.id), { ...key, kind: 'key' });
      } catch {
        // a browser that can't store keys: it stays unlocked for this session only
      }
    }
  }

  /** Forgets every key on this device (memory and remembered): the encounters lock. */
  async lock(): Promise<void> {
    await this.load();
    for (const id of this.keys().keys()) await this.db.delete('keys', storedKeyId(id));
    this.keys.set(new Map());
  }

  /**
   * Uploads the DM's password (its public part) when it was set or changed here, or takes the
   * repo's when it changed elsewhere. The repo's wins unless ours was based on it: encounters
   * already encrypted with ours still open with it (their files carry its salt).
   */
  async sync(source: DataSource): Promise<void> {
    await this.load();
    const remote = await source.readJsonWithSha<unknown>(DM_KEY_PATH);
    const remoteFile = remote && isDmKeyFile(remote.content) ? remote.content : null;
    const d = this.dm();
    if (d?.pending && (!remote || remote.sha === d.sha)) {
      try {
        const written = await source.writeJson(
          DM_KEY_PATH,
          d.file,
          remote?.sha ?? null,
          'DM: contraseña de los encuentros',
        );
        // changed again while uploading: stays pending
        if (this.dm() === d) await this.setDm({ ...d, sha: written.sha, pending: false });
      } catch (e) {
        if (!(e instanceof ConflictError) && !(e instanceof DataSourceError)) throw e;
      }
      return;
    }
    if (remote && remoteFile && remote.sha !== d?.sha) {
      await this.setDm({ kind: 'dm', file: remoteFile, sha: remote.sha, pending: false });
    } else if (!remote && d && !d.pending && d.sha) {
      // deleted from the repo: ours is the only copy
      await this.setDm({ ...d, sha: null, pending: true });
    }
  }

  private async setDm(state: DmState): Promise<void> {
    this.dm.set(state);
    await this.db.put('keys', DM_ID, state);
  }
}
