import { describe, expect, it } from 'vitest';

import { newCharacter, normalizeCharacter } from '../models/character';
import {
  CANNON_CREATE_KEY,
  canCreateCannon,
  cannonHpMax,
  cannonMonster,
  cannonOptions,
  createCannon,
  dismissCannon,
  explosiveCannon,
  hasEldritchCannon,
  hasFreeCreate,
  healCannon,
  normalizeCannon,
  updateCannon,
} from './cannon';

const SLOTS = [4, 3, 3, 0, 0, 0, 0, 0, 0];

function artillerist(level: number) {
  const ch = newCharacter('Oren', 'test');
  ch.classes = [{ id: 'artificer', level, subclassId: 'artificer/artillerist-ua', hp: [] }];
  return ch;
}

describe('hasEldritchCannon', () => {
  it('needs the Artillerist subclass at Artificer level 3+', () => {
    expect(hasEldritchCannon(artillerist(2))).toBe(false);
    expect(hasEldritchCannon(artillerist(3))).toBe(true);
    const other = newCharacter('X', 'test');
    other.classes = [{ id: 'artificer', level: 5, subclassId: 'artificer/alchemist-ua', hp: [] }];
    expect(hasEldritchCannon(other)).toBe(false);
  });

  it('Explosive Cannon from level 9', () => {
    expect(explosiveCannon(artillerist(8))).toBe(false);
    expect(explosiveCannon(artillerist(9))).toBe(true);
  });
});

describe('cannonHpMax', () => {
  it('is 5 times the Artificer level', () => {
    expect(cannonHpMax(3)).toBe(15);
    expect(cannonHpMax(9)).toBe(45);
    expect(cannonHpMax(0)).toBe(1); // never zero: the card needs a positive maximum
  });
});

describe('creating a cannon', () => {
  it('a free creation is available until spent, then a Long Rest brings it back', () => {
    const ch = artillerist(3);
    expect(hasFreeCreate(ch)).toBe(true);
    expect(canCreateCannon(ch, SLOTS)).toBe(true);
    const a = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    expect(a).not.toBeNull();
    expect(a.state.cannon?.active).toBe(true);
    expect(a.state.resources[CANNON_CREATE_KEY]).toBe(1);
    expect(hasFreeCreate(a)).toBe(false);
  });

  it('can have only one cannon at a time', () => {
    const ch = artillerist(3);
    const a = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    expect(createCannon(a, 'Tiny', 'wheels', { kind: 'free' }, SLOTS)).toBeNull();
    expect(canCreateCannon(a, SLOTS)).toBe(false);
  });

  it('once the free use is spent, creating another costs a spell slot', () => {
    const ch = artillerist(3);
    const used = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    const dismissed = dismissCannon(used);
    expect(canCreateCannon(dismissed, SLOTS)).toBe(true); // a slot is available
    expect(createCannon(dismissed, 'Small', 'legs', { kind: 'free' }, SLOTS)).toBeNull();
    const bySlot = createCannon(dismissed, 'Small', 'wheels', { kind: 'slot', level: 2 }, SLOTS)!;
    expect(bySlot.state.cannon?.active).toBe(true);
    expect(bySlot.state.cannon?.aspect).toBe('wheels');
    expect(bySlot.state.spentSlots[1]).toBe(1);
  });

  it('fails a slot that is not available', () => {
    const ch = artillerist(3);
    const used = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    const dismissed = dismissCannon(used);
    expect(createCannon(dismissed, 'Small', 'legs', { kind: 'slot', level: 9 }, SLOTS)).toBeNull();
  });

  it('a Long Rest clears the resources, so the free creation comes back', () => {
    const ch = artillerist(3);
    const used = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    expect(used.state.resources[CANNON_CREATE_KEY]).toBe(1);
    const rested = { ...used, state: { ...used.state, resources: {} } };
    expect(hasFreeCreate(rested)).toBe(true);
  });
});

describe('healing, dismissing and damage', () => {
  it('healing clamps between 0 damage and the current damage', () => {
    const ch = artillerist(3);
    let c = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    c = updateCannon(c, 3, (m) => ({ ...m, hp: m.hp - 10 })); // 5 damage taken
    expect(c.state.cannon?.damage).toBe(10);
    const healed = healCannon(c, 7);
    expect(healed.state.cannon?.damage).toBe(3);
    const overhealed = healCannon(healed, 99);
    expect(overhealed.state.cannon?.damage).toBe(0);
  });

  it('dismissing removes the cannon', () => {
    const ch = artillerist(3);
    const c = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    expect(dismissCannon(c).state.cannon).toBeUndefined();
  });

  it('disappears at 0 Hit Points', () => {
    const ch = artillerist(3);
    let c = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    c = updateCannon(c, 3, (m) => ({ ...m, hp: 0 }));
    expect(c.state.cannon).toBeUndefined();
  });
});

describe('cannonOptions', () => {
  it('the three known options, with the spell save DC and Int modifier worked in', () => {
    const opts = cannonOptions(15, 4, false);
    expect(opts.map((o) => o.key)).toEqual(['flamethrower', 'force-ballista', 'protector']);
    expect(opts[0].description).toContain('DC 15');
    expect(opts[0].description).toContain('9 (2d8)');
    expect(opts[2].description).toContain('1d8 + 4');
  });

  it('Explosive Cannon (level 9+) adds a die to the damage rolls', () => {
    const opts = cannonOptions(15, 4, true);
    expect(opts[0].description).toContain('13 (3d8)');
    expect(opts[1].description).toContain('13 (3d8)');
  });
});

describe('cannonMonster', () => {
  it("builds a stat block with AC 18, the Artificer's Hit Points and its immunities", () => {
    const m = cannonMonster({ size: 'Small', aspect: 'legs' }, 5, 14, 3);
    expect(m.ac).toBe(18);
    expect(m.hp).toBe(25);
    expect(m.immunities).toEqual(['poison', 'psychic']);
    expect(m.actions.map((a) => a.name)).toEqual(['Flamethrower', 'Force Ballista', 'Protector']);
    expect(m.reactions).toHaveLength(0);
  });

  it('adds Detonate once Explosive Cannon is known', () => {
    const m = cannonMonster({ size: 'Tiny', aspect: 'wheels' }, 9, 16, 4);
    expect(m.reactions.map((a) => a.name)).toEqual(['Detonate']);
    expect(m.size).toEqual(['Tiny']);
  });
});

describe('normalizeCannon / normalizeCharacter', () => {
  it('drops an inactive or malformed cannon', () => {
    expect(normalizeCannon(undefined)).toBeUndefined();
    expect(normalizeCannon({ active: false })).toBeUndefined();
    expect(normalizeCannon('nope')).toBeUndefined();
  });

  it('keeps a well-formed active cannon and clamps its numbers', () => {
    const c = normalizeCannon({
      active: true,
      size: 'Tiny',
      aspect: 'wheels',
      damage: -4,
      temp: 2,
    });
    expect(c).toEqual({ active: true, size: 'Tiny', aspect: 'wheels', damage: 0, temp: 2 });
  });

  it('round-trips through character normalization', () => {
    const ch = artillerist(3);
    const created = createCannon(ch, 'Small', 'legs', { kind: 'free' }, SLOTS)!;
    const raw = JSON.parse(JSON.stringify(created));
    const back = normalizeCharacter(raw)!;
    expect(back.state.cannon).toEqual(created.state.cannon);
  });
});
