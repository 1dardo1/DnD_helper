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
  /** Extra movement: a number of feet, or 'speed' = "equal to your Speed". */
  speeds: { kind: SpeedKind; value: number | 'speed' }[];
  /** Walking speed set to this ("Your Speed increases to 35 feet"). */
  speedTo: number;
  /** Walking speed bonus that is lost in armor ("... while you aren't wearing Heavy armor"). */
  armorSpeed: { amount: number; unless: 'heavy' | 'armor' }[];
  /** Skill ids the text gives (no choice). */
  skills: string[];
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

const ABILITY_WORDS: Record<string, Ability> = {
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

const plain = (s: string) => s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
const sentencesOf = (p: string) => p.split(/(?<=[.!?])\s+(?=[A-Z"'])/);

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
export function traitRulesOfText(text: string, opts: { situational?: boolean } = {}): TraitRules {
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

function parseTrait(text: string, opts: { situational?: boolean }): TraitRules {
  const out: TraitRules = {
    senses: [],
    speeds: [],
    speedTo: 0,
    armorSpeed: [],
    skills: [],
    tools: [],
    initiative: { pb: false, abilities: [] },
    unarmored: [],
    hpGrowth: null,
    resistances: [],
    attack: { ranged: 0, duelingDamage: 0, thrownDamage: 0 },
  };
  const paragraphs = joinBroken(text)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('|') && !p.startsWith('#'));
  for (const raw of paragraphs) {
    for (const s of sentencesOf(plain(raw))) {
      const cond = CONDITIONAL.test(s);

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
        /holding a Melee weapon in one hand and no other weapons, you gain a \+(\d+) bonus to damage rolls/i.exec(
          s,
        );
      if (dueling) out.attack.duelingDamage += Number(dueling[1]);
      const thrown = /Thrown property, you gain a \+(\d+) bonus to the damage roll/i.exec(s);
      if (thrown) out.attack.thrownDamage += Number(thrown[1]);

      // -- senses: "You have Darkvision with a range of 60 feet" ------------------------------------
      if (!cond && !opts.situational) {
        const sense =
          /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:range|radius) of (\d+) feet/i.exec(
            s,
          );
        if (sense) addSense(out, sense[1].toLowerCase() as SenseKind, Number(sense[2]));
        const better = /range of your Darkvision increases to (\d+) feet/i.exec(s);
        if (better) addSense(out, 'darkvision', Number(better[1]));
      }

      const devil = /see normally in (?:Dim Light and )?Darkness[^.]*?within (\d+) feet/i.exec(s);
      if (devil && !opts.situational) addSense(out, 'devils-sight', Number(devil[1]));

      // -- speeds -----------------------------------------------------------------------------------
      if (!cond && !opts.situational) {
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
      if (!opts.situational && !cond) {
        const r =
          /\b(?:You|you) (?:also )?(?:have|gain) Resistance to (.+?)(?: damage)?(?:,? and you\b|\.|$)/i.exec(
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
