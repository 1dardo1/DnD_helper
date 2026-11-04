import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import monsters from '../../../../../data/monsters.json';
import species from '../../../../../data/species.json';
import spells from '../../../../../data/spells.json';
import subclasses from '../../../../../data/subclasses.json';
import { parseMonster } from '../dm/monster-actions';
import { Character, newCharacter, normalizeCharacter } from '../models/character';
import { Ability, Monster, Spell } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import {
  SummonCatalog,
  SummonSource,
  buildCatalog,
  contextFor,
  maxSlotOf,
  resolveOption,
  slotLevelOf,
  summonSourcesOf,
} from './catalog';
import { SummonContext, conditionHolds, evalSum, resolveText } from './resolve';
import { extractStatBlocks } from './stat-block';
import {
  creatureKey,
  creatureOf,
  dismissAll,
  emptySummons,
  normalizeSummons,
  resetSummons,
  setScale,
  setSummoned,
  summonedCount,
  toCombatMonster,
  updateCreature,
} from './summon-state';
import { applyDamage, setTemp } from '../dm/combat';

const allSpells = spells as unknown as Spell[];
const allMonsters = monsters as unknown as Monster[];
const spellById = new Map(allSpells.map((s) => [s.id, s]));
const catalog: SummonCatalog = buildCatalog(allSpells, allMonsters);

const byId = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));
const rules = {
  classes: byId(classes),
  subclasses: byId(subclasses),
  species: byId(species),
  backgrounds: byId(backgrounds),
  feats: byId(feats),
  items: byId(items),
} as unknown as RulesData;

function ctx(level: number, over: Partial<SummonContext> = {}): SummonContext {
  const mods = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 3, CHA: 0 } as Record<Ability, number>;
  return {
    slotLevel: level,
    pb: 3,
    spellAttack: 7,
    spellDc: 15,
    mods,
    spellMod: 3,
    classLevels: { ranger: 5, artificer: 5, druid: 5 },
    totalLevel: 5,
    ...over,
  };
}

function source(id: string): SummonSource {
  const s = catalog.spells.get(id);
  if (!s) throw new Error(`no source ${id}`);
  return s;
}

function creature(
  spellId: string,
  optionKey: string,
  level: number,
  over?: Partial<SummonContext>,
) {
  const s = source(spellId);
  const o = s.options.find((x) => x.key === optionKey);
  if (!o) throw new Error(`${spellId}: no option ${optionKey} in ${s.options.map((x) => x.key)}`);
  const r = resolveOption(s, o, ctx(level, over), catalog)!;
  expect(r.unresolved).toEqual([]);
  return r.monster;
}

const feature = (m: Monster, name: string) =>
  [...m.traits, ...m.actions, ...m.bonusActions, ...m.reactions].find((f) =>
    f.name.startsWith(name),
  )!;

describe('stat block parser', () => {
  it('reads the table of Summon Beast', () => {
    const [b] = extractStatBlocks(
      spellById.get('summon-beast')!.description +
        '\n' +
        spellById.get('summon-beast')!.higherLevels,
    );
    expect(b.title).toBe('Bestial Spirit');
    expect(b.typeLine).toBe('Small Beast, Neutral');
    expect(b.ac).toBe("11 + the spell's level");
    expect(b.hp).toBe('20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2');
    expect(b.abilities).toEqual({ STR: 18, DEX: 11, CON: 16, INT: 4, WIS: 14, CHA: 5 });
    expect(b.sections.traits.map((r) => r.name)).toEqual([
      'Flyby',
      'Pack Tactics',
      'Water Breathing',
    ]);
    expect(b.sections.traits[0].tags).toEqual(['Air Only']);
    expect(b.sections.actions.map((r) => r.name)).toEqual(['Multiattack', 'Rend']);
  });

  it('finds the three blocks of the Beast Master and the title of each', () => {
    const sub = (
      subclasses as unknown as { id: string; features: { name: string; description: string }[] }[]
    ).find((s) => s.id === 'ranger/beast-master')!;
    const f = sub.features.find((x) => x.name === 'Primal Companion')!;
    expect(extractStatBlocks(f.description).map((b) => b.title)).toEqual([
      'Beast of the Land',
      'Beast of the Sky',
      'Beast of the Sea',
    ]);
  });
});

