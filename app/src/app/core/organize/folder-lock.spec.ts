import { TestBed } from '@angular/core/testing';

import { CharacterStore } from '../characters/character-store.service';
import { ConflictError, DataSource, FileContent, RepoFile, toJsonText } from '../data/data-source';
import { gitBlobSha } from '../data/git-sha';
import { Character, newCharacter } from '../models/character';
import { LocalDb, StoreName } from '../storage/local-db';
import {
  Argon2Params,
  FOLDER_LOCKS_PATH,
  createLock,
  isSealedCharacterFile,
  openCharacter,
  readLocks,
  sealCharacter,
  unlockLock,
} from './folder-lock';
import { FolderLockService } from './folder-lock.service';

/** Cheap argon2id parameters: the tests check the logic, not the cost. */
const FAST: Argon2Params = { memoryKiB: 64, passes: 1, parallelism: 1 };
const PASSWORD = 'prueba123456';

class MemoryDb {
  private readonly stores = new Map<StoreName, Map<string, unknown>>();
  private s(name: StoreName) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return this.stores.get(name)!;
  }
  async get<T>(store: StoreName, key: string) {
    return this.s(store).get(key) as T | undefined;
  }
  async getAll<T>(store: StoreName) {
    return [...this.s(store).values()] as T[];
  }
  async put(store: StoreName, key: string, value: unknown) {
    this.s(store).set(key, structuredClone(value));
  }
  async delete(store: StoreName, key: string) {
    this.s(store).delete(key);
  }
  async clear(store: StoreName) {
    this.s(store).clear();
  }
}

/** A repo that behaves like GitHub (sha = git blob sha; writes refused on a stale sha). */
class FakeRepo implements Partial<DataSource> {
  readonly kind = 'github';
  readonly canWrite = true;
  readonly files = new Map<string, string>();
  commits: string[] = [];
  async listJson(dir: string): Promise<RepoFile[]> {
    return Promise.all(
      [...this.files]
        .filter(([path]) => path.startsWith(dir + '/'))
        .map(async ([path, text]) => ({ path, sha: await gitBlobSha(text) })),
    );
  }
  async readJsonWithSha<T>(path: string): Promise<FileContent<T> | null> {
    const text = this.files.get(path);
    return text ? { path, sha: await gitBlobSha(text), content: JSON.parse(text) } : null;
  }
  async writeJson(path: string, content: unknown, sha: string | null, message: string) {
    const current = this.files.get(path);
    if ((current ? await gitBlobSha(current) : null) !== sha) throw new ConflictError(path);
    const text = toJsonText(content);
    this.files.set(path, text);
    this.commits.push(message);
    return { path, sha: await gitBlobSha(text) };
  }
  async deleteFile(path: string) {
    this.files.delete(path);
  }
}

const hero = (name: string, folder: string | null): Character => ({
  ...newCharacter(name, 'test'),
  folder,
});

/** A device: its own local database, store and folder locks (keys live only in memory). */
function device(memory = new MemoryDb()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: LocalDb, useValue: memory }] });
  return {
    store: TestBed.inject(CharacterStore),
    locks: TestBed.inject(FolderLockService),
    memory,
  };
}

async function syncOnce(d: ReturnType<typeof device>, repo: FakeRepo) {
  const source = repo as unknown as DataSource;
  await d.locks.sync(source);
  await d.store.pull(source);
  await d.store.push(source);
}

describe('folder-lock crypto', () => {
  it('derives the same key from the right password only', async () => {
    const { lock } = await createLock('Pruebas', PASSWORD, FAST);
    expect(lock.folder).toBe('Pruebas');
    expect(JSON.stringify(lock)).not.toContain(PASSWORD);
    expect(await unlockLock(lock, PASSWORD)).not.toBeNull();
    expect(await unlockLock(lock, 'otra-contraseña')).toBeNull();
  });

  it('seals a character so that its name and folder are not readable, and opens it again', async () => {
    const { lock, key } = await createLock('Pruebas', PASSWORD, FAST);
    const c = hero('Sombra Secreta', 'Pruebas');
    const file = await sealCharacter(c, key);
    const text = JSON.stringify(file);
    expect(isSealedCharacterFile(file)).toBe(true);
    expect(text).not.toContain('Sombra Secreta');
    expect(text).not.toContain('Pruebas');
    expect(file.lock).toBe(lock.salt);
    expect((await openCharacter(file, key))?.name).toBe('Sombra Secreta');
  });

  it('refuses another key, and a file moved to another id', async () => {
    const a = await createLock('A', PASSWORD, FAST);
    const b = await createLock('B', PASSWORD, FAST);
    const file = await sealCharacter(hero('X', 'A'), a.key);
    expect(await openCharacter(file, b.key)).toBeNull();
    expect(await openCharacter({ ...file, id: 'otro' }, a.key)).toBeNull();
  });

  it('drops malformed locks', () => {
    expect(readLocks(null)).toEqual([]);
    expect(
      readLocks({ app: 'dnd-helper', kind: 'folder-locks', version: 1, locks: [{ x: 1 }] }),
    ).toEqual([]);
  });
});

