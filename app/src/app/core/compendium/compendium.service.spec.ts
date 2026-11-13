import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DataSource } from '../data/data-source';
import { RepositoryService } from '../data/repository.service';
import { LocalDb } from '../storage/local-db';
import { CompendiumService, withTimeout } from './compendium.service';

const META = { generatedAt: '2026-10-30T17:28:19+00:00', counts: {} };
const NEWER = { generatedAt: '2026-11-10T10:00:00+00:00', counts: {} };

function setup(readJson: (path: string) => Promise<unknown>) {
  const source = { kind: 'local', canWrite: false, readJson } as unknown as DataSource;
  TestBed.configureTestingModule({
    providers: [{ provide: RepositoryService, useValue: { source: signal(source) } }],
  });
  return { service: TestBed.inject(CompendiumService), db: TestBed.inject(LocalDb) };
}

describe('CompendiumService meta', () => {
  it('a slow network does not hold the pages when the device has the data', async () => {
    let answer!: (m: unknown) => void;
    const { service, db } = setup(() => new Promise((r) => (answer = r)));
    await db.put('compendium', 'meta', META);
    service.metaTimeoutMs = 20;
    await expect(service.getMeta()).resolves.toEqual(META);
    expect(service.offline()).toBe(true);
    // the late answer is kept for the next start
    answer(NEWER);
    await new Promise((r) => setTimeout(r, 0));
    expect(await db.get('compendium', 'meta')).toEqual(NEWER);
  });

  it('the first time it waits for the network, however slow', async () => {
    const { service } = setup(() => new Promise((r) => setTimeout(() => r(META), 40)));
    service.metaTimeoutMs = 5;
    await expect(service.getMeta()).resolves.toEqual(META);
    expect(service.offline()).toBe(false);
  });

  it('withTimeout passes values and errors through, and rejects when late', async () => {
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    await expect(withTimeout(Promise.reject(new Error('x')), 50)).rejects.toThrow('x');
    await expect(withTimeout(new Promise(() => undefined), 5)).rejects.toThrow('5 ms');
  });
});

describe('CompendiumService without a device copy', () => {
  it('reports the failure, and retry() tries the network again', async () => {
    let fail = true;
    const { service } = setup(() =>
      fail ? Promise.reject(new Error('offline')) : Promise.resolve(META),
    );
    await expect(service.getMeta()).rejects.toThrow('offline');
    fail = false;
    await expect(service.retry()).resolves.toEqual(META);
  });
});
