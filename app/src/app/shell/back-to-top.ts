import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

import { TranslatePipe } from '../core/i18n/i18n.service';

/** Shown once the page has scrolled this many screens down. */
export const SHOW_AFTER_SCREENS = 1.5;

/** True when the "back to top" button is worth showing at this scroll position. */
export function farFromTop(scrollY: number, viewportHeight: number): boolean {
  return scrollY > viewportHeight * SHOW_AFTER_SCREENS;
}

/**
 * A round wax seal with an arrow, bottom right (above the phone's navigation strap), that takes a
 * long page (spell list, character sheet, compendium entry) back to the top with one tap.
 */
@Component({
  selector: 'app-back-to-top',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button
        type="button"
        class="to-top"
        (click)="toTop()"
        [attr.aria-label]="'shell.toTop' | t"
        [title]="'shell.toTop' | t"
      ></button>
    }
  `,
  styles: `
    .to-top {
      position: fixed;
      z-index: 15;
      right: max(0.9rem, env(safe-area-inset-right));
      bottom: calc(1.1rem + env(safe-area-inset-bottom));
      width: 3rem;
      height: 3rem;
      min-height: 0;
      padding: 0;
      border-radius: 50%;
      color: #fff4dc;
      background: radial-gradient(circle at 35% 30%, #c0392b, var(--wax) 60%, #5e0f0f);
      border: 1px solid rgb(0 0 0 / 0.35);
      box-shadow:
        0 3px 8px rgb(0 0 0 / 0.45),
        inset 0 0 0 3px rgb(255 255 255 / 0.12);
      opacity: 0.92;

      &::before {
        content: '';
        width: 1.4rem;
        height: 1.4rem;
        background: currentColor;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 19V5M5 12l7-7 7 7'/%3E%3C/svg%3E")
          center / contain no-repeat;
      }

      &:hover {
        opacity: 1;
      }
    }

    // phone: above the navigation strap at the bottom (app.scss)
    @media (max-width: 44.99rem) {
      .to-top {
        bottom: calc(5.4rem + env(safe-area-inset-bottom));
      }
    }
  `,
})
export class BackToTop {
  protected readonly visible = signal(false);

  constructor() {
    let frame = 0;
    const check = () => {
      frame = 0;
      this.visible.set(farFromTop(window.scrollY, window.innerHeight));
    };
    const onScroll = () => (frame ||= requestAnimationFrame(check));
    window.addEventListener('scroll', onScroll, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    });
  }

  protected toTop(): void {
    const reduce =
      document.documentElement.getAttribute('data-motion') === 'reduce' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
}
