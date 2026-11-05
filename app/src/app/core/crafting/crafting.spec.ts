import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Item } from '../models/compendium';
import {
  CRAFT_SECTIONS,
  CraftSort,
  castsSpells,
  coinsFromCp,
  costBucket,
  costInCp,
  craftProfile,
  craftRarity,
  craftSection,
  groupBySection,
  isConsumable,
  isCraftable,
  magicCraft,
  magicTools,
  mundaneCraft,
  sharedDays,
  sortRows,
  timeBucket,
} from './crafting';

describe('crafting', () => {
  it('mundane: materials are half the price, 1 day per 10 gp (rounded up)', () => {
    // the rule's examples: Plate Armor 1,500 gp -> 750 gp; Heavy Crossbow 50 gp -> 5 days
    const plate = mundaneCraft(150000);
    expect(plate.materialsCp).toBe(75000);
    expect(plate.days).toBe(150);
    expect(mundaneCraft(5000).days).toBe(5);
    expect(mundaneCraft(1500).days).toBe(2);
    expect(mundaneCraft(5).days).toBe(1);
    expect(mundaneCraft(5).materialsCp).toBe(2);
  });

  it('assistants divide the time', () => {
    expect(sharedDays(10, 2)).toBe(5);
    expect(sharedDays(5, 2)).toBe(2.5);
    expect(sharedDays(5, 0)).toBe(5);
  });

  it('converts costs to copper and back', () => {
    expect(costInCp({ cost: { amount: 15, unit: 'sp' } })).toBe(150);
    expect(costInCp({ cost: { amount: 2, unit: 'gp' } })).toBe(200);
    expect(costInCp({ cost: null })).toBeNull();
    expect(coinsFromCp(1275)).toEqual({ gp: 12, sp: 7, cp: 5 });
  });

  it('magic items: table by rarity, halved when consumable', () => {
    expect(magicCraft('rare', false)).toEqual({ days: 50, gp: 2000 });
    expect(magicCraft('uncommon', true)).toEqual({ days: 5, gp: 100 });
    expect(magicCraft('legendary', false)).toEqual({ days: 250, gp: 100000 });
    expect(craftRarity('Very Rare')).toBe('very rare');
    expect(craftRarity('artifact')).toBeNull();
    expect(craftRarity('varies')).toBeNull();
  });

  it('magic item tools by category', () => {
    expect(magicTools('ring')).toEqual(['jewelers-tools']);
    expect(magicTools('Wondrous Item')).toEqual(['tinkers-tools']);
    expect(magicTools('potion')).toEqual(['alchemists-supplies', 'herbalism-kit']);
    expect(magicTools('unknown')).toEqual([]);
  });

  it('spots items that cast spells and what can be crafted', () => {
    expect(castsSpells({ description: 'you can cast Fireball from it.' })).toBe(true);
    expect(castsSpells({ description: 'A +1 bonus to attack rolls.' })).toBe(false);
    const mount = { category: 'mount', cost: { amount: 1, unit: 'gp' } } as Item;
    const rope = { category: 'gear', cost: { amount: 1, unit: 'gp' } } as Item;
    const free = { category: 'gear', cost: null } as Item;
    expect([isCraftable(mount), isCraftable(rope), isCraftable(free)]).toEqual([
      false,
      true,
      false,
    ]);
  });
});

