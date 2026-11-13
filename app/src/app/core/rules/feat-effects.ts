import { Ability, Feat } from '../models/compendium';
import { joinBroken } from './trait-effects';

/** What the parser reads: a feat, a class or species feature, an option... (name and text). */
export interface RuleText {
  name: string;
  description: string;
}

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
/** The eight schools of magic, as the compendium writes them (lowercase). */
export const SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
];

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
  /** Can be cast whenever without a spell slot, with no limit (Eldritch Invocations like Armor of Shadows). */
  atWill: boolean;
  /** Can also be cast with spell slots. */
  slots: boolean;
  /** How many free casts: one, the spellcasting modifier (Lich Ascension) or the Proficiency Bonus. */
  freeUses: 1 | 'mod' | 'pb';
  /** 'mod' by a named ability ("a number of times equal to your Charisma modifier"). */
  freeAbility?: Ability;
}

/** A countable use of a feat. */
export interface FeatUseRule {
  /** Name of the benefit ("Luck Points", "Helpful Friend"); the feat name when it has none. */
  label: string;
  /** 'pb': equal to the Proficiency Bonus; an ability: its modifier (minimum 1). */
  max: 'pb' | Ability | number;
  rest: 'long' | 'short-or-long';
  /**
   * A pool several feats may give (Death Points of Death Knight Initiate and Ascension): all the
   * feats with the same pool share one counter, so it is never counted twice.
   */
  pool?: FeatPool;
}

export type FeatPool = 'death-points' | 'psionic-energy-dice';

/** UI text key of each pool's counter (es.ts / en.ts). */
export const FEAT_POOL_LABEL_KEY: Record<FeatPool, string> = {
  'death-points': 'play.res.deathPoints',
  'psionic-energy-dice': 'play.res.psionicEnergyDice',
};

export type SpellAbilityRule =
  | { mode: 'choice' }
  | { mode: 'fixed'; ability: Ability }
  | { mode: 'increased' }
  /** The class's spellcasting ability (the text doesn't say it: Boon of Magic School Mastery). */
  | { mode: 'class' }
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

export const slug = (name: string) =>
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

/** Spells a species trait lets you cast (see parseFeat): [, character level, names]. */
const TRAIT_CAST =
  /(?:(?:Starting at|When you reach) (\d+)(?:st|nd|rd|th) level, )?[Yy]ou can (?:also )?cast (?:the )?((?:[A-Z][\w'’/-]*)(?: (?:[A-Z][\w'’/-]*|or|and|of|without|from))*?)(?: spells?)?(?: on yourself)?(?: with (?:this trait|it)\b| once, and it recharges after a long rest)/g;

const plain = (s: string) => s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();

const cache = new WeakMap<RuleText, FeatRules>();

/** What the text of a feat gives. Memoised per feat object. */
export function featRules(feat: RuleText): FeatRules {
  const hit = cache.get(feat);
  if (hit) return hit;
  const rules = parseFeat(feat);
  cache.set(feat, rules);
  return rules;
}

