/**
 * The DM's simplified combat helper: the monsters (each with its own hit points and limited uses),
 * the players (a name and the initiative they rolled with their own dice) and the initiative order.
 * No turns or rounds: the DM follows the order at the table. Everything here is pure: each function
 * takes a state and returns a new one; CombatStore keeps it and saves it on the device.
 */

export interface CombatPlayer {
  id: string;
  /** Empty: shown as "Player 1", "Player 2"… */
  name: string;
  /** Typed by the DM; null until then. */
  initiative: number | null;
}

export interface CombatMonster {
  id: string;
  /** Compendium id ("goblin-warrior"). */
  monsterId: string;
  /** English name from the compendium (shown translated). */
  name: string;
  /** "Goblin 2": numbered within its kind. */
  number: number;
  ac: number;
  hpMax: number;
  hp: number;
  temp: number;
  initBonus: number;
  dex: number;
  initiative: number | null;
  /** Limited uses spent: usage key (monster-actions.ts) → how many. */
  used: Record<string, number>;
}

export interface CombatState {
  players: CombatPlayer[];
  monsters: CombatMonster[];
  /** Order settled by hand among those with the same initiative: id → rank (lower first). */
  ties: Record<string, number>;
  /** One initiative roll per monster instead of one per kind of monster. */
  perMonster: boolean;
  /** Encounter loaded (from the encounter builder), if any. */
  encounterId: string | null;
  encounterName: string | null;
  /** The monster whose card is shown. */
  selectedId: string | null;
  nextId: number;
}

export function emptyCombat(players = 4): CombatState {
  return setPlayerCount(
    {
      players: [],
      monsters: [],
      ties: {},
      perMonster: false,
      encounterId: null,
      encounterName: null,
      selectedId: null,
      nextId: 1,
    },
    players,
  );
}

/** Something worth keeping: monsters, or players with a name or an initiative. */
export function hasCombat(s: CombatState): boolean {
  return s.monsters.length > 0 || s.players.some((p) => p.name.trim() || p.initiative !== null);
}

/** Accepts what this version saved; anything else (older trackers too) → undefined. */
export function normalizeCombat(raw: unknown): CombatState | undefined {
  if (!raw || typeof raw !== 'object') return;
  const r = raw as Partial<CombatState>;
  if (!Array.isArray(r.monsters) || !Array.isArray(r.players)) return;
  const s = { ...emptyCombat(0), ...r } as CombatState;
  s.ties = s.ties && typeof s.ties === 'object' ? s.ties : {};
  s.monsters = s.monsters.map((m) => ({ ...m, temp: m.temp ?? 0, used: m.used ?? {} }));
  return s;
}

// -- monsters ------------------------------------------------------------------------------

