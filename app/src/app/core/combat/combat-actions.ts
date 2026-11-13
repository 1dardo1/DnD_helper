import type { CombatMonster } from '../dm/combat';
import { spellCasters, spellsByClassOf, spellsOf } from '../creation/spell-choices';
import { Character } from '../models/character';
import { Ability, Monster, Rule, Spell } from '../models/compendium';
import { PlayResource } from '../play/play-state';
import { Attack } from '../rules/attacks';
import { RulesData } from '../rules/engine';
import type { ActiveStateId } from '../rules/active-states';
import { FeatureNote, UseKind, dcValue, writtenDc } from '../rules/feature-stats';
import { Sheet, SheetFeature } from '../rules/sheet';
import type { FormView } from '../rules/wild-shape';
import { SummonedCreature, toCombatMonster } from '../summons/summon-state';
import { Timing, Use, blocksOf, sentencesOf, usesOf } from './action-text';

/**
 * Everything a character can do in a fight, sorted into the three kinds of action of the 2024
 * rules (Action, Bonus Action, Reaction) and, inside each, into sections in a fixed order. Built
 * from the computed Sheet (attacks, features, the numbers of the features, resources) and the
 * compendium (spells, the generic actions of the SRD in data/rules.json). Pure; no Angular.
 *
 * How each thing is used comes, by priority, from: the engine (FeatureNote.action of the
 * feature numbers, the bonus-action rows of the attacks table), the spell's casting time, and
 * the feature's own text (action-text.ts).
 */
export type ActionKind = 'action' | 'bonus' | 'reaction';
export const ACTION_KINDS: readonly ActionKind[] = ['action', 'bonus', 'reaction'];

export type Section =
  | 'weapons'
  | 'natural'
  | 'spellsFree'
  | 'spellsSlot'
  | 'spellsResource'
  | 'featuresAttack'
  | 'featuresResource'
  | 'featuresFree'
  | 'creatures'
  | 'generic'
  | 'outOfCombat';

/** Order of the sections in every column (the most used first). */
export const SECTIONS: readonly Section[] = [
  'weapons',
  'natural',
  'spellsFree',
  'spellsSlot',
  'spellsResource',
  'featuresAttack',
  'featuresResource',
  'featuresFree',
  'creatures',
  'generic',
  'outOfCombat',
];

/** One piece of the one-line summary of a row (shown with the UI texts and the glossary). */
export type LinePart =
  | { k: 'hit'; n: number }
  | { k: 'damage'; dice: string; type: string }
  | { k: 'heal'; dice: string }
  | { k: 'dc'; n: number; ability: Ability | null }
  | { k: 'range'; text: string }
  | { k: 'reach'; feet: number }
  | { k: 'mastery'; name: string }
  | { k: 'concentration' }
  | { k: 'ritual' }
  /** A UI text (combat.note.*, combat.stat.*...) with its parameters. */
  | { k: 'ui'; key: string; params?: Record<string, string | number> }
  /**
   * A sentence of a data text, shown in the language of the data: `of` is the whole English text
   * (translated as a whole), `block` its part (blocksOf) and `index` the sentence (sentencesOf);
   * index -1 = the whole text.
   */
  | { k: 'sentence'; text: string; of: string; block: number | null; index: number };

export type Cost =
  | { k: 'resource'; key: string; max: number; name: string; labelKey: string | null }
  /** A spell slot of this level or higher (pact: a Warlock spell, Pact Magic slots first). */
  | { k: 'slot'; level: number; pact: boolean };

export interface CombatRow {
  /** Stable id: what the favorites keep. */
  id: string;
  kind: ActionKind;
  section: Section;
  /** How it is used ('attack': part of an attack you make; 'free': no action). */
  timing: Timing;
  /** English name (data) or a UI text key for the name. */
  name: string;
  nameKey?: string;
  /** Label of the part of the feature it is (Psychic Whispers of Psionic Power), English. */
  part?: string;
  /** English name of what it comes from (the feat of a spell, the class of a feature). */
  source?: string;
  line: LinePart[];
  cost: Cost | null;
  /** The text "Ver más" shows: an English data text (the UI translates it) and its part. */
  more: { text: string; block: number | null } | null;
  /** The spell or rule in the compendium. */
  link?: { type: 'spell' | 'rule'; id: string };
  /** Also opens this tab of the sheet (the cannon and the summoned creatures). */
  tab?: 'invocaciones';
  /** Sort order inside its section (lower first); ties keep the order they were made. */
  rank: number;
  /** It only applies while this state is on (Frenzy, Divine Fury...: dimmed while it's off). */
  while?: ActiveStateId;
}

