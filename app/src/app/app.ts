import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ViewportScroller } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet, Scroll } from '@angular/router';

import { ApkUpdateService } from './core/app-update/apk-update.service';
import { CharacterStore } from './core/characters/character-store.service';
import { SyncService } from './core/characters/sync.service';
import { RepositoryService } from './core/data/repository.service';
import { DevUpdateService } from './core/dev/dev-update.service';
import { AppUpdateService } from './core/pwa/app-update.service';
import { I18nService, TranslatePipe } from './core/i18n/i18n.service';
import { Language, SettingsService } from './core/settings/settings.service';
import { ApkUpdateNotice } from './shared/apk-update-notice';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TranslatePipe, ApkUpdateNotice],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly settings = inject(SettingsService);
  protected readonly language = inject(I18nService).language;

  protected readonly nav = [
    { path: '/compendium', label: 'nav.compendium' },
    { path: '/characters', label: 'nav.characters' },
    { path: '/characters/new', label: 'nav.create' },
    { path: '/settings', label: 'nav.settings' },
  ] as const;

  /** Current path, to mark the tab: a character's sheet, level-up... belong to "Characters". */
  private readonly path = signal('');
  protected readonly activeTab = computed(() => {
    const p = this.path();
    if (p === '/characters/new') return p;
    return this.nav.find((n) => p === n.path || p.startsWith(n.path + '/'))?.path ?? null;
  });

  protected readonly sync = inject(SyncService);
  protected readonly store = inject(CharacterStore);
  protected readonly update = inject(DevUpdateService);
  protected readonly appUpdate = inject(AppUpdateService);
  private readonly repo = inject(RepositoryService);
  /** Local files can't be written: say so instead of "not saved to the cloud". */
  protected readonly readOnly = computed(() => this.repo.source()?.canWrite === false);

  constructor() {
    effect(() => (document.documentElement.lang = this.language()));
    void this.store.load();
    this.sync.start(inject(DestroyRef));
    void inject(ApkUpdateService).start();
    this.scrollOnNavigation();
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationEnd) this.path.set(e.urlAfterRedirects.split(/[?#]/)[0]);
      });
  }

  /**
   * A new page starts at the top, and going back returns to where the previous one was. Changes
   * that stay on the same page (filters kept in the URL) don't move it.
   */
  private scrollOnNavigation(): void {
    const scroller = inject(ViewportScroller);
    let path = '';
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (!(e instanceof Scroll)) return;
        const ev = e.routerEvent;
        const next = ('urlAfterRedirects' in ev ? ev.urlAfterRedirects : ev.url).split('?')[0];
        const samePage = next === path;
        path = next;
        if (e.position) {
          const pos = e.position;
          setTimeout(() => scroller.scrollToPosition(pos), 50);
        } else if (!samePage) scroller.scrollToPosition([0, 0]);
      });
  }

  protected setLanguage(language: string): void {
    this.settings.update({ language: language as Language });
  }
}
