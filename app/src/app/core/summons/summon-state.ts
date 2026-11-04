import { CombatMonster, modifier } from '../dm/combat';
import { Monster } from '../models/compendium';

/**
 * What the character sheet remembers about its summoned creatures (character.state.summons):
 * which ones are out, the damage they took, temporary hit points, limited uses spent and the
 * choices made per source (spell slot level, creature type). Pure: every function returns a new
 * state. Damage is kept instead of current HP so that a creature stays consistent when its
 * maximum changes with the slot level.
 */

export interface SummonedCreature {
  on: boolean;
  /** Hit points lost (0 = full). */
  damage: number;
  temp: number;
  /** Limited uses spent: usage key (monster-actions.ts) → how many. */
  used: Record<string, number>;
}

export interface SummonsState {
  /** Show only the creatures marked as summoned. */
  hideInactive: boolean;
  /** Slot level chosen per source id. */
  scale: Record<string, number>;
  /** Creature type chosen per source id (familiars: celestial, fey, fiend). */
  types: Record<string, string>;
  /** By creature key (source id + "|" + option key). */
  creatures: Record<string, SummonedCreature>;
}

export function emptySummons(): SummonsState {
  return { hideInactive: false, scale: {}, types: {}, creatures: {} };
}

export const creatureKey = (sourceId: string, optionKey: string) => `${sourceId}|${optionKey}`;

const FRESH: SummonedCreature = { on: false, damage: 0, temp: 0, used: {} };

const nonNegative = (n: unknown) => (typeof n === 'number' && n > 0 ? Math.floor(n) : 0);

/** Accepts what any version saved; anything else → undefined (the character has no summons yet). */
export function normalizeSummons(raw: unknown): SummonsState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<SummonsState>;
  const out = emptySummons();
  out.hideInactive = r.hideInactive === true;
  for (const [k, v] of Object.entries(r.scale ?? {})) {
    if (typeof v === 'number' && v >= 0 && v <= 9) out.scale[k] = Math.floor(v);
  }
  for (const [k, v] of Object.entries(r.types ?? {})) {
    if (typeof v === 'string') out.types[k] = v;
  }
  for (const [k, v] of Object.entries(r.creatures ?? {})) {
    if (!v || typeof v !== 'object') continue;
    const c = v as Partial<SummonedCreature>;
    const used: Record<string, number> = {};
    for (const [u, n] of Object.entries(c.used ?? {})) if (nonNegative(n)) used[u] = nonNegative(n);
    out.creatures[k] = {
      on: c.on === true,
      damage: nonNegative(c.damage),
      temp: nonNegative(c.temp),
      used,
    };
  }
  return out;
}

export const creatureOf = (s: SummonsState | undefined, key: string): SummonedCreature =>
  s?.creatures[key] ?? FRESH;

export const isSummoned = (s: SummonsState | undefined, key: string) => creatureOf(s, key).on;

/** How many creatures are marked as summoned. */
export const summonedCount = (s: SummonsState | undefined) =>
  Object.values(s?.creatures ?? {}).filter((c) => c.on).length;

/** Marks a creature as summoned (a new one: full HP, nothing spent) or as gone. */
export function setSummoned(s: SummonsState | undefined, key: string, on: boolean): SummonsState {
  const base = s ?? emptySummons();
  const was = creatureOf(base, key);
  if (was.on === on) return base;
  return {
    ...base,
    creatures: { ...base.creatures, [key]: on ? { ...FRESH, on: true } : { ...was, on: false } },
  };
}

export function setHideInactive(s: SummonsState | undefined, hide: boolean): SummonsState {
  return { ...(s ?? emptySummons()), hideInactive: hide };
}

export function setScale(
  s: SummonsState | undefined,
  sourceId: string,
  level: number,
): SummonsState {
  const base = s ?? emptySummons();
  return { ...base, scale: { ...base.scale, [sourceId]: level } };
}

export function setType(s: SummonsState | undefined, sourceId: string, type: string): SummonsState {
  const base = s ?? emptySummons();
  return { ...base, types: { ...base.types, [sourceId]: type } };
}

/** All creatures gone and fresh; the choices (slot level, type) are kept. */
export function dismissAll(s: SummonsState | undefined): SummonsState {
  const base = s ?? emptySummons();
  return { ...base, creatures: {} };
}

/** Everything back to how it starts. */
export function resetSummons(s: SummonsState | undefined): SummonsState {
  return { ...emptySummons(), hideInactive: s?.hideInactive ?? false };
}

// -- the combat card adapter ---------------------------------------------------------------

/** The creature as the combat card shows it (same shape as a monster of the combat helper). */
export function toCombatMonster(
  key: string,
  monster: Monster,
  state: SummonedCreature,
): CombatMonster {
  const hpMax = Math.max(1, monster.hp);
  return {
    id: key,
    monsterId: monster.id,
    name: monster.name,
    number: 1,
    ac: monster.ac,
    hpMax,
    hp: Math.max(0, hpMax - state.damage),
    temp: state.temp,
    initBonus: monster.initiative ?? modifier(monster.abilities.DEX),
    dex: monster.abilities.DEX,
    initiative: null,
    used: state.used,
  };
}

/** Applies a change made on the combat card (damage, healing, a use ticked) to the state. */
export function updateCreature(
  s: SummonsState | undefined,
  key: string,
  monster: Monster,
  change: (m: CombatMonster) => CombatMonster,
): SummonsState {
  const base = s ?? emptySummons();
  const was = creatureOf(base, key);
  const next = change(toCombatMonster(key, monster, was));
  return {
    ...base,
    creatures: {
      ...base.creatures,
      [key]: {
        on: was.on,
        damage: Math.max(0, next.hpMax - next.hp),
        temp: next.temp,
        used: next.used,
      },
    },
  };
}
