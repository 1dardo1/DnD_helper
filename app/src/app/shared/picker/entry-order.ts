import { Ability, Entry, Feat, Spell } from '../../core/models/compendium';

/**
 * The default order of the lists (compendium and wizard pickers), after the name:
 * - spells by level, and in each level first those without concentration;
 * - feats that raise an ability first (Ability Score Improvement, then by ability: STR, DEX,
 *   CON, INT, WIS, CHA; the fewer abilities to choose from, the sooner), then the rest.
 * Other types keep the name order.
 */
const ABILITY_ORDER: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

function key(e: Entry): number[] {
  if (e.type === 'spell') {
    const s = e as Spell;
    return [s.level, s.concentration ? 1 : 0];
  }
  if (e.type === 'feat') {
    const f = e as Feat;
    if (f.id === 'ability-score-improvement') return [0, -1, 0];
    const from = f.abilityIncrease?.from ?? [];
    if (!from.length) return [1, 0, 0];
    return [0, Math.min(...from.map((a) => ABILITY_ORDER.indexOf(a))), from.length];
  }
  return [];
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Sorted by the name shown, then by the order of its type (a stable sort keeps the names). */
export function defaultOrder<T>(items: readonly T[], shownName: (e: T) => string): T[] {
  const byName = [...items].sort((a, b) => shownName(a).localeCompare(shownName(b)));
  const type = (items[0] as Partial<Entry> | undefined)?.type;
  if (type !== 'spell' && type !== 'feat') return byName;
  const keys = new Map(byName.map((e) => [e, key(e as unknown as Entry)]));
  return byName.sort((a, b) => compare(keys.get(a)!, keys.get(b)!));
}
