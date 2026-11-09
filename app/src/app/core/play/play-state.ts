import { Character } from '../models/character';
import { Sheet } from '../rules/sheet';
import { poolsOf } from '../rules/pools';
import { Recovery, recover, restKey, restRule } from './rest-rules';

/**
 * In-game state: hit points, spent slots, used resources, Hit Dice, death saves. Every function
 * is pure and returns a new state; the character sheet saves it.
 */
export type PlayState = Character['state'];

/** classId of the resources that come from a feat. */
export const FEAT_CLASS = 'feat';

/** A class resource with a number of uses to spend. */
export interface PlayResource {
  /** Key in state.resources: "<classId>:<normalised name>". */
  key: string;
  classId: string;
  /** English name: a class table column (shown with the glossary) or a feature. */
  name: string;
  /** UI text key for resources that come from a feature instead of a column. */
  labelKey: string | null;
  max: number;
  /** What a Short Rest recovers (a Long Rest recovers everything). */
  short: Recovery;
  /** English name of the feat it comes from (free casts and uses of feats); absent for classes. */
  feat?: string;
  /** Size of the dice it counts ("d8"), for a pool of dice or a resource that is a die. */
  die?: string;
}

/**
 * Uses that a feature's text gives instead of a class table column. from: class level;
 * subclassId: only for that subclass. What a Short Rest recovers is in rest-rules.ts.
 */
const FEATURE_USES: {
  classId: string;
  subclassId?: string;
  name: string;
  labelKey: string;
  from: number;
  uses: (level: number, mod: (a: 'INT' | 'WIS' | 'CHA') => number) => number;
  /** Class table column that holds the size of the die it counts ("Bardic Die"). */
  dieColumn?: string;
}[] = [
  {
    classId: 'artificer',
    name: 'Flash of Genius',
    labelKey: 'play.res.flashOfGenius',
    from: 7,
    uses: (_, m) => m('INT'),
  },
  {
    classId: 'bard',
    name: 'Bardic Inspiration',
    labelKey: 'play.res.bardicInspiration',
    from: 1,
    uses: (_, m) => m('CHA'),
    dieColumn: 'Bardic Die',
  },
  {
    classId: 'blood-hunter',
    name: 'Blood Maledict',
    labelKey: 'play.res.bloodMaledict',
    from: 1,
    uses: (l) => (l >= 17 ? 4 : l >= 13 ? 3 : l >= 6 ? 2 : 1),
    dieColumn: 'Hemocraft Die',
  },
  {
    classId: 'blood-hunter',
    subclassId: 'blood-hunter/order-of-the-lycan',
    name: 'Hybrid Transformation',
    labelKey: 'play.res.hybridTransformation',
    from: 3,
    uses: () => 1,
  },
  {
    classId: 'cleric',
    name: 'Divine Intervention',
    labelKey: 'play.res.divineIntervention',
    from: 10,
    uses: () => 1,
  },
  {
    classId: 'druid',
    name: 'Wild Resurgence',
    labelKey: 'play.res.wildResurgence',
    from: 5,
    uses: () => 1,
  },
  {
    classId: 'fighter',
    name: 'Action Surge',
    labelKey: 'play.res.actionSurge',
    from: 2,
    uses: (l) => (l >= 17 ? 2 : 1),
  },
  {
    classId: 'fighter',
    name: 'Indomitable',
    labelKey: 'play.res.indomitable',
    from: 9,
    uses: (l) => (l >= 17 ? 3 : l >= 13 ? 2 : 1),
  },
  {
    classId: 'fighter',
    subclassId: 'fighter/battle-master',
    name: 'Superiority Dice',
    labelKey: 'play.res.superiorityDice',
    from: 3,
    uses: (l) => (l >= 15 ? 6 : l >= 7 ? 5 : 4),
  },
  {
    classId: 'monk',
    name: 'Uncanny Metabolism',
    labelKey: 'play.res.uncannyMetabolism',
    from: 2,
    uses: () => 1,
  },
  {
    classId: 'paladin',
    name: 'Lay On Hands',
    labelKey: 'play.res.layOnHands',
    from: 1,
    uses: (l) => 5 * l,
  },
  {
    classId: 'paladin',
    name: 'Faithful Steed',
    labelKey: 'play.res.faithfulSteed',
    from: 5,
    uses: () => 1,
  },
  {
    classId: 'ranger',
    name: 'Tireless',
    labelKey: 'play.res.tireless',
    from: 10,
    uses: (_, m) => m('WIS'),
  },
  {
    classId: 'ranger',
    name: "Nature's Veil",
    labelKey: 'play.res.naturesVeil',
    from: 14,
    uses: (_, m) => m('WIS'),
  },
  {
    classId: 'rogue',
    name: 'Stroke of Luck',
    labelKey: 'play.res.strokeOfLuck',
    from: 20,
    uses: () => 1,
  },
  {
    classId: 'sorcerer',
    name: 'Innate Sorcery',
    labelKey: 'play.res.innateSorcery',
    from: 1,
    uses: () => 2,
  },
  {
    classId: 'warlock',
    name: 'Magical Cunning',
    labelKey: 'play.res.magicalCunning',
    from: 2,
    uses: () => 1,
  },
  // one use of each arcanum (levels 6, 7, 8 and 9 spells at warlock 11, 13, 15, 17)
  {
    classId: 'warlock',
    name: 'Mystic Arcanum',
    labelKey: 'play.res.mysticArcanum',
    from: 11,
    uses: (l) => (l >= 17 ? 4 : l >= 15 ? 3 : l >= 13 ? 2 : 1),
  },
  {
    classId: 'wizard',
    name: 'Arcane Recovery',
    labelKey: 'play.res.arcaneRecovery',
    from: 1,
    uses: () => 1,
  },
];

