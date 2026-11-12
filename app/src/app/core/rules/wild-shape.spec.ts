import { combatRows } from '../combat/combat-actions';
import { normalizeCharacter } from '../models/character';
import { assumeForm, counterOf, switchState, usesLeftFor } from '../play/active-play';
import { leaveForm, longRest, playResources, shortRest } from '../play/play-state';
import { weaponEntriesOf } from '../characters/weapons';
import { ACTIVE_STATES, NOTE_WHILE, RAGE_RESISTANCES, stateOn } from './active-states';
import { attacksFor } from './attacks';
import { computeSheet } from './engine';
import {
  REAL,
  REAL_CLASSES,
  REAL_MONSTERS,
  REAL_SPELLS,
  REAL_SUBCLASSES,
  hero,
  sheetOf,
} from './real-data.testing';
import {
  WILD_SHAPE_ANCHORS,
  eligibleForms,
  formAttack,
  formView,
  knownForms,
  toggleKnownForm,
  wildShapeRules,
} from './wild-shape';

const MONSTERS = new Map(REAL_MONSTERS.map((m) => [m.id, m]));
const text = (cls: string, name: string) =>
  [...REAL_CLASSES, ...REAL_SUBCLASSES]
    .find((c) => c.id === cls)!
    .features.find((f) => f.name === name)!.description;
const rulesOf = (level: number, sub: string | null = null) =>
  wildShapeRules(sheetOf('druid', level, sub))!;
const MOON = 'druid/circle-of-the-moon';

describe('Wild Shape: the texts the numbers come from', () => {
  it('every anchor is in the 2024 text of its feature', () => {
    const a = WILD_SHAPE_ANCHORS;
    const ws = text('druid', 'Wild Shape');
    for (const r of [a.hours, a.thp, a.retain, a.higher, a.noSpells]) expect(ws).toMatch(r);
    const circle = text(MOON, 'Circle Forms');
    for (const r of [a.circleCr, a.circleAc, a.circleThp]) expect(circle).toMatch(r);
    expect(text(MOON, 'Improved Circle Forms')).toMatch(a.lunarRadiance);
    expect(text(MOON, 'Improved Circle Forms')).toMatch(a.toughness);
    expect(text(MOON, 'Lunar Form')).toMatch(a.lunarForm);
    expect(text(MOON, 'Circle of the Moon Spells')).toMatch(a.moonSpells);
    expect(text('druid', 'Beast Spells')).toMatch(a.beastSpells);
    expect(text('druid', 'Elemental Fury')).toMatch(a.primalStrike);
  });

  it('2024: you keep your own Hit Points (the form has none of its own)', () => {
    expect(text('druid', 'Wild Shape')).toContain(
      'you retain your creature type; Hit Points; Hit Point Dice',
    );
  });
});

describe('Wild Shape: the Beast Shapes table by Druid level', () => {
  it('level 2: 4 forms, CR 1/4, no Fly Speed, 1 hour, THP = level', () => {
    expect(rulesOf(2)).toMatchObject({
      known: 4,
      maxCr: 0.25,
      fly: false,
      hours: 1,
      tempHp: 2,
      circleAc: null,
      spells: 'none',
    });
  });

  it('level 4 and 5: 6 forms, CR 1/2; level 5 lasts 2 hours', () => {
    expect(rulesOf(4)).toMatchObject({ known: 6, maxCr: 0.5, fly: false, hours: 2 });
    expect(rulesOf(5)).toMatchObject({ known: 6, maxCr: 0.5, fly: false, hours: 2, tempHp: 5 });
  });

  it('level 8: 8 forms, CR 1, Fly Speed allowed', () => {
    expect(rulesOf(8)).toMatchObject({ known: 8, maxCr: 1, fly: true, hours: 4 });
  });

  it('no Wild Shape before Druid level 2, nor for other classes', () => {
    expect(wildShapeRules(sheetOf('druid', 1))).toBeNull();
    expect(wildShapeRules(sheetOf('fighter', 5))).toBeNull();
  });

  it('Circle of the Moon: CR = level / 3, AC 13 + WIS, THP 3 × level, its spells in a form', () => {
    // WIS 14 (+2) in the test scores
    const r3 = rulesOf(3, MOON);
    expect(r3).toMatchObject({ known: 4, maxCr: 1, fly: false, tempHp: 9, circleAc: 15 });
    expect(r3.spells).toBe('circle');
    expect(r3.circleSpells).toEqual(
      expect.arrayContaining(['cure-wounds', 'moonbeam', 'starry-wisp']),
    );
    expect(rulesOf(6, MOON)).toMatchObject({ maxCr: 2, lunarRadiance: true, toughness: true });
    expect(rulesOf(14, MOON)).toMatchObject({ maxCr: 4, lunarForm: true });
    expect(rulesOf(18)).toMatchObject({ spells: 'all' });
  });
});

