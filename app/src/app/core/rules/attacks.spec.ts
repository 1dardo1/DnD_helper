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
const rapier = weapon('rapier', { kind: 'martial', properties: ['Finesse'] });
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

const sheet = (str: number, dex: number, weapons: string[]) =>
  ({
    proficiencyBonus: 2,
    abilities: { STR: { modifier: str }, DEX: { modifier: dex } },
    proficiencies: { weapons },
  }) as unknown as Sheet;

const entry = (item: Item, equipped = true) => ({ id: item.id, equipped, item });

describe('attacks', () => {
  it('uses STR for melee, DEX for ranged and the higher one for Finesse', () => {
    const [sword, bow, rap] = attacksFor(sheet(3, 1, ['Martial weapons']), [
      entry(longsword),
      entry(longbow),
      entry(rapier),
    ]);
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
});
