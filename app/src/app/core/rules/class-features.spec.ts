import { proficientWith } from './attacks';
import { computeSheet } from './engine';
import { REAL, REAL_SPELLS, hero } from './real-data.testing';
import { FEATURE_USES, longRest, playResources, restPerks, shortRest } from '../play/play-state';
import { newCharacter } from '../models/character';
import { featureChoiceKey } from './class-picks';
import { sheetOf } from './real-data.testing';
import { pickKey } from './trait-choices';
import {
  classOnlyFeats,
  expertiseCount,
  extraLanguages,
  featsForClassSlot,
  featsForSlot,
  spellsFor,
} from '../creation/creation-rules';
import { expandedSpellIds, expandsSpellList, extraSpellLists } from './expanded-spells';

/**
 * Class and subclass features read from their real text (data/*.json): choices inside them
 * (class-picks.ts) and what they give (trait-effects.ts): proficiencies, saving throws,
 * immunities, capstones, speed, Armor Class.
 */

const divineOrder = featureChoiceKey('cleric', 'Divine Order');

describe('choices inside class features', () => {
  it('Divine Order: nothing chosen gives neither option, and warns', () => {
    const s = sheetOf('cleric', 1);
    expect(s.proficiencies.armor).not.toContain('Heavy armor');
    expect(s.warnings).toContainEqual({
      key: 'sheet.warn.traitChoiceMissing',
      params: { trait: 'Divine Order' },
    });
  });

  it('Divine Order: Protector gives Martial weapons and Heavy armor', () => {
    const s = sheetOf('cleric', 1, null, { traitChoices: { [divineOrder]: 'Protector' } });
    expect(s.proficiencies.armor).toContain('Heavy armor');
    expect(s.proficiencies.weapons).toContain('Martial weapons');
    expect(s.features.find((f) => f.name === 'Divine Order')?.chosen).toContainEqual({
      kind: 'option',
      values: ['Protector'],
    });
  });

  it('Divine Order: Thaumaturge gives an extra cantrip and + WIS to Arcana and Religion', () => {
    const base = sheetOf('cleric', 1, null, { traitChoices: { [divineOrder]: 'Protector' } });
    const s = sheetOf('cleric', 1, null, { traitChoices: { [divineOrder]: 'Thaumaturge' } });
    const cantrips = (x: typeof s) => x.spellcasting.classes[0].cantrips!;
    expect(cantrips(s)).toBe(cantrips(base) + 1);
    const arcana = (x: typeof s) => x.skills.find((k) => k.id === 'arcana')!.modifier;
    expect(arcana(s) - arcana(base)).toBe(Math.max(1, s.abilities.WIS.modifier));
    expect(s.proficiencies.armor).not.toContain('Heavy armor');
  });

  it("Knowledge Domain's skills of your choice are proficient once picked", () => {
    const key = pickKey(
      featureChoiceKey('cleric/knowledge-domain', 'Blessings of Knowledge'),
      'skill',
    );
    const s = sheetOf('cleric', 3, 'cleric/knowledge-domain', {
      traitChoices: { [divineOrder]: 'Protector' },
      traitPicks: { [key]: ['arcana', 'history'] },
    });
    expect(s.skills.find((k) => k.id === 'history')!.proficiency).not.toBe('none');
  });
});

describe('what class and subclass features give', () => {
  it('Monk: Unarmored Movement is counted once (40 ft at level 2, 45 at level 6)', () => {
    expect(sheetOf('monk', 2).speed['walk']).toBe(40);
    expect(sheetOf('monk', 6).speed['walk']).toBe(45);
  });

  it('Rogue 15: Slippery Mind gives WIS and CHA saving throws', () => {
    const s = sheetOf('rogue', 15);
    expect(s.savingThrows.WIS.proficient).toBe(true);
    expect(s.savingThrows.CHA.proficient).toBe(true);
  });

  it('Paladin 6: Aura of Protection adds the CHA modifier (min +1) to every save', () => {
    const p5 = sheetOf('paladin', 5);
    const p6 = sheetOf('paladin', 6);
    expect(p6.savingThrows.STR.modifier - p5.savingThrows.STR.modifier).toBe(
      Math.max(1, p6.abilities.CHA.modifier),
    );
  });

  it('Barbarian 20: Primal Champion raises STR and CON by 4, up to 25', () => {
    const s = sheetOf('barbarian', 20, null, { scores: { STR: 20, CON: 20 } });
    expect(s.abilities.STR.score).toBe(24);
    expect(s.abilities.CON.score).toBe(24);
  });

  it('College of Valor: Medium armor, Shields and Martial weapons', () => {
    const s = sheetOf('bard', 3, 'bard/college-of-valor');
    expect(s.proficiencies.armor).toEqual(expect.arrayContaining(['Medium armor', 'Shields']));
    expect(s.proficiencies.weapons).toContain('Martial weapons');
  });

  it('Oath of Glory 7: Aura of Alacrity adds 10 feet', () => {
    expect(sheetOf('paladin', 7, 'paladin/oath-of-glory').speed['walk']).toBe(40);
  });

  it('Storm Sorcery 18: immunity to Lightning and Thunder; Aura of Courage: Frightened', () => {
    expect(sheetOf('sorcerer', 18, 'sorcerer/storm-sorcery').immunities).toEqual(
      expect.arrayContaining(['Lightning', 'Thunder']),
    );
    expect(sheetOf('paladin', 10).conditionImmunities).toContain('Frightened');
  });

  it('Warforged: +1 to Armor Class', () => {
    const base = sheetOf('fighter', 1);
    const wf = sheetOf('fighter', 1, null, { speciesId: 'warforged' });
    expect(wf.armorClass.value - base.armorClass.value).toBe(1);
  });
});