/**
 * Size of the Battle Master's Superiority Dice: "which are d8s", and "Your Superiority Die
 * becomes a d10 / d12" in the features gained later.
 */
function superiorityDie(sheet: Sheet): string | undefined {
  let die: string | undefined;
  for (const f of sheet.features) {
    const base = /Superiority Dice, which are (d\d+)s/i.exec(f.description);
    if (base) die = base[1];
  }
  for (const f of [...sheet.features].sort((a, b) => a.level - b.level)) {
    const up = /Superiority Die becomes a (d\d+)/i.exec(f.description);
    if (up) die = up[1];
  }
  return die;
}

/**
 * The countable resources of a sheet: the class table columns with a number of uses (Rages,
 * Channel Divinity, Focus Points...) plus a few uses defined only in a feature's text.
 */
export function playResources(sheet: Sheet): PlayResource[] {
  const level = (id: string) => sheet.classes.find((c) => c.id === id)?.level ?? 0;
  const make = (
    classId: string,
    name: string,
    max: number,
    labelKey: string | null,
    die?: string,
  ): PlayResource => {
    const rule = restRule(name);
    const short = rule.shortFromLevel && level(classId) < rule.shortFromLevel ? 0 : rule.short;
    const r: PlayResource = {
      key: `${classId}:${restKey(name)}`,
      classId,
      name,
      labelKey,
      max,
      short,
    };
    if (die) r.die = die;
    return r;
  };
  const column = (classId: string, name: string) =>
    sheet.resources
      .find((r) => r.classId === classId && r.name === name)
      ?.value.trim()
      .toLowerCase() || undefined;

  const resources: PlayResource[] = [];
  for (const r of sheet.resources) {
    const rule = restRule(r.name);
    if (rule.passive) continue;
    const value = r.value.trim();
    const count = /^\d+$/.test(value) ? Number(value) : 0;
    if (count > 0) resources.push(make(r.classId, r.name, count, null));
  }

  const mod = (a: 'INT' | 'WIS' | 'CHA') => Math.max(1, sheet.abilities[a].modifier);
  const subclass = (id: string) => sheet.classes.find((c) => c.id === id)?.subclassId ?? null;
  for (const f of FEATURE_USES) {
    const lvl = level(f.classId);
    if (!lvl || lvl < f.from || (f.subclassId && subclass(f.classId) !== f.subclassId)) continue;
    const max = f.uses(lvl, mod);
    const die = f.dieColumn
      ? column(f.classId, f.dieColumn)
      : f.name === 'Superiority Dice'
        ? superiorityDie(sheet)
        : undefined;
    if (max > 0) resources.push(make(f.classId, f.name, max, f.labelKey, die));
  }
  // pools of dice read from the subclass feature's text (Psionic Energy Dice, Warrior of the Gods...)
  for (const p of poolsOf(sheet.features ?? [], sheet.classes))
    resources.push(make(p.classId, p.def.name, p.count, p.def.labelKey, p.die));
  // free casts and benefits of feats (Find Familiar once per Long Rest, Luck Points...)
  for (const u of sheet.featUses ?? [])
    resources.push({
      key: u.key,
      classId: FEAT_CLASS,
      name: u.label,
      labelKey: u.labelKey,
      max: u.max,
      short: u.rest === 'short-or-long' ? 'all' : 0,
      feat: u.feat,
    });
  return resources;
}

// -- hit points ------------------------------------------------------------------------

export function currentHp(state: PlayState, maxHp: number): number {
  return Math.min(state.hpCurrent ?? maxHp, maxHp);
}

/** Sets current HP within 0..max. Full HP is stored as null so it follows the max on level up. */
export function setHp(state: PlayState, value: number, maxHp: number): PlayState {
  const hp = clamp(value, 0, maxHp);
  // regaining any HP ends dying: the death saves start over
  const deathSaves = hp > 0 ? { successes: 0, failures: 0 } : state.deathSaves;
  return { ...state, hpCurrent: hp === maxHp ? null : hp, deathSaves };
}

