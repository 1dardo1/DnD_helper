import { Component, input, signal } from '@angular/core';

/**
 * A species picture from the Fandom wikis (data: species[].image). Loaded without a Referer: the
 * wikis refuse images requested from other sites. If it can't load (offline, removed), nothing
 * is shown. Inline content, so it can sit inside a card's <button>.
 */
@Component({
  selector: 'app-species-portrait',
  template: `
    @if (src() && !failed()) {
      <img
        [src]="src()"
        [alt]="alt()"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 50% 15%;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm, 4px);
      background: color-mix(in srgb, var(--ink) 6%, transparent);
    }

    :host(.thumb) {
      width: 100%;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      margin-bottom: var(--space-1);
    }

    :host(.thumb) img {
      height: 100%;
    }

    :host(.full) {
      max-width: 22rem;
      margin: 0 0 var(--space-3);
    }

    :host(.full) img {
      height: auto;
      max-height: 26rem;
      object-fit: contain;
    }
  `,
})
export class SpeciesPortrait {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  protected readonly failed = signal(false);
}
