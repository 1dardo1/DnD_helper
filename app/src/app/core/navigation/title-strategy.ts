import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { I18nService, TranslationKey } from '../i18n/i18n.service';

/**
 * The browser tab / task switcher title of each page: the route's `title` is a translation key
 * (app.routes.ts), shown as "Conjuros · D&D Helper" and translated again when the language changes.
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly key = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const key = this.key();
      const app = this.i18n.t('app.title');
      this.title.setTitle(pageTitle(key && this.i18n.t(key as TranslationKey), app));
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot));
  }
}

/** "Conjuros · D&D Helper"; just the app's name when the page has none (or an unknown key). */
export function pageTitle(page: string | undefined, app: string): string {
  return page && page !== app && !/^[\w-]+(\.[\w-]+)+$/.test(page) ? `${page} · ${app}` : app;
}
