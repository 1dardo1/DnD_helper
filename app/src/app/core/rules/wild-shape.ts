import { Ability, Monster, MonsterFeature } from '../models/compendium';
import { beastShapes } from './feature-stats';
import { Sheet, SheetFeature } from './sheet';

/**
 * The Druid's Wild Shape (2024): which Beast forms can be known, and what the character's sheet
 * becomes in one. Every number comes from the texts of data/classes.json and data/subclasses.json
 * (the `anchor` regexps below; a spec checks them against the compendium):
 *
 *   Wild Shape   "You stay in that form for a number of hours equal to half your Druid level";
 *                Beast Shapes table (known forms, max CR, Fly Speed); "Temporary Hit Points equal
 *                to your Druid level"; "Your game statistics are replaced by the Beast's stat
 *                block, but you retain your creature type; Hit Points; Hit Point Dice;
 *                Intelligence, Wisdom, and Charisma scores; class features; languages; and feats.
 *                You also retain your skill and saving throw proficiencies and use your
 *                Proficiency Bonus for them ... If a skill or saving throw modifier in the Beast's
 *                stat block is higher than yours, use the one in the stat block"; "You can't cast
 *                spells".
 *   Circle Forms (Moon 3)   max CR = Druid level / 3; AC 13 + WIS if higher; THP 3 × Druid level.
 *   Improved Circle Forms (Moon 6)   Lunar Radiance; WIS modifier to CON saving throws.
 *   Lunar Form (Moon 14)    extra 2d10 Radiant once per turn.
 *   Circle of the Moon Spells   those spells can be cast in a Wild Shape form.
 *   Beast Spells (Druid 18)     any spell in Beast form (but costly or consumed Material components).
 *
 * The character keeps its own Hit Points: the form has none of its own (no creature card).
 */

export const WILD_SHAPE_ANCHORS = {
  hours: /number of hours equal to half your Druid level/,
  thp: /Temporary Hit Points equal to your Druid level/,
  retain:
    /you retain your creature type; Hit Points; Hit Point Dice; Intelligence, Wisdom, and Charisma scores/,
  higher: /If a skill or saving throw modifier in the Beast's stat block is higher than yours/,
  noSpells: /You can't cast spells/,
  circleCr: /Druid level divided by 3 \(round down\)/,
  circleAc: /13 plus your Wisdom modifier/,
  circleThp: /three times your Druid level/,
  lunarRadiance: /can deal its normal damage type or Radiant damage/,
  toughness: /add your Wisdom modifier to your Constitution saving throws/,
  lunarForm: /extra 2d10 Radiant damage to a target you hit with a Wild Shape form's attack/,
  moonSpells: /you can cast the spells from this feature while you're in a Wild Shape form/,
  beastSpells: /you can cast spells in Beast form/,
  primalStrike: /a Beast form's attack in Wild Shape/,
} as const;

const MOON = 'druid/circle-of-the-moon';

export interface WildShapeRules {
  /** Druid level. */
  level: number;
  /** How many forms can be known. */
  known: number;
  /** Highest Challenge Rating of a form (0.25 for 1/4). */
  maxCr: number;
  /** Forms with a Fly Speed allowed. */
  fly: boolean;
  /** Hours a form lasts. */
  hours: number;
  /** Temporary Hit Points gained on taking a form. */
  tempHp: number;
  /** Circle Forms: the AC in a form is at least this (13 + WIS). */
  circleAc: number | null;
  /** Improved Circle Forms. */
  lunarRadiance: boolean;
  toughness: boolean;
  /** Lunar Form: extra 2d10 Radiant once per turn. */
  lunarForm: boolean;
  /** Elemental Fury's Primal Strike reaches the Beast form's attacks (if the player chose it). */
  primalStrike: string | null;
  /** What can be cast in a form: nothing, the Circle of the Moon spells, or any spell. */
  spells: 'none' | 'circle' | 'all';
  /** Ids of the spells castable in a form when spells is 'circle'. */
  circleSpells: string[];
}

type Features = Pick<SheetFeature, 'name' | 'description' | 'source'>[];

const featureText = (features: Features, src: string, name: string) =>
  features.find((f) => f.name === name && f.source.id === src)?.description ?? null;

/** "1/4" → 0.25. */
export function crValue(cr: string): number {
  const m = /^(\d+)\/(\d+)$/.exec(cr.trim());
  return m ? Number(m[1]) / Number(m[2]) : Number(cr) || 0;
}

