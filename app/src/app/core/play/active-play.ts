import { ACTIVE_STATES, ActiveStateId } from '../rules/active-states';
import { Sheet } from '../rules/sheet';
import { WildShapeRules } from '../rules/wild-shape';
import { PlayResource, PlayState, leaveForm, setResourceUsed } from './play-state';
import { restKey } from './rest-rules';

/**
 * Switching the states of core/rules/active-states.ts on and off, and taking or leaving a Wild
 * Shape form. Pure: each function returns the new play state (the same one when nothing changes).
 */

/** The counter a state spends when switched on (Rages, Innate Sorcery, Wild Shape). */
export function counterOf(
  id: ActiveStateId,
  resources: readonly PlayResource[],
): PlayResource | null {
  const spends = ACTIVE_STATES.find((d) => d.id === id)?.spends;
  if (!spends) return null;
  return resources.find((r) => !r.feat && restKey(r.name) === restKey(spends)) ?? null;
}

/** Uses left of the counter of a state (Infinity when it spends none). */
export function usesLeftFor(
  state: PlayState,
  id: ActiveStateId,
  resources: readonly PlayResource[],
): number {
  const r = counterOf(id, resources);
  if (!r) return Infinity;
  return r.max - Math.min(state.resources[r.key] ?? 0, r.max);
}

function spendOne(state: PlayState, r: PlayResource | null): PlayState | null {
  if (!r) return state;
  const used = Math.min(state.resources[r.key] ?? 0, r.max);
  return used >= r.max ? null : setResourceUsed(state, r.key, used + 1, r.max);
}

/** Temporary Hit Points don't add up: the higher of the two amounts stays. */
const withTemp = (state: PlayState, thp: number): PlayState =>
  thp > state.hpTemp ? { ...state, hpTemp: thp } : state;

/**
 * Switches a state on (spending a use of its counter; nothing happens when none is left) or off.
 * Rage of a World Tree Barbarian also gives Vitality Surge's Temporary Hit Points ("When you
 * activate your Rage, you gain a number of Temporary Hit Points equal to your Barbarian level").
 * Wild Shape is switched with assumeForm / leaveForm.
 */
export { leaveForm };

export function switchState(
  state: PlayState,
  sheet: Sheet,
  resources: readonly PlayResource[],
  id: ActiveStateId,
  on: boolean,
): PlayState {
  if (id === 'wildShape') return on ? state : leaveForm(state);
  const list = state.active ?? [];
  if (on === list.includes(id)) return state;
  if (!on) {
    const rest = list.filter((x) => x !== id);
    const next: PlayState = { ...state, active: rest };
    if (!rest.length) delete next.active;
    return next;
  }
  const paid = spendOne(state, counterOf(id, resources));
  if (!paid) return state;
  let next: PlayState = { ...paid, active: [...list, id] };
  if (id === 'rage') {
    const vitality = sheet.combat.stats?.find((n) => n.id === 'vitalityOfTheTree');
    const n = Number(vitality?.params?.['n'] ?? 0);
    if (n > 0) next = withTemp(next, n);
  }
  return next;
}

/**
 * Takes a known form: spends a use of Wild Shape (also when already in a form: "until you use
 * Wild Shape again"), gains the Temporary Hit Points of the feature, and remembers how long it
 * lasts. Nothing happens when no use is left.
 */
export function assumeForm(
  state: PlayState,
  resources: readonly PlayResource[],
  formId: string,
  rules: WildShapeRules,
  now = new Date(),
): PlayState {
  const paid = spendOne(state, counterOf('wildShape', resources));
  if (!paid) return state;
  return withTemp(
    { ...paid, wildShape: { formId, since: now.toISOString(), hours: rules.hours } },
    rules.tempHp,
  );
}
