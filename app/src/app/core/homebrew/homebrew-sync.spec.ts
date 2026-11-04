import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

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
import { CustomBackground, normalizeCustomBackground } from './custom-background';
import {
  HomebrewRecord,
  decideMissingRemote,
  decideRemoteChange,
  idOf,
  needsRead,
  pathOf,
  planBackgroundImport,
  toPush,
} from './homebrew-sync';
import { HomebrewStore } from './homebrew-store.service';

function bg(
  id: string,
  updatedAt: string,
  extra: Partial<CustomBackground> = {},
): CustomBackground {
  return normalizeCustomBackground({
    id,
    name: id,
    description: 'x',
    updatedAt,
    createdAt: updatedAt,
    ...extra,
  })!;
}
const record = (
  b: CustomBackground,
  status: HomebrewRecord['status'] = 'synced',
  baseSha: string | null = 'sha1',
): HomebrewRecord => ({ background: b, status, baseSha });

const OLD = '2026-11-01T10:00:00.000Z';
const NEW = '2026-11-02T10:00:00.000Z';

describe('paths', () => {
  it('maps ids to homebrew/backgrounds/<id>.json and back', () => {
    expect(pathOf('custom-a-b')).toBe('homebrew/backgrounds/custom-a-b.json');
    expect(idOf('homebrew/backgrounds/custom-a-b.json')).toBe('custom-a-b');
  });
});

describe('sync decisions', () => {
  it('reads a repo file only when it is new here or changed', () => {
    const r = record(bg('custom-a-aaaaaa', OLD));
    expect(needsRead(undefined, 'x')).toBe(true);
    expect(needsRead(r, 'sha1')).toBe(false);
    expect(needsRead(r, 'sha2')).toBe(true);
    expect(needsRead(record(r.background, 'pending-delete'), 'sha2')).toBe(false);
  });

  it('adds new files, and a synced background takes the repo version', () => {
    const remote = bg('custom-a-aaaaaa', NEW);
    expect(decideRemoteChange(undefined, remote)).toBe('add');
    expect(decideRemoteChange(record(bg('custom-a-aaaaaa', OLD)), remote)).toBe('take-remote');
  });

  it('with changes on both sides the last writer wins', () => {
    const local = record(bg('custom-a-aaaaaa', NEW), 'local');
    expect(decideRemoteChange(local, bg('custom-a-aaaaaa', OLD))).toBe('keep-local');
    expect(decideRemoteChange(local, bg('custom-a-aaaaaa', '2026-11-03T00:00:00.000Z'))).toBe(
      'take-remote',
    );
    // same time: the repo's version, which every device sees
    expect(decideRemoteChange(local, bg('custom-a-aaaaaa', NEW))).toBe('take-remote');
  });

  it('uploads again a background whose file vanished, and forgets a deleted one', () => {
    const r = record(bg('custom-a-aaaaaa', OLD));
    expect(decideMissingRemote(r)).toBe('upload');
    expect(decideMissingRemote(record(r.background, 'pending-delete'))).toBe('forget');
  });

  it('pushes edited, deleted and vanished backgrounds only', () => {
    const a = record(bg('custom-a-aaaaaa', OLD), 'synced');
    const b = record(bg('custom-b-bbbbbb', OLD), 'local', null);
    const c = record(bg('custom-c-cccccc', OLD), 'pending-delete');
    const d = record(bg('custom-d-dddddd', OLD), 'synced');
    const inRepo = new Map([
      ['custom-a-aaaaaa', 's'],
      ['custom-c-cccccc', 's'],
    ]);
    expect(toPush([a, b, c, d], inRepo)).toEqual([b, c, d]);
  });
});

describe('backup import plan', () => {
  it('adds new ones and keeps the most recently edited version', () => {
    const here = [bg('custom-a-aaaaaa', NEW), bg('custom-b-bbbbbb', OLD)];
    const plan = planBackgroundImport(
      [
        bg('custom-a-aaaaaa', OLD), // older than here: skipped
        bg('custom-b-bbbbbb', NEW), // newer: replaces
        bg('custom-c-cccccc', OLD), // new
        bg('custom-c-cccccc', NEW), // same id twice in the file: the latest
      ],
      here,
    );
    expect(plan).toMatchObject({ added: 1, updated: 1, skipped: 1 });
    expect(plan.toWrite.map((b) => [b.id, b.updatedAt])).toEqual([
      ['custom-b-bbbbbb', NEW],
      ['custom-c-cccccc', NEW],
    ]);
  });
});

// -- the store against a fake GitHub ------------------------------------------------------------

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
}

