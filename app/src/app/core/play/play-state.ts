import { Character } from '../models/character';
import { Sheet } from '../rules/sheet';
import { Recovery, recover, restKey, restRule } from './rest-rules';

/**
 * In-game state: hit points, spent slots, used resources, Hit Dice, death saves. Every function
 * is pure and returns a new state; the character sheet saves it.
 */
export type PlayState = Character['state'];

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
}

/**
 * The countable resources of a sheet: the class table columns with a number of uses (Rages,
 * Channel Divinity, Focus Points...) plus a few uses defined only in a feature's text.
 */
export function playResources(sheet: Sheet): PlayResource[] {
  const level = (id: string) => sheet.classes.find((c) => c.id === id)?.level ?? 0;
  const make = (classId: string, name: string, max: number, labelKey: string | null) => {
    const rule = restRule(name);
    const short = rule.shortFromLevel && level(classId) < rule.shortFromLevel ? 0 : rule.short;
    return { key: `${classId}:${restKey(name)}`, classId, name, labelKey, max, short };
  };

  const resources: PlayResource[] = [];
  for (const r of sheet.resources) {
    const rule = restRule(r.name);
    if (rule.passive) continue;
    const value = r.value.trim();
    const count = /^\d+$/.test(value) ? Number(value) : 0;
    if (count > 0) resources.push(make(r.classId, r.name, count, null));
  }

  const bard = level('bard');
  if (bard) {
    const uses = Math.max(1, sheet.abilities.CHA.modifier);
    resources.push(make('bard', 'Bardic Inspiration', uses, 'play.res.bardicInspiration'));
  }
  const fighter = level('fighter');
  if (fighter >= 2) {
    resources.push(make('fighter', 'Action Surge', fighter >= 17 ? 2 : 1, 'play.res.actionSurge'));
  }
  const hunter = level('blood-hunter');
  if (hunter) {
    const uses = hunter >= 17 ? 4 : hunter >= 13 ? 3 : hunter >= 6 ? 2 : 1;
    resources.push(make('blood-hunter', 'Blood Maledict', uses, 'play.res.bloodMaledict'));
  }
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
 * HP are lost. Heroic Inspiration is kept.
 */
export function longRest(state: PlayState): PlayState {
  return {
    ...state,
    hpCurrent: null,
    hpTemp: 0,
    spentSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactSlotsSpent: 0,
    resources: {},
    hitDiceSpent: {},
    deathSaves: { successes: 0, failures: 0 },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(n) || 0));
}