export interface CombatInput {
  sheet: Sheet;
  character: Character;
  data: Pick<RulesData, 'classes' | 'subclasses'>;
  /** Rows of the attacks table (attacksFor). */
  attacks: readonly Attack[];
  /** Every spell of the compendium (by id). */
  spells: ReadonlyMap<string, Spell>;
  /** The generic actions (data/rules.json, category "actions"). */
  rules: readonly Rule[];
  resources: readonly PlayResource[];
  /**
   * The Wild Shape form the Druid is in (core/rules/wild-shape.ts): its attacks and actions
   * replace the weapons, and only the spells the form allows stay.
   */
  form?: FormView | null;
}

/** Features whose rows come from structured data instead of their text. */
const STRUCTURED = new Set(['psychic blades', 'spellcasting', 'pact magic']);
/** Names of features that create or command a creature or an object of their own. */
const CREATURE = /\b(cannon|companion|defender|familiar|homunculus|steed|drake|servant|swarm)\b/i;

const KIND_OF: Record<Timing, ActionKind> = {
  action: 'action',
  bonus: 'bonus',
  reaction: 'reaction',
  attack: 'action',
  free: 'action',
};

/** Every row of the three columns, in column order. */
export function combatRows(input: CombatInput): CombatRow[] {
  const rows = [
    ...attackRows(input),
    ...spellRows(input),
    ...featureRows(input),
    ...summonRows(input),
    ...genericRows(input),
  ];
  // one row per id (a feature listed twice, a spell of two classes)
  const seen = new Set<string>();
  return orderRows(rows.filter((r) => !seen.has(r.id) && !!seen.add(r.id)));
}

/** By section, then rank, keeping the order they were made otherwise (stable). */
export function orderRows(rows: readonly CombatRow[]): CombatRow[] {
  const sec = (s: Section) => SECTIONS.indexOf(s);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => sec(a.r.section) - sec(b.r.section) || a.r.rank - b.r.rank || a.i - b.i)
    .map((x) => x.r);
}

/** The rows of one column, grouped by section (sections without rows left out). */
export function sectionsOf(
  rows: readonly CombatRow[],
  kind: ActionKind,
): { section: Section; rows: CombatRow[] }[] {
  const mine = rows.filter((r) => r.kind === kind);
  return SECTIONS.map((section) => ({
    section,
    rows: mine.filter((r) => r.section === section),
  })).filter((s) => s.rows.length > 0);
}

export const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '');

// -- attacks -----------------------------------------------------------------------------------

function attackRows({ attacks, form }: CombatInput): CombatRow[] {
  if (form) return formRows(form);
  return attacks.map((a, i) => {
    // the second Psychic Blade is thrown as a Bonus Action (attacks.ts)
    const bonusAction = a.nameKey === 'sheet.psychicBladeBonus';
    const line: LinePart[] = [
      { k: 'hit', n: a.bonus },
      { k: 'damage', dice: a.damage, type: a.damageType },
    ];
    if (a.reach) line.push({ k: 'reach', feet: a.reach });
    if (a.range) line.push({ k: 'range', text: a.range });
    if (a.mastery) line.push({ k: 'mastery', name: a.mastery });
    for (const n of a.notes) line.push({ k: 'ui', key: `combat.note.${n.id}`, params: n.params });
    return {
      id: `attack:${a.entryId || a.nameKey || slugOf(a.name)}`,
      kind: bonusAction ? 'bonus' : 'action',
      section: a.entryId ? 'weapons' : 'natural',
      timing: bonusAction ? 'bonus' : 'attack',
      name: a.name,
      ...(a.nameKey ? { nameKey: a.nameKey } : {}),
      line,
      cost: null,
      more: null,
      // equipped weapons first (attacksFor already puts them first), stowed ones after
      rank: (a.equipped ? 0 : 100) + i,
    } satisfies CombatRow;
  });
}

/**
 * The attacks and actions of a Wild Shape form: the stat block's numbers ("Your game statistics
 * are replaced by the Beast's stat block"), with the notes of the Druid's features.
 */
