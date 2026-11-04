import { describe, expect, it } from 'vitest';

import { Character, newCharacter } from '../models/character';
import { Background, Feat, Item } from '../models/compendium';
import { computeSheet, RulesData } from '../rules/engine';
import { itemIndex, parseStartingEquipment } from '../rules/starting-equipment';
import {
  BackgroundDraft,
  CustomBackground,
  buildBackground,
  draftOf,
  emptyDraft,
  equipmentText,
  isCustomId,
  isWritable,
  newCustomId,
  normaliseName,
  normalizeCustomBackground,
  validateDraft,
} from './custom-background';

const mk = (id: string, name: string, extra: Partial<Item> = {}): Item =>
  ({
    id,
    type: 'item',
    name,
    edition: '2024',
    category: 'gear',
    cost: { amount: 1, unit: 'gp' },
    weight: null,
    ...extra,
  }) as unknown as Item;

// names as they are in data/items.json: plurals, a comma, an apostrophe, a name ending in "s"
const items: Item[] = [
  mk('rope', 'Rope'),
  mk('torch', 'Torch'),
  mk('pouch', 'Pouch'),
  mk('candle', 'Candle'),
  mk('oil', 'Oil'),
  mk('lantern-hooded', 'Lantern, Hooded'),
  mk('travelers-clothes', "Traveler's Clothes"),
  mk('navigators-tools', "Navigator's Tools", { category: 'tool' }),
  mk('arrows', 'Arrows'),
  mk('dagger', 'Dagger', { category: 'weapon' }),
  mk('box', 'Box'),
  mk('flask', 'Flask'),
  mk('rations', 'Rations'),
];
// official equipment texts, to check the shape we copy
const backgrounds = [
  {
    equipment:
      "Choose A or B: (A) Calligrapher's Supplies, Book (prayers), Holy Symbol, Parchment (10 sheets), Robe, 8 GP; or (B) 50 GP",
  },
  {
    equipment:
      "Choose A or B: (A) Artisan's Tools (same as above), 2 Pouches, Traveler's Clothes, 32 GP; or (B) 50 GP",
  },
] as Background[];
const itemMap = new Map(items.map((i) => [i.id, i]));
const index = itemIndex(items);

const featIds = new Set(['alert', 'skilled', 'magic-initiate']);

function valid(): BackgroundDraft {
  return {
    name: 'Lighthouse Keeper',
    description: 'You kept the light burning for passing ships.',
    abilityScores: ['CON', 'WIS', 'STR'],
    featId: 'alert',
    skills: ['perception', 'survival'],
    tool: { mode: 'specific', value: "Navigator's Tools" },
    equipment: {
      items: [
        { itemId: 'rope', qty: 1 },
        { itemId: 'torch', qty: 5 },
        { itemId: 'lantern-hooded', qty: 1 },
      ],
      gold: 12,
      includeTool: true,
    },
  };
}

const ctx = {
  items: itemMap,
  index,
  featName: (id: string) => (id === 'alert' ? 'Alert' : id),
  device: 'test',
  now: new Date('2026-11-04T10:00:00.000Z'),
};

const errorKeys = (d: BackgroundDraft, taken: string[] = []) =>
  validateDraft(d, new Set(taken), featIds).map((e) => e.key);