/** The rules of Wild Shape for this sheet; null without the feature (not a Druid 2+). */
export function wildShapeRules(
  sheet: Pick<Sheet, 'classes' | 'features' | 'abilities' | 'featSpells'>,
): WildShapeRules | null {
  const druid = sheet.classes.find((c) => c.id === 'druid');
  const text = featureText(sheet.features, 'druid', 'Wild Shape');
  if (!druid || !text) return null;
  const level = druid.level;
  const shapes = beastShapes(text, level);
  if (!shapes) return null;
  const wis = sheet.abilities.WIS.modifier;
  const a = WILD_SHAPE_ANCHORS;
  const moon = druid.subclassId === MOON;
  const circle = moon ? featureText(sheet.features, MOON, 'Circle Forms') : null;
  const improved = moon ? featureText(sheet.features, MOON, 'Improved Circle Forms') : null;
  const lunar = moon ? featureText(sheet.features, MOON, 'Lunar Form') : null;
  const moonSpells = moon ? featureText(sheet.features, MOON, 'Circle of the Moon Spells') : null;
  const beastSpells = featureText(sheet.features, 'druid', 'Beast Spells');
  const fury = featureText(sheet.features, 'druid', 'Elemental Fury');
  const subName = druid.subclass;
  return {
    level,
    known: shapes.forms,
    maxCr: circle && a.circleCr.test(circle) ? Math.floor(level / 3) : crValue(shapes.cr),
    fly: shapes.fly,
    hours: a.hours.test(text) ? Math.floor(level / 2) : 1,
    tempHp: circle && a.circleThp.test(circle) ? 3 * level : a.thp.test(text) ? level : 0,
    circleAc: circle && a.circleAc.test(circle) ? 13 + wis : null,
    lunarRadiance: !!improved && a.lunarRadiance.test(improved),
    toughness: !!improved && a.toughness.test(improved),
    lunarForm: !!lunar && a.lunarForm.test(lunar),
    primalStrike: fury && a.primalStrike.test(fury) ? (level >= 15 ? '2d8' : '1d8') : null,
    spells:
      beastSpells && a.beastSpells.test(beastSpells)
        ? 'all'
        : moonSpells && a.moonSpells.test(moonSpells)
          ? 'circle'
          : 'none',
    circleSpells: moonSpells
      ? sheet.featSpells
          .filter((fs) => fs.origin === 'subclass' && fs.feat.name === subName)
          .map((fs) => fs.id)
      : [],
  };
}

/** A Beast stat block this Druid may learn as a form: Beast, CR low enough, no Fly Speed early. */
export function formAllowed(m: Monster, rules: WildShapeRules): boolean {
  return (
    m.creatureType.toLowerCase() === 'beast' && m.cr <= rules.maxCr && (rules.fly || !m.speed.fly)
  );
}

/** Every form the Druid may learn now, by CR and then by name. */
export function eligibleForms(monsters: readonly Monster[], rules: WildShapeRules): Monster[] {
  return monsters
    .filter((m) => formAllowed(m, rules))
    .sort((x, y) => x.cr - y.cr || x.name.localeCompare(y.name));
}

/** The known forms the character has picked that still exist and are allowed (in order). */
export function knownForms(
  ids: readonly string[] | undefined,
  monsters: ReadonlyMap<string, Monster>,
  rules: WildShapeRules,
): { monster: Monster; allowed: boolean }[] {
  return (ids ?? []).flatMap((id) => {
    const monster = monsters.get(id);
    return monster ? [{ monster, allowed: formAllowed(monster, rules) }] : [];
  });
}

/** Adds or removes a known form (never more than the table allows). */
export function toggleKnownForm(
  ids: readonly string[] | undefined,
  id: string,
  max: number,
): string[] {
  const list = [...(ids ?? [])];
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else if (list.length < max) list.push(id);
  return list;
}

// -- the sheet in a form ---------------------------------------------------------------------

export interface FormAttack {
  name: string;
  kind: 'melee' | 'ranged' | 'melee-or-ranged';
  bonus: number | null;
  reach: number | null;
  range: string | null;
  /** "1d6+2" or "1" as the stat block says; null when it states no damage. */
  damage: string | null;
  type: string | null;
  /** Other damage of the same hit ("plus 3 (1d6) Poison damage"). */
  extra: { damage: string; type: string }[];
  /** The whole text (markdown). */
  text: string;
  /** Effects of the Druid's features on these attacks: UI text id (combat.note.*) and params. */
  notes: { id: string; params?: Record<string, string | number> }[];
}

export interface FormView {
  monster: Monster;
  ac: number;
  /** The AC comes from Circle Forms (13 + WIS) instead of the Beast's. */
  acFromCircle: boolean;
  speed: Monster['speed'];
  abilities: Record<Ability, { score: number; modifier: number; from: 'beast' | 'you' }>;
  saves: Record<Ability, { modifier: number; from: 'beast' | 'you' }>;
  /** Skills with a proficiency (yours or the Beast's), with the modifier that applies. */
  skills: { id: string; ability: Ability; modifier: number; from: 'beast' | 'you' }[];
  passivePerception: number;
  initiative: number;
  attacks: FormAttack[];
  /** Actions that are not an attack roll (Multiattack, Constrict...). */
  otherActions: MonsterFeature[];
  traits: MonsterFeature[];
  bonusActions: MonsterFeature[];
  reactions: MonsterFeature[];
  rules: WildShapeRules;
}