function formRows(form: FormView): CombatRow[] {
  const id = (name: string) => `form:${form.monster.id}:${slugOf(name)}`;
  const rows: CombatRow[] = form.attacks.map((a, i) => {
    const line: LinePart[] = [];
    if (a.bonus !== null) line.push({ k: 'hit', n: a.bonus });
    if (a.damage && a.type) line.push({ k: 'damage', dice: a.damage, type: a.type });
    for (const x of a.extra) line.push({ k: 'damage', dice: x.damage, type: x.type });
    if (a.reach) line.push({ k: 'reach', feet: a.reach });
    if (a.range) line.push({ k: 'range', text: a.range });
    for (const n of a.notes) line.push({ k: 'ui', key: `combat.note.${n.id}`, params: n.params });
    return {
      id: id(a.name),
      kind: 'action',
      section: 'natural',
      timing: 'attack',
      name: a.name,
      line,
      cost: null,
      more: { text: a.text, block: null },
      rank: i,
    } satisfies CombatRow;
  });
  const others = (
    list: { name: string; description: string }[],
    kind: ActionKind,
    timing: Timing,
  ) =>
    list.forEach((f, i) =>
      rows.push({
        id: `${id(f.name)}@${kind}`,
        kind,
        section: 'natural',
        timing,
        name: f.name,
        line: [
          {
            k: 'sentence',
            text: sentencesOf(f.description)[0] ?? f.description,
            of: f.description,
            block: null,
            index: 0,
          },
        ],
        cost: null,
        more: { text: f.description, block: null },
        rank: 50 + i,
      }),
    );
  others(form.otherActions, 'action', 'action');
  others(form.bonusActions, 'bonus', 'bonus');
  others(form.reactions, 'reaction', 'reaction');
  return rows;
}

// -- spells -----------------------------------------------------------------------------------

interface Caster {
  attack: number;
  saveDc: number;
  /** Modifier of the spellcasting ability (what a healing spell adds). */
  mod: number;
}

function spellRows(input: CombatInput): CombatRow[] {
  const { sheet, character, data, spells } = input;
  const rows: CombatRow[] = [];
  const seen = new Set<string>();
  const by = spellsByClassOf(
    character.choices,
    spellCasters(character, data.classes, data.subclasses),
    spells,
  );
  for (const sc of sheet.spellcasting.classes) {
    const caster: Caster = {
      attack: sc.attack,
      saveDc: sc.saveDc,
      mod: sheet.abilities[sc.ability].modifier,
    };
    const pact = sc.classId === 'warlock';
    for (const id of spellsOf(by, sc.classId)) {
      const spell = spells.get(id);
      if (!spell || seen.has(id)) continue;
      seen.add(id);
      const cost: Cost | null = spell.level > 0 ? { k: 'slot', level: spell.level, pact } : null;
      rows.push(spellRow(spell, caster, sheet.totalLevel, cost));
    }
  }
  // spells of species, feats and subclasses (always prepared, at will, once per Long Rest...)
  for (const fs of sheet.featSpells) {
    const spell = spells.get(fs.id);
    if (!spell || seen.has(fs.id)) continue;
    seen.add(fs.id);
    const caster: Caster = {
      attack: fs.attack,
      saveDc: fs.saveDc,
      mod: sheet.abilities[fs.ability].modifier,
    };
    const free = fs.freeKey ? input.resources.find((r) => r.key === fs.freeKey) : undefined;
    const cost: Cost | null =
      spell.level === 0 || fs.atWill
        ? null
        : free
          ? resourceCost(free)
          : { k: 'slot', level: spell.level, pact: false };
    rows.push({ ...spellRow(spell, caster, sheet.totalLevel, cost), source: fs.feat.name });
  }
  // in a Wild Shape form: "You can't cast spells" (but the Circle of the Moon's, or all of them
  // with Beast Spells)
  const rules = input.form?.rules;
  if (!rules || rules.spells === 'all') return rows;
  const allowed = new Set(rules.spells === 'circle' ? rules.circleSpells : []);
  return rows.filter((r) => allowed.has(r.id.replace(/^spell:/, '')));
}

const DAMAGE =
  /\b(\d+d\d+(?:\s*\+\s*\d+)?)\s+(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder)\s+damage/i;
