import { Injectable, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';

import { CompendiumService } from '../compendium/compendium.service';
import { ENTRY_TYPES, Entry, EntryType } from '../models/compendium';
import { I18nService } from './i18n.service';

/** Fields that hold a name: shown as "Bola de fuego (Fireball)". */
const NAME_KEYS = new Set(['name', 'shortName']);

interface Translations {
  /** English name → translated name. */
  names: Map<string, string>;
  /** Any other English text → translated text. */
  texts: Map<string, string>;
  /** type → id → translated entry. */
  entries: Map<EntryType, Map<string, Entry>>;
}

/**
 * Game content in the selected language. The rules always work with the English data; what's shown
 * goes through here. data/es/*.json has the same structure as data/*.json, so walking both side by
 * side pairs every English text with its translation, wherever it ends up (a feature name on the
 * sheet, a trait in the wizard...). Texts without a translation are shown in English.
 */
@Injectable({ providedIn: 'root' })
export class DataTextService {
  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);

  private readonly loaded = signal<Translations | null>(null);
  private loading?: string;

  constructor() {
    effect(() => {
      const language = this.i18n.language();
      if (language !== 'en' && this.loading !== language) {
        this.loading = language;
        this.load(language).then(
          (t) => this.i18n.language() === language && this.loaded.set(t),
          () => (this.loading = undefined),
        );
      }
    });
  }

  /** Changes when the texts shown change (language switched, translations loaded). */
  readonly shownLanguage = computed(() => (this.active() ? this.i18n.language() : 'en'));

  private active(): Translations | null {
    return this.i18n.language() === 'en' ? null : this.loaded();
  }

  /** "Bola de fuego (Fireball)" in Spanish, "Fireball" in English. */
  name(english: string | null | undefined): string {
    if (!english) return '';
    const translated = this.active()?.names.get(english);
    return translated && translated !== english ? `${translated} (${english})` : english;
  }

  /** Only the translated name ("Bola de fuego"), for tight spots. */
  shortName(english: string | null | undefined): string {
    if (!english) return '';
    return this.active()?.names.get(english) ?? english;
  }

  text(english: string | null | undefined): string {
    if (!english) return '';
    return this.active()?.texts.get(english) ?? english;
  }

  /** The translated entry (same id and structure), or the English one. */
  entry<T extends Entry>(type: EntryType, e: T): T {
    return (this.active()?.entries.get(type)?.get(e.id) as T | undefined) ?? e;
  }

  /** The translated name and the English one, to search by either. */
  searchText(english: string): string {
    return `${english} ${this.active()?.names.get(english) ?? ''}`;
  }

  private async load(language: string): Promise<Translations> {
    const t: Translations = { names: new Map(), texts: new Map(), entries: new Map() };
    await Promise.all(
      ENTRY_TYPES.map(async (type) => {
        const [en, tr] = await Promise.all([
          this.compendium.all(type),
          this.compendium.translated(type, language).catch(() => [] as Entry[]),
        ]);
        const byId = new Map(tr.map((e) => [e.id, e]));
        t.entries.set(type, byId);
        for (const e of en) {
          const other = byId.get(e.id);
          if (other) pair(e, other, '', t);
        }
      }),
    );
    return t;
  }
}

function pair(en: unknown, tr: unknown, key: string, t: Translations): void {
  if (typeof en === 'string') {
    if (typeof tr === 'string' && tr !== en) (NAME_KEYS.has(key) ? t.names : t.texts).set(en, tr);
  } else if (Array.isArray(en)) {
    if (Array.isArray(tr)) en.forEach((v, i) => pair(v, tr[i], key, t));
  } else if (en && typeof en === 'object' && tr && typeof tr === 'object') {
    for (const [k, v] of Object.entries(en)) pair(v, (tr as Record<string, unknown>)[k], k, t);
  }
}

/** {{ feature.name | dataName }} → "Ataque extra (Extra Attack)". Impure: follows the language. */
@Pipe({ name: 'dataName', pure: false })
export class DataNamePipe implements PipeTransform {
  private readonly data = inject(DataTextService);

  transform(english: string | null | undefined, short = false): string {
    return short ? this.data.shortName(english) : this.data.name(english);
  }
}

/** {{ feature.description | dataText | markdown }}. Impure: follows the language. */
@Pipe({ name: 'dataText', pure: false })
export class DataTextPipe implements PipeTransform {
  private readonly data = inject(DataTextService);

  transform(english: string | null | undefined): string {
    return this.data.text(english);
  }
}
