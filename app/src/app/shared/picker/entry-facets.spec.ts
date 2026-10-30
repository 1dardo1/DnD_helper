import { Entry } from '../../core/models/compendium';
import {
  areaShapes,
  armorTraining,
  backgroundFeat,
  backgroundTool,
  castingBucket,
  componentValues,
  durationBucket,
  facetOptionsFor,
  facetValues,
  increaseValues,
  priceBucket,
  priceInCp,
  prerequisiteValues,
  rangeKind,
  resolveValues,
  sortByPrice,
  speedValues,
  spellDamage,
  subclassCasting,
  weaponProperties,
  weaponTraining,
} from './entry-facets';

const cls = (armor: string[], weapons: string[] = [], extra = {}) =>
  ({
    id: 'c',
    type: 'class',
    name: 'C',
    edition: '2024',
    hitDie: 10,
    primaryAbility: ['STR', 'DEX'],
    savingThrows: ['STR', 'CON'],
    spellcasting: null,
    proficiencies: { armor, weapons, tools: [], skills: { choose: 2, from: [] } },
    ...extra,
  }) as unknown as Entry;

const spell = (unit: string, extra = {}) =>
  ({
    id: unit,
    type: 'spell',
    name: unit,
    edition: '2024',
    level: 1,
    school: 'evocation',
    classes: ['wizard'],
    concentration: false,
    ritual: false,
    range: '60 feet',
    duration: 'Instantaneous',
    description: '',
    components: { v: true, s: true, m: false, material: null, cost: null, consumed: false },
    castingTime: { raw: unit, amount: 1, unit },
    ...extra,
  }) as unknown as Entry;

const time = (unit: string) => ({ castingTime: { raw: '', amount: 1, unit } });

describe('spell facets', () => {
  it('buckets casting times into action, bonus action, reaction or longer (plus ritual)', () => {
    expect(castingBucket(time('action'))).toBe('action');
    expect(castingBucket(time('bonus-action'))).toBe('bonus');
    expect(castingBucket(time('reaction'))).toBe('reaction');
    expect(castingBucket(time('minute'))).toBe('longer');
    expect(castingBucket(time('hour'))).toBe('longer');
    expect(facetValues(spell('minute', { ritual: true }), 'castingTime')).toEqual([
      'longer',
      'ritual',
    ]);
  });

  it('buckets durations', () => {
    expect(durationBucket('Instantaneous')).toBe('instant');
    expect(durationBucket('Instantanious')).toBe('instant');
    expect(durationBucket('Instantaneous or 1 hour')).toBe('instant');
    expect(durationBucket('Concentration, up to 1 minute')).toBe('minute');
    expect(durationBucket('1 round')).toBe('minute');
    expect(durationBucket('Concentration, up to 6 rounds')).toBe('minute');
    expect(durationBucket('Concentration, up to 10 minutes')).toBe('hour');
    expect(durationBucket('1 Hour')).toBe('hour');
    expect(durationBucket('8 hours')).toBe('longer');
    expect(durationBucket('10 Days')).toBe('longer');
    expect(durationBucket('Until dispelled or triggered')).toBe('dispelled');
    expect(durationBucket('Special')).toBe('special');
    expect(durationBucket('')).toBe('special');
  });

  it('lists components, material cost and consumption', () => {
    const c = (v: boolean, s: boolean, m: boolean, cost: number | null, consumed = false) => ({
      components: { v, s, m, material: m ? 'x' : null, cost, consumed },
    });
    expect(componentValues(c(true, true, false, null))).toEqual(['V', 'S', 'noM']);
    expect(componentValues(c(true, false, true, 300, true))).toEqual([
      'V',
      'M',
      'cost',
      'consumed',
    ]);
  });

  it('tells self, touch and ranged spells apart', () => {
    expect(rangeKind('Self (15-foot Cone)')).toBe('self');
    expect(rangeKind('Touch')).toBe('touch');
    expect(rangeKind('150 feet')).toBe('ranged');
    expect(rangeKind('1 mile')).toBe('ranged');
    expect(rangeKind('Sight')).toBe('ranged');
    expect(rangeKind('Special')).toBe('special');
  });

  it('finds area shapes only when named with a size', () => {
    expect(
      areaShapes({ range: '150 feet', description: 'Each creature in a 20-foot-radius Sphere…' }),
    ).toEqual(['sphere']);
    expect(areaShapes({ range: 'Self (15-foot cone)', description: '' })).toEqual(['cone']);
    expect(
      areaShapes({
        range: 'Self',
        description: 'A Line 100 feet long… a 60-foot-long, 5-foot-wide Line; a 10-foot Emanation',
      }),
    ).toEqual(['emanation', 'line']);
    expect(areaShapes({ range: 'Touch', description: 'within a line of sight' })).toEqual([]);
  });

  it('reads attack rolls, saving throws, damage types and healing from the text', () => {
    const d = (description: string) => ({ description });
    expect(resolveValues(d('Make a ranged spell attack against the target.'))).toEqual(['attack']);
    expect(
      resolveValues(
        d('Each creature makes a Dexterity saving throw, then a Constitution saving throw'),
      ),
    ).toEqual(['DEX', 'CON']);
    expect(resolveValues(d('You can see invisible creatures.'))).toEqual([]);
    expect(spellDamage(d('takes 8d6 Fire damage, or 2d6 Cold damage'))).toEqual(['cold', 'fire']);
    expect(spellDamage(d('A creature regains a number of Hit Points equal to 2d8'))).toEqual([
      'healing',
    ]);
    expect(spellDamage(d('You gain Resistance.'))).toEqual([]);
  });

  it('answers spell facets and keeps the compendium ones', () => {
    const s = spell('reaction', { concentration: true, range: 'Self' });
    expect(facetValues(s, 'castingTime')).toEqual(['reaction']);
    expect(facetValues(s, 'concentration')).toEqual(['yes']);
    expect(facetValues(s, 'ritual')).toEqual(['no']);
    expect(facetValues(s, 'range')).toEqual(['self']);
    expect(facetValues(s, 'duration')).toEqual(['instant']);
    expect(facetValues(s, 'level')).toEqual(['1']);
    expect(facetValues(s, 'class')).toEqual(['wizard']);
    expect(facetValues(s, 'hitDie')).toEqual([]);
  });
});

