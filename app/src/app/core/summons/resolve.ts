import { Ability, Monster, MonsterFeature } from '../models/compendium';
import { BlockRow, BlockSection, StatBlockTemplate, splitTags } from './stat-block';

/**
 * Turns a stat-block template (formulas as text) into a Monster the combat card understands, for
 * a chosen variant ("Air", "Skeletal"…) and the numbers of the caster: spell slot level,
 * proficiency bonus, spell attack and save DC, ability modifiers, class levels. Pure.
 */

export interface SummonContext {
  /** Spell level used in the stat block (the slot used); 0 for features. */
  slotLevel: number;
  pb: number;
  spellAttack: number;
  spellDc: number;
  mods: Record<Ability, number>;
  /** Modifier of the spellcasting ability. */
  spellMod: number;
  /** Lower-case class name → class level ("ranger": 5). */
  classLevels: Record<string, number>;
  totalLevel: number;
}

export interface Resolved {
  monster: Monster;
  /** Fields that could not be worked out ("ac", "hp"…): the template is not fully understood. */
  unresolved: string[];
}

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const DAMAGE_TYPES =
  'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';
const CONDITION_NAMES =
  'blinded|charmed|deafened|exhaustion|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious';

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

// -- variants ------------------------------------------------------------------------------

const phrase = (haystack: string, needle: string) =>
  new RegExp(
    `(^|[^a-z])${needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`,
  ).test(haystack.toLowerCase());

/**
 * Whether a condition written in a tag or parentheses ("Air only", "Fungus or Vine only",
 * "requires level 4+ spell") holds for the variant; null when the text is not a condition
 * ("natural armor", "hover").
 */
export function conditionHolds(
  cond: string,
  variant: string | null,
  variants: string[],
  level: number,
): boolean | null {
  const lower = cond.toLowerCase().trim();
  const req = /requires?\s+(?:a\s+)?(?:spell\s+)?level\s+(\d+)\+?/.exec(lower);
  if (req) return level >= +req[1];
  const only = /\bonly\b/.test(lower);
  const names = lower.replace(/\bonly\b/g, '');
  const hits = variants.filter((v) => phrase(names, v));
  if (!only && !hits.length) return null;
  if (!hits.length) return null;
  return variant === null ? true : hits.includes(variant);
}

/** Variant names written as "(X only)" in a template, in order of appearance. */
export function deriveVariants(t: StatBlockTemplate): string[] {
  const out: string[] = [];
  const add = (cond: string) => {
    if (!/\bonly\b/i.test(cond)) return;
    for (const raw of cond.replace(/\bonly\b/gi, '').split(/,|\band\b|\bor\b/i)) {
      const v = raw.trim();
      if (!v || /^requires?\b|^hover$/i.test(v)) continue;
      const name = v.replace(/\b\w/g, (c) => c.toUpperCase());
      if (!out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
    }
  };
  const fromText = (s: string) => {
    for (const m of s.matchAll(/\(([^()]*)\)/g)) m[1].split(/;\s*/).forEach(add);
    // "Climb 40 ft. Vine only"
    for (const m of s.matchAll(/(?:^|[;,.])\s*([A-Z][A-Za-z ]*? only)\s*(?=[;,]|$)/g)) add(m[1]);
  };
  [t.ac, t.hp, t.speed, t.vulnerabilities, t.resistances, t.immunities].forEach(fromText);
  for (const rows of Object.values(t.sections)) {
    for (const r of rows) r.tags.forEach(add);
  }
  return out;
}

// -- numbers -------------------------------------------------------------------------------

/** Splits at top level (not inside parentheses or brackets). */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let last = 0;
  const rx = new RegExp(sep.source, `${sep.flags.replace('g', '')}y`);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      rx.lastIndex = i;
      const m = rx.exec(s);
      if (m && m[0].length) {
        out.push(s.slice(last, i));
        i += m[0].length - 1;
        last = i + 1;
      }
    }
  }
  out.push(s.slice(last));
  return out.map((x) => x.trim()).filter(Boolean);
}

