import { Ability, Monster, MonsterFeature } from '../models/compendium';

/**
 * Reads the 2024 stat-block texts of a monster (the English data) into what the DM needs at a
 * glance during its turn: to-hit bonus, reach or range, damage, saving throw and DC, area, limited
 * uses. Pure; whatever it can't read is left to the full text (`summary`, the stat block).
 */

export type Section = 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions';
export const SECTIONS: Section[] = [
  'traits',
  'actions',
  'bonusActions',
  'reactions',
  'legendaryActions',
];

/** A limited use, read from the name: "(Recharge 5–6)", "(2/Day)", "(Recharge after a Short…)". */
export type Usage =
  | { kind: 'recharge'; min: number }
  | { kind: 'perDay'; count: number; inLair: number | null }
  | { kind: 'rest' };

export interface DamagePart {
  /** The fixed number of the stat block ("13" of "13 (1d10 + 8)"). */
  average: number;
  /** "1d10 + 8"; null for a flat amount ("Hit: 1 Piercing damage"). */
  dice: string | null;
  /** English, lower case: "slashing". */
  type: string;
  /** Only in some cases ("…if the attack roll had Advantage"). */
  conditional: boolean;
}

export type AttackMode = 'melee' | 'ranged' | 'meleeOrRanged';

export interface AttackInfo {
  mode: AttackMode;
  bonus: number;
  /** Feet. */
  reach: number | null;
  range: { normal: number; long: number | null } | null;
  /** "(with Advantage if the target is Grappled by the bugbear)": there's a note. */
  note: boolean;
}

export type AreaShape = 'cone' | 'line' | 'cube' | 'sphere' | 'emanation' | 'cylinder';

export interface SaveInfo {
  ability: Ability;
  dc: number;
  /** "each creature in a 60-foot Cone". */
  area: { shape: AreaShape; size: number; width: number | null } | null;
  /** "one creature … within 120 feet": the distance in feet. */
  within: number | null;
  /** Half damage (or "Half damage only") on a success. */
  half: boolean;
}

export interface SpellGroup {
  /** null: at will. */
  perDay: number | null;
  /** English spell names. */
  spells: string[];
}

export interface SpellcastingInfo {
  ability: Ability | null;
  dc: number | null;
  attack: number | null;
  groups: SpellGroup[];
}

export type ActionKind = 'attack' | 'save' | 'multiattack' | 'spellcasting' | 'other';

export interface ParsedAction {
  /** Where it is in the monster (the Spanish entry has the same index): "actions:2". */
  key: string;
  section: Section;
  index: number;
  /** The name without the parentheses read ("Fire Breath"). */
  name: string;
  /** What's left in parentheses, English ("Vampire Form Only"). */
  nameNote: string | null;
  kind: ActionKind;
  usage: Usage | null;
  attack: AttackInfo | null;
  /** The main saving throw, or one that comes with an attack (a "Hit:" that forces a save). */
  save: SaveInfo | null;
  /** On a hit (attacks) or on a failed save. */
  damage: DamagePart[];
  /** English condition names imposed ("grappled", "prone"), lower case. */
  conditions: string[];
  /** "escape DC 12" of a grapple. */
  escapeDc: number | null;
  /** There's more than the numbers shown (an extra effect): look at the text. */
  more: boolean;
  spellcasting: SpellcastingInfo | null;
}

const ABILITY: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const DAMAGE_TYPES =
  'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';

const CONDITIONS =
  'blinded|charmed|deafened|exhaustion|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious';

/** Reads "(Recharge 5–6)", "(3/Day, or 4/Day in Lair)", "(Recharge after a Short or Long Rest)". */
export function parseName(full: string): {
  name: string;
  usage: Usage | null;
  note: string | null;
} {
  let usage: Usage | null = null;
  const notes: string[] = [];
  const name = full
    .replace(/\s*\(([^()]*)\)/g, (_, inner: string) => {
      for (const part of inner.split(/;\s*/)) {
        const u = usageOf(part);
        if (u && !usage) usage = u;
        else if (part.trim()) notes.push(part.trim());
      }
      return '';
    })
    .trim();
  return { name: name || full, usage, note: notes.length ? notes.join('; ') : null };
}

function usageOf(text: string): Usage | null {
  const t = text.trim();
  if (/^recharge after a short or long rest$/i.test(t)) return { kind: 'rest' };
  let m = /^recharge (\d)(?:\s*[–-]\s*6)?$/i.exec(t);
  if (m) return { kind: 'recharge', min: +m[1] };
  m = /^(\d+)\/day(?: each)?(?:,? or (\d+)\/day in lair)?$/i.exec(t);
  if (m) return { kind: 'perDay', count: +m[1], inLair: m[2] ? +m[2] : null };
  return null;
}

