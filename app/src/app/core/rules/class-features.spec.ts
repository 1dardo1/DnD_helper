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
