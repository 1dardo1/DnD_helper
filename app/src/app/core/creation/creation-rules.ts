import { Character } from '../models/character';
import {
  Ability,
  Background,
  ClassOption,
  DndClass,
  Feat,
  Spell,
  Subclass,
} from '../models/compendium';
import { ABILITIES } from '../rules/tables';

/**
 * Rules of character creation (2024 Player's Handbook), as pure functions the wizard uses
 * to offer choices and to tell what's still missing. They never block: an incomplete
 * character can be saved and finished later.
 */

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function pointBuyCost(scores: Record<Ability, number>): number {
  return ABILITIES.reduce((n, a) => n + (POINT_COST[scores[a]] ?? Infinity), 0);
}

/** Background increases: +2 and +1 to two of its three abilities, or +1 to all three. */
export function backgroundIncreasesValid(
  bg: Background,
  inc: Partial<Record<Ability, number>>,
): boolean {
  const entries = Object.entries(inc).filter(([, v]) => v) as [Ability, number][];
  if (entries.some(([a]) => !bg.abilityScores.includes(a))) return false;
  const values = entries.map(([, v]) => v).sort();
  return values.join() === '1,2' || values.join() === '1,1,1';
}

export type SlotKind = 'asi' | 'fighting-style' | 'epic-boon';

export interface FeatSlot {
  slot: string;
  classId: string;
  level: number;
  kind: SlotKind;
}

/** Levels at which the class grants a feat choice, read from its progression table. */
export function featSlots(cls: DndClass, level: number): FeatSlot[] {
  const out: FeatSlot[] = [];
  for (const row of cls.progression.rows.slice(0, level)) {
    for (const f of row.features) {
      const kind: SlotKind | null = /ability score improvement/i.test(f)
        ? 'asi'
        : /^(additional )?fighting style/i.test(f)
          ? 'fighting-style'
          : /epic boon/i.test(f)
            ? 'epic-boon'
            : null;
      if (kind)
        out.push({ slot: `${cls.id}:${row.level}`, classId: cls.id, level: row.level, kind });
    }
  }
  return out;
}

/** Feats that can fill a slot. ASI levels: the Ability Score Improvement feat or a general feat. */
export function featsForSlot(kind: SlotKind, feats: Feat[], level: number): Feat[] {
  const wanted = kind === 'asi' ? ['general'] : [kind];
  return feats
    .filter((f) => wanted.includes(f.category))
    .filter((f) => (f.prerequisites?.level ?? 0) <= level)
    .sort((a, b) =>
      a.id === 'ability-score-improvement'
        ? -1
        : b.id === 'ability-score-improvement'
          ? 1
          : a.name.localeCompare(b.name),
    );
}

/** How many Expertise picks the class gives up to a level (each Expertise feature = 2 skills). */
export function expertiseCount(cls: DndClass, level: number): number {
  return cls.progression.rows
    .slice(0, level)
    .reduce((n, r) => n + r.features.filter((f) => /^expertise$/i.test(f)).length * 2, 0);
}

