import { PLAN_GROUP } from '../artificer/plans';
import { Character, FeatChoice } from '../models/character';
import { Ability, ClassOption, DndClass, Feat, Spellcasting, Subclass } from '../models/compendium';
import { castingOf } from '../rules/engine';
import { MulticlassGains, multiclassGains } from '../rules/multiclass';
import { Sheet, SheetFeature } from '../rules/sheet';
import { ABILITIES, SKILL_ABILITY } from '../rules/tables';
import {
  FeatSlot,
  Note,
  OptionGroup,
  expertiseCount,
  featSlots,
  maxSpellLevel,
  multiclassIssues,
  optionGroupsFor,
  spellListOf,
} from './creation-rules';
import { averageHp, resizeHp } from './hp-levels';

export { averageHp };

/**
 * Rules of gaining a level (guided level up): what the next level of a class asks for and gives.
 * Built on the creation rules; like them, they never block (the DM may allow exceptions).
 */

type ClassEntry = Character['classes'][number];

/** The character with one more level in a class: an existing one, or a new one (multiclass) last. */
export function addLevel(ch: Character, classId: string): { character: Character; index: number } {
  const c = structuredClone(ch);
  let index = c.classes.findIndex((k) => k.id === classId);
  if (index >= 0) {
    const k = c.classes[index];
    k.level++;
    resizeHp(k, k.level);
  } else {
    index = c.classes.push({ id: classId, level: 1, subclassId: null, hp: [null] }) - 1;
  }
  return { character: c, index };
}

/** Sets the hit points rolled at the class's last level (null = the average). */
export function withLevelHp(ch: Character, index: number, hp: number | null): Character {
  const c = structuredClone(ch);
  const k = c.classes[index];
  if (k) k.hp[k.level - 1] = hp;
  return c;
}

export interface Delta {
  before: number;
  after: number;
}

export interface LevelGains {
  cls: DndClass;
  /** The new class level. */
  level: number;
  isNewClass: boolean;
  /** The class reaches its subclass level without one chosen before this level up. */
  needsSubclass: boolean;
  /** Feat choices this very level grants (ASI, Fighting Style, Epic Boon). */
  featSlots: FeatSlot[];
  /** The "Features" cell of the class table at this level ("Blood Maledict (2/rest)"...). */
  tableFeatures: string[];
  /** New Expertise picks. */
  expertise: number;
  spells: {
    list: string;
    sc: Spellcasting;
    cantrips: Delta | null;
    prepared: Delta | null;
    /** Highest spell level it can pick. */
    maxLevel: Delta;
  } | null;
  /** Option groups that grow at this level, or that have no count in the table (uncounted). */
  optionGroups: (OptionGroup & { before: number; uncounted: boolean })[];
  /** What a new class (not the starting one) grants when multiclassing into it. */
  multiclass: MulticlassGains | null;
}

/**
 * What the new level of a class asks for. entryBefore: the class as it was (undefined for a new
 * class); sub: the subclass chosen now or before; startingClass: the character had no class.
 */
export function levelGains(
  cls: DndClass,
  level: number,
  entryBefore: ClassEntry | undefined,
  sub: Subclass | undefined,
  options: ClassOption[],
  startingClass = false,
): LevelGains {
  const sc = castingOf(cls, sub);
  const at = (xs: number[] | null | undefined, lvl: number) => (lvl > 0 ? (xs?.[lvl - 1] ?? 0) : 0);
  const delta = (xs: number[] | null | undefined): Delta | null =>
    xs ? { before: at(xs, level - 1), after: at(xs, level) } : null;
  const before = new Map(
    level > 1
      ? optionGroupsFor(cls, level - 1, sub?.id ?? null, options).map((g) => [g.group, g.count])
      : [],
  );
  return {
    cls,
    level,
    isNewClass: !entryBefore,
    needsSubclass: level >= cls.subclassLevel && !entryBefore?.subclassId,
    featSlots: featSlots(cls, level).filter((s) => s.level === level),
    tableFeatures: cls.progression.rows[level - 1]?.features ?? [],
    expertise: expertiseCount(cls, level) - expertiseCount(cls, level - 1),
    spells: sc && {
      list: spellListOf(cls, sc),
      sc,
      cantrips: delta(sc.cantripsByLevel),
      prepared: delta(sc.preparedByLevel),
      maxLevel: {
        before: level > 1 ? maxSpellLevel(sc, level - 1) : 0,
        after: maxSpellLevel(sc, level),
      },
    },
    optionGroups: optionGroupsFor(cls, level, sub?.id ?? null, options)
      .map((g) => ({
        ...g,
        before: before.get(g.group) ?? 0,
        uncounted: g.count === null,
      }))
      // the plans list stays open at every Artificer level: one plan may be replaced
      .filter(
        (g) => g.uncounted || g.count! > g.before || (g.group === PLAN_GROUP && g.count! > 0),
      ),
    multiclass: !entryBefore && !startingClass ? multiclassGains(cls) : null,
  };
}