const SAVE = /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i;
const ABILITY: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

/**
 * The damage of a cantrip at a character level, from its "Cantrip Upgrade" text: "The damage
 * increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10)".
 */
export function cantripDice(base: string, upgrade: string | null | undefined, level: number) {
  let dice = base;
  for (const m of (upgrade ?? '').matchAll(/\b(\d+)\s*\((\d+d\d+)\)/g))
    if (level >= Number(m[1])) dice = m[2];
  return dice;
}

/** A spell as a row: its kind from the casting time, its numbers from its text. */
export function spellRow(
  spell: Spell,
  caster: Caster,
  level: number,
  cost: Cost | null,
): CombatRow {
  const unit = spell.castingTime?.unit;
  const kind: ActionKind =
    unit === 'bonus-action' ? 'bonus' : unit === 'reaction' ? 'reaction' : 'action';
  const outOfCombat = unit === 'minute' || unit === 'hour';
  const text = spell.description ?? '';
  const line: LinePart[] = [];
  // a reaction's trigger: "Reaction, which you take when you are hit by an attack roll..."
  if (kind === 'reaction' && spell.reactionTrigger) {
    const raw = spell.castingTime.raw;
    line.push({ k: 'sentence', text: raw, of: raw, block: null, index: -1 });
  }
  if (/\b(?:melee|ranged)\s+spell\s+attack\b/i.test(text))
    line.push({ k: 'hit', n: caster.attack });
  const save = SAVE.exec(text);
  if (save) line.push({ k: 'dc', n: caster.saveDc, ability: ABILITY[save[1].toLowerCase()] });
  const dmg = DAMAGE.exec(text);
  if (dmg) {
    const dice = spell.level === 0 ? cantripDice(dmg[1], spell.higherLevels, level) : dmg[1];
    line.push({ k: 'damage', dice, type: dmg[2].toLowerCase() });
  }
  const heal = /Hit Points equal to (\d+d\d+) plus your spellcasting ability modifier/i.exec(text);
  if (heal) line.push({ k: 'heal', dice: `${heal[1]}${signed(caster.mod)}` });
  if (spell.range) line.push({ k: 'range', text: spell.range });
  if (spell.concentration) line.push({ k: 'concentration' });
  if (spell.ritual) line.push({ k: 'ritual' });
  const section: Section = outOfCombat
    ? 'outOfCombat'
    : !cost
      ? 'spellsFree'
      : cost.k === 'slot'
        ? 'spellsSlot'
        : 'spellsResource';
  return {
    id: `spell:${spell.id}`,
    kind,
    section,
    timing: kind,
    name: spell.name,
    line,
    cost,
    more: { text, block: null },
    link: { type: 'spell', id: spell.id },
    // cantrips first, then by level
    rank: spell.level * 10,
  };
}

// -- features ---------------------------------------------------------------------------------

const resourceCost = (r: PlayResource): Cost => ({
  k: 'resource',
  key: r.key,
  max: r.max,
  name: r.name,
  labelKey: r.labelKey,
});

/** "Rages" → "rage", "Psionic Energy Dice" → "psionic energy die". */
const singular = (name: string) =>
  name
    .toLowerCase()
    .replace(/\bdice$/, 'die')
    .replace(/s$/, '');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The counter a feature (or a part of it) spends: the one the engine names, the one with the
 * feature's own name (Rage → Rages, Second Wind, Action Surge), or the one its text spends
 * ("expend one Psionic Energy Die", "spend 1 Focus Point"). Feats: their own uses.
 */
export function resourceFor(
  f: Pick<SheetFeature, 'name' | 'source'>,
  part: string | null,
  text: string,
  resources: readonly PlayResource[],
  spends?: string,
): PlayResource | null {
  if (spends) {
    const named = resources.find((r) => singular(r.name) === singular(spends));
    if (named) return named;
  }
  const names = [f.name, part].filter((x): x is string => !!x).map(singular);
  const own = resources.find((r) => !r.feat && names.includes(singular(r.name)));
  if (own) return own;
  if (f.source.type === 'feat') {
    const uses = resources.filter((r) => r.feat === f.source.name || r.feat === f.name);
    return uses.find((r) => text.includes(r.name)) ?? uses[0] ?? null;
  }
  const flat = text.replace(/\*+/g, '');
  for (const r of resources) {
    if (r.feat) continue;
    const s = singular(r.name);
    const word = new RegExp(
      `\\b(?:expend|expends|spend|spends|use|uses)\\b[^.]{0,60}\\b${escape(s)}s?\\b`,
      'i',
    );
    const die = s.endsWith(' die')
      ? new RegExp(
          `\\b(?:expend|spend|roll)\\b[^.]{0,40}\\b${escape(s.replace(/ die$/, ''))} (?:die|dice)\\b`,
          'i',
        )
      : null;
    if (word.test(flat) || die?.test(flat)) return r;
  }
  return null;
}

