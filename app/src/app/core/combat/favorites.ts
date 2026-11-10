/**
 * Favorites of the combat tab: ids of rows (core/combat/combat-actions.ts) kept in
 * character.state.combatFavorites, so they travel with the character (GitHub + IndexedDB).
 * No imports: the character model normalizes with it.
 */

/** What a character file may hold as favorites: unique non-empty strings, or nothing. */
export function normalizeFavorites(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = [...new Set(raw.filter((x): x is string => typeof x === 'string' && !!x.trim()))];
  return out.length ? out : undefined;
}

/** The list with the id added (at the end) or taken out. */
export function toggleFavorite(list: readonly string[] | undefined, id: string): string[] {
  const now = list ?? [];
  return now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
}