/** What's needed of a compendium monster. */
export interface MonsterInfo {
  id: string;
  name: string;
  ac: number;
  hp: number;
  initiative: number | null;
  dex: number;
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

/**
 * Adds `count` monsters, numbered after the ones of the same kind already there. With one roll per
 * kind, the new ones join the initiative their kind already has.
 */
export function addMonsters(state: CombatState, m: MonsterInfo, count: number): CombatState {
  const n = Math.max(0, Math.floor(count) || 0);
  if (!n) return state;
  const same = state.monsters.filter((x) => x.monsterId === m.id);
  let last = Math.max(0, ...same.map((x) => x.number));
  const shared = !state.perMonster && same.length ? same[0].initiative : null;
  let nextId = state.nextId;
  const added: CombatMonster[] = [];
  for (let i = 0; i < n; i++) {
    added.push({
      id: `m${nextId++}`,
      monsterId: m.id,
      name: m.name,
      number: ++last,
      ac: m.ac,
      hpMax: Math.max(1, m.hp),
      hp: Math.max(1, m.hp),
      temp: 0,
      initBonus: m.initiative ?? modifier(m.dex),
      dex: m.dex,
      initiative: shared,
      used: {},
    });
  }
  return { ...state, monsters: [...state.monsters, ...added], nextId };
}

export function removeMonster(state: CombatState, id: string): CombatState {
  if (!state.monsters.some((m) => m.id === id)) return state;
  const { [id]: _, ...ties } = state.ties;
  return {
    ...state,
    monsters: state.monsters.filter((m) => m.id !== id),
    ties,
    selectedId: state.selectedId === id ? null : state.selectedId,
  };
}

/** Removes the highest-numbered monster of a kind (the "−" of its count). */
export function removeLastOf(state: CombatState, monsterId: string): CombatState {
  const same = state.monsters.filter((m) => m.monsterId === monsterId);
  if (!same.length) return state;
  const last = same.reduce((a, b) => (b.number > a.number ? b : a));
  return removeMonster(state, last.id);
}

/** Monster kinds in the order they were added, with how many of each. */
export function monsterGroups(
  state: CombatState,
): { monsterId: string; name: string; count: number }[] {
  const groups = new Map<string, { monsterId: string; name: string; count: number }>();
  for (const m of state.monsters) {
    const g = groups.get(m.monsterId);
    if (g) g.count++;
    else groups.set(m.monsterId, { monsterId: m.monsterId, name: m.name, count: 1 });
  }
  return [...groups.values()];
}

export function updateMonster(
  state: CombatState,
  id: string,
  f: (m: CombatMonster) => CombatMonster,
): CombatState {
  return { ...state, monsters: state.monsters.map((m) => (m.id === id ? f(m) : m)) };
}

// -- players -------------------------------------------------------------------------------

/** Adds unnamed players or removes the last ones. */
export function setPlayerCount(state: CombatState, count: number): CombatState {
  const n = Math.min(20, Math.max(0, Math.floor(count) || 0));
  if (n === state.players.length) return state;
  if (n < state.players.length) {
    const ties = { ...state.ties };
    for (const p of state.players.slice(n)) delete ties[p.id];
    return { ...state, players: state.players.slice(0, n), ties };
  }
  let nextId = state.nextId;
  const players = [...state.players];
  while (players.length < n) players.push({ id: `p${nextId++}`, name: '', initiative: null });
  return { ...state, players, nextId };
}

export function setPlayerName(state: CombatState, id: string, name: string): CombatState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, name } : p)) };
}

// -- initiative ----------------------------------------------------------------------------

function cleanValue(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.floor(value);
}

/** A player's or a monster's initiative, typed by hand. A new value forgets a tie settled by hand. */
export function setInitiative(state: CombatState, id: string, value: number | null): CombatState {
  const v = cleanValue(value);
  const { [id]: _, ...ties } = state.ties;
  return {
    ...state,
    ties,
    players: state.players.map((p) => (p.id === id ? { ...p, initiative: v } : p)),
    monsters: state.monsters.map((m) => (m.id === id ? { ...m, initiative: v } : m)),
  };
}

/**
 * Rolls d20 + initiative bonus for the monsters: one roll per kind of monster (they act together),
 * or one per monster with `perMonster`. Rolling again replaces the old rolls; with `missing`, only
 * those without an initiative roll (a kind that already has one shares it).
 */
export function rollMonsterInitiative(
  state: CombatState,
  d20: Roll,
  opts: { missing?: boolean } = {},
): CombatState {
  const groupRoll = new Map<string, number>();
  if (opts.missing && !state.perMonster) {
    for (const m of state.monsters) {
      if (m.initiative !== null && !groupRoll.has(m.monsterId)) {
        groupRoll.set(m.monsterId, m.initiative - m.initBonus);
      }
    }
  }
  const ties = { ...state.ties };
  const monsters = state.monsters.map((m) => {
    if (opts.missing && m.initiative !== null) return m;
    delete ties[m.id];
    let roll: number;
    if (state.perMonster) roll = d20();
    else {
      if (!groupRoll.has(m.monsterId)) groupRoll.set(m.monsterId, d20());
      roll = groupRoll.get(m.monsterId)!;
    }
    return { ...m, initiative: roll + m.initBonus };
  });
  return { ...state, monsters, ties };
}

export interface OrderEntry {
  kind: 'player' | 'monster';
  id: string;
  initiative: number | null;
}

/**
 * Everyone by initiative, highest first. Ties: an order settled by hand first; then players before
 * monsters (the players' bonus isn't known, and at most tables they win ties); between monsters,
 * the higher initiative bonus, then the higher Dexterity; then the order they were added (players
 * in their list order, a kind of monster by number). No initiative yet: at the end.
 */
