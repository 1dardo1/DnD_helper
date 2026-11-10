import kassRaw from '../../../../../characters/kassasdin-1793879600138.json';
import kriugRaw from '../../../../../characters/kriug-1793958485566.json';
import orenRaw from '../../../../../characters/oren-bianic-1793811890281.json';
import esSubclasses from '../../../../../data/es/subclasses.json';
import rulesRaw from '../../../../../data/rules.json';
import { weaponEntriesOf } from '../characters/weapons';
import { combatEn } from '../i18n/combat.en';
import { en } from '../i18n/en';
import { Character, normalizeCharacter } from '../models/character';
import { Rule } from '../models/compendium';
import { playResources } from '../play/play-state';
import { attacksFor } from '../rules/attacks';
import { computeSheet } from '../rules/engine';
import { REAL, REAL_CLASSES, REAL_SPELLS, REAL_SUBCLASSES, hero } from '../rules/real-data.testing';
import { blocksOf, translatedSentence, usesOf } from './action-text';
import {
  CombatRow,
  SECTIONS,
  cantripDice,
  combatRows,
  definitions,
  favoriteRows,
  featureDcs,
  orderRows,
  resourceFor,
  sectionsOf,
} from './combat-actions';
import { normalizeFavorites, toggleFavorite } from './favorites';
import { leftOf, refund, slotFor, spend } from './spend';

const SPELLS = new Map(REAL_SPELLS.map((s) => [s.id, s]));
const RULES = (rulesRaw as unknown as Rule[]).filter((r) => r.category === 'actions');

function rowsOf(ch: Character) {
  const sheet = computeSheet(ch, REAL);
  const rows = combatRows({
    sheet,
    character: ch,
    data: REAL,
    attacks: attacksFor(sheet, weaponEntriesOf(ch.inventory, REAL.items)),
    spells: SPELLS,
    rules: RULES,
    resources: playResources(sheet),
  });
  return { sheet, rows };
}
const feature = (cls: string, name: string, sub = false) =>
  (
    (sub ? REAL_SUBCLASSES : REAL_CLASSES) as {
      id: string;
      features: { name: string; description: string }[];
    }[]
  )
    .find((c) => c.id === cls)!
    .features.find((f) => f.name === name)!.description;
const timings = (text: string) => usesOf(text).map((u) => u.timing);
const find = (rows: CombatRow[], id: string) => rows.find((r) => r.id === id);

describe('usesOf: how a text says it is used (real texts)', () => {
  it('Bonus Action, Reaction and Magic action', () => {
    expect(timings(feature('rogue', 'Cunning Action'))).toEqual(['bonus']);
    expect(timings(feature('rogue', 'Uncanny Dodge'))).toEqual(['reaction']);
    expect(timings(feature('fighter', 'Second Wind'))).toContain('bonus');
    expect(timings(feature('rogue/soulknife', 'Psychic Veil', true))).toEqual(['action']);
  });

  it('a rider of an attack, and no action at all', () => {
    expect(timings(feature('rogue', 'Sneak Attack'))).toEqual(['attack']);
    // "If you fail an ability check ..., you can roll one Psionic Energy Die"
    const knack = blocksOf(feature('rogue/soulknife', 'Psionic Power', true)).find(
      (b) => b.label === 'Psi-Bolstered Knack',
    )!;
    expect(timings(knack.text)).toEqual(['free']);
  });

  it('a restriction is not a use', () => {
    expect(timings("While raging, you can't take Reactions.")).toEqual([]);
  });

  it('labelled parts of a feature are their own blocks; a bold title is not', () => {
    const blocks = blocksOf(feature('rogue/soulknife', 'Psionic Power', true));
    expect(blocks.map((b) => b.label)).toEqual([null, 'Psi-Bolstered Knack', 'Psychic Whispers']);
    const swarm = blocksOf(feature('ranger/swarmkeeper', 'Gathered Swarm', true));
    expect(swarm.map((b) => b.label)).not.toContain('Swarm Appearance');
  });
});