/** Whether the spellcasting of a level brings something new to pick. */
export function spellsGrow(s: LevelGains['spells']): boolean {
  if (!s) return false;
  const grew = (d: Delta | null) => !!d && d.after > d.before;
  return grew(s.cantrips) || grew(s.prepared) || s.maxLevel.after > s.maxLevel.before;
}

/** Skills a multiclass skill can be chosen from (empty when the class grants none). */
export function multiclassSkillOptions(cls: DndClass, gains: MulticlassGains | null): string[] {
  if (gains?.skill === 'any') return Object.keys(SKILL_ABILITY);
  if (gains?.skill === 'list') return cls.proficiencies.skills.from;
  return [];
}

/**
 * Multiclassing warnings for a new class: the 13s of every class (old and new), and whether its
 * proficiencies are only estimated or unknown.
 */
export function multiclassNotes(current: DndClass[], next: DndClass, sheet: Sheet): Note[] {
  const out = multiclassIssues([...current, next], sheet);
  if (!current.length) return out;
  const g = multiclassGains(next);
  if (!g.known || g.estimated)
    out.push({
      key: g.known ? 'create.issue.multiclassEstimated' : 'create.issue.multiclassUnknown',
      params: { cls: next.name },
      kind: 'issue',
    });
  return out;
}

// -- feat slots (same storage as the creation wizard) ---------------------------------------

export function slotFeatId(ch: Character, slot: string): string {
  return ch.choices.featSlots.find((s) => s.slot === slot)?.featId ?? '';
}

/** Puts a feat in a slot, dropping the ability picks the previous one had. */
export function withSlotFeat(ch: Character, slot: string, featId: string): Character {
  const c = structuredClone(ch);
  c.choices.featSlots = [
    ...c.choices.featSlots.filter((s) => s.slot !== slot),
    { slot, featId: featId || null },
  ];
  c.choices.abilityIncreases = c.choices.abilityIncreases.filter((i) => i.slot !== slot);
  // what the previous feat asked (spells, skills...) is not valid for the new one
  if (c.choices.featChoices?.[slot]) {
    const { [slot]: _gone, ...rest } = c.choices.featChoices;
    c.choices.featChoices = rest;
  }
  return c;
}

/** Stores what a feat in a slot asked the player to choose (see core/rules/feat-effects.ts). */
export function withFeatChoice(ch: Character, key: string, choice: FeatChoice): Character {
  const c = structuredClone(ch);
  c.choices.featChoices = { ...(c.choices.featChoices ?? {}), [key]: choice };
  return c;
}

/** How many +1 picks a feat gives, and from which abilities (ASI: two, the same twice = +2). */
export function slotPicks(feat: Feat | undefined): { picks: number; from: Ability[] } {
  if (feat?.id === 'ability-score-improvement') return { picks: 2, from: ABILITIES };
  if (!feat?.abilityIncrease) return { picks: 0, from: [] };
  return { picks: feat.abilityIncrease.amount, from: feat.abilityIncrease.from };
}

/** Ability chosen for the n-th +1 of a slot ('' = not chosen). */
export function slotAbility(ch: Character, slot: string, n: number): Ability | '' {
  const incs = ch.choices.abilityIncreases.filter((i) => i.slot === slot);
  return incs.flatMap((i) => Array<Ability>(i.amount).fill(i.ability))[n] ?? '';
}