interface Scope {
  ctx: SummonContext;
  variant: string | null;
  variants: string[];
}

/** One term of a sum ("the spell's level", "10 for each spell level above 4"); null: unknown. */
function evalTerm(raw: string, sc: Scope): number | null {
  const { ctx } = sc;
  let body = raw.trim();
  for (const m of [...body.matchAll(/\(([^()]*)\)/g)]) {
    const inner = m[1].split(/;\s*/);
    if (inner.some((c) => conditionHolds(c, sc.variant, sc.variants, ctx.slotLevel) === false))
      return 0;
  }
  body = body
    .replace(/\s*\([^()]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)$/.exec(body))) return +m[1];
  if (
    (m =
      /^(\d+) (?:for each|per) (?:spell )?level(?: of the spell)? above (\d+)(?:st|nd|rd|th)?$/.exec(
        body,
      ))
  ) {
    return +m[1] * Math.max(0, ctx.slotLevel - +m[2]);
  }
  if ((m = /^(\d+) (?:for each|per) (?:spell )?level$/.exec(body))) return +m[1] * ctx.slotLevel;
  if (/^(?:the |this )?(?:spell'?s? level|level of the spell|spell level)$/.test(body))
    return ctx.slotLevel;
  if (/^half (?:the|this) spell'?s? level/.test(body)) return Math.floor(ctx.slotLevel / 2);
  if (/^(?:pb|your proficiency bonus)$/.test(body)) return ctx.pb;
  if (
    (m = /^your (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier$/.exec(
      body,
    ))
  )
    return ctx.mods[ABILITY_BY_NAME[m[1]]];
  if (/^your spellcasting ability modifier$/.test(body)) return ctx.spellMod;
  if ((m = /^(\w+) (?:times|×|x) your (\w+) level$/.exec(body))) {
    const n = NUMBER_WORDS[m[1]] ?? (/^\d+$/.test(m[1]) ? +m[1] : null);
    const lvl = ctx.classLevels[m[2]];
    return n !== null && lvl !== undefined ? n * lvl : null;
  }
  if ((m = /^your (\w+) level$/.exec(body))) {
    const lvl = m[1] === 'character' ? ctx.totalLevel : ctx.classLevels[m[1]];
    return lvl ?? null;
  }
  return null;
}

/** "20 (Air only) or 30 (Land and Water only) + 5 for each…" → "30 + 5 for each…". */
function pickAlternative(expr: string, sc: Scope): string {
  const alt = /^(\d+\s*\([^()]*\)(?:\s*(?:,|\bor\b)\s*\d+\s*\([^()]*\))+)\s*(.*)$/.exec(expr);
  if (!alt) return expr;
  for (const m of alt[1].matchAll(/(\d+)\s*\(([^()]*)\)/g)) {
    if (conditionHolds(m[2], sc.variant, sc.variants, sc.ctx.slotLevel) === true) {
      return `${m[1]} ${alt[2]}`.trim();
    }
  }
  return expr;
}

/** A sum of terms ("11 + the spell's level + 2 (Brute only)"); null when a term is unknown. */
export function evalSum(
  expr: string,
  ctx: SummonContext,
  variant: string | null,
  variants: string[],
) {
  const sc: Scope = { ctx, variant, variants };
  let total = 0;
  const text = pickAlternative(expr.trim().replace(/^HP\s+/i, ''), sc);
  const terms = splitTop(text, /\+|\s+plus\s+/i);
  if (!terms.length) return null;
  for (const term of terms) {
    const v = evalTerm(term, sc);
    if (v === null) return null;
    total += v;
  }
  return total;
}

// -- text ----------------------------------------------------------------------------------

const SYMBOL =
  "(?:(?:the|this) spell'?s? level|the level of the spell|your spell level|PB|your Proficiency Bonus|your (?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|spellcasting ability) modifier)";
const DIE = '\\d+d\\d+';
const TERM = `(?:${DIE}|\\d+|${SYMBOL})`;
const EXPR = `${TERM}(?:\\s*(?:\\+|plus)\\s*${TERM})*`;

/** Dice and flat part of a sum: "1d8 + 3 plus the spell's level" → { dice: ["1d8"], flat: 3 + L }. */
function foldSum(expr: string, ctx: SummonContext): { dice: string[]; flat: number } | null {
  const dice: string[] = [];
  let flat = 0;
  for (const term of expr.split(/\s*(?:\+|\bplus\b)\s*/i)) {
    if (new RegExp(`^${DIE}$`).test(term)) dice.push(term);
    else {
      const v = evalTerm(term, { ctx, variant: null, variants: [] });
      if (v === null) return null;
      flat += v;
    }
  }
  return { dice, flat };
}

function average(dice: string[], flat: number): number {
  let sum = flat;
  for (const d of dice) {
    const [n, s] = d.split('d').map(Number);
    sum += (n * (s + 1)) / 2;
  }
  return Math.floor(sum);
}

function sumText(dice: string[], flat: number): string {
  return [...dice, ...(flat ? [String(flat)] : [])].join(' + ');
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** Variant-dependent words: "Bludgeoning (Earth only), Cold (Water only), or Fire (Fire only)". */
function pickWords(text: string, variant: string | null, variants: string[], level: number) {
  const rx = /\b([A-Za-z]+)\s*\(([^()]*)\)(?:,\s*(?:or\s+)?|\s+or\s+)?/g;
  return text.replace(
    new RegExp(`(?:\\b[A-Za-z]+\\s*\\([^()]*\\)(?:,\\s*(?:or\\s+)?|\\s+or\\s+)?){2,}`, 'g'),
    (run) => {
      let chosen: string | null = null;
      let all = true;
      for (const m of run.matchAll(rx)) {
        const holds = conditionHolds(m[2], variant, variants, level);
        if (holds === null) all = false;
        if (holds === true && chosen === null) chosen = m[1];
      }
      return all && chosen ? `${chosen}${/[,\s]$/.test(run) ? ' ' : ''}` : run;
    },
  );
}

/** The text of a feature with every formula worked out for this caster. */
export function resolveText(
  text: string,
  ctx: SummonContext,
  variant: string | null,
  variants: string[],
): string {
  const L = ctx.slotLevel;
  let s = pickWords(text, variant, variants, L);

  // attack rolls: "Bonus equals your spell attack modifier" → "+7"
  s = s.replace(
    /\b(Melee or Ranged|Melee|Ranged)(?: Weapon| Spell)? Attack(?: Roll)?:\s*((?:Bonus equals )?[^,.]*?)(?: to hit)?\s*,/gi,
    (all, kind: string, expr: string) => {
      const note = /\s*(\([^()]*\))\s*$/.exec(expr);
      const e = expr
        .replace(/\s*\([^()]*\)\s*$/, '')
        .replace(/^Bonus equals /i, '')
        .replace(/\s+to hit$/i, '')
        .trim();
      let total = 0;
      for (const term of splitTop(e, /\+|\s+plus\s+/i)) {
        const t = term.trim();
        if (/^your spell attack modifier$/i.test(t)) total += ctx.spellAttack;
        else if (/^[+-]?\d+$/.test(t)) total += +t;
        else {
          const v = evalTerm(t, { ctx, variant, variants });
          if (v === null) return all;
          total += v;
        }
      }
      const k = kind.replace(/^\w/, (c) => c.toUpperCase());
      return `${k} Attack Roll: ${signed(total)}${note ? ` ${note[1]}` : ''},`;
    },
  );
  s = s.replace(/(ft|feet)\.?,\s*one (?:target|creature)[^.]*\./gi, '$1.');

  // saving throw DCs
  s = s
    .replace(/\bDC (?:equals? (?:to )?)?your spell save DC/gi, `DC ${ctx.spellDc}`)
    .replace(/(^|[^A-Za-z])Your spell save DC/g, `$1DC ${ctx.spellDc}`)
    .replace(/\byour spell save DC/gi, `DC ${ctx.spellDc}`);

  // "a Dexterity saving throw against your spell save DC" (older texts)
  s = s.replace(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw against DC (\d+)/gi,
    '$1 Saving Throw: DC $2',
  );

  // number of attacks: "a number of Rend attacks equal to half this spell's level (round down)"
  s = s.replace(
    /a number of (\w+ )?attacks equal to half (?:this|the) (?:spell'?s? level|level of the spell) \((?:round(?:ed)? down)\)/gi,
    (_, kind?: string) => {
      const n = Math.floor(L / 2);
      return `${n} ${kind ?? ''}attack${n === 1 ? '' : 's'}`;
    },
  );
  s = s.replace(
    /half (?:this|the) (?:spell'?s? level|level of the spell) \((?:round(?:ed)? down)\)/gi,
    String(Math.floor(L / 2)),
  );

  // damage with a type: "1d8 + 4 + the spell's level Piercing damage" → "13 (1d8 + 8) Piercing damage"
  s = s.replace(
    new RegExp(`(?<![\\w.])(${EXPR})(?:\\s+of)?(?=\\s+(?:${DAMAGE_TYPES})\\b)`, 'gi'),
    (all, expr: string) => {
      const f = foldSum(expr, ctx);
      if (!f || (!f.dice.length && !new RegExp(SYMBOL, 'i').test(expr))) return all;
      if (!f.dice.length) return String(f.flat);
      return `${average(f.dice, f.flat)} (${sumText(f.dice, f.flat)})`;
    },
  );
  // a list of types: "Bludgeoning, Piercing, or Slashing damage (Your choice…)" → the first
  s = s.replace(
    new RegExp(
      `\\b(${DAMAGE_TYPES})((?:,\\s*(?:or\\s+)?|\\s+or\\s+)(?:${DAMAGE_TYPES}))+\\s+damage(\\s*\\(([^)]*)\\))?`,
      'gi',
    ),
    (all, first: string, _x, _y, note?: string) => {
      const others = [...all.matchAll(new RegExp(`\\b(${DAMAGE_TYPES})\\b`, 'gi'))]
        .map((m) => m[1])
        .slice(1)
        .join(' / ');
      return `${first} damage (or ${others}; ${(note ?? 'your choice').toLowerCase()})`;
    },
  );
  // healing and other sums with a symbol: "2d8 plus the spell's level" → "2d8 + 5"
  s = s.replace(new RegExp(`(?<![\\w.])(${EXPR})`, 'g'), (all, expr: string) => {
    if (!new RegExp(DIE).test(expr) || !new RegExp(SYMBOL, 'i').test(expr)) return all;
    const f = foldSum(expr, ctx);
    return f ? sumText(f.dice, f.flat) : all;
  });

  // what is left of the spell's level and the proficiency bonus
  s = s
    .replace(
      /\b(?:the|this) spell'?s? level\b|\bthe level of the spell\b|\bthe spell level\b/gi,
      String(L),
    )
    .replace(/\byour Proficiency Bonus\b/g, `your Proficiency Bonus (+${ctx.pb})`);
  return s;
}

// -- the creature --------------------------------------------------------------------------

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function parseTypeLine(typeLine: string, variant: string | null) {
  let line = typeLine.trim();
  let alignment = 'unaligned';
  const al = /[,;]\s*([^,;]*)$/.exec(line);
  if (al && /unaligned|neutral|lawful|chaotic|good|evil|alignment/i.test(al[1])) {
    alignment = al[1].trim().toLowerCase();
    line = line.slice(0, al.index);
  }
  let size = 'Medium';
  const sz = new RegExp(`^(${SIZES.join('|')})(?:\\s+or\\s+(?:smaller|larger))?\\s*`, 'i').exec(
    line,
  );
  if (sz) {
    size = sz[1].replace(/^\w/, (c) => c.toUpperCase());
    line = line.slice(sz[0].length);
    const fromVariant =
      variant && SIZES.find((z) => variant.toLowerCase().startsWith(z.toLowerCase()));
    if (fromVariant && /or\s+(smaller|larger)/i.test(sz[0])) size = fromVariant;
  }
  const words = line
    .replace(/\([^()]*\)/g, '')
    .split(/,|\bor\b/i)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const type =
    (variant && words.find((w) => w === variant.toLowerCase())) || words[0] || 'construct';
  return { size, type, alignment };
}

function parseSpeed(text: string, sc: Scope): Monster['speed'] {
  const speed: Monster['speed'] = { walk: 0 };
  type Kind = 'walk' | 'fly' | 'swim' | 'climb' | 'burrow';
  let last: Kind | null = null;
  let lastCounted = false;
  for (const piece of splitTop(text.replace(/\bft\b(?!\.)/g, 'ft.'), /[;,]/)) {
    const conds: string[] = [];
    const bare = piece
      .replace(/\(([^()]*)\)/g, (_, c: string) => {
        conds.push(...c.split(/;\s*/));
        return '';
      })
      .trim();
    const m = /^(?:(walk|climb|fly|swim|burrow)\s+)?(\d+)\s*ft\.?\s*(.*)$/i.exec(bare);
    const holds = (c: string) =>
      conditionHolds(c, sc.variant, sc.variants, sc.ctx.slotLevel) !== false;
    if (m) {
      const kind: Kind = (m[1]?.toLowerCase() ?? 'walk') as Kind;
      const extra = m[3] ? [m[3]] : [];
      const ok = [...conds, ...extra].every(holds);
      last = kind;
      lastCounted = ok;
      if (ok) {
        speed[kind] = +m[2];
        if (kind === 'fly' && [...conds, ...extra].some((c) => /hover/i.test(c)))
          speed.hover = true;
      }
    } else if (last && lastCounted && !conds.concat(bare).every(holds)) {
      // "Flyer only" after the movement it limits
      if (last !== 'walk') delete speed[last];
      if (last === 'fly') delete speed.hover;
      lastCounted = false;
    }
  }
  return speed;
}

function parseDefences(text: string, sc: Scope) {
  const damage: string[] = [];
  const conditions: string[] = [];
  const cleaned = text.replace(/^Immunities\s+/i, '');
  for (const piece of splitTop(cleaned, /[;,]/)) {
    const conds: string[] = [];
    const names = piece
      .replace(/\(([^()]*)\)/g, (_, c: string) => {
        conds.push(...c.split(/;\s*/));
        return '';
      })
      .trim();
    if (conds.some((c) => conditionHolds(c, sc.variant, sc.variants, sc.ctx.slotLevel) === false))
      continue;
    for (const n of names.split(/\band\b|\bor\b/i).map((x) => x.trim().toLowerCase())) {
      if (new RegExp(`^(?:${DAMAGE_TYPES})$`).test(n)) damage.push(n);
      else if (new RegExp(`^(?:${CONDITION_NAMES})$`).test(n)) conditions.push(n);
    }
  }
  return { damage, conditions };
}

function noteOf(tags: string[], variants: string[], variant: string | null, level: number) {
  const notes: string[] = [];
  for (const t of tags) {
    const holds = conditionHolds(t, variant, variants, level);
    if (holds === false) return null;
    if (holds === null) notes.push(t);
  }
  return notes;
}

function featureName(name: string, notes: string[]): string {
  const use = notes
    .map((n) =>
      /recharges? after a long rest/i.test(n) ? '1/Day' : /^(\d+\/day|recharge)/i.test(n) ? n : '',
    )
    .filter(Boolean);
  return use.length ? `${name} (${use.join('; ')})` : name;
}

function resolveRows(rows: BlockRow[], sc: Scope, text: (s: string) => string): MonsterFeature[] {
  const out: MonsterFeature[] = [];
  for (const row of rows) {
    const isVariantRow = sc.variants.some((v) => v.toLowerCase() === row.name.toLowerCase());
    if (isVariantRow && out.length) {
      // an effect of one variant under a general feature ("Fey Step" → "Mirthful. …")
      if (row.name.toLowerCase() === sc.variant?.toLowerCase()) {
        const prev = out[out.length - 1];
        prev.description += `\n\n**${row.name}.** ${text(row.text)}`;
      }
      continue;
    }
    const notes = noteOf(row.tags, sc.variants, sc.variant, sc.ctx.slotLevel);
    if (!notes) continue;
    out.push({ name: featureName(row.name, notes), description: text(row.text) });
  }
  return out;
}

export interface ResolveOptions {
  id: string;
  /** Replaces the title of the template (a variant's name, "Bestial Spirit (Air)"). */
  name: string;
  source: string;
  variant: string | null;
  variants: string[];
  ctx: SummonContext;
}

export function resolveBlock(t: StatBlockTemplate, o: ResolveOptions): Resolved {
  const sc: Scope = { ctx: o.ctx, variant: o.variant, variants: o.variants };
  const unresolved: string[] = [];
  const ac = evalSum(t.ac, o.ctx, o.variant, o.variants);
  const hp = evalSum(t.hp, o.ctx, o.variant, o.variants);
  if (ac === null) unresolved.push('ac');
  if (hp === null) unresolved.push('hp');
  if (!t.speed) unresolved.push('speed');
  const head = parseTypeLine(t.typeLine, o.variant);
  const speed = parseSpeed(t.speed, sc);
  if (!speed.walk && !speed.fly && !speed.swim && !speed.climb && !speed.burrow) {
    unresolved.push('speed');
  }
  const senses: Monster['senses'] = {};
  for (const m of t.senses.matchAll(/(darkvision|blindsight|tremorsense|truesight)\s+(\d+)/gi)) {
    senses[m[1].toLowerCase() as keyof Monster['senses']] = +m[2];
  }
  const pp = /passive perception\s+(\d+)/i.exec(t.senses);
  const wisMod = Math.floor((t.abilities.WIS - 10) / 2);
  const text = (s: string) => resolveText(s, o.ctx, o.variant, o.variants);
  const vul = parseDefences(t.vulnerabilities, sc);
  const res = parseDefences(t.resistances, sc);
  const imm = parseDefences(t.immunities, sc);
  const dice = /hit dice\s*\[d(\d+)s?\]\s*equal to (?:your (\w+) level|the spell'?s? level)/i.exec(
    t.hp,
  );
  const diceCount = dice
    ? dice[2]
      ? o.ctx.classLevels[dice[2].toLowerCase()]
      : o.ctx.slotLevel
    : 0;
  const formula = pickAlternative(t.hp.replace(/^HP\s+/i, ''), sc)
    .replace(/\s*\([^()]*\)/g, '')
    .trim();
  const monster: Monster = {
    id: o.id,
    type: 'monster',
    name: o.name,
    edition: '2024',
    source: o.source,
    description: '',
    url: '',
    category: 'monster',
    size: [head.size],
    creatureType: head.type,
    tags: [],
    alignment: head.alignment,
    ac: ac ?? 10,
    armor: [],
    hp: hp ?? 1,
    hitDice: dice && diceCount ? `${diceCount}d${dice[1]}` : formula,
    speed:
      speed.walk || speed.fly || speed.swim || speed.climb || speed.burrow ? speed : { walk: 30 },
    initiative: null,
    abilities: t.abilities,
    saves: {},
    skills: {},
    vulnerabilities: vul.damage,
    resistances: res.damage,
    immunities: imm.damage,
    conditionImmunities: imm.conditions,
    senses,
    passivePerception: pp ? +pp[1] : 10 + wisMod,
    languages: t.languages.replace(/\.$/, ''),
    cr: 0,
    xp: 0,
    xpInLair: null,
    proficiencyBonus: o.ctx.pb,
    gear: [],
    traits: resolveRows(t.sections.traits, sc, text),
    actions: resolveRows(t.sections.actions, sc, text),
    bonusActions: resolveRows(t.sections.bonusActions, sc, text),
    reactions: resolveRows(t.sections.reactions, sc, text),
    legendaryActions: [],
    legendaryActionUses: null,
    legendary: false,
    spellcasting: false,
  };
  return { monster, unresolved };
}

/** The sections of a monster, to walk them in order. */
export const FEATURE_SECTIONS: BlockSection[] = ['traits', 'actions', 'bonusActions', 'reactions'];

export { splitTags };