describe('class, background, species, feat and item facets', () => {
  it('reads armor training in any spelling, weapons as glossary keys, caster kind', () => {
    const fighter = cls(
      ['Light', 'Medium', 'Heavy armor', 'Shields'],
      ['Simple', 'Martial weapons'],
    );
    expect(armorTraining(fighter as never)).toEqual(['light', 'medium', 'heavy', 'shield']);
    expect(armorTraining(cls(['Light armor', 'shields']) as never)).toEqual(['light', 'shield']);
    expect(weaponTraining(fighter as never)).toEqual(['simple weapons', 'martial weapons']);
    expect(facetValues(cls([]), 'armor')).toEqual(['none']);
    expect(facetValues(fighter, 'caster')).toEqual(['none']);
    expect(facetValues(cls([], [], { spellcasting: { kind: 'pact' } }), 'caster')).toEqual([
      'pact',
    ]);
    expect(facetValues(fighter, 'hitDie')).toEqual(['10']);
    expect(facetValues(fighter, 'saves')).toEqual(['STR', 'CON']);
  });

  it('tells subclasses that cast from those with extra spells', () => {
    expect(subclassCasting({ spellcasting: {} as never, spells: null })).toBe('caster');
    expect(
      subclassCasting({ spellcasting: null, spells: [{ classLevel: 3, spells: ['x'] }] }),
    ).toBe('spells');
    expect(subclassCasting({ spells: null })).toBe('no');
  });

  it('gives a background its feat and tool (or kind of tool to choose)', () => {
    expect(backgroundFeat({ feat: 'Magic Initiate (Cleric)', featId: 'magic-initiate' })).toBe(
      'Magic Initiate (Cleric)',
    );
    expect(
      backgroundFeat({ feat: 'Survivor or a Dark Gift feat of your choice', featId: null }),
    ).toBe('dark-gift');
    expect(backgroundFeat({ feat: null, featId: null })).toBeNull();
    expect(backgroundTool({ tools: "Tinker's Tools (as engineer's toolkit)" })).toBe(
      "tool:Tinker's Tools",
    );
    expect(backgroundTool({ tools: 'Choose one kind of Gaming Set' })).toBe('toolGroup:Gaming Set');
    expect(backgroundTool({ tools: null })).toBeNull();
  });

  it('lists walking speed and every other way of moving', () => {
    expect(speedValues({ speed: { walk: 30, fly: 30 } })).toEqual(['walk:30', 'fly']);
    expect(speedValues({ speed: { walk: 25, swim: 0 } })).toEqual(['walk:25']);
  });

  it('reads feat ability increases and prerequisites', () => {
    expect(increaseValues({ id: 'x', abilityIncrease: null })).toEqual(['no']);
    expect(
      increaseValues({
        id: 'x',
        abilityIncrease: { choose: 1, from: ['STR', 'DEX'], amount: 1, max: 20 },
      }),
    ).toEqual(['yes', 'STR', 'DEX']);
    expect(increaseValues({ id: 'ability-score-improvement', abilityIncrease: null })).toContain(
      'CHA',
    );
    expect(prerequisiteValues(null)).toEqual(['none']);
    expect(prerequisiteValues({ raw: 'Level 4+', level: 4 })).toEqual(['any', 'level4']);
    expect(prerequisiteValues({ raw: 'Level 19+', level: 19 })).toEqual(['any', 'level19']);
    expect(prerequisiteValues({ raw: 'Elf', level: 4, species: ['elf'] })).toEqual([
      'any',
      'level4',
      'species',
    ]);
  });

  it('reads weapon properties without their details', () => {
    expect(
      weaponProperties({
        weapon: {
          properties: ['Ammunition (Range 80/320; Arrow)', 'Two-Handed'],
        } as never,
      }),
    ).toEqual(['ammunition', 'two-handed']);
  });

  it('orders facet options in game order, else by label', () => {
    const spells = [spell('minute'), spell('reaction'), spell('action'), spell('bonus-action')];
    expect(facetOptionsFor(spells, 'castingTime', (v) => v).map((o) => o.value)).toEqual([
      'action',
      'bonus',
      'reaction',
      'longer',
    ]);
    const classes = [cls([], [], { hitDie: 12 }), cls([], [], { hitDie: 6 }), cls([])];
    expect(facetOptionsFor(classes, 'hitDie', (v) => `d${v}`)).toEqual([
      { value: '6', label: 'd6' },
      { value: '10', label: 'd10' },
      { value: '12', label: 'd12' },
    ]);
    expect(facetOptionsFor(spells, 'school', (v) => v.toUpperCase())).toEqual([
      { value: 'evocation', label: 'EVOCATION' },
    ]);
  });
});

