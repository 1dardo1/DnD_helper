import { DOCUMENT, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ViewportScroller } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet, Scroll } from '@angular/router';

import { I18nService, TranslatePipe } from './core/i18n/i18n.service';
import { NavHistory } from './core/navigation/nav-history.service';
import { applyAppearance, effectiveTheme } from './core/settings/appearance';
import { Language, SettingsService } from './core/settings/settings.service';
import { ApkUpdateNotice } from './shared/apk-update-notice';
import { BackToTop } from './shell/back-to-top';
import { ShellStatus } from './shell/shell-status';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TranslatePipe, ApkUpdateNotice, BackToTop, ShellStatus],
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
    { path: '/dm', label: 'nav.dm' },
    { path: '/settings', label: 'nav.settings' },
  ] as const;

  /** Current path, to mark the tab: a character's sheet, level-up... belong to "Characters". */
  private readonly path = signal('');
  protected readonly activeTab = computed(() => {
    const p = this.path();
    if (p === '/characters/new') return p;
    return this.nav.find((n) => p === n.path || p.startsWith(n.path + '/'))?.path ?? null;
  });

  /** The device's own preference, for the theme button while the theme is 'auto'. */
  private readonly prefersDark = signal(false);
  protected readonly theme = computed(() =>
    effectiveTheme(this.settings.settings().theme, this.prefersDark()),
  );

  constructor() {
    const document = inject(DOCUMENT);
    effect(() => {
      const s = this.settings.settings();
      applyAppearance(
        {
          theme: s.theme,
          textSize: s.textSize,
          reduceMotion: s.reduceMotion,
          language: s.language,
        },
        document,
      );
    });
    const dark =
      typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    if (dark) {
      this.prefersDark.set(dark.matches);
      dark.addEventListener?.('change', (e) => this.prefersDark.set(e.matches));
    }
    inject(NavHistory); // starts recording the pages visited, for the "back" links
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
          restoreScroll(scroller, e.position);
        } else if (!samePage) scroller.scrollToPosition([0, 0]);
      });
  }

  /**
   * The title always leads to the compendium home (its routerLink drops any query params) at the
   * top, also when that page is already open: then there's no navigation to scroll it.
   */
  protected toTop(): void {
    window.scrollTo(0, 0);
  }

  protected setLanguage(language: string): void {
    this.settings.update({ language: language as Language });
  }

  /** The moon / sun button: the other theme, chosen explicitly (Settings has "automatic"). */
  protected toggleTheme(): void {
    this.settings.update({ theme: this.theme() === 'dark' ? 'light' : 'dark' });
  }
}

/**
 * Going back returns to the scroll position the page had. The page may still be loading its data
 * (a long list, the character wizard), so it keeps trying until the page is tall enough.
 */
function restoreScroll(scroller: ViewportScroller, pos: [number, number]): void {
  const started = Date.now();
  const attempt = () => {
    const reachable = document.documentElement.scrollHeight >= pos[1] + window.innerHeight - 2;
    scroller.scrollToPosition(pos);
    if (!reachable && Date.now() - started < 2000) setTimeout(attempt, 100);
  };
  setTimeout(attempt, 50);
}