/** "13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage" → the parts. */
export function parseDamage(text: string): DamagePart[] {
  const rx = new RegExp(
    `\\b(\\d+)(?:\\s*\\(([\\dd\\s+−–-]+)\\))?\\s+(${DAMAGE_TYPES})\\s+damage\\b(?=(\\s+(?:if|when|while|against)\\b)?)`,
    'gi',
  );
  const parts: DamagePart[] = [];
  for (const m of text.matchAll(rx)) {
    parts.push({
      average: +m[1],
      dice: m[2] ? m[2].replace(/\s+/g, ' ').replace(/[−–]/g, '-').trim() : null,
      type: m[3].toLowerCase(),
      conditional: !!m[4],
    });
  }
  return parts;
}

function conditionsIn(text: string): string[] {
  const out = new Set<string>();
  // "has the Grappled condition", "has the Blinded and Poisoned conditions"
  const rx = new RegExp(
    `\\b((?:(?:${CONDITIONS})(?:,\\s*|,?\\s+and\\s+|,?\\s+or\\s+)?)+)\\s+conditions?\\b`,
    'gi',
  );
  for (const m of text.matchAll(rx)) {
    for (const c of m[1].matchAll(new RegExp(CONDITIONS, 'gi'))) out.add(c[0].toLowerCase());
  }
  return [...out];
}

const SAVE_RX =
  /(?<![A-Za-z])(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw[\s:_*]*DC (\d+)/i;

function parseSave(text: string): { save: SaveInfo; failure: string } | null {
  const m = SAVE_RX.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const failAt = rest.search(/\b(?:First )?Failure\b:?/);
  const target = failAt >= 0 ? rest.slice(0, failAt) : rest.split(/(?<=\.)\s/)[0];
  let failure = failAt >= 0 ? rest.slice(failAt).replace(/^(?:First )?Failure:?\s*/, '') : '';
  const successAt = failure.search(
    /\b(?:Success|Failure or Success|Subsequent Failures?|Second Failure)\b:?/,
  );
  const success = successAt >= 0 ? failure.slice(successAt) : '';
  if (successAt >= 0) failure = failure.slice(0, successAt);
  return {
    save: {
      ability: ABILITY[m[1].toLowerCase()],
      dc: +m[2],
      area: areaOf(target),
      within: withinOf(target),
      half: /^Success:\s*Half damage/i.test(success.trim()),
    },
    failure: failure.trim(),
  };
}

function areaOf(text: string): SaveInfo['area'] {
  let m = /(\d+)-foot-long,\s*(\d+)-foot-wide Line/i.exec(text);
  if (m) return { shape: 'line', size: +m[1], width: +m[2] };
  m =
    /(\d+)-foot(?:-radius)?(?:,\s*\d+-foot-(?:high|tall))?\s+(Cone|Cube|Sphere|Emanation|Cylinder|Line)\b/i.exec(
      text,
    );
  if (m) return { shape: m[2].toLowerCase() as AreaShape, size: +m[1], width: null };
  return null;
}

function withinOf(text: string): number | null {
  const m = /\bwithin (\d+) (?:feet|ft\.?)/i.exec(text);
  return m ? +m[1] : null;
}

const ATTACK_RX =
  /^(Melee or Ranged|Melee|Ranged) Attack Roll:\s*([+-−]\d+)(?: to hit)?(\s*\([^)]*\))?,\s*(?:reach (\d+) (?:ft\.?|feet))?(?:\s*or\s*)?(?:range (\d+)(?:\/(\d+))? (?:ft\.?|feet))?\.?\s*/i;

function parseAttack(text: string): { attack: AttackInfo; hit: string } | null {
  const m = ATTACK_RX.exec(text);
  if (!m || (!m[4] && !m[5])) return null;
  const mode: AttackMode =
    m[1].toLowerCase() === 'melee'
      ? 'melee'
      : m[1].toLowerCase() === 'ranged'
        ? 'ranged'
        : 'meleeOrRanged';
  return {
    attack: {
      mode,
      bonus: +m[2].replace('−', '-'),
      reach: m[4] ? +m[4] : null,
      range: m[5] ? { normal: +m[5], long: m[6] ? +m[6] : null } : null,
      note: !!m[3],
    },
    hit: text.slice(m[0].length).replace(/^Hit:\s*/, ''),
  };
}

