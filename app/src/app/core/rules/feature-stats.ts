import { Ability } from '../models/compendium';
import { RuleText } from './feat-effects';
import { poolsOf } from './pools';
import { Sheet, SheetFeature } from './sheet';

/**
 * The numbers a class or subclass feature leaves to the player: damage that goes on top of a hit,
 * healing, temporary hit points, bonuses and save DCs, with the character's own values already
 * worked out. Every figure comes from the feature's text (the `anchor` of each definition is the
 * sentence the number comes from, and a spec checks it against the compendium); what the text
 * leaves to a roll or a choice stays a reminder.
 *
 *   notes: extra damage and effects that go on top of an attack (shown with the attacks table)
 *   stats: healing, THP, bonuses, DCs (shown folded under the attacks)
 */

type Params = Record<string, string | number>;

export interface FeatureNote {
  /** UI text id: combat.note.<id> for notes, combat.stat.<id> for stats. */
  id: string;
  /** English name of the feature it comes from. */
  source: string;
  params?: Params;
  /** The ability of a save DC (shown next to it). */
  ability?: Ability;
  /**
   * How it is used in play, for a list of actions: an Action (Magic action included), a Bonus
   * Action, a Reaction, free (no action: on a failed save, on rolling Initiative...), onHit (a rider
   * added to a hit you already make) or passive (always on, only a number to know).
   */
  action?: UseKind;
  /** English name of the counter it spends (PlayResource.name, or a spell slot), if any. */
  spends?: string;
  /** Save DC the effect forces, already worked out. */
  saveDc?: number;
}

export type UseKind = 'action' | 'bonus' | 'reaction' | 'free' | 'onHit' | 'passive';

/** How each definition is used (from the text of its feature) and what it spends. */
const USE: Record<string, { action: UseKind; spends?: string; dc?: 'spell' | 'focus' }> = {
  brutalStrike: { action: 'onHit' },
  frenzy: { action: 'onHit' },
  divineFury: { action: 'onHit' },
  divineStrike: { action: 'onHit' },
  primalStrike: { action: 'onHit' },
  psionicStrike: { action: 'onHit', spends: 'Psionic Energy Dice' },
  handOfHarm: { action: 'onHit', spends: 'Focus Points' },
  radiantStrikes: { action: 'onHit' },
  divineSmite: { action: 'onHit', spends: 'Spell slot' },
  huntersMark: { action: 'onHit' },
  dreadfulStrikes: { action: 'onHit' },
  dreadfulStrike: { action: 'onHit', spends: 'Dread Ambusher' },
  colossusSlayer: { action: 'onHit' },
  assassinate: { action: 'onHit' },
  elementalAffinity: { action: 'onHit' },
  radiantSoul: { action: 'onHit' },
  lunarForm: { action: 'onHit' },
  hex: { action: 'onHit' },
  fanaticalFocus: { action: 'free' },
  vitalityOfTheTree: { action: 'free' },
  searUndead: { action: 'action', spends: 'Channel Divinity' },
  preserveLife: { action: 'action', spends: 'Channel Divinity' },
  discipleOfLife: { action: 'passive' },
  radianceOfTheDawn: { action: 'action', spends: 'Channel Divinity', dc: 'spell' },
  wardingFlare: { action: 'reaction', spends: 'Warding Flare' },
  wildShape: { action: 'bonus', spends: 'Wild Shape' },
  wildShapeFly: { action: 'bonus', spends: 'Wild Shape' },
  circleForms: { action: 'passive' },
  landsAid: { action: 'action', spends: 'Wild Shape', dc: 'spell' },
  wrathOfTheSea: { action: 'bonus', spends: 'Wild Shape', dc: 'spell' },
  starryForm: { action: 'bonus', spends: 'Wild Shape' },
  secondWind: { action: 'bonus', spends: 'Second Wind' },
  indomitable: { action: 'free', spends: 'Indomitable' },
  protectiveField: { action: 'reaction', spends: 'Psionic Energy Dice' },
  heroicRally: { action: 'passive' },
  deflectAttacks: { action: 'reaction' },
  relentlessRage: { action: 'free' },
  tacticalMind: { action: 'free', spends: 'Second Wind' },
  patientDefense: { action: 'bonus', spends: 'Focus Points' },
  uncannyMetabolism: { action: 'free', spends: 'Uncanny Metabolism' },
  slowFall: { action: 'reaction' },
  handOfHealing: { action: 'action', spends: 'Focus Points' },
  wholenessOfBody: { action: 'bonus', spends: 'Wholeness of Body' },
  elementalBurst: { action: 'action', spends: 'Focus Points', dc: 'focus' },
  auraOfProtection: { action: 'passive' },
  abjureFoes: { action: 'action', spends: 'Channel Divinity', dc: 'spell' },
  channelDivinityDc: { action: 'passive' },
  sacredWeapon: { action: 'free', spends: 'Channel Divinity' },
  inspiringSmite: { action: 'free', spends: 'Channel Divinity' },
  gloriousDefense: { action: 'reaction', spends: 'Glorious Defense' },
  tireless: { action: 'action', spends: 'Tireless' },
  innateSorcery: { action: 'bonus', spends: 'Innate Sorcery' },
  sorcerousRestoration: { action: 'free', spends: 'Sorcerous Restoration' },
  darkOnesBlessing: { action: 'passive' },
  celestialResilience: { action: 'passive' },
  arcaneRecovery: { action: 'free', spends: 'Arcane Recovery' },
  arcaneWard: { action: 'passive' },
  flashOfGenius: { action: 'reaction', spends: 'Flash of Genius' },
  otherworldlyGlamour: { action: 'passive' },
  telepathy: { action: 'bonus' },
  telepathyOnly: { action: 'bonus' },
  createThrall: { action: 'passive' },
};