describe('formulas', () => {
  const c = ctx(4);
  it('adds terms, per-level scaling and conditions by variant', () => {
    expect(evalSum("11 + the spell's level", c, null, [])).toBe(15);
    expect(evalSum("11 + the spell's level + 2 (Brute only)", c, 'Brute', ['Brute', 'Flyer'])).toBe(
      17,
    );
    expect(evalSum("11 + the spell's level + 2 (Brute only)", c, 'Flyer', ['Brute', 'Flyer'])).toBe(
      15,
    );
    expect(evalSum('5 + 10 per spell level (the steed has Hit Dice [d10s])', c, null, [])).toBe(45);
    expect(evalSum('30 + 10 for each spell level above 3', c, null, [])).toBe(40);
    expect(evalSum('30 + 10 for each spell level above 6', c, null, [])).toBe(30);
    expect(evalSum('13 plus your Wisdom modifier', c, null, [])).toBe(16);
    expect(evalSum('5 + five times your ranger level (the beast has hit dice)', c, null, [])).toBe(
      30,
    );
    expect(evalSum('14 + PB (natural armor)', c, null, [])).toBe(17);
    expect(evalSum('something odd', c, null, [])).toBeNull();
  });

  it('picks the number of a variant', () => {
    const v = ['Air', 'Land', 'Water'];
    const hp = '20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2';
    expect(evalSum(hp, ctx(2), 'Air', v)).toBe(20);
    expect(evalSum(hp, ctx(2), 'Land', v)).toBe(30);
    expect(evalSum(hp, ctx(5), 'Water', v)).toBe(45);
  });

  it('knows what is a condition', () => {
    expect(conditionHolds('requires level 4+ spell', null, [], 3)).toBe(false);
    expect(conditionHolds('requires level 4+ spell', null, [], 4)).toBe(true);
    expect(conditionHolds('Land and Water only', 'Water', ['Air', 'Land', 'Water'], 2)).toBe(true);
    expect(conditionHolds('Land and Water only', 'Air', ['Air', 'Land', 'Water'], 2)).toBe(false);
    expect(conditionHolds('natural armor', 'Air', ['Air'], 2)).toBeNull();
  });

  it('works out the text of a feature', () => {
    const t = resolveText(
      "Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. Hit: 1d8 + 4 + the spell's level Piercing damage.",
      ctx(4),
      null,
      [],
    );
    expect(t).toBe('Melee Attack Roll: +7, reach 5 ft. Hit: 12 (1d8 + 8) Piercing damage.');
    expect(
      resolveText(
        "The spirit makes a number of Rend attacks equal to half this spell's level (round down).",
        ctx(5),
        null,
        [],
      ),
    ).toBe('The spirit makes 2 Rend attacks.');
    expect(
      resolveText(
        'Constitution Saving Throw: DC equals your spell save DC, any creature.',
        ctx(3),
        null,
        [],
      ),
    ).toBe('Constitution Saving Throw: DC 15, any creature.');
    expect(
      resolveText("regains Hit Points equal to 2d8 plus the spell's level.", ctx(5), null, []),
    ).toBe('regains Hit Points equal to 2d8 + 5.');
  });
});