const NOTE_TIMING: Partial<Record<UseKind, Timing>> = {
  action: 'action',
  bonus: 'bonus',
  reaction: 'reaction',
  free: 'free',
  onHit: 'attack',
};

function featureRows(input: CombatInput): CombatRow[] {
  const { sheet, resources } = input;
  const notes: FeatureNote[] = [...(sheet.combat.notes ?? []), ...(sheet.combat.stats ?? [])];
  const rows: CombatRow[] = [];
  for (const f of sheet.features) {
    if (STRUCTURED.has(f.name.toLowerCase())) continue;
    const base = `feature:${f.source.type}:${f.source.id}:${slugOf(f.name)}`;
    const creature = CREATURE.test(f.name);
    const dcs: LinePart[] = notes
      .filter((n) => n.source === f.name && n.id === 'dc' && typeof n.params?.['n'] === 'number')
      .map((n) => ({ k: 'dc', n: n.params!['n'] as number, ability: n.ability ?? null }));
    const sectionOf = (timing: Timing, cost: Cost | null): Section =>
      creature
        ? 'creatures'
        : timing === 'attack'
          ? 'featuresAttack'
          : cost
            ? 'featuresResource'
            : 'featuresFree';

    // 1. what the engine already knows (the numbers of the features): one row per way of use
    const known = notes.filter((n) => n.source === f.name && n.action && NOTE_TIMING[n.action]);
    if (known.length) {
      for (const timing of [...new Set(known.map((n) => NOTE_TIMING[n.action!]!))]) {
        const mine = known.filter((n) => NOTE_TIMING[n.action!] === timing);
        const spends = mine.find((n) => n.spends)?.spends;
        const res = spends ? resourceFor(f, null, f.description, resources, spends) : null;
        const cost: Cost | null = res
          ? resourceCost(res)
          : spends && /spell slot/i.test(spends)
            ? { k: 'slot', level: 1, pact: false }
            : null;
        const line: LinePart[] = mine.map((n) => ({
          k: 'ui',
          key: `combat.${sheet.combat.notes.includes(n) ? 'note' : 'stat'}.${n.id}`,
          params: n.params,
        }));
        for (const n of mine)
          if (n.saveDc) line.push({ k: 'dc', n: n.saveDc, ability: n.ability ?? null });
        const w = mine.find((n) => n.while)?.while;
        rows.push({
          ...(w ? { while: w } : {}),
          id: `${base}@${timing}`,
          kind: KIND_OF[timing],
          section: sectionOf(timing, cost),
          timing,
          name: f.name,
          source: f.source.name,
          line: [...line, ...dcs.filter(() => !mine.some((n) => n.saveDc))],
          cost,
          more: { text: f.description, block: null },
          ...(creature ? { tab: 'invocaciones' as const } : {}),
          rank: f.level,
        });
      }
      continue;
    }

    // 2. what the text says: the feature itself and each labelled part of it
    blocksOf(f.description).forEach((b, bi) => {
      for (const use of usesOf(b.text)) {
        const res = resourceFor(f, b.label, b.text, resources);
        const cost: Cost | null = res ? resourceCost(res) : null;
        const sentence: LinePart = {
          k: 'sentence',
          text: use.sentence,
          of: f.description,
          block: bi,
          index: use.index,
        };
        rows.push({
          id: `${base}${b.label ? '/' + slugOf(b.label) : ''}@${use.timing}`,
          kind: KIND_OF[use.timing],
          section: sectionOf(use.timing, cost),
          timing: use.timing,
          name: f.name,
          ...(b.label && b.label !== f.name ? { part: b.label } : {}),
          source: f.source.name,
          line: [sentence, ...(bi === 0 || dcs.length === 1 ? dcs : [])],
          cost,
          more: { text: f.description, block: bi },
          ...(creature ? { tab: 'invocaciones' as const } : {}),
          rank: f.level,
        });
      }
    });
  }
  return rows;
}