describe('combatRows of real characters', () => {
  it('Kriug (Soulknife): blades, Cunning Action, Psionic Power with its counter, generic actions', () => {
    const { rows } = rowsOf(normalizeCharacter(kriugRaw)!);
    expect(find(rows, 'attack:sheet.psychicBlade')).toMatchObject({
      kind: 'action',
      section: 'natural',
    });
    expect(find(rows, 'attack:sheet.psychicBladeBonus')).toMatchObject({ kind: 'bonus' });
    expect(rows.find((r) => r.name === 'Cunning Action')).toMatchObject({
      kind: 'bonus',
      section: 'featuresFree',
    });
    const whispers = rows.find((r) => r.part === 'Psychic Whispers')!;
    expect(whispers).toMatchObject({ kind: 'action', section: 'featuresResource' });
    expect(whispers.cost).toMatchObject({ k: 'resource', name: 'Psionic Energy Dice', max: 4 });
    expect(rows.find((r) => r.name === 'Sneak Attack')).toMatchObject({
      section: 'featuresAttack',
    });
    // the generic actions of the SRD, every one
    for (const a of [
      'attack',
      'dash',
      'disengage',
      'dodge',
      'help',
      'hide',
      'influence',
      'magic',
      'ready',
      'search',
      'study',
      'utilize',
    ])
      expect(find(rows, `generic:actions/${a}@action`)).toBeTruthy();
    expect(find(rows, 'generic:actions/opportunity-attacks@reaction')?.kind).toBe('reaction');
    expect(find(rows, 'generic:actions/ready@reaction')?.kind).toBe('reaction');
    expect(find(rows, 'generic:actions/light-property@bonus')?.kind).toBe('bonus');
    // Grapple and Shove: DC 8 + STR + PB (the Unarmed Strike's own text)
    const grapple = find(rows, 'generic:actions/unarmed-strike/grapple@attack')!;
    expect(grapple.line[0]).toEqual({ k: 'dc', n: 8 + 2 + 2, ability: null });
    expect(find(rows, 'generic:actions/unarmed-strike/shove@attack')).toBeTruthy();
  });

  it('Oren (Artificer/Warlock): spells by casting time, slots, cannon among the creatures', () => {
    const { rows } = rowsOf(normalizeCharacter(orenRaw)!);
    expect(find(rows, 'spell:shield')).toMatchObject({ kind: 'reaction', section: 'spellsSlot' });
    expect(find(rows, 'spell:mind-sliver')).toMatchObject({
      kind: 'action',
      section: 'spellsFree',
    });
    expect(find(rows, 'spell:mind-sliver')!.line).toContainEqual({
      k: 'dc',
      n: 11,
      ability: 'INT',
    });
    // a Warlock spell is paid with Pact Magic first
    expect(find(rows, 'spell:unseen-servant')?.cost).toMatchObject({ k: 'slot', pact: true });
    // minutes or hours: out of combat (Find Familiar, 1 hour)
    expect(find(rows, 'spell:find-familiar')?.section).toBe('outOfCombat');
    const cannon = rows.filter((r) => r.name === 'Eldritch Cannon');
    expect(cannon.map((r) => r.kind).sort()).toEqual(['action', 'bonus']);
    expect(cannon.every((r) => r.section === 'creatures' && r.tab === 'invocaciones')).toBe(true);
  });

  it('Kassasdin (Ranger): equipped weapons first, Hunter’s Mark as a bonus action, Favored Enemy from the engine', () => {
    const { rows } = rowsOf(normalizeCharacter(kassRaw)!);
    const weapons = rows.filter((r) => r.section === 'weapons');
    expect(weapons.length).toBeGreaterThan(2);
    expect(find(rows, 'spell:hunters-mark')).toMatchObject({
      kind: 'bonus',
      section: 'spellsSlot',
    });
    // FeatureNote.action of the feature numbers wins over the text
    const fe = rows.find((r) => r.name === 'Favored Enemy')!;
    expect(fe.section).toBe('featuresAttack');
    expect(fe.line[0]).toMatchObject({ k: 'ui', key: 'combat.note.huntersMark' });
  });

  it('every column keeps the order of the sections; cantrips before leveled spells', () => {
    const { rows } = rowsOf(normalizeCharacter(orenRaw)!);
    for (const kind of ['action', 'bonus', 'reaction'] as const) {
      const secs = sectionsOf(rows, kind).map((s) => SECTIONS.indexOf(s.section));
      expect(secs).toEqual([...secs].sort((a, b) => a - b));
    }
    const magic = rows.filter((r) => r.id.startsWith('spell:') && r.kind === 'action');
    const free = magic.findIndex((r) => r.section === 'spellsFree');
    const slot = magic.findIndex((r) => r.section === 'spellsSlot');
    expect(free).toBeLessThan(slot);
  });

  it('ids are unique and stable', () => {
    const a = rowsOf(normalizeCharacter(kriugRaw)!).rows.map((r) => r.id);
    const b = rowsOf(normalizeCharacter(kriugRaw)!).rows.map((r) => r.id);
    expect(new Set(a).size).toBe(a.length);
    expect(a).toEqual(b);
  });

  it('every name, section and line text has its UI text', () => {
    const keys = new Set([...Object.keys(en), ...Object.keys(combatEn)]);
    for (const raw of [kriugRaw, orenRaw, kassRaw]) {
      for (const r of rowsOf(normalizeCharacter(raw)!).rows) {
        if (r.nameKey) expect(keys.has(r.nameKey), r.nameKey).toBe(true);
        expect(keys.has(`combat.sec.${r.section}`)).toBe(true);
        for (const p of r.line) if (p.k === 'ui') expect(keys.has(p.key), p.key).toBe(true);
      }
    }
  });

  it('the definition of each kind of action comes from the SRD entries', () => {
    const d = definitions(RULES);
    expect(d.action?.name).toBe('Action');
    expect(d.bonus?.name).toBe('Bonus Action');
    expect(d.reaction?.name).toBe('Reaction');
  });
});

