import { PlayResource, longRest, playResources, shortRest } from '../play/play-state';
import { sheetOf } from './real-data.testing';

/** Resources of class and subclass features, with the real texts of the compendium. */
const res = (classId: string, level: number, sub: string | null, scores = {}) =>
  playResources(sheetOf(classId, level, sub, { scores }));
const find = (rs: PlayResource[], name: string) => rs.find((r) => r.name === name);

describe('pools of dice read from the text of the subclass', () => {
  it.each([
    [3, 'd6', 4],
    [5, 'd8', 6],
    [9, 'd8', 8],
    [11, 'd10', 8],
    [13, 'd10', 10],
    [17, 'd12', 12],
  ])('Soulknife level %i: %s x %i', (level, die, count) => {
    const r = find(res('rogue', level, 'rogue/soulknife'), 'Psionic Energy Dice');
    expect(r).toMatchObject({ die, max: count, labelKey: 'play.res.psionicEnergyDice' });
  });

  it('Psi Warrior has the same pool, from its own table', () => {
    const r = find(res('fighter', 11, 'fighter/psi-warrior'), 'Psionic Energy Dice');
    expect(r).toMatchObject({ die: 'd10', max: 8 });
    // not the old wrong single use
    expect(
      res('fighter', 3, 'fighter/psi-warrior').filter((x) => x.name === 'Psionic Energy Dice'),
    ).toHaveLength(1);
  });

  it('recovers one die on a Short Rest and all on a Long Rest', () => {
    const rs = res('rogue', 5, 'rogue/soulknife');
    const key = find(rs, 'Psionic Energy Dice')!.key;
    const spent = { resources: { [key]: 5 } } as never;
    expect(shortRest(spent, rs).resources[key]).toBe(4);
    expect(longRest(spent).resources[key]).toBeUndefined();
  });

  it('Zealot Warrior of the Gods: four d12s, five at 6, six at 12, seven at 17', () => {
    const at = (l: number) =>
      find(res('barbarian', l, 'barbarian/path-of-the-zealot'), 'Warrior of the Gods');
    expect(at(3)).toMatchObject({ die: 'd12', max: 4 });
    expect(at(6)?.max).toBe(5);
    expect(at(12)?.max).toBe(6);
    expect(at(17)?.max).toBe(7);
  });

  it('Celestial Healing Light: 1 + Warlock level d6s', () => {
    expect(find(res('warlock', 3, 'warlock/celestial-patron'), 'Healing Light')).toMatchObject({
      die: 'd6',
      max: 4,
    });
    expect(find(res('warlock', 9, 'warlock/celestial-patron'), 'Healing Light')?.max).toBe(10);
  });
});

describe('the same pool of dice read from a table (Psionic Power, Despairing Strikes)', () => {
  it.each([
    ['rogue', 'rogue/soulknife', 'Psionic Energy Dice', 5, 'd8', 6],
    ['fighter', 'fighter/psi-warrior', 'Psionic Energy Dice', 11, 'd10', 8],
    ['fighter', 'fighter/sorrow-knight', 'Despairing Strike Dice', 3, 'd8', 3],
    ['fighter', 'fighter/sorrow-knight', 'Despairing Strike Dice', 10, 'd10', 4],
    ['fighter', 'fighter/sorrow-knight', 'Despairing Strike Dice', 15, 'd12', 5],
  ])('%s, %s, %s at level %i', (classId, sub, name, level, die, count) => {
    expect(find(res(classId, level, sub), name)).toMatchObject({ die, max: count });
  });

  it('Despairing Strike Dice all come back on a Short Rest, and on a Long Rest', () => {
    const rs = res('fighter', 3, 'fighter/sorrow-knight');
    const key = find(rs, 'Despairing Strike Dice')!.key;
    const spent = { resources: { [key]: 2 } } as never;
    expect(shortRest(spent, rs).resources[key]).toBe(0);
    expect(longRest(spent).resources[key]).toBeUndefined();
  });
});

describe('a use formula and the rest that gives it back in the next sentence', () => {
  const uses = (classId: string, level: number, sub: string, name: string, con = 14) =>
    find(res(classId, level, sub, { CON: con }), name);

  it("Path of Lament's Banshee's Wail: Constitution modifier, back on a Long Rest", () => {
    expect(uses('barbarian', 3, 'barbarian/path-of-lament-ua', "Banshee's Wail")).toMatchObject({
      max: 2,
      short: 0,
    });
    expect(uses('barbarian', 3, 'barbarian/path-of-lament-ua', "Banshee's Wail", 6)?.max).toBe(1);
  });

  it('Hell Knight Infernal Wound: back on a Short or Long Rest', () => {
    expect(
      uses('fighter', 3, 'fighter/hell-knight-ua14-18-06-2026', 'Infernal Wound'),
    ).toMatchObject({ max: 2, short: 'all' });
  });

  it('keeps the counters that say it in one sentence (Virulent Burst, Chilling Retribution)', () => {
    const virulent = res('cleric', 6, 'cleric/pestilence-domain-ua', { WIS: 16 });
    expect(virulent.find((r) => r.name === 'Virulent Burst')?.max).toBe(3);
    expect(
      res('ranger', 11, 'ranger/winter-walker', { WIS: 14 }).find(
        (r) => r.name === 'Chilling Retribution',
      )?.max,
    ).toBe(2);
  });
});

