import { Entry, EntryByType } from '../../core/models/compendium';

/** One-line summary shown next to an entry in lists ("3 · evocation", "Wizard", "rare"...). */
export function entrySummary(e: Entry): string {
  switch (e.type) {
    case 'spell': {
      const s = e as EntryByType['spell'];
      return `${s.level === 0 ? 'cantrip' : s.level} · ${s.school}`;
    }
    case 'subclass':
      return (e as EntryByType['subclass']).classId;
    case 'option':
      return (e as EntryByType['option']).group;
    case 'feat':
      return (e as EntryByType['feat']).category;
    case 'item': {
      const i = e as EntryByType['item'];
      return i.magic?.rarity ?? i.category;
    }
    case 'rule':
      return (e as EntryByType['rule']).category;
    default:
      return '';
  }
}