describe('crafting: consumables, sections and profiles (real data)', () => {
  const items = JSON.parse(
    readFileSync(join(process.cwd(), '..', 'data', 'items.json'), 'utf8'),
  ) as Item[];
  const byId = new Map(items.map((i) => [i.id + i.edition, i]));
  const get = (id: string, edition = '2024') => byId.get(id + edition)!;

  it('potions, oils, elixirs, scrolls and magic ammunition are consumable', () => {
    for (const id of [
      'potion-of-healing',
      'oil-of-sharpness',
      'elixir-of-health',
      'philter-of-love',
      'spell-scroll',
      'scroll-of-protection',
      'ammunition-1-2-or-3',
      'walloping-ammunition',
      'ammunition-of-slaying',
    ])
      expect(isConsumable(get(id)), id).toBe(true);
  });

  it('dusts, perfumes, feather tokens and exploding beads say so in their text', () => {
    for (const id of [
      'dust-of-disappearance',
      'dust-of-sneezing-and-choking',
      'perfume-of-bewitching',
      'quaals-feather-token',
      'bead-of-force',
    ])
      expect(isConsumable(get(id)), id).toBe(true);
  });

  it('items with charges, durable gear and plain mentions of "destroyed" are not', () => {
    for (const id of [
      'bag-of-holding',
      'wand-of-wonder',
      'cloak-of-invisibility',
      'arrow-catching-shield',
      'hammer-of-thunderbolts',
      'wand-of-lightning-bolts',
      'rope-of-climbing',
      'ring-of-three-wishes',
      'ioun-stone',
      'mask-of-changed-appearance',
    ])
      expect(isConsumable(get(id)), id).toBe(false);
    expect(isConsumable(get('rope'))).toBe(false);
  });

  it('only a handful of 2024 magic items are consumable beyond potions and scrolls', () => {
    const extra = items
      .filter((i) => i.edition === '2024' && isConsumable(i))
      .map((i) => i.id)
      .filter((id) => !/potion|scroll|oil-of|elixir|philter/.test(id));
    expect(extra.length).toBeLessThan(25);
    expect(extra).toContain('dust-of-disappearance');
  });

  it('every craftable item lands in one known section', () => {
    const craftable = items.filter(isCraftable);
    const groups = groupBySection(craftable);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(craftable.length);
    for (const g of groups) expect(CRAFT_SECTIONS, g.section).toContain(g.section);
  });

  it('sections follow the categories of the compendium', () => {
    const s = (id: string) => craftSection(get(id));
    expect(s('longsword')).toBe('weapon');
    expect(s('plate-armor')).toBe('armor');
    expect(s('shield')).toBe('shield');
    expect(s('smiths-tools')).toBe('tool');
    expect(s('thieves-tools')).toBe('tool');
    expect(s('herbalism-kit')).toBe('kit');
    expect(s('explorers-pack')).toBe('pack');
    expect(s('ammunition')).toBe('ammunition');
    expect(s('arcane-focus')).toBe('focus');
    expect(s('rope')).toBe('gear');
    expect(s('serpent-venom')).toBe('poison');
    expect(s('potion-of-healing')).toBe('magic:potion');
    expect(s('bag-of-holding')).toBe('magic:wondrous item');
    expect(s('spell-scroll')).toBe('magic:scroll');
    expect(s('wand-of-wonder')).toBe('magic:wand');
  });

  it('mounts are not listed', () => {
    expect(items.filter(isCraftable).some((i) => i.category === 'mount')).toBe(false);
  });

  it('profile: consumable potion costs half the table figure', () => {
    const p = craftProfile(get('potion-of-healing'));
    expect(p.consumable).toBe(true);
    expect(p.rarity).toBe('common');
    expect(p.cp).toBe(2500);
    expect(p.days).toBe(2.5);
    expect(p.tools).toEqual(['alchemists-supplies', 'herbalism-kit']);
    const ring = craftProfile(get('ring-of-protection'));
    expect(ring.consumable).toBe(false);
    expect(ring.cp).toBe(200000);
    expect(ring.days).toBe(50);
  });

  it('profile: no figure when the rarity varies; mundane from the price', () => {
    const scroll = craftProfile(get('spell-scroll'));
    expect(scroll.cp).toBeNull();
    expect(scroll.days).toBeNull();
    const giant = craftProfile(get('potion-of-giant-strength'));
    expect(giant.rarity).toBeNull();
    expect(giant.cp).toBeNull();
    const plate = craftProfile(get('plate-armor'));
    expect([plate.cp, plate.days, plate.rarity, plate.tools]).toEqual([75000, 150, null, []]);
  });

  it('buckets and sorting put the unknown last', () => {
    expect(costBucket(1000)).toBe('le10');
    expect(costBucket(1001)).toBe('10-100');
    expect(costBucket(20000)).toBe('100-1000');
    expect(costBucket(null)).toBe('none');
    expect(timeBucket(0.5)).toBe('le1');
    expect(timeBucket(2.5)).toBe('2-5');
    expect(timeBucket(125)).toBe('51-125');
    expect(timeBucket(250)).toBe('gt125');
    const rows = [
      { n: 'b', cp: 5, days: null },
      { n: 'a', cp: null, days: 2 },
      { n: 'c', cp: 1, days: 9 },
    ];
    const run = (s: CraftSort) =>
      sortRows(
        rows,
        s,
        (r) => r,
        (r) => r.n,
      ).map((r) => r.n);
    expect(run('cost-asc')).toEqual(['c', 'b', 'a']);
    expect(run('cost-desc')).toEqual(['b', 'c', 'a']);
    expect(run('time-asc')).toEqual(['a', 'c', 'b']);
    expect(run('name')).toEqual(['a', 'b', 'c']);
  });
});
