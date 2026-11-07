import { newCharacter, normalizeCharacter } from '../models/character';
import { Sheet } from '../rules/sheet';
import {
  PlayState,
  applyDamage,
  currentHp,
  heal,
  longRest,
  playResources,
  setDeathSaves,
  setHp,
  setResourceUsed,
  setSpentSlots,
  setTempHp,
  shortRest,
  spendHitDie,
  tapPip,
} from './play-state';
import { exhaustionEffects, setExhaustion, toggleCondition } from './conditions';
import { recover, restRule } from './rest-rules';

const fresh = (): PlayState => newCharacter('Test', 'test').state;

/** Only what playResources reads. */
function sheet(
  classes: { id: string; level: number; subclassId?: string }[],
  resources: { classId: string; name: string; value: string }[],
  cha = 0,
): Sheet {
  return {
    classes: classes.map((c) => ({ subclassId: null, ...c, name: c.id, subclass: null })),
    resources,
    abilities: { CHA: { modifier: cha }, INT: { modifier: 0 }, WIS: { modifier: 2 } },
  } as unknown as Sheet;
}

describe('hit points', () => {
  it('temporary HP absorb damage first', () => {
    let s = setTempHp(fresh(), 5);
    s = applyDamage(s, 8, 30);
    expect(s.hpTemp).toBe(0);
    expect(currentHp(s, 30)).toBe(27);
    s = applyDamage(setTempHp(s, 10), 4, 30);
    expect(s.hpTemp).toBe(6);
    expect(currentHp(s, 30)).toBe(27);
  });

  it('never goes below 0 nor heals above the max; full HP is stored as null', () => {
    let s = applyDamage(fresh(), 50, 30);
    expect(s.hpCurrent).toBe(0);
    s = heal(s, 100, 30);
    expect(s.hpCurrent).toBeNull();
    expect(currentHp(setHp(fresh(), 12, 30), 30)).toBe(12);
    expect(currentHp(setHp(fresh(), -3, 30), 30)).toBe(0);
  });

  it('ignores empty or negative amounts', () => {
    const s = fresh();
    expect(applyDamage(s, 0, 30)).toBe(s);
    expect(heal(s, NaN, 30)).toBe(s);
  });

  it('damage at 0 HP is a failed death save; healing resets the saves', () => {
    let s = applyDamage(fresh(), 30, 30);
    s = setDeathSaves(s, 2, 0);
    s = applyDamage(s, 3, 30);
    expect(s.deathSaves).toEqual({ successes: 2, failures: 1 });
    s = heal(s, 1, 30);
    expect(s.hpCurrent).toBe(1);
    expect(s.deathSaves).toEqual({ successes: 0, failures: 0 });
  });
});

describe('spending', () => {
  it('pips mark up to the tapped one, or unmark from it', () => {
    expect(tapPip(0, 0)).toBe(1);
    expect(tapPip(1, 2)).toBe(3);
    expect(tapPip(3, 1)).toBe(1);
    expect(tapPip(1, 0)).toBe(0);
  });

  it('keeps spent slots and resources within their maximum', () => {
    expect(setSpentSlots(fresh(), 3, 5, 2).spentSlots).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0]);
    expect(setResourceUsed(fresh(), 'x', -1, 3).resources['x']).toBe(0);
  });

  it('a Hit Die heals the roll + CON and is spent', () => {
    const d10 = { die: 10, count: 2 };
    let s = setHp(fresh(), 10, 40);
    s = spendHitDie(s, d10, 6, 2, 40);
    expect(s.hpCurrent).toBe(18);
    expect(s.hitDiceSpent).toEqual({ d10: 1 });
    s = spendHitDie(s, d10, 1, -3, 40); // never negative healing
    expect(s.hpCurrent).toBe(18);
    expect(spendHitDie(s, d10, 5, 2, 40)).toBe(s); // none left
  });
});

describe('rests', () => {
  const resources = playResources(
    sheet(
      [
        { id: 'barbarian', level: 3 },
        { id: 'sorcerer', level: 2 },
        { id: 'monk', level: 2 },
      ],
      [
        { classId: 'barbarian', name: 'Rages', value: '3' },
        { classId: 'sorcerer', name: 'Sorcery Points', value: '2' },
        { classId: 'monk', name: 'Focus Points', value: '2' },
        { classId: 'monk', name: 'Martial Arts', value: '1d6' },
      ],
    ),
  );

  it('a short rest recovers Pact slots and short-rest resources only', () => {
    let s: PlayState = {
      ...setHp(fresh(), 5, 30),
      pactSlotsSpent: 2,
      hpTemp: 4,
      hitDiceSpent: { d12: 1 },
    };
    s = setSpentSlots(s, 1, 2, 3);
    s = setResourceUsed(s, 'barbarian:rages', 3, 3);
    s = setResourceUsed(s, 'sorcerer:sorcery points', 2, 2);
    s = setResourceUsed(s, 'monk:focus points', 2, 2);
    s = shortRest(s, resources);
    expect(s.pactSlotsSpent).toBe(0);
    expect(s.resources).toEqual({
      'barbarian:rages': 2,
      'sorcerer:sorcery points': 2,
      'monk:focus points': 0,
    });
    expect(s.spentSlots[0]).toBe(2);
    expect(s.hpCurrent).toBe(5);
    expect(s.hpTemp).toBe(4);
    expect(s.hitDiceSpent).toEqual({ d12: 1 });
  });

  it('a long rest recovers everything but keeps Heroic Inspiration', () => {
    let s: PlayState = { ...setHp(fresh(), 5, 30), hpTemp: 4, heroicInspiration: true };
    s = {
      ...s,
      pactSlotsSpent: 1,
      hitDiceSpent: { d8: 2 },
      deathSaves: { successes: 1, failures: 2 },
    };
    s = setResourceUsed(setSpentSlots(s, 2, 1, 3), 'unknown:thing', 1, 1);
    expect(longRest(s)).toEqual({ ...fresh(), heroicInspiration: true });
  });
});