describe('the size of the die a counter holds', () => {
  it('Bardic Inspiration shows the Bardic Die of the level', () => {
    expect(find(res('bard', 1, null), 'Bardic Inspiration')?.die).toBe('d6');
    expect(find(res('bard', 5, null), 'Bardic Inspiration')?.die).toBe('d8');
    expect(find(res('bard', 15, null), 'Bardic Inspiration')?.die).toBe('d12');
  });

  it('Battle Master Superiority Dice: d8, d10 from level 10, d12 from level 18', () => {
    const at = (l: number) => find(res('fighter', l, 'fighter/battle-master'), 'Superiority Dice');
    expect(at(3)).toMatchObject({ die: 'd8', max: 4 });
    expect(at(10)?.die).toBe('d10');
    expect(at(18)?.die).toBe('d12');
  });
});

describe('free casts that depend on an ability modifier', () => {
  const used = (classId: string, sub: string, spell: string, scores = {}) => {
    const s = sheetOf(classId, 15, sub, { scores });
    const key = s.featSpells.find((x) => x.name === spell)?.freeKey;
    return s.featUses.find((u) => u.key === key)?.max;
  };

  it('Archfey Steps of the Fey: Charisma modifier times (not always one)', () => {
    expect(used('warlock', 'warlock/archfey-patron', 'Misty Step', { CHA: 18 })).toBe(4);
    expect(used('warlock', 'warlock/archfey-patron', 'Misty Step', { CHA: 8 })).toBe(1);
  });

  it('Fey Wanderer Misty Wanderer: Wisdom modifier times', () => {
    expect(used('ranger', 'ranger/fey-wanderer', 'Misty Step', { WIS: 16 })).toBe(3);
  });
});

describe('limited uses of class features', () => {
  const names = (classId: string, level: number, sub: string | null = null) =>
    res(classId, level, sub).map((r) => r.name);

  it('counts the uses the text states, once', () => {
    expect(names('sorcerer', 5)).toContain('Sorcerous Restoration');
    expect(names('barbarian', 15)).toContain('Persistent Rage');
    expect(names('barbarian', 14)).not.toContain('Persistent Rage');
    expect(names('wizard', 20)).toContain('Signature Spells');
    expect(names('artificer', 7)).toEqual(expect.arrayContaining(["Tinker's Magic"]));
    expect(find(res('wizard', 20, null), 'Signature Spells')).toMatchObject({
      max: 2,
      short: 'all',
    });
  });

  it('does not repeat a feature that already has its counter', () => {
    const rs = res('cleric', 10, 'cleric/life-domain');
    for (const n of ['Channel Divinity', 'Divine Intervention'])
      expect(rs.filter((r) => r.name === n)).toHaveLength(1);
    const f = res('fighter', 17, 'fighter/champion');
    for (const n of ['Second Wind', 'Action Surge', 'Indomitable'])
      expect(f.filter((r) => r.name === n)).toHaveLength(1);
  });
});

describe('pools of feats: Death Points and Psionic Energy Dice', () => {
  /** A fighter with the given feats in its slots (the slot key is any text; the feat is real). */
  const withFeats = (level: number, feats: string[]) =>
    sheetOf('fighter', level, null, {
      featSlots: feats.map((featId, i) => ({ slot: `fighter:${4 + i}`, featId })),
    } as never);
  const pool = (level: number, feats: string[], name: string) =>
    playResources(withFeats(level, feats)).filter((r) => r.name === name);

  it('Death Knight Initiate: Death Points equal to the Proficiency Bonus', () => {
    const at1 = pool(1, ['death-knight-initiate-ua'], 'Death Points');
    expect(at1).toHaveLength(1);
    expect(at1[0]).toMatchObject({
      max: 2,
      labelKey: 'play.res.deathPoints',
      feat: 'Death Knight Initiate',
    });
    expect(pool(9, ['death-knight-initiate-ua'], 'Death Points')[0].max).toBe(4);
  });

  it('Ascension gives no count of its own: with Initiate there is still one counter', () => {
    expect(pool(1, ['death-knight-ascension-ua'], 'Death Points')).toHaveLength(0);
    const both = pool(9, ['death-knight-initiate-ua', 'death-knight-ascension-ua'], 'Death Points');
    expect(both).toHaveLength(1);
    expect(both[0].max).toBe(4);
  });

  it('Tadpole Host: Psionic Energy Dice equal to the Proficiency Bonus, Long Rest only', () => {
    const rs = playResources(withFeats(5, ['tadpole-host-ua']));
    const r = rs.find((x) => x.name === 'Psionic Energy Dice')!;
    expect(r).toMatchObject({ max: 3, labelKey: 'play.res.psionicEnergyDice' });
    expect(r.die).toBeUndefined(); // the feat's text gives no die size
    const spent = { resources: { [r.key]: 2 } } as never;
    expect(shortRest(spent, rs).resources[r.key]).toBe(2);
    expect(longRest(spent).resources[r.key]).toBeUndefined();
  });

  it('a Long Rest restores the Death Points, a Short Rest does not', () => {
    const rs = playResources(withFeats(9, ['death-knight-initiate-ua']));
    const key = rs.find((x) => x.name === 'Death Points')!.key;
    const spent = { resources: { [key]: 3 } } as never;
    expect(shortRest(spent, rs).resources[key]).toBe(3);
    expect(longRest(spent).resources[key]).toBeUndefined();
  });
});
