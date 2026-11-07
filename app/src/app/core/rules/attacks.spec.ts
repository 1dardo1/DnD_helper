import { Item } from '../models/compendium';
import { attacksFor, proficientWith } from './attacks';
import { Sheet } from './sheet';

const weapon = (id: string, w: Partial<NonNullable<Item['weapon']>>): Item =>
  ({
    id,
    type: 'item',
    name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    category: 'weapon',
    weapon: {
      kind: 'simple',
      ranged: false,
      damage: [{ dice: '1d6', type: 'piercing' }],
      properties: [],
      range: null,
      mastery: null,
      ...w,
    },
  }) as unknown as Item;

const longsword = weapon('longsword', {
  kind: 'martial',
  damage: [{ dice: '1d8', type: 'slashing' }],
  properties: ['Versatile (1d10)'],
  mastery: 'Sap',
});
const rapier = weapon('rapier', { kind: 'martial', properties: ['Finesse'], mastery: 'Vex' });
const longbow = weapon('longbow', {
  kind: 'martial',
  ranged: true,
  damage: [{ dice: '1d8', type: 'piercing' }],
  properties: ['Ammunition (Range 150/600; Arrow)', 'Heavy', 'Two-Handed'],
  range: '150/600',
});
const dagger = weapon('dagger', {
  damage: [{ dice: '1d4', type: 'piercing' }],
  properties: ['Finesse', 'Light', 'Thrown (Range 20/60)'],
});
const whip = weapon('whip', { kind: 'martial', properties: ['Finesse', 'Reach'] });

const sheet = (
  str: number,
  dex: number,
  weapons: string[],
  mastery: { slots: number; chosen: string[] } = { slots: 0, chosen: [] },
) =>
  ({
    proficiencyBonus: 2,
    classes: [{ id: 'fighter' }],
    abilities: { STR: { modifier: str }, DEX: { modifier: dex } },
    proficiencies: { weapons },
    combat: { masterySlots: mastery.slots, masteryChosen: mastery.chosen },
  }) as unknown as Sheet;

const entry = (item: Item, equipped = true) => ({ id: item.id, equipped, item });

describe('attacks', () => {
  it('uses STR for melee, DEX for ranged and the higher one for Finesse', () => {
    const [sword, bow, rap] = attacksFor(
      sheet(3, 1, ['Martial weapons'], { slots: 2, chosen: ['longsword'] }),
      [entry(longsword), entry(longbow), entry(rapier)],
    );
    expect(sword).toMatchObject({ ability: 'STR', bonus: 5, damage: '1d8+3', versatile: '1d10+3' });
    expect(sword).toMatchObject({ reach: 5, range: null, mastery: 'Sap' });
    expect(bow).toMatchObject({ ability: 'DEX', bonus: 3, damage: '1d8+1', range: '150/600' });
    expect(bow.properties).toEqual(['Ammunition', 'Heavy', 'Two-Handed']);
    expect(rap.ability).toBe('STR');
    expect(attacksFor(sheet(0, 4, ['Martial weapons']), [entry(rapier)])[0]).toMatchObject({
      ability: 'DEX',
      damage: '1d6+4',
    });
  });

  it('adds the proficiency bonus only when proficient', () => {
    const [sword] = attacksFor(sheet(3, 0, ['Simple weapons']), [entry(longsword)]);
    expect(sword).toMatchObject({ proficient: false, bonus: 3 });
    expect(proficientWith(['Simple weapons'], dagger)).toBe(true);
    expect(proficientWith(['Longswords'], longsword)).toBe(true);
    const rogue = ['Simple weapons and Martial weapons that have the Finesse or Light property'];
    expect(proficientWith(rogue, rapier)).toBe(true);
    expect(proficientWith(rogue, longsword)).toBe(false);
  });

  it('knows reach, thrown range and the unarmed strike, equipped weapons first', () => {
    const list = attacksFor(sheet(2, 3, ['Simple weapons', 'Martial weapons']), [
      entry(whip, false),
      entry(dagger),
    ]);
    expect(list.map((a) => a.name)).toEqual(['Dagger', 'Whip', 'Unarmed Strike']);
    expect(list[0]).toMatchObject({ ability: 'DEX', reach: 5, range: '20/60' });
    expect(list[1].reach).toBe(10);
    expect(list[2]).toMatchObject({ bonus: 4, damage: '3', damageType: 'bludgeoning' });
  });

  // Fighter's Weapon Mastery (PHB 2024): "Your training with weapons allows you to use the
  // mastery properties of three kinds of Simple or Martial weapons of your choice. [...]
  // Whenever you finish a Long Rest, you can [...] change one of those weapon choices."
  // Rogue's is worded the same way but fixed at two kinds and never grows with level: "...two
  // kinds of weapons of your choice with which you have proficiency... Whenever you finish a
  // Long Rest, you can change the kinds of weapons you chose."
  describe('Weapon Mastery (the player chooses which kinds are active)', () => {
    it('shows no mastery on any weapon until the player has chosen one', () => {
      const noChoice = sheet(3, 1, ['Martial weapons'], { slots: 3, chosen: [] });
      const [sword, rap] = attacksFor(noChoice, [entry(longsword), entry(rapier)]);
      expect(sword.mastery).toBeNull();
      expect(rap.mastery).toBeNull();
    });

    it('Fighter: shows mastery only on the chosen kinds, up to its (growing) slot count', () => {
      const fighter = sheet(3, 1, ['Martial weapons'], { slots: 3, chosen: ['longsword'] });
      const [sword, rap] = attacksFor(fighter, [entry(longsword), entry(rapier)]);
      expect(sword.mastery).toBe('Sap');
      expect(rap.mastery).toBeNull();
    });

    it('Rogue: fixed at two kinds, never more even if more were somehow stored', () => {
      const rogue = sheet(
        0,
        4,
        ['Simple weapons and Martial weapons that have the Finesse or Light property'],
        {
          slots: 2,
          chosen: ['longsword', 'rapier'],
        },
      );
      const [sword, rap] = attacksFor(rogue, [entry(longsword), entry(rapier)]);
      // the sheet only shows what the engine kept as valid; attacksFor trusts combat.masteryChosen
      expect(sword.mastery).toBe('Sap');
      expect(rap.mastery).toBe('Vex');
    });
  });
});