describe('conditions', () => {
  it('toggles conditions and keeps them through a long rest', () => {
    let s = toggleCondition(fresh(), 'prone');
    s = toggleCondition(s, 'poisoned');
    expect(s.conditions).toEqual(['prone', 'poisoned']);
    s = toggleCondition(s, 'prone');
    expect(longRest(s).conditions).toEqual(['poisoned']);
  });

  it('keeps Exhaustion between 0 and 6, a long rest removes one level', () => {
    expect(setExhaustion(fresh(), 9).exhaustion).toBe(6);
    expect(setExhaustion(fresh(), -1).exhaustion).toBe(0);
    expect(longRest(setExhaustion(fresh(), 3)).exhaustion).toBe(2);
    expect(longRest(fresh()).exhaustion).toBe(0);
    expect(exhaustionEffects(3)).toEqual({ d20: -6, speed: -15, dead: false });
    expect(exhaustionEffects(6).dead).toBe(true);
  });
});

describe('playResources', () => {
  it('counts numeric columns, skips dice and passive numbers', () => {
    const rs = playResources(
      sheet(
        [{ id: 'fighter', level: 1 }],
        [
          { classId: 'fighter', name: 'Second Wind', value: '2' },
          { classId: 'fighter', name: 'Weapon Mastery', value: '3' },
          { classId: 'rogue', name: 'Sneak Attack', value: '3d6' },
        ],
      ),
    );
    expect(rs.map((r) => [r.key, r.max, r.short])).toEqual([['fighter:second wind', 2, 1]]);
  });

  it('adds the uses defined in feature texts', () => {
    const rs = playResources(
      sheet(
        [
          { id: 'bard', level: 4 },
          { id: 'fighter', level: 17 },
          { id: 'blood-hunter', level: 6 },
        ],
        [],
        3,
      ),
    );
    expect(rs.map((r) => [r.key, r.max, r.short])).toEqual([
      ['bard:bardic inspiration', 3, 0], // Font of Inspiration comes at level 5
      ['blood-hunter:blood maledict', 2, 'all'],
      ['fighter:action surge', 2, 'all'],
      ['fighter:indomitable', 3, 0],
    ]);
    const bard5 = playResources(sheet([{ id: 'bard', level: 5 }], [], -1));
    expect([bard5[0].max, bard5[0].short]).toEqual([1, 'all']);
  });

  it('counts Lay on Hands as a pool of hit points and Hybrid Transformation for the Lycan only', () => {
    const paladin = playResources(sheet([{ id: 'paladin', level: 6 }], []));
    expect(paladin.map((r) => [r.key, r.max])).toEqual([
      ['paladin:lay on hands', 30],
      ['paladin:faithful steed', 1],
    ]);
    const lycan = (subclassId: string) =>
      playResources(sheet([{ id: 'blood-hunter', level: 3, subclassId }], [])).map((r) => r.key);
    expect(lycan('blood-hunter/order-of-the-lycan')).toContain(
      'blood-hunter:hybrid transformation',
    );
    expect(lycan('blood-hunter/order-of-the-mutant')).not.toContain(
      'blood-hunter:hybrid transformation',
    );
    const t = playResources(
      sheet([{ id: 'blood-hunter', level: 3, subclassId: 'blood-hunter/order-of-the-lycan' }], []),
    ).find((r) => r.name === 'Hybrid Transformation');
    expect(t?.short).toBe('all');
  });

  it("counts the Soulknife's Psionic Energy Dice, only for that subclass, from level 3", () => {
    const dice = (subclassId: string | undefined, level: number) =>
      playResources(sheet([{ id: 'rogue', level, subclassId }], [])).find(
        (r) => r.name === 'Psionic Energy Dice',
      );
    expect(dice('rogue/soulknife', 3)?.max).toBe(4);
    expect(dice('rogue/soulknife', 9)?.max).toBe(8);
    expect(dice('rogue/soulknife', 17)?.max).toBe(12);
    expect(dice('rogue/soulknife', 1)).toBeUndefined();
    expect(dice('rogue/arcane-trickster', 5)).toBeUndefined();
    expect(dice(undefined, 5)).toBeUndefined();
    expect(dice('rogue/soulknife', 3)?.short).toBe(1);
  });
});

describe('rest rules', () => {
  it('unknown resources recover on a long rest only', () => {
    expect(restRule('Something New').short).toBe(0);
    expect(restRule('  Channel   Divinity ').short).toBe(1);
    expect(recover(3, 1)).toBe(2);
    expect(recover(0, 1)).toBe(0);
    expect(recover(3, 'all')).toBe(0);
  });
});

describe('older character files', () => {
  it('get the play state defaults', () => {
    const c = normalizeCharacter({
      id: 'old',
      name: 'Old',
      state: { hpCurrent: 3, hpTemp: 0, spentSlots: [1], resources: {} },
    })!;
    expect(c.state.hpCurrent).toBe(3);
    expect(c.state.pactSlotsSpent).toBe(0);
    expect(c.state.hitDiceSpent).toEqual({});
    expect(c.state.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(c.state.heroicInspiration).toBe(false);
  });
});
