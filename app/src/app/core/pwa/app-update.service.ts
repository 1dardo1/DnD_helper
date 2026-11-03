import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** An installed app can stay open for days: look for a new version at most this often. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * The published web app works offline through Angular's service worker (ngsw-config.json), which
 * keeps serving the version it cached. When a newer one has been downloaded in the background,
 * `ready` turns on and the top bar offers to reload; nothing happens without the user's click.
 * Without a service worker (development, the Android app, tests) it does nothing.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);

  readonly ready = signal(false);

  constructor() {
    const sw = this.sw;
    if (!sw?.isEnabled) return;
    sw.versionUpdates
      .pipe(
        filter((e) => e.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.ready.set(true));
    // The cached version can't be served any more (files evicted...): only a reload fixes it.
    sw.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.ready.set(true));

    let lastCheck = Date.now();
    const check = () => {
      if (this.document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY_MS)
        return;
      lastCheck = Date.now();
      sw.checkForUpdate().catch(() => undefined); // offline: try again later
    };
    this.document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, CHECK_EVERY_MS);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    });
  }

  async reload(): Promise<void> {
    await this.sw?.activateUpdate().catch(() => false);
    this.document.location.reload();
  }
}
