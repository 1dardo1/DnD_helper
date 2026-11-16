import { Injectable, computed, signal } from '@angular/core';

import { ConflictError, DataSource } from '../data/data-source';
import { Character } from '../models/character';
import {
  FOLDER_LOCKS_PATH,
  FolderKey,
  FolderLock,
  SealedCharacterFile,
  createLock,
  isSealedCharacterFile,
  locksFile,
  openCharacter,
  readLocks,
  sealCharacter,
  unlockLock,
} from './folder-lock';

const CACHE_KEY = 'dnd-helper.folderLocks';

interface Cache {
  locks: FolderLock[];
  /** Sha of folders/locks.json the local list is based on (null: never read/written). */
  sha: string | null;
  /** Local changes not written to the repo yet. */
  dirty: boolean;
  /** Folders whose lock was set, changed, renamed or removed here and not written yet. */
  touched: string[];
}

/**
 * Which folders have a password (synchronised through folders/locks.json, so every device asks
 * for it) and which ones are open in this session. The keys only live in memory: reloading the
 * app closes every folder again.
 */
@Injectable({ providedIn: 'root' })
export class FolderLockService {
  private readonly cache = signal<Cache>(loadCache());
  /** Keys of the folders opened in this session, by lock id (salt). */
  private readonly keys = signal<ReadonlyMap<string, FolderKey>>(new Map());

  readonly locks = computed(() => this.cache().locks);

  lockOf(folder: string | null | undefined): FolderLock | undefined {
    const name = folder?.trim();
    return name ? this.locks().find((l) => l.folder === name) : undefined;
  }

  /** The folder has a password (whether it's open now or not). */
  isProtected(folder: string | null | undefined): boolean {
    return !!this.lockOf(folder);
  }

  /** The folder has a password and hasn't been opened in this session. */
  isLocked(folder: string | null | undefined): boolean {
    const lock = this.lockOf(folder);
    return !!lock && !this.keys().has(lock.salt);
  }

  /** Can this character be shown or edited now? */
  canSee(c: Pick<Character, 'folder'>): boolean {
    return !this.isLocked(c.folder);
  }

  /** Tries the password; true (and the folder stays open this session) if it's right. */
  async unlock(folder: string, password: string): Promise<boolean> {
    const lock = this.lockOf(folder);
    if (!lock) return true;
    const key = await unlockLock(lock, password);
    if (!key) return false;
    this.keys.update((m) => new Map(m).set(key.id, key));
    return true;
  }

  /** Closes the folder again (its characters hide until the password is entered). */
  relock(folder: string): void {
    const lock = this.lockOf(folder);
    if (!lock) return;
    this.keys.update((m) => {
      const next = new Map(m);
      next.delete(lock.salt);
      return next;
    });
  }

  /**
   * Puts a password on the folder (or changes it: the folder must be open). The characters inside
   * must be uploaded again to be encrypted with the new key: the caller marks them.
   */
  async setPassword(folder: string, password: string): Promise<void> {
    const name = folder.trim();
    const old = this.lockOf(name);
    if (old && this.isLocked(name)) throw new Error('locked');
    const { lock, key } = await createLock(name, password);
    // the old key stays known this session: files still encrypted with it can be read until
    // they are uploaded again with the new one
    this.keys.update((m) => new Map(m).set(key.id, key));
    this.save([...this.locks().filter((l) => l.folder !== name), lock], [name]);
  }

  /** Removes the folder's password (it must be open); its characters are uploaded unencrypted. */
  removePassword(folder: string): void {
    const lock = this.lockOf(folder);
    if (!lock) return;
    if (this.isLocked(folder)) throw new Error('locked');
    this.save(
      this.locks().filter((l) => l !== lock),
      [lock.folder],
    );
  }

  /** Keeps the password when the folder is renamed. */
  renameFolder(from: string, to: string): void {
    const lock = this.lockOf(from);
    if (!lock || !to.trim() || from === to) return;
    this.save(
      this.locks().map((l) => (l === lock ? { ...l, folder: to.trim() } : l)),
      [from, to.trim()],
    );
  }

  // -- the repo files ------------------------------------------------------------------------------

  /**
   * What is written to characters/<id>.json for this character: encrypted when its folder has a
   * password. null: the folder is protected but closed, so it can't be written now (stays pending).
   */
  async encode(c: Character): Promise<unknown | null> {
    const lock = this.lockOf(c.folder);
    if (!lock) return c;
    const key = this.keys().get(lock.salt);
    return key ? sealCharacter(c, key) : null;
  }

  /**
   * The character in a file read from the repo. 'locked': an encrypted character whose folder is
   * not open on this device (its key is unknown); null: not a character.
   */
  async decode(content: unknown): Promise<Character | 'locked' | null> {
    if (!isSealedCharacterFile(content)) return null;
    return this.open(content);
  }

  private async open(file: SealedCharacterFile): Promise<Character | 'locked' | null> {
    const key = this.keys().get(file.lock);
    if (!key) return 'locked';
    return openCharacter(file, key);
  }

  /** Brings folders/locks.json and sends local changes to it. Never loses a lock silently. */
  async sync(source: DataSource): Promise<void> {
    const remote = await source.readJsonWithSha<unknown>(FOLDER_LOCKS_PATH);
    const c = this.cache();
    const remoteLocks = remote ? readLocks(remote.content) : [];
    if (!c.dirty) {
      if (remote && remote.sha !== c.sha)
        this.store({ locks: remoteLocks, sha: remote.sha, dirty: false, touched: [] });
      return;
    }
    if (!source.canWrite) return;
    // what another device changed is kept; what was changed here wins for its own folders
    const locks = [
      ...remoteLocks.filter((l) => !c.touched.includes(l.folder)),
      ...c.locks.filter((l) => c.touched.includes(l.folder)),
    ];
    try {
      const written = await source.writeJson(
        FOLDER_LOCKS_PATH,
        locksFile(locks),
        remote?.sha ?? null,
        'Carpetas: actualizar contraseñas',
      );
      this.store({ locks, sha: written.sha, dirty: false, touched: [] });
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      // changed elsewhere meanwhile: next round reads it again and retries with the new sha
    }
  }

  private save(locks: FolderLock[], touched: string[]): void {
    const c = this.cache();
    this.store({ ...c, locks, dirty: true, touched: [...new Set([...c.touched, ...touched])] });
  }

  private store(c: Cache): void {
    this.cache.set(c);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch {
      // private mode: works for this session
    }
  }
}

function loadCache(): Cache {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (raw) {
      return {
        locks: readLocks({ app: 'dnd-helper', kind: 'folder-locks', version: 1, locks: raw.locks }),
        sha: typeof raw.sha === 'string' ? raw.sha : null,
        dirty: raw.dirty === true,
        touched: Array.isArray(raw.touched)
          ? raw.touched.filter((t: unknown) => typeof t === 'string')
          : [],
      };
    }
  } catch {
    // nothing saved, or unreadable
  }
  return { locks: [], sha: null, dirty: false, touched: [] };
}