function parseFeat(feat: RuleText): FeatRules {
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
  const paragraphs = joinBroken(text)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('|') && !p.startsWith('#'));

  // the rest that gives back the uses, wherever the text says it ("You regain all expended uses...")
  const regainRest = restIn(plain(text).match(/regain all expended uses[^.]*\./i)?.[0] ?? '');

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
    for (const m of p.matchAll(
      /You (?:also )?(?:learn|know) the ([A-Z][\w' ’-]+?) (cantrip|spell)\b/g,
    ))
      grants.push({ name: m[1], cantrip: m[2] === 'cantrip' ? true : null, minLevel: 1 });
    // "You can cast Mage Armor on yourself without expending a spell slot" (Eldritch Invocations)
    for (const m of p.matchAll(
      /[Yy]ou can (?:also )?cast ([A-Z][\w'’ /-]+?)(?: on yourself)?(?: once)? without (?:expending )?a spell slot/g,
    ))
      grants.push({ name: m[1], cantrip: null, minLevel: 1 });
    // "You always have the Find Familiar spell prepared" / "the A and B spells prepared"
    for (const m of p.matchAll(
      /(When you reach character level (\d+), you also )?always have (?:the|that spell and the) (.+?) spells? prepared/gi,
    ))
      for (const n of splitNames(m[3]))
        grants.push({ name: n, cantrip: false, minLevel: m[2] ? Number(m[2]) : 1 });
    const namedMod =
      /a number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i.exec(
        p,
      );
    const named = namedMod ? (namedMod[1].slice(0, 3).toUpperCase() as Ability) : undefined;
    // species of the 2014 books: "Starting at 3rd level, you can cast the Gust of Wind spell with
    // this trait", "you can also cast the Misty Step spell with it", "You can cast the Detect Magic
    // and Disguise Self spells with this trait"; Half-Elf's Drow Magic: "When you reach 3rd level,
    // you can cast Faerie Fire once, and it recharges after a long rest"
    let traitCasts = false;
    for (const m of p.matchAll(TRAIT_CAST)) {
      traitCasts = true;
      for (const n of splitNames(m[2]))
        grants.push({ name: n, cantrip: false, minLevel: m[1] ? Number(m[1]) : 1 });
    }
    const traitFree =
      traitCasts &&
      /\bonce\b/i.test(p) &&
      /until you finish a long rest|recharges after a long rest/i.test(p);
    for (const g of grants) {
      if (out.spells.some((s) => s.id === slug(g.name))) continue;
      const isCantrip = g.cantrip === true;
      // "can cast it as a Magic action without expending a spell slot" with no rest: at will
      const atWill = casts && !/Long Rest|Short Rest|number of times|\bonce\b|\btwice\b/i.test(p);
      out.spells.push({
        name: g.name,
        id: slug(g.name),
        minLevel: g.minLevel,
        cantrip: g.cantrip === false ? false : g.cantrip,
        // the free cast is for the spells ("always have ... prepared"), not for cantrips
        free: (free || traitFree) && !isCantrip,
        atWill: atWill && !isCantrip,
        slots: !isCantrip && slots,
        freeUses: /a number of times equal to your (?:spellcasting ability|\w+) modifier/i.test(p)
          ? 'mod'
          : /a number of times equal to your Proficiency Bonus/i.test(p)
            ? 'pb'
            : 1,
        ...(named ? { freeAbility: named } : {}),
      });
    }

    // -- spellcasting ability ------------------------------------------------------------
    if (
      /Intelligence, Wisdom, or Charisma is your spellcasting ability|your spellcasting ability for this spell is your choice of Intelligence, Wisdom, or Charisma/i.test(
        p,
      )
    )
      out.ability = { mode: 'choice' };
    else if (/ability increased by this feat/i.test(p) && /spellcasting ability/i.test(p))
      out.ability = { mode: 'increased' };
    else if (out.ability.mode === 'none') {
      const fixed = /(Intelligence|Wisdom|Charisma) is your spellcasting ability/i.exec(p);
      if (fixed)
        out.ability = { mode: 'fixed', ability: fixed[1].slice(0, 3).toUpperCase() as Ability };
    }

    // -- uses per rest -----------------------------------------------------------------
    // (a paragraph that gives spells counts its free casts as spell uses, not as a second counter)
    const casting = casts || traitCasts;
    if (!(casting && !/Bonus Action/i.test(p)) || (/number of times/i.test(p) && !grants.length)) {
      const rest = /Short (?:or|rest or) Long Rest/i.test(p)
        ? 'short-or-long'
        : /Long Rest/i.test(p)
          ? 'long'
          : null;
      const label = heading && heading !== 'Cantrip' ? heading : feat.name;
      const count =
        /(?:a (?:total )?number of times(?: per day)?|Luck Points) equal to your (?:Proficiency Bonus|(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier)/i.exec(
          p,
        );
      // the formula and the rest may be in different sentences: "You can use this feature a number
      // of times equal to your Constitution modifier (minimum of once)." + "You regain all expended
      // uses when you finish a Long Rest."
      const countRest = restIn(p) ?? regainRest;
      const onceRest = ONCE_USE.exec(p)?.[0] ? restIn(ONCE_USE.exec(p)![0]) : null;
      if (countRest && count && (/regain|recover/i.test(p) || regainRest)) {
        add(out.uses, {
          label,
          max: count[1] ? (count[1].slice(0, 3).toUpperCase() as Ability) : 'pb',
          rest: countRest,
        });
      } else if (!casting && onceRest) {
        // "Once you use this benefit, you can't use it again until you roll Initiative or finish a
        // Long or Short rest": one use, back on the rest (the Initiative is not counted)
        add(out.uses, { label, max: 1, rest: onceRest });
      } else if (
        rest &&
        !casting &&
        // a count that grows with the level ("twice between rests starting at 15th level", "Starting
        // at level 17, you can use it twice") is not one use: it stays as text
        !/\b(?:once|twice|three times|four times|five times|\d+ times)\b[^.]*\b(?:starting at|between rests)\b|\bstarting at\b[^.]*\buses?\b/i.test(
          p,
        ) &&
        // 2014 wording: "Once you use this trait, you can't use it again until you finish a short
        // or long rest"; "You can't use this feature again until you finish a long rest"; "Once you
        // use this feature, you must finish a short or long rest before you can use it again"
        /(?:you can(?:'|’)t|you cannot) (?!cast\b)[^.]*?again until (?:you )?(?:finish|complete) a (?:Short (?:or|rest or) Long|Long|Short) Rest|must finish a (?:Short (?:or|rest or) Long|Long|Short) Rest before/i.test(
          p,
        )
      ) {
        add(out.uses, { label, max: 1, rest });
      } else if (rest && !casting && /regain|recover/i.test(p)) {
        // "You can use this feature three times" (2014 Fighting Spirit, Steady Aim): a fixed count.
        // A count that changes with the level ("twice between rests starting at 15th level") is
        // not read: its sentence is left out
        // ("At 15th level, you can invoke each rune ... twice, rather than once": a level, not a count)
        const sentence = p
          .split(/(?<=[.!?])\s+/)
          .find((s) =>
            /you can (?:use|make|invoke) [^.]{0,60}?\b(?:once|twice|three times|four times|five times)\b/i.test(
              s,
            ),
          );
        const times =
          sentence &&
          /you can (?:use|make|invoke) [^.]{0,60}?\b(once|twice|three times|four times|five times)\b/i.exec(
            sentence,
          );
        if (times && !/starting at|\blevel\b|rather than/i.test(sentence!))
          add(out.uses, {
            label,
            max: { once: 1, twice: 2, 'three times': 3, 'four times': 4, 'five times': 5 }[
              times[1].toLowerCase()
            ] as number,
            rest,
          });
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

  // -- a pool of points or dice --------------------------------------------------------------
  // "You have a number of Death Points equal to your Proficiency Bonus. You regain all expended
  // Death Points when you finish a Long Rest." (the sentences may sit in different paragraphs)
  const whole = plain(joinBroken(text));
  const pool =
    /a number of (Death Points|Psionic Energy Dice) equal to your Proficiency Bonus/i.exec(whole);
  if (
    pool &&
    new RegExp(`regain all expended ${pool[1]} when you finish a Long Rest`, 'i').test(whole)
  ) {
    const id: FeatPool = /death/i.test(pool[1]) ? 'death-points' : 'psionic-energy-dice';
    add(out.uses, { label: pool[1], max: 'pb', rest: 'long', pool: id });
  }
  return out;
}

/** "Once you use this benefit, you can't (use it / do so) again until ..." (the rest is read after it). */
const ONCE_USE =
  /(?:Once you|After you) [^.]*?, you can(?:'|’)t [^.]*?again until you (?:roll Initiative or )?finish an? (?:Short or Long|Long or Short|Long|Short) Rest/i;

/** The rest a text names: "Long Rest", or "Short or Long Rest" (either order) when both count. */
function restIn(s: string): 'short-or-long' | 'long' | null {
  if (/Short or Long Rest|Long or Short Rest/i.test(s)) return 'short-or-long';
  if (/Long Rest/i.test(s)) return 'long';
  return null;
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
  /** Spell lists of the character's casting classes ("a spell on your class's spell list"). */
  classLists?: boolean;
  schools?: string[];
  /** The school the player picked for the feat (Boon of Magic School Mastery). */
  schoolOfChoice?: boolean;
  /** Also any spell of the feat's own table (Boon of Siberys' Siberys Dragonmark Spells). */
  table?: boolean;
  /**
   * How it can be cast without a spell slot: 'at-will' (the text states no limit), or once per
   * 'long' or 'short-or-long' rest. Absent: the feat's text decides (Magic Initiate...).
   */
  slotless?: 'at-will' | 'long' | 'short-or-long';
}

/** What a feat asks the player to choose besides the spellcasting ability (feat-effects text). */
export interface FeatPicks {
  /** Spell list to choose among (Magic Initiate). */
  list?: string[];
  /** The school to choose one of (Boon of Magic School Mastery). */
  school?: string[];
  cantrips?: PickRule;
  /** A leveled spell: exactly `level`, or `maxLevel` or lower. */
  spell?: PickRule & { level?: number; maxLevel?: number };
  /** A second spell, of `maxLevel` or lower (Boon of Magic School Mastery's Signature Arcanum). */
  signature?: PickRule & { level?: number; maxLevel?: number };
  /** The spellcasting ability is the class's: nothing for the player to choose. */
  castingAbility?: boolean;
  /** Skills and tools, any mix (Skilled). */
  skillsOrTools?: number;
  /**
   * `from`: the feat's text names a closed set of options ("Insight, Performance, or Persuasion")
   * to pick `count` of. `upgrade`: the pick isn't a plain proficiency — it's Expertise when the
   * character already has proficiency in the chosen skill (Keen Mind's Lore Knowledge, Observant's
   * Keen Observer); engine.ts resolves that against the skills already granted elsewhere.
   */
  skills?: { count: number; from?: string[]; upgrade?: boolean };
  /** Tools of one kind: "Artisan's Tools" / "Musical Instrument". */
  tools?: { count: number; group: string };
  /** A language of the player's choice; the feat gives this one unless already known. */
  language?: string;
  /**
   * Damage types the player resists: `from` is the closed list, `count` how many to pick. The
   * table's entries, or the text's own (resistancePickOf: Boon of Energy Resistance, Planar Wanderer).
   */
  resistance?: { from: string[]; count: number };
}

/** What the data's text can't tell: who picks what. Keyed by feat id. */
export const FEAT_PICKS: Record<string, FeatPicks> = {
  'magic-initiate': {
    list: MAGIC_INITIATE_LISTS,
    cantrips: { count: 2 },
    spell: { count: 1, level: 1 },
  },
  // "Rote Casting: a level 1 spell of the chosen school on your class's list, always prepared,
  // cast without a spell slot or components" (no limit stated: at will). "Signature Arcanum: a
  // level 7 or lower spell of the chosen school, cast once without a slot per Long Rest".
  'boon-of-magic-school-mastery': {
    school: SCHOOLS,
    spell: { count: 1, level: 1, classLists: true, schoolOfChoice: true, slotless: 'at-will' },
    signature: { count: 1, maxLevel: 7, schoolOfChoice: true, slotless: 'long' },
    castingAbility: true,
  },
  // "Aberrant Magic: a level 8 or lower Sorcerer spell, or a spell of the Siberys Dragonmark
  // Spells table; cast once without a slot per Short or Long Rest"
  'boon-of-siberys': {
    spell: { count: 1, maxLevel: 8, lists: ['sorcerer'], table: true, slotless: 'short-or-long' },
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
  // "You gain proficiency in the Acrobatics or Athletics skill (your choice)": one of the two,
  // not both and not neither.
  'squat-nimbleness': { skills: { count: 1, from: ['acrobatics', 'athletics'] } },
  'outsized-might-ua': { skills: { count: 1, from: ['athletics', 'acrobatics'] } },
  // "Choose one of the following skills... If you lack proficiency... you gain proficiency in it,
  // and if you already have proficiency in it, you gain Expertise in it."
  'keen-mind': {
    skills: {
      count: 1,
      from: ['arcana', 'history', 'investigation', 'nature', 'religion'],
      upgrade: true,
    },
  },
  observant: {
    skills: { count: 1, from: ['insight', 'investigation', 'perception'], upgrade: true },
  },
  'cult-of-the-dragon-initiate': { language: 'Draconic' },
  'portal-jumper': { resistance: { from: ['Necrotic', 'Psychic', 'Radiant'], count: 1 } },
  dragonscarred: {
    resistance: { from: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'], count: 1 },
  },
  'spell-resistant': {
    resistance: { from: ['Necrotic', 'Psychic', 'Radiant', 'Thunder'], count: 1 },
  },
};

export function featPicks(feat: Feat): FeatPicks {
  const fromText = resistancePickOf(feat.description);
  return { ...(fromText ? { resistance: fromText } : {}), ...(FEAT_PICKS[feat.id] ?? {}) };
}

const CHOICE_WORDS: Record<string, number> = { one: 1, two: 2 };

/** "Acid, Cold, Fire, or Poison" -> ['Acid', 'Cold', 'Fire', 'Poison'] (the names as the data writes them). */
function damageNames(raw: string): string[] {
  return raw
    .split(/,\s*(?:or\s+)?|\s+or\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * The damage types the text itself lets the player pick, when it says so: "Resistance to two of
 * the following damage types of your choice: Acid, ..., or Thunder" (Boon of Energy Resistance) or
 * "resistance to either acid, cold or fire damage (your choice)" (Planar Wanderer). Null otherwise.
 */
export function resistancePickOf(
  text: string | null | undefined,
): { from: string[]; count: number } | null {
  const p = plain(text ?? '');
  const closed =
    /Resistance to (one|two) of the following damage types of your choice:\s*([^.]+)\./i.exec(p);
  if (closed) return { from: damageNames(closed[2]), count: CHOICE_WORDS[closed[1].toLowerCase()] };
  const either = /resistance to either ([a-z ,]+?) damage \(your choice\)/i.exec(p);
  if (either) return { from: damageNames(either[1]), count: 1 };
  return null;
}

/** Whether the text lets the player change the pick at every Long Rest ("Whenever you finish a Long Rest..."). */
export function resistanceChangesOnRest(text: string | null | undefined): boolean {
  return /\b(?:Whenever|When) you finish a long rest\b/i.test(plain(text ?? ''));
}

/**
 * The damage types a resistance pick holds: the ones stored (`resistances`, and the single
 * `resistance` of the older feats), valid for the pick, no more than it asks for.
 */
export function pickedResistances(
  choice: { resistance?: string; resistances?: string[] },
  rule: { from: string[]; count: number },
): string[] {
  const stored = [...(choice.resistances ?? []), ...(choice.resistance ? [choice.resistance] : [])];
  return [...new Set(stored)].filter((v) => rule.from.includes(v)).slice(0, rule.count);
}

/** Key of a feat's damage-type pick in the rest dialog (`state.restChoices`), by feat source. */
const FEAT_RESIST = 'feat-resist:';
export const featResistKey = (srcKey: string): string => FEAT_RESIST + srcKey;
/** The feat source key behind a `featResistKey`, or null for any other (trait) key. */
export function featResistSource(key: string): string | null {
  return key.startsWith(FEAT_RESIST) ? key.slice(FEAT_RESIST.length) : null;
}

/** Who chooses the spellcasting ability: the text says it, or (Magic Initiate) the picks imply it. */
export function abilityRule(feat: Feat): SpellAbilityRule {
  const rules = featRules(feat);
  if (rules.ability.mode !== 'none') return rules.ability;
  const p = featPicks(feat);
  if (p.castingAbility) return { mode: 'class' };
  return p.list || p.cantrips || p.spell ? { mode: 'choice' } : rules.ability;
}

/**
 * The lines of a feat's table ("| Animal Shapes | Handling |") that follow `heading` in its text.
 * Boon of Siberys: its twelve spells are read from the text, not typed in.
 */
export function tableSpellNames(text: string, heading: string): string[] {
  const at = text.indexOf(heading);
  if (at < 0) return [];
  return text
    .slice(at + heading.length)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|')[1]?.trim() ?? '')
    .filter((n) => n && n !== 'Spell' && !/^-+$/.test(n));
}

/** The spell ids of the Siberys Dragonmark Spells table (the text of Boon of Siberys). */
export function siberysSpellIds(feat: RuleText): string[] {
  // the bold heading: the same words also appear in the Aberrant Magic sentence above it
  return tableSpellNames(feat.description ?? '', '**Siberys Dragonmark Spells**').map(slug);
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

/** Adds or removes `id` from a pick list of at most `max`; adding past the maximum changes nothing. */
export function togglePick(
  current: readonly string[],
  id: string,
  on: boolean,
  max: number,
): string[] {
  if (!on) return current.filter((x) => x !== id);
  if (current.includes(id) || current.length >= max) return [...current];
  return [...current, id];
}

export interface SpellLike {
  id: string;
  level: number;
  school: string;
  classes: string[];
}

/** What a pick is made among, besides the rule (the player's choices for the feat). */
export interface PickContext {
  /** Spell list picked for the feat (Magic Initiate). */
  list?: string | null;
  /** School picked for the feat (Boon of Magic School Mastery). */
  school?: string | null;
  /** Spell lists of the character's casting classes. */
  casterLists?: readonly string[];
  /** Spell ids of the feat's own table (Boon of Siberys). */
  table?: readonly string[];
}

/**
 * The spells a pick can be made from. `list` is the list picked for the feat (Magic Initiate);
 * `ctx` holds the other choices the rule may depend on. A table spell is always a candidate.
 */
export function pickable(
  spells: readonly SpellLike[],
  rule: PickRule & { level?: number; maxLevel?: number },
  list: string | null,
  ctx: PickContext = {},
): SpellLike[] {
  const lists =
    rule.lists ?? (rule.classLists ? [...(ctx.casterLists ?? [])] : list ? [list] : null);
  const schools = rule.schools ?? (rule.schoolOfChoice ? (ctx.school ? [ctx.school] : []) : null);
  const table = rule.table ? new Set(ctx.table ?? []) : null;
  const level = (s: SpellLike) =>
    rule.maxLevel !== undefined ? s.level <= rule.maxLevel : s.level === (rule.level ?? 0);
  return spells.filter(
    (s) =>
      table?.has(s.id) ||
      (level(s) &&
        (!lists || lists.some((l) => s.classes.includes(l))) &&
        (!schools || schools.includes(s.school.toLowerCase()))),
  );
}