describe('benefits of a temporary state are not permanent', () => {
  it.each([
    ['sorcerer', 14, 'sorcerer/aberrant-sorcery', 'fly'],
    ['sorcerer', 18, 'sorcerer/phoenix-sorcery', 'fly'],
    ['warlock', 14, 'warlock/undead-patron', 'fly'],
    ['druid', 10, 'druid/circle-of-the-sea', 'fly'],
  ])('%s %i (%s): no %s speed outside the form', (cls, level, sub, kind) => {
    expect(sheetOf(cls, level, sub).speed[kind]).toBeUndefined();
  });

  it.each([
    ['sorcerer', 14, 'sorcerer/lunar-sorcery'],
    ['blood-hunter', 7, 'blood-hunter/order-of-the-ghostslayer'],
    ['monk', 6, 'monk/warrior-of-intoxication-ua'],
    ['druid', 10, 'druid/circle-of-the-sea'],
  ])('%s %i (%s): no resistances of a state', (cls, level, sub) => {
    expect(sheetOf(cls, level, sub).resistances).toEqual([]);
  });

  it("keeps the permanent ones: Undead Patron's Necrotic Husk, Aberrant's Psychic Defenses", () => {
    expect(sheetOf('warlock', 14, 'warlock/undead-patron').resistances).toEqual(['Necrotic']);
    expect(sheetOf('sorcerer', 6, 'sorcerer/aberrant-sorcery').resistances).toEqual(['Psychic']);
  });

  it("The Third Eye's See Invisibility is not at will", () => {
    const s = sheetOf('wizard', 10, 'wizard/diviner');
    expect(s.featSpells.find((f) => f.id === 'see-invisibility')?.atWill ?? false).toBe(false);
  });
});

describe('spells that class and subclass features give, in their own wording', () => {
  const spell = (s: ReturnType<typeof sheetOf>, id: string) =>
    s.featSpells.find((f) => f.id === id);

  it.each([
    ['warlock', 3, 'warlock/the-undying', 'spare-the-dying'],
    ['warlock', 3, 'warlock/the-undying-light', 'sacred-flame'],
    ['warlock', 10, 'warlock/the-fathomless', 'evards-black-tentacles'],
    ['warlock', 14, 'warlock/the-raven-queen', 'finger-of-death'],
    ['cleric', 6, 'cleric/fate-domain-ua', 'augury'],
    ['fighter', 18, 'fighter/psi-warrior', 'telekinesis'],
    ['sorcerer', 6, 'sorcerer/spellfire-sorcery', 'counterspell'],
    ['monk', 3, 'monk/warrior-of-shadow', 'darkness'],
  ])('%s %i (%s): %s', (cls, level, sub, id) => {
    expect(spell(sheetOf(cls, level, sub), id)).toBeDefined();
  });

  it('Animal Speaker: Beast Sense and Speak with Animals only as rituals', () => {
    const s = sheetOf('barbarian', 3, 'barbarian/path-of-the-wild-heart');
    for (const id of ['beast-sense', 'speak-with-animals'])
      expect(spell(s, id)).toMatchObject({ ritual: true, atWill: false, freeKey: null });
  });

  it('Shadow Sorcery: Summon Beast paid with Sorcery Points is not at will', () => {
    const s = sheetOf('sorcerer', 6, 'sorcerer/shadow-sorcery');
    expect(spell(s, 'summon-beast')?.atWill).toBe(false);
  });
});

describe('counters and rests read from the features', () => {
  it('Light Domain 6: Improved Warding Flare brings Warding Flare back on a Short Rest', () => {
    const s = sheetOf('cleric', 6, 'cleric/light-domain');
    expect(s.featUses.find((u) => /Warding Flare/.test(u.label))?.rest).toBe('short-or-long');
  });

  it('Diviner: Portent rolls (2, then 3 at level 14); Monster Hunter: Superiority Dice', () => {
    const portent = (l: number) =>
      playResources(sheetOf('wizard', l, 'wizard/diviner')).find((r) => r.name === 'Portent')?.max;
    expect(portent(3)).toBe(2);
    expect(portent(14)).toBe(3);
    const dice = playResources(sheetOf('fighter', 7, 'fighter/monster-hunter')).find(
      (r) => r.name === 'Superiority Dice',
    );
    expect(dice?.max).toBe(5);
  });

  it("Artificer: Drain Magic Item's counter is the panel's own", () => {
    const keys = playResources(sheetOf('artificer', 9)).map((r) => r.key);
    expect(keys).toContain('artificer:drain-magic-item');
  });

  it('Tireless lowers Exhaustion on a Short Rest; Resourceful gives Heroic Inspiration', () => {
    const ranger = sheetOf('ranger', 10);
    const state = { ...newState(), exhaustion: 2 };
    expect(shortRest(state, playResources(ranger), restPerks(ranger)).exhaustion).toBe(1);
    const human = sheetOf('fighter', 1); // the test hero is a Human
    expect(longRest(newState(), restPerks(human)).heroicInspiration).toBe(true);
  });
});

function newState() {
  return newCharacter('x', 'y').state;
}

describe('Dragonborn 2024 (data re-extracted with all its traits)', () => {
  it('resists the damage type of the chosen ancestry and sees in the dark', () => {
    const c = hero('fighter', 5, null, { speciesId: 'dragonborn' });
    c.species = { id: 'dragonborn', variant: 'Black' };
    const s = computeSheet(c, REAL);
    expect(s.resistances).toContain('Acid');
    expect(s.darkvision).toBe(60);
    expect(s.featUses.some((u) => /Breath Weapon/.test(u.label))).toBe(true);
  });
});

