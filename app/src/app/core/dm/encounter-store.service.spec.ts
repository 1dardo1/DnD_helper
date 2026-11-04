import { TestBed } from '@angular/core/testing';

import { LocalDb, StoreName } from '../storage/local-db';
import { normalizeEncounter } from './encounter';
import { EncounterStore } from './encounter-store.service';

/** In-memory replacement for IndexedDB. */
class MemoryDb {
  readonly stores = new Map<StoreName, Map<string, unknown>>();
  private s(name: StoreName) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return this.stores.get(name)!;
  }
  async get<T>(store: StoreName, key: string) {
    return structuredClone(this.s(store).get(key)) as T | undefined;
  }
  async getAll<T>(store: StoreName) {
    return structuredClone([...this.s(store).values()]) as T[];
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

describe('EncounterStore', () => {
  let db: MemoryDb;
  const fresh = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: LocalDb, useValue: db }] });
    return TestBed.inject(EncounterStore);
  };
  const tick = () => new Promise((r) => setTimeout(r, 5));

  beforeEach(() => {
    db = new MemoryDb();
  });

  it('creates, saves and reads back an encounter, also after a reload', async () => {
    const store = fresh();
    const e = await store.create('Emboscada goblin');
    expect(e.party).toEqual([]);
    e.party = [{ level: 3 }, { level: 3, characterId: 'ana', name: 'Ana' }];
    e.monsters = [
      { monsterId: 'goblin-warrior', count: 4 },
      { monsterId: 'bugbear-warrior', count: 1 },
    ];
    e.notes = 'En el puente';
    await store.save(e);

    const again = await fresh().get(e.id);
    expect(again).toMatchObject({
      id: e.id,
      name: 'Emboscada goblin',
      party: [{ level: 3 }, { level: 3, characterId: 'ana', name: 'Ana' }],
      monsters: [
        { monsterId: 'goblin-warrior', count: 4 },
        { monsterId: 'bugbear-warrior', count: 1 },
      ],
      notes: 'En el puente',
    });
  });

  it('get() returns a copy: changing it does not change the store until saved', async () => {
    const store = fresh();
    const e = await store.create('A');
    const copy = (await store.get(e.id))!;
    copy.name = 'B';
    expect((await store.get(e.id))!.name).toBe('A');
    expect(await store.get('missing')).toBeUndefined();
  });

  it('lists the most recently changed first', async () => {
    const store = fresh();
    const a = await store.create('A');
    await tick();
    await store.create('B');
    await tick();
    await store.save({ ...a, notes: 'x' });
    expect(store.all().map((e) => e.name)).toEqual(['A', 'B']);
  });

  it('duplicates with a new id and name, and deletes', async () => {
    const store = fresh();
    const e = await store.create('Original');
    await store.save({ ...e, monsters: [{ monsterId: 'goblin-boss', count: 2 }] });
    const copy = (await store.duplicate(e.id, 'Original (copia)'))!;
    expect(copy.id).not.toBe(e.id);
    expect(copy.monsters).toEqual([{ monsterId: 'goblin-boss', count: 2 }]);
    expect(store.all()).toHaveLength(2);

    await store.remove(e.id);
    expect(await store.get(e.id)).toBeUndefined();
    expect(store.all().map((x) => x.name)).toEqual(['Original (copia)']);
    expect(db.stores.get('encounters')!.size).toBe(1);
    expect(await store.duplicate('missing', 'x')).toBeUndefined();
  });

  it('normalises what it saves: levels 1–20, counts ≥ 1, repeated monsters merged', async () => {
    const store = fresh();
    const e = await store.create('X');
    const saved = await store.save({
      ...e,
      party: [{ level: 0 }, { level: 27 }, { level: 4.4 }],
      monsters: [
        { monsterId: 'a', count: 2 },
        { monsterId: 'b', count: 0 },
        { monsterId: 'a', count: 1 },
      ],
    });
    expect(saved.party.map((p) => p.level)).toEqual([1, 20, 4]);
    expect(saved.monsters).toEqual([{ monsterId: 'a', count: 3 }]);
  });

  it('reads records with missing fields', () => {
    expect(normalizeEncounter({ id: 'x' })).toMatchObject({
      id: 'x',
      name: '',
      party: [],
      monsters: [],
      notes: '',
    });
  });
});
