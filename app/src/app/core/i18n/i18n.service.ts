import { Injectable, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';

import { Language, SettingsService } from '../settings/settings.service';
import type { en } from './en';
import { es } from './es';

export type TranslationKey = keyof typeof en;

type Dictionary = Readonly<Record<string, string>>;

/**
 * Spanish, the language the app is used in, travels with the first load. English (~90 kB) is a
 * chunk of its own, downloaded only when chosen; the app waits for it before its first render
 * (provideAppInitializer in app.config.ts). Measured: making Spanish lazy too delayed the first
 * render ~350 ms on a slow mobile network (one more request after the app's code), so it isn't.
 */
const LOADERS: Record<Language, () => Promise<Dictionary>> = {
  en: () => import('./en').then((m) => m.en),
  es: () => Promise.resolve(es),
};

/** Dictionaries already in memory, shared by every I18nService (tests register both up front). */
const loaded = signal<Partial<Record<Language, Dictionary>>>({ es });
const loading = new Map<Language, Promise<void>>();

/** Makes a dictionary available straight away (test setup: src/test-setup.ts). */
export function registerDictionary(language: Language, dict: Dictionary): void {
  loaded.update((l) => ({ ...l, [language]: dict }));
}

/** Loads a language's texts (once); resolves when they are in memory. */
export function loadDictionary(language: Language): Promise<void> {
  if (loaded()[language]) return Promise.resolve();
  let p = loading.get(language);
  if (!p) {
    p = LOADERS[language]()
      .then((dict) => registerDictionary(language, dict))
      .catch((e) => {
        loading.delete(language);
        throw e;
      });
    loading.set(language, p);
  }
  return p;
}

/** Texts of a part of the app that has its own chunk (the Combat tab), in both languages. */
export interface ExtraTexts {
  en: Readonly<Record<string, string>>;
  es: Readonly<Record<string, string>>;
}

/** Translates UI texts (game content stays in English, as extracted from the wikis). */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);
  private readonly extra = signal<readonly ExtraTexts[]>([]);
  private readonly dict = computed<Dictionary>(() => {
    const lang = this.settings.language();
    const dicts = loaded();
    // while a newly chosen language arrives, the other one stays on screen (not bare keys)
    const base = dicts[lang] ?? dicts[lang === 'es' ? 'en' : 'es'] ?? {};
    const extra = this.extra();
    return extra.length ? Object.assign({}, base, ...extra.map((x) => x[lang])) : base;
  });

  readonly language = this.settings.language;

  constructor() {
    effect(() => void loadDictionary(this.language()).catch(() => undefined));
  }

  /** Resolves when the texts of the current language are loaded (before the first render). */
  ready(): Promise<void> {
    return loadDictionary(this.language());
  }

  /** t('compendium.entries', { count: 3 }) → "3 entradas". */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = this.dict()[key] ?? key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  }

  /**
   * Adds the texts of a lazily loaded part (its own chunk), so they don't weigh on the first load
   * of the app. Once per set of texts.
   */
  extend(texts: ExtraTexts): void {
    if (!this.extra().includes(texts)) this.extra.update((l) => [...l, texts]);
  }

  /** Date and time in the selected language ("29 oct 2026, 18:29"). */
  date(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat(this.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  }
}

/** {{ iso | localDate }}. Impure so it follows language changes. */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(iso: string | null | undefined): string {
    return this.i18n.date(iso);
  }
}

/** {{ 'nav.compendium' | t }}. Impure so it follows language changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  /** Accepts built keys too ('type.' + type); unknown keys come back as-is. */
  transform(key: TranslationKey | string, params?: Record<string, string | number>): string {
    return this.i18n.t(key as TranslationKey, params);
  }
}
