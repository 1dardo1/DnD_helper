import { newCharacter, normalizeCharacter } from '../models/character';
import { Item } from '../models/compendium';
import {
  addSpellItem,
  consumeSpellItem,
  levelStats,
  parseLevelTable,
  spellAllowed,
  spellBinding,
} from './spell-items';

const TABLE = `| Spell Level | Rarity | Save DC | Attack Bonus |
|---|---|---|---|
| Cantrip | Common | 13 | +5 |
| 1 | Common | 13 | +5 |
| 3 | Uncommon | 15 | +7 |
| 9 | Legendary | 19 | +11 |`;

const item = (id: string, description: string) => ({ id, name: id, description }) as Item;
const scroll = item('spell-scroll', `A scroll.\n\n${TABLE}`);
const armor = item(
  'enspelled-armor',
  `Bound into this armor is a spell of level 8 or lower. The spell must belong to the Abjuration or Illusion school of magic.\n\n${TABLE}`,
);
const weapon = item(
  'enspelled-weapon',
  'Bound into this weapon is a spell of level 8 or lower. The spell is determined when the weapon is created and must belong to the Conjuration, Divination, Evocation, Necromancy, or Transmutation school of magic.',
);
const staff = item(
  'enspelled-staff',
  'Bound into this staff is a spell of level 8 or lower. The spell can be of any school of magic.',
);

describe('spell items', () => {
  it('reads the level table of the text', () => {
    expect(parseLevelTable(TABLE)).toEqual([
      { level: 0, rarity: 'common', dc: 13, attack: 5 },
      { level: 1, rarity: 'common', dc: 13, attack: 5 },
      { level: 3, rarity: 'uncommon', dc: 15, attack: 7 },
      { level: 9, rarity: 'legendary', dc: 19, attack: 11 },
    ]);
  });

  it('knows which items ask for a spell and their limits', () => {
    const s = spellBinding(scroll)!;
    expect([s.kind, s.minLevel, s.maxLevel, s.schools]).toEqual(['scroll', 0, 9, null]);
    expect(levelStats(s, 3)).toMatchObject({ dc: 15, attack: 7 });
    expect(spellBinding(armor)!.schools).toEqual(['abjuration', 'illusion']);
    expect(spellBinding(weapon)!.schools).toEqual([
      'conjuration',
      'divination',
      'evocation',
      'necromancy',
      'transmutation',
    ]);
    expect(spellBinding(staff)).toMatchObject({ kind: 'bound', maxLevel: 8, schools: null });
    expect(spellBinding(item('longsword', ''))).toBeNull();
  });

  it('fixed-level scrolls take their DC from the text', () => {
    const b = spellBinding(
      item(
        'spell-scroll-level-1',
        'A Spell Scroll (Level 1). The spell save DC is 13, and the attack bonus is +5.',
      ),
    )!;
    expect([b.minLevel, b.maxLevel]).toEqual([1, 1]);
    expect(levelStats(b, 1)).toMatchObject({ dc: 13, attack: 5 });
    expect(spellBinding(item('spell-scroll-cantrip', 'x'))!.maxLevel).toBe(0);
  });

  it('limits the spell by level and school', () => {
    const a = spellBinding(armor)!;
    expect(spellAllowed(a, { level: 8, school: 'illusion' })).toBe(true);
    expect(spellAllowed(a, { level: 9, school: 'illusion' })).toBe(false);
    expect(spellAllowed(a, { level: 2, school: 'evocation' })).toBe(false);
    expect(spellAllowed(spellBinding(scroll)!, { level: 9, school: 'evocation' })).toBe(true);
  });

  it('adds the item with its spell, stacking only the same spell, and uses scrolls up', () => {
    let c = addSpellItem(newCharacter('A', 'x'), scroll, 'fireball');
    c = addSpellItem(c, scroll, 'fireball');
    c = addSpellItem(c, scroll, 'shield');
    expect(c.inventory.map((e) => [e.id, e.spellId, e.qty])).toEqual([
      ['spell-scroll-fireball', 'fireball', 2],
      ['spell-scroll-shield', 'shield', 1],
    ]);
    // survives saving and loading
    c = normalizeCharacter(JSON.parse(JSON.stringify(c)))!;
    expect(c.inventory[0].spellId).toBe('fireball');
    c = consumeSpellItem(c, 'spell-scroll-fireball');
    expect(c.inventory.map((e) => e.qty)).toEqual([1, 1]);
    c = consumeSpellItem(c, 'spell-scroll-fireball');
    expect(c.inventory.map((e) => e.id)).toEqual(['spell-scroll-shield']);
  });
});