/** The damage and conditions of a hit or a failed save, and whether there's more to it. */
function outcome(text: string): Pick<ParsedAction, 'damage' | 'conditions' | 'escapeDc' | 'more'> {
  const first = firstSentence(text);
  const damage = parseDamage(first);
  const conditions = conditionsIn(text);
  const escape = /escape DC (\d+)/i.exec(text);
  // anything besides "N (XdY) Type damage[ plus …]." counts as an extra effect
  const bare = first
    .replace(
      new RegExp(
        `\\b\\d+(?:\\s*\\([^)]*\\))?\\s+(?:${DAMAGE_TYPES})\\s+damage(?:,?\\s*plus\\s*)?`,
        'gi',
      ),
      '',
    )
    .replace(/[\s.,]+/g, '');
  const more = bare.length > 0 || first.trim().length < text.trim().length;
  return { damage, conditions, escapeDc: escape ? +escape[1] : null, more };
}

/** The first sentence (up to ". " followed by a capital, or the end). */
export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const m = /^(.*?[.!?])(?=\s+[A-Z_*¡¿ÁÉÍÓÚÑ(])/.exec(clean);
  return m ? m[1] : clean;
}

function parseSpellcasting(text: string): SpellcastingInfo | null {
  if (!/casts one of the following spells/i.test(text)) return null;
  const ability = /using (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) as/i.exec(
    text,
  );
  const dc = /spell save DC (\d+)/i.exec(text);
  const attack = /([+-]\d+) to hit with spell attacks/i.exec(text);
  const groups: SpellGroup[] = [];
  for (const m of text.matchAll(/^- \*\*([^*]+?):?\*\*:?\s*(.+)$/gm)) {
    const head = m[1].trim();
    const perDay = /^(\d+)\/Day/i.exec(head);
    if (!perDay && !/^At Will/i.test(head)) continue;
    groups.push({
      perDay: perDay ? +perDay[1] : null,
      spells: m[2]
        .split(/,\s*/)
        .map((s) => s.replace(/\s*\([^)]*\)\s*$/, '').trim())
        .filter(Boolean),
    });
  }
  return {
    ability: ability ? ABILITY[ability[1].toLowerCase()] : null,
    dc: dc ? +dc[1] : null,
    attack: attack ? +attack[1] : null,
    groups,
  };
}

/** One feature (trait, action…) of a monster. */
export function parseAction(f: MonsterFeature, section: Section, index: number): ParsedAction {
  const { name, usage, note } = parseName(f.name);
  const text = f.description.replace(/\s+/g, ' ').trim();
  const base: ParsedAction = {
    key: `${section}:${index}`,
    section,
    index,
    name,
    nameNote: note,
    kind: 'other',
    usage,
    attack: null,
    save: null,
    damage: [],
    conditions: [],
    escapeDc: null,
    more: false,
    spellcasting: null,
  };
  if (/^Multiattack$/i.test(name)) return { ...base, kind: 'multiattack' };

  const attack = parseAttack(text);
  if (attack) {
    const save = parseSave(attack.hit);
    return {
      ...base,
      kind: 'attack',
      attack: attack.attack,
      save: save?.save ?? null,
      ...outcome(attack.hit),
    };
  }

  const spells = parseSpellcasting(f.description);
  if (spells) return { ...base, kind: 'spellcasting', spellcasting: spells };

  if (section !== 'traits' || /^\w+ Saving Throw/i.test(text)) {
    const save = parseSave(text);
    if (save) {
      const o = outcome(save.failure);
      // something before the save ("The cube moves up to its Speed…"): there's more
      const lead = text.search(SAVE_RX) > 0;
      return { ...base, kind: 'save', save: save.save, ...o, more: o.more || lead };
    }
  }
  return base;
}

export interface ParsedMonster {
  /** All of them, in stat-block order, sections in SECTIONS order. */
  features: ParsedAction[];
  legendaryUses: number | null;
  legendaryUsesInLair: number | null;
}

export function parseMonster(m: Monster): ParsedMonster {
  const features: ParsedAction[] = [];
  for (const section of SECTIONS) {
    (m[section] ?? []).forEach((f, i) => features.push(parseAction(f, section, i)));
  }
  return {
    features,
    legendaryUses: m.legendaryActionUses?.uses ?? null,
    legendaryUsesInLair: m.legendaryActionUses?.inLair ?? null,
  };
}

/** How many checkboxes a limited use has (a recharge or "after a rest": one). */
export function usageSlots(u: Usage | null): number {
  if (!u) return 0;
  return u.kind === 'perDay' ? u.count : 1;
}

/** "13 (1d10 + 8)" or "1". */
export function damageText(d: DamagePart): string {
  return d.dice ? `${d.average} (${d.dice})` : `${d.average}`;
}

/** Key of a per-day spell's uses in a Spellcasting action: "actions:3:Fireball". */
export function spellKey(action: ParsedAction, spell: string): string {
  return `${action.key}:${spell}`;
}

/** Key of the legendary actions per round. */
export const LEGENDARY_KEY = 'legendary';