describe('validateDraft', () => {
  it('accepts a complete background', () => {
    expect(errorKeys(valid())).toEqual([]);
  });

  it('needs a name that is not empty and not taken (ignoring case and accents)', () => {
    expect(errorKeys({ ...valid(), name: '   ' })).toEqual(['nameEmpty']);
    expect(errorKeys(valid(), [normaliseName('Lighthouse  KEEPER')])).toEqual(['nameTaken']);
    expect(normaliseName('Acólito')).toBe('acolito');
  });

  it('needs a description', () => {
    expect(errorKeys({ ...valid(), description: ' ' })).toEqual(['descriptionEmpty']);
  });

  it('needs exactly 3 distinct abilities', () => {
    expect(errorKeys({ ...valid(), abilityScores: ['STR', 'DEX'] })).toEqual(['abilities']);
    expect(errorKeys({ ...valid(), abilityScores: ['STR', 'STR', 'DEX'] })).toEqual(['abilities']);
    expect(errorKeys({ ...valid(), abilityScores: ['STR', 'DEX', 'CON', 'WIS'] })).toEqual([
      'abilities',
    ]);
  });

  it('needs exactly 2 distinct known skills', () => {
    expect(errorKeys({ ...valid(), skills: ['stealth'] })).toEqual(['skills']);
    expect(errorKeys({ ...valid(), skills: ['stealth', 'stealth'] })).toEqual(['skills']);
    expect(errorKeys({ ...valid(), skills: ['stealth', 'juggling'] })).toEqual(['skills']);
  });

  it('needs an origin feat from the list', () => {
    expect(errorKeys({ ...valid(), featId: null })).toEqual(['feat']);
    expect(errorKeys({ ...valid(), featId: 'fireball' })).toEqual(['feat']);
  });

  it('needs a tool, or one of the kinds', () => {
    expect(errorKeys({ ...valid(), tool: { mode: 'specific', value: '' } })).toEqual(['tool']);
    expect(errorKeys({ ...valid(), tool: { mode: 'kind', value: 'Gaming Set' } })).toEqual([]);
    expect(errorKeys({ ...valid(), tool: { mode: 'kind', value: 'Anvil' } })).toEqual(['tool']);
  });

  it('needs whole gold of 0 or more and quantities from 1 to 99', () => {
    const eq = valid().equipment;
    expect(errorKeys({ ...valid(), equipment: { ...eq, gold: -1 } })).toEqual(['gold']);
    expect(errorKeys({ ...valid(), equipment: { ...eq, gold: 1.5 } })).toEqual(['gold']);
    expect(errorKeys({ ...valid(), equipment: { ...eq, gold: 0 } })).toEqual([]);
    expect(
      errorKeys({ ...valid(), equipment: { ...eq, items: [{ itemId: 'rope', qty: 0 }] } }),
    ).toEqual(['qty']);
  });

  it('lists every problem of an empty draft', () => {
    expect(errorKeys(emptyDraft())).toEqual([
      'nameEmpty',
      'descriptionEmpty',
      'abilities',
      'feat',
      'skills',
      'tool',
    ]);
  });
});

describe('equipment text', () => {
  it('writes the A/B format the wizard parses', () => {
    const text = equipmentText(valid(), itemMap, index);
    expect(text).toBe(
      "Choose A or B: (A) Navigator's Tools, Rope, 5 Torches, Hooded Lantern, 12 GP; or (B) 50 GP",
    );
    const packages = parseStartingEquipment(text, index)!;
    expect(packages.map((p) => p.letter)).toEqual(['A', 'B']);
    expect(packages[0].gold).toBe(12);
    expect(packages[0].lines.map((l) => [l.itemId, l.qty])).toEqual([
      ['navigators-tools', 1],
      ['rope', 1],
      ['torch', 5],
      ['lantern-hooded', 1],
    ]);
    expect(packages[1]).toMatchObject({ gold: 50, lines: [] });
  });

  it('writes "(same as above)" when the background lets you choose a kind', () => {
    const d = { ...valid(), tool: { mode: 'kind' as const, value: 'Gaming Set' } };
    const text = equipmentText(d, itemMap, index);
    expect(text).toContain('Gaming Set (same as above), Rope');
    const line = parseStartingEquipment(text, index)![0].lines[0];
    expect(line.chosenTool).toBe(true);
  });

  it('is empty without items or gold, and leaves the tool out when asked', () => {
    const d = valid();
    d.equipment = { items: [], gold: 0, includeTool: false };
    expect(equipmentText(d, itemMap, index)).toBe('');
    d.equipment = { items: [], gold: 7, includeTool: false };
    expect(parseStartingEquipment(equipmentText(d, itemMap, index), index)![0]).toMatchObject({
      gold: 7,
      lines: [],
    });
  });

  it('round-trips every mundane item the form offers, alone and in quantities', () => {
    const offered = items.filter((i) => isWritable(i, index));
    expect(offered).toHaveLength(items.length);
    for (const item of offered) {
      for (const qty of [1, 2, 10]) {
        const d = valid();
        d.equipment = { items: [{ itemId: item.id, qty }], gold: 0, includeTool: false };
        const line = parseStartingEquipment(equipmentText(d, itemMap, index), index)![0].lines[0];
        expect([item.name, line.itemId, line.qty]).toEqual([item.name, item.id, qty]);
      }
    }
  });

  it('writes the official backgrounds in the same shape', () => {
    // sanity check of the shape we copy: they all parse into A and B
    const parsed = backgrounds.map((b) => parseStartingEquipment(b.equipment, index));
    expect(parsed.every((p) => p && p.length === 2)).toBe(true);
  });
});