interface Ctx {
  /** Level in the class that has the feature. */
  level: number;
  pb: number;
  mod: (a: Ability) => number;
  /** Martial Arts die ("1d8") of a Monk. */
  martial: string | null;
  /** Rage Damage bonus of a Barbarian. */
  rage: number;
  /** Spell save DC of the class, if it casts. */
  spellDc: number | null;
  /** Size of a pool of dice of the subclass ("d8"). */
  poolDie: string | null;
  /** Text of the feature the definition belongs to. */
  text: string;
}

interface Def {
  cls: string;
  /** Subclass id when it belongs to a subclass. */
  sub?: string;
  /** Feature that holds the text; it must be gained for the definition to apply. */
  feature: string;
  id: string | ((c: Ctx) => string);
  to: 'notes' | 'stats';
  /** The sentence of the feature's text the number comes from (checked by a spec). */
  anchor: RegExp;
  /** Other features whose text also counts (the same number grows in a later feature). */
  also?: { feature: string; anchor: RegExp }[];
  p?: (c: Ctx) => Params | null;
}

/** The "Beast Shapes" table of Wild Shape: known forms, max CR and Fly Speed at this Druid level. */
export function beastShapes(text: string, level: number) {
  let best: { forms: number; cr: string; fly: boolean } | null = null;
  for (const m of text.matchAll(/^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([\d/]+)\s*\|\s*(Yes|No)\s*\|/gim))
    if (Number(m[1]) <= level) best = { forms: Number(m[2]), cr: m[3], fly: m[4] === 'Yes' };
  return best;
}

const plus = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const min1 = (n: number) => Math.max(1, n);

