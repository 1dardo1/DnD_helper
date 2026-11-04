import { Condition } from '../play/conditions';

/**
 * The DM's combat (initiative) tracker. Everything here is pure: each function takes a state and
 * returns a new one; CombatStore keeps it and saves it on the device after every change.
 */

export type CombatantKind = 'monster' | 'character' | 'custom';

export interface ActiveCondition {
  id: Condition;
  /** Rounds left, counted down at the start of the combatant's turn; null: until removed. */
  rounds: number | null;
}

export interface Combatant {
  id: string;
  kind: CombatantKind;
  /** Monsters: the English name from the compendium (shown translated); others: as typed. */
  name: string;
  /** Monsters: "Goblin 2" (the number is shown when there's more than one of them). */
  number: number | null;
  monsterId: string | null;
  characterId: string | null;
  /** null: not tracked (a player whose sheet the DM doesn't have). */
  ac: number | null;
  hpMax: number | null;
  hp: number | null;
  temp: number;
  initBonus: number;
  /** Dexterity score, for ties. */
  dex: number | null;
  /** The initiative roll (total); null until rolled or typed. */
  initiative: number | null;
  conditions: ActiveCondition[];
  concentration: boolean;
  notes: string;
  /** Experience points (monsters). */
  xp: number;
}

export interface CombatState {
  /** In initiative order once sorted; the order can be adjusted by hand. */
  combatants: Combatant[];
  /** 0 before the fight starts. */
  round: number;
  /** Index in combatants of whose turn it is. */
  turn: number;
  /** Encounter loaded (from the encounter builder), if any. */
  encounterId: string | null;
  encounterName: string | null;
  /** Roll one initiative per kind of monster instead of one per monster. */
  groupRolls: boolean;
  /** Conditions of the current combatant before the start of its turn, so "previous" can undo it. */
  lastTick: { id: string; conditions: ActiveCondition[] } | null;
  /** XP of defeated monsters removed from the list (so they still count). */
  removedXp: number;
  nextId: number;
}

export function emptyCombat(): CombatState {
  return {
    combatants: [],
    round: 0,
    turn: 0,
    encounterId: null,
    encounterName: null,
    groupRolls: false,
    lastTick: null,
    removedXp: 0,
    nextId: 1,
  };
}

/** Accepts what was saved by this or an older version of the app; anything else → undefined. */
export function normalizeCombat(raw: unknown): CombatState | undefined {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as CombatState).combatants)) return;
  const s = { ...emptyCombat(), ...(raw as Partial<CombatState>) } as CombatState;
  s.combatants = s.combatants.map((c) => ({ ...blank(c.kind, c.name), ...c }));
  s.turn = Math.min(Math.max(0, s.turn), Math.max(0, s.combatants.length - 1));
  return s;
}

function blank(kind: CombatantKind, name: string): Combatant {
  return {
    id: '',
    kind,
    name,
    number: null,
    monsterId: null,
    characterId: null,
    ac: null,
    hpMax: null,
    hp: null,
    temp: 0,
    initBonus: 0,
    dex: null,
    initiative: null,
    conditions: [],
    concentration: false,
    notes: '',
    xp: 0,
  };
}

// -- adding --------------------------------------------------------------------------------

/** What's needed of a compendium monster. */
export interface MonsterInfo {
  id: string;
  name: string;
  ac: number;
  hp: number;
  hitDice: string;
  initiative: number | null;
  dex: number;
  xp: number;
}

export type Roll = () => number;
/** d20 (or any die) with Math.random. */
export const randomDie =
  (sides: number): Roll =>
  () =>
    1 + Math.floor(Math.random() * sides);

export function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Adds `count` monsters, numbered after the ones of the same kind already there. */
export function addMonsters(
  state: CombatState,
  m: MonsterInfo,
  count: number,
  hpOf: (m: MonsterInfo) => number = (x) => x.hp,
): CombatState {
  const n = Math.max(0, Math.floor(count) || 0);
  if (!n) return state;
  let last = Math.max(
    0,
    ...state.combatants.filter((c) => c.monsterId === m.id).map((c) => c.number ?? 0),
  );
  let nextId = state.nextId;
  const added: Combatant[] = [];
  for (let i = 0; i < n; i++) {
    const hp = Math.max(1, hpOf(m));
    added.push({
      ...blank('monster', m.name),
      id: `c${nextId++}`,
      number: ++last,
      monsterId: m.id,
      ac: m.ac,
      hpMax: hp,
      hp,
      initBonus: m.initiative ?? modifier(m.dex),
      dex: m.dex,
      xp: m.xp,
    });
  }
  return { ...state, combatants: [...state.combatants, ...added], nextId };
}

export interface CombatantInput {
  kind: 'character' | 'custom';
  name: string;
  characterId?: string | null;
  ac?: number | null;
  hpMax?: number | null;
  hp?: number | null;
  temp?: number;
  initBonus?: number;
  dex?: number | null;
}