describe('Wild Shape: forms the Druid can learn (data/monsters.json)', () => {
  it('level 2: the four recommended forms are eligible; flyers and CR 1 are not', () => {
    const ids = eligibleForms(REAL_MONSTERS, rulesOf(2)).map((m) => m.id);
    // "The Rat, Riding Horse, Spider, and Wolf are recommended."
    expect(ids).toEqual(expect.arrayContaining(['rat', 'riding-horse', 'spider', 'wolf']));
    expect(ids).not.toContain('owl'); // Fly Speed
    expect(ids).not.toContain('brown-bear'); // CR 1
    expect(ids).not.toContain('goblin-warrior'); // not a Beast
    for (const id of ids) expect(MONSTERS.get(id)!.creatureType).toBe('beast');
  });

  it('Moon 3 reaches CR 1 (Brown Bear) but still no Fly Speed; level 8 can fly', () => {
    const moon = eligibleForms(REAL_MONSTERS, rulesOf(3, MOON)).map((m) => m.id);
    expect(moon).toContain('brown-bear');
    expect(moon).not.toContain('owl');
    expect(eligibleForms(REAL_MONSTERS, rulesOf(8)).map((m) => m.id)).toContain('owl');
  });

  it('known forms: at most the number of the table; a form no longer allowed is flagged', () => {
    let ids: string[] = [];
    for (const id of ['rat', 'wolf', 'spider', 'riding-horse', 'cat'])
      ids = toggleKnownForm(ids, id, 4);
    expect(ids).toEqual(['rat', 'wolf', 'spider', 'riding-horse']);
    expect(toggleKnownForm(ids, 'wolf', 4)).toEqual(['rat', 'spider', 'riding-horse']);
    const known = knownForms(['wolf', 'brown-bear', 'nope'], MONSTERS, rulesOf(2));
    expect(known.map((k) => [k.monster.id, k.allowed])).toEqual([
      ['wolf', true],
      ['brown-bear', false],
    ]);
  });
});

describe('Wild Shape: the sheet in a form', () => {
  it('reads the attacks of a stat block, with flat damage and extra damage', () => {
    const bite = formAttack(MONSTERS.get('wolf')!.actions[0])!;
    expect(bite).toMatchObject({
      name: 'Bite',
      kind: 'melee',
      bonus: 4,
      reach: 5,
      damage: '1d6+2',
      type: 'piercing',
    });
    const sting = formAttack(MONSTERS.get('spider')!.actions[0])!;
    expect(sting).toMatchObject({ bonus: 4, damage: '1', type: 'piercing' });
    expect(sting.extra).toEqual([{ damage: '1d4', type: 'poison' }]);
    expect(
      formAttack({ name: 'Multiattack', description: 'The bear makes two Rend attacks.' }),
    ).toBeNull();
  });

  it('a Druid 5 as a Wolf: Beast STR/DEX/CON, own INT/WIS/CHA, saves and skills, AC 12', () => {
    const sheet = sheetOf('druid', 5);
    const v = formView(sheet, MONSTERS.get('wolf')!, rulesOf(5));
    expect(v.ac).toBe(12);
    expect(v.acFromCircle).toBe(false);
    expect(v.abilities.STR).toEqual({ score: 14, modifier: 2, from: 'beast' });
    expect(v.abilities.WIS).toMatchObject({ score: sheet.abilities.WIS.score, from: 'you' });
    // Druid saves (INT, WIS) with the Druid's Proficiency Bonus (+3)
    expect(v.saves.WIS).toEqual({ modifier: sheet.savingThrows.WIS.modifier, from: 'you' });
    expect(v.saves.STR).toEqual({ modifier: 2, from: 'you' });
    // the wolf's Perception +5 is higher than the Druid's own (not proficient)
    expect(v.skills.find((s) => s.id === 'perception')).toMatchObject({
      modifier: 5,
      from: 'beast',
    });
    expect(v.passivePerception).toBe(15);
    expect(v.speed).toEqual({ walk: 40 });
    expect(v.attacks.map((a) => [a.name, a.bonus, a.damage])).toEqual([['Bite', 4, '1d6+2']]);
  });

  it('Moon: AC 13 + WIS when higher, WIS to CON saves (6), Lunar Radiance and Lunar Form notes', () => {
    const s3 = sheetOf('druid', 3, MOON);
    expect(formView(s3, MONSTERS.get('wolf')!, rulesOf(3, MOON))).toMatchObject({
      ac: 15,
      acFromCircle: true,
    });
    const s6 = sheetOf('druid', 6, MOON);
    const v6 = formView(s6, MONSTERS.get('brown-bear')!, rulesOf(6, MOON));
    // Brown Bear CON 15 (+2) + WIS +2 (Druid has no CON save proficiency)
    expect(v6.saves.CON.modifier).toBe(4);
    expect(v6.attacks[0].notes.map((n) => n.id)).toEqual(['lunarRadiance']);
    const s14 = sheetOf('druid', 14, MOON);
    const v14 = formView(s14, MONSTERS.get('brown-bear')!, rulesOf(14, MOON));
    expect(v14.attacks[0].notes.map((n) => n.id)).toEqual([
      'lunarRadiance',
      'lunarForm',
      'primalStrike',
    ]);
    expect(v6.otherActions.map((a) => a.name)).toContain('Multiattack');
  });
});

