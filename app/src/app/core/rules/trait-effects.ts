import { Ability } from '../models/compendium';

/**
 * What the text of a trait, feature, option or feat gives besides spells and uses (those are in
 * feat-effects.ts): senses, extra speeds, fixed skill proficiencies, initiative, a base Armor
 * Class without armor, Hit Points that grow with the level, resistances and the bonuses of the
 * fighting styles. Pure: only unconditional statements are read ("You have Darkvision with a range
 * of 60 feet"), never the ones that need a Bonus Action, a Rage, a transformation or a condition.
 */

export type SenseKind = 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight' | 'devils-sight';
export type SpeedKind = 'fly' | 'swim' | 'climb' | 'burrow';

export interface TraitRules {
  senses: { kind: SenseKind; range: number }[];
  /** "If you already have Darkvision, its range increases by 60 feet" (else its own Darkvision). */
  darkvisionPlus: number;
  /** Extra movement: a number of feet, or 'speed' = "equal to your Speed". */
  speeds: { kind: SpeedKind; value: number | 'speed' }[];
  /** Walking speed set to this ("Your Speed increases to 35 feet"). */
  speedTo: number;
  /** Walking speed bonus that is lost in armor ("... while you aren't wearing Heavy armor"). */
  armorSpeed: { amount: number; unless: 'heavy' | 'armor' }[];
  /** Skill ids the text gives (no choice). */
  skills: string[];
  /**
   * Expertise in a skill the trait gives: 'always' ("proficiency in the Perception skill, if you lack
   * it. You also gain Expertise in that skill"), or 'ifProficient' ("you gain Proficiency in
   * Acrobatics. If you already have Proficiency in Acrobatics, you gain Expertise in it instead").
   */
  expertise: { skill: string; mode: 'always' | 'ifProficient' }[];
  /** "You learn to speak, read, and write Sylvan", "You learn Druidic": a language, no choice. */
  languages: string[];
  /** Known tools the text gives. */
  tools: string[];
  initiative: { pb: boolean; abilities: Ability[] };
  /** "While you aren't wearing armor, your base Armor Class equals 10 plus your DEX and CHA". */
  unarmored: { base: number; abilities: Ability[]; shield: boolean }[];
  /** Hit Point maximum: base once, then per level of the class (or character) that grants it. */
  hpGrowth: { base: number; per: number } | null;
  /** Damage types it resists without any condition. */
  resistances: string[];
  /** Fighting style bonuses. */
  attack: { ranged: number; duelingDamage: number; thrownDamage: number };
  /** Armor training and weapon proficiencies the text gives ("Heavy armor", "Martial weapons"). */
  armor: string[];
  weapons: string[];
  /** Saving throw proficiencies ("proficiency in Wisdom and Charisma saving throws"). */
  saves: Ability[];
  /** Damage types and conditions it is immune to ("Immunity to the Charmed condition"). */
  immunities: string[];
  conditionImmunities: string[];
  /** "Your Strength and Constitution scores increase by 4, to a maximum of 25" (capstones). */
  abilityBonus: { abilities: Ability[]; amount: number; max: number }[];
  /** Walking speed bonus with no condition ("Your Speed increases by 10 feet."). */
  speed: number;
  /** "+1 bonus to AC while wearing heavy armor" / "You gain a +1 bonus to your Armor Class". */
  ac: { amount: number; heavy: boolean }[];
  /**
   * "a bonus to saving throws equal to your Charisma modifier (minimum bonus of +1)" (Aura of
   * Protection: every save); "a bonus to Strength, Dexterity, and Constitution saving throws equal
   * to your Hemocraft modifier (minimum of +1)" (Dark Augmentation: only those, with the class's
   * own modifier: 'key', class-ability.ts).
   */
  saveBonus: { by: Ability | 'key'; only: Ability[] | null }[];
  /** "You know one extra cantrip from the Cleric spell list". */
  extraCantrips: { list: string; count: number }[];
  /** "a bonus to your Intelligence (Arcana or Religion) checks ... equals your Wisdom modifier". */
  skillBonus: { skills: string[]; ability: Ability }[];
}

const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