describe('form states switched on in play', () => {
  const on = (cls: string, level: number, sub: string, id: string) => {
    const c = hero(cls, level, sub);
    c.state = { ...c.state, active: [id] };
    return computeSheet(c, REAL);
  };

  it('Bladesong: + INT to AC and 10 feet of Speed, only while on', () => {
    const off = sheetOf('wizard', 3, 'wizard/bladesinger', { scores: { INT: 16 } });
    const c = hero('wizard', 3, 'wizard/bladesinger', { scores: { INT: 16 } });
    c.state = { ...c.state, active: ['bladesong'] };
    const s = computeSheet(c, REAL);
    expect(s.combat.states?.some((x) => x.id === 'bladesong')).toBe(true);
    expect(s.armorClass.value - off.armorClass.value).toBe(3);
    expect(s.speed['walk'] - off.speed['walk']).toBe(10);
  });

  it('Wrath of the Sea with Stormborn: Fly Speed and Cold/Lightning/Thunder resistance', () => {
    const s = on('druid', 10, 'druid/circle-of-the-sea', 'wrathOfTheSea');
    expect(s.speed['fly']).toBe(s.speed['walk']);
    expect(s.resistances).toEqual(expect.arrayContaining(['Cold', 'Lightning', 'Thunder']));
  });

  it('Form of Dread with Superior Dread: immune to Frightened, flight, B/P/S resistance', () => {
    const s = on('warlock', 14, 'warlock/undead-patron', 'formOfDread');
    expect(s.conditionImmunities).toContain('Frightened');
    expect(s.speed['fly']).toBeGreaterThan(0);
    expect(s.resistances).toEqual(expect.arrayContaining(['Bludgeoning', 'Piercing', 'Slashing']));
  });
});

describe('answers to the rules doubts', () => {
  it('Mariner: +1 AC and swim/climb speeds without armor too, not with a shield', () => {
    const base = sheetOf('fighter', 1);
    const s = sheetOf('fighter', 1, null, { feats: ['mariner'] });
    expect(s.armorClass.value - base.armorClass.value).toBe(1);
    expect(s.speed['swim']).toBe(s.speed['walk']);
    expect(s.speed['climb']).toBe(s.speed['walk']);
  });

  it('a feat that does not name its casting ability: the highest; a tie asks the player', () => {
    // Cartomancer: "...the spell" with no ability named
    const tie = sheetOf('fighter', 1, null, {
      feats: ['cartomancer'],
      scores: { WIS: 14, CHA: 14, INT: 8 },
    });
    expect(tie.featMissing.some((m) => m.feat === 'Cartomancer' && m.what === 'ability')).toBe(
      true,
    );
    const clear = sheetOf('fighter', 1, null, {
      feats: ['cartomancer'],
      scores: { WIS: 10, CHA: 16, INT: 8 },
    });
    expect(clear.featMissing.some((m) => m.feat === 'Cartomancer' && m.what === 'ability')).toBe(
      false,
    );
    expect(clear.featSpells.find((f) => f.feat.name === 'Cartomancer')?.ability).toBe('CHA');
  });
});

describe('subclass restricted to a people (Path of the Battlerager: "Only dwarves can...")', () => {
  const warned = (speciesId: string) =>
    sheetOf('barbarian', 3, 'barbarian/path-of-the-battlerager', { speciesId }).warnings.some(
      (w) => w.key === 'sheet.warn.onlyFor',
    );
  it('warns a human, not a dwarf nor a duergar ("Duergar are dwarves...")', () => {
    expect(warned('human')).toBe(true);
    expect(warned('dwarf')).toBe(false);
    expect(warned('duergar')).toBe(false);
  });
});

describe("Hemocraft for the whole Blood Hunter class (Hunter's Bane: Intelligence or Wisdom)", () => {
  const bh = (level: number, sub: string | null, o: Parameters<typeof sheetOf>[3] = {}) =>
    sheetOf('blood-hunter', level, sub, o);
  const dc = (s: ReturnType<typeof sheetOf>) =>
    s.combat.stats.find((x) => x.id === 'hemocraftDc')?.params?.['n'];

  it('the higher of the two by default, the pick when there is one', () => {
    const s = bh(1, null, { scores: { INT: 10, WIS: 16 } });
    expect(s.classes[0].keyAbility).toEqual({
      name: 'Hemocraft',
      ability: 'WIS',
      choices: ['INT', 'WIS'],
    });
    expect(dc(s)).toBe(8 + 2 + 3);
    const ch = hero('blood-hunter', 1, null, { scores: { INT: 10, WIS: 16 } });
    ch.classes[0].spellAbility = 'INT';
    const picked = computeSheet(ch, REAL);
    expect(picked.classes[0].keyAbility?.ability).toBe('INT');
    expect(dc(picked)).toBe(8 + 2 + 0);
  });

  it('Dark Augmentation: + Hemocraft modifier to STR, DEX and CON saves only', () => {
    const s = bh(10, null, { scores: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 16 } });
    expect(s.savingThrows.STR.modifier).toBe(3 + 3);
    expect(s.savingThrows.CON.modifier).toBe(2 + 3);
    expect(s.savingThrows.WIS.modifier).toBe(3); // not proficient, no bonus
  });

  it('Brand of Castigation: Hemocraft modifier, twice from Brand of Tethering', () => {
    const note = (lv: number) =>
      bh(lv, null, { scores: { WIS: 16, INT: 10 } }).combat.notes.find(
        (x) => x.id === 'brandOfCastigation',
      )?.params?.['n'];
    expect(note(5)).toBeUndefined();
    expect(note(6)).toBe(3);
    expect(note(13)).toBe(6);
  });

  it('the Profane Soul casts with the Hemocraft ability', () => {
    const s = bh(3, 'blood-hunter/order-of-the-profane-soul', { scores: { INT: 10, WIS: 16 } });
    expect(s.spellcasting.classes[0].ability).toBe('WIS');
  });
});