const PHYSICAL: Ability[] = ['STR', 'DEX', 'CON'];
const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const modOf = (score: number) => Math.floor((score - 10) / 2);
const dice = (s: string) => s.replace(/\s+/g, '');

/** An action of a stat block as an attack: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage." */
export function formAttack(f: MonsterFeature): FormAttack | null {
  const text = f.description;
  const head = /^(Melee or Ranged|Melee|Ranged) Attack Roll:\s*([+-]\d+)?/i.exec(text);
  if (!head) return null;
  const kindWord = head[1].toLowerCase();
  const reach = /\breach (\d+) (?:ft|feet)\b/i.exec(text);
  const range = /\brange (\d+(?:\/\d+)?) (?:ft|feet)\b/i.exec(text);
  // the damage of the hit: "5 (1d6 + 2) Piercing damage" or a flat "1 Piercing damage"
  const after = text.slice((reach ?? range)?.index ?? 0);
  const dmg =
    /(?:\d+ \((\d+d\d+(?:\s*[+-]\s*\d+)?)\)|\b(\d+)) ([A-Z][a-z]+) damage/.exec(after) ?? null;
  const extra = [
    ...after.matchAll(/\bplus \d+ \((\d+d\d+(?:\s*[+-]\s*\d+)?)\) ([A-Z][a-z]+) damage/g),
  ].map((m) => ({ damage: dice(m[1]), type: m[2].toLowerCase() }));
  return {
    name: f.name,
    kind: kindWord === 'melee' ? 'melee' : kindWord === 'ranged' ? 'ranged' : 'melee-or-ranged',
    bonus: head[2] ? Number(head[2]) : null,
    reach: reach ? Number(reach[1]) : null,
    range: range ? range[1] : null,
    damage: dmg ? dice(dmg[1] ?? dmg[2]) : null,
    type: dmg ? dmg[3].toLowerCase() : null,
    extra,
    text,
    notes: [],
  };
}

/**
 * The character's sheet in a Beast form: the Beast's physical scores, AC, speeds and actions;
 * the character's own mental scores, proficiencies (with its Proficiency Bonus) and Hit Points,
 * keeping the stat block's modifier when it is higher.
 */
export function formView(sheet: Sheet, monster: Monster, rules: WildShapeRules): FormView {
  const abilities = {} as FormView['abilities'];
  for (const a of ABILITIES) {
    const beast = PHYSICAL.includes(a);
    const score = beast ? monster.abilities[a] : sheet.abilities[a].score;
    abilities[a] = { score, modifier: modOf(score), from: beast ? 'beast' : 'you' };
  }
  // own bonuses (proficiency, feats) kept, on the ability score that applies now
  const shift = (a: Ability) => abilities[a].modifier - sheet.abilities[a].modifier;
  const saves = {} as FormView['saves'];
  for (const a of ABILITIES) {
    let own = sheet.savingThrows[a].modifier + shift(a);
    if (a === 'CON' && rules.toughness) own += sheet.abilities.WIS.modifier;
    const beast = monster.saves[a] ?? abilities[a].modifier;
    saves[a] = beast > own ? { modifier: beast, from: 'beast' } : { modifier: own, from: 'you' };
  }
  const skills: FormView['skills'] = [];
  for (const s of sheet.skills) {
    const own = s.modifier + shift(s.ability);
    const beast = monster.skills[s.id];
    if (beast !== undefined && beast > own)
      skills.push({ id: s.id, ability: s.ability, modifier: beast, from: 'beast' });
    else if (s.proficiency !== 'none' || beast !== undefined)
      skills.push({ id: s.id, ability: s.ability, modifier: own, from: 'you' });
  }
  const perception =
    skills.find((s) => s.id === 'perception')?.modifier ??
    (sheet.skills.find((s) => s.id === 'perception')?.modifier ?? 0) + shift('WIS');
  const attacks: FormAttack[] = [];
  const otherActions: MonsterFeature[] = [];
  for (const act of monster.actions) {
    const atk = formAttack(act);
    if (!atk) {
      otherActions.push(act);
      continue;
    }
    if (rules.lunarRadiance) atk.notes.push({ id: 'lunarRadiance' });
    if (rules.lunarForm) atk.notes.push({ id: 'lunarForm' });
    if (rules.primalStrike)
      atk.notes.push({ id: 'primalStrike', params: { dice: rules.primalStrike } });
    attacks.push(atk);
  }
  const acFromCircle = rules.circleAc !== null && rules.circleAc > monster.ac;
  return {
    monster,
    ac: acFromCircle ? rules.circleAc! : monster.ac,
    acFromCircle,
    speed: monster.speed,
    abilities,
    saves,
    skills,
    passivePerception: 10 + perception,
    initiative: sheet.initiative + shift('DEX'),
    attacks,
    otherActions,
    traits: monster.traits,
    bonusActions: monster.bonusActions,
    reactions: monster.reactions,
    rules,
  };
}
