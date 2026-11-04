import {
  XP_BUDGET_PER_CHARACTER,
  characterBudget,
  encounterXp,
  gaugeScale,
  partyBudget,
  rateEncounter,
  xpPerCharacter,
} from './encounter-difficulty';

describe('encounter difficulty (DMG 2024)', () => {
  it('has the 20 levels of the table, each budget growing with the difficulty and the level', () => {
    expect(XP_BUDGET_PER_CHARACTER.length).toBe(20);
    XP_BUDGET_PER_CHARACTER.forEach(([low, moderate, high], i) => {
      expect(low).toBeLessThan(moderate);
      expect(moderate).toBeLessThan(high);
      if (i > 0) {
        const [pl, pm, ph] = XP_BUDGET_PER_CHARACTER[i - 1];
        expect(low).toBeGreaterThan(pl);
        expect(moderate).toBeGreaterThan(pm);
        expect(high).toBeGreaterThan(ph);
      }
    });
  });

  it('looks up a few rows of the table', () => {
    expect(characterBudget(1)).toEqual({ low: 50, moderate: 75, high: 100 });
    expect(characterBudget(3)).toEqual({ low: 150, moderate: 225, high: 400 });
    expect(characterBudget(5)).toEqual({ low: 500, moderate: 750, high: 1100 });
    expect(characterBudget(10)).toEqual({ low: 1600, moderate: 2300, high: 3100 });
    expect(characterBudget(20)).toEqual({ low: 6400, moderate: 13200, high: 22000 });
  });

  it('clamps levels outside 1–20', () => {
    expect(characterBudget(0)).toEqual(characterBudget(1));
    expect(characterBudget(25)).toEqual(characterBudget(20));
    expect(characterBudget(NaN)).toEqual(characterBudget(1));
  });

  it('adds up the budget of every character', () => {
    expect(partyBudget([3, 3, 3, 3])).toEqual({ low: 600, moderate: 900, high: 1600 });
    // mixed levels: 1 + 2 + 5
    expect(partyBudget([1, 2, 5])).toEqual({ low: 650, moderate: 975, high: 1400 });
    expect(partyBudget([])).toEqual({ low: 0, moderate: 0, high: 0 });
  });

  it("sums the monsters' XP without multipliers", () => {
    const xp: Record<string, number> = { goblin: 50, bugbear: 200 };
    const monsters = [
      { monsterId: 'goblin', count: 4 },
      { monsterId: 'bugbear', count: 1 },
      { monsterId: 'unknown', count: 3 },
    ];
    expect(encounterXp(monsters, (id) => xp[id])).toBe(400);
    expect(encounterXp([], (id) => xp[id])).toBe(0);
  });

  it('rates the encounter against the three budgets', () => {
    const budget = partyBudget([3, 3, 3, 3]); // 600 / 900 / 1600
    expect(rateEncounter(0, budget)).toBe('none');
    expect(rateEncounter(400, budget)).toBe('low');
    expect(rateEncounter(600, budget)).toBe('low');
    expect(rateEncounter(601, budget)).toBe('moderate');
    expect(rateEncounter(900, budget)).toBe('moderate');
    expect(rateEncounter(1300, budget)).toBe('high');
    expect(rateEncounter(1600, budget)).toBe('high');
    expect(rateEncounter(1601, budget)).toBe('aboveHigh');
    expect(rateEncounter(500, partyBudget([]))).toBe('none');
  });

  it('splits the XP among the characters', () => {
    expect(xpPerCharacter(1300, 4)).toBe(325);
    expect(xpPerCharacter(100, 3)).toBe(33);
    expect(xpPerCharacter(100, 0)).toBe(0);
  });

  it('places the gauge marks on a scale a bit beyond High', () => {
    const g = gaugeScale(400, { low: 600, moderate: 900, high: 1600 });
    expect(g.max).toBe(2000);
    expect(g.marks).toEqual({ low: 0.3, moderate: 0.45, high: 0.8 });
    expect(g.fill).toBe(0.2);
    // an encounter beyond the scale fills it
    expect(gaugeScale(5000, { low: 600, moderate: 900, high: 1600 }).fill).toBe(1);
  });
});
