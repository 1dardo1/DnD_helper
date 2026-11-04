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
import { Character, CharacterRecord, newCharacter, normalizeCharacter } from '../models/character';
import { LocalDb, StoreName } from '../storage/local-db';
import { CharacterStore } from './character-store.service';

/** In-memory replacement for IndexedDB. */
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

/** A repo with characters/<id>.json files that behaves like GitHub: sha = git blob sha of the text,
 * and writes/deletes are refused (ConflictError) when the given sha isn't the current one. */
class FakeRepo implements Partial<DataSource> {
  readonly kind = 'github';
  readonly canWrite = true;
  readonly files = new Map<string, string>();
  commits: string[] = [];
  offline = false;
  set(c: Character) {
    this.files.set(`characters/${c.id}.json`, toJsonText(c));
  }
  get(id: string): Character | undefined {
    const t = this.files.get(`characters/${id}.json`);
    return t ? JSON.parse(t) : undefined;
  }
  async listJson(): Promise<RepoFile[]> {
    this.check();
    return Promise.all(
      [...this.files].map(async ([path, text]) => ({ path, sha: await gitBlobSha(text) })),
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
  private check() {
    if (this.offline) throw new DataSourceError('network error');
  }
}

function setup(memory = new MemoryDb()) {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: LocalDb, useValue: memory }] });
  return { store: TestBed.inject(CharacterStore), repo: new FakeRepo(), memory };
}

const asSource = (r: FakeRepo) => r as unknown as DataSource;