describe('buildBackground', () => {
  it('follows the schema of the official backgrounds', () => {
    const bg = buildBackground(valid(), ctx);
    const official = backgrounds[0];
    // same fields as an official background, plus the custom ones
    for (const key of Object.keys(official)) expect(bg).toHaveProperty(key);
    expect(bg).toMatchObject({
      type: 'background',
      name: 'Lighthouse Keeper',
      edition: '2024',
      abilityScores: ['STR', 'CON', 'WIS'],
      feat: 'Alert',
      featId: 'alert',
      skills: ['perception', 'survival'],
      tools: "Navigator's Tools",
      custom: true,
      dmApproved: false,
      createdAt: '2026-11-04T10:00:00.000Z',
    });
    expect(bg.id).toMatch(/^custom-lighthouse-keeper-[a-z0-9]{6}$/);
    expect(typeof bg.equipment).toBe('string');
  });

  it('writes the tool kind as the official ones do', () => {
    const bg = buildBackground({ ...valid(), tool: { mode: 'kind', value: 'Gaming Set' } }, ctx);
    expect(bg.tools).toBe('Choose one kind of Gaming Set');
    expect(draftOf(bg).tool).toEqual({ mode: 'kind', value: 'Gaming Set' });
  });

  it('keeps id, creation date and approval when editing', () => {
    const first = buildBackground(valid(), ctx);
    const approved: CustomBackground = { ...first, dmApproved: true };
    const later = buildBackground(
      { ...draftOf(approved), description: 'New text.' },
      { ...ctx, now: new Date('2026-11-05T10:00:00.000Z') },
      approved,
    );
    expect(later).toMatchObject({
      id: first.id,
      createdAt: first.createdAt,
      updatedAt: '2026-11-05T10:00:00.000Z',
      dmApproved: true,
      description: 'New text.',
    });
  });

  it('survives JSON and gets read back with defaults for missing fields', () => {
    const bg = buildBackground(valid(), ctx);
    expect(normalizeCustomBackground(JSON.parse(JSON.stringify(bg)))).toEqual(bg);
    const min = normalizeCustomBackground({ id: 'custom-x-abc123', name: 'X' })!;
    expect(min).toMatchObject({ custom: true, dmApproved: false, skills: [], abilityScores: [] });
    expect(normalizeCustomBackground({ id: '../evil', name: 'X' })).toBeNull();
    expect(normalizeCustomBackground({ id: 'acolyte', name: 'Acolyte' })).toBeNull();
    expect(normalizeCustomBackground({ id: 'custom-x-abc123', name: ' ' })).toBeNull();
    expect(normalizeCustomBackground(null)).toBeNull();
  });
});

describe('ids', () => {
  it('are prefixed, slugged and random', () => {
    expect(newCustomId('Ñandú del Sur!', () => 0)).toBe('custom-nandu-del-sur-aaaaaa');
    expect(newCustomId('???', () => 0.5)).toMatch(/^custom-background-[a-z0-9]{6}$/);
    expect(newCustomId('A')).not.toBe(newCustomId('A'));
    expect(isCustomId('custom-a-b')).toBe(true);
    expect(isCustomId('acolyte')).toBe(false);
  });
});

describe('in the rules data', () => {
  const rules = (bg?: CustomBackground): RulesData => ({
    classes: new Map(),
    subclasses: new Map(),
    species: new Map(),
    backgrounds: new Map(bg ? [[bg.id, bg]] : []),
    feats: new Map([['alert', { id: 'alert', name: 'Alert' } as Feat]]),
    items: itemMap,
  });
  const character = (id: string): Character => ({
    ...newCharacter('PC', 'test'),
    background: { id, abilityIncreases: { STR: 2, CON: 1 } },
    abilityScores: {
      method: 'manual',
      base: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    },
  });

  it('a character with a custom background gets its increases, skills and the badge', () => {
    const bg = buildBackground(valid(), ctx);
    const sheet = computeSheet(character(bg.id), rules(bg));
    expect(sheet.background).toBe('Lighthouse Keeper');
    expect(sheet.backgroundHomebrew).toBe('pending');
    expect(sheet.abilities.STR.score).toBe(12);
    expect(sheet.abilities.CON.score).toBe(11);
    expect(sheet.skills.filter((s) => s.proficiency === 'full').map((s) => s.id)).toEqual([
      'perception',
      'survival',
    ]);
    expect(sheet.warnings).toEqual([]);
    const approved = computeSheet(character(bg.id), rules({ ...bg, dmApproved: true }));
    expect(approved.backgroundHomebrew).toBe('approved');
  });

  it('a custom background missing on this device gives a clear warning, not an error', () => {
    const sheet = computeSheet(character('custom-lost-abc123'), rules());
    expect(sheet.background).toBeNull();
    expect(sheet.backgroundHomebrew).toBeNull();
    expect(sheet.warnings).toEqual([
      {
        key: 'sheet.warn.customBackgroundMissing',
        params: { what: 'background', id: 'custom-lost-abc123' },
      },
    ]);
    const official = computeSheet(character('nope'), rules());
    expect(official.warnings[0].key).toBe('sheet.warn.notFound');
  });
});
