import { Entry, Feat } from '../../core/models/compendium';

/** Stands for "any species that can be this size" among the required species ("size:Small"). */
export const SIZE_PREFIX = 'size:';

/**
 * The species a racial feat requires (their ids), plus "size:Small" when any species of that size
 * may take it ("Dwarf or a Small race"); none for any other entry.
 */
export function requiredSpecies(e: Partial<Entry> | null | undefined): string[] {
  if (!e || e.type !== 'feat') return [];
  const f = e as Partial<Feat>;
  if (f.category !== 'racial') return [];
  const pre = f.prerequisites;
  return [...(pre?.species ?? []), ...(pre?.size ?? []).map((z) => SIZE_PREFIX + z)];
}

/** The required species' names, alphabetically ("Elfo", "Semielfo"). */
export function speciesNames(e: Partial<Entry>, speciesName: (id: string) => string): string[] {
  return requiredSpecies(e)
    .map(speciesName)
    .sort((a, b) => a.localeCompare(b));
}

/** A part of a list: the entries that need no species (`species: null`), or those of one species. */
export interface SpeciesSection<T> {
  species: string | null;
  label: string;
  items: T[];
}

/**
 * A list split by the species its racial feats require, or null when it has no racial feat.
 * Entries that need no species come first, in their order; then one section per species, by its
 * name, with its feats by name. A feat several species can take is in each of their sections.
 */
export function sectionsBySpecies<T>(
  items: readonly T[],
  speciesName: (id: string) => string,
  shownName: (e: T) => string,
): SpeciesSection<T>[] | null {
  const rest: T[] = [];
  const bySpecies = new Map<string, T[]>();
  for (const e of items) {
    const species = requiredSpecies(e as Partial<Entry>);
    if (!species.length) rest.push(e);
    for (const s of species) bySpecies.set(s, [...(bySpecies.get(s) ?? []), e]);
  }
  if (!bySpecies.size) return null;
  const sections = [...bySpecies]
    .map(([species, list]) => ({
      species,
      label: speciesName(species),
      items: list.sort((a, b) => shownName(a).localeCompare(shownName(b))),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return rest.length ? [{ species: null, label: '', items: rest }, ...sections] : sections;
}