export function initiativeOrder(state: CombatState): OrderEntry[] {
  const rows = [
    ...state.players.map((p, i) => ({
      e: { kind: 'player' as const, id: p.id, initiative: p.initiative },
      bonus: Infinity,
      dex: Infinity,
      i,
    })),
    ...state.monsters.map((m, i) => ({
      e: { kind: 'monster' as const, id: m.id, initiative: m.initiative },
      bonus: m.initBonus,
      dex: m.dex,
      i: 1000 + i,
    })),
  ];
  const rank = (id: string) => state.ties[id] ?? 0;
  rows.sort(
    (a, b) =>
      (b.e.initiative ?? -Infinity) - (a.e.initiative ?? -Infinity) ||
      rank(a.e.id) - rank(b.e.id) ||
      cmp(b.bonus, a.bonus) ||
      cmp(b.dex, a.dex) ||
      a.i - b.i,
  );
  return rows.map((r) => r.e);
}

/** a - b, with Infinity == Infinity → 0. */
function cmp(a: number, b: number): number {
  return a === b ? 0 : a - b;
}

/** Whether a row can go up (-1) or down (+1): only past someone with the same initiative. */
export function canMove(order: OrderEntry[], id: string, step: -1 | 1): boolean {
  const i = order.findIndex((e) => e.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= order.length) return false;
  return order[i].initiative !== null && order[i].initiative === order[j].initiative;
}

/** Settles a tie by hand: swaps a row with its neighbour of the same initiative. */
export function moveInOrder(state: CombatState, id: string, step: -1 | 1): CombatState {
  const order = initiativeOrder(state);
  if (!canMove(order, id, step)) return state;
  const value = order.find((e) => e.id === id)!.initiative;
  const group = order.filter((e) => e.initiative === value).map((e) => e.id);
  const i = group.indexOf(id);
  [group[i], group[i + step]] = [group[i + step], group[i]];
  const ties = { ...state.ties };
  group.forEach((g, k) => (ties[g] = k));
  return { ...state, ties };
}

// -- hit points ----------------------------------------------------------------------------

/** Damage: temporary HP absorb it first; HP don't go below 0. */
export function applyDamage(m: CombatMonster, amount: number): CombatMonster {
  const a = Math.floor(amount);
  if (!(a > 0)) return m;
  const absorbed = Math.min(m.temp, a);
  return { ...m, temp: m.temp - absorbed, hp: Math.max(0, m.hp - (a - absorbed)) };
}

/** Healing up to the maximum (temporary HP aren't healed). */
export function applyHealing(m: CombatMonster, amount: number): CombatMonster {
  const a = Math.floor(amount);
  if (!(a > 0)) return m;
  return { ...m, hp: Math.min(m.hpMax, m.hp + a) };
}

/** Temporary HP don't add up: the new amount replaces the old one. */
export function setTemp(m: CombatMonster, value: number): CombatMonster {
  return { ...m, temp: Math.max(0, Math.floor(value) || 0) };
}

/** HP typed directly (0…max). */
export function setHp(m: CombatMonster, value: number): CombatMonster {
  if (!Number.isFinite(value)) return m;
  return { ...m, hp: Math.min(m.hpMax, Math.max(0, Math.floor(value))) };
}

export function isDefeated(m: CombatMonster): boolean {
  return m.hp === 0;
}

// -- limited uses --------------------------------------------------------------------------

export function usedOf(m: CombatMonster, key: string): number {
  return m.used[key] ?? 0;
}

/**
 * Ticks or unticks checkbox `index` (0-based) of a use with `slots` boxes, filled from the left:
 * ticking box 2 marks 3 used; unticking it leaves 2.
 */
export function toggleUse(
  m: CombatMonster,
  key: string,
  index: number,
  slots: number,
): CombatMonster {
  const used = usedOf(m, key);
  const next = Math.min(slots, Math.max(0, index < used ? index : index + 1));
  return { ...m, used: { ...m.used, [key]: next } };
}

/** Back to unused (legendary actions at the start of its turn, a recharge rolled). */
export function resetUse(m: CombatMonster, key: string): CombatMonster {
  if (!usedOf(m, key)) return m;
  const { [key]: _, ...used } = m.used;
  return { ...m, used };
}
