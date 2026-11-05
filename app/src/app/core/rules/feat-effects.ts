import { Ability, Feat } from '../models/compendium';

/**
 * What a feat gives beyond its text, worked out from the text itself (spells it grants, free casts,
 * uses per rest, speed, languages...) plus a short table of what the player must choose (spell
 * list, skills, tools...). Pure: the rules engine (engine.ts) and the screens both read it.
 */

/** Where a feat comes from, for the choices it asks ("background", "species", "fighter:4"...). */
export interface FeatSource {
  key: string;
  feat: Feat;
  /** Magic Initiate taken through a background ("Magic Initiate (Cleric)") has its list fixed. */
  fixedList?: string;
}

export const SPELL_ABILITIES: Ability[] = ['INT', 'WIS', 'CHA'];
export const MAGIC_INITIATE_LISTS = ['cleric', 'druid', 'wizard'];

/** A spell the feat's text gives. */
export interface FeatSpellGrant {
  /** English name, as the feat writes it. */
  name: string;
  /** Id in the compendium (the name as a slug). */
  id: string;
  /** Character level that unlocks it (3 for "When you reach character level 3, ..."). */
  minLevel: number;
  /** The text says it is a cantrip; null when it only says "spell" (the compendium knows). */
  cantrip: boolean | null;
  /** One cast without a spell slot, back after a Long Rest. */
  free: boolean;
  /** Can also be cast with spell slots. */
  slots: boolean;
  /** How many free casts: one, or the spellcasting modifier (Lich Ascension). */
  freeUses: 1 | 'mod';
}

/** A countable use of a feat. */
export interface FeatUseRule {
  /** Name of the benefit ("Luck Points", "Helpful Friend"); the feat name when it has none. */
  label: string;
  /** 'pb': equal to the Proficiency Bonus. */
  max: 'pb' | number;
  rest: 'long' | 'short-or-long';
}

export type SpellAbilityRule =
  | { mode: 'choice' }
  | { mode: 'fixed'; ability: Ability }
  | { mode: 'increased' }
  | { mode: 'none' };

export interface FeatRules {
  spells: FeatSpellGrant[];
  ability: SpellAbilityRule;
  uses: FeatUseRule[];
  /** Flat bonuses the text states. */
  speed: number;
  hpFlat: number;
  hpPerLevel: number;
  ac: number;
  languages: string[];
  weapons: string[];
  /** Damage types the text says you resist ("You have Resistance to Necrotic and Poison damage"). */
  resistances: string[];
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Names with an "and" that must not be split as a list ("Detect Evil and Good"). */
const AND_NAMES = new Set(['detect evil and good', 'protection from evil and good']);

function splitNames(raw: string): string[] {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (AND_NAMES.has(cleaned.toLowerCase())) return [cleaned];
  return cleaned
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/)
    .map((n) => n.trim())
    .filter((n) => /^[A-Z]/.test(n));
}

const plain = (s: string) => s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();

const cache = new WeakMap<Feat, FeatRules>();

/** What the text of a feat gives. Memoised per feat object. */
export function featRules(feat: Feat): FeatRules {
  const hit = cache.get(feat);
  if (hit) return hit;
  const rules = parseFeat(feat);
  cache.set(feat, rules);
  return rules;
}

