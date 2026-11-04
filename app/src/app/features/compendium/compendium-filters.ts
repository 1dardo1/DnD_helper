import { Entry, EntryByType, EntryType } from '../../core/models/compendium';

/** Filters a list can have; each one is also a query parameter (?level=3&school=evocation). */
export type FilterKey =
  'level' | 'school' | 'class' | 'category' | 'rarity' | 'magic' | 'group' | 'edition';

export const FILTERS: Record<EntryType, FilterKey[]> = {
  class: ['edition'],
  subclass: ['class', 'edition'],
  option: ['group', 'class', 'edition'],
  spell: ['level', 'school', 'class', 'edition'],
  feat: ['category', 'edition'],
  species: ['edition'],
  background: ['edition'],
  item: ['category', 'rarity', 'magic', 'edition'],
  monster: ['category'],
  rule: ['category'],
};

export type FilterSelection = Partial<Record<FilterKey, string>>;

/** From least to most rare; the order rarities are offered in. */
export const RARITY_ORDER = [
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
  'varies',
  'unique',
  'unknown rarity',
];

/** The values an entry has for a filter (a spell can be in several classes). */
export function filterValues(e: Entry, key: FilterKey): string[] {
  const any = e as Partial<EntryByType[EntryType]> & Record<string, unknown>;
  switch (key) {
    case 'level':
      return e.type === 'spell' ? [String((e as EntryByType['spell']).level)] : [];
    case 'school':
      return e.type === 'spell' ? [(e as EntryByType['spell']).school] : [];
    case 'class':
      if (e.type === 'spell') return (e as EntryByType['spell']).classes;
      return typeof any['classId'] === 'string' ? [any['classId']] : [];
    case 'category':
      return typeof any['category'] === 'string' ? [any['category']] : [];
    case 'rarity': {
      const rarity = (e as EntryByType['item']).magic?.rarity;
      return rarity ? [rarity] : [];
    }
    case 'magic':
      return e.type === 'item' ? [(e as EntryByType['item']).magic ? 'magic' : 'mundane'] : [];
    case 'group':
      return e.type === 'option' ? [(e as EntryByType['option']).group] : [];
    case 'edition':
      return [e.custom ? 'custom' : e.edition];
  }
}

/** Distinct values found for a filter, in a stable order (levels and rarities in game order). */
export function filterChoices(entries: Entry[], key: FilterKey): string[] {
  const values = [...new Set(entries.flatMap((e) => filterValues(e, key)))];
  if (key === 'level') return values.sort((a, b) => Number(a) - Number(b));
  if (key === 'rarity') {
    const pos = (v: string) => {
      const i = RARITY_ORDER.indexOf(v.toLowerCase());
      return i < 0 ? RARITY_ORDER.length : i;
    };
    return values.sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
  }
  return values.sort();
}

/** Entries matching every selected filter (empty values don't filter). */
export function applyFilters<T extends Entry>(entries: T[], selected: FilterSelection): T[] {
  const active = (Object.entries(selected) as [FilterKey, string | undefined][]).filter(
    ([, v]) => !!v,
  );
  if (!active.length) return entries;
  return entries.filter((e) => active.every(([k, v]) => filterValues(e, k).includes(v!)));
}