describe('Fighting Style options a class names for itself (Paladin: Blessed Warrior; Ranger: Druidic Warrior)', () => {
  const feats = [...REAL.feats.values()];
  const only = classOnlyFeats(REAL.classes.values(), feats);
  const offered = (classId: string) =>
    featsForClassSlot(featsForSlot('fighting-style', feats), classId, only).map((f) => f.id);

  it("only that class's slots offer them", () => {
    expect(only.get('blessed-warrior')).toBe('paladin');
    expect(only.get('druidic-warrior')).toBe('ranger');
    expect(offered('paladin')).toContain('blessed-warrior');
    expect(offered('paladin')).not.toContain('druidic-warrior');
    expect(offered('ranger')).toContain('druidic-warrior');
    expect(offered('fighter')).not.toContain('blessed-warrior');
    expect(offered('fighter')).toContain('archery');
  });

  it('two Cleric cantrips cast with Charisma', () => {
    const slot = { featSlots: [{ slot: 'paladin:2', featId: 'blessed-warrior' }] };
    expect(sheetOf('paladin', 2, null, slot).featMissing).toContainEqual(
      expect.objectContaining({ feat: 'Blessed Warrior', what: 'cantrips' }),
    );
    const s = sheetOf('paladin', 2, null, {
      ...slot,
      featChoices: { 'paladin:2': { cantrips: ['guidance', 'sacred-flame'] } },
    });
    const bw = s.featSpells.filter((x) => x.feat.name === 'Blessed Warrior');
    expect(bw.map((x) => x.ability)).toEqual(['CHA', 'CHA']);
  });
});

describe('uses that come back some other way than a rest: a counter plus a note', () => {
  const use = (s: ReturnType<typeof sheetOf>, name: string) =>
    s.featUses.find((u) => u.feat === name);
  it('Lethargy Resilience: 1d4 Long Rests → Long Rest with a note', () => {
    const u = use(sheetOf('fighter', 1, null, { speciesId: 'khoravar' }), 'Lethargy Resilience');
    expect(u).toMatchObject({ max: 1, rest: 'long', recharge: 'longRests1d4' });
  });
  it('Feline Agility: moving 0 feet → any rest with a note', () => {
    const u = use(sheetOf('fighter', 1, null, { speciesId: 'tabaxi' }), 'Feline Agility');
    expect(u).toMatchObject({ max: 1, rest: 'short-or-long', recharge: 'moveZero' });
  });
  it('Tides of Chaos: casting with a slot or a Long Rest', () => {
    const s = sheetOf('sorcerer', 3, 'sorcerer/wild-magic-sorcery');
    expect(use(s, 'Tides of Chaos')).toMatchObject({ max: 1, rest: 'long', recharge: 'castSlot' });
    const r = playResources(s).find((x) => x.feat === 'Tides of Chaos');
    expect(r?.recharge).toBe('castSlot');
  });
});

describe('situational numbers worked out (Channel Divinity, Healer, Heavy Armor Master, Inspiring Leader)', () => {
  const stat = (s: ReturnType<typeof sheetOf>, id: string) =>
    [...s.combat.stats, ...s.combat.notes].find((x) => x.id === id)?.params;

  it('Divine Spark grows with the Cleric level; Turn Undead uses the spell DC', () => {
    expect(stat(sheetOf('cleric', 2, null, { scores: { WIS: 16 } }), 'divineSpark')).toEqual({
      dice: '1d8',
      mod: '+3',
    });
    expect(
      stat(sheetOf('cleric', 13, null, { scores: { WIS: 16 } }), 'divineSpark')?.['dice'],
    ).toBe('3d8');
    const s = sheetOf('cleric', 2, null, { scores: { WIS: 16 } });
    expect(stat(s, 'channelDivinityDc')?.['n']).toBe(s.spellcasting.classes[0].saveDc);
  });

  it('Touch of Death: 5 + twice the Cleric level', () => {
    expect(stat(sheetOf('cleric', 6, 'cleric/death-domain'), 'touchOfDeath')).toEqual({ n: 17 });
  });

  it('feats: Healer and Heavy Armor Master add the PB; Inspiring Leader level + the raised ability', () => {
    expect(stat(sheetOf('fighter', 5, null, { feats: ['healer'] }), 'battleMedic')).toEqual({
      n: 3,
    });
    expect(
      stat(sheetOf('fighter', 5, null, { feats: ['heavy-armor-master'] }), 'damageReduction'),
    ).toEqual({ n: 3 });
    const none = sheetOf('fighter', 5, null, { feats: ['inspiring-leader'] });
    expect(stat(none, 'bolsteringPerformance')).toBeUndefined();
    const s = sheetOf('fighter', 5, null, {
      feats: ['inspiring-leader'],
      scores: { CHA: 15 },
      abilityIncreases: [{ source: 'inspiring-leader', ability: 'CHA', amount: 1 }],
    });
    expect(stat(s, 'bolsteringPerformance')).toEqual({ n: 5 + 3 });
  });
});

describe("2014 Warlock patrons' expanded lists: added to the list, not always prepared", () => {
  const fathomless = REAL.subclasses.get('warlock/the-fathomless')!;
  it('reads it from the text and keeps the spells out of "always prepared"', () => {
    expect(expandsSpellList(fathomless)).toBe(true);
    expect(expandsSpellList(REAL.subclasses.get('cleric/life-domain')!)).toBe(false);
    const s = sheetOf('warlock', 5, 'warlock/the-fathomless');
    expect(s.featSpells.some((f) => f.id === 'thunderwave')).toBe(false);
  });

  it('by the Warlock level with slots of that spell level (1st → 1, 3rd → 5, 5th → 9)', () => {
    expect(expandedSpellIds(fathomless, 3)).toContain('thunderwave');
    expect(expandedSpellIds(fathomless, 3)).not.toContain('lightning-bolt');
    expect(expandedSpellIds(fathomless, 5)).toContain('lightning-bolt');
    expect(expandedSpellIds(fathomless, 9)).toContain('bigbys-hand');
    const warlock = REAL.classes.get('warlock')!;
    const picks = spellsFor(
      'warlock',
      warlock.spellcasting!,
      5,
      REAL_SPELLS,
      expandedSpellIds(fathomless, 5),
    );
    expect(picks.leveled.map((x) => x.id)).toContain('lightning-bolt');
  });

  it('a spellcasting table is not a list of spells (Profane Soul)', () => {
    expect(REAL.subclasses.get('blood-hunter/order-of-the-profane-soul')!.spells ?? []).toEqual([]);
  });
});