function parseFeat(feat: Feat): FeatRules {
  const text = feat.description ?? '';
  const out: FeatRules = {
    spells: [],
    ability: { mode: 'none' },
    uses: [],
    speed: 0,
    hpFlat: 0,
    hpPerLevel: 0,
    ac: 0,
    languages: [],
    weapons: [],
    resistances: [],
  };
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('|') && !p.startsWith('#'));

  let heading = '';
  for (const raw of paragraphs) {
    const h = /^\*\*(.+?)\.?\*\*\.?\s*(.*)$/.exec(raw);
    if (h) heading = plain(h[1]).replace(/\.$/, '');
    const p = plain(raw);

    // -- spells -------------------------------------------------------------------------
    const casts = /without (?:expending )?a spell slot|without a spell slot or/i.test(p);
    const free = casts && /Long Rest/i.test(p);
    const slots =
      /using (?:any |the )?spell slots|also cast (?:it|the spell|these spells?|those spells)/i.test(
        p,
      );
    const grants: { name: string; cantrip: boolean | null; minLevel: number }[] = [];
    // "You learn the Minor Illusion cantrip" / "You know the Shocking Grasp cantrip"
    for (const m of p.matchAll(/You (?:learn|know) the ([A-Z][\w' ’-]+?) (cantrip|spell)\b/g))
      grants.push({ name: m[1], cantrip: m[2] === 'cantrip' ? true : null, minLevel: 1 });
    // "You always have the Find Familiar spell prepared" / "the A and B spells prepared"
    for (const m of p.matchAll(
      /(When you reach character level (\d+), you also )?always have (?:the|that spell and the) (.+?) spells? prepared/gi,
    ))
      for (const n of splitNames(m[3]))
        grants.push({ name: n, cantrip: false, minLevel: m[2] ? Number(m[2]) : 1 });
    for (const g of grants) {
      if (out.spells.some((s) => s.id === slug(g.name))) continue;
      const isCantrip = g.cantrip === true;
      out.spells.push({
        name: g.name,
        id: slug(g.name),
        minLevel: g.minLevel,
        cantrip: g.cantrip === false ? false : g.cantrip,
        // the free cast is for the spells ("always have ... prepared"), not for cantrips
        free: free && !isCantrip,
        slots: !isCantrip && slots,
        freeUses: /a number of times equal to your spellcasting ability modifier/i.test(p)
          ? 'mod'
          : 1,
      });
    }

    // -- spellcasting ability ------------------------------------------------------------
    if (/Intelligence, Wisdom, or Charisma is your spellcasting ability/i.test(p))
      out.ability = { mode: 'choice' };
    else if (/ability increased by this feat/i.test(p) && /spellcasting ability/i.test(p))
      out.ability = { mode: 'increased' };
    else if (out.ability.mode === 'none') {
      const fixed = /(Intelligence|Wisdom|Charisma) is your spellcasting ability/i.exec(p);
      if (fixed)
        out.ability = { mode: 'fixed', ability: fixed[1].slice(0, 3).toUpperCase() as Ability };
    }

    // -- uses per rest -----------------------------------------------------------------
    if (!(casts && !/Bonus Action/i.test(p)) || /number of times/i.test(p)) {
      const rest = /Short or Long Rest/i.test(p)
        ? 'short-or-long'
        : /Long Rest/i.test(p)
          ? 'long'
          : null;
      const label = heading && heading !== 'Cantrip' ? heading : feat.name;
      if (
        rest &&
        /(?:a number of times|Luck Points) equal to your Proficiency Bonus/i.test(p) &&
        /regain|recover/i.test(p)
      ) {
        add(out.uses, { label, max: 'pb', rest });
      } else if (
        rest &&
        !casts &&
        /Once you [^.]*?, you can(?:'|’)t [^.]*?again until you finish a (?:Short or Long|Long|Short) Rest/i.test(
          p,
        )
      ) {
        add(out.uses, { label, max: 1, rest });
      }
    }

    // -- flat bonuses --------------------------------------------------------------------
    // not "when you take the Dash action, your Speed increases by 10 feet for that action"
    const speed =
      /^(?!.*\b(?:Dash|for that action|while|when)\b).*?Your Speed increases by (\d+) feet/i.exec(
        p,
      );
    if (speed) out.speed += Number(speed[1]);
    const resist =
      /You have Resistance to ((?:[A-Z][a-z]+)(?:(?:,| and|, and) [A-Z][a-z]+)*)(?: damage)?/.exec(
        p,
      );
    if (resist) out.resistances.push(...resist[1].split(/,? and |, /));
    if (/Hit Point maximum increases by an amount equal to twice your character level/i.test(p))
      out.hpPerLevel = 2;
    const hp = /Hit Point maximum increases by (\d+)\b/i.exec(p);
    if (hp) out.hpFlat += Number(hp[1]);
    if (/you gain a \+1 bonus to Armor Class/i.test(p) && /wearing/i.test(p)) out.ac += 1;
    const known = /You know (Thieves' Cant|Thieves’ Cant)\b/.exec(p);
    if (known) out.languages.push("Thieves' Cant");
    if (/proficiency with improvised weapons/i.test(p)) out.weapons.push('Improvised weapons');
  }
  return out;
}

function add(list: FeatUseRule[], u: FeatUseRule): void {
  const dup = list.find((x) => x.label === u.label && x.max === u.max && x.rest === u.rest);
  if (!dup) list.push(u);
}

// -- what the player has to choose ------------------------------------------------------------

export interface PickRule {
  count: number;
  /** Spell lists it may come from; absent = the list picked for the feat. */
  lists?: string[];
  schools?: string[];
}

/** What a feat asks the player to choose besides the spellcasting ability (feat-effects text). */
export interface FeatPicks {
  /** Spell list to choose among (Magic Initiate). */
  list?: string[];
  cantrips?: PickRule;
  /** A leveled spell. */
  spell?: PickRule & { level: number };
  /** Skills and tools, any mix (Skilled). */
  skillsOrTools?: number;
  skills?: { count: number; from?: string[] };
  /** Tools of one kind: "Artisan's Tools" / "Musical Instrument". */
  tools?: { count: number; group: string };
  /** A language of the player's choice; the feat gives this one unless already known. */
  language?: string;
  resistance?: string[];
}

/** What the data's text can't tell: who picks what. Keyed by feat id. */
export const FEAT_PICKS: Record<string, FeatPicks> = {
  'magic-initiate': {
    list: MAGIC_INITIATE_LISTS,
    cantrips: { count: 2 },
    spell: { count: 1, level: 1 },
  },
  'fey-touched': { spell: { count: 1, level: 1, schools: ['divination', 'enchantment'] } },
  'shadow-touched': { spell: { count: 1, level: 1, schools: ['illusion', 'necromancy'] } },
  'vampire-touched': { spell: { count: 1, level: 1, schools: ['enchantment', 'illusion'] } },
  'arcane-undertaker': {
    cantrips: { count: 1, lists: ['cleric', 'wizard'], schools: ['necromancy'] },
  },
  'arcane-warrior': { cantrips: { count: 2, lists: ['wizard'] } },
  skilled: { skillsOrTools: 3 },
  crafter: { tools: { count: 3, group: "Artisan's Tools" } },
  musician: { tools: { count: 3, group: 'Musical Instrument' } },
  'harper-agent': { tools: { count: 1, group: 'Musical Instrument' } },
  'purple-dragon-rook': {
    skills: { count: 1, from: ['insight', 'performance', 'persuasion'] },
  },
  'cult-of-the-dragon-initiate': { language: 'Draconic' },
  'portal-jumper': { resistance: ['Necrotic', 'Psychic', 'Radiant'] },
};

export function featPicks(feat: Feat): FeatPicks {
  return FEAT_PICKS[feat.id] ?? {};
}

/** Who chooses the spellcasting ability: the text says it, or (Magic Initiate) the picks imply it. */
export function abilityRule(feat: Feat): SpellAbilityRule {
  const rules = featRules(feat);
  if (rules.ability.mode !== 'none') return rules.ability;
  const p = featPicks(feat);
  return p.list || p.cantrips || p.spell ? { mode: 'choice' } : rules.ability;
}

/** Whether the player has anything to choose for this feat. */
export function featNeedsChoices(feat: Feat): boolean {
  const rules = featRules(feat);
  const p = featPicks(feat);
  return rules.ability.mode === 'choice' || Object.keys(p).length > 0;
}

/** The spell list of a Magic Initiate feat: the background's, or the player's pick. */
export function featList(src: FeatSource, choice: { list?: string } | undefined): string | null {
  return src.fixedList ?? choice?.list ?? null;
}

/** "Magic Initiate (Cleric)" → "cleric". */
export function listOfFeatName(name: string | null | undefined): string | undefined {
  const m = /\(([^)]+)\)\s*$/.exec(name ?? '');
  const id = m?.[1].trim().toLowerCase();
  return id && MAGIC_INITIATE_LISTS.includes(id) ? id : undefined;
}

export interface SpellLike {
  id: string;
  level: number;
  school: string;
  classes: string[];
}

/** The spells a pick can be made from, given the list picked for the feat. */
export function pickable(
  spells: readonly SpellLike[],
  rule: PickRule & { level?: number },
  list: string | null,
): SpellLike[] {
  const lists = rule.lists ?? (list ? [list] : null);
  return spells.filter(
    (s) =>
      s.level === (rule.level ?? 0) &&
      (!lists || lists.some((l) => s.classes.includes(l))) &&
      (!rule.schools || rule.schools.includes(s.school.toLowerCase())),
  );
}
