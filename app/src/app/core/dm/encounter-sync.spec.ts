import { TestBed } from '@angular/core/testing';

import {
  ConflictError,
  DataSource,
  DataSourceError,
  FileContent,
  RepoFile,
  toJsonText,
} from '../data/data-source';
import { gitBlobSha } from '../data/git-sha';
import { LocalDb, StoreName } from '../storage/local-db';
import { DM_KEY_PATH, EncounterFile, isEncounterFile } from './encounter-crypto';
import { EncounterStore } from './encounter-store.service';
import {
  EncounterRecord,
  mergeRemote,
  missingInRepo,
  needsDownload,
  pushAction,
} from './encounter-sync';

const FAST = 1000;
const PASSWORD = 'contraseña del DM 1234';

/** In-memory replacement for IndexedDB (one per device). */
class MemoryDb {
  readonly stores = new Map<StoreName, Map<string, unknown>>();
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
    this.s(store).set(key, value);
  }
  async delete(store: StoreName, key: string) {
    this.s(store).delete(key);
  }
  async clear(store: StoreName) {
    this.s(store).clear();
  }
}

/** A repo that behaves like GitHub: sha = git blob sha; writes with a stale sha are refused. */
class FakeRepo implements DataSource {
  readonly kind = 'github';
  readonly canWrite = true;
  readonly files = new Map<string, string>();
  commits: string[] = [];
  offline = false;
  async readJson<T>(path: string): Promise<T> {
    return JSON.parse(this.files.get(path)!);
  }
  async listJson(dir: string): Promise<RepoFile[]> {
    this.check();
    return Promise.all(
      [...this.files]
        .filter(([path]) => path.startsWith(dir + '/'))
        .map(async ([path, text]) => ({ path, sha: await gitBlobSha(text) })),
    );
  }
  async readJsonWithSha<T>(path: string): Promise<FileContent<T> | null> {
    this.check();
    const text = this.files.get(path);
    return text ? { path, sha: await gitBlobSha(text), content: JSON.parse(text) } : null;
  }
  async writeJson(path: string, content: unknown, sha: string | null, message: string) {
    this.check();
    const current = this.files.get(path);
    if ((current ? await gitBlobSha(current) : null) !== sha) throw new ConflictError(path);
    const text = toJsonText(content);
    this.files.set(path, text);
    this.commits.push(message);
    return { path, sha: await gitBlobSha(text) };
  }
  async deleteFile(path: string, sha: string, message: string) {
    this.check();
    const current = this.files.get(path);
    if (!current || (await gitBlobSha(current)) !== sha) throw new ConflictError(path);
    this.files.delete(path);
    this.commits.push(message);
  }
  encounterFiles(): EncounterFile[] {
    return [...this.files]
      .filter(([p]) => p.startsWith('encounters/'))
      .map(([, t]) => JSON.parse(t));
  }
  private check() {
    if (this.offline) throw new DataSourceError('network error');
  }
}

/** One device: its own database and store. */
function device(db = new MemoryDb()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: LocalDb, useValue: db }] });
  return { store: TestBed.inject(EncounterStore), db };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