describe('Circle of the Land: the land chosen after a Long Rest decides the circle spells', () => {
  const key = featureChoiceKey('druid/circle-of-the-land', 'Circle of the Land Spells');
  const ids = (s: ReturnType<typeof sheetOf>) => s.featSpells.map((f) => f.id);
  it('no land chosen: none of the four lists, and the choice is asked', () => {
    const s = sheetOf('druid', 5, 'druid/circle-of-the-land');
    expect(ids(s)).not.toContain('blur');
    expect(ids(s)).not.toContain('fog-cloud');
    const c = s.featureChoices?.find((x) => x.key === key);
    expect(c?.options?.map((o) => o.name)).toEqual([
      'Arid Land',
      'Polar Land',
      'Temperate Land',
      'Tropical Land',
    ]);
    expect(c?.optionRest).toBe('long');
  });
  it('Polar Land: its spells up to the Druid level', () => {
    const s = sheetOf('druid', 5, 'druid/circle-of-the-land', {
      traitChoices: { [key]: 'Polar Land' },
    });
    expect(ids(s)).toEqual(expect.arrayContaining(['fog-cloud', 'hold-person', 'sleet-storm']));
    expect(ids(s)).not.toContain('ice-storm');
    expect(ids(s)).not.toContain('blur');
  });
});

describe('a number of an option only when that option is chosen', () => {
  const note = (cls: string, feature: string, option: string, id: string) =>
    sheetOf(cls, 8, null, {
      traitChoices: { [featureChoiceKey(cls, feature)]: option },
    }).combat.notes.some((n) => n.id === id);
  it('Blessed Strikes / Elemental Fury: Divine/Primal Strike, not Potent Spellcasting', () => {
    expect(note('cleric', 'Blessed Strikes', 'Divine Strike', 'divineStrike')).toBe(true);
    expect(note('cleric', 'Blessed Strikes', 'Potent Spellcasting', 'divineStrike')).toBe(false);
    expect(note('druid', 'Elemental Fury', 'Primal Strike', 'primalStrike')).toBe(true);
    expect(note('druid', 'Elemental Fury', 'Potent Spellcasting', 'primalStrike')).toBe(false);
  });
});

describe('a list of benefits (bullets after an intro that asks to choose nothing) all apply', () => {
  it('Saint of Forge and Fire: "- You gain immunity to fire damage."', () => {
    expect(sheetOf('cleric', 17, 'cleric/forge-domain').immunities).toContain('Fire');
  });
});