// -- creatures --------------------------------------------------------------------------------

/** The creatures summoned now (tracked in the summons tab): a row to go there. */
function summonRows({ character }: CombatInput): CombatRow[] {
  const n = Object.values(character.state.summons?.creatures ?? {}).filter((c) => c.on).length;
  if (!n) return [];
  return [
    {
      id: 'summons',
      kind: 'action',
      section: 'creatures',
      timing: 'action',
      name: 'Summoned creatures',
      nameKey: 'combat.summoned',
      line: [{ k: 'ui', key: 'combat.summonedN', params: { n } }],
      cost: null,
      more: null,
      tab: 'invocaciones',
      rank: 1000,
    },
  ];
}

// -- summoned creatures (the blocks under the tab's numbers) ---------------------------------

/** A creature of the character's summons, with its label already translated. */
export interface SummonedInput {
  key: string;
  label: string;
  monster: Monster;
  state: SummonedCreature;
}

/** A block of the combat tab: the card of a creature that is out. */
export interface SummonedBlock {
  key: string;
  label: string;
  monster: Monster;
  /** The creature with its hit points and limited uses, as the summons card shows it. */
  instance: CombatMonster;
  /** Open at first: one or two creatures out (more than two: closed, to keep the tab short). */
  open: boolean;
}

/** The creatures marked as out, in the order given (the ones marked off are left out). */
export function summonedBlocks(items: readonly SummonedInput[]): SummonedBlock[] {
  const out = items.filter((i) => i.state.on);
  const open = out.length <= 2;
  return out.map((i) => ({
    key: i.key,
    label: i.label,
    monster: i.monster,
    instance: toCombatMonster(i.key, i.monster, i.state),
    open,
  }));
}

// -- generic actions (SRD 5.2.1, data/rules.json) ---------------------------------------------

/** Order of the generic actions in their column. */
const GENERIC_ORDER = [
  'attack',
  'unarmed-strike',
  'magic',
  'dash',
  'disengage',
  'dodge',
  'help',
  'hide',
  'influence',
  'ready',
  'search',
  'study',
  'utilize',
  'light-property',
  'opportunity-attacks',
];
/** Definitions of the kinds themselves, shown as the "?" of each column. */
const DEFINITIONS: Record<ActionKind, string> = {
  action: 'actions/action',
  bonus: 'actions/bonus-action',
  reaction: 'actions/reaction',
};

/** The rule that defines each kind of action (the "?" of a column). */
export function definitions(rules: readonly Rule[]): Partial<Record<ActionKind, Rule>> {
  const out: Partial<Record<ActionKind, Rule>> = {};
  for (const k of ACTION_KINDS) {
    const r = rules.find((x) => x.id === DEFINITIONS[k]);
    if (r) out[k] = r;
  }
  return out;
}