describe('Summon spells (stat block in the description)', () => {
  it('Summon Beast: Land, Air and Water at the slot level', () => {
    const land = creature('summon-beast', 'land', 4);
    expect(land.name).toBe('Bestial Spirit (Land)');
    expect(land.ac).toBe(15);
    expect(land.hp).toBe(40);
    expect(land.creatureType).toBe('beast');
    expect(land.size).toEqual(['Small']);
    expect(land.speed).toEqual({ walk: 30, climb: 30 });
    expect(land.abilities.STR).toBe(18);
    expect(land.senses.darkvision).toBe(60);
    expect(feature(land, 'Pack Tactics')).toBeTruthy();
    expect(land.traits.find((f) => f.name.startsWith('Flyby'))).toBeUndefined();
    expect(feature(land, 'Multiattack').description).toBe('The spirit makes 2 Rend attacks.');
    expect(feature(land, 'Rend').description).toContain(
      'Melee Attack Roll: +7, reach 5 ft. Hit: 12 (1d8 + 8) Piercing damage',
    );

    const air = creature('summon-beast', 'air', 2);
    expect(air.hp).toBe(20);
    expect(air.ac).toBe(13);
    expect(air.speed).toEqual({ walk: 30, fly: 60 });
    expect(feature(air, 'Multiattack').description).toBe('The spirit makes 1 Rend attack.');
    expect(air.traits.map((f) => f.name)).toEqual(['Flyby']);

    expect(creature('summon-beast', 'water', 3).speed).toEqual({ walk: 30, swim: 30 });
  });

  it('the parsed actions of the card are attacks with the right numbers', () => {
    const m = creature('summon-beast', 'land', 4);
    const parsed = parseMonster(m);
    const rend = parsed.features.find((f) => f.name === 'Rend')!;
    expect(rend.kind).toBe('attack');
    expect(rend.attack).toMatchObject({ mode: 'melee', bonus: 7, reach: 5 });
    expect(rend.damage).toEqual([
      { average: 12, dice: '1d8 + 8', type: 'piercing', conditional: false },
    ]);
  });

  it('scaling follows the slot level', () => {
    const hp = (lvl: number) => creature('summon-beast', 'land', lvl).hp;
    expect([2, 3, 4, 9].map(hp)).toEqual([30, 35, 40, 65]);
    const dmg = (lvl: number) =>
      parseMonster(creature('summon-beast', 'land', lvl)).features.find((f) => f.name === 'Rend')!
        .damage[0].average;
    expect([2, 3, 4].map(dmg)).toEqual([10, 11, 12]);
    // the attack bonus is the caster's
    const a = parseMonster(creature('summon-beast', 'land', 2, { spellAttack: 9 })).features.find(
      (f) => f.name === 'Rend',
    )!;
    expect(a.attack!.bonus).toBe(9);
  });

  it('Summon Fey: the mood decides the bonus action', () => {
    const m = creature('summon-fey', 'mirthful', 4);
    expect(m.ac).toBe(16);
    expect(m.hp).toBe(40);
    expect(m.speed).toEqual({ walk: 30, fly: 30 });
    expect(m.immunities).toEqual([]);
    expect(m.conditionImmunities).toEqual(['charmed']);
    expect(feature(m, 'Fey Blade').description).toContain('14 (2d6 + 7) Force damage');
    const step = m.bonusActions.find((f) => f.name === 'Fey Step')!;
    expect(step.description).toContain('**Mirthful.** Wisdom Saving Throw: DC 15');
    expect(step.description).not.toContain('Tricksy');
    expect(creature('summon-fey', 'tricksy', 3).bonusActions[0].description).toContain('Darkness');
  });

  it('Summon Undead: Putrid has an aura with the save DC, Skeletal has less HP and a bow', () => {
    const putrid = creature('summon-undead', 'putrid', 5);
    expect(putrid.ac).toBe(16);
    expect(putrid.hp).toBe(50);
    expect(putrid.traits.map((f) => f.name)).toEqual(['Festering Aura']);
    expect(putrid.traits[0].description).toContain('Constitution Saving Throw: DC 15');
    expect(putrid.actions.map((f) => f.name)).toEqual(['Multiattack', 'Rotting Claw']);
    expect(putrid.immunities).toEqual(['necrotic', 'poison']);
    expect(putrid.conditionImmunities).toEqual([
      'exhaustion',
      'frightened',
      'paralyzed',
      'poisoned',
    ]);
    const skeletal = creature('summon-undead', 'skeletal', 3);
    expect(skeletal.hp).toBe(20);
    expect(feature(skeletal, 'Grave Bolt').description).toContain(
      'Ranged Attack Roll: +7, range 150 ft. Hit: 11 (2d4 + 6) Necrotic damage',
    );
    expect(creature('summon-undead', 'ghostly', 3).speed).toEqual({
      walk: 30,
      fly: 40,
      hover: true,
    });
  });

  it('Summon Elemental: damage type, resistances and speeds by element', () => {
    const earth = creature('summon-elemental', 'earth', 5);
    expect(earth.hp).toBe(60);
    expect(earth.resistances).toEqual(['piercing', 'slashing']);
    expect(earth.immunities).toEqual(['poison']);
    expect(earth.speed).toEqual({ walk: 40, burrow: 40 });
    expect(feature(earth, 'Slam').description).toContain('Bludgeoning damage');
    expect(feature(earth, 'Slam').description).toContain('+7');
    expect(earth.traits).toEqual([]);
    const fire = creature('summon-elemental', 'fire', 4);
    expect(fire.immunities).toEqual(['fire', 'poison']);
    expect(feature(fire, 'Slam').description).toMatch(/\(1d10 \+ 8\) Fire damage/);
    expect(fire.traits.map((f) => f.name)).toEqual(['Amorphous Form']);
    const air = creature('summon-elemental', 'air', 4);
    expect(air.resistances).toEqual(['lightning', 'thunder']);
    expect(air.speed).toEqual({ walk: 40, fly: 40, hover: true });
  });

  it('Summon Celestial: Defender gets +2 AC; the 1/Day healing is a limited use', () => {
    const d = creature('summon-celestial', 'defender', 5);
    expect(d.ac).toBe(18);
    expect(d.hp).toBe(40);
    const heal = feature(d, 'Healing Touch');
    expect(heal.name).toBe('Healing Touch (1/Day)');
    expect(heal.description).toContain('2d8 + 5');
    expect(parseMonster(d).features.find((f) => f.name === 'Healing Touch')!.usage).toEqual({
      kind: 'perDay',
      count: 1,
      inLair: null,
    });
    expect(creature('summon-celestial', 'avenger', 5).ac).toBe(16);
  });

  it('Find Steed: type by variant, flight from a level 4 slot, 1/Day bonus actions', () => {
    const fiend = creature('find-steed', 'fiend', 4);
    expect(fiend.creatureType).toBe('fiend');
    expect(fiend.ac).toBe(14);
    expect(fiend.hp).toBe(45);
    expect(fiend.speed).toEqual({ walk: 60, fly: 60 });
    expect(fiend.size).toEqual(['Large']);
    expect(fiend.bonusActions.map((f) => f.name)).toEqual(['Fell Glare (1/Day)']);
    const fey = creature('find-steed', 'fey', 2);
    expect(fey.speed).toEqual({ walk: 60 });
    expect(fey.hp).toBe(25);
    expect(fey.bonusActions.map((f) => f.name)).toEqual(['Fey Step (1/Day)']);
    expect(feature(fey, 'Otherworldly Slam').description).toContain('Psychic damage');
    expect(
      feature(creature('find-steed', 'celestial', 2), 'Otherworldly Slam').description,
    ).toContain('Radiant damage');
  });

  it('Animated Objects: HP and size by the object', () => {
    const large = creature('animate-objects', 'large', 5);
    expect(large.hp).toBe(20);
    expect(large.size).toEqual(['Large']);
    expect(creature('animate-objects', 'huge', 5).hp).toBe(40);
  });

  it('Homunculus Servant and Battle Familiar', () => {
    const h = creature('homunculus-servant', 'homunculus-servant', 3);
    expect(h.hp).toBe(20);
    expect(h.ac).toBe(13);
    expect(h.reactions[0].name).toBe('Channel Magic');
    const b = creature('battle-familiar', 'brute', 4);
    expect(b.ac).toBe(17);
    expect(b.hp).toBe(40);
    expect(b.speed).toEqual({ walk: 40, swim: 30 });
    expect(creature('battle-familiar', 'flyer', 2).speed).toEqual({
      walk: 40,
      fly: 30,
      hover: true,
      swim: 30,
    });
  });

  it('Giant Insect, Summon Construct, Fiend, Plant, Dinosaur, Aberration, Dragon', () => {
    expect(creature('giant-insect', 'wasp', 4).speed).toEqual({ walk: 40, climb: 40, fly: 40 });
    expect(creature('giant-insect', 'spider', 5).actions.map((f) => f.name)).toContain('Web Bolt');
    expect(creature('summon-construct', 'clay', 4).reactions[0].name).toBe('Berserk Lashing');
    expect(creature('summon-construct', 'stone', 4).hp).toBe(40);
    expect(creature('summon-fiend', 'devil', 6).hp).toBe(40);
    expect(creature('summon-fiend', 'yugoloth', 7).hp).toBe(75);
    expect(creature('summon-plant', 'tree', 5).ac).toBe(18);
    expect(creature('summon-plant', 'vine', 5).speed).toEqual({ walk: 40, climb: 40 });
    expect(creature('summon-plant', 'fungus', 5).vulnerabilities).toEqual(['slashing']);
    const trex = creature('summon-dinosaur', 'tyrannosaur', 6);
    expect(trex.actions.map((f) => f.name)).toEqual(['Multiattack', 'Bite']);
    expect(trex.size).toEqual(['Huge']);
    expect(creature('summon-aberration', 'slaad', 4).traits.map((f) => f.name)).toEqual([
      'Regeneration',
    ]);
    const dragon = creature('summon-dragon', 'draconic-spirit', 5);
    expect(dragon.ac).toBe(19);
    expect(dragon.resistances).toEqual(['acid', 'cold', 'fire', 'lightning', 'poison']);
  });
});

