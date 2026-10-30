import { Pipe, PipeTransform, inject } from '@angular/core';

import glossaryEs from './glossary.es.json';
import { I18nService } from './i18n.service';

/**
 * Spanish names of the game terms the app shows as labels or data (spell schools, damage types,
 * tools, languages, table columns...), kept in glossary.es.json. Proper names (classes, spells,
 * feats...) and long texts stay as extracted from the wikis. Lookups ignore case; an unknown term
 * is shown unchanged. `npm run check-glossary` lists the terms in data/ that have no translation.
 */
export type TermDomain =
  | 'school'
  | 'damage'
  | 'armor'
  | 'weapon'
  | 'property'
  | 'mastery'
  | 'itemCategory'
  | 'rarity'
  | 'magicType'
  | 'featCategory'
  | 'optionGroup'
  | 'ruleCategory'
  | 'language'
  | 'tool'
  | 'toolGroup'
  | 'size'
  | 'creatureType'
  | 'speed'
  | 'column';

const ES = glossaryEs as Record<TermDomain, Record<string, string>>;

export function term(
  language: string,
  domain: TermDomain,
  value: string | null | undefined,
): string {
  if (!value) return '';
  if (language !== 'es') return SLUG_DOMAINS.has(domain) ? humanise(value) : value;
  return ES[domain][value.trim().toLowerCase()] ?? value;
}

/** Domains whose values are ids ("fighting-style"): shown as words in English. */
const SLUG_DOMAINS = new Set<TermDomain>(['featCategory', 'optionGroup', 'ruleCategory']);

function humanise(slug: string): string {
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Units and stock words inside short data texts: durations ("Concentration, up to 1 minute"),
 * ranges ("Self (15-foot Cone)"), casting times ("Bonus Action"). Anything else stays as is.
 */
const PHRASES: [RegExp, string][] = [
  [/\bConcentration, up to\b/gi, 'Concentración, hasta'],
  [/\bUntil dispelled or triggered\b/gi, 'Hasta que se disipe o se active'],
  [/\bUntil dispelled\b/gi, 'Hasta que se disipe'],
  [/\bInstantaneous\b/gi, 'Instantáneo'],
  [/\bSpecial\b/gi, 'Especial'],
  [/\bUnlimited\b/gi, 'Ilimitado'],
  [/\bSelf\b/gi, 'Personal'],
  [/\bTouch\b/gi, 'Toque'],
  [/\bSight\b/gi, 'Visión'],
  [/\bBonus Action\b/gi, 'Acción adicional'],
  [/\b(\d+) actions?\b/gi, '$1 acción'],
  [/\bAction\b/gi, 'Acción'],
  [/\bReaction\b/gi, 'Reacción'],
  [/\bRitual\b/gi, 'Ritual'],
  [/\b(\d+)[- ]foot\b/gi, '$1 pies'],
  [/\bfeet\b/gi, 'pies'],
  [/\b1 mile\b/gi, '1 milla'],
  [/\bmiles\b/gi, 'millas'],
  [/\b1 minute\b/gi, '1 minuto'],
  [/\bminutes\b/gi, 'minutos'],
  [/\b1 hour\b/gi, '1 hora'],
  [/\bhours\b/gi, 'horas'],
  [/\b1 round\b/gi, '1 asalto'],
  [/\brounds\b/gi, 'asaltos'],
  [/\b1 day\b/gi, '1 día'],
  [/\bdays\b/gi, 'días'],
  [/\bradius\b/gi, 'de radio'],
  [/\bCone\b/gi, 'cono'],
  [/\bCube\b/gi, 'cubo'],
  [/\bCylinder\b/gi, 'cilindro'],
  [/\bEmanation\b/gi, 'emanación'],
  [/\bLine\b/gi, 'línea'],
  [/\bSphere\b/gi, 'esfera'],
  [/\bor\b/g, 'o'],
];

export function phrase(language: string, text: string | null | undefined): string {
  if (!text) return '';
  if (language !== 'es') return text;
  return PHRASES.reduce((s, [rx, to]) => s.replace(rx, to), text);
}

/** {{ value | term: 'school' }}. Impure so it follows language changes. */
@Pipe({ name: 'term', pure: false })
export class TermPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | null | undefined, domain: TermDomain): string {
    return term(this.i18n.language(), domain, value);
  }
}

/** {{ spell.duration | phrase }}. Impure so it follows language changes. */
@Pipe({ name: 'phrase', pure: false })
export class PhrasePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(text: string | null | undefined): string {
    return phrase(this.i18n.language(), text);
  }
}
