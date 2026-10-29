import { TestBed } from '@angular/core/testing';

import { DataSource, FileContent, RepoFile } from '../data/data-source';
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

/** A repo with characters/<id>.json files; sha = git blob sha of their text. */
class FakeRepo implements Partial<DataSource> {
  readonly files = new Map<string, string>();
  set(c: Character) {
    this.files.set(`characters/${c.id}.json`, JSON.stringify(c, null, 2) + '\n');
  }
  async listJson(): Promise<RepoFile[]> {
    return Promise.all(
      [...this.files].map(async ([path, text]) => ({ path, sha: await gitBlobSha(text) })),
    );
  }
  async readJsonWithSha<T>(path: string): Promise<FileContent<T> | null> {
    const text = this.files.get(path);
    return text ? { path, sha: await gitBlobSha(text), content: JSON.parse(text) } : null;
  }
}

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: LocalDb, useClass: MemoryDb }] });
  return { store: TestBed.inject(CharacterStore), repo: new FakeRepo() };
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
    expect(await store.pull(asSource(repo))).toEqual({ added: 1, updated: 0, conflicts: 0 });
    let r = (await store.get('thorin'))!;
    expect(r.status).toBe('synced');
    expect(r.baseSha).toBe(await gitBlobSha(repo.files.get('characters/thorin.json')!));

    // nothing changed → nothing to do
    expect(await store.pull(asSource(repo))).toEqual({ added: 0, updated: 0, conflicts: 0 });

    repo.set({ ...c, name: 'Thorin II' });
    expect(await store.pull(asSource(repo))).toEqual({ added: 0, updated: 1, conflicts: 0 });
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
    expect(await store.pull(asSource(repo))).toEqual({ added: 0, updated: 0, conflicts: 1 });

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
});
