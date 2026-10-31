import { normalise } from '../../features/compendium/compendium-search';

/**
 * Generic filtering for the card pickers and the compendium lists: a text search (by every name
 * an item goes by) plus facets (each item has zero or more values per facet; a selected value
 * keeps the items that have it). Pure functions, so they can be tested without Angular.
 */

/** Selected value per facet key; an empty value doesn't filter. */
export type FacetSelection = Record<string, string>;

/**
 * How the values included in one facet combine: any of them (default) or all at once ("and").
 * Stored next to the facet as "<key>Mode", so it travels in the URL like the values. Values can
 * also be excluded one by one ("!fire"), which combines with either mode.
 */
export function modeKey(key: string): string {
  return `${key}Mode`;
}

function isModeKey(key: string): boolean {
  return key.endsWith('Mode');
}

/** How many facets have a value selected. */
export function activeFacets(selection: FacetSelection): number {
  return Object.entries(selection).filter(([k, v]) => v && !isModeKey(k)).length;
}

/** True when every word of the query appears in the (already normalised) search text. */
export function matchesQuery(searchText: string, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return q.split(' ').every((word) => searchText.includes(word));
}

/** The values selected in a facet, joined with commas; excluded ones start with "!" ("fire,!cold"). */
export function selectedValues(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

const NOT = '!';

/** Includes or un-includes one value (an excluded one becomes included). */
export function toggleValue(value: string | undefined, toggled: string): string {
  const now = selectedValues(value).filter((v) => v !== NOT + toggled);
  const next = now.includes(toggled) ? now.filter((v) => v !== toggled) : [...now, toggled];
  return next.join(',');
}

/** Excludes or un-excludes one value (an included one becomes excluded). */
export function toggleExcluded(value: string | undefined, toggled: string): string {
  const now = selectedValues(value).filter((v) => v !== toggled);
  const off = NOT + toggled;
  const next = now.includes(off) ? now.filter((v) => v !== off) : [...now, off];
  return next.join(',');
}

export function isExcluded(value: string | undefined, v: string): boolean {
  return selectedValues(value).includes(NOT + v);
}

/**
 * The items matching the query and every facet with values chosen: any of the included values
 * ("fire" or "cold"), or all of them when the facet's mode is "and" (fire and cold at once); and
 * in either case none of the excluded ones ("!healing").
 * `texts[i]` is the normalised search text of items[i]; `values(i, key)` its values for a facet.
 */
export function applyFacets<T>(
  items: readonly T[],
  texts: readonly string[],
  values: (index: number, key: string) => string[],
  selection: FacetSelection,
  query: string,
): T[] {
  const active = Object.entries(selection)
    .filter(([k, v]) => v && !isModeKey(k))
    .map(([k, v]) => {
      const all = selectedValues(v);
      return {
        key: k,
        wanted: all.filter((x) => !x.startsWith(NOT)),
        unwanted: all.filter((x) => x.startsWith(NOT)).map((x) => x.slice(1)),
        and: selection[modeKey(k)] === 'and',
      };
    });
  const q = normalise(query);
  return items.filter(
    (_, i) =>
      (!q || matchesQuery(texts[i], q)) &&
      active.every(({ key, wanted, unwanted, and }) => {
        const has = values(i, key);
        if (unwanted.some((u) => has.includes(u))) return false;
        if (!wanted.length) return true;
        return and ? wanted.every((w) => has.includes(w)) : wanted.some((w) => has.includes(w));
      }),
  );
}