describe('picks inside domain features (verification of the test characters)', () => {
  const pickOf = (sub: string, feature: string, level: number) => {
    const s = sheetOf('cleric', level, sub);
    const key = featureChoiceKey(sub, feature);
    return { s, key, c: s.featureChoices?.find((x) => x.key === key) };
  };
  it('Student of Arcana: two Wizard cantrips', () => {
    const { c } = pickOf('cleric/arcana-domain', 'Student of Arcana', 3);
    const p = c?.picks.find((x) => x.pick.kind === 'cantrip');
    expect(p?.pick).toMatchObject({ count: 2, lists: ['wizard'] });
  });
  it('Reaper: one necromancy cantrip from any list', () => {
    const s = sheetOf('cleric', 3, 'cleric/death-domain');
    const p = s.featureChoices?.flatMap((c) => c.picks).find((x) => x.pick.kind === 'cantrip');
    expect(p?.pick).toMatchObject({ count: 1, schools: ['necromancy'] });
  });
  it('Order Domain: Intimidation or Persuasion; Peace: Insight, Performance or Persuasion', () => {
    const order = sheetOf('cleric', 3, 'cleric/order-domain');
    expect(
      order.featureChoices?.flatMap((c) => c.picks).find((x) => x.pick.kind === 'skill')?.pick.from,
    ).toEqual(['intimidation', 'persuasion']);
    const peace = sheetOf('cleric', 3, 'cleric/peace-domain');
    expect(
      peace.featureChoices?.flatMap((c) => c.picks).find((x) => x.pick.kind === 'skill')?.pick.from,
    ).toEqual(['insight', 'performance', 'persuasion']);
  });
  it('Indomitable Defense: two resistances to choose, applied', () => {
    const s = sheetOf('cleric', 17, 'cleric/protection-domain-ua');
    const p = s.featureChoices?.flatMap((c) => c.picks).find((x) => x.pick.kind === 'resistance');
    expect(p?.pick).toMatchObject({
      count: 2,
      from: ['Bludgeoning', 'Necrotic', 'Piercing', 'Radiant', 'Slashing'],
    });
    const chosen = sheetOf('cleric', 17, 'cleric/protection-domain-ua', {
      traitPicks: { [p!.key]: ['Necrotic', 'Radiant'] },
    });
    expect(chosen.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Radiant']));
  });
});

describe('verification batch: proficiencies, languages, Expertise, Darkvision, Dueling', () => {
  const skill = (s: ReturnType<typeof sheetOf>, id: string) =>
    s.skills.find((x) => x.id === id)?.proficiency;
  it('tools and weapons in benefit lists or with a choice next to them', () => {
    expect(sheetOf('artificer', 3, 'artificer/alchemist-ua').proficiencies.tools).toContain(
      "Alchemist's Supplies",
    );
    expect(sheetOf('artificer', 3, 'artificer/battle-smith-ua').proficiencies.weapons).toContain(
      'Martial weapons',
    );
    const mm = sheetOf('rogue', 3, 'rogue/mastermind').proficiencies.tools;
    expect(mm).toEqual(expect.arrayContaining(['Disguise Kit', 'Forgery Kit']));
    expect(sheetOf('monk', 3, 'monk/way-of-the-drunken-master').proficiencies.tools).toContain(
      "Brewer's Supplies",
    );
  });
  it('languages a feature teaches (Sylvan, Druidic)', () => {
    expect(sheetOf('druid', 3, 'druid/circle-of-the-shepherd').languages).toContain('Sylvan');
    expect(sheetOf('bard', 3, 'bard/college-of-the-moon').languages).toContain('Druidic');
  });
  it('Expertise: Survivalist doubled, Unencumbered Grace if already proficient', () => {
    const scout = sheetOf('rogue', 3, 'rogue/scout');
    expect(skill(scout, 'nature')).toBe('expertise');
    expect(skill(scout, 'survival')).toBe('expertise');
    expect(skill(sheetOf('cleric', 3, 'cleric/freedom-domain-ua'), 'acrobatics')).toBe('full');
  });
  it('Darkvision + 60 when already there (Gloom Stalker with a Dwarf), its own 60 otherwise', () => {
    expect(sheetOf('ranger', 3, 'ranger/gloom-stalker', { speciesId: 'dwarf' }).darkvision).toBe(
      120 + 60,
    );
    expect(sheetOf('ranger', 3, 'ranger/gloom-stalker', { speciesId: 'human' }).darkvision).toBe(
      60,
    );
  });
  it('picks: Primal Knowledge skill, Primal Lore skill and Druid cantrip, Giant cantrip', () => {
    const kinds = (s: ReturnType<typeof sheetOf>) =>
      (s.featureChoices ?? []).flatMap((c) => c.picks.map((p) => p.pick));
    expect(kinds(sheetOf('barbarian', 3, null)).some((p) => p.kind === 'skill')).toBe(true);
    const moon = kinds(sheetOf('bard', 3, 'bard/college-of-the-moon'));
    expect(moon.find((p) => p.kind === 'skill')?.from).toContain('nature');
    expect(moon.find((p) => p.kind === 'cantrip')?.lists).toEqual(['druid']);
    expect(
      kinds(sheetOf('barbarian', 3, 'barbarian/path-of-the-giant')).find(
        (p) => p.kind === 'cantrip',
      )?.from,
    ).toEqual(['druidcraft', 'thaumaturgy']);
  });
});

describe('verification batch 2: free casts, partly situational features, resistances', () => {
  it("Paladin's Smite: Divine Smite once without a slot per Long Rest", () => {
    const s = sheetOf('paladin', 2);
    expect(s.featSpells.find((f) => f.id === 'divine-smite')?.freeKey).toBeTruthy();
    expect(
      s.featUses.some((u) => u.label === 'Divine Smite' && u.max === 1 && u.rest === 'long'),
    ).toBe(true);
  });
  it('Hungering Might: + Wisdom modifier to Constitution saves (the transformed part stays text)', () => {
    const s = sheetOf('ranger', 7, 'ranger/hollow-warden', { scores: { WIS: 16, CON: 14 } });
    expect(s.savingThrows.CON.modifier).toBe(2 + 3);
  });
  it('Thought Shield: Resistance to Psychic damage', () => {
    expect(sheetOf('warlock', 10, 'warlock/great-old-one-patron').resistances).toContain('Psychic');
  });
});

describe('Magical Secrets: Bard spells from the Cleric, Druid and Wizard lists from level 10', () => {
  const bard = REAL.classes.get('bard')!;
  it('reads the lists from the text, from level 10 on', () => {
    expect(extraSpellLists(bard, 9)).toEqual([]);
    expect(extraSpellLists(bard, 10)).toEqual(['cleric', 'druid', 'wizard']);
  });
  it("the picker offers Fireball at Bard 10 (not at 9), never another list's cantrips", () => {
    const at = (lv: number) =>
      spellsFor('bard', bard.spellcasting!, lv, REAL_SPELLS, [], extraSpellLists(bard, lv));
    expect(at(9).leveled.some((s) => s.id === 'fireball')).toBe(false);
    expect(at(10).leveled.some((s) => s.id === 'fireball')).toBe(true);
    expect(at(10).cantrips.some((s) => s.id === 'fire-bolt')).toBe(false);
  });
});

describe('options to choose that must not all apply', () => {
  it('Beast Tattoo ("Choose two tattoos"): no tattoo applies until chosen', () => {
    const s = sheetOf('monk', 6, 'monk/tattooed-warrior-ua8-18-09-25');
    expect(s.senses.some((x) => x.kind === 'blindsight')).toBe(false);
    expect(s.featSpells.some((f) => f.id === 'dancing-lights')).toBe(false);
  });
  it('Metal Magic: Stone Sorcery spells are added to the list, not always prepared', () => {
    const stone = REAL.subclasses.get('sorcerer/stone-sorcery')!;
    expect(expandsSpellList(stone)).toBe(true);
    expect(
      sheetOf('sorcerer', 10, 'sorcerer/stone-sorcery').featSpells.some(
        (f) => f.id === 'searing-smite',
      ),
    ).toBe(false);
  });
});

describe('resistances to choose and Divine Magic', () => {
  const resistancePick = (s: ReturnType<typeof sheetOf>) =>
    (s.featureChoices ?? []).flatMap((c) => c.picks).find((p) => p.pick.kind === 'resistance');
  it('Fiendish Resilience: any type but Force; Aura of Elemental Shielding: one of five', () => {
    const fiend = resistancePick(sheetOf('warlock', 10, 'warlock/fiend-patron'));
    expect(fiend?.pick.from).not.toContain('Force');
    expect(fiend?.pick.from).toContain('Necrotic');
    const genie = resistancePick(sheetOf('paladin', 7, 'paladin/oath-of-the-noble-genies'));
    expect(genie?.pick.from).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
  });
  it('the chosen one applies', () => {
    const p = resistancePick(sheetOf('warlock', 10, 'warlock/fiend-patron'))!;
    const s = sheetOf('warlock', 10, 'warlock/fiend-patron', { traitPicks: { [p.key]: ['Fire'] } });
    expect(s.resistances).toContain('Fire');
  });
  it('Divine Soul prepares from the Cleric list too', () => {
    const cls = REAL.classes.get('sorcerer')!;
    expect(extraSpellLists(cls, 3, REAL.subclasses.get('sorcerer/divine-soul'))).toEqual([
      'cleric',
    ]);
  });
});

describe('counters found by the verification', () => {
  it('every anchored counter matches the real text of its feature', () => {
    for (const f of FEATURE_USES.filter((x) => x.anchor)) {
      const sub = REAL.subclasses.get(f.subclassId!)!;
      const feat = sub.features.find((x) => x.name === f.anchor!.feature);
      expect(feat?.description.replace(/\s+/g, ' '), `${f.subclassId} ${f.name}`).toMatch(
        f.anchor!.text,
      );
    }
  });
  const res = (s: ReturnType<typeof sheetOf>, name: string) =>
    playResources(s).find((r) => r.name === name);
  it('Healing Hands 10 × level; Channel Arcana 1/2/3 back on a short rest; Balm d6 × level', () => {
    expect(res(sheetOf('monk', 5, 'monk/way-of-tranquility'), 'Healing Hands')?.max).toBe(50);
    expect(res(sheetOf('wizard', 6, 'wizard/theurgy-ua'), 'Channel Arcana')).toMatchObject({
      max: 2,
      short: 'all',
    });
    expect(
      res(sheetOf('druid', 6, 'druid/circle-of-dreams'), 'Balm of the Summer Court'),
    ).toMatchObject({ max: 6, die: 'd6' });
  });
  it('Curse Specialist: one more Blood Maledict', () => {
    const base = res(
      sheetOf('blood-hunter', 3, 'blood-hunter/order-of-the-mutant'),
      'Blood Maledict',
    )!.max;
    expect(
      res(sheetOf('blood-hunter', 3, 'blood-hunter/order-of-the-ghostslayer'), 'Blood Maledict')!
        .max,
    ).toBe(base + 1);
  });
  it('free casts: Grasping Tentacles, Protection from Evil and Good, Voice of Death (short rest, DEX)', () => {
    const free = (s: ReturnType<typeof sheetOf>, id: string) =>
      s.featSpells.find((f) => f.id === id);
    expect(
      free(sheetOf('warlock', 10, 'warlock/the-fathomless'), 'evards-black-tentacles')?.freeKey,
    ).toBeTruthy();
    expect(
      free(sheetOf('fighter', 3, 'fighter/monster-hunter'), 'protection-from-evil-and-good')
        ?.freeKey,
    ).toBeTruthy();
    const ph = sheetOf('rogue', 9, 'rogue/phantom');
    expect(free(ph, 'speak-with-dead')?.ability).toBe('DEX');
    expect(ph.featUses.find((u) => u.label === 'Speak with Dead')?.rest).toBe('short-or-long');
  });
});

describe('pending batch: Expertise, Timeless, features "while your Rage is active"', () => {
  it('Tyrants Herald: Expertise in Intimidation; Timeless: immune to Exhaustion', () => {
    expect(
      sheetOf('warlock', 3, 'warlock/sorcerer-king-patron-ua').skills.find(
        (x) => x.id === 'intimidation',
      )?.proficiency,
    ).toBe('expertise');
    expect(sheetOf('ranger', 15, 'ranger/hollow-warden').conditionImmunities).toContain(
      'Exhaustion',
    );
  });
  it('Lament: Cold and Necrotic only while raging; Berserker: Charmed/Frightened immunity while raging', () => {
    const raging = (sub: string, lv: number) => {
      const ch = hero('barbarian', lv, sub);
      return computeSheet({ ...ch, state: { ...ch.state, active: ['rage'] } }, REAL);
    };
    expect(sheetOf('barbarian', 10, 'barbarian/path-of-lament-ua').resistances).not.toContain(
      'Cold',
    );
    expect(raging('barbarian/path-of-lament-ua', 10).resistances).toEqual(
      expect.arrayContaining(['Cold', 'Necrotic']),
    );
    expect(raging('barbarian/path-of-the-berserker', 6).conditionImmunities).toEqual(
      expect.arrayContaining(['Charmed', 'Frightened']),
    );
  });
});

describe('Armor Model: one model to choose, changeable after a rest', () => {
  it('offers the three models from their headings, and only the chosen one applies', () => {
    const key = featureChoiceKey('artificer/armorer-ua', 'Armor Model');
    const s = sheetOf('artificer', 3, 'artificer/armorer-ua');
    const c = s.featureChoices?.find((x) => x.key === key);
    expect(c?.options?.map((o) => o.name)).toEqual(['Dreadnaught', 'Guardian', 'Infiltrator']);
    expect(c?.optionRest).toBe('short');
    const inf = sheetOf('artificer', 3, 'artificer/armorer-ua', {
      traitChoices: { [key]: 'Infiltrator' },
    });
    expect(inf.featureChoices?.find((x) => x.key === key)?.chosen).toBe('Infiltrator');
  });
});

describe('Crimson Rite: extra damage of the hemocraft die', () => {
  it('the die of the class table at its level', () => {
    const note = (lv: number) =>
      sheetOf('blood-hunter', lv).combat.notes.find((n) => n.id === 'crimsonRite')?.params;
    expect(note(2)).toEqual({ die: '1d4' });
    expect(note(11)).toEqual({ die: '1d8' });
  });
});

describe('Training in War and Song: Melee Martial weapons without Two-Handed or Heavy', () => {
  it('a Rapier and a Longsword, not a Greatsword nor a Longbow', () => {
    const s = sheetOf('wizard', 3, 'wizard/bladesinger');
    const ok = (id: string) => proficientWith(s.proficiencies.weapons, REAL.items.get(id)!);
    expect(ok('rapier')).toBe(true);
    expect(ok('longsword')).toBe(true);
    expect(ok('greatsword')).toBe(false);
    expect(ok('longbow')).toBe(false);
  });
});

describe('choices from a table (Giant Soul, Scion of the Three)', () => {
  it('Scion of the Three: Bhaal gives Poison resistance and Blade Ward, changeable on a Long Rest', () => {
    const key = featureChoiceKey('rogue/scion-of-the-three', 'Dread Allegiance');
    const c = sheetOf('rogue', 3, 'rogue/scion-of-the-three').featureChoices?.find(
      (x) => x.key === key,
    );
    expect(c?.options?.map((o) => o.name)).toEqual(['Bane', 'Bhaal', 'Myrkul']);
    expect(c?.optionRest).toBe('long');
    const s = sheetOf('rogue', 3, 'rogue/scion-of-the-three', { traitChoices: { [key]: 'Bhaal' } });
    expect(s.resistances).toContain('Poison');
    expect(s.featSpells.some((f) => f.id === 'blade-ward')).toBe(true);
    expect(s.featSpells.some((f) => f.id === 'chill-touch')).toBe(false);
  });
  it('Giant Soul: the spells of the chosen giant type', () => {
    const key = featureChoiceKey('sorcerer/giant-soul', 'Mark of the Ordning');
    const s = sheetOf('sorcerer', 3, 'sorcerer/giant-soul', { traitChoices: { [key]: 'Frost' } });
    const ids = s.featSpells.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['armor-of-agathys', 'hold-person']));
    expect(ids).not.toContain('fog-cloud');
  });
});

