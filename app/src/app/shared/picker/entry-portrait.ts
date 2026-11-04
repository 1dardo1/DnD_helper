import {
  Component,
  Injectable,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { PICTURE_BASES, PictureKind } from '../../core/media/pictures';

/**
 * Which entries have a picture, per kind: <base>/index.json, the list of ids of the <base>/<id>.webp
 * files (see core/media/pictures.ts for where each kind's folder is). Each index is loaded once, the
 * first time a picture of that kind is wanted; knowing beforehand means no request (and no 404 in
 * the console) for the pictures that don't exist, and no empty box while one fails to load.
 * Offline (and not cached), or if the index can't be read: no pictures of that kind.
 */
@Injectable({ providedIn: 'root' })
export class EntryPictures {
  private readonly bases = inject(PICTURE_BASES);
  private readonly ids: Record<PictureKind, WritableSignal<ReadonlySet<string>>> = {
    species: signal(new Set()),
    monster: signal(new Set()),
  };
  private readonly loading = new Map<PictureKind, Promise<void>>();

  /** The picture's URL for an entry, or null if it has none. */
  src(kind: PictureKind, id: string): string | null {
    this.load(kind);
    return this.ids[kind]().has(id) ? `${this.bases[kind]}${id}.webp` : null;
  }

  /** Loads (once) the list of a kind's pictures; resolves when it's known (or failed). */
  load(kind: PictureKind): Promise<void> {
    let p = this.loading.get(kind);
    if (!p) {
      p = (async () => {
        try {
          const res = await fetch(`${this.bases[kind]}index.json`);
          if (!res.ok) return;
          const list: unknown = await res.json();
          if (Array.isArray(list)) {
            this.ids[kind].set(new Set(list.filter((x) => typeof x === 'string')));
          }
        } catch {
          // offline and not cached yet: no pictures
        }
      })();
      this.loading.set(kind, p);
    }
    return p;
  }
}

/**
 * The picture of a species or a monster, if there is one; nothing otherwise, or if it can't load
 * (offline, say). Inline content, so it can sit inside a card's <button> or link.
 */
@Component({
  selector: 'app-entry-portrait',
  host: { '[class.empty]': '!src()', '[class.monster]': "kind() === 'monster'" },
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

    /* a creature fills more of its picture than a standing person: crop around the middle */
    :host(.monster) img {
      object-position: 50% 40%;
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
export class EntryPortrait {
  /** What it is a picture of: a species (species/<id>.webp) or a monster (monsters/<id>.webp). */
  readonly kind = input.required<PictureKind>();
  readonly entryId = input.required<string>();
  readonly alt = input('');
  /** The URL that failed to load (listed but missing, or broken, or offline): hidden. */
  protected readonly failed = signal<string | null>(null);
  private readonly pictures = inject(EntryPictures);
  protected readonly src = computed(() => {
    const src = this.pictures.src(this.kind(), this.entryId());
    return src === this.failed() ? null : src;
  });
}
