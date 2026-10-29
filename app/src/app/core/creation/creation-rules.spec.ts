import { newCharacter } from '../models/character';
import { Background, DndClass, Feat, Spell } from '../models/compendium';
import {
  backgroundIncreasesValid,
  expertiseCount,
  featSlots,
  featsForSlot,
  maxSpellLevel,
  missing,
  pointBuyCost,
  spellsFor,
} from './creation-rules';

const rows = (features: Record<number, string[]>, slots?: (lvl: number) => number[]) =>
  Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    proficiencyBonus: null,
    features: features[i + 1] ?? [],
    values: {},
  }));

const fighter = {
  id: 'fighter',
  name: 'Fighter',
  subclassLevel: 3,
  subclassTitle: 'Fighter Subclass',
  proficiencies: {
    armor: [],
    weapons: [],
    tools: [],
    skills: { choose: 2, from: ['athletics', 'acrobatics', 'perception'] },
  },
  progression: {
    columns: [],
    rows: rows({
      1: ['Fighting Style', 'Second Wind'],
      4: ['Ability Score Improvement'],
      6: ['Ability Score Improvement'],
      19: ['Epic Boon'],
    }),
  },
  spellcasting: null,
} as unknown as DndClass;

const feat = (id: string, category: string, level?: number) =>
  ({ id, name: id, category, prerequisites: level ? { raw: '', level } : null }) as unknown as Feat;

describe('creation rules', () => {
  it("prices point buy like the Player's Handbook", () => {
    expect(pointBuyCost({ STR: 15, DEX: 15, CON: 15, INT: 8, WIS: 8, CHA: 8 })).toBe(27);
    expect(pointBuyCost({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })).toBe(0);
    expect(pointBuyCost({ STR: 16, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 })).toBe(Infinity);
  });

  it('accepts +2/+1 or +1/+1/+1 to the background abilities only', () => {
    const bg = { abilityScores: ['STR', 'DEX', 'CON'] } as unknown as Background;
    expect(backgroundIncreasesValid(bg, { STR: 2, CON: 1 })).toBe(true);
    expect(backgroundIncreasesValid(bg, { STR: 1, DEX: 1, CON: 1 })).toBe(true);
    expect(backgroundIncreasesValid(bg, { STR: 2, DEX: 2 })).toBe(false);
    expect(backgroundIncreasesValid(bg, { STR: 2, WIS: 1 })).toBe(false);
    expect(backgroundIncreasesValid(bg, {})).toBe(false);
  });

  it('finds the feat choices a class grants up to a level', () => {
    expect(featSlots(fighter, 6).map((s) => [s.slot, s.kind])).toEqual([
      ['fighter:1', 'fighting-style'],
      ['fighter:4', 'asi'],
      ['fighter:6', 'asi'],
    ]);
    expect(featSlots(fighter, 20).map((s) => s.kind)).toContain('epic-boon');
  });

  it('offers Ability Score Improvement first, then general feats the level allows', () => {
    const feats = [
      feat('tough', 'general', 4),
      feat('ability-score-improvement', 'general', 4),
      feat('alert', 'origin'),
      feat('archery', 'fighting-style'),
      feat('late', 'general', 8),
    ];
    expect(featsForSlot('asi', feats, 4).map((f) => f.id)).toEqual([
      'ability-score-improvement',
      'tough',
    ]);
    expect(featsForSlot('fighting-style', feats, 1).map((f) => f.id)).toEqual(['archery']);
  });

  it('counts Expertise picks', () => {
    const rogue = {
      progression: { rows: rows({ 1: ['Expertise', 'Sneak Attack'], 6: ['Expertise'] }) },
    } as unknown as DndClass;
    expect(expertiseCount(rogue, 5)).toBe(2);
    expect(expertiseCount(rogue, 6)).toBe(4);
  });

  it('lists the class spells up to the highest slot level', () => {
    const wizard = {
      id: 'wizard',
      spellcasting: {
        slotsByLevel: Array.from({ length: 20 }, (_, i) =>
          i < 2 ? [2, 0, 0, 0, 0, 0, 0, 0, 0] : [4, 2, 0, 0, 0, 0, 0, 0, 0],
        ),
      },
    } as unknown as DndClass;
    const spell = (id: string, level: number, classes = ['wizard']) =>
      ({ id, name: id, level, classes }) as unknown as Spell;
    const all = [
      spell('light', 0),
      spell('magic-missile', 1),
      spell('misty-step', 2),
      spell('fireball', 3),
      spell('cure-wounds', 1, ['cleric']),
    ];
    expect(maxSpellLevel(wizard, 3)).toBe(2);
    const { cantrips, leveled } = spellsFor(wizard, 3, all);
    expect(cantrips.map((s) => s.id)).toEqual(['light']);
    expect(leveled.map((s) => s.id)).toEqual(['magic-missile', 'misty-step']);
  });

  it('says what is still missing, step by step', () => {
    const ch = {
      ...newCharacter('', 'pc'),
      classes: [{ id: 'fighter', level: 4, subclassId: null, hp: [] }],
    };
    const m = missing(ch, { cls: fighter, background: undefined, speciesHasVariants: false });
    expect(m.class).toEqual([
      { key: 'create.missing.subclass', params: { title: 'Fighter Subclass' } },
    ]);
    expect(m.background.map((x) => x.key)).toEqual(['create.missing.background']);
    expect(m.choices).toEqual([
      { key: 'create.missing.skills', params: { count: 2 } },
      { key: 'create.missing.feats', params: { count: 2 } },
    ]);
    expect(m.details.map((x) => x.key)).toEqual(['create.missing.name']);
  });
});
