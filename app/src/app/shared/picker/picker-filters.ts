import { normalise } from '../../features/compendium/compendium-search';

/**
 * Generic filtering for the card pickers and the compendium lists: a text search (by every name
 * an item goes by) plus facets (each item has zero or more values per facet; a selected value
 * keeps the items that have it). Pure functions, so they can be tested without Angular.
 */

/** Selected value per facet key; an empty value doesn't filter. */
export type FacetSelection = Record<string, string>;

/**
 * How the values ticked in one facet are used: any of them (default), all at once ("and"), or
 * none of them ("not": everything except those). Stored next to the facet as "<key>Mode", so it
 * travels in the URL like the values.
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
 * The items matching the query and every facet with values chosen: any of the values ("fire" or
 * "healing"), all of them when the facet's mode is "and" (fire and healing at once), or none of
 * them when it is "not" (everything but fire and healing).
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
    .map(([k, v]) => ({ key: k, wanted: selectedValues(v), mode: selection[modeKey(k)] ?? '' }));
  const q = normalise(query);
  return items.filter(
    (_, i) =>
      (!q || matchesQuery(texts[i], q)) &&
      active.every(({ key, wanted, mode }) => {
        const has = values(i, key);
        if (mode === 'and') return wanted.every((w) => has.includes(w));
        const any = wanted.some((w) => has.includes(w));
        return mode === 'not' ? !any : any;
      }),
  );
}