describe('creatures from the compendium monsters', () => {
  it('Find Familiar offers the beasts of CR 0 and lets you pick the type', () => {
    const s = source('find-familiar');
    expect(s.coverage).toBe('monsters');
    expect(s.options.slice(0, 3).map((o) => o.monsterId)).toEqual(['bat', 'cat', 'frog']);
    expect(s.options.length).toBeGreaterThan(20);
    expect(s.options.every((o) => allMonsters.find((m) => m.id === o.monsterId)!.cr === 0)).toBe(
      true,
    );
    expect(s.typeChoices).toEqual(['celestial', 'fey', 'fiend']);
    const owl = s.options.find((o) => o.monsterId === 'owl')!;
    expect(resolveOption(s, owl, ctx(1), catalog, 'fey')!.monster.creatureType).toBe('fey');
    expect(resolveOption(s, owl, ctx(1), catalog)!.monster.creatureType).toBe('beast');
  });

  it('Animate Dead gives the Skeleton and the Zombie', () => {
    const s = source('animate-dead');
    expect(s.options.map((o) => o.monsterId)).toEqual(['skeleton', 'zombie']);
    const sk = resolveOption(s, s.options[0], ctx(3), catalog)!.monster;
    expect(sk.ac).toBe(14);
    expect(sk.actions.length).toBeGreaterThan(0);
  });

  it('other spells: Phantom Steed, Sticks to Snakes, Create Undead, Find Greater Steed', () => {
    const horse = source('phantom-steed');
    expect(resolveOption(horse, horse.options[0], ctx(3), catalog)!.monster.speed.walk).toBe(100);
    expect(source('sticks-to-snakes').options[0].monsterId).toBe('venomous-snake');
    expect(source('create-undead').options.map((o) => o.monsterId)).toEqual([
      'ghoul',
      'ghast',
      'wight',
      'mummy',
    ]);
    expect(source('find-greater-steed').options.map((o) => o.monsterId)).toContain('griffon');
  });
});