/** Temporary HP absorb damage first. Damage at 0 HP is a failed death save. */
export function applyDamage(state: PlayState, amount: number, maxHp: number): PlayState {
  if (!(amount > 0)) return state;
  const hp = currentHp(state, maxHp);
  const absorbed = Math.min(state.hpTemp, amount);
  const rest = amount - absorbed;
  const next = { ...state, hpTemp: state.hpTemp - absorbed };
  if (hp === 0 && rest > 0) {
    const failures = Math.min(3, state.deathSaves.failures + 1);
    return { ...next, deathSaves: { ...state.deathSaves, failures } };
  }
  return setHp(next, hp - rest, maxHp);
}

export function heal(state: PlayState, amount: number, maxHp: number): PlayState {
  if (!(amount > 0)) return state;
  return setHp(state, currentHp(state, maxHp) + amount, maxHp);
}

/** Temporary HP don't add up: the new amount replaces the old one. */
export function setTempHp(state: PlayState, value: number): PlayState {
  return { ...state, hpTemp: Math.max(0, Math.floor(value) || 0) };
}

// -- spending ----------------------------------------------------------------------------

/**
 * A row of pips with `used` of them marked: tapping a marked pip unmarks it and those after it,
 * tapping an unmarked one marks it and those before it. Returns the new number used.
 */
export function tapPip(used: number, index: number): number {
  return index < used ? index : index + 1;
}

/** Spell slots of a level (1–9) spent. */
export function setSpentSlots(
  state: PlayState,
  level: number,
  spent: number,
  max: number,
): PlayState {
  const spentSlots = [...state.spentSlots];
  while (spentSlots.length < 9) spentSlots.push(0);
  spentSlots[level - 1] = clamp(spent, 0, max);
  return { ...state, spentSlots };
}

export function setPactSpent(state: PlayState, spent: number, max: number): PlayState {
  return { ...state, pactSlotsSpent: clamp(spent, 0, max) };
}

export function setResourceUsed(state: PlayState, key: string, used: number, max: number) {
  return { ...state, resources: { ...state.resources, [key]: clamp(used, 0, max) } };
}

/** die: "d10". */
export function setHitDiceSpent(state: PlayState, die: string, spent: number, max: number) {
  return { ...state, hitDiceSpent: { ...state.hitDiceSpent, [die]: clamp(spent, 0, max) } };
}

/** The fixed value of a Hit Die (the same as for hit points on level up): d10 → 6. */
export function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1;
}

/**
 * Spends one Hit Die (usually on a Short Rest): heals the roll + CON modifier.
 * Nothing happens when there are none of that size left.
 */
export function spendHitDie(
  state: PlayState,
  hitDie: { die: number; count: number },
  roll: number,
  conModifier: number,
  maxHp: number,
): PlayState {
  const die = `d${hitDie.die}`;
  const spent = state.hitDiceSpent[die] ?? 0;
  if (spent >= hitDie.count || !(roll >= 1)) return state;
  const healed = heal(state, Math.max(0, roll + conModifier), maxHp);
  return setHitDiceSpent(healed, die, spent + 1, hitDie.count);
}

// -- death saves and inspiration ---------------------------------------------------------

export function setDeathSaves(state: PlayState, successes: number, failures: number): PlayState {
  return {
    ...state,
    deathSaves: { successes: clamp(successes, 0, 3), failures: clamp(failures, 0, 3) },
  };
}

export function setHeroicInspiration(state: PlayState, on: boolean): PlayState {
  return { ...state, heroicInspiration: on };
}

// -- rests -------------------------------------------------------------------------------

/** Pact Magic slots and the short-rest resources come back. Hit Dice are spent separately. */
export function shortRest(state: PlayState, resources: PlayResource[]): PlayState {
  const used = { ...state.resources };
  for (const r of resources) {
    if (used[r.key]) used[r.key] = recover(used[r.key], r.short);
  }
  return { ...state, pactSlotsSpent: 0, resources: used };
}

/**
 * All hit points, all spell slots, all spent Hit Dice and every resource come back; temporary
 * HP are lost and Exhaustion goes down one level. Heroic Inspiration and conditions are kept.
 */
export function longRest(state: PlayState): PlayState {
  const { tempSlots: _temp, ...rest } = state; // extra slots from Drain Magic Item end here
  return {
    ...rest,
    hpCurrent: null,
    hpTemp: 0,
    spentSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactSlotsSpent: 0,
    resources: {},
    hitDiceSpent: {},
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: Math.max(0, (state.exhaustion ?? 0) - 1),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(n) || 0));
}
