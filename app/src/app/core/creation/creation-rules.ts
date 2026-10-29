import { Character } from '../models/character';
import {
  Ability,
  Background,
  ClassOption,
  DndClass,
  Feat,
  Species,
  Spell,
  Subclass,
} from '../models/compendium';
import { TOOL_CHOICE } from '../rules/engine';
import { multiclassGains } from '../rules/multiclass';
import { Sheet } from '../rules/sheet';
import { ABILITIES, SKILL_ABILITY } from '../rules/tables';

/**
 * Rules of character creation (2024 Player's Handbook), as pure functions the wizard uses
 * to offer choices and to tell what's still missing or doesn't meet a requirement. They never
 * block: an incomplete character, or one with exceptions the DM allows, can still be saved.
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

/**
 * Feats that can fill a slot. ASI levels: the Ability Score Improvement feat or a general feat.
 * Feats whose prerequisites aren't met are included too (featIssues says why).
 */
export function featsForSlot(kind: SlotKind, feats: Feat[]): Feat[] {
  const wanted = kind === 'asi' ? ['general'] : [kind];
  return feats
    .filter((f) => wanted.includes(f.category))
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

/** Option lists (invocations, blood curses, maneuvers...) of the class and its subclass. */
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
  // options above the level are listed too: the wizard warns instead of hiding them
  for (const o of mine) groups.set(o.group, [...(groups.get(o.group) ?? []), o]);
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

// -- languages, size, tools ----------------------------------------------------------------

/** 2024 Player's Handbook language tables. Characters know Common plus two standard languages. */
export const STANDARD_LANGUAGES = [
  'Common Sign Language',
  'Draconic',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc',
];
export const RARE_LANGUAGES = [
  'Abyssal',
  'Celestial',
  'Deep Speech',
  'Druidic',
  'Infernal',
  'Primordial',
  'Sylvan',
  "Thieves' Cant",
  'Undercommon',
];

/** Tool kinds a background or class may let you choose from. */
export const TOOL_GROUPS: Record<string, string[]> = {
  "Artisan's Tools": [
    "Alchemist's Supplies",
    "Brewer's Supplies",
    "Calligrapher's Supplies",
    "Carpenter's Tools",
    "Cartographer's Tools",
    "Cobbler's Tools",
    "Cook's Utensils",
    "Glassblower's Tools",
    "Jeweler's Tools",
    "Leatherworker's Tools",
    "Mason's Tools",
    "Painter's Supplies",
    "Potter's Tools",
    "Smith's Tools",
    "Tinker's Tools",
    "Weaver's Tools",
    "Woodcarver's Tools",
  ],
  'Gaming Set': ['Dice', 'Dragonchess', 'Playing Cards', 'Three-Dragon Ante'],
  'Musical Instrument': [
    'Bagpipes',
    'Drum',
    'Dulcimer',
    'Flute',
    'Horn',
    'Lute',
    'Lyre',
    'Pan Flute',
    'Shawm',
    'Viol',
  ],
};

export interface ToolChoice {
  slot: string;
  /** The text it comes from, e.g. "Choose 3 Musical Instruments". */
  text: string;
  count: number;
  options: string[];
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

function parseToolChoice(slot: string, text: string): ToolChoice | null {
  if (!TOOL_CHOICE.test(text)) return null;
  const groups = [
    /artisan/i.test(text) && "Artisan's Tools",
    /gaming/i.test(text) && 'Gaming Set',
    /instrument/i.test(text) && 'Musical Instrument',
  ].filter((g): g is string => !!g);
  if (!groups.length) return null;
  const m =
    text.match(/choose (\d|one|two|three|four)/i) ??
    text.match(/\b(\d|one|two|three|four) (?:kind|type)/i);
  const count = m ? (NUMBER_WORDS[m[1].toLowerCase()] ?? parseInt(m[1], 10)) : 1;
  return { slot, text, count, options: groups.flatMap((g) => TOOL_GROUPS[g]) };
}

/** Every "choose one kind of ..." tool choice from the background, starting class and later classes. */
export function toolChoices(classes: DndClass[], background: Background | undefined): ToolChoice[] {
  const out: ToolChoice[] = [];
  const bg = background?.tools ? parseToolChoice('background', background.tools) : null;
  if (bg) out.push(bg);
  const [first, ...rest] = classes;
  for (const t of first?.proficiencies.tools ?? []) {
    const c = parseToolChoice(`class:${first.id}`, t);
    if (c) out.push(c);
  }
  for (const cls of rest) {
    if (multiclassGains(cls).instrument)
      out.push({
        slot: `multiclass:${cls.id}`,
        text: 'Musical Instrument',
        count: 1,
        options: TOOL_GROUPS['Musical Instrument'],
      });
  }
  return out;
}

// -- skills across classes ----------------------------------------------------------------

/** How many class skills to choose and from which: all of the starting class, plus one per later
 * class that grants a skill when multiclassing (Bard, Ranger, Rogue, Artificer...). */
export function skillPicks(classes: DndClass[]): { count: number; from: string[] } {
  const [first, ...rest] = classes;
  if (!first) return { count: 0, from: [] };
  let count = first.proficiencies.skills.choose;
  const from = new Set(first.proficiencies.skills.from);
  for (const cls of rest) {
    const g = multiclassGains(cls);
    if (!g.skill) continue;
    count++;
    for (const sk of g.skill === 'any' ? Object.keys(SKILL_ABILITY) : cls.proficiencies.skills.from)
      from.add(sk);
  }
  return { count, from: [...from] };
}

// -- requirements -----------------------------------------------------------------------------

export interface Note {
  key: string;
  params?: Record<string, string | number>;
  /** missing: not chosen yet; issue: chosen but doesn't meet a requirement. */
  kind: 'missing' | 'issue';
}

/** Why a feat can't normally be taken by this character (empty = it can). */
export function featIssues(feat: Feat, sheet: Sheet, speciesId: string | null): Note[] {
  const pre = feat.prerequisites;
  if (!pre) return [];
  const out: Note[] = [];
  if (pre.level && sheet.totalLevel < pre.level)
    out.push({ key: 'create.issue.featLevel', params: { level: pre.level }, kind: 'issue' });
  if (pre.abilities?.length) {
    const ok = pre.abilities.map((a) => sheet.abilities[a.ability].score >= a.min);
    const met = pre.abilitiesMode === 'any' ? ok.some(Boolean) : ok.every(Boolean);
    if (!met) {
      const what = pre.abilities
        .map((a) => `${a.ability} ${a.min}`)
        .join(pre.abilitiesMode === 'any' ? ' / ' : ', ');
      out.push({ key: 'create.issue.featAbility', params: { what }, kind: 'issue' });
    }
  }
  if (pre.species?.length && !(speciesId && pre.species.includes(speciesId)))
    out.push({
      key: 'create.issue.featSpecies',
      params: { what: pre.species.join(', ') },
      kind: 'issue',
    });
  if (pre.spellcasting && !sheet.spellcasting.classes.length)
    out.push({ key: 'create.issue.featSpellcasting', kind: 'issue' });
  for (const p of pre.proficiency ?? []) {
    const known = [...sheet.proficiencies.armor, ...sheet.proficiencies.weapons].map((x) =>
      x.toLowerCase(),
    );
    const word = p.replace(/ (armor|weapons?)$/, '').trim();
    if (!known.some((k) => k.includes(word) || k.startsWith('all')))
      out.push({ key: 'create.issue.featProficiency', params: { what: p }, kind: 'issue' });
  }
  return out;
}

/** Multiclassing needs 13 in the primary ability of every class (old and new). */
export function multiclassIssues(classes: DndClass[], sheet: Sheet): Note[] {
  if (classes.length < 2) return [];
  return classes.flatMap((cls) =>
    cls.multiclass.prerequisites
      .filter((g) => !g.anyOf.some((a) => sheet.abilities[a].score >= g.min))
      .map((g) => ({
        key: 'create.issue.multiclass',
        params: { cls: cls.name, what: `${g.anyOf.join(' / ')} ${g.min}` },
        kind: 'issue' as const,
      })),
  );
}

export type StepNotes = Record<Step, Note[]>;

export interface ReviewContext {
  /** In the same order as ch.classes (undefined when an id isn't in the compendium). */
  classes: (DndClass | undefined)[];
  background?: Background;
  species?: Species;
  sheet: Sheet | null;
  feats: Map<string, Feat>;
  spells: Map<string, Spell>;
}

/** Everything still missing or not meeting a requirement, step by step. */
export function review(ch: Character, ctx: ReviewContext): StepNotes {
  const out: StepNotes = {
    class: [],
    background: [],
    species: [],
    abilities: [],
    choices: [],
    equipment: [],
    details: [],
  };
  const miss = (step: Step, key: string, params?: Note['params']) =>
    out[step].push({ key, params, kind: 'missing' });
  const classes = ctx.classes.filter((c): c is DndClass => !!c);

  // class
  if (!ch.classes.length || !classes.length) miss('class', 'create.missing.class');
  ch.classes.forEach((c, i) => {
    const cls = ctx.classes[i];
    if (cls && c.level >= cls.subclassLevel && !c.subclassId)
      miss('class', 'create.missing.subclass', { title: cls.subclassTitle });
  });
  const total = ch.classes.reduce((n, c) => n + c.level, 0);
  if (total > 20)
    out.class.push({ key: 'create.issue.levelCap', params: { total }, kind: 'issue' });
  if (ctx.sheet) out.class.push(...multiclassIssues(classes, ctx.sheet));
  for (const cls of classes.slice(1)) {
    if (!multiclassGains(cls).known)
      out.class.push({
        key: 'create.issue.multiclassUnknown',
        params: { cls: cls.name },
        kind: 'issue',
      });
  }

  // background
  if (!ctx.background) miss('background', 'create.missing.background');
  else if (!backgroundIncreasesValid(ctx.background, ch.background?.abilityIncreases ?? {}))
    miss('background', 'create.missing.backgroundIncreases');

  // species, size, languages
  if (!ch.species) miss('species', 'create.missing.species');
  else if (ctx.species?.variants.length && !ch.species.variant)
    miss('species', 'create.missing.variant');
  if (ctx.species && ctx.species.size.length > 1 && !ch.size)
    miss('species', 'create.missing.size');
  const chosen = ch.choices.languages;
  if (chosen.length < 2) miss('species', 'create.missing.languages', { count: 2 - chosen.length });
  if (chosen.length > 2) out.species.push({ key: 'create.issue.tooManyLanguages', kind: 'issue' });
  for (const l of chosen.filter((l) => RARE_LANGUAGES.includes(l)))
    out.species.push({ key: 'create.issue.rareLanguage', params: { what: l }, kind: 'issue' });

  // ability scores
  if (!ch.abilityScores || ABILITIES.some((a) => !ch.abilityScores!.base[a]))
    miss('abilities', 'create.missing.abilities');
  else if (
    ch.abilityScores.method === 'point-buy' &&
    pointBuyCost(ch.abilityScores.base) > POINT_BUY_BUDGET
  )
    out.abilities.push({ key: 'create.missing.pointBuy', kind: 'issue' });

  // class choices
  if (classes.length) {
    const picks = skillPicks(classes);
    const bgSkills = new Set(ctx.background?.skills ?? []);
    const taken = ch.choices.skills.filter((s) => !bgSkills.has(s)).length;
    if (taken < picks.count)
      miss('choices', 'create.missing.skills', { count: picks.count - taken });
    if (taken > picks.count)
      out.choices.push({
        key: 'create.issue.tooManySkills',
        params: { count: picks.count },
        kind: 'issue',
      });

    let emptySlots = 0;
    ch.classes.forEach((c, i) => {
      const cls = ctx.classes[i];
      if (!cls) return;
      for (const slot of featSlots(cls, c.level)) {
        const featId = ch.choices.featSlots.find((f) => f.slot === slot.slot)?.featId;
        const feat = featId ? ctx.feats.get(featId) : undefined;
        if (!feat) emptySlots++;
        else if (ctx.sheet)
          for (const n of featIssues(feat, ctx.sheet, ch.species?.id ?? null))
            out.choices.push({ ...n, params: { ...n.params, feat: feat.name } });
      }
      // spell counts per caster class
      const sc = cls.spellcasting;
      if (sc) {
        const mine = ch.choices.spells
          .map((id) => ctx.spells.get(id))
          .filter((sp): sp is Spell => !!sp && sp.classes.includes(cls.id));
        const cantrips = mine.filter((sp) => sp.level === 0).length;
        const leveled = mine.length - cantrips;
        const maxC = sc.cantripsByLevel?.[c.level - 1];
        const maxP = sc.preparedByLevel?.[c.level - 1];
        if (maxC !== undefined && cantrips > maxC)
          out.choices.push({
            key: 'create.issue.tooManyCantrips',
            params: { cls: cls.name, count: maxC },
            kind: 'issue',
          });
        if (maxP !== undefined && leveled > maxP)
          out.choices.push({
            key: 'create.issue.tooManySpells',
            params: { cls: cls.name, count: maxP },
            kind: 'issue',
          });
      }
    });
    if (emptySlots) miss('choices', 'create.missing.feats', { count: emptySlots });

    for (const tc of toolChoices(classes, ctx.background)) {
      const got = ch.choices.toolChoices.find((t) => t.slot === tc.slot)?.tools.length ?? 0;
      const step: Step = tc.slot === 'background' ? 'background' : 'choices';
      if (got < tc.count)
        miss(step, 'create.missing.tools', { text: tc.text, count: tc.count - got });
      if (got > tc.count)
        out[step].push({
          key: 'create.issue.tooManyTools',
          params: { text: tc.text, count: tc.count },
          kind: 'issue',
        });
    }
  }

  if (!ch.name.trim()) miss('details', 'create.missing.name');
  return out;
}
