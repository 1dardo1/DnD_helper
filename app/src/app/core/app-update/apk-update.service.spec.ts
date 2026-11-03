import { TestBed } from '@angular/core/testing';

import { CHECK_INTERVAL_MS, RELEASE_API } from './apk-release';
import { APK_UPDATE_ENV, ApkUpdateEnv, ApkUpdateService, STATE_KEY } from './apk-update.service';

const URL = 'https://github.com/1dardo1/DnD_helper/releases/download/android-latest/dnd-helper.apk';
const release = (build: number) => ({
  body: `APK generada automáticamente (ejecución ${build}).\n\nbuild: ${build}`,
  assets: [{ name: 'dnd-helper.apk', browser_download_url: URL }],
});

describe('ApkUpdateService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const now = 1_800_000_000_000;

  function service(env: ApkUpdateEnv): ApkUpdateService {
    TestBed.configureTestingModule({ providers: [{ provide: APK_UPDATE_ENV, useValue: env }] });
    return TestBed.inject(ApkUpdateService);
  }

  function answer(body: unknown, ok = true): void {
    fetchMock.mockResolvedValue({ ok, json: async () => body });
  }

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('offers a later build, with its download link', async () => {
    answer(release(12));
    const update = service({ native: true, build: 10 });
    await update.start(now);
    expect(fetchMock).toHaveBeenCalledWith(RELEASE_API, expect.anything());
    expect(update.available()).toEqual({ build: 12, url: URL });
  });

  it('says nothing when up to date', async () => {
    answer(release(10));
    const update = service({ native: true, build: 10 });
    await update.start(now);
    expect(update.available()).toBeNull();
  });

  it('never asks in a browser or without a build number', async () => {
    answer(release(12));
    await service({ native: false, build: 10 }).start(now);
    TestBed.resetTestingModule();
    await service({ native: true, build: null }).start(now);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays silent offline or when GitHub fails, and asks again next time', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const update = service({ native: true, build: 10 });
    await update.start(now);
    expect(update.available()).toBeNull();

    answer({ message: 'API rate limit exceeded' }, false);
    await update.start(now + 1000);
    expect(update.available()).toBeNull();

    answer(release(11));
    await update.start(now + 2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(update.available()?.build).toBe(11);
  });

  it('asks at most once a day, remembering the answer', async () => {
    answer(release(12));
    await service({ native: true, build: 10 }).start(now);
    TestBed.resetTestingModule();

    const again = service({ native: true, build: 10 });
    await again.start(now + 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.available()?.build).toBe(12);

    answer(release(13));
    await again.start(now + CHECK_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(again.available()?.build).toBe(13);
  });

  it('once installed, the remembered release is no longer offered', async () => {
    answer(release(12));
    await service({ native: true, build: 10 }).start(now);
    TestBed.resetTestingModule();
    const updated = service({ native: true, build: 12 });
    await updated.start(now + 60_000);
    expect(updated.available()).toBeNull();
  });

  it('closing the notice hides that build, but not a later one', async () => {
    answer(release(12));
    const update = service({ native: true, build: 10 });
    await update.start(now);
    update.dismiss();
    expect(update.available()).toBeNull();
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!).dismissed).toBe(12);

    answer(release(13));
    await update.start(now + CHECK_INTERVAL_MS);
    expect(update.available()?.build).toBe(13);
  });
});
