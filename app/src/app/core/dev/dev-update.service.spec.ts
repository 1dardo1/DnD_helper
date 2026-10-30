import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SettingsService } from '../settings/settings.service';
import { DevUpdateService } from './dev-update.service';

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('DevUpdateService', () => {
  beforeEach(() => TestBed.inject(SettingsService).update({ language: 'en' }));
  afterEach(() => vi.unstubAllGlobals());

  it('shows the button only when the helper answers', async () => {
    vi.stubGlobal('fetch', async () => reply(200, { ok: true }));
    const service = TestBed.inject(DevUpdateService);
    await vi.waitFor(() => expect(service.available()).toBe(true));
  });

  it('stays hidden without the helper', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('connection refused');
    });
    vi.stubGlobal('fetch', fetchFn);
    const service = TestBed.inject(DevUpdateService);
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(service.available()).toBe(false);
  });

  it('says so when there is nothing new', async () => {
    vi.stubGlobal('fetch', async () => reply(200, { commits: 0, restarted: false }));
    const service = TestBed.inject(DevUpdateService);
    await service.run();
    expect(service.message()).toBe('Already up to date.');
    expect(service.updating()).toBe(false);
  });

  it('shows why the update failed', async () => {
    vi.stubGlobal('fetch', async () => reply(500, { error: 'cannot fast-forward' }));
    const service = TestBed.inject(DevUpdateService);
    await service.run();
    expect(service.message()).toContain('cannot fast-forward');
    expect(service.updating()).toBe(false);
  });
});