class FakeRepo implements Partial<DataSource> {
  readonly kind = 'github';
  readonly canWrite = true;
  readonly files = new Map<string, string>();
  offline = false;
  async listJson(dir: string): Promise<RepoFile[]> {
    this.check();
    return Promise.all(
      [...this.files]
        .filter(([p]) => p.startsWith(dir + '/'))
        .map(async ([path, text]) => ({ path, sha: await gitBlobSha(text) })),
    );
  }
  async readJsonWithSha<T>(path: string): Promise<FileContent<T> | null> {
    this.check();
    const text = this.files.get(path);
    return text ? { path, sha: await gitBlobSha(text), content: JSON.parse(text) } : null;
  }
  async writeJson(path: string, content: unknown, sha: string | null): Promise<RepoFile> {
    this.check();
    const old = this.files.get(path);
    if ((old ? await gitBlobSha(old) : null) !== sha) throw new ConflictError(path);
    const text = toJsonText(content);
    this.files.set(path, text);
    return { path, sha: await gitBlobSha(text) };
  }
  async deleteFile(path: string, sha: string): Promise<void> {
    this.check();
    const old = this.files.get(path);
    if (old && (await gitBlobSha(old)) !== sha) throw new ConflictError(path);
    this.files.delete(path);
  }
  put(b: CustomBackground) {
    this.files.set(pathOf(b.id), toJsonText(b));
  }
  private check() {
    if (this.offline) throw new DataSourceError('network error');
  }
}

describe('HomebrewStore', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [{ provide: LocalDb, useClass: MemoryDb }] });
    return { store: TestBed.inject(HomebrewStore), repo: new FakeRepo() };
  }
  const src = (r: FakeRepo) => r as unknown as DataSource;

  it('uploads a new background as homebrew/backgrounds/<id>.json and marks it synced', async () => {
    const { store, repo } = setup();
    const b = bg('custom-a-aaaaaa', OLD);
    await store.save(b);
    expect(store.pending()).toBe(1);
    const result = await store.sync(src(repo));
    expect(result.uploaded).toBe(1);
    expect([...repo.files.keys()]).toEqual(['homebrew/backgrounds/custom-a-aaaaaa.json']);
    expect(JSON.parse(repo.files.get(pathOf(b.id))!)).toMatchObject({ id: b.id, custom: true });
    expect(store.pending()).toBe(0);
  });

  it('pulls backgrounds made on another device, and their later edits', async () => {
    const { store, repo } = setup();
    repo.put(bg('custom-a-aaaaaa', OLD));
    expect((await store.sync(src(repo))).added).toBe(1);
    expect(store.backgrounds().map((b) => b.id)).toEqual(['custom-a-aaaaaa']);
    repo.put(bg('custom-a-aaaaaa', NEW, { description: 'edited elsewhere' }));
    expect((await store.sync(src(repo))).updated).toBe(1);
    expect(store.backgrounds()[0].description).toBe('edited elsewhere');
  });

  it('last writer wins when both sides changed', async () => {
    const { store, repo } = setup();
    repo.put(bg('custom-a-aaaaaa', OLD));
    await store.sync(src(repo));
    // edited here at NEW, and in the repo later
    await store.save(bg('custom-a-aaaaaa', NEW, { description: 'mine' }));
    repo.put(bg('custom-a-aaaaaa', '2026-11-03T00:00:00.000Z', { description: 'theirs' }));
    await store.sync(src(repo));
    expect(store.backgrounds()[0].description).toBe('theirs');
    expect(store.pending()).toBe(0);
    // edited here later than the repo
    await store.save(bg('custom-a-aaaaaa', '2026-11-04T00:00:00.000Z', { description: 'mine 2' }));
    repo.put(bg('custom-a-aaaaaa', '2026-11-03T12:00:00.000Z', { description: 'theirs 2' }));
    await store.sync(src(repo));
    expect(store.backgrounds()[0].description).toBe('mine 2');
    expect(JSON.parse(repo.files.get(pathOf('custom-a-aaaaaa'))!).description).toBe('mine 2');
  });

  it('deleting removes the file from the repo; a never-uploaded one just disappears', async () => {
    const { store, repo } = setup();
    await store.save(bg('custom-a-aaaaaa', OLD));
    await store.sync(src(repo));
    await store.save(bg('custom-b-bbbbbb', OLD));
    await store.remove('custom-b-bbbbbb'); // never uploaded
    await store.remove('custom-a-aaaaaa');
    expect(store.backgrounds()).toEqual([]);
    const result = await store.sync(src(repo));
    expect(result.deleted).toBe(1);
    expect(repo.files.size).toBe(0);
  });

  it('keeps everything when offline and sends it later', async () => {
    const { store, repo } = setup();
    await store.save(bg('custom-a-aaaaaa', OLD));
    repo.offline = true;
    await expect(store.sync(src(repo))).rejects.toBeInstanceOf(DataSourceError);
    expect(store.pending()).toBe(1);
    repo.offline = false;
    await store.sync(src(repo));
    expect(store.pending()).toBe(0);
  });

  it('the approval tick is an edit that syncs', async () => {
    const { store, repo } = setup();
    await store.save(bg('custom-a-aaaaaa', OLD));
    await store.sync(src(repo));
    await store.setApproved('custom-a-aaaaaa', true);
    await store.sync(src(repo));
    expect(JSON.parse(repo.files.get(pathOf('custom-a-aaaaaa'))!).dmApproved).toBe(true);
  });

  it('imports from a backup without losing newer local edits', async () => {
    const { store } = setup();
    await store.save(bg('custom-a-aaaaaa', NEW, { description: 'local' }));
    const plan = await store.importBackgrounds([
      bg('custom-a-aaaaaa', OLD, { description: 'old' }),
      bg('custom-b-bbbbbb', OLD),
    ]);
    expect(plan).toMatchObject({ added: 1, skipped: 1 });
    expect(store.backgrounds().map((b) => b.description)).toEqual(['local', 'x']);
  });
});