describe("Fool's Insight: Detect Thoughts CHA times per Long Rest", () => {
  it('a free cast counted by the Charisma modifier', () => {
    const s = sheetOf('bard', 6, 'bard/college-of-satire-ua', { scores: { CHA: 16 } });
    expect(s.featSpells.find((f) => f.id === 'detect-thoughts')?.freeKey).toBeTruthy();
  });
});

it("Fool's Insight: one counter, not two", () => {
  const s = sheetOf('bard', 6, 'bard/college-of-satire-ua', { scores: { CHA: 16 } });
  expect(playResources(s).filter((r) => r.feat === "Fool's Insight")).toHaveLength(1);
});

describe('leveled spells to choose inside a feature', () => {
  const spellPick = (s: ReturnType<typeof sheetOf>) =>
    (s.featureChoices ?? []).flatMap((c) => c.picks).find((p) => p.pick.spellLevels === 'any');
  it('Magical Discoveries: two spells from the Cleric, Druid or Wizard lists, always prepared', () => {
    const p = spellPick(sheetOf('bard', 6, 'bard/college-of-lore'))!;
    expect(p.pick).toMatchObject({ count: 2, lists: ['cleric', 'druid', 'wizard'] });
    const s = sheetOf('bard', 6, 'bard/college-of-lore', {
      traitPicks: { [p.key]: ['fireball', 'guidance'] },
    });
    expect(s.featSpells.find((f) => f.id === 'fireball')?.always).toBe(true);
  });
  it('Mental Discipline: one of three spells, cast once free per Long Rest', () => {
    const p = spellPick(sheetOf('wizard', 10, 'wizard/psionics-ua'))!;
    expect(p.pick.from).toEqual(['dominate-person', 'scrying', 'telekinesis']);
    const s = sheetOf('wizard', 10, 'wizard/psionics-ua', {
      traitPicks: { [p.key]: ['telekinesis'] },
    });
    expect(s.featSpells.find((f) => f.id === 'telekinesis')?.freeKey).toBeTruthy();
  });
});

