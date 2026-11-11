import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { BROWSE_TEXTS } from '../../core/i18n/browse.es';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';

/** Fewer sections than this: the page is short enough without an index. */
const MIN_SECTIONS = 3;

/**
 * "En esta página": a row of links to the second-level headings of a long page (a class: casting,
 * multiclassing, subclasses, features; a monster: traits, actions...). It reads the headings from
 * the page itself, so it follows whatever the page shows (printings, loaded subclasses...).
 */
@Component({
  selector: 'app-section-jump',
  imports: [TranslatePipe],
  template: `
    @if (sections().length >= min) {
      <nav class="jump" [attr.aria-label]="'browse.onThisPage' | t">
        <span class="label">{{ 'browse.onThisPage' | t }}:</span>
        @for (s of sections(); track s.id) {
          <a [href]="'#' + s.id" (click)="go($event, s.id)">{{ s.text }}</a>
        }
      </nav>
    }
  `,
  styles: `
    .jump {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1) 0.4rem;
      margin: var(--space-3) 0;
      font-size: var(--fs-sm);
    }
    .label {
      font-family: var(--font-note);
      color: var(--ink-soft);
    }
    a {
      display: inline-flex;
      align-items: center;
      min-height: 2.25rem;
      padding: 0 0.7rem;
      color: var(--ink);
      text-decoration: none;
      white-space: nowrap;
      background: var(--card);
      border: 1px solid var(--line-strong);
      border-radius: 1.2rem;
    }
    a:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    /* phones: one row that scrolls sideways, with finger-sized targets */
    @media (max-width: 44.99rem) {
      .jump {
        flex-wrap: nowrap;
        overflow-x: auto;
        margin-inline: -1rem;
        padding: 0 1rem var(--space-1);
        scrollbar-width: thin;
      }
      .label {
        flex: none;
      }
      a {
        flex: none;
        min-height: var(--tap);
      }
    }
  `,
})
export class SectionJump {
  /** The element whose h2 headings are the sections. */
  readonly root = input.required<HTMLElement>();
  protected readonly min = MIN_SECTIONS;
  protected readonly sections = signal<{ id: string; text: string }[]>([]);

  constructor() {
    inject(I18nService).extend(BROWSE_TEXTS);
    const destroy = inject(DestroyRef);
    let observer: MutationObserver | undefined;
    let frame = 0;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    effect(() => {
      const root = this.root();
      observer?.disconnect();
      const read = () => {
        frame = 0;
        const found = [...root.querySelectorAll<HTMLElement>('h2')]
          .map((h, i) => {
            if (!h.id) h.id = `section-${i + 1}`;
            return { id: h.id, text: (h.textContent ?? '').replace(/\s+/g, ' ').trim() };
          })
          .filter((s) => s.text);
        const now = untracked(this.sections);
        const same =
          found.length === now.length &&
          found.every((s, i) => s.id === now[i].id && s.text === now[i].text);
        if (!same) this.sections.set(found);
      };
      untracked(read);
      observer = new MutationObserver((records) => {
        // its own links changing (it lives inside the page it indexes) is not a new heading
        if (records.every((r) => host.contains(r.target))) return;
        if (!frame) frame = requestAnimationFrame(read);
      });
      observer.observe(root, { childList: true, subtree: true });
    });
    destroy.onDestroy(() => {
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    });
  }

  /** In-page anchors don't mix with hash routing: scroll by hand. */
  protected go(event: Event, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}