export function addCombatant(state: CombatState, input: CombatantInput): CombatState {
  const hpMax = input.hpMax ?? null;
  const c: Combatant = {
    ...blank(input.kind, input.name.trim() || '?'),
    id: `c${state.nextId}`,
    characterId: input.characterId ?? null,
    ac: input.ac ?? null,
    hpMax,
    hp: hpMax === null ? null : Math.min(hpMax, Math.max(0, input.hp ?? hpMax)),
    temp: Math.max(0, input.temp ?? 0),
    initBonus: input.initBonus ?? 0,
    dex: input.dex ?? null,
  };
  return { ...state, combatants: [...state.combatants, c], nextId: state.nextId + 1 };
}

/** Removes a combatant, keeping the turn on whoever had it (or the next one if it was them). */
export function removeCombatant(state: CombatState, id: string): CombatState {
  const index = state.combatants.findIndex((c) => c.id === id);
  if (index < 0) return state;
  const removed = state.combatants[index];
  const combatants = state.combatants.filter((c) => c.id !== id);
  const removedXp = state.removedXp + (isDefeated(removed) ? removed.xp : 0);
  let turn = state.turn;
  if (index < turn) turn--;
  if (turn >= combatants.length) turn = 0;
  return { ...state, combatants, turn, removedXp, lastTick: null };
}

/** "20d10 + 40" rolled. Falls back to `average` if the text can't be read. */
export function rollHitDice(hitDice: string, average: number, die: (sides: number) => number) {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(hitDice ?? '');
  if (!m) return average;
  let total = 0;
  for (let i = 0; i < +m[1]; i++) total += die(+m[2]);
  if (m[3]) total += (m[3] === '-' ? -1 : 1) * +m[4];
  return Math.max(1, total);
}

// -- initiative ----------------------------------------------------------------------------

/**
 * Initiative order: highest roll first; ties go to the higher initiative bonus, then the higher
 * Dexterity, then keep the order they had (so ties settled by hand stay settled). Not rolled yet
 * go last. The current turn follows whoever had it.
 */
export function sortByInitiative(state: CombatState): CombatState {
  const current = state.combatants[state.turn]?.id;
  const indexed = state.combatants.map((c, i) => ({ c, i }));
  indexed.sort(
    (a, b) =>
      (b.c.initiative ?? -Infinity) - (a.c.initiative ?? -Infinity) ||
      b.c.initBonus - a.c.initBonus ||
      (b.c.dex ?? 0) - (a.c.dex ?? 0) ||
      a.i - b.i,
  );
  const combatants = indexed.map((x) => x.c);
  return { ...state, combatants, turn: turnOf(combatants, current) };
}

/**
 * Rolls d20 + bonus for the monsters (only those without a roll unless `all`), one per monster or
 * one per kind of monster, and sorts.
 */
export function rollMonsterInitiative(
  state: CombatState,
  d20: Roll,
  opts: { perGroup?: boolean; all?: boolean } = {},
): CombatState {
  const groupRoll = new Map<string, number>();
  const combatants = state.combatants.map((c) => {
    if (c.kind !== 'monster' || (!opts.all && c.initiative !== null)) return c;
    if (opts.perGroup && c.monsterId) {
      if (!groupRoll.has(c.monsterId)) groupRoll.set(c.monsterId, d20());
      return { ...c, initiative: groupRoll.get(c.monsterId)! + c.initBonus };
    }
    return { ...c, initiative: d20() + c.initBonus };
  });
  return sortByInitiative({ ...state, combatants });
}

export function setInitiative(state: CombatState, id: string, value: number | null): CombatState {
  const v = value === null || !Number.isFinite(value) ? null : Math.floor(value);
  return update(state, id, (c) => ({ ...c, initiative: v }));
}

/** Moves a combatant one place up (-1) or down (+1); the turn stays with whoever had it. */
export function moveCombatant(state: CombatState, id: string, step: -1 | 1): CombatState {
  const i = state.combatants.findIndex((c) => c.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= state.combatants.length) return state;
  const current = state.combatants[state.turn]?.id;
  const combatants = [...state.combatants];
  [combatants[i], combatants[j]] = [combatants[j], combatants[i]];
  return { ...state, combatants, turn: turnOf(combatants, current) };
}

function turnOf(combatants: Combatant[], id: string | undefined): number {
  return Math.max(
    0,
    combatants.findIndex((c) => c.id === id),
  );
}

// -- turns and rounds ----------------------------------------------------------------------

/** A monster at 0 HP is out of the fight (its turn is skipped); characters still roll saves. */
export function isDefeated(c: Combatant): boolean {
  return c.kind === 'monster' && c.hp === 0;
}

/** At 0 HP: dead (monsters) or unconscious (characters and custom entries). */
export function downState(c: Combatant): 'dead' | 'unconscious' | null {
  if (c.hp !== 0) return null;
  return c.kind === 'monster' ? 'dead' : 'unconscious';
}