export const ABILITY_WORDS: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const SKILL_WORDS: Record<string, string> = {
  acrobatics: 'acrobatics',
  'animal handling': 'animal-handling',
  arcana: 'arcana',
  athletics: 'athletics',
  deception: 'deception',
  history: 'history',
  insight: 'insight',
  intimidation: 'intimidation',
  investigation: 'investigation',
  medicine: 'medicine',
  nature: 'nature',
  perception: 'perception',
  performance: 'performance',
  persuasion: 'persuasion',
  religion: 'religion',
  'sleight of hand': 'sleight-of-hand',
  stealth: 'stealth',
  survival: 'survival',
};

const KNOWN_TOOLS = [
  'Herbalism Kit',
  "Thieves' Tools",
  "Navigator's Tools",
  'Disguise Kit',
  "Poisoner's Kit",
  'Forgery Kit',
];

const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
];

/** "At 3rd level, " / "When you choose this domain at 1st level, " / "Starting at 7th level, ":
 * the level is already the feature's; what follows is what it gives. */
const LEVEL_LEAD =
  /^(?:(?:Also |Starting |Beginning )?at \d+(?:st|nd|rd|th)[ -]level|When you (?:choose|join|adopt) [^,]{0,60}? at \d+(?:st|nd|rd|th) level|When you reach \d+(?:st|nd|rd|th)[ -]level),\s*/i;