describe('spells and AC written another way', () => {
  it('Star Map: Guidance and Guiding Bolt; Consult the Spirits: Augury and Clairvoyance', () => {
    const stars = sheetOf('druid', 3, 'druid/circle-of-the-stars').featSpells.map((f) => f.id);
    expect(stars).toEqual(expect.arrayContaining(['guidance', 'guiding-bolt']));
    const ag = sheetOf(
      'barbarian',
      10,
      'barbarian/path-of-the-ancestral-guardian-ua',
    ).featSpells.map((f) => f.id);
    expect(ag).toEqual(expect.arrayContaining(['augury', 'clairvoyance']));
  });
  it('Locathah: "your AC is 12 + your Dexterity modifier" without armor', () => {
    const s = sheetOf('rogue', 1, null, { speciesId: 'locathah-lr', scores: { DEX: 14 } });
    expect(s.armorClass.value).toBeGreaterThanOrEqual(12 + 2);
  });
});

describe('Deft Explorer: one more Expertise and two more languages', () => {
  it('the counts read from the text', () => {
    const ranger = REAL.classes.get('ranger')!;
    expect(expertiseCount(ranger, 1)).toBe(0);
    expect(expertiseCount(ranger, 2)).toBe(1);
    expect(extraLanguages(ranger, 2)).toBe(2);
    expect(extraLanguages(REAL.classes.get('fighter')!, 20)).toBe(0);
  });
});

describe('Mystic Arcanum: one Warlock spell of level 6, then 7, 8 and 9', () => {
  const pick = (lv: number) =>
    sheetOf('warlock', lv)
      .featureChoices?.flatMap((c) => c.picks)
      .find((p) => p.trait === 'Mystic Arcanum')?.pick;
  it('one more arcanum at 13, 15 and 17, from the Warlock list', () => {
    expect(pick(11)).toMatchObject({ count: 1, levels: [6], lists: ['warlock'] });
    expect(pick(15)).toMatchObject({ count: 3, levels: [6, 7, 8] });
    expect(pick(17)?.levels).toEqual([6, 7, 8, 9]);
  });
});
