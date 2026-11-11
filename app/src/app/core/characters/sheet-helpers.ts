/**
 * Small pure helpers of the character sheet: the quick filters of its long lists (features,
 * spells, inventory) and where each "To review" warning gets fixed.
 */
import type { Step } from '../creation/creation-rules';
import type { SheetWarning } from '../rules/sheet';
import type { SheetTab } from './sheet-tabs';

/** Lower case, without accents and extra spaces: "Conjuros  de ÁREA" → "conjuros de area". */
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every word of the query is somewhere in the texts (in any order, accents ignored). */
export function matchesQuery(query: string, ...texts: (string | null | undefined)[]): boolean {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = fold(texts.join(' '));
  return words.every((w) => hay.includes(w));
}

/**
 * The groups with only the items that match the query (by what `text` says of each); groups left
 * empty go away. An empty query keeps everything as it was (the same array).
 */
export function filterGroups<G extends { features: F[] }, F>(
  groups: G[],
  query: string,
  text: (f: F) => string[],
): G[] {
  if (!fold(query)) return groups;
  return groups
    .map((g) => ({ ...g, features: g.features.filter((f) => matchesQuery(query, ...text(f))) }))
    .filter((g) => g.features.length > 0);
}

/** Where a warning is fixed: a step of the edit wizard, a tab of the sheet, or nowhere. */
export type WarningFix = { step: Step } | { tab: SheetTab } | null;

export function warningFix(w: SheetWarning): WarningFix {
  switch (w.key) {
    case 'sheet.warn.traitChoiceMissing':
    case 'sheet.warn.traitPickMissing':
    case 'sheet.warn.speciesAbilityMissing':
      return { step: 'species' };
    case 'sheet.warn.noSubclass':
      return { step: 'class' };
    case 'sheet.warn.customBackgroundMissing':
      return { step: 'background' };
    case 'sheet.warn.armorBase':
      return { tab: 'equipo' };
    case 'sheet.warn.weaponMastery':
      return { tab: 'resumen' };
    case 'sheet.warn.notFound': {
      const what = w.params?.['what'];
      if (what === 'species') return { step: 'species' };
      if (what === 'background') return { step: 'background' };
      if (what === 'class' || what === 'subclass') return { step: 'class' };
      if (what === 'feat') return { step: 'choices' };
      if (what === 'item') return { tab: 'equipo' };
      return null;
    }
    default:
      return null;
  }
}
