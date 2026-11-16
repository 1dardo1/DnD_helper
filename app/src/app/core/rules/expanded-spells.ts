import { Subclass } from '../models/compendium';

/**
 * A subclass whose table adds spells to the class's list instead of preparing them: "the Fathomless
 * lets you choose from an expanded list of spells when you learn a warlock spell. The following
 * spells are added to the warlock spell list for you." (2014 Warlock patrons). Read from the text.
 */
export function expandsSpellList(sub: Subclass | undefined | null): boolean {
  return !!sub?.features.some((f) =>
    /choose from an expanded list of spells|added to the \w+ spell list for you/i.test(
      f.description ?? '',
    ),
  );
}

/** The spell ids such a subclass adds to the list up to this class level ([] for the others). */
export function expandedSpellIds(sub: Subclass | undefined | null, level: number): string[] {
  if (!sub || !expandsSpellList(sub)) return [];
  return (sub.spells ?? [])
    .filter((r) => r.classLevel <= level)
    .flatMap((r) => r.spells)
    .map((n) => spellSlug(n));
}

/** "Summon Elemental (Water only)" → "summon-elemental": the spell id of a name in a table. */
export function spellSlug(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
