import { term } from '../../core/i18n/glossary';
import { Entry, EntryByType } from '../../core/models/compendium';

/**
 * One-line summary shown next to an entry in lists ("3 · Evocación", "wizard", "raro"...).
 * cantrip: the word for level 0 in the current language.
 */
export function entrySummary(
  e: Entry,
  lang: string,
  cantrip: string,
  classNames: Map<string, string>,
): string {
  switch (e.type) {
    case 'spell': {
      const s = e as EntryByType['spell'];
      return `${s.level === 0 ? cantrip : s.level} · ${term(lang, 'school', s.school)}`;
    }
    case 'subclass': {
      const id = (e as EntryByType['subclass']).classId;
      return classNames.get(id) ?? id;
    }
    case 'option':
      return term(lang, 'optionGroup', (e as EntryByType['option']).group);
    case 'feat':
      return term(lang, 'featCategory', (e as EntryByType['feat']).category);
    case 'item': {
      const i = e as EntryByType['item'];
      return i.magic?.rarity
        ? term(lang, 'rarity', i.magic.rarity)
        : term(lang, 'itemCategory', i.category);
    }
    case 'rule':
      return term(lang, 'ruleCategory', (e as EntryByType['rule']).category);
    default:
      return '';
  }
}