const plain = (s: string) => s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
const sentencesOf = (p: string) => p.split(/(?<=[.!?])\s+(?=[A-Z"'])/);

/** The intro of benefits that only hold in a state: a form, a duration, a Rage, an action. */
const STATE_INTRO =
  /\b(?:while|whenever|until|as long as|for (?:\d+|1|one) (?:minutes?|hours?|rounds?)|as an? (?:Bonus Action|Action|Magic action)|Rage|transform\w*|lasts?)\b/i;

/** What makes a paragraph of a situational feature hold only sometimes (engine.ts SITUATIONAL). */
const SITUATIONAL_PARAGRAPH = /\bRage\b|Wild Shape|Starry Form|transform/i;

/** The intro of a list of benefits that depend on something (a phase, a form, a choice). */
const INTRO = /\bdepend(?:s|ing)? on\b|\bbased on your\b|\bcurrent phase\b|\bthe effect lasting\b/i;

/** A sentence that only holds in a situation (an action, a duration, a condition, a transformation). */
const CONDITIONAL =
  /\b(?:while|when|whenever|until|if|as an? (?:Bonus Action|Action|Magic action|Reaction)|as long as|for (?:\d+|1) (?:minutes?|hours?|rounds?|turns?)|Rage|choose|of your choice|nonmagical|starting|after|once|each time|can use|can take|can expend|instead|in place|at the start|at the end|one of the following|temporar\w+)\b/i;

const damageTypesIn = (s: string) =>
  DAMAGE_TYPES.filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(s)).map(
    (t) => t[0].toUpperCase() + t.slice(1),
  );

const cache = new WeakMap<object, TraitRules>();

/** What the text of something gives (memoised per object). `situational`: skip resistances. */
export function traitRules(
  src: { name: string; description: string },
  opts: { situational?: boolean } = {},
): TraitRules {
  const hit = cache.get(src);
  if (hit) return hit;
  const rules = parseTrait(src.description ?? '', opts);
  cache.set(src, rules);
  return rules;
}

/** Same as traitRules for a bare text (not memoised). */
export function traitRulesOfText(
  text: string,
  opts: { situational?: boolean; inState?: boolean } = {},
): TraitRules {
  return parseTrait(text, opts);
}

const KIND_OF: Record<string, SpeedKind> = {
  fly: 'fly',
  flying: 'fly',
  swim: 'swim',
  swimming: 'swim',
  climb: 'climb',
  climbing: 'climb',
  burrow: 'burrow',
};

/** `inState`: the state the text describes is on (a form), so its benefits hold. */
function parseTrait(text: string, opts: { situational?: boolean; inState?: boolean }): TraitRules {
  const out: TraitRules = {
    senses: [],
    darkvisionPlus: 0,
    speeds: [],
    speedTo: 0,
    armorSpeed: [],
    skills: [],
    expertise: [],
    languages: [],
    tools: [],
    initiative: { pb: false, abilities: [] },
    unarmored: [],
    hpGrowth: null,
    resistances: [],
    attack: { ranged: 0, duelingDamage: 0, thrownDamage: 0 },
    armor: [],
    weapons: [],
    saves: [],
    immunities: [],
    conditionImmunities: [],
    abilityBonus: [],
    speed: 0,
    ac: [],
    saveBonus: [],
    extraCantrips: [],
    skillBonus: [],
  };
  const paragraphs = joinBroken(text)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('|') && !p.startsWith('#'));
  // "While your Wrath of the Sea is active, you gain the following benefits:" — the bullets and bold
  // benefits that follow only hold in that situation, even if each one reads unconditionally
  let underCondition = false;
  // bullets after an intro that asks for nothing ("...becomes more powerful:") all apply (Saint of
  // Forge and Fire); after one that asks to choose, or a bold benefit, they are options
  let listOfBenefits = false;
  // a feature only partly situational (Hungering Might: a save bonus, then a benefit "while you
  // are transformed"): only its paragraphs that name the situation, and the lists under them
  let situationalHere = false;
  for (const raw of paragraphs) {
    if (!/^[-•*]/.test(raw)) situationalHere = SITUATIONAL_PARAGRAPH.test(raw);
    const situational = !!opts.situational && situationalHere;
    // a bullet or a bold benefit of a list: one of several options, or part of a temporary form
    const option = /^[-•*]/.test(raw) && !(listOfBenefits && !underCondition);
    if (!/^[-•*]/.test(raw)) {
      underCondition = STATE_INTRO.test(plain(raw)) || INTRO.test(raw);
      // "...paid off in two ways:", "You gain the following benefits."
      listOfBenefits =
        (/:\s*$/.test(raw) || /\bthe following benefits\.?\s*$/i.test(raw)) &&
        !/\bchoose\b|\bof your choice\b|\bone of\b|\bfollowing options\b|\beither\b/i.test(raw);
    }
    const held = option && underCondition && !opts.inState;
    // Thaumaturge / Magician: "a bonus to your Intelligence (Arcana or Religion) checks. The bonus
    // equals your Wisdom modifier" (two sentences)
    if (!situational) {
      const check =
        /bonus to your (?:Intelligence|Wisdom|Charisma|Strength|Dexterity) \(([A-Z][a-z ]+?) or ([A-Z][a-z ]+?)\) checks\. The bonus equals your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i.exec(
          plain(raw),
        );
      if (check) {
        const skills = [check[1], check[2]]
          .map((w) => SKILL_WORDS[w.toLowerCase().trim()])
          .filter(Boolean);
        if (skills.length)
          out.skillBonus.push({ skills, ability: ABILITY_WORDS[check[3].toLowerCase()] });
      }
    }
    if (!situational && !held) readExpertise(out, plain(raw));
    for (const full of sentencesOf(plain(raw))) {
      const s = full
        .replace(/^[-•]\s+/, '')
        .replace(LEVEL_LEAD, '')
        .replace(/^\w/, (c) => c.toUpperCase());
      // in the state (inState) only a sentence's own conditions count, not the state's ("for 1
      // minute", "while it's active")
      const cond =
        held || (opts.inState ? CONDITIONAL.test(s) && !STATE_INTRO.test(s) : CONDITIONAL.test(s));
      readMore(out, s, cond, option && !opts.inState, situational);

      // -- initiative (the sentences are conditional: "When you roll Initiative, you can add ...")
      if (/add your proficiency bonus to your initiative/i.test(s)) out.initiative.pb = true;
      const ini =
        /(?:add your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifiers? to (?:the roll|your initiative)|bonus to your initiative rolls equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier)/i.exec(
          s,
        );
      if (ini) {
        const a = ABILITY_WORDS[(ini[1] ?? ini[2]).toLowerCase()];
        if (a && !out.initiative.abilities.includes(a)) out.initiative.abilities.push(a);
      }

      // -- walking speed that is lost in armor -------------------------------------------------
      const aSpeed =
        /Your speed increases by (\d+) feet while you (?:aren't|are not) wearing (heavy )?armor/i.exec(
          s,
        );
      if (aSpeed)
        out.armorSpeed.push({ amount: Number(aSpeed[1]), unless: aSpeed[2] ? 'heavy' : 'armor' });

      // -- hit points that grow with the level --------------------------------------------------
      const growth =
        /Hit Point maximum increases by (\d+),? and (?:it )?increases by (\d+)(?: again)? whenever you gain (?:a|another)(?: \w+)? level/i.exec(
          s,
        );
      if (growth) out.hpGrowth = { base: Number(growth[1]), per: Number(growth[2]) };

      // -- base Armor Class without armor ---------------------------------------------------------
      const ac =
        /base Armor Class (?:equals|is) (\d+)(?: plus |\s*\+\s*)your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?: and (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))? modifiers?/i.exec(
          s,
        );
      if (ac && !/within|\bwhile you are\b/i.test(s)) {
        out.unarmored.push({
          base: Number(ac[1]),
          abilities: [ac[2], ac[3]]
            .filter((w): w is string => !!w)
            .map((w) => ABILITY_WORDS[w.toLowerCase()]),
          shield: !/wielding a shield/i.test(s) && !/or wielding a shield/i.test(raw),
        });
      }

      // -- fighting styles --------------------------------------------------------------------------
      const ranged = /\+(\d+) bonus to attack rolls (?:you make )?(?:with|on) ranged/i.exec(s);
      if (ranged) out.attack.ranged += Number(ranged[1]);
      const dueling =
        /(?:holding|wielding) a Melee weapon in one hand and no other weapons, you gain a \+(\d+) bonus to damage rolls/i.exec(
          s,
        );
      if (dueling) out.attack.duelingDamage += Number(dueling[1]);
      const thrown = /Thrown property, you gain a \+(\d+) bonus to the damage roll/i.exec(s);
      if (thrown) out.attack.thrownDamage += Number(thrown[1]);

      // -- senses: "You have Darkvision with a range of 60 feet" ------------------------------------
      if (!cond && !situational) {
        const sense =
          /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:range|radius) of (\d+) feet/i.exec(
            s,
          );
        if (sense) addSense(out, sense[1].toLowerCase() as SenseKind, Number(sense[2]));
        const better = /range of your Darkvision increases to (\d+) feet/i.exec(s);
        if (better) addSense(out, 'darkvision', Number(better[1]));
      }

      const plus = /If you already have Darkvision[^.]*?, its range increases by (\d+) feet/i.exec(
        s,
      );
      if (plus && !situational) out.darkvisionPlus = Number(plus[1]);

      const devil = /see normally in (?:Dim Light and )?Darkness[^.]*?within (\d+) feet/i.exec(s);
      if (devil && !situational) addSense(out, 'devils-sight', Number(devil[1]));

      // -- speeds -----------------------------------------------------------------------------------
      if (!cond && !situational) {
        const equal = /equal to your (?:normal |walking |walk )?speed/i.test(s);
        if (equal && /\b(?:have|gain)\b/i.test(s)) {
          for (const m of s.matchAll(/\b(fly|flying|swim|swimming|climb|climbing|burrow)\b/gi))
            addSpeed(out, KIND_OF[m[1].toLowerCase()], 'speed');
        } else {
          for (const m of s.matchAll(/\b(flying|swimming|climbing) speed of (\d+) feet/gi))
            addSpeed(out, KIND_OF[m[1].toLowerCase()], Number(m[2]));
        }
        const to = /Your (?:base )?(?:walking )?Speed increases to (\d+) feet/i.exec(s);
        if (to) out.speedTo = Math.max(out.speedTo, Number(to[1]));
      } else {
        const to = /Your (?:base )?(?:walking )?Speed increases to (\d+) feet/i.exec(s);
        if (to && !/\b(?:while|when|if|until)\b/i.test(s)) out.speedTo = Number(to[1]);
      }

      // -- skills and tools given, with no choice -----------------------------------------------------
      if (!cond || /^You also gain|^You gain proficiency|^You have proficiency/i.test(s)) {
        if (!/\bor\b|of your choice|choose|another|one of|in place of/i.test(s)) {
          const prof =
            /\b(?:You|you) (?:also )?(?:have|gain|are) proficien(?:t|cy) (?:in|with) (?:the )?([A-Z][A-Za-z ]+?)(?: and (?:the )?([A-Z][A-Za-z ]+?))? skills?\b/.exec(
              s,
            );
          if (prof)
            for (const w of [prof[1], prof[2]]) {
              const id = w ? SKILL_WORDS[w.toLowerCase().trim()] : undefined;
              if (id && !out.skills.includes(id)) out.skills.push(id);
            }
          if (/proficiency with/i.test(s))
            for (const t of KNOWN_TOOLS)
              if (s.toLowerCase().includes(t.toLowerCase()) && !out.tools.includes(t))
                out.tools.push(t);
        }
      }

      // -- resistances: "You have Resistance to Necrotic and Radiant damage" ----------------------------
      // (an aura counts: the Paladin is always in it — Aura of Warding)
      if (
        !situational &&
        (!cond ||
          /^You and your allies have Resistance to [^.]+ while in your Aura of Protection/i.test(
            s,
          ) ||
          // Thought Shield: "You also have Resistance to Psychic damage, and whenever a creature
          // deals Psychic damage to you, ..." (the condition is the second clause's)
          (/^You (?:also )?have Resistance to [A-Za-z, ]+? damage, and (?:whenever|when)\b/i.test(
            s,
          ) &&
            !CONDITIONAL.test(s.split(/, and (?:whenever|when)\b/i)[0])))
      ) {
        const r =
          /\b(?:You|you)(?: and your allies)? (?:also )?(?:have|gain) Resistance to (.+?)(?: damage)?(?:,? and you\b|\.|$| while in your Aura)/i.exec(
            s,
          );
        if (r && !/\ball damage\b|\bany\b|\bone\b|\btwo\b/i.test(r[1])) {
          for (const t of damageTypesIn(r[1]))
            if (!out.resistances.includes(t)) out.resistances.push(t);
        }
      }
    }
  }
  return out;
}