describe('translatedSentence', () => {
  it('finds the Spanish sentence of a use even when the translation splits differently', () => {
    const en = feature('artificer/artillerist-ua', 'Eldritch Cannon', true);
    const es = (esSubclasses as { id: string; features: { name: string; description: string }[] }[])
      .find((x) => x.id === 'artificer/artillerist-ua')!
      .features.find(
        (f) => f.description !== en && f.name.length > 0 && /ca[ñn][oó]n/i.test(f.name),
      )!;
    const use = usesOf(en).find((u) => u.timing === 'bonus')!;
    const p = { text: use.sentence, of: en, block: 0, index: use.index };
    const got = translatedSentence(p, es.description, 'bonus');
    expect(got).toMatch(/acci[oó]n adicional/i);
    expect(translatedSentence(p, en, 'bonus')).toBe(use.sentence);
  });
});

describe('numbers', () => {
  it('cantrip damage follows the character level (Cantrip Upgrade text)', () => {
    const fb = SPELLS.get('fire-bolt')!;
    expect(cantripDice('1d10', fb.higherLevels, 4)).toBe('1d10');
    expect(cantripDice('1d10', fb.higherLevels, 5)).toBe('2d10');
    expect(cantripDice('1d10', fb.higherLevels, 17)).toBe('4d10');
  });

  it('save DCs of species traits (the Howl of the Lupin: 8 + CON + PB)', () => {
    const ch = hero('fighter', 1, null, { speciesId: 'lupin', scores: { CON: 14 } });
    const sheet = computeSheet(ch, REAL);
    const dc = featureDcs(sheet).find((d) => d.source === 'Howl');
    expect(dc?.n).toBe(8 + sheet.abilities.CON.modifier + sheet.proficiencyBonus);
  });

  it('a feature spends the counter with its name or the one its text spends', () => {
    const sheet = computeSheet(hero('barbarian', 3), REAL);
    const res = playResources(sheet);
    const rage = sheet.features.find((f) => f.name === 'Rage')!;
    expect(resourceFor(rage, null, rage.description, res)?.name).toBe('Rages');
  });
});

describe('spending', () => {
  const ch = normalizeCharacter(orenRaw)!;
  const sheet = computeSheet(ch, REAL);
  const clean = {
    ...ch.state,
    spentSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactSlotsSpent: 0,
    resources: {},
  };

  it('a Warlock spell uses Pact Magic first, others the lowest shared slot', () => {
    expect(slotFor(sheet, clean, 1, true)).toEqual({ pact: true, level: 1 });
    expect(slotFor(sheet, clean, 1, false)).toEqual({ pact: false, level: 1 });
    const once = spend(sheet, clean, { k: 'slot', level: 1, pact: true });
    expect(once.pactSlotsSpent).toBe(1);
    expect(leftOf(sheet, once, { k: 'slot', level: 1, pact: true })).toBe(
      leftOf(sheet, clean, { k: 'slot', level: 1, pact: true }) - 1,
    );
  });

  it('uses of a counter: spend down to 0, give one back', () => {
    const cost = { k: 'resource' as const, key: 'x:y', max: 2, name: 'Y', labelKey: null };
    const a = spend(sheet, clean, cost);
    const b = spend(sheet, a, cost);
    expect(spend(sheet, b, cost)).toBe(b);
    expect(leftOf(sheet, b, cost)).toBe(0);
    expect(leftOf(sheet, refund(b, cost), cost)).toBe(1);
  });
});

describe('favorites', () => {
  it('toggle adds at the end and removes; normalize keeps unique strings or nothing', () => {
    expect(toggleFavorite(undefined, 'a')).toEqual(['a']);
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
    expect(normalizeFavorites(['a', 'a', '', 3, 'b'])).toEqual(['a', 'b']);
    expect(normalizeFavorites([])).toBeUndefined();
    expect(normalizeFavorites('x')).toBeUndefined();
  });

  it('kept on the character file (normalizeCharacter) and grouped by kind in column order', () => {
    const raw = {
      ...kriugRaw,
      state: {
        ...kriugRaw.state,
        combatFavorites: [
          'spell:x',
          'generic:actions/dodge@action',
          'attack:sheet.psychicBladeBonus',
          'attack:sheet.psychicBlade',
        ],
      },
    };
    const ch = normalizeCharacter(raw)!;
    expect(ch.state.combatFavorites).toHaveLength(4);
    const { rows } = rowsOf(ch);
    const groups = favoriteRows(rows, ch.state.combatFavorites);
    expect(groups.map((g) => g.kind)).toEqual(['action', 'bonus']);
    // the blade (an attack) before Dodge (a generic action): the column's order, not the list's
    expect(groups[0].rows.map((r) => r.id)).toEqual([
      'attack:sheet.psychicBlade',
      'generic:actions/dodge@action',
    ]);
    expect(normalizeCharacter({ ...kriugRaw })!.state.combatFavorites).toBeUndefined();
  });

  it('orderRows is stable inside a section', () => {
    const r = (id: string, rank: number): CombatRow => ({
      id,
      kind: 'action',
      section: 'generic',
      timing: 'action',
      name: id,
      line: [],
      cost: null,
      more: null,
      rank,
    });
    expect(orderRows([r('b', 1), r('a', 0), r('c', 1)]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
