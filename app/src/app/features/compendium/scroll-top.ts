import { Component, DestroyRef, inject, signal } from '@angular/core';

import { BROWSE_TEXTS } from '../../core/i18n/browse.es';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';

/** Scrolled this many screens down before the button shows. */
const SHOW_AFTER_SCREENS = 1.5;

/**
 * A round "back to the top" button that floats over long pages (lists, rules text, the encounter
 * builder) once the user has scrolled a screen and a half down; above the leather strap on phones.
 */
@Component({
  selector: 'app-scroll-top',
  imports: [TranslatePipe],
  template: `
    @if (shown()) {
      <button
        type="button"
        class="to-top"
        [attr.aria-label]="'browse.backToTop' | t"
        [title]="'browse.backToTop' | t"
        (click)="toTop()"
      >
        <span aria-hidden="true">↑</span>
      </button>
    }
  `,
  styles: `
    .to-top {
      position: fixed;
      z-index: 15;
      right: max(1rem, env(safe-area-inset-right));
      bottom: calc(1.25rem + env(safe-area-inset-bottom));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      min-height: 0;
      padding: 0;
      font-size: 1.4rem;
      line-height: 1;
      color: var(--on-accent);
      background: var(--accent);
      border: 2px solid var(--on-accent);
      border-radius: 50%;
      box-shadow: var(--shadow-2);
      opacity: 0.92;
    }
    .to-top:hover {
      opacity: 1;
    }
    /* phones: above the navigation strap at the bottom */
    @media (max-width: 44.99rem) {
      .to-top {
        bottom: calc(5.4rem + env(safe-area-inset-bottom));
      }
    }
    @media print {
      .to-top {
        display: none;
      }
    }
  `,
})
export class ScrollTop {
  protected readonly shown = signal(false);

  constructor() {
    inject(I18nService).extend(BROWSE_TEXTS);
    const update = () => this.shown.set(window.scrollY > window.innerHeight * SHOW_AFTER_SCREENS);
    window.addEventListener('scroll', update, { passive: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', update));
  }

  protected toTop(): void {
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    // keyboard and screen reader users land on the title (not the search box: that would open the
    // phone's keyboard)
    const title = document.querySelector<HTMLElement>('main h1');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
  }
}