describe('gitBlobSha', () => {
  it('matches git hash-object', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
});

describe('normalizeCharacter', () => {
  it('fills missing fields and rejects non-characters', () => {
    const c = normalizeCharacter({ id: 'a', name: 'A', choices: { skills: ['stealth'] } })!;
    expect(c.choices.skills).toEqual(['stealth']);
    expect(c.choices.expertise).toEqual([]);
    expect(c.equipped).toEqual({ armorId: null, shield: false });
    expect(normalizeCharacter({ name: 'no id' })).toBeNull();
    expect(normalizeCharacter('nope')).toBeNull();
  });
});

describe('CharacterStore', () => {
  it('imports backups as pending upload, replacing over the repo version', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    repo.set(c);
    await store.pull(asSource(repo));
    await store.remove('thorin'); // pending-delete: the import brings it back
    const fromFile = { ...c, notes: 'from the backup', updatedAt: '2026-01-02T03:04:05.000Z' };
    const fresh = { ...newCharacter('Lía', 'pc'), id: 'lia' };
    await store.importCharacters([fromFile, fresh]);
    expect(store.all().map((r) => [r.character.id, r.status])).toEqual([
      ['lia', 'local'],
      ['thorin', 'local'],
    ]);
    expect((await store.get('thorin'))!.character.updatedAt).toBe(fromFile.updatedAt);

    await store.push(asSource(repo));
    expect(repo.get('thorin')?.notes).toBe('from the backup');
    expect(repo.get('lia')?.name).toBe('Lía');
    expect(store.all().every((r) => r.status === 'synced')).toBe(true);
  });

  it('saves on the device as not saved to the cloud', async () => {
    const { store } = setup();
    const r = await store.save(newCharacter('Thorin', 'test'));
    expect(r.status).toBe('local');
    expect(store.all().map((x) => x.character.name)).toEqual(['Thorin']);
  });

  it('pulls new repo characters as synced, then follows repo changes', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    repo.set(c);
    expect(await store.pull(asSource(repo))).toMatchObject({ added: 1, updated: 0, conflicts: 0 });
    let r = (await store.get('thorin'))!;
    expect(r.status).toBe('synced');
    expect(r.baseSha).toBe(await gitBlobSha(repo.files.get('characters/thorin.json')!));

    // nothing changed → nothing to do
    expect(await store.pull(asSource(repo))).toMatchObject({ added: 0, updated: 0, conflicts: 0 });

    repo.set({ ...c, name: 'Thorin II' });
    expect(await store.pull(asSource(repo))).toMatchObject({ added: 0, updated: 1, conflicts: 0 });
    r = (await store.get('thorin'))!;
    expect(r.character.name).toBe('Thorin II');
    expect(r.status).toBe('synced');
  });

  it('turns changes on both sides into a conflict keeping both versions', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    repo.set(c);
    await store.pull(asSource(repo));

    await store.save({ ...c, notes: 'edited on this device' }); // → local
    repo.set({ ...c, notes: 'edited elsewhere' });
    expect(await store.pull(asSource(repo))).toMatchObject({ added: 0, updated: 0, conflicts: 1 });

    const r: CharacterRecord = (await store.get('thorin'))!;
    expect(r.status).toBe('conflict');
    expect(r.character.notes).toBe('edited on this device');
    expect(r.remote?.notes).toBe('edited elsewhere');
  });

  it('keeps local changes when the repo did not change', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    repo.set(c);
    await store.pull(asSource(repo));
    await store.save({ ...c, notes: 'mine' });
    await store.pull(asSource(repo));
    const r = (await store.get('thorin'))!;
    expect(r.status).toBe('local');
    expect(r.character.notes).toBe('mine');
  });

  it('uploads a new character with one commit and confirms it', async () => {
    const { store, repo } = setup();
    const r = await store.save({ ...newCharacter('Thorin', 'pc'), id: 'thorin' });
    expect(r.status).toBe('local');
    expect(await store.push(asSource(repo))).toMatchObject({ uploaded: 1, conflicts: 0 });
    expect(repo.get('thorin')?.name).toBe('Thorin');
    expect(repo.commits).toHaveLength(1);
    const after = (await store.get('thorin'))!;
    expect(after.status).toBe('synced');
    expect(after.baseSha).toBe(await gitBlobSha(repo.files.get('characters/thorin.json')!));
    // nothing more to send
    expect(await store.push(asSource(repo))).toMatchObject({ uploaded: 0 });
    expect(repo.commits).toHaveLength(1);
  });

  it('keeps an edit saved while its previous version was being uploaded', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    await store.save(c);
    const write = repo.writeJson.bind(repo);
    repo.writeJson = async (...args) => {
      const written = await write(...args);
      await store.save({ ...c, notes: 'tapped during the upload' });
      return written;
    };
    expect(await store.push(asSource(repo))).toMatchObject({ uploaded: 1, conflicts: 0 });
    let r = (await store.get('thorin'))!;
    expect(r.status).toBe('local');
    expect(r.character.notes).toBe('tapped during the upload');

    repo.writeJson = write;
    await store.push(asSource(repo));
    r = (await store.get('thorin'))!;
    expect(r.status).toBe('synced');
    expect(repo.get('thorin')?.notes).toBe('tapped during the upload');
  });

  it('uploads edits on top of the repo version', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    repo.set(c);
    await store.pull(asSource(repo));
    await store.save({ ...c, notes: 'level up' });
    await store.push(asSource(repo));
    expect(repo.get('thorin')?.notes).toBe('level up');
    expect((await store.get('thorin'))!.status).toBe('synced');
  });

  it('turns a refused commit into a conflict without touching the repo', async () => {
    const { store, repo } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    repo.set(c);
    await store.pull(asSource(repo));
    await store.save({ ...c, notes: 'mine' });
    // changed elsewhere between this device's pull and its push
    repo.set({ ...c, notes: 'theirs' });
    expect(await store.push(asSource(repo))).toMatchObject({ uploaded: 0, conflicts: 1 });
    expect(repo.get('thorin')?.notes).toBe('theirs');
    const r = (await store.get('thorin'))!;
    expect(r.status).toBe('conflict');
    expect(r.character.notes).toBe('mine');
    expect(r.remote?.notes).toBe('theirs');
  });

  it('resolves conflicts keeping this version, the other one, or both', async () => {
    const make = async () => {
      const ctx = setup();
      const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
      ctx.repo.set(c);
      await ctx.store.pull(asSource(ctx.repo));
      await ctx.store.save({ ...c, notes: 'mine' });
      ctx.repo.set({ ...c, notes: 'theirs' });
      await ctx.store.push(asSource(ctx.repo));
      return ctx;
    };

    let { store, repo } = await make();
    await store.keepLocal('thorin');
    await store.push(asSource(repo));
    expect(repo.get('thorin')?.notes).toBe('mine');
    expect((await store.get('thorin'))!.status).toBe('synced');

    TestBed.resetTestingModule();
    ({ store, repo } = await make());
    await store.keepRemote('thorin');
    const kept = (await store.get('thorin'))!;
    expect(kept.status).toBe('synced');
    expect(kept.character.notes).toBe('theirs');
    expect(await store.push(asSource(repo))).toMatchObject({ uploaded: 0 });

    TestBed.resetTestingModule();
    ({ store, repo } = await make());
    const copy = (await store.keepBoth('thorin', 'copia'))!;
    expect(copy.name).toBe('Thorin (copia)');
    await store.push(asSource(repo));
    expect(repo.get('thorin')?.notes).toBe('theirs');
    expect(repo.get(copy.id)?.notes).toBe('mine');
    expect(store.all().map((r) => r.status)).toEqual(['synced', 'synced']);
  });

  it('keeps changes on the device while offline and sends them later', async () => {
    const { store, repo } = setup();
    await store.save({ ...newCharacter('Thorin', 'pc'), id: 'thorin' });
    repo.offline = true;
    await expect(store.push(asSource(repo))).rejects.toBeInstanceOf(DataSourceError);
    expect((await store.get('thorin'))!.status).toBe('local');
    repo.offline = false;
    await store.push(asSource(repo));
    expect((await store.get('thorin'))!.status).toBe('synced');
  });

  it('resends a commit that was sent but never reached the repo', async () => {
    const { store, repo, memory } = setup();
    const r = await store.save({ ...newCharacter('Thorin', 'pc'), id: 'thorin' });
    // as if the app had been closed right after sending a commit that got lost
    await memory.put('characters', 'thorin', { ...r, status: 'sent', sentSha: 'lost' });
    TestBed.resetTestingModule();
    const fresh = setup(memory).store;
    await fresh.push(asSource(repo));
    expect(repo.get('thorin')?.name).toBe('Thorin');
    expect((await fresh.get('thorin'))!.status).toBe('synced');
  });

  it('confirms a commit that did reach the repo', async () => {
    const { store, repo, memory } = setup();
    const c = { ...newCharacter('Thorin', 'pc'), id: 'thorin' };
    const r = await store.save(c);
    const written = await repo.writeJson('characters/thorin.json', r.character, null, 'sent');
    await memory.put('characters', 'thorin', { ...r, status: 'sent', sentSha: written.sha });
    TestBed.resetTestingModule();
    const fresh = setup(memory).store;
    await fresh.pull(asSource(repo));
    expect((await fresh.get('thorin'))!.status).toBe('synced');
    expect(repo.commits).toHaveLength(1);
  });

  it('deletes from the repo, but keeps a version changed elsewhere', async () => {
    const { store, repo } = setup();
    const a = { ...newCharacter('A', 'pc'), id: 'a' };
    const b = { ...newCharacter('B', 'pc'), id: 'b' };
    repo.set(a);
    repo.set(b);
    await store.pull(asSource(repo));
    await store.remove('a');
    await store.remove('b');
    expect(store.all().map((r) => r.character.id)).toEqual([]);
    repo.set({ ...b, notes: 'edited on another device' });
    expect(await store.push(asSource(repo))).toMatchObject({ deleted: 1 });
    expect(repo.get('a')).toBeUndefined();
    expect(repo.get('b')?.notes).toBe('edited on another device');
    const restored = (await store.get('b'))!;
    expect(restored.status).toBe('synced');
    expect(restored.character.notes).toBe('edited on another device');
  });
});
