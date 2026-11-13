import { Character } from '../models/character';
import { featResistSource } from '../rules/feat-effects';
import { Sheet } from '../rules/sheet';

/**
 * After a rest, the picks inside species traits that the text lets the player change on that rest
 * (Sheet.restPicks: a Long Rest offers them all; a Short Rest only those that say so). They're
 * kept in `state.restChoices` until the player keeps or changes them; nothing changes on its own.
 */
export function promptRestChoices(
  state: Character['state'],
  sheet: Sheet,
  rest: 'short' | 'long',
): Character['state'] {
  const keys = (sheet.restPicks ?? [])
    .filter((p) => rest === 'long' || p.rest === 'short')
    .map((p) => p.key);
  if (!keys.length) return state;
  return { ...state, restChoices: [...new Set([...(state.restChoices ?? []), ...keys])] };
}

/**
 * The answer to "keep or change?": the new values of the picks changed (by key), the others
 * kept; the question is cleared either way.
 */
export function answerRestChoices(ch: Character, changed: Record<string, string[]>): Character {
  const state = { ...ch.state };
  delete state.restChoices;
  if (!Object.keys(changed).length) return { ...ch, state };
  const picks = { ...(ch.choices.traitPicks ?? {}) };
  const feats = { ...(ch.choices.featChoices ?? {}) };
  let featsChanged = false;
  for (const [key, values] of Object.entries(changed)) {
    // a feat's damage types live with the feat's choices (featChoices), the rest with the traits
    const src = featResistSource(key);
    if (src) {
      const { resistance: _single, ...rest } = feats[src] ?? {};
      feats[src] = { ...rest, resistances: values };
      featsChanged = true;
    } else picks[key] = values;
  }
  return {
    ...ch,
    state,
    choices: {
      ...ch.choices,
      traitPicks: picks,
      ...(featsChanged ? { featChoices: feats } : {}),
    },
  };
}