/** Round 1, first in the order (sorted first). */
export function startCombat(state: CombatState): CombatState {
  const sorted = sortByInitiative(state);
  const first = sorted.combatants.findIndex((c) => !isDefeated(c));
  return startTurn({ ...sorted, round: 1, turn: Math.max(0, first) });
}

/** Next combatant (skipping defeated monsters); after the last one, a new round. */
export function nextTurn(state: CombatState): CombatState {
  const n = state.combatants.length;
  if (!n) return state;
  if (state.round === 0) return startCombat(state);
  let turn = state.turn;
  let round = state.round;
  for (let step = 0; step < n; step++) {
    turn++;
    if (turn >= n) {
      turn = 0;
      round++;
    }
    if (!isDefeated(state.combatants[turn])) break;
  }
  return startTurn({ ...state, turn, round });
}

/**
 * Back to the previous combatant (skipping defeated monsters). Undoes the countdown of the turn
 * being left if it was the last one done.
 */
export function previousTurn(state: CombatState): CombatState {
  const n = state.combatants.length;
  if (!n || state.round === 0) return state;
  let s = state;
  const current = s.combatants[s.turn];
  if (s.lastTick && current && s.lastTick.id === current.id) {
    const conditions = s.lastTick.conditions;
    s = update(s, current.id, (c) => ({ ...c, conditions }));
  }
  let turn = s.turn;
  let round = s.round;
  for (let step = 0; step < n; step++) {
    if (turn === 0) {
      if (round <= 1) return { ...s, lastTick: null };
      round--;
      turn = n;
    }
    turn--;
    if (!isDefeated(s.combatants[turn])) break;
  }
  return { ...s, turn, round, lastTick: null };
}

/** Start of the current combatant's turn: their conditions with a duration count down. */
function startTurn(state: CombatState): CombatState {
  const c = state.combatants[state.turn];
  if (!c) return { ...state, lastTick: null };
  const before = c.conditions;
  const next = tickConditions(before);
  return {
    ...update(state, c.id, (x) => ({ ...x, conditions: next })),
    lastTick: { id: c.id, conditions: before },
  };
}

/** One round less for the timed conditions; those that reach 0 end. */
export function tickConditions(conditions: ActiveCondition[]): ActiveCondition[] {
  return conditions
    .map((k) => (k.rounds === null ? k : { ...k, rounds: k.rounds - 1 }))
    .filter((k) => k.rounds === null || k.rounds > 0);
}

// -- per combatant -------------------------------------------------------------------------

function update(state: CombatState, id: string, f: (c: Combatant) => Combatant): CombatState {
  return { ...state, combatants: state.combatants.map((c) => (c.id === id ? f(c) : c)) };
}

export function updateCombatant(
  state: CombatState,
  id: string,
  changes: Partial<Omit<Combatant, 'id'>>,
): CombatState {
  return update(state, id, (c) => ({ ...c, ...changes }));
}

/** Damage: temporary HP absorb it first; HP don't go below 0. */
export function applyDamage(c: Combatant, amount: number): Combatant {
  const a = Math.floor(amount);
  if (!(a > 0)) return c;
  const absorbed = Math.min(c.temp, a);
  const rest = a - absorbed;
  return { ...c, temp: c.temp - absorbed, hp: c.hp === null ? null : Math.max(0, c.hp - rest) };
}

/** Healing up to the maximum (temporary HP aren't healed). */
export function applyHealing(c: Combatant, amount: number): Combatant {
  const a = Math.floor(amount);
  if (!(a > 0) || c.hp === null || c.hpMax === null) return c;
  return { ...c, hp: Math.min(c.hpMax, c.hp + a) };
}

/** Temporary HP don't add up: the new amount replaces the old one. */
export function setTemp(c: Combatant, value: number): Combatant {
  return { ...c, temp: Math.max(0, Math.floor(value) || 0) };
}

/** DC of the Constitution save to keep Concentration after taking damage (2024): max 30. */
export function concentrationDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)));
}

/** Toggles a condition (a new one lasts until removed). */
export function toggleCombatCondition(c: Combatant, id: Condition): Combatant {
  const on = c.conditions.some((k) => k.id === id);
  return {
    ...c,
    conditions: on
      ? c.conditions.filter((k) => k.id !== id)
      : [...c.conditions, { id, rounds: null }],
  };
}

/** Rounds a condition lasts; null or < 1: until removed. */
export function setConditionRounds(c: Combatant, id: Condition, rounds: number | null): Combatant {
  const r = rounds === null || !(rounds >= 1) ? null : Math.floor(rounds);
  return {
    ...c,
    conditions: c.conditions.map((k) => (k.id === id ? { ...k, rounds: r } : k)),
  };
}

// -- totals --------------------------------------------------------------------------------

/** Experience points of the monsters defeated (at 0 HP, or removed once defeated). */
export function defeatedXp(state: CombatState): number {
  return state.combatants.filter(isDefeated).reduce((sum, c) => sum + c.xp, state.removedXp);
}