describe('what is a source and what is not', () => {
  it('lists the covered spells and the fallbacks', () => {
    const cover = (c: string) =>
      [...catalog.spells.values()]
        .filter((s) => s.coverage === c)
        .map((s) => s.ref.id)
        .sort();
    // the 2024 Conjure spells are areas and effects, not creatures; Spiritual Weapon is a weapon
    for (const id of [
      'conjure-animals',
      'conjure-woodland-beings',
      'conjure-fey',
      'conjure-elemental',
      'conjure-minor-elementals',
      'conjure-celestial',
      'spiritual-weapon',
    ]) {
      expect(catalog.spells.has(id)).toBe(false);
    }
    expect(cover('structured')).toEqual(
      expect.arrayContaining([
        'summon-beast',
        'summon-fey',
        'summon-undead',
        'summon-elemental',
        'summon-aberration',
        'summon-celestial',
        'summon-construct',
        'summon-dragon',
        'summon-fiend',
        'summon-plant',
        'summon-dinosaur',
        'giant-insect',
        'find-steed',
        'battle-familiar',
        'homunculus-servant',
        'animate-objects',
      ]),
    );
    expect(cover('monsters')).toEqual([
      'animate-dead',
      'create-undead',
      'danse-macabre',
      'find-familiar',
      'find-greater-steed',
      'phantom-steed',
      'sticks-to-snakes',
    ]);
    expect(cover('text')).toEqual(
      expect.arrayContaining(['infernal-calling', 'simulacrum', 'planar-ally']),
    );
    // eslint-disable-next-line no-console
    console.log('structured:', cover('structured').join(', '), '\ntext:', cover('text').join(', '));
  });

  it('every structured source resolves at every slot level of its range', () => {
    for (const s of catalog.spells.values()) {
      if (s.coverage !== 'structured') continue;
      for (let lvl = s.minSlot; lvl <= 9; lvl++) {
        for (const o of s.options) {
          const r = resolveOption(s, o, ctx(lvl), catalog)!;
          expect(r.unresolved, `${s.id} ${o.key} ${lvl}`).toEqual([]);
          expect(r.monster.hp).toBeGreaterThan(0);
          expect(r.monster.ac).toBeGreaterThan(8);
          expect(JSON.stringify({ ...r.monster, hitDice: '' }), `${s.id} ${o.key}`).not.toMatch(
            /spell'?s? level|spell attack modifier|spell save DC/i,
          );
        }
      }
    }
  });
});

