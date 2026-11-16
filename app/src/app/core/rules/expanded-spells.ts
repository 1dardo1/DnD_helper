import { DndClass, Subclass } from '../models/compendium';

/**
 * A subclass whose table adds spells to the class's list instead of preparing them: "the Fathomless
 * lets you choose from an expanded list of spells when you learn a warlock spell. The following
 * spells are added to the warlock spell list for you." (2014 Warlock patrons). Read from the text.
 */
export function expandsSpellList(sub: Subclass | undefined | null): boolean {
  return !!sub?.features.some((f) =>
    /choose from an expanded list of spells|added to the \w+ spell list for you|from the following list of spells, in addition to the \w+ spell list/i.test(
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

/**
 * Other classes' lists a class may prepare from at this level (Magical Secrets: "you can choose any
 * of your new prepared spells from the Bard, Cleric, Druid, and Wizard spell lists"). Read from the
 * text of its features gained so far; [] for the others.
 */
export function extraSpellLists(cls: DndClass, level: number, sub?: Subclass | null): string[] {
  for (const f of [...(cls.features ?? []), ...(sub?.features ?? [])]) {
    if ((f.level ?? 0) > level) continue;
    // Divine Magic (Divine Soul): "you can choose the new spell from the cleric spell list or the
    // sorcerer spell list"
    const m =
      /choose any of your new prepared spells from the ([A-Za-z, ]+?) spell lists/i.exec(
        f.description ?? '',
      ) ?? /you can choose the new spell from the (\w+) spell list\b/i.exec(f.description ?? '');
    if (m)
      return m[1]
        .split(/,\s*(?:and\s+)?|\s+and\s+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w && w !== cls.id);
  }
  return [];
}