function rec(patch: Partial<EncounterRecord>): EncounterRecord {
  return {
    id: 'enc-1',
    file: null,
    status: 'synced',
    baseSha: 'a',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

describe('encounter sync decisions', () => {
  it('downloads what is new or changed, unless deleted here', () => {
    expect(needsDownload(undefined, 'x')).toBe(true);
    expect(needsDownload(rec({ baseSha: 'x' }), 'x')).toBe(false);
    expect(needsDownload(rec({ baseSha: 'a' }), 'x')).toBe(true);
    expect(needsDownload(rec({ status: 'local' }), 'x')).toBe(true);
    expect(needsDownload(rec({ status: 'pending-delete' }), 'x')).toBe(false);
  });

  it('the latest change wins', () => {
    const later = '2026-02-01T00:00:00.000Z';
    const earlier = '2025-12-01T00:00:00.000Z';
    expect(mergeRemote(undefined, later)).toBe('take-remote');
    expect(mergeRemote(rec({ status: 'synced' }), earlier)).toBe('take-remote');
    expect(mergeRemote(rec({ status: 'local' }), later)).toBe('take-remote');
    expect(mergeRemote(rec({ status: 'local' }), earlier)).toBe('keep-local');
    expect(mergeRemote(rec({ status: 'pending-delete' }), later)).toBe('keep-local');
  });

  it('missing in the repo: deleted elsewhere, unless changed here', () => {
    expect(missingInRepo(rec({ status: 'synced' }))).toBe('forget');
    expect(missingInRepo(rec({ status: 'pending-delete' }))).toBe('forget');
    expect(missingInRepo(rec({ status: 'local', baseSha: 'a' }))).toBe('upload-as-new');
    expect(missingInRepo(rec({ status: 'local', baseSha: null }))).toBe('keep');
  });

  it('what to send', () => {
    const file = {} as EncounterFile;
    expect(pushAction(rec({ status: 'local', file }), null)).toBe('upload');
    expect(pushAction(rec({ status: 'local', file: null }), null)).toBe('wait');
    expect(pushAction(rec({ status: 'synced', file }), 'x')).toBe('none');
    expect(pushAction(rec({ status: 'pending-delete' }), 'x')).toBe('delete');
    expect(pushAction(rec({ status: 'pending-delete' }), null)).toBe('forget');
  });
});

describe('EncounterStore sync', () => {
  it('uploads encrypted, and a second device opens it only with the password', async () => {
    const repo = new FakeRepo();
    const a = device().store;
    await a.createDmPassword(PASSWORD, false, FAST);
    const e = await a.create('Emboscada goblin');
    await a.save({ ...e, monsters: [{ monsterId: 'goblin-warrior', count: 4 }], notes: 'Puente' });
    expect(await a.sync(repo)).toMatchObject({ uploaded: 1, waiting: 0 });

    // the repo: the DM key file and one encrypted encounter, nothing readable
    expect([...repo.files.keys()].sort()).toEqual([DM_KEY_PATH, `encounters/${e.id}.json`]);
    const text = repo.files.get(`encounters/${e.id}.json`)!;
    expect(isEncounterFile(JSON.parse(text))).toBe(true);
    for (const secret of ['Emboscada', 'goblin', 'Puente', PASSWORD])
      expect([...repo.files.values()].join()).not.toContain(secret);
    expect(repo.commits.join()).not.toContain('Emboscada');
    expect(a.pending()).toBe(0);

    // second device
    const b = device().store;
    await b.sync(repo);
    expect(b.all()).toEqual([]);
    expect(b.locked()).toEqual([{ id: e.id, updatedAt: expect.any(String), dmPassword: true }]);
    expect(b.vault.hasDmPassword()).toBe(true);
    expect(await b.get(e.id)).toBeUndefined();
    expect(await b.unlockDm('no es la contraseña', false)).toBe(false);
    expect(b.locked()).toHaveLength(1);
    expect(await b.unlockDm(PASSWORD, false)).toBe(true);
    expect(b.locked()).toEqual([]);
    expect(await b.get(e.id)).toMatchObject({
      name: 'Emboscada goblin',
      monsters: [{ monsterId: 'goblin-warrior', count: 4 }],
      notes: 'Puente',
    });
  });

  it('keeps it encrypted on the device: locked after a reload unless remembered', async () => {
    const dbA = new MemoryDb();
    const a = device(dbA).store;
    await a.createDmPassword(PASSWORD, false, FAST);
    const e = await a.create('Secreto');
    expect(JSON.stringify([...dbA.stores.get('encounters')!.values()])).not.toContain('Secreto');

    const again = device(dbA).store;
    await again.load();
    expect(again.all()).toEqual([]);
    expect(again.locked().map((l) => l.id)).toEqual([e.id]);
    await expect(again.save({ ...e, name: 'x' })).rejects.toThrow(/locked/);
    expect(await again.unlock(e.id, PASSWORD, true)).toBe(true);
    expect((await again.get(e.id))?.name).toBe('Secreto');
    // remembered: the key (not the password) is in the database
    expect(JSON.stringify([...dbA.stores.get('keys')!.values()])).not.toContain(PASSWORD);
    const third = device(dbA).store;
    await third.load();
    expect((await third.get(e.id))?.name).toBe('Secreto');
    await third.lock();
    expect(third.all()).toEqual([]);
    const fourth = device(dbA).store;
    await fourth.load();
    expect(fourth.locked()).toHaveLength(1);
  });

  it('an encounter with its own password opens only with that one', async () => {
    const repo = new FakeRepo();
    const a = device().store;
    await a.createDmPassword(PASSWORD, false, FAST);
    const own = await a.vault.newKey('solo para este encuentro', false, FAST);
    const e = await a.create('Jefe final', own);
    expect(a.hasOwnPassword(e.id)).toBe(true);
    await a.sync(repo);

    const b = device().store;
    await b.sync(repo);
    expect(b.locked()).toEqual([{ id: e.id, updatedAt: expect.any(String), dmPassword: false }]);
    await b.unlockDm(PASSWORD, false);
    expect(b.locked()).toHaveLength(1);
    expect(await b.unlock(e.id, PASSWORD, false)).toBe(false);
    expect(await b.unlock(e.id, 'solo para este encuentro', false)).toBe(true);
    expect((await b.get(e.id))?.name).toBe('Jefe final');
  });

  it('changes go both ways; the latest wins; deletions delete the file', async () => {
    const repo = new FakeRepo();
    const a = device().store;
    await a.createDmPassword(PASSWORD, false, FAST);
    const e = await a.create('Uno');
    await a.sync(repo);
    const b = device().store;
    await b.sync(repo);
    await b.unlockDm(PASSWORD, false);

    // both change it offline; b's change is later
    await a.save({ ...e, notes: 'de A' });
    await tick();
    await b.save({ ...(await b.get(e.id))!, notes: 'de B' });
    await b.sync(repo);
    await a.sync(repo);
    expect((await a.get(e.id))?.notes).toBe('de B');
    expect(a.pending()).toBe(0);

    // a later change from a wins over b's older copy
    await tick();
    await a.save({ ...(await a.get(e.id))!, notes: 'otra vez A' });
    await a.sync(repo);
    await b.sync(repo);
    expect((await b.get(e.id))?.notes).toBe('otra vez A');

    // deleting removes the file, and the other device forgets it
    await b.remove(e.id);
    expect(await b.sync(repo)).toMatchObject({ deleted: 1 });
    expect(repo.encounterFiles()).toEqual([]);
    expect(repo.commits.at(-1)).toBe(`Encuentro: borrar ${e.id}`);
    await a.sync(repo);
    expect(a.all()).toEqual([]);
  });

  it('works offline and uploads later; without a password nothing is uploaded', async () => {
    const repo = new FakeRepo();
    const a = device().store;
    const plain = await a.create('Sin contraseña aún');
    expect(await a.sync(repo)).toMatchObject({ uploaded: 0, waiting: 1 });
    expect(repo.files.size).toBe(0);
    expect(a.unprotected()).toBe(1);

    repo.offline = true;
    await a.createDmPassword(PASSWORD, false, FAST); // protects the encounter made before
    expect(a.unprotected()).toBe(0);
    await a.sync(repo);
    expect(a.syncError()).toMatch(/network/);
    expect(a.pending()).toBe(1);

    repo.offline = false;
    expect(await a.sync(repo)).toMatchObject({ uploaded: 1 });
    expect(a.pending()).toBe(0);
    expect(repo.encounterFiles().map((f) => f.id)).toEqual([plain.id]);
  });

  it("changing the DM's password re-encrypts its encounters", async () => {
    const repo = new FakeRepo();
    const a = device().store;
    await a.createDmPassword(PASSWORD, false, FAST);
    const e = await a.create('Cripta');
    await a.sync(repo);
    const before = repo.encounterFiles()[0].enc.salt;

    await a.changeDmPassword('una contraseña nueva', false, FAST);
    await a.sync(repo);
    expect(repo.encounterFiles()[0].enc.salt).not.toBe(before);

    const b = device().store;
    await b.sync(repo);
    expect(await b.unlockDm(PASSWORD, false)).toBe(false);
    expect(await b.unlockDm('una contraseña nueva', false)).toBe(true);
    expect((await b.get(e.id))?.name).toBe('Cripta');
  });
});
