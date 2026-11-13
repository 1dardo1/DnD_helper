import classes from '../../../../../data/classes.json';
import species from '../../../../../data/species.json';
import subclasses from '../../../../../data/subclasses.json';
import { featRules } from './feat-effects';
import { sheetOf } from './real-data.testing';

/**
 * Counters per rest read from the 2014 texts (the compendium keeps them, adapted by the scraper):
 * "Once you use this trait, you can't use it again until you finish a short or long rest",
 * "You can use this feature three times ... you regain all expended uses when you finish a long
 * rest", "a number of times per day equal to your Intelligence modifier". Every text is the real
 * one from data/*.json.
 */

type Owner = {
  id: string;
  features?: { name: string; description: string }[];
  traits?: { name: string; description: string }[];
};

/** A feature or trait of the compendium, by its owner's id and its name. */
function text(list: unknown[], id: string, name: string): { name: string; description: string } {
  const owner = (list as Owner[]).find((x) => x.id === id);
  const f = [...(owner?.features ?? []), ...(owner?.traits ?? [])].find((x) => x.name === name);
  if (!f) throw new Error(`no ${id} / ${name} in the compendium`);
  return f;
}

const usesOf = (list: unknown[], id: string, name: string) => featRules(text(list, id, name)).uses;

describe('2014 counter "can\'t use it again until you finish a rest": one use per rest', () => {
  it.each([
    ['warlock/the-hexblade', "Hexblade's Curse", 'short-or-long'],
    ['wizard/lore-mastery', 'Master of Magic', 'long'],
    ['wizard/lore-mastery', 'Prodigious Memory', 'short-or-long'],
    ['warlock/the-seeker', 'Astral Sequestration', 'long'],
  ])('%s: %s', (id, name, rest) => {
    expect(usesOf(subclasses, id, name)).toEqual([expect.objectContaining({ max: 1, rest })]);
  });

  it('a species trait too: Relentless Endurance (Half-Orc) and Partially Amphibious (Vedalken)', () => {
    expect(usesOf(species, 'half-orc', 'Relentless Endurance')).toEqual([
      expect.objectContaining({ max: 1, rest: 'long' }),
    ]);
    expect(usesOf(species, 'vedalken', 'Partially Amphibious')).toEqual([
      expect.objectContaining({ max: 1, rest: 'long' }),
    ]);
  });
});

describe('2014 counter "must finish a rest before you can use it again": one use per rest', () => {
  it.each([
    ['blood-hunter/order-of-the-lycan', 'Hybrid Transformation'],
    ['cleric/city-domain-ua', 'Express Transit'],
    ['paladin/oath-of-treachery-ua', "Blackguard's Escape"],
  ])('%s: %s', (id, name) => {
    expect(usesOf(subclasses, id, name)).toEqual([
      expect.objectContaining({ max: 1, rest: 'short-or-long' }),
    ]);
  });
});

describe('2014 counter with a fixed number of uses ("You can use this feature three times")', () => {
  it.each([
    ['fighter/samurai', 'Fighting Spirit', 3, 'long'],
    ['fighter/sharpshooter', 'Steady Aim', 3, 'short-or-long'],
    ['wizard/chronurgy-magic', 'Chronal Shift', 2, 'long'],
    ['blood-hunter/order-of-the-lycan', 'Advanced Transformation', 2, 'short-or-long'],
    ['cleric/unity-domain-ua', 'Emboldening Bond', 1, 'long'],
  ])('%s: %s has %i uses per rest', (id, name, max, rest) => {
    expect(usesOf(subclasses, id, name)).toEqual([expect.objectContaining({ max, rest })]);
  });

  it('the sheet of a Samurai shows Fighting Spirit with its three uses', () => {
    const u = sheetOf('fighter', 3, 'fighter/samurai').featUses.find(
      (x) => x.feat === 'Fighting Spirit',
    );
    expect(u).toMatchObject({ max: 3, rest: 'long' });
  });

  it('a count that grows with the level stays as text', () => {
    // "You can use Aether Walk twice between rests starting at 15th level"
    expect(usesOf(subclasses, 'blood-hunter/order-of-the-ghostslayer', 'Aether Walk')).toEqual([]);
    // "You can use Blood Maledict twice between rests starting at 6th level, ..."
    expect(usesOf(classes, 'blood-hunter', 'Blood Maledict')).toEqual([]);
    // "At 15th level, you can invoke each rune ... twice, rather than once": a level, not a count
    expect(usesOf(subclasses, 'fighter/rune-knight', 'Master of Runes')).toEqual([]);
  });
});

describe('2014 counter with the ability modifier per day', () => {
  it('Artificial Mind: a number of times per day equal to the Intelligence modifier', () => {
    expect(usesOf(subclasses, 'artificer/archivist-ua', 'Artificial Mind')).toEqual([
      expect.objectContaining({ max: 'INT', rest: 'long' }),
    ]);
  });

  it('without a rest to regain it, it stays as text (Online Casting)', () => {
    expect(usesOf(subclasses, 'wizard/technomancy-ua', 'Online Casting')).toEqual([]);
  });
});

describe('the 2024 wording still works (no change for the same text)', () => {
  it('Large Form (Goliath): once per Long Rest, with the level it starts at', () => {
    expect(usesOf(species, 'goliath', 'Large Form')).toEqual([
      expect.objectContaining({ max: 1, rest: 'long' }),
    ]);
  });
});