describe('characters', () => {
  function character(
    classId: string,
    level: number,
    subclassId: string | null,
    spellIds: string[],
    over: Partial<Character['choices']> = {},
  ): Character {
    const c = newCharacter('Test', 'test');
    c.classes = [{ id: classId, level, subclassId, hp: [] }];
    c.abilityScores = {
      method: 'manual',
      base: { STR: 10, DEX: 12, CON: 14, INT: 14, WIS: 16, CHA: 10 },
    };
    c.choices.spells = spellIds;
    c.choices = { ...c.choices, ...over };
    return c;
  }
  const sourcesOf = (c: Character) => {
    const sheet = computeSheet(c, rules);
    return {
      sheet,
      sources: summonSourcesOf(c, sheet, rules.subclasses as never, catalog),
    };
  };

  it('a Druid with Summon Beast, Conjure Animals and Find Familiar', () => {
    const { sources } = sourcesOf(
      character('druid', 5, null, [
        'summon-beast',
        'conjure-animals',
        'find-familiar',
        'cure-wounds',
      ]),
    );
    expect(sources.map((s) => s.id)).toEqual([
      'spell:find-familiar',
      'spell:summon-beast',
      'feature:class:druid:Wild Companion',
    ]);
    const wild = sources[2];
    expect(wild.fixedType).toBe('fey');
    expect(wild.coverage).toBe('monsters');
  });

  it('a Wizard with Find Familiar and Animate Dead', () => {
    const { sources } = sourcesOf(
      character('wizard', 5, null, ['find-familiar', 'animate-dead', 'fireball']),
    );
    expect(sources.map((s) => s.id)).toEqual(['spell:find-familiar', 'spell:animate-dead']);
  });

  it('a Ranger Beast Master has the three beasts; a Fighter has nothing', () => {
    const c = character('ranger', 5, 'ranger/beast-master', []);
    const { sheet, sources } = sourcesOf(c);
    const prim = sources.find((s) => s.name === 'Primal Companion')!;
    expect(prim.kind).toBe('feature');
    expect(prim.options.map((o) => o.name)).toEqual([
      'Beast of the Land',
      'Beast of the Sky',
      'Beast of the Sea',
    ]);
    const land = resolveOption(prim, prim.options[0], contextFor(prim, sheet, 0), catalog)!;
    expect(land.unresolved).toEqual([]);
    expect(land.monster.hp).toBe(30);
    // 13 + the Wisdom modifier of this character (16 → +3)
    expect(land.monster.ac).toBe(16);
    expect(feature(land.monster, "Beast's Strike").description).toMatch(
      /Melee Attack Roll: \+\d+, reach 5 ft\./,
    );
    expect(sourcesOf(character('fighter', 5, null, [])).sources).toEqual([]);
  });

  it('a Paladin with Find Steed gets the caster numbers from the sheet', () => {
    const c = character('paladin', 5, null, ['find-steed']);
    const { sheet, sources } = sourcesOf(c);
    const steed = sources[0];
    expect(maxSlotOf(steed, sheet)).toBe(2);
    expect(slotLevelOf(steed, sheet, 4)).toBe(2);
    expect(slotLevelOf(steed, sheet, undefined)).toBe(2);
    const x = contextFor(steed, sheet, 2);
    const sc = sheet.spellcasting.classes[0];
    expect(x.spellAttack).toBe(sc.attack);
    expect(x.spellDc).toBe(sc.saveDc);
    expect(x.pb).toBe(3);
  });

  it('the Artificer Battle Smith (UA) has a Steel Defender; subclass spells count', () => {
    const c = character('artificer', 5, 'artificer/battle-smith-ua', []);
    const { sheet, sources } = sourcesOf(c);
    const steel = sources.find((s) => s.name === 'Steel Defender');
    expect(steel).toBeTruthy();
    const r = resolveOption(steel!, steel!.options[0], contextFor(steel!, sheet, 0), catalog)!;
    expect(r.unresolved).toEqual([]);
    expect(r.monster.hp).toBe(30);
    expect(r.monster.ac).toBe(15);
    expect(feature(r.monster, 'Repair').name).toBe('Repair (3/Day)');
    expect(feature(r.monster, 'Force-Empowered Rend').description).toMatch(/\+\d+, reach 5 ft/);
    const genies = sourcesOf(
      character('paladin', 13, 'paladin/oath-of-the-noble-genies', []),
    ).sources.map((s) => s.id);
    expect(genies).toContain('spell:summon-elemental');
  });

  it('Pact of the Chain and the Familiar Friend feat give the familiar', () => {
    const chain = sourcesOf(
      character('warlock', 3, null, [], { options: ['eldritch-invocation/pact-of-the-chain'] }),
    ).sources;
    expect(chain[0].id).toBe('option:pact-of-the-chain');
    expect(chain[0].options.map((o) => o.monsterId)).toEqual(
      expect.arrayContaining(['imp', 'pseudodragon', 'quasit', 'sprite', 'bat']),
    );
    const feat = sourcesOf(
      character('fighter', 4, null, [], { feats: ['familiar-friend'] }),
    ).sources;
    expect(feat.map((s) => s.id)).toEqual(['spell:find-familiar']);
  });
});

