import { newCharacter, normalizeCharacter } from '../models/character';
import { REAL_SPELLS } from '../rules/real-data.testing';
import {
  BREAKING_CONDITIONS,
  concentrationDc,
  dropConcentration,
  endOnRest,
  normalizeConcentration,
  settleConcentration,
  startConcentration,
} from './concentration';
import { toggleCondition } from './conditions';
import { PlayState, applyDamage, longRest } from './play-state';

const fresh = (): PlayState => newCharacter('Test', 'test').state;
const spell = (id: string) => REAL_SPELLS.find((s) => s.id === id && s.edition === '2024')!;

describe('concentration with real spells', () => {
  it('Hex, Bless and Haste are concentration spells; Fireball and Shield are not', () => {
    for (const id of ['hex', 'bless', 'haste']) expect(spell(id).concentration).toBe(true);
    for (const id of ['fireball', 'shield']) expect(spell(id).concentration).toBe(false);
  });

  it('starting another spell replaces the first and says which one', () => {
    const a = startConcentration(fresh(), 'bless', new Date('2026-01-01T10:00:00Z'));
    expect(a.replaced).toBeNull();
    expect(a.state.concentration).toEqual({ spellId: 'bless', since: '2026-01-01T10:00:00.000Z' });
    const b = startConcentration(a.state, 'haste');
    expect(b.replaced).toBe('bless');
    expect(b.state.concentration?.spellId).toBe('haste');
  });

  it('concentrating on the same spell again changes nothing', () => {
    const a = startConcentration(fresh(), 'hex').state;
    const b = startConcentration(a, 'hex');
    expect(b.state).toBe(a);
    expect(b.replaced).toBeNull();
  });

  it('dropping it removes the field', () => {
    const a = startConcentration(fresh(), 'hex').state;
    expect('concentration' in dropConcentration(a)).toBe(false);
    const none = fresh();
    expect(dropConcentration(none)).toBe(none);
  });
});

describe('concentration save', () => {
  it('DC is 10 or half the damage, whichever is higher (rounded down)', () => {
    expect(concentrationDc(1)).toBe(10);
    expect(concentrationDc(20)).toBe(10);
    expect(concentrationDc(21)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(35)).toBe(17);
    expect(concentrationDc(0)).toBe(10);
  });
});

describe('what ends concentration', () => {
  const concentrating = () => startConcentration(fresh(), 'haste').state;

  it('dropping to 0 HP ends it', () => {
    const s = applyDamage(concentrating(), 50, 20);
    const out = settleConcentration(s, 20);
    expect(out.lost).toEqual({ spellId: 'haste', reason: 'hp' });
    expect(out.state.concentration).toBeUndefined();
  });

  it('taking damage but staying up keeps it', () => {
    const s = applyDamage(concentrating(), 5, 20);
    expect(settleConcentration(s, 20)).toEqual({ state: s, lost: null });
  });

  it('incapacitating conditions end it (their texts say Incapacitated); others do not', () => {
    for (const c of BREAKING_CONDITIONS) {
      const out = settleConcentration(toggleCondition(concentrating(), c), 20);
      expect(out.lost).toEqual({ spellId: 'haste', reason: 'condition' });
    }
    for (const c of ['poisoned', 'prone', 'frightened'] as const) {
      expect(settleConcentration(toggleCondition(concentrating(), c), 20).lost).toBeNull();
    }
  });

  it('a rest ends it', () => {
    const out = endOnRest(concentrating());
    expect(out.lost).toEqual({ spellId: 'haste', reason: 'rest' });
    expect(out.state.concentration).toBeUndefined();
    expect(endOnRest(fresh()).lost).toBeNull();
  });

  it('longRest itself leaves the field alone (the panel ends it with a warning)', () => {
    expect(longRest(concentrating()).concentration?.spellId).toBe('haste');
  });
});

describe('persistence', () => {
  it('normalizes bad data to none and keeps a valid one', () => {
    expect(normalizeConcentration(undefined)).toBeNull();
    expect(normalizeConcentration({ spellId: 3 })).toBeNull();
    expect(normalizeConcentration({ spellId: '' })).toBeNull();
    expect(normalizeConcentration({ spellId: 'hex', since: 'x', extra: 1 })).toEqual({
      spellId: 'hex',
      since: 'x',
    });
  });

  it('normalizeCharacter keeps it, and old characters have none', () => {
    const c = newCharacter('Test', 'test');
    expect('concentration' in normalizeCharacter(c)!.state).toBe(false);
    const withIt = { ...c, state: { ...c.state, concentration: { spellId: 'hex' } } };
    expect(normalizeCharacter(withIt)!.state.concentration).toEqual({ spellId: 'hex' });
    const bad = { ...c, state: { ...c.state, concentration: null } };
    expect('concentration' in normalizeCharacter(bad)!.state).toBe(false);
  });
});
