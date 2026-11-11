import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

import { CompendiumService } from '../compendium/compendium.service';
import { ApkUpdateService } from './apk-update.service';
import {
  PublishedVersion,
  VERSION_FILE,
  compareVersions,
  parsePublished,
  runningBuild,
} from './app-version';

export type UpdateStep =
  | 'idle'
  | 'checking'
  | 'clearing'
  | 'reloading'
  /** Android: a newer APK exists; it must be downloaded (the WebView can't replace itself). */
  | 'apk'
  | 'failed';

/**
 * Settings → Version: what is running, what is published, and the "check for updates and reload"
 * button, which does everything that can make a device show an old version: asks the service
 * worker for the new one, forgets a broken service worker, empties the compendium cache (not the
 * characters nor the settings) and reloads.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly compendium = inject(CompendiumService);
  private readonly apk = inject(ApkUpdateService);

  readonly running = runningBuild();
  readonly native = this.apk.env.native;
  /** The service worker serves the app offline (published web app only). */
  readonly swEnabled = !!this.sw?.isEnabled;

  readonly published = signal<PublishedVersion | null>(null);
  readonly publishedChecked = signal(false);
  readonly comparison = computed(() => compareVersions(this.running, this.published()));
  readonly step = signal<UpdateStep>('idle');

  /** Reads version.json of the published site (never from a cache). Not in the APK. */
  async checkPublished(): Promise<void> {
    if (this.native) return;
    try {
      const res = await fetch(`${VERSION_FILE}?ngsw-bypass=true&t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      this.published.set(res.ok ? parsePublished(await res.json()) : null);
    } catch {
      this.published.set(null); // offline, or development (there's no version.json)
    }
    this.publishedChecked.set(true);
  }

  async updateAndReload(): Promise<void> {
    this.step.set('checking');
    try {
      if (this.native) {
        await this.apk.checkNow();
        if (this.apk.available()) {
          this.step.set('apk');
          return;
        }
      } else {
        await this.checkPublished();
        await this.updateWebApp();
      }
      this.step.set('clearing');
      await this.compendium.refresh();
      this.step.set('reloading');
      this.document.location.reload();
    } catch {
      this.step.set('failed');
    }
  }

  /**
   * The service worker's own update first; if it still serves another commit than the published
   * one (or can't update), it is removed with its caches: the reload then comes from the network.
   */
  private async updateWebApp(): Promise<void> {
    const sw = this.sw;
    let updated = false;
    if (sw?.isEnabled) {
      updated = await sw
        .checkForUpdate()
        .then((found) => (found ? sw.activateUpdate() : false))
        .catch(() => false);
    }
    if (!updated && this.comparison() === 'newer') await this.forgetServiceWorker();
    // the page itself may sit in the HTTP cache (GitHub Pages: 10 min): ask the server again
    await fetch('./', { cache: 'reload' }).catch(() => undefined);
  }

  private async forgetServiceWorker(): Promise<void> {
    const registrations = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(registrations.map((r) => r.unregister()));
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('ngsw:')).map((k) => caches.delete(k)));
    }
  }
}