describe('folders with a password, end to end', () => {
  beforeEach(() => localStorage.clear());

  it('writes the characters of a protected folder encrypted, and nothing of them in clear', async () => {
    const repo = new FakeRepo();
    const d = device();
    await d.store.save(hero('Sombra', 'Pruebas'));
    await d.store.save(hero('Visible', null));
    await d.locks.setPassword('Pruebas', PASSWORD);
    await d.store.reupload('Pruebas');
    await syncOnce(d, repo);

    const files = [...repo.files.entries()];
    const sealed = files.filter(([, t]) => JSON.parse(t).kind === 'character');
    expect(sealed).toHaveLength(1);
    expect(sealed[0][1]).not.toContain('Sombra');
    expect(files.some(([, t]) => t.includes('Visible'))).toBe(true);
    expect(repo.files.has(FOLDER_LOCKS_PATH)).toBe(true);
    expect(repo.files.get(FOLDER_LOCKS_PATH)).not.toContain(PASSWORD);
    // the commit message doesn't name the protected character either
    expect(repo.commits.some((m) => m.includes('Sombra'))).toBe(false);
  });

  it('another device sees the folder locked, and the character only after the password', async () => {
    const repo = new FakeRepo();
    const a = device();
    await a.store.save(hero('Sombra', 'Pruebas'));
    await a.locks.setPassword('Pruebas', PASSWORD);
    await a.store.reupload('Pruebas');
    await syncOnce(a, repo);

    localStorage.clear(); // a different device: nothing cached
    const b = device();
    await syncOnce(b, repo);
    expect(b.locks.isLocked('Pruebas')).toBe(true);
    expect(b.store.all()).toHaveLength(0); // can't even read it without the key

    expect(await b.locks.unlock('Pruebas', 'mala-contraseña')).toBe(false);
    expect(await b.locks.unlock('Pruebas', PASSWORD)).toBe(true);
    await syncOnce(b, repo);
    expect(b.store.visible().map((r) => r.character.name)).toEqual(['Sombra']);
  });

  it('hides the characters of a closed folder from the visible list', async () => {
    const d = device();
    await d.store.save(hero('Sombra', 'Pruebas'));
    await d.locks.setPassword('Pruebas', PASSWORD);
    expect(d.store.visible()).toHaveLength(1);
    d.locks.relock('Pruebas');
    expect(d.store.visible()).toHaveLength(0);
    expect(d.locks.canSee({ folder: 'Pruebas' })).toBe(false);
    expect(d.locks.canSee({ folder: null })).toBe(true);
  });

  it("keeps a closed folder's changes pending instead of uploading them in clear", async () => {
    const repo = new FakeRepo();
    const d = device();
    await d.locks.setPassword('Pruebas', PASSWORD);
    await syncOnce(d, repo);
    d.locks.relock('Pruebas');
    await d.store.save(hero('Sombra', 'Pruebas'));
    await syncOnce(d, repo);
    expect([...repo.files.keys()].filter((p) => p.startsWith('characters/'))).toEqual([]);
    expect(d.store.all()[0].status).toBe('local');
  });

  it('removing the password writes the characters in clear again', async () => {
    const repo = new FakeRepo();
    const d = device();
    await d.store.save(hero('Sombra', 'Pruebas'));
    await d.locks.setPassword('Pruebas', PASSWORD);
    await d.store.reupload('Pruebas');
    await syncOnce(d, repo);
    d.locks.removePassword('Pruebas');
    await d.store.reupload('Pruebas');
    await syncOnce(d, repo);
    const file = [...repo.files.entries()].find(([p]) => p.startsWith('characters/'))!;
    expect(file[1]).toContain('Sombra');
    expect(d.locks.isProtected('Pruebas')).toBe(false);
  });

  it('two devices changing different folders keep both passwords', async () => {
    const repo = new FakeRepo();
    const a = device();
    await a.locks.setPassword('Uno', PASSWORD);
    localStorage.clear();
    const b = device();
    await b.locks.setPassword('Dos', PASSWORD);
    await syncOnce(b, repo);
    // A had its change pending: it must not wipe out B's lock
    localStorage.setItem(
      'dnd-helper.folderLocks',
      JSON.stringify({ locks: a.locks.locks(), sha: null, dirty: true, touched: ['Uno'] }),
    );
    const a2 = device();
    await a2.locks.sync(repo as unknown as DataSource);
    await a2.locks.sync(repo as unknown as DataSource);
    expect(
      readLocks(JSON.parse(repo.files.get(FOLDER_LOCKS_PATH)!))
        .map((l) => l.folder)
        .sort(),
    ).toEqual(['Dos', 'Uno']);
  });
});
