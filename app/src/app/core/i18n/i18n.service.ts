import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';

import { SettingsService } from '../settings/settings.service';
import { en } from './en';
import { es } from './es';

export type TranslationKey = keyof typeof en;

const DICTIONARIES = { en, es } as const;

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
  private readonly dict = computed<Readonly<Record<string, string>>>(() => {
    const lang = this.settings.language();
    const extra = this.extra();
    return extra.length
      ? Object.assign({}, DICTIONARIES[lang], ...extra.map((x) => x[lang]))
      : DICTIONARIES[lang];
  });

  readonly language = this.settings.language;

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
