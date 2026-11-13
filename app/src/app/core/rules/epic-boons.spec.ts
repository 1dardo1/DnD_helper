import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import spellsJson from '../../../../../data/spells.json';
import { Character, FeatChoice, newCharacter } from '../models/character';
import { Background, DndClass, Feat, Item, Species } from '../models/compendium';
import {
  FEAT_PICKS,
  SCHOOLS,
  SpellLike,
  abilityRule,
  pickable,
  siberysSpellIds,
  tableSpellNames,
} from './feat-effects';
import { RulesData, casterSpellLists, computeSheet } from './engine';

const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

const DATA: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: new Map(),
  species: new Map<string, Species>(),
  backgrounds: new Map<string, Background>(),
  feats: map<Feat>(feats),
  items: map<Item>(items),
};

const all = feats as unknown as Feat[];
const feat = (id: string) => all.find((f) => f.id === id)!;
const spells = spellsJson as unknown as (SpellLike & { name: string; edition: string })[];

const SCORES = { STR: 10, DEX: 14, CON: 14, INT: 16, WIS: 12, CHA: 8 };

/** A level `level` character of `cls` whose feat slots and choices are the ones given. */
function build(
  cls: string,
  level: number,
  slots: { slot: string; featId: string }[],
  choices: Partial<Character['choices']> = {},
): Character {
  const c = newCharacter('Test', 'test');
  return {
    ...c,
    classes: [{ id: cls, level, subclassId: null, hp: [] }],
    abilityScores: { method: 'standard', base: SCORES },
    choices: { ...c.choices, featSlots: slots, ...choices },
  };
}

const withChoices = (choices: Record<string, FeatChoice>) => ({ featChoices: choices });

describe('Boon of Magic School Mastery: what the picks may be (real text)', () => {
  const rote = FEAT_PICKS['boon-of-magic-school-mastery'].spell!;
  const signature = FEAT_PICKS['boon-of-magic-school-mastery'].signature!;

  it('offers the eight schools of the text, and nothing else', () => {
    expect(FEAT_PICKS['boon-of-magic-school-mastery'].school).toEqual(SCHOOLS);
    expect(SCHOOLS).toHaveLength(8);
  });

  it('Rote Casting: a level 1 spell of the chosen school on the class list', () => {
    const ids = pickable(spells, rote, null, {
      school: 'evocation',
      casterLists: ['wizard'],
    }).map((s) => s.id);
    const expected = spells
      .filter((s) => s.level === 1 && s.school === 'evocation' && s.classes.includes('wizard'))
      .map((s) => s.id);
    expect(ids.length).toBeGreaterThan(3);
    expect([...ids].sort()).toEqual([...expected].sort());
    expect(ids).toEqual(expect.arrayContaining(['magic-missile', 'burning-hands']));
    expect(ids).not.toContain('fireball'); // level 3
    expect(ids).not.toContain('shield'); // Abjuration
  });

  it('Rote Casting offers nothing without a school or without a spellcasting class', () => {
    expect(pickable(spells, rote, null, { casterLists: ['wizard'] })).toEqual([]);
    expect(pickable(spells, rote, null, { school: 'evocation', casterLists: [] })).toEqual([]);
  });

  it('Signature Arcanum: level 7 or lower, of the chosen school, from any list', () => {
    const ids = pickable(spells, signature, null, { school: 'evocation' }).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['fireball', 'magic-missile']));
    expect(ids).not.toContain('sunburst'); // level 8
    expect(ids).not.toContain('shield'); // Abjuration
    const sp = spells.filter((s) => ids.includes(s.id));
    expect(sp.every((s) => s.level <= 7 && s.school === 'evocation')).toBe(true);
  });
});

describe('Boon of Siberys: the table of the text (real text)', () => {
  const text = feat('boon-of-siberys').description;

  it('the Siberys Dragonmark Spells table has exactly twelve spells, read from the text', () => {
    const names = tableSpellNames(text, '**Siberys Dragonmark Spells**');
    expect(names).toHaveLength(12);
    expect(names).toEqual(
      expect.arrayContaining(['Animal Shapes', "Heroes' Feast", 'True Seeing', 'Teleport']),
    );
    expect(names).not.toContain('Spell');
    expect(names).not.toContain('Suggested Dragonmark');
  });

  it('their ids exist in the compendium', () => {
    const ids = siberysSpellIds(feat('boon-of-siberys'));
    expect(ids).toHaveLength(12);
    expect(ids).toContain('heroes-feast');
    for (const id of ids) expect(spells.some((s) => s.id === id)).toBe(true);
  });

  it('Aberrant Magic: a level 8 or lower Sorcerer spell, or one of the table', () => {
    const table = siberysSpellIds(feat('boon-of-siberys'));
    const ids = pickable(spells, FEAT_PICKS['boon-of-siberys'].spell!, null, {
      table,
    }).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['animal-shapes', 'heroes-feast']));
    // a Sorcerer spell of level 8 that is not in the table is a candidate too
    const sorc8 = spells.find(
      (s) =>
        s.edition === '2024' &&
        s.level === 8 &&
        s.classes.includes('sorcerer') &&
        !table.includes(s.id),
    )!;
    expect(ids).toContain(sorc8.id);
    // every candidate is on the table or is a Sorcerer spell of level 8 or lower
    for (const id of ids) {
      const s = spells.find((x) => x.id === id)!;
      expect(table.includes(id) || (s.classes.includes('sorcerer') && s.level <= 8)).toBe(true);
    }
  });

  it('the spellcasting ability is chosen (the text says so); Magic School Mastery takes the class one', () => {
    expect(abilityRule(feat('boon-of-siberys'))).toEqual({ mode: 'choice' });
    expect(abilityRule(feat('boon-of-magic-school-mastery'))).toEqual({ mode: 'class' });
  });
});