function genericRows({ sheet, rules }: CombatInput): CombatRow[] {
  const rows: CombatRow[] = [];
  const mod = (a: Ability) => sheet.abilities[a].modifier;
  for (const r of rules) {
    if (r.category !== 'actions' || Object.values(DEFINITIONS).includes(r.id)) continue;
    const slug = r.id.replace(/^actions\//, '');
    const rank = GENERIC_ORDER.indexOf(slug) < 0 ? 99 : GENERIC_ORDER.indexOf(slug);
    const tag = r.tag;
    const blocks = blocksOf(r.description);
    const first = (block = 0): LinePart => {
      const s = sentencesOf(blocks[block]?.text ?? '')[0] ?? '';
      return { k: 'sentence', text: s, of: r.description, block, index: 0 };
    };
    const make = (
      kind: ActionKind,
      timing: Timing,
      line: LinePart[],
      extra: Partial<CombatRow> = {},
    ) =>
      rows.push({
        id: `generic:${r.id}${extra.part ? '/' + slugOf(extra.part) : ''}@${timing}`,
        kind,
        section: 'generic',
        timing,
        name: r.name,
        line,
        cost: null,
        more: { text: r.description, block: null },
        link: { type: 'rule', id: r.id },
        rank,
        ...extra,
      });

    // the Unarmed Strike's options other than damage (its damage row is in the attacks table):
    // Grapple and Shove, made in place of an attack of the Attack action
    if (slug === 'unarmed-strike') {
      blocks.forEach((b, bi) => {
        if (!b.label || /^damage$/i.test(b.label)) return;
        // "The DC for the saving throw ... equals 8 plus your Strength modifier and Proficiency Bonus"
        const said =
          /equals 8 plus your (Strength|Dexterity) modifier and (?:your )?Proficiency Bonus/i.exec(
            b.text,
          );
        const dc = said
          ? { abilities: [ABILITY[said[1].toLowerCase()]], pb: true }
          : writtenDc(b.text)[0];
        const line: LinePart[] = [first(bi)];
        if (dc)
          line.unshift({ k: 'dc', n: dcValue(dc, mod, sheet.proficiencyBonus), ability: null });
        make('action', 'attack', line, { part: b.label, more: { text: r.description, block: bi } });
      });
      continue;
    }
    // "[Action]" in the glossary; Reactions and Bonus Actions from the text (Opportunity Attacks,
    // the Light property, the Reaction of a readied action)
    if (tag === 'Action') make('action', 'action', [first()]);
    for (const use of usesOf(r.description)) {
      if (use.timing !== 'bonus' && use.timing !== 'reaction') continue;
      const line: LinePart[] = [
        { k: 'sentence', text: use.sentence, of: r.description, block: null, index: use.index },
      ];
      make(use.timing, use.timing, line, { nameKey: `combat.generic.${slug}.${use.timing}` });
    }
  }
  return rows;
}

// -- favorites ----------------------------------------------------------------------------------

/**
 * The favorite rows, grouped by kind (actions, bonus actions, reactions) and, in each, in the
 * order of their column. Ids that no longer match a row (a spell unprepared) are left out.
 */
export function favoriteRows(
  rows: readonly CombatRow[],
  favorites: readonly string[] | undefined,
): { kind: ActionKind; rows: CombatRow[] }[] {
  const set = new Set(favorites ?? []);
  return ACTION_KINDS.map((kind) => ({
    kind,
    rows: rows.filter((r) => r.kind === kind && set.has(r.id)),
  })).filter((g) => g.rows.length > 0);
}

// -- the numbers of the header -----------------------------------------------------------------

/** Save DCs of features and traits (Breath Weapon, Stunning Strike...), one per feature. */
export function featureDcs(sheet: Sheet): { source: string; n: number; ability: Ability | null }[] {
  const out: { source: string; n: number; ability: Ability | null }[] = [];
  const add = (source: string, n: number, ability: Ability | null) => {
    if (!out.some((d) => d.source === source && d.n === n)) out.push({ source, n, ability });
  };
  for (const n of [...(sheet.combat.notes ?? []), ...(sheet.combat.stats ?? [])]) {
    if (n.saveDc) add(n.source, n.saveDc, n.ability ?? null);
    else if (n.id === 'dc' && typeof n.params?.['n'] === 'number')
      add(n.source, n.params['n'], n.ability ?? null);
  }
  // species traits and feats (the engine's numbers cover class and subclass features)
  const mod = (a: Ability) => sheet.abilities[a].modifier;
  for (const f of sheet.features) {
    if (f.source.type === 'class' || f.source.type === 'subclass') continue;
    for (const dc of writtenDc(f.description))
      add(
        f.name,
        dcValue(dc, mod, sheet.proficiencyBonus),
        dc.abilities.length === 1 ? dc.abilities[0] : null,
      );
  }
  return out;
}

/**
 * "You have Advantage on ..." sentences of the character's traits and features, with where they
 * come from (Gnomish Cunning, Fey Ancestry, Danger Sense...).
 */
export function advantagesOf(
  sheet: Sheet,
): { source: string; text: string; of: string; index: number }[] {
  const out: { source: string; text: string; of: string; index: number }[] = [];
  for (const f of sheet.features) {
    sentencesOf(f.description).forEach((s, index) => {
      if (/^You have Advantage on\b/i.test(s) && !out.some((o) => o.source === f.name))
        out.push({ source: f.name, text: s, of: f.description, index });
    });
  }
  return out;
}

/** The use of a text (for the table of the report and the tests). */
export type { Use };