export function withSlotAbility(
  ch: Character,
  slot: string,
  n: number,
  ability: Ability | '',
  picks: number,
): Character {
  const current = Array.from({ length: picks }, (_, i) => slotAbility(ch, slot, i));
  current[n] = ability;
  const counts = new Map<Ability, number>();
  for (const a of current) if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
  const c = structuredClone(ch);
  const source = slotFeatId(ch, slot);
  c.choices.abilityIncreases = [
    ...c.choices.abilityIncreases.filter((i) => i.slot !== slot),
    ...[...counts].map(([a, amount]) => ({ source, ability: a, amount, slot })),
  ];
  return c;
}

// -- before / after ---------------------------------------------------------------------------

export interface SheetChange {
  what:
    | 'level'
    | 'hp'
    | 'pb'
    | 'hitDice'
    | 'ac'
    | 'initiative'
    | 'ability'
    | 'slots'
    | 'pact'
    | 'saveDc'
    | 'cantrips'
    | 'prepared'
    | 'resource';
  /** The ability, or the class table column, for 'ability' and 'resource'. */
  ref?: string;
  /** For spellcasting and class table rows. */
  classId?: string;
  before: string;
  after: string;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** What the level changes on the sheet. Level, hit points and proficiency bonus always show. */
export function sheetChanges(before: Sheet, after: Sheet): SheetChange[] {
  const out: SheetChange[] = [];
  const row = (
    what: SheetChange['what'],
    b: string,
    a: string,
    extra: Partial<SheetChange> = {},
    always = false,
  ) => (always || a !== b) && out.push({ what, before: b, after: a, ...extra });
  const dash = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n}`);

  row('level', `${before.totalLevel}`, `${after.totalLevel}`, {}, true);
  row('hp', `${before.hitPoints.max}`, `${after.hitPoints.max}`, {}, true);
  row('pb', signed(before.proficiencyBonus), signed(after.proficiencyBonus), {}, true);
  const dice = (s: Sheet) => s.hitPoints.hitDice.map((d) => `${d.count}d${d.die}`).join(' + ');
  row('hitDice', dice(before), dice(after));
  row('ac', `${before.armorClass.value}`, `${after.armorClass.value}`);
  row('initiative', signed(before.initiative), signed(after.initiative));
  for (const a of ABILITIES)
    row('ability', `${before.abilities[a].score}`, `${after.abilities[a].score}`, { ref: a });

  const slots = (s: Sheet) => {
    const xs = s.spellcasting.slots;
    const last = xs.reduce((n, v, i) => (v > 0 ? i + 1 : n), 0);
    return last ? xs.slice(0, last).join(' / ') : '—';
  };
  row('slots', slots(before), slots(after));
  const pact = (s: Sheet) =>
    s.spellcasting.pact ? `${s.spellcasting.pact.slots} (${s.spellcasting.pact.level})` : '—';
  row('pact', pact(before), pact(after));
  for (const sc of after.spellcasting.classes) {
    const old = before.spellcasting.classes.find((x) => x.classId === sc.classId);
    const classId = sc.classId;
    row('saveDc', dash(old?.saveDc), `${sc.saveDc}`, { classId });
    row('cantrips', dash(old?.cantrips), dash(sc.cantrips), { classId });
    row('prepared', dash(old?.prepared), dash(sc.prepared), { classId });
  }
  for (const r of after.resources) {
    const old = before.resources.find((x) => x.classId === r.classId && x.name === r.name);
    row('resource', old?.value ?? '—', r.value, { ref: r.name, classId: r.classId });
  }
  return out;
}

/** Features on the new sheet that weren't on the old one (class, subclass, feats...). */
export function newFeatures(before: Sheet, after: Sheet): SheetFeature[] {
  const key = (f: SheetFeature) => `${f.source.type}:${f.source.id}:${f.name}:${f.level}`;
  const had = new Set(before.features.map(key));
  return after.features.filter((f) => !had.has(key(f)));
}

/** Notes (from review()) that the level up brought: those that weren't there before. */
export function newNotes(before: Note[], after: Note[]): Note[] {
  const key = (n: Note) => `${n.key}|${JSON.stringify(n.params ?? {})}`;
  const had = new Set(before.map(key));
  return after.filter((n) => !had.has(key(n)));
}

/** Current hit points go up with the maximum (null = at maximum, it stays so). */
export function withHpGained(ch: Character, gained: number): Character {
  const cur = ch.state.hpCurrent;
  if (cur === null || gained <= 0) return ch;
  return { ...ch, state: { ...ch.state, hpCurrent: cur + gained } };
}
