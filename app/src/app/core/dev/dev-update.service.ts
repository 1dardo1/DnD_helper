import { DOCUMENT, Injectable, inject, isDevMode, signal } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';

const HELPER = 'http://127.0.0.1:4201';

interface UpdateResult {
  commits: number;
  restarted: boolean;
}

/**
 * The "Update" button of the development build: asks the helper started by `npm start`
 * (scripts/dev.mjs) to pull the repo. Without that helper, as in a published app, it stays hidden.
 */
@Injectable({ providedIn: 'root' })
export class DevUpdateService {
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);

  readonly available = signal(false);
  readonly updating = signal(false);
  readonly message = signal('');

  constructor() {
    if (isDevMode()) void this.check();
  }

  async run(): Promise<void> {
    this.updating.set(true);
    this.message.set('');
    try {
      const res = await fetch(`${HELPER}/update`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const result: UpdateResult = body;
      if (result.commits) {
        this.document.location.reload();
        return;
      }
      this.message.set(this.i18n.t('update.upToDate'));
    } catch (e) {
      this.message.set(this.i18n.t('update.failed', { message: (e as Error).message }));
    }
    this.updating.set(false);
  }

  private async check(): Promise<void> {
    try {
      this.available.set((await fetch(`${HELPER}/status`)).ok);
    } catch {
      // Started with plain `ng serve`: no helper, no button.
    }
  }
}