describe('Wild Shape in play: uses, Temporary Hit Points, rests', () => {
  it('taking a form spends a use and gives the THP; none left: nothing happens', () => {
    const sheet = sheetOf('druid', 5);
    const res = playResources(sheet);
    const rules = rulesOf(5);
    const st0 = hero('druid', 5).state;
    expect(counterOf('wildShape', res)?.max).toBe(2);
    const st1 = assumeForm(st0, res, 'wolf', rules, new Date('2026-01-01T00:00:00Z'));
    expect(st1.wildShape).toEqual({ formId: 'wolf', since: '2026-01-01T00:00:00.000Z', hours: 2 });
    expect(st1.hpTemp).toBe(5);
    expect(usesLeftFor(st1, 'wildShape', res)).toBe(1);
    const st2 = assumeForm(st1, res, 'rat', rules);
    expect(st2.wildShape?.formId).toBe('rat');
    expect(assumeForm(st2, res, 'wolf', rules)).toBe(st2);
    expect(leaveForm(st2).wildShape).toBeUndefined();
    expect(leaveForm(st2).hpTemp).toBe(5);
  });

  it('a Short Rest (1 h) ends a 1-hour form, not a 2-hour one; a Long Rest ends both', () => {
    const res = playResources(sheetOf('druid', 5));
    const st = assumeForm(hero('druid', 5).state, res, 'wolf', rulesOf(5));
    expect(shortRest(st, res).wildShape?.formId).toBe('wolf');
    expect(longRest(st).wildShape).toBeUndefined();
    const st2 = assumeForm(hero('druid', 2).state, res, 'rat', rulesOf(2));
    expect(shortRest(st2, res).wildShape).toBeUndefined();
  });
});