export const DEFS: Def[] = [
  // -- Barbarian ---------------------------------------------------------------------------------
  {
    cls: 'barbarian',
    feature: 'Brutal Strike',
    id: 'brutalStrike',
    to: 'notes',
    anchor: /extra 1d10 damage/,
    also: [{ feature: 'Improved Brutal Strike', anchor: /increases to 2d10/ }],
    p: (c) => ({ dice: c.level >= 17 ? '2d10' : '1d10' }),
  },
  {
    cls: 'barbarian',
    sub: 'barbarian/path-of-the-berserker',
    feature: 'Frenzy',
    id: 'frenzy',
    to: 'notes',
    anchor: /roll a number of d6s equal to your Rage Damage bonus/,
    p: (c) => ({ dice: `${c.rage}d6` }),
  },
  {
    cls: 'barbarian',
    sub: 'barbarian/path-of-the-zealot',
    feature: 'Divine Fury',
    id: 'divineFury',
    to: 'notes',
    anchor: /1d6 plus half your Barbarian level/,
    p: (c) => ({ dmg: `1d6+${Math.floor(c.level / 2)}` }),
  },
  {
    cls: 'barbarian',
    sub: 'barbarian/path-of-the-zealot',
    feature: 'Fanatical Focus',
    id: 'fanaticalFocus',
    to: 'stats',
    anchor: /a bonus equal to your Rage Damage bonus/,
    p: (c) => ({ n: c.rage }),
  },
  {
    cls: 'barbarian',
    sub: 'barbarian/path-of-the-world-tree',
    feature: 'Vitality of the Tree',
    id: 'vitalityOfTheTree',
    to: 'stats',
    anchor: /Temporary Hit Points equal to your Barbarian level/,
    p: (c) => ({ n: c.level }),
  },
  {
    cls: 'barbarian',
    feature: 'Relentless Rage',
    id: 'relentlessRage',
    to: 'stats',
    anchor: /Hit Points instead change to a number equal to twice your Barbarian level/,
    p: (c) => ({ n: 2 * c.level }),
  },
  // -- Cleric ------------------------------------------------------------------------------------
  {
    cls: 'cleric',
    feature: 'Sear Undead',
    id: 'searUndead',
    to: 'stats',
    anchor: /number of d8s equal to your Wisdom modifier \(minimum of 1d8\)/,
    p: (c) => ({ dice: `${min1(c.mod('WIS'))}d8` }),
  },
  {
    cls: 'cleric',
    feature: 'Blessed Strikes',
    id: 'divineStrike',
    to: 'notes',
    anchor: /extra 1d8 Necrotic or Radiant damage/,
    also: [{ feature: 'Improved Blessed Strikes', anchor: /increases to 2d8/ }],
    p: (c) => ({ dice: c.level >= 14 ? '2d8' : '1d8' }),
  },
  {
    cls: 'cleric',
    sub: 'cleric/life-domain',
    feature: 'Preserve Life',
    id: 'preserveLife',
    to: 'stats',
    anchor: /five times your Cleric level/,
    p: (c) => ({ n: 5 * c.level }),
  },
  {
    cls: 'cleric',
    sub: 'cleric/life-domain',
    feature: 'Disciple of Life',
    id: 'discipleOfLife',
    to: 'stats',
    anchor: /2 plus the spell slot's level/,
  },
  {
    cls: 'cleric',
    sub: 'cleric/light-domain',
    feature: 'Radiance of the Dawn',
    id: 'radianceOfTheDawn',
    to: 'stats',
    anchor: /Radiant damage equal to 2d10 plus your Cleric level/,
    p: (c) => ({ dmg: `2d10+${c.level}`, dc: c.spellDc ?? 0 }),
  },
  {
    cls: 'cleric',
    sub: 'cleric/light-domain',
    feature: 'Improved Warding Flare',
    id: 'wardingFlare',
    to: 'stats',
    anchor: /2d6 plus your Wisdom modifier/,
    p: (c) => ({ n: `2d6${plus(c.mod('WIS'))}` }),
  },
  // -- Druid -------------------------------------------------------------------------------------
  {
    cls: 'druid',
    feature: 'Elemental Fury',
    id: 'primalStrike',
    to: 'notes',
    anchor: /extra 1d8 Cold, Fire, Lightning, or Thunder damage/,
    also: [{ feature: 'Improved Elemental Fury', anchor: /increases to 2d8/ }],
    p: (c) => ({ dice: c.level >= 15 ? '2d8' : '1d8' }),
  },
  {
    cls: 'druid',
    feature: 'Wild Shape',
    id: (c) => (beastShapes(c.text, c.level)?.fly ? 'wildShapeFly' : 'wildShape'),
    to: 'stats',
    anchor: /number of hours equal to half your Druid level/,
    p: (c) => ({
      hours: Math.max(1, Math.floor(c.level / 2)),
      thp: c.level,
      forms: beastShapes(c.text, c.level)?.forms ?? 0,
      cr: beastShapes(c.text, c.level)?.cr ?? '1/4',
    }),
  },
  {
    cls: 'druid',
    sub: 'druid/circle-of-the-moon',
    feature: 'Circle Forms',
    id: 'circleForms',
    to: 'stats',
    anchor: /Druid level divided by 3 \(round down\)/,
    p: (c) => ({ cr: Math.floor(c.level / 3), ac: 13 + c.mod('WIS'), thp: 3 * c.level }),
  },
  {
    cls: 'druid',
    sub: 'druid/circle-of-the-land',
    feature: "Land's Aid",
    id: 'landsAid',
    to: 'stats',
    anchor: /taking 2d6 Necrotic damage on a failed save/,
    also: [
      {
        feature: "Land's Aid",
        anchor: /increase by 1d6 when you reach Druid levels 10 \(3d6\) and 14 \(4d6\)/,
      },
    ],
    p: (c) => ({ dmg: c.level >= 14 ? '4d6' : c.level >= 10 ? '3d6' : '2d6', dc: c.spellDc ?? 0 }),
  },
  {
    cls: 'druid',
    sub: 'druid/circle-of-the-sea',
    feature: 'Wrath of the Sea',
    id: 'wrathOfTheSea',
    to: 'stats',
    anchor: /a number of d6s equal to your Wisdom modifier \(minimum of one die\)/,
    p: (c) => ({ dice: `${min1(c.mod('WIS'))}d6`, dc: c.spellDc ?? 0 }),
  },
  {
    cls: 'druid',
    sub: 'druid/circle-of-the-stars',
    feature: 'Starry Form',
    id: 'starryForm',
    to: 'stats',
    anchor: /1d8 plus your Wisdom modifier/,
    also: [{ feature: 'Twinkling Constellations', anchor: /becomes 2d8/ }],
    p: (c) => ({ n: `${c.level >= 10 ? '2d8' : '1d8'}${plus(c.mod('WIS'))}` }),
  },
  {
    cls: 'druid',
    sub: 'druid/circle-of-the-moon',
    feature: 'Lunar Form',
    id: 'lunarForm',
    to: 'notes',
    anchor: /extra 2d10 Radiant damage to a target you hit with a Wild Shape form's attack/,
  },
  // -- Fighter -----------------------------------------------------------------------------------
  {
    cls: 'fighter',
    feature: 'Second Wind',
    id: 'secondWind',
    to: 'stats',
    anchor: /Hit Points equal to 1d10 plus your Fighter level/,
    p: (c) => ({ n: `1d10+${c.level}` }),
  },
  {
    cls: 'fighter',
    feature: 'Tactical Mind',
    id: 'tacticalMind',
    to: 'stats',
    anchor: /you roll 1d10 and add the number rolled to the ability check/,
  },
  {
    cls: 'fighter',
    feature: 'Indomitable',
    id: 'indomitable',
    to: 'stats',
    anchor: /a bonus equal to your Fighter level/,
    p: (c) => ({ n: c.level }),
  },
  {
    cls: 'fighter',
    sub: 'fighter/psi-warrior',
    feature: 'Psionic Power',
    id: 'protectiveField',
    to: 'stats',
    anchor: /reduce the damage taken by the number rolled plus your Intelligence modifier/,
    p: (c) => (c.poolDie ? { n: `${c.poolDie}${plus(c.mod('INT'))}` } : null),
  },
  {
    cls: 'fighter',
    sub: 'fighter/psi-warrior',
    feature: 'Psionic Power',
    id: 'psionicStrike',
    to: 'notes',
    anchor: /Force damage to the target equal to the number rolled plus your Intelligence modifier/,
    p: (c) => (c.poolDie ? { n: `${c.poolDie}${plus(c.mod('INT'))}` } : null),
  },
  {
    cls: 'fighter',
    sub: 'fighter/champion',
    feature: 'Survivor',
    id: 'heroicRally',
    to: 'stats',
    anchor: /Hit Points equal to 5 plus your Constitution modifier/,
    p: (c) => ({ n: 5 + c.mod('CON') }),
  },
  // -- Monk --------------------------------------------------------------------------------------
  {
    cls: 'monk',
    feature: 'Deflect Attacks',
    id: 'deflectAttacks',
    to: 'stats',
    anchor: /1d10 plus your Dexterity modifier and Monk level/,
    p: (c) => ({ n: `1d10${plus(c.mod('DEX') + c.level)}` }),
  },
  {
    cls: 'monk',
    feature: 'Uncanny Metabolism',
    id: 'uncannyMetabolism',
    to: 'stats',
    anchor: /Hit Points equal to your Monk level plus the number rolled/,
    p: (c) => (c.martial ? { n: `${c.martial}+${c.level}` } : null),
  },
  {
    cls: 'monk',
    feature: 'Heightened Focus',
    id: 'patientDefense',
    to: 'stats',
    anchor: /Temporary Hit Points equal to two rolls of your Martial Arts die/,
    p: (c) => (c.martial ? { dmg: `2${c.martial.slice(1)}` } : null),
  },
  {
    cls: 'monk',
    feature: 'Slow Fall',
    id: 'slowFall',
    to: 'stats',
    anchor: /five times your Monk level/,
    p: (c) => ({ n: 5 * c.level }),
  },
  {
    cls: 'monk',
    sub: 'monk/warrior-of-mercy',
    feature: 'Hand of Harm',
    id: 'handOfHarm',
    to: 'notes',
    anchor:
      /extra Necrotic damage equal to one roll of your Martial Arts die plus your Wisdom modifier/,
    p: (c) => (c.martial ? { n: `${c.martial}${plus(c.mod('WIS'))}` } : null),
  },
  {
    cls: 'monk',
    sub: 'monk/warrior-of-mercy',
    feature: 'Hand of Healing',
    id: 'handOfHealing',
    to: 'stats',
    anchor: /a roll of your Martial Arts die plus your Wisdom modifier/,
    p: (c) => (c.martial ? { n: `${c.martial}${plus(c.mod('WIS'))}` } : null),
  },
  {
    cls: 'monk',
    sub: 'monk/warrior-of-the-open-hand',
    feature: 'Wholeness of Body',
    id: 'wholenessOfBody',
    to: 'stats',
    anchor:
      /roll your Martial Arts die\. You regain a number of Hit Points equal to the number rolled plus your Wisdom modifier/,
    p: (c) => (c.martial ? { n: `${c.martial}${plus(c.mod('WIS'))}` } : null),
  },
  {
    cls: 'monk',
    sub: 'monk/warrior-of-the-elements',
    feature: 'Elemental Burst',
    id: 'elementalBurst',
    to: 'stats',
    anchor: /damage of the chosen type equal to three rolls of your Martial Arts die/,
    p: (c) => (c.martial ? { dmg: `3${c.martial.slice(1)}` } : null),
  },
  {
    cls: 'ranger',
    sub: 'ranger/fey-wanderer',
    feature: 'Otherworldly Glamour',
    id: 'otherworldlyGlamour',
    to: 'stats',
    anchor: /bonus to the check equal to your Wisdom modifier \(Minimum of \+1\)/,
    p: (c) => ({ n: min1(c.mod('WIS')) }),
  },
  {
    cls: 'warlock',
    sub: 'warlock/great-old-one-patron',
    feature: 'Awakened Mind',
    id: 'telepathy',
    to: 'stats',
    anchor: /a number of miles of each other equal to your Charisma modifier \(minimum of 1 mile\)/,
    p: (c) => ({ miles: min1(c.mod('CHA')), minutes: c.level }),
  },
  {
    cls: 'warlock',
    sub: 'warlock/great-old-one-patron',
    feature: 'Create Thrall',
    id: 'createThrall',
    to: 'stats',
    anchor: /Temporary Hit Points equal to your Warlock level plus your Charisma modifier/,
    p: (c) => ({ n: c.level + c.mod('CHA') }),
  },
  {
    cls: 'sorcerer',
    sub: 'sorcerer/aberrant-sorcery',
    feature: 'Telepathic Speech',
    id: 'telepathyOnly',
    to: 'stats',
    anchor: /a number of miles of each other equal to your Charisma modifier \(minimum of 1/,
    p: (c) => ({ miles: min1(c.mod('CHA')) }),
  },
  // -- Paladin -----------------------------------------------------------------------------------
  {
    cls: 'paladin',
    feature: 'Aura of Protection',
    id: 'auraOfProtection',
    to: 'stats',
    anchor: /bonus to saving throws equal to your Charisma modifier \(minimum bonus of \+1\)/,
    also: [{ feature: 'Aura Expansion', anchor: /30-foot Emanation/ }],
    p: (c) => ({ n: min1(c.mod('CHA')), r: c.level >= 18 ? 30 : 10 }),
  },
  {
    cls: 'paladin',
    feature: 'Radiant Strikes',
    id: 'radiantStrikes',
    to: 'notes',
    anchor: /extra 1d8 Radiant damage/,
  },
  {
    cls: 'paladin',
    feature: 'Abjure Foes',
    id: 'abjureFoes',
    to: 'stats',
    anchor: /number of creatures equal to your Charisma modifier \(minimum of one creature\)/,
    p: (c) => ({ n: min1(c.mod('CHA')) }),
  },
  {
    cls: 'paladin',
    feature: 'Channel Divinity',
    id: 'channelDivinityDc',
    to: 'stats',
    anchor: /the DC equals the spell save DC/,
    p: (c) => (c.spellDc ? { n: c.spellDc } : null),
  },
  {
    cls: 'paladin',
    sub: 'paladin/oath-of-devotion',
    feature: 'Sacred Weapon',
    id: 'sacredWeapon',
    to: 'stats',
    anchor:
      /add your Charisma modifier to attack rolls you make with that weapon \(minimum bonus of \+1\)/,
    p: (c) => ({ n: min1(c.mod('CHA')) }),
  },
  {
    cls: 'paladin',
    sub: 'paladin/oath-of-glory',
    feature: 'Inspiring Smite',
    id: 'inspiringSmite',
    to: 'stats',
    anchor: /2d8 plus your Paladin level/,
    p: (c) => ({ n: `2d8+${c.level}` }),
  },
  {
    cls: 'paladin',
    sub: 'paladin/oath-of-glory',
    feature: 'Glorious Defense',
    id: 'gloriousDefense',
    to: 'stats',
    anchor: /The bonus equals your Charisma modifier \(minimum of \+1\)/,
    p: (c) => ({ n: min1(c.mod('CHA')) }),
  },
  {
    cls: 'paladin',
    feature: "Paladin's Smite",
    id: 'divineSmite',
    to: 'notes',
    anchor: /always have the Divine Smite spell prepared/,
  },
  // -- Ranger ------------------------------------------------------------------------------------
  {
    cls: 'ranger',
    feature: 'Favored Enemy',
    id: 'huntersMark',
    to: 'notes',
    anchor: /always have the Hunter's Mark spell prepared/,
    also: [{ feature: 'Foe Slayer', anchor: /damage die of your Hunter's Mark is a d10/ }],
    p: (c) => ({ die: c.level >= 20 ? 'd10' : 'd6' }),
  },
  {
    cls: 'ranger',
    feature: 'Tireless',
    id: 'tireless',
    to: 'stats',
    anchor: /1d8 plus your Wisdom modifier \(minimum of 1\)/,
    p: (c) => ({ n: `1d8+${min1(c.mod('WIS'))}` }),
  },
  {
    cls: 'ranger',
    sub: 'ranger/fey-wanderer',
    feature: 'Dreadful Strikes',
    id: 'dreadfulStrikes',
    to: 'notes',
    anchor: /extra 1d4 Psychic damage/,
    p: (c) => ({ dice: c.level >= 11 ? '1d6' : '1d4' }),
  },
  {
    cls: 'ranger',
    sub: 'ranger/gloom-stalker',
    feature: 'Dread Ambusher',
    id: 'dreadfulStrike',
    to: 'notes',
    anchor: /extra 2d6 Psychic damage/,
    also: [
      { feature: "Stalker's Flurry", anchor: /Psychic damage of your Dreadful Strike becomes 2d8/ },
    ],
    p: (c) => ({ dice: c.level >= 11 ? '2d8' : '2d6', n: min1(c.mod('WIS')) }),
  },
  {
    cls: 'ranger',
    sub: 'ranger/hunter',
    feature: "Hunter's Prey",
    id: 'colossusSlayer',
    to: 'notes',
    anchor: /extra 1d8 damage to the target if it's missing any of its Hit Points/,
  },
  // -- Rogue -------------------------------------------------------------------------------------
  {
    cls: 'rogue',
    sub: 'rogue/assassin',
    feature: 'Assassinate',
    id: 'assassinate',
    to: 'notes',
    anchor: /extra damage of the weapon's type equal to your Rogue level/,
    p: (c) => ({ n: c.level }),
  },
  // -- Sorcerer ----------------------------------------------------------------------------------
  {
    cls: 'sorcerer',
    feature: 'Innate Sorcery',
    id: 'innateSorcery',
    to: 'stats',
    anchor: /spell save DC of your Sorcerer spells increases by 1/,
    p: (c) => (c.spellDc ? { n: c.spellDc + 1 } : null),
  },
  {
    cls: 'sorcerer',
    feature: 'Sorcerous Restoration',
    id: 'sorcerousRestoration',
    to: 'stats',
    anchor: /equal to half your Sorcerer level \(round down\)/,
    p: (c) => ({ n: Math.floor(c.level / 2) }),
  },
  {
    cls: 'sorcerer',
    sub: 'sorcerer/draconic-sorcery',
    feature: 'Elemental Affinity',
    id: 'elementalAffinity',
    to: 'notes',
    anchor: /add your Charisma modifier to one damage roll of that spell/,
    p: (c) => ({ n: plus(c.mod('CHA')) }),
  },
  // -- Warlock -----------------------------------------------------------------------------------
  {
    cls: 'warlock',
    sub: 'warlock/celestial-patron',
    feature: 'Radiant Soul',
    id: 'radiantSoul',
    to: 'notes',
    anchor: /add your Charisma modifier to that spell's damage/,
    p: (c) => ({ n: plus(c.mod('CHA')) }),
  },
  {
    cls: 'warlock',
    sub: 'warlock/fiend-patron',
    feature: "Dark One's Blessing",
    id: 'darkOnesBlessing',
    to: 'stats',
    anchor: /equal to your Charisma modifier plus your Warlock level/,
    p: (c) => ({ n: Math.max(1, c.mod('CHA') + c.level) }),
  },
  {
    cls: 'warlock',
    sub: 'warlock/celestial-patron',
    feature: 'Celestial Resilience',
    id: 'celestialResilience',
    to: 'stats',
    anchor: /equal your Warlock level plus your Charisma modifier/,
    p: (c) => ({
      self: c.level + c.mod('CHA'),
      allies: Math.floor(c.level / 2) + c.mod('CHA'),
    }),
  },
  // -- Wizard ------------------------------------------------------------------------------------
  {
    cls: 'wizard',
    feature: 'Arcane Recovery',
    id: 'arcaneRecovery',
    to: 'stats',
    anchor: /combined level equal to no more than half your Wizard level \(round up\)/,
    p: (c) => ({ n: Math.ceil(c.level / 2) }),
  },
  {
    cls: 'wizard',
    sub: 'wizard/abjurer',
    feature: 'Arcane ward',
    id: 'arcaneWard',
    to: 'stats',
    anchor: /Hit Point maximum equal to twice your Wizard level plus your Intelligence modifier/,
    p: (c) => ({ n: 2 * c.level + c.mod('INT') }),
  },
  // -- Artificer ---------------------------------------------------------------------------------
  {
    cls: 'artificer',
    feature: 'Flash of Genius',
    id: 'flashOfGenius',
    to: 'stats',
    anchor: /The bonus equals your Intelligence modifier/,
    p: (c) => ({ n: plus(c.mod('INT')) }),
  },
];

// -- save DCs written out in the text ----------------------------------------------------------------

const ABILITY_WORD: Record<string, Ability> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

/**
 * "DC 8 plus your Strength modifier and Proficiency Bonus", "DC equals 8 + your proficiency bonus +
 * your Constitution modifier", "8 plus your Strength or Dexterity modifier (your choice) and
 * Proficiency Bonus": the abilities it uses (the better one when the text lets you pick) and
 * whether it adds the Proficiency Bonus. Null if the text states no such DC.
 */
export function writtenDc(text: string): { abilities: Ability[]; pb: boolean }[] {
  const out: { abilities: Ability[]; pb: boolean }[] = [];
  const flat = text.replace(/\*+/g, '').replace(/\s+/g, ' ');
  for (const m of flat.matchAll(/\bDC (?:equals? |is )?8 (?:plus|\+) ([^.;]{0,110})/gi)) {
    const abilities = [
      ...m[1].matchAll(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\b/gi),
    ].map((x) => ABILITY_WORD[x[1].toLowerCase()]);
    if (!abilities.length) continue;
    const dc = { abilities: [...new Set(abilities)], pb: /proficiency bonus/i.test(m[1]) };
    if (!out.some((o) => o.abilities.join() === dc.abilities.join() && o.pb === dc.pb))
      out.push(dc);
  }
  return out;
}

export const dcValue = (
  dc: { abilities: Ability[]; pb: boolean },
  mod: (a: Ability) => number,
  pb: number,
) => 8 + (dc.pb ? pb : 0) + Math.max(...dc.abilities.map(mod));

// -- the numbers of a sheet ------------------------------------------------------------------------

export interface FeatureNumbersInput {
  classes: { id: string; level: number; subclassId?: string | null }[];
  /** Everything gained, class and subclass features with their texts. */
  features: Pick<SheetFeature, 'name' | 'description' | 'source' | 'level'>[];
  pb: number;
  abilities: Sheet['abilities'];
  martialArts: string | null;
  rageDamage: number;
  spellDc: (classId: string) => number | null;
}

/** Notes and stats of the features the character has. */
export function featureNumbers(input: FeatureNumbersInput): {
  notes: FeatureNote[];
  stats: FeatureNote[];
} {
  const notes: FeatureNote[] = [];
  const stats: FeatureNote[] = [];
  const mod = (a: Ability) => input.abilities[a].modifier;
  const pools = poolsOf(input.features, input.classes);
  const has = (cls: string, sub: string | undefined, name: string) =>
    input.features.some(
      (f) =>
        f.name === name &&
        (sub ? f.source.type === 'subclass' && f.source.id === sub : f.source.id === cls),
    );
  for (const def of DEFS) {
    const c = input.classes.find((x) => x.id === def.cls);
    if (!c || (def.sub && c.subclassId !== def.sub) || !has(def.cls, def.sub, def.feature))
      continue;
    const pool = pools.find((p) => p.classId === c.id);
    const ctx: Ctx = {
      level: c.level,
      pb: input.pb,
      mod,
      martial: def.cls === 'monk' ? input.martialArts : null,
      rage: input.rageDamage,
      spellDc: input.spellDc(c.id),
      poolDie: pool?.die ?? null,
      text:
        input.features.find((f) => f.name === def.feature && f.source.id === (def.sub ?? def.cls))
          ?.description ?? '',
    };
    const params = def.p ? def.p(ctx) : {};
    if (params === null) continue;
    const id = typeof def.id === 'function' ? def.id(ctx) : def.id;
    const use = USE[id];
    const focusDc = 8 + input.pb + mod('WIS');
    const saveDc = use?.dc === 'spell' ? ctx.spellDc : use?.dc === 'focus' ? focusDc : null;
    (def.to === 'notes' ? notes : stats).push({
      id,
      source: def.feature,
      ...(use ? { action: use.action } : {}),
      ...(use?.spends ? { spends: use.spends } : {}),
      ...(saveDc ? { saveDc } : {}),
      ...(Object.keys(params).length ? { params } : {}),
    });
  }
  // save DCs the text writes out ("DC 8 plus your Wisdom modifier and Proficiency Bonus")
  const seen = new Set<string>();
  for (const f of input.features) {
    for (const dc of writtenDc(f.description ?? '')) {
      const key = `${f.name}:${dc.abilities.join()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stats.push({
        id: 'dc',
        source: f.name,
        params: { n: dcValue(dc, mod, input.pb) },
        ...(dc.abilities.length === 1 ? { ability: dc.abilities[0] } : {}),
      });
    }
  }
  return { notes, stats };
}

/** The text of a feature as the parsers read it. */
export const textOf = (f: RuleText) => f.description ?? '';
