import { EntryType } from '../../core/models/compendium';
import { FacetKey } from '../../shared/picker/entry-facets';
import { FacetView } from '../../shared/picker/filter-bar';
import { selectedValues } from '../../shared/picker/picker-filters';

/**
 * The facet each compendium list offers as a strip of chips above its cards, so the most used
 * filter is one tap away with the thumb (spells by level, monsters by challenge rating...). The
 * same facet is still in "Filtros" for combining or excluding values.
 */
export const QUICK_FACET: Partial<Record<EntryType, FacetKey>> = {
  spell: 'level',
  monster: 'cr',
  item: 'rarity',
  species: 'size',
  option: 'class',
  rule: 'category',
  class: 'caster',
};

/** At most this many values: a facet with more is better served by the folded filter. */
const MAX_CHIPS = 40;

export interface QuickChip {
  value: string;
  label: string;
  /** This value alone is what the facet has selected. */
  on: boolean;
}

export interface QuickStrip {
  key: string;
  label: string;
  /** Nothing selected in the facet: the "All" chip is pressed. */
  all: boolean;
  chips: QuickChip[];
}

/** The strip for a type's quick facet, or null (no quick facet, or too few/many values to help). */
export function quickStrip(type: EntryType, facets: readonly FacetView[]): QuickStrip | null {
  const key = QUICK_FACET[type];
  const facet = key && facets.find((f) => f.key === key);
  if (!facet || facet.options.length < 2 || facet.options.length > MAX_CHIPS) return null;
  const selected = selectedValues(facet.selected);
  return {
    key: facet.key,
    label: facet.label,
    all: selected.length === 0,
    chips: facet.options.map((o) => ({
      value: o.value,
      label: o.label,
      on: selected.length === 1 && selected[0] === o.value,
    })),
  };
}

/** The facet's new value after tapping a chip: that value alone, or nothing when it already was. */
export function quickToggle(selected: string, value: string): string {
  const now = selectedValues(selected);
  return now.length === 1 && now[0] === value ? '' : value;
}