export function subclassesFor(classId: string, subclasses: Subclass[]): Subclass[] {
  return subclasses
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Highest spell level the class can cast at a level (0 = cantrips only / no spellcasting). */
export function maxSpellLevel(cls: DndClass, level: number): number {
  const row = cls.spellcasting?.slotsByLevel[level - 1] ?? [];
  let max = 0;
  row.forEach((n, i) => n > 0 && (max = i + 1));
  return max;
}

export function spellsFor(
  cls: DndClass,
  level: number,
  spells: Spell[],
): { cantrips: Spell[]; leveled: Spell[] } {
  const max = maxSpellLevel(cls, level);
  const mine = spells
    .filter((s) => s.classes.includes(cls.id))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return {
    cantrips: mine.filter((s) => s.level === 0),
    leveled: mine.filter((s) => s.level >= 1 && s.level <= max),
  };
}

/** Progression column that says how many options of a group the class knows. */
const OPTION_COUNT_COLUMN: Record<string, RegExp> = {
  'eldritch-invocation': /invocation/i,
  'blood-curse': /blood curse/i,
  'artificer-infusion': /infusion/i,
  'psionic-discipline': /discipline/i,
};

export interface OptionGroup {
  group: string;
  options: ClassOption[];
  /** From the class table when it has a column for it, else null (no limit shown). */
  count: number | null;
}

/** Option lists (invocations, blood curses, maneuvers...) available to the class and subclass. */
export function optionGroupsFor(
  cls: DndClass,
  level: number,
  subclassId: string | null,
  options: ClassOption[],
): OptionGroup[] {
  const mine = options.filter(
    (o) => o.classId === cls.id && (!o.subclassId || o.subclassId === subclassId),
  );
  const groups = new Map<string, ClassOption[]>();
  for (const o of mine) {
    if ((o.prerequisites?.level ?? 0) > level) continue;
    groups.set(o.group, [...(groups.get(o.group) ?? []), o]);
  }
  return [...groups.entries()].map(([group, opts]) => {
    const col = cls.progression.columns.find((c) => OPTION_COUNT_COLUMN[group]?.test(c));
    const value = col ? parseInt(cls.progression.rows[level - 1]?.values[col] ?? '', 10) : NaN;
    return {
      group,
      options: opts.sort((a, b) => a.name.localeCompare(b.name)),
      count: Number.isNaN(value) ? null : value,
    };
  });
}

export type Step =
  'class' | 'background' | 'species' | 'abilities' | 'choices' | 'equipment' | 'details';
export const STEPS: Step[] = [
  'class',
  'background',
  'species',
  'abilities',
  'choices',
  'equipment',
  'details',
];

/** What's still missing in each step, as translation keys (+ params) for the wizard to show. */
export function missing(
  ch: Character,
  ctx: { cls?: DndClass; background?: Background; speciesHasVariants: boolean },
): Record<Step, { key: string; params?: Record<string, string | number> }[]> {
  const out: Record<Step, { key: string; params?: Record<string, string | number> }[]> = {
    class: [],
    background: [],
    species: [],
    abilities: [],
    choices: [],
    equipment: [],
    details: [],
  };
  const c = ch.classes[0];
  if (!c || !ctx.cls) out.class.push({ key: 'create.missing.class' });
  else if (c.level >= ctx.cls.subclassLevel && !c.subclassId)
    out.class.push({ key: 'create.missing.subclass', params: { title: ctx.cls.subclassTitle } });
  if (!ctx.background) out.background.push({ key: 'create.missing.background' });
  else if (!backgroundIncreasesValid(ctx.background, ch.background?.abilityIncreases ?? {}))
    out.background.push({ key: 'create.missing.backgroundIncreases' });
  if (!ch.species) out.species.push({ key: 'create.missing.species' });
  else if (ctx.speciesHasVariants && !ch.species.variant)
    out.species.push({ key: 'create.missing.variant' });
  if (!ch.abilityScores || ABILITIES.some((a) => !ch.abilityScores!.base[a]))
    out.abilities.push({ key: 'create.missing.abilities' });
  else if (
    ch.abilityScores.method === 'point-buy' &&
    pointBuyCost(ch.abilityScores.base) > POINT_BUY_BUDGET
  )
    out.abilities.push({ key: 'create.missing.pointBuy' });
  if (c && ctx.cls) {
    const want = ctx.cls.proficiencies.skills.choose;
    const fromClass = ch.choices.skills.filter((s) =>
      ctx.cls!.proficiencies.skills.from.includes(s),
    ).length;
    if (fromClass < want)
      out.choices.push({ key: 'create.missing.skills', params: { count: want - fromClass } });
    const empty = featSlots(ctx.cls, c.level).filter(
      (s) => !ch.choices.featSlots.find((f) => f.slot === s.slot)?.featId,
    );
    if (empty.length)
      out.choices.push({ key: 'create.missing.feats', params: { count: empty.length } });
  }
  if (!ch.name.trim()) out.details.push({ key: 'create.missing.name' });
  return out;
}