describe('persistence', () => {
  const key = creatureKey('spell:summon-beast', 'land');

  it('marks creatures, keeps damage and resets a fresh summon', () => {
    let s = setSummoned(undefined, key, true);
    expect(creatureOf(s, key)).toEqual({ on: true, damage: 0, temp: 0, used: {} });
    const m = creature('summon-beast', 'land', 3);
    s = updateCreature(s, key, m, (c) => setTemp(applyDamage(c, 12), 5));
    expect(creatureOf(s, key)).toMatchObject({ damage: 12, temp: 5 });
    expect(toCombatMonster(key, m, creatureOf(s, key))).toMatchObject({
      hp: 23,
      hpMax: 35,
      temp: 5,
    });
    // a bigger slot: same damage, higher maximum
    const m5 = creature('summon-beast', 'land', 5);
    expect(toCombatMonster(key, m5, creatureOf(s, key)).hp).toBe(m5.hp - 12);
    s = setSummoned(s, key, false);
    expect(creatureOf(s, key)).toMatchObject({ on: false, damage: 12 });
    s = setSummoned(s, key, true);
    expect(creatureOf(s, key)).toEqual({ on: true, damage: 0, temp: 0, used: {} });
    expect(summonedCount(s)).toBe(1);
    expect(summonedCount(dismissAll(setScale(s, 'spell:summon-beast', 4)))).toBe(0);
    expect(dismissAll(setScale(s, 'spell:summon-beast', 4)).scale).toEqual({
      'spell:summon-beast': 4,
    });
    expect(resetSummons(setScale(s, 'spell:summon-beast', 4)).scale).toEqual({});
  });

  it('normalises anything that was saved', () => {
    expect(normalizeSummons(undefined)).toBeUndefined();
    expect(normalizeSummons('x')).toBeUndefined();
    expect(
      normalizeSummons({
        hideInactive: 1,
        scale: { a: 3, b: 'x', c: 12 },
        types: { a: 'fey', b: 4 },
        creatures: { k: { on: true, damage: -3, temp: 2.7, used: { u: 1, v: 'x' } }, bad: 5 },
      }),
    ).toEqual({
      hideInactive: false,
      scale: { a: 3 },
      types: { a: 'fey' },
      creatures: { k: { on: true, damage: 0, temp: 2, used: { u: 1 } } },
    });
  });

  it('old characters load without summons, and new ones keep them through normalizeCharacter', () => {
    const old = newCharacter('Old', 'x');
    const loaded = normalizeCharacter(JSON.parse(JSON.stringify(old)))!;
    expect(loaded.state.summons).toBeUndefined();
    expect('summons' in loaded.state).toBe(false);
    const withSummons = {
      ...old,
      state: { ...old.state, summons: setSummoned(undefined, 'k', true) },
    };
    const round = normalizeCharacter(JSON.parse(JSON.stringify(withSummons)))!;
    expect(round.state.summons).toEqual(withSummons.state.summons);
    expect(
      normalizeCharacter({ ...old, state: { ...old.state, summons: 'broken' } })!.state.summons,
    ).toBeUndefined();
    expect(emptySummons()).toEqual({ hideInactive: false, scale: {}, types: {}, creatures: {} });
  });
});