describe('Boon of Magic School Mastery and Boon of Siberys on the sheet', () => {
  it('a Wizard at 19 with Mastery: Rote Casting is at will, Signature Arcanum once per Long Rest', () => {
    const sheet = computeSheet(
      build(
        'wizard',
        19,
        [{ slot: 'wizard:19', featId: 'boon-of-magic-school-mastery' }],
        withChoices({
          'wizard:19': { school: 'evocation', spell: 'magic-missile', signature: 'fireball' },
        }),
      ),
      DATA,
    );
    expect(sheet.featMissing).toEqual([]);
    expect(sheet.featSpells).toEqual([
      expect.objectContaining({
        id: 'magic-missile',
        atWill: true,
        freeKey: null,
        ability: 'INT',
        abilityChosen: true,
        slots: true,
      }),
      expect.objectContaining({
        id: 'fireball',
        freeKey: 'feat:wizard:19:fireball',
        slots: true,
        ability: 'INT',
      }),
    ]);
    expect(sheet.featUses).toEqual([
      expect.objectContaining({ key: 'feat:wizard:19:fireball', max: 1, rest: 'long' }),
    ]);
    expect(sheet.features.map((f) => f.name)).toContain('Boon of Magic School Mastery (Evocation)');
  });

  it('lists what Mastery still needs: the school, Rote Casting and the Signature', () => {
    const sheet = computeSheet(
      build('wizard', 19, [{ slot: 'wizard:19', featId: 'boon-of-magic-school-mastery' }]),
      DATA,
    );
    expect(sheet.featMissing.map((m) => m.what).sort()).toEqual(['school', 'signature', 'spell']);
  });

  it('a class without spells cannot cast them: it says so instead of breaking the sheet', () => {
    const sheet = computeSheet(
      build(
        'fighter',
        19,
        [{ slot: 'fighter:19', featId: 'boon-of-magic-school-mastery' }],
        withChoices({
          'fighter:19': { school: 'evocation', spell: 'magic-missile', signature: 'fireball' },
        }),
      ),
      DATA,
    );
    expect(sheet.featMissing.map((m) => m.what)).toEqual(['caster']);
    expect(sheet.featSpells).toEqual([]);
  });

  it('can be taken twice, each copy with its own school', () => {
    const sheet = computeSheet(
      build(
        'wizard',
        20,
        [
          { slot: 'wizard:19', featId: 'boon-of-magic-school-mastery' },
          { slot: 'wizard:20', featId: 'boon-of-magic-school-mastery' },
        ],
        withChoices({
          'wizard:19': { school: 'evocation', spell: 'magic-missile', signature: 'fireball' },
          'wizard:20': { school: 'abjuration', spell: 'shield', signature: 'counterspell' },
        }),
      ),
      DATA,
    );
    const names = sheet.features.map((f) => f.name);
    expect(names).toContain('Boon of Magic School Mastery (Evocation)');
    expect(names).toContain('Boon of Magic School Mastery (Abjuration)');
    expect(sheet.featSpells.map((s) => s.id)).toEqual(
      expect.arrayContaining(['magic-missile', 'fireball', 'shield', 'counterspell']),
    );
    expect(sheet.featMissing).toEqual([]);
  });

  it('Boon of Siberys: its spell is cast with a slot or once per Short or Long Rest', () => {
    const sheet = computeSheet(
      build(
        'wizard',
        19,
        [{ slot: 'wizard:19', featId: 'boon-of-siberys' }],
        withChoices({ 'wizard:19': { ability: 'WIS', spell: 'animal-shapes' } }),
      ),
      DATA,
    );
    expect(sheet.featSpells).toEqual([
      expect.objectContaining({
        id: 'animal-shapes',
        ability: 'WIS',
        abilityChosen: true,
        freeKey: 'feat:wizard:19:animal-shapes',
        slots: true,
      }),
    ]);
    expect(sheet.featUses.find((u) => u.key === 'feat:wizard:19:animal-shapes')).toEqual(
      expect.objectContaining({ max: 1, rest: 'short-or-long' }),
    );
    expect(sheet.featMissing).toEqual([]);
  });

  it('a casting class lists its spell list (a subclass caster, its own list)', () => {
    expect(casterSpellLists(build('wizard', 19, []), DATA)).toEqual(['wizard']);
    expect(casterSpellLists(build('fighter', 19, []), DATA)).toEqual([]);
  });
});
