import { Injectable, InjectionToken, computed, inject, isDevMode, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import {
  ApkRelease,
  RELEASE_API,
  checkDue,
  isNewer,
  parseBuild,
  parseRelease,
} from './apk-release';

/** Set by apk.yml: `ng build --define APP_BUILD=<run number>`. Absent in web and dev builds. */
declare const APP_BUILD: number | undefined;

export interface ApkUpdateEnv {
  /** Running inside the Android app (Capacitor), not in a browser. */
  native: boolean;
  /** This APK's build number, or null when built without one. */
  build: number | null;
}

/** Development builds only: lets a browser pretend to be the APK, e.g. `{"build": 3}`. */
export const FAKE_ENV_KEY = 'dnd-helper.apkUpdate.fake';
export const STATE_KEY = 'dnd-helper.apkUpdate';

export const APK_UPDATE_ENV = new InjectionToken<ApkUpdateEnv>('APK_UPDATE_ENV', {
  providedIn: 'root',
  factory: () => {
    if (isDevMode()) {
      const fake = readJson<{ build?: unknown }>(FAKE_ENV_KEY);
      if (fake) return { native: true, build: parseBuild(fake.build) };
    }
    return {
      native: Capacitor.isNativePlatform(),
      build: parseBuild(typeof APP_BUILD !== 'undefined' ? APP_BUILD : null),
    };
  },
});

interface StoredState {
  /** Last time GitHub answered. */
  checkedAt?: number;
  latest?: ApkRelease;
  /** The build whose notice was closed: it isn't shown again (a later one is). */
  dismissed?: number;
}

/**
 * "There's a new version" for the Android app, which never updates itself: at most once a day it
 * asks GitHub which build the "android-latest" release holds. Silent when offline or GitHub fails.
 */
@Injectable({ providedIn: 'root' })
export class ApkUpdateService {
  readonly env = inject(APK_UPDATE_ENV);
  private readonly latest = signal<ApkRelease | null>(null);
  private readonly dismissed = signal<number | null>(null);
  /** When GitHub last answered (ms), for Settings → Version. */
  readonly checkedAt = signal<number | null>(null);
  /** The build the "android-latest" release holds, whatever this APK's build is. */
  readonly latestRelease = this.latest.asReadonly();

  /** The newer release to offer, or null. */
  readonly available = computed(() => {
    const build = this.env.build;
    const latest = this.latest();
    if (build === null || !latest || !isNewer(build, latest)) return null;
    return latest.build === this.dismissed() ? null : latest;
  });

  /** Looks for a new version (does nothing outside the Android app or without a build number). */
  async start(now = Date.now(), force = false): Promise<void> {
    if (!this.env.native || this.env.build === null) return;
    const state = readJson<StoredState>(STATE_KEY) ?? {};
    if (state.latest) this.latest.set(state.latest);
    if (typeof state.dismissed === 'number') this.dismissed.set(state.dismissed);
    if (typeof state.checkedAt === 'number') this.checkedAt.set(state.checkedAt);
    if (!force && !checkDue(state.checkedAt, now)) return;
    try {
      const res = await fetch(RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return;
      const latest = parseRelease(await res.json());
      this.latest.set(latest);
      this.checkedAt.set(now);
      this.save({ checkedAt: now, latest: latest ?? undefined });
    } catch {
      // Offline, timeout or GitHub down: try again next time the app opens.
    }
  }

  /** Asks GitHub now, even if it was asked today (Settings → "Check for updates"). */
  checkNow(now = Date.now()): Promise<void> {
    return this.start(now, true);
  }

  /** Hides the notice for this release; a later one shows it again. */
  dismiss(): void {
    const latest = this.latest();
    if (!latest) return;
    this.dismissed.set(latest.build);
    this.save({ dismissed: latest.build });
  }

  private save(patch: StoredState): void {
    try {
      const state = { ...readJson<StoredState>(STATE_KEY), ...patch };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      // No storage: it asks again next time.
    }
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
}