describe('Active states: Rage and the others', () => {
  const barbarian = (over: { active?: string[]; armor?: boolean; conditions?: string[] } = {}) => {
    const ch = hero('barbarian', 5);
    ch.inventory = [
      { id: 'axe', itemId: 'greataxe', name: '', qty: 1, equipped: true },
      ...(over.armor
        ? [{ id: 'pl', itemId: 'plate-armor', name: '', qty: 1, equipped: true }]
        : []),
    ];
    ch.state = { ...ch.state, conditions: over.conditions ?? [] };
    if (over.active) ch.state.active = over.active;
    return ch;
  };
  const rows = (ch: ReturnType<typeof barbarian>) => {
    const sheet = computeSheet(ch, REAL);
    return { sheet, attacks: attacksFor(sheet, weaponEntriesOf(ch.inventory, REAL.items)) };
  };

  it('each state is backed by its text', () => {
    for (const d of ACTIVE_STATES) {
      const t = d.spell
        ? REAL_SPELLS.find((s) => s.id === d.spell)!.description
        : text(d.feature!.cls, d.feature!.name);
      expect(t).toMatch(d.anchor);
    }
    for (const id of ['hex', 'hunters-mark'])
      expect(REAL_SPELLS.find((s) => s.id === id)!.duration).toBe('Concentration, up to 1 hour');
    expect(text('barbarian', 'Rage')).toContain(
      'You have Resistance to Bludgeoning, Piercing, and Slashing damage',
    );
    expect(RAGE_RESISTANCES).toEqual(['bludgeoning', 'piercing', 'slashing']);
    // the notes said to hold only while raging say so in their feature's text
    expect(text('barbarian/path-of-the-berserker', 'Frenzy')).toMatch(/while your Rage is active/);
    expect(text('barbarian/path-of-the-zealot', 'Divine Fury')).toMatch(
      /while your Rage is active/,
    );
    expect(text('barbarian/path-of-the-zealot', 'Fanatical Focus')).toMatch(/per active Rage/);
    expect(text('barbarian', 'Relentless Rage')).toMatch(/while your Rage is active/);
    expect(text('druid/circle-of-the-moon', 'Lunar Form')).toMatch(/Wild Shape form's attack/);
    expect(Object.keys(NOTE_WHILE).length).toBeGreaterThan(0);
  });

  it('off: Strength attacks as usual, no resistances; the Rage note is marked as "while raging"', () => {
    const { sheet, attacks } = rows(barbarian());
    expect(sheet.combat.states?.map((s) => [s.id, s.on])).toEqual([['rage', false]]);
    expect(attacks.find((a) => a.name === 'Greataxe')!.damage).toBe('1d12+3');
    expect(sheet.resistances).not.toContain('slashing');
    expect(sheet.combat.notes.find((n) => n.id === 'rage')?.while).toBe('rage');
  });

  it('on: +2 to Strength damage (weapon and Unarmed Strike), B/P/S resistance', () => {
    const { sheet, attacks } = rows(barbarian({ active: ['rage'] }));
    expect(stateOn(sheet.combat.states, 'rage')).toBe(true);
    const axe = attacks.find((a) => a.name === 'Greataxe')!;
    expect(axe.damage).toBe('1d12+5');
    expect(axe.notes).toContainEqual({ id: 'rageOn', params: { n: 2 } });
    expect(attacks.find((a) => a.nameKey === 'sheet.unarmedStrike')!.damage).toBe('6');
    expect(sheet.resistances).toEqual(expect.arrayContaining(RAGE_RESISTANCES));
  });

  it('Heavy armor or Incapacitated ends it: no effects', () => {
    const heavy = rows(barbarian({ active: ['rage'], armor: true }));
    expect(heavy.sheet.combat.states![0].ended).toBe('heavyArmor');
    expect(heavy.attacks.find((a) => a.name === 'Greataxe')!.damage).toBe('1d12+3');
    const out = rows(barbarian({ active: ['rage'], conditions: ['stunned'] }));
    expect(out.sheet.combat.states![0].ended).toBe('incapacitated');
    expect(out.sheet.resistances).not.toContain('slashing');
  });

  it('switching it on spends a Rage; with none left nothing happens; a rest ends it', () => {
    const ch = barbarian();
    const sheet = computeSheet(ch, REAL);
    const res = playResources(sheet);
    const on = switchState(ch.state, sheet, res, 'rage', true);
    expect(on.active).toEqual(['rage']);
    expect(on.resources['barbarian:rages']).toBe(1);
    const off = switchState(on, sheet, res, 'rage', false);
    expect(off.active).toBeUndefined();
    const spent = { ...ch.state, resources: { 'barbarian:rages': 3 } };
    expect(switchState(spent, sheet, res, 'rage', true)).toBe(spent);
    expect(shortRest(on, res).active).toBeUndefined();
    expect(longRest(on).active).toBeUndefined();
  });

  it('World Tree: Vitality Surge THP when the Rage is switched on', () => {
    const ch = hero('barbarian', 3, 'barbarian/path-of-the-world-tree');
    const sheet = computeSheet(ch, REAL);
    const on = switchState(ch.state, sheet, playResources(sheet), 'rage', true);
    expect(on.hpTemp).toBe(3);
  });

  it('Innate Sorcery: Sorcerer spell save DC +1 while on', () => {
    const ch = hero('sorcerer', 3);
    const base = computeSheet(ch, REAL).spellcasting.classes[0].saveDc;
    ch.state.active = ['innateSorcery'];
    expect(computeSheet(ch, REAL).spellcasting.classes[0].saveDc).toBe(base + 1);
  });

  it("Hex and Hunter's Mark are offered with the spell (Ranger: always prepared)", () => {
    const ranger = computeSheet(hero('ranger', 2), REAL);
    expect(ranger.combat.states?.map((s) => s.id)).toEqual(['huntersMark']);
    const warlock = computeSheet(hero('warlock', 1, null, { spells: ['hex'] }), REAL);
    expect(warlock.combat.states?.map((s) => s.id)).toEqual(['hex']);
    expect(warlock.combat.notes.find((n) => n.id === 'hex')?.while).toBe('hex');
  });

  it('Wild Shape is on while state.wildShape says a form', () => {
    const ch = hero('druid', 2);
    expect(computeSheet(ch, REAL).combat.states).toEqual([
      { id: 'wildShape', source: 'Wild Shape', on: false, ended: null, spends: 'Wild Shape' },
    ]);
    ch.state.wildShape = { formId: 'wolf' };
    expect(stateOn(computeSheet(ch, REAL).combat.states, 'wildShape')).toBe(true);
  });
});

describe('Characters saved before these fields', () => {
  it('stay as they were; bad values are dropped, good ones kept', () => {
    const old = normalizeCharacter({ id: 'x', name: 'X', state: { hpTemp: 0 }, choices: {} })!;
    expect(old.state.active).toBeUndefined();
    expect(old.state.wildShape).toBeUndefined();
    expect(old.choices.wildShapeForms).toBeUndefined();
    const raw = {
      id: 'y',
      name: 'Y',
      state: { active: ['rage', 3, '', 'rage'], wildShape: { formId: 'wolf', hours: 2, x: 1 } },
      choices: { wildShapeForms: ['wolf', 'rat', 'wolf', null] },
    };
    const c = normalizeCharacter(raw)!;
    expect(c.state.active).toEqual(['rage']);
    expect(c.state.wildShape).toEqual({ formId: 'wolf', hours: 2 });
    expect(c.choices.wildShapeForms).toEqual(['wolf', 'rat']);
    expect(
      normalizeCharacter({ ...raw, state: { wildShape: { hours: 2 } } })!.state.wildShape,
    ).toBeUndefined();
  });
});

describe('Combat tab in a Wild Shape form', () => {
  const rowsIn = (level: number, sub: string | null, formId: string | null) => {
    const ch = hero('druid', level, sub, { spells: ['shillelagh', 'thunderwave'] });
    ch.inventory = [{ id: 'q', itemId: 'quarterstaff', name: '', qty: 1, equipped: true }];
    const sheet = computeSheet(ch, REAL);
    const rules = wildShapeRules(sheet)!;
    const form = formId ? formView(sheet, MONSTERS.get(formId)!, rules) : null;
    return combatRows({
      sheet,
      character: ch,
      data: REAL,
      attacks: attacksFor(sheet, weaponEntriesOf(ch.inventory, REAL.items)),
      spells: new Map(REAL_SPELLS.map((s) => [s.id, s])),
      rules: [],
      resources: playResources(sheet),
      form,
    });
  };

  it("the Beast's attacks and actions replace the weapons; no spells", () => {
    const own = rowsIn(5, null, null);
    expect(own.some((r) => r.id === 'attack:q')).toBe(true);
    expect(own.some((r) => r.id === 'spell:thunderwave')).toBe(true);
    const wolf = rowsIn(5, null, 'wolf');
    expect(wolf.some((r) => r.id.startsWith('attack:'))).toBe(false);
    const bite = wolf.find((r) => r.id === 'form:wolf:bite')!;
    expect(bite.line).toEqual([
      { k: 'hit', n: 4 },
      { k: 'damage', dice: '1d6+2', type: 'piercing' },
      { k: 'reach', feet: 5 },
    ]);
    expect(wolf.some((r) => r.id.startsWith('spell:'))).toBe(false);
  });

  it('Circle of the Moon keeps its circle spells in a form', () => {
    const bear = rowsIn(3, MOON, 'brown-bear');
    const spells = bear.filter((r) => r.id.startsWith('spell:')).map((r) => r.id);
    expect(spells).toEqual(expect.arrayContaining(['spell:moonbeam', 'spell:cure-wounds']));
    expect(spells).not.toContain('spell:thunderwave');
    expect(bear.find((r) => r.id === 'form:brown-bear:multiattack@action')).toBeTruthy();
  });
});
