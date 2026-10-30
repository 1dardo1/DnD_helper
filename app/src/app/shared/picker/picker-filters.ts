import { normalise } from '../../features/compendium/compendium-search';

/**
 * Generic filtering for the card pickers and the compendium lists: a text search (by every name
 * an item goes by) plus facets (each item has zero or more values per facet; a selected value
 * keeps the items that have it). Pure functions, so they can be tested without Angular.
 */

/** Selected value per facet key; an empty value doesn't filter. */
export type FacetSelection = Record<string, string>;

/** How many facets have a value selected. */
export function activeFacets(selection: FacetSelection): number {
  return Object.values(selection).filter(Boolean).length;
}

/** True when every word of the query appears in the (already normalised) search text. */
export function matchesQuery(searchText: string, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return q.split(' ').every((word) => searchText.includes(word));
}

/** The values selected in a facet: several are joined with commas ("fire,healing"). */
export function selectedValues(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

/** Adds or removes one value of a multiple-choice facet. */
export function toggleValue(value: string | undefined, toggled: string): string {
  const now = selectedValues(value);
  const next = now.includes(toggled) ? now.filter((v) => v !== toggled) : [...now, toggled];
  return next.join(',');
}

/**
 * The items (by index) matching the query and every selected facet; in the `multi` facets, any
 * of the values selected ("fire,healing").
 * `texts[i]` is the normalised search text of items[i]; `values(i, key)` its values for a facet.
 */
export function applyFacets<T>(
  items: readonly T[],
  texts: readonly string[],
  values: (index: number, key: string) => string[],
  selection: FacetSelection,
  query: string,
  multi: ReadonlySet<string> = new Set(),
): T[] {
  const active = Object.entries(selection)
    .map(([k, v]) => [k, multi.has(k) ? selectedValues(v) : v ? [v] : []] as const)
    .filter(([, v]) => v.length);
  const q = normalise(query);
  return items.filter(
    (_, i) =>
      (!q || matchesQuery(texts[i], q)) &&
      active.every(([k, wanted]) => values(i, k).some((v) => wanted.includes(v))),
  );
}
