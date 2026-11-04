import { BalanceMonster, balanceEncounter, smallestChange, targetBand } from './encounter-balance';
import { partyBudget } from './encounter-difficulty';

const M = (id: string, xp: number, cr: number, creatureType = 'fey'): BalanceMonster => ({
  id,
  xp,
  cr,
  creatureType,
});

const COMPENDIUM: BalanceMonster[] = [
  M('goblin-minion', 25, 0.125),
  M('goblin-warrior', 50, 0.25),
  M('hobgoblin-warrior', 100, 0.5),
  M('goblin-boss', 200, 1),
  M('bugbear-warrior', 200, 1),
  M('wolf', 50, 0.25, 'beast'),
  M('dire-wolf', 200, 1, 'beast'),
  M('ogre', 450, 2, 'giant'),
  M('bugbear-stalker', 700, 3),
  M('troll', 1800, 5, 'giant'),
];

const party = (n: number, level: number) => Array.from({ length: n }, () => level);

describe('encounter balance', () => {
  it('bands: Low 1…Low, Moderate above Low…Moderate, High above Moderate…High', () => {
    const b = partyBudget(party(4, 3)); // 600 / 900 / 1600
    expect(targetBand(b, 'low')).toEqual({ floor: 0, budget: 600 });
    expect(targetBand(b, 'moderate')).toEqual({ floor: 600, budget: 900 });
    expect(targetBand(b, 'high')).toEqual({ floor: 900, budget: 1600 });
  });

  it('smallest change of one monster to land in the band', () => {
    const band = { floor: 600, budget: 900 };
    expect(smallestChange(200, 50, 4, band)).toBe(9); // 650
    expect(smallestChange(700, 50, 4, band)).toBe(0);
    expect(smallestChange(1100, 200, 2, band)).toBe(-1); // 900
    expect(smallestChange(1100, 50, 2, band)).toBeNull(); // removing both isn't enough
    expect(smallestChange(500, 450, 1, band)).toBeNull(); // 950: one more is too much
    expect(smallestChange(1400, 450, 2, band)).toBeNull(); // 950 too much, 500 too little
    expect(smallestChange(100, 0, 1, band)).toBeNull();
  });

  it('4 characters of level 3 aiming at Moderate, with 4 goblin warriors', () => {
    const b = balanceEncounter({
      levels: party(4, 3),
      monsters: [{ monsterId: 'goblin-warrior', count: 4 }],
      target: 'moderate',
      compendium: COMPENDIUM,
    });
    expect(b).toMatchObject({
      budget: 900,
      floor: 600,
      xp: 200,
      status: 'below',
      missing: 401,
      room: 700,
    });
    expect(b.adjustments).toEqual([
      { monsterId: 'goblin-warrior', delta: 9, xpAfter: 650, creaturesAfter: 13 },
    ]);
    // same creature type first, then fewest creatures; nothing above level 3; ≤ 8 creatures in all
    expect(b.fits.map((f) => [f.monsterId, f.count, f.xpAfter, f.sameType])).toEqual([
      ['bugbear-stalker', 1, 900, true],
      ['bugbear-warrior', 3, 800, true],
      ['goblin-boss', 3, 800, true],
      ['ogre', 1, 650, false],
      ['dire-wolf', 3, 800, false],
    ]);
    expect(b.warnings).toEqual([]);
  });

  it('too much: nothing removes enough on its own, and warnings', () => {
    const b = balanceEncounter({
      levels: party(4, 3),
      monsters: [
        { monsterId: 'ogre', count: 2 },
        { monsterId: 'goblin-warrior', count: 6 },
        { monsterId: 'troll', count: 1 },
      ],
      target: 'moderate',
      compendium: COMPENDIUM,
    });
    expect(b).toMatchObject({ xp: 3000, status: 'above', over: 2100, room: 0, fits: [] });
    expect(b.adjustments).toEqual([]);
    expect(b.warnings).toEqual([
      { kind: 'highCr', monsterId: 'troll', cr: 5, level: 3 },
      { kind: 'manyCreatures', creatures: 9, characters: 4 },
      { kind: 'aboveHigh' },
    ]);
  });

  it('suggests removing the fewest that land it in the band', () => {
    const b = balanceEncounter({
      levels: party(4, 3),
      monsters: [
        { monsterId: 'ogre', count: 2 },
        { monsterId: 'goblin-warrior', count: 3 },
        { monsterId: 'goblin-boss', count: 1 },
      ],
      target: 'moderate',
      compendium: COMPENDIUM,
    });
    expect(b.xp).toBe(1250);
    // one ogre less → 800; removing the boss (1050) or all 3 goblins (1100) isn't enough
    expect(b.adjustments).toEqual([
      { monsterId: 'ogre', delta: -1, xpAfter: 800, creaturesAfter: 5 },
    ]);
  });

  it('on target: no changes, only monsters that still fit', () => {
    const b = balanceEncounter({
      levels: [3, 3, 4, 2],
      monsters: [{ monsterId: 'bugbear-stalker', count: 1 }],
      target: 'moderate',
      compendium: COMPENDIUM,
    });
    // Moderate 225+225+375+150 = 975, Low 150+150+250+100 = 650
    expect(b).toMatchObject({ status: 'onTarget', missing: 0, room: 275, adjustments: [] });
    expect(b.fits.map((f) => f.monsterId)).toEqual([
      'bugbear-warrior',
      'goblin-boss',
      'hobgoblin-warrior',
      'goblin-warrior',
      'goblin-minion',
      'dire-wolf',
    ]);
  });

  it('an empty encounter suggests monsters; with no party, nothing', () => {
    const b = balanceEncounter({
      levels: party(4, 3),
      monsters: [],
      target: 'low',
      compendium: COMPENDIUM,
      maxFits: 3,
    });
    expect(b.status).toBe('below');
    expect(b.fits.map((f) => [f.monsterId, f.count])).toEqual([
      ['ogre', 1],
      ['bugbear-warrior', 1],
      ['dire-wolf', 1],
    ]);
    expect(
      balanceEncounter({ levels: [], monsters: [], target: 'low', compendium: COMPENDIUM }),
    ).toMatchObject({ status: 'noParty', fits: [], adjustments: [] });
  });
});
