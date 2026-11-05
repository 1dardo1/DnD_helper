import { baseLabel, baseSummary } from './base-label';
import { Item } from '../models/compendium';

const i18n = {
  language: () => 'en',
  t: (k: string, p?: Record<string, string | number>) =>
    ({
      'gear.ac': `AC ${p?.['ac']}`,
      'gear.stealth': 'Stealth disadvantage',
      'gear.range': `Range ${p?.['r']}`,
      'gear.reach': 'Reach 5 ft',
      'gear.abilityDex': 'uses DEX',
      'gear.abilityStr': 'uses STR',
      'gear.abilityFinesse': 'uses STR or DEX',
    })[k] ?? k,
};
const data = { name: (n: string) => n };

describe('baseLabel', () => {
  it('armor: type, AC and stealth', () => {
    const b = {
      name: 'Chain Mail',
      armor: { kind: 'heavy', baseAC: 16, dexCap: 0, strength: 13, stealthDisadvantage: true },
    } as unknown as Item;
    expect(baseLabel(b, i18n as never, data as never)).toBe(
      'Chain Mail · heavy · AC 16 · Stealth disadvantage',
    );
  });
  it('weapon: damage, range and ability', () => {
    const b = {
      name: 'Longbow',
      weapon: {
        ranged: true,
        damage: [{ dice: '1d8', type: 'piercing' }],
        properties: [],
        range: '150/600',
        mastery: null,
        kind: 'martial',
      },
    } as unknown as Item;
    expect(baseLabel(b, i18n as never, data as never)).toBe(
      'Longbow · 1d8 piercing · Range 150/600 · uses DEX',
    );
  });
});

describe('baseSummary', () => {
  it('is the label without the name', () => {
    const b = {
      name: 'Half Plate Armor',
      armor: { kind: 'medium', baseAC: 15, dexCap: 2, strength: null, stealthDisadvantage: true },
    } as unknown as Item;
    expect(baseSummary(b, i18n as never)).toBe('medium · AC 15 · Stealth disadvantage');
  });
});
