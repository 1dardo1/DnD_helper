import { newCharacter, normalizeCharacter } from '../models/character';
import { answerRestChoices, promptRestChoices } from '../play/rest-choices';
import { computeSheet } from './engine';
import {
  featResistKey,
  pickedResistances,
  resistanceChangesOnRest,
  resistancePickOf,
} from './feat-effects';
import { REAL, hero, sheetOf } from './real-data.testing';

// Real texts: data/feats.json (Boon of Energy Resistance: two of nine types, changeable on a Long
// Rest; Planar Wanderer: one of acid, cold or fire, chosen again on every Long Rest).
const BOON = 'boon-of-energy-resistance';
const BOON_KEY = `feat:${BOON}`;
const PLANAR = 'planar-wanderer';
const PLANAR_KEY = `feat:${PLANAR}`;
const NINE = [
  'Acid',
  'Cold',
  'Fire',
  'Lightning',
  'Necrotic',
  'Poison',
  'Psychic',
  'Radiant',
  'Thunder',
];

const text = (id: string) => REAL.feats.get(id)?.description ?? '';

/** A level 4 Fighter with the feat, and the choices the feat has made (`featChoices`). */
function withFeat(featId: string, choice?: Record<string, unknown>) {
  const key = `feat:${featId}`;
  return hero('fighter', 4, null, {
    feats: [featId],
    ...(choice ? { featChoices: { [key]: choice } } : {}),
  });
}

describe('damage types the feat texts let the player pick', () => {
  it('Boon of Energy Resistance: two of the nine listed types', () => {
    expect(resistancePickOf(text(BOON))).toEqual({ from: NINE, count: 2 });
  });

  it('Planar Wanderer: one of acid, cold or fire (your choice)', () => {
    expect(resistancePickOf(text(PLANAR))).toEqual({
      from: ['Acid', 'Cold', 'Fire'],
      count: 1,
    });
  });

  it('feats whose resistance the table already gives keep their own list', () => {
    expect(resistancePickOf(text('dragonscarred'))).toBeNull();
  });

  it('only Boon and Planar Wanderer change at a Long Rest', () => {
    expect(resistanceChangesOnRest(text(BOON))).toBe(true);
    expect(resistanceChangesOnRest(text(PLANAR))).toBe(true);
    expect(resistanceChangesOnRest(text('dragonscarred'))).toBe(false);
  });

  it('pickedResistances keeps only valid types and never more than asked', () => {
    const rule = { from: NINE, count: 2 };
    expect(pickedResistances({ resistances: ['Fire', 'Cold', 'Acid'] }, rule)).toEqual([
      'Fire',
      'Cold',
    ]);
    expect(pickedResistances({ resistances: ['Fire', 'Fire'] }, rule)).toEqual(['Fire']);
    expect(pickedResistances({ resistances: ['Gold'] }, rule)).toEqual([]);
    // the single `resistance` of the older feats still counts
    expect(pickedResistances({ resistance: 'Psychic' }, { from: ['Psychic'], count: 1 })).toEqual([
      'Psychic',
    ]);
  });
});