describe('item prices', () => {
  const cost = (amount: number, unit: string) => ({ amount, unit });

  it('converts every coin to copper with the D&D rates', () => {
    expect(priceInCp(cost(3, 'cp'))).toBe(3);
    expect(priceInCp(cost(5, 'sp'))).toBe(50);
    expect(priceInCp(cost(1, 'ep'))).toBe(50);
    expect(priceInCp(cost(15, 'gp'))).toBe(1500);
    expect(priceInCp(cost(2, 'pp'))).toBe(2000);
    expect(priceInCp(null)).toBeNull();
    expect(priceInCp(cost(1, 'beads'))).toBeNull();
  });

  it('buckets prices in gold', () => {
    expect(priceBucket(null)).toBe('none');
    expect(priceBucket(cost(9, 'sp'))).toBe('lt1');
    expect(priceBucket(cost(10, 'sp'))).toBe('1-10');
    expect(priceBucket(cost(10, 'gp'))).toBe('1-10');
    expect(priceBucket(cost(50, 'gp'))).toBe('10-100');
    expect(priceBucket(cost(100, 'pp'))).toBe('100-1000');
    expect(priceBucket(cost(1500, 'gp'))).toBe('gt1000');
  });

  it('sorts by price, unpriced last', () => {
    const items = [
      { id: 'a', cost: cost(1, 'gp') },
      { id: 'b', cost: null },
      { id: 'c', cost: cost(5, 'sp') },
      { id: 'd', cost: cost(1, 'pp') },
    ];
    expect(sortByPrice(items).map((i) => i.id)).toEqual(['c', 'a', 'd', 'b']);
    expect(sortByPrice(items, true).map((i) => i.id)).toEqual(['d', 'a', 'c', 'b']);
  });
});

describe('spell area and effect facets', () => {
  it('says whether a spell has an area, and which', () => {
    const s = spell('action', { range: 'Self (15-foot Cone)' });
    expect(facetValues(s, 'area')).toEqual(['yes', 'cone']);
    expect(facetValues(spell('action'), 'area')).toEqual(['none']);
  });

  it('marks spells without damage or healing as "other"', () => {
    expect(facetValues(spell('action', { description: 'You turn invisible.' }), 'damage')).toEqual([
      'other',
    ]);
    expect(
      facetValues(spell('action', { description: 'It takes 1d10 Fire damage.' }), 'damage'),
    ).toEqual(['fire']);
  });
});