describe('Soulknife Psychic Blades', () => {
  const soulknife = (str: number, dex: number, combat: Record<string, unknown> = {}) =>
    ({
      proficiencyBonus: 2,
      abilities: { STR: { modifier: str }, DEX: { modifier: dex } },
      proficiencies: { weapons: [] },
      classes: [{ id: 'rogue', level: 3 }],
      combat: { psychicBlades: true, soulBlades: false, masterySlots: 1, ...combat },
    }) as unknown as Sheet;

  it('adds a main and a bonus-action blade: 1d6 and 1d4 psychic, DEX (Finesse), Vex, 60/120 ft', () => {
    const list = attacksFor(soulknife(1, 3), []);
    const names = list.map((a) => a.name);
    expect(names).toEqual(['Unarmed Strike', 'Psychic Blade', 'Psychic Blade (bonus action)']);
    const [main, bonus] = list.slice(1);
    expect(main).toMatchObject({
      entryId: '',
      nameKey: 'sheet.psychicBlade',
      ability: 'DEX',
      bonus: 5, // DEX +3, proficiency +2
      proficient: true,
      damage: '1d6+3',
      damageType: 'psychic',
      reach: 5,
      range: '60/120',
      properties: ['Finesse', 'Thrown'],
      mastery: 'Vex',
    });
    expect(bonus).toMatchObject({
      nameKey: 'sheet.psychicBladeBonus',
      damage: '1d4+3',
      mastery: 'Vex',
      range: '60/120',
    });
    expect(main.notes.map((n) => n.id)).toEqual(['psychicBlade']);
    expect(bonus.notes.map((n) => n.id)).toEqual(['psychicBlade', 'psychicBladeBonus']);
  });

  it('uses the higher of STR and DEX, like any other Finesse weapon', () => {
    const [, main] = attacksFor(soulknife(4, 1), []);
    expect(main).toMatchObject({ ability: 'STR', damage: '1d6+4' });
  });

  it('adds no Psychic Blade rows without the Psychic Blades feature', () => {
    const list = attacksFor(
      { ...soulknife(1, 3), combat: { psychicBlades: false } } as unknown as Sheet,
      [],
    );
    expect(list.map((a) => a.name)).toEqual(['Unarmed Strike']);
  });

  it('drops the bonus-action blade when a Two-Handed weapon is equipped (no free hand)', () => {
    const list = attacksFor(soulknife(1, 3), [entry(longbow)]);
    expect(list.map((a) => a.name)).toEqual(['Longbow', 'Unarmed Strike', 'Psychic Blade']);
  });

  it("keeps the bonus-action blade with a one-handed weapon equipped (can't check shields)", () => {
    const list = attacksFor(soulknife(1, 3), [entry(rapier)]);
    expect(list.map((a) => a.name)).toEqual([
      'Rapier',
      'Unarmed Strike',
      'Psychic Blade',
      'Psychic Blade (bonus action)',
    ]);
  });

  it('adds a Soul Blades (level 9) note about Homing Strikes to both rows', () => {
    const list = attacksFor(soulknife(1, 3, { soulBlades: true }), []);
    const [main, bonus] = list.slice(1);
    expect(main.notes.map((n) => n.id)).toEqual(['psychicBlade', 'soulBladesHoming']);
    expect(bonus.notes.map((n) => n.id)).toEqual([
      'psychicBlade',
      'psychicBladeBonus',
      'soulBladesHoming',
    ]);
  });
});