/** What else a sentence gives (proficiencies, saves, immunities, numbers): see TraitRules. */
function readMore(
  out: TraitRules,
  s: string,
  cond: boolean,
  option: boolean,
  situational: boolean,
): void {
  if (situational || option) return;
  // -- armor and weapons: "you gain proficiency with Martial weapons and training with Heavy armor"
  // ("the disguise kit, the forgery kit, and one gaming set of your choice": the fixed ones; "if you
  // don't already have it" changes nothing)
  s = s
    .replace(/,? (?:and )?(?:one|two) [^,.]*? of your choice/gi, '')
    .replace(/ if you don(?:'|’)t already have (?:it|them)/gi, '');
  if (!/\bor\b|of your choice|choose|if you don't|these weapons|that don't/i.test(s)) {
    const self = /^(?:Trained for battle, )?(?:You|you) (?:also )?(?:gain|have)\b/.test(s);
    if (self || /^You gain training/i.test(s)) {
      for (const m of s.matchAll(/\b(?:proficiency|training) with ([^.;]+)/gi))
        for (const item of m[1].split(/,\s*(?:and\s+)?|\s+and\s+(?:training with\s+)?/)) {
          const w = item.trim().replace(/^the\s+/i, '');
          const armor = /^(light|medium|heavy)(?: armor)?$/i.exec(w);
          if (armor) addOnce(out.armor, `${cap(armor[1])} armor`);
          else if (/^shields?$/i.test(w)) addOnce(out.armor, 'Shields');
          else if (/^(simple|martial) weapons$/i.test(w))
            addOnce(out.weapons, `${cap(w.split(' ')[0])} weapons`);
          else if (/^scimitars?$/i.test(w)) addOnce(out.weapons, 'Scimitar');
          else if (/'s tools$|tools$|kit$|supplies$/i.test(w)) addOnce(out.tools, titleCase(w));
        }
    }
  }
  // -- languages: "You learn to speak, read, and write Sylvan.", "You learn Druidic and one cantrip"
  const lang =
    /^You (?:also )?learn to speak, read, and write ([A-Z][a-z]+)\.?$/.exec(s) ??
    /^You (?:also )?learn (Druidic|Thieves' Cant)\b/.exec(s);
  if (lang && !cond) addOnce(out.languages, lang[1]);
  // -- saving throws: "you gain proficiency in Wisdom and Charisma saving throws" -----------------
  if (!/\bif\b|\binstead\b|\bor\b|possession/i.test(s)) {
    const save =
      /\bproficiency in (all|[A-Z][a-z]+(?:,? (?:and )?[A-Z][a-z]+)*) saving throws/i.exec(s);
    if (save) {
      const words = /^all$/i.test(save[1])
        ? Object.keys(ABILITY_WORDS)
        : save[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map((w) => w.trim().toLowerCase());
      for (const w of words) if (ABILITY_WORDS[w]) addOnce(out.saves, ABILITY_WORDS[w]);
    }
  }
  // -- immunities: "You have Immunity to the Charmed and Frightened conditions", "You are immune
  // to poison damage and the poisoned condition", "can't be poisoned". Only the character's own,
  // with no condition (an aura counts: the Paladin is always in it).
  const auraOnly = /\bwhile in your Aura of Protection\b/i.test(s);
  if ((!cond || auraOnly) && /^(?:You|you)\b(?: and your allies)?/.test(s)) {
    const imm = /\b(?:Immunity|immune) to ([^.;]+)/i.exec(s);
    if (imm && !/\bthis effect\b|\bbeing magically aged\b|\bthis feature\b/i.test(imm[1])) {
      // the list ends where another benefit starts ("..., and resistance to necrotic damage",
      // "..., and you have advantage on saving throws against being poisoned")
      const list = imm[1]
        .replace(/\bwhile in your Aura of Protection\b.*/i, '')
        .split(/,? and you\b|\bresistance\b|\badvantage\b/i)[0];
      if (/\bdisease\b/i.test(list)) addOnce(out.conditionImmunities, 'Disease');
      for (const t of damageTypesIn(list.replace(/\b(?:the )?\w+ condition(?:s)?\b/gi, ''))) {
        if (/damage/i.test(list)) addOnce(out.immunities, t);
      }
      for (const c of CONDITIONS)
        if (new RegExp(`\\b${c}\\b`, 'i').test(list) && /condition|exhaustion|disease/i.test(list))
          addOnce(out.conditionImmunities, cap(c));
    }
    if (/can(?:'|’)t be poisoned/i.test(s)) addOnce(out.conditionImmunities, 'Poisoned');
  }
  // "You gain advantage on death saving throws, immunity to the frightened condition, and
  // resistance to necrotic damage" (a list after "You gain")
  if (!cond && /^You gain\b/.test(s)) {
    const res = /\bresistance to ([a-z]+(?:,? (?:and )?[a-z]+)*) damage\b/i.exec(s);
    if (res && !/^You gain Resistance/i.test(s))
      for (const t of damageTypesIn(res[1])) addOnce(out.resistances, t);
    const imm = /\bimmunity to the ([a-z]+) condition\b/i.exec(s);
    if (imm && CONDITIONS.includes(imm[1].toLowerCase()))
      addOnce(out.conditionImmunities, cap(imm[1]));
  }
  // -- capstones: "Your Strength and Constitution scores increase by 4, to a maximum of 25" -------
  const inc =
    /^Your ([A-Z][a-z]+)(?: and ([A-Z][a-z]+))? scores? increases? by (\d+),? (?:to|up to) a maximum of (\d+)/.exec(
      s,
    );
  if (inc) {
    const abilities = [inc[1], inc[2]]
      .filter((w): w is string => !!w)
      .map((w) => ABILITY_WORDS[w.toLowerCase()])
      .filter(Boolean);
    if (abilities.length)
      out.abilityBonus.push({ abilities, amount: Number(inc[3]), max: Number(inc[4]) });
  }
  // -- walking speed with no condition: "Your Speed increases by 10 feet." -------------------------
  if (!cond) {
    const sp = /^Your (?:walking )?speed increases by (\d+) feet(?:\.|,? and\b|$)/i.exec(s);
    if (sp) out.speed += Number(sp[1]);
  }
  // -- Armor Class: "You gain a +1 bonus to your Armor Class", "+1 bonus to AC while wearing heavy
  // armor" (the armor is checked by the engine)
  const heavy = /\+(\d+) bonus to (?:your )?(?:AC|Armor Class) while wearing heavy armor/i.exec(s);
  if (heavy) out.ac.push({ amount: Number(heavy[1]), heavy: true });
  else if (!cond) {
    const ac = /^You gain a \+(\d+) bonus to your (?:AC|Armor Class)\.?$/i.exec(s);
    if (ac) out.ac.push({ amount: Number(ac[1]), heavy: false });
  }
  // -- Aura of Protection: "a bonus to saving throws equal to your Charisma modifier" ----------------
  const sb =
    /\bbonus to ((?:(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:,? (?:and )?)?)*)saving throws equal to your (\w+) modifier/i.exec(
      s,
    );
  if (sb) {
    const only = [...sb[1].matchAll(/\w+/g)]
      .map((w) => ABILITY_WORDS[w[0].toLowerCase()])
      .filter((a): a is Ability => !!a);
    const by = ABILITY_WORDS[sb[2].toLowerCase()] ?? 'key';
    if (!out.saveBonus.some((x) => x.by === by))
      out.saveBonus.push({ by, only: only.length ? only : null });
  }
  // -- Thaumaturge / Magician ------------------------------------------------------------------------
  const extra = /^You know (one|two) extra cantrips? from the (\w+) spell list/i.exec(s);
  if (extra)
    out.extraCantrips.push({
      list: extra[2].toLowerCase(),
      count: extra[1].toLowerCase() === 'two' ? 2 : 1,
    });
}

const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
const titleCase = (w: string) =>
  w.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/'S\b/g, "'s");

function addOnce<T>(list: T[], x: T): void {
  if (!list.includes(x)) list.push(x);
}

function addSense(out: TraitRules, kind: SenseKind, range: number): void {
  const have = out.senses.find((s) => s.kind === kind);
  if (have) have.range = Math.max(have.range, range);
  else out.senses.push({ kind, range });
}

function addSpeed(out: TraitRules, kind: SpeedKind | undefined, value: number | 'speed'): void {
  if (kind && !out.speeds.some((s) => s.kind === kind && s.value === value))
    out.speeds.push({ kind, value });
}

/** A line that breaks in the middle of a sentence ("... regain all  \nexpended uses") is one line. */
export function joinBroken(text: string): string {
  return text.replace(/([^.!?:*|)\]"\n])[ ]*\n(?=[a-z])/g, '$1 ');
}

/** Expertise a paragraph gives (TraitRules.expertise); the proficiency comes with it. */
function readExpertise(out: TraitRules, p: string): void {
  const upgrade =
    /\bgain proficiency in (?:the )?([A-Z][A-Za-z ]+?)(?: skill)?\. If you already have proficiency in (?:it|that skill|the \1 skill|\1), you gain Expertise in it instead/i.exec(
      p,
    );
  const also =
    /\bproficiency in the ([A-Z][A-Za-z ]+?) skill, if you lack it\. You also gain Expertise in that skill/i.exec(
      p,
    );
  // Survivalist: "proficiency in the Nature and Survival skills if you don't already have it. Your
  // proficiency bonus is doubled for any ability check you make that uses either of those
  // proficiencies"
  if (
    /proficiency bonus is doubled for any ability check you make that uses (?:either of those|that|this) proficienc/i.test(
      p,
    )
  ) {
    const both =
      /proficiency in (?:the )?([A-Z][A-Za-z ]+?)(?: and (?:the )?([A-Z][A-Za-z ]+?))? skills?\b/.exec(
        p,
      );
    for (const w of [both?.[1], both?.[2]]) {
      const skill = w ? SKILL_WORDS[w.toLowerCase().trim()] : undefined;
      if (skill && !out.expertise.some((x) => x.skill === skill))
        out.expertise.push({ skill, mode: 'always' });
    }
  }
  for (const [m, mode] of [
    [upgrade, 'ifProficient'],
    [also, 'always'],
  ] as const) {
    const skill = m ? SKILL_WORDS[m[1].toLowerCase().trim()] : undefined;
    if (skill && !out.expertise.some((x) => x.skill === skill)) out.expertise.push({ skill, mode });
  }
}
