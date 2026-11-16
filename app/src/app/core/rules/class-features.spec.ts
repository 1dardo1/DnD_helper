import { computeSheet } from './engine';
import { REAL, hero } from './real-data.testing';
import { longRest, playResources, restPerks, shortRest } from '../play/play-state';
import { newCharacter } from '../models/character';
import { featureChoiceKey } from './class-picks';
import { sheetOf } from './real-data.testing';
import { pickKey } from './trait-choices';

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
