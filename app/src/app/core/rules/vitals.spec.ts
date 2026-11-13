import { describe, expect, it } from 'vitest';

import { Character } from '../models/character';
import { computeSheet } from './engine';
import { REAL, hero } from './real-data.testing';
import { vitalsOf } from './vitals';

describe('vitalsOf (chips de la lista de personajes)', () => {
  it('da PG máximos y CA iguales a los de computeSheet con datos reales', () => {
    const ch: Character = hero('fighter', 3);
    const sheet = computeSheet(ch, REAL);

    const v = vitalsOf(ch, REAL);

    expect(v).not.toBeNull();
    expect(v!.hpMax).toBe(sheet.hitPoints.max);
    expect(v!.hp).toBe(sheet.hitPoints.current);
    expect(v!.ac).toBe(sheet.armorClass.value);
    expect(v!.hpMax).toBeGreaterThan(0);
    expect(v!.ac).toBeGreaterThan(0);
  });

  it('refleja los PG actuales guardados en el estado del personaje', () => {
    const ch: Character = {
      ...hero('fighter', 3),
      state: { ...hero('fighter', 3).state, hpCurrent: 5 },
    };
    const sheet = computeSheet(ch, REAL);

    const v = vitalsOf(ch, REAL);

    expect(v!.hp).toBe(5);
    expect(v!.hpMax).toBe(sheet.hitPoints.max);
  });

  it('no muestra nada (null) si el motor lanza un error', () => {
    // A character without its class list cannot be computed: the engine throws.
    const broken = { ...hero('fighter', 3), classes: undefined } as unknown as Character;

    expect(() => computeSheet(broken, REAL)).toThrow();
    expect(vitalsOf(broken, REAL)).toBeNull();
  });
});
