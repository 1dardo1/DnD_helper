import { Component, Injectable, computed, inject, input, signal } from '@angular/core';

/** Where the species pictures live, relative to the app's base href (see public/species/README.md). */
const FOLDER = 'species';

/**
 * Which species have a picture shipped with the app: species/index.json, the list of ids of the
 * species/<id>.webp files (scripts/sync-dev-data.mjs rewrites it from the folder). Loaded once;
 * knowing beforehand means no request (and no 404 in the console) for the pictures that don't
 * exist, and no empty box while one fails to load.
 */
@Injectable({ providedIn: 'root' })
export class SpeciesPictures {
  private readonly ids = signal<ReadonlySet<string>>(new Set());
  private loading: Promise<void> | null = null;

  /** The picture's URL for a species id, or null if it has none. */
  src(id: string): string | null {
    this.load();
    return this.ids().has(id) ? `${FOLDER}/${id}.webp` : null;
  }

  private load(): void {
    this.loading ??= (async () => {
      try {
        const res = await fetch(`${FOLDER}/index.json`);
        if (!res.ok) return;
        const list: unknown = await res.json();
        if (Array.isArray(list)) this.ids.set(new Set(list.filter((x) => typeof x === 'string')));
      } catch {
        // offline and not cached yet: no pictures
      }
    })();
  }
}

/**
 * The picture of a species (public/species/<id>.webp), if the app ships one; nothing otherwise, or
 * if it can't load. Inline content, so it can sit inside a card's <button>.
 */
@Component({
  selector: 'app-species-portrait',
  host: { '[class.empty]': '!src()' },
  template: `
    @if (src(); as s) {
      <img [src]="s" [alt]="alt()" loading="lazy" decoding="async" (error)="failed.set(s)" />
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host(.empty) {
      display: none;
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
  /** The species id: the picture is species/<id>.webp. */
  readonly speciesId = input.required<string>();
  readonly alt = input('');
  /** The URL that failed to load (listed but missing, or broken): hidden. */
  protected readonly failed = signal<string | null>(null);
  private readonly pictures = inject(SpeciesPictures);
  protected readonly src = computed(() => {
    const src = this.pictures.src(this.speciesId());
    return src === this.failed() ? null : src;
  });
}