describe('Boon of Energy Resistance on the sheet', () => {
  it('without a choice: no resistance, the pick is pending, and the rest dialog offers it', () => {
    const sheet = sheetOf('fighter', 4, null, { feats: [BOON] });
    expect(sheet.resistances).toEqual([]);
    expect(sheet.featMissing).toContainEqual({
      feat: 'Boon of Energy Resistance',
      key: BOON_KEY,
      what: 'resistance',
    });
    expect(sheet.restPicks).toContainEqual({
      key: featResistKey(BOON_KEY),
      trait: 'Boon of Energy Resistance',
      rest: 'long',
      resist: { from: NINE, count: 2, picked: [] },
    });
  });

  it('one chosen: only that one is resisted and the pick stays pending', () => {
    const sheet = computeSheet(withFeat(BOON, { resistances: ['Fire'] }), REAL);
    expect(sheet.resistances).toEqual(['Fire']);
    expect(sheet.featMissing.some((m) => m.what === 'resistance')).toBe(true);
  });

  it('two chosen: both are on the sheet and nothing is pending', () => {
    const sheet = computeSheet(withFeat(BOON, { resistances: ['Radiant', 'Thunder'] }), REAL);
    expect(sheet.resistances).toEqual(['Radiant', 'Thunder']);
    expect(sheet.featMissing.some((m) => m.what === 'resistance')).toBe(false);
  });

  it('a third type is not possible: the sheet takes the first two', () => {
    const sheet = computeSheet(withFeat(BOON, { resistances: ['Fire', 'Cold', 'Acid'] }), REAL);
    expect(sheet.resistances).toEqual(['Fire', 'Cold']);
  });

  it('the rest dialog offers it after a Long Rest, not after a Short Rest', () => {
    const ch = withFeat(BOON, { resistances: ['Fire', 'Cold'] });
    const sheet = computeSheet(ch, REAL);
    const key = featResistKey(BOON_KEY);
    expect(promptRestChoices(ch.state, sheet, 'long').restChoices).toEqual([key]);
    expect(promptRestChoices(ch.state, sheet, 'short').restChoices).toBeUndefined();
  });

  it('answering "change" after a Long Rest replaces the two types; the others stay', () => {
    const ch = withFeat(BOON, { resistances: ['Fire', 'Cold'] });
    const key = featResistKey(BOON_KEY);
    const waiting = { ...ch, state: promptRestChoices(ch.state, computeSheet(ch, REAL), 'long') };
    const next = answerRestChoices(waiting, { [key]: ['Radiant', 'Thunder'] });
    expect(next.state.restChoices).toBeUndefined();
    expect(next.choices.featChoices?.[BOON_KEY]?.resistances).toEqual(['Radiant', 'Thunder']);
    expect(computeSheet(next, REAL).resistances).toEqual(['Radiant', 'Thunder']);
  });

  it('keep all after a Long Rest: the choice is unchanged', () => {
    const ch = withFeat(BOON, { resistances: ['Fire', 'Cold'] });
    const waiting = {
      ...ch,
      state: promptRestChoices(ch.state, computeSheet(ch, REAL), 'long'),
    };
    const next = answerRestChoices(waiting, {});
    expect(next.state.restChoices).toBeUndefined();
    expect(computeSheet(next, REAL).resistances).toEqual(['Fire', 'Cold']);
  });
});

describe('Planar Wanderer on the sheet', () => {
  it('one type, chosen again at every Long Rest', () => {
    const ch = withFeat(PLANAR, { resistance: 'Cold' });
    const sheet = computeSheet(ch, REAL);
    expect(sheet.resistances).toEqual(['Cold']);
    expect(sheet.restPicks).toContainEqual({
      key: featResistKey(PLANAR_KEY),
      trait: 'Planar Wanderer',
      rest: 'long',
      resist: { from: ['Acid', 'Cold', 'Fire'], count: 1, picked: ['Cold'] },
    });
  });

  it('changing it on a Long Rest moves the choice to the list the feat keeps', () => {
    const ch = withFeat(PLANAR, { resistance: 'Cold' });
    const key = featResistKey(PLANAR_KEY);
    const waiting = { ...ch, state: promptRestChoices(ch.state, computeSheet(ch, REAL), 'long') };
    const next = answerRestChoices(waiting, { [key]: ['Acid'] });
    expect(next.choices.featChoices?.[PLANAR_KEY]).toEqual({ resistances: ['Acid'] });
    expect(computeSheet(next, REAL).resistances).toEqual(['Acid']);
  });

  it('the same type from two sources is shown once', () => {
    const ch = hero('fighter', 4, null, {
      feats: [PLANAR, 'dragonscarred'],
      featChoices: {
        [PLANAR_KEY]: { resistance: 'Fire' },
        'feat:dragonscarred': { resistance: 'Fire' },
      },
    });
    expect(computeSheet(ch, REAL).resistances).toEqual(['Fire']);
  });
});

describe('the stored choice survives a load (normalizeCharacter)', () => {
  it('keeps the damage types as texts and drops the empty ones', () => {
    const base = newCharacter('Test', 'test');
    const raw = JSON.parse(
      JSON.stringify({
        ...base,
        choices: {
          ...base.choices,
          featChoices: {
            [BOON_KEY]: { resistances: ['Fire', '', 7, 'Cold'] },
            [PLANAR_KEY]: { resistance: 'Acid' },
          },
        },
      }),
    );
    const ch = normalizeCharacter(raw);
    expect(ch?.choices.featChoices).toEqual({
      [BOON_KEY]: { resistances: ['Fire', 'Cold'] },
      [PLANAR_KEY]: { resistance: 'Acid' },
    });
  });
});
