import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import species from '../../../../../data/species.json';
import { review, speciesFeatKind, featsForSpecies, SPECIES_SLOT } from '../creation/creation-rules';
import { withFeatChoice, withSlotFeat } from '../creation/level-up';
import { Character, FeatChoice, newCharacter } from '../models/character';
import { Background, DndClass, Feat, Item, Species } from '../models/compendium';
import { longRest, playResources, setResourceUsed, shortRest } from '../play/play-state';
import { RulesData, computeSheet } from './engine';

const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

const DATA: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: new Map(),
  species: map<Species>(species),
  backgrounds: map<Background>(backgrounds),
  feats: map<Feat>(feats),
  items: map<Item>(items),
};

const SCORES = { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 };

/** A level `level` Fighter (no spells of its own) with the given background and choices. */
function fighter(
  background: string,
  over: { level?: number; choices?: Partial<Character['choices']> } = {},
): Character {
  const c = newCharacter('Test', 'test');
  return {
    ...c,
    classes: [{ id: 'fighter', level: over.level ?? 1, subclassId: null, hp: [] }],
    species: { id: 'halfling', variant: null },
    background: { id: background, abilityIncreases: {} },
    abilityScores: { method: 'standard', base: SCORES },
    choices: { ...c.choices, ...over.choices },
  };
}

const withChoice = (key: string, choice: FeatChoice) => ({ featChoices: { [key]: choice } });

describe('feats that give spells (the reported bug: Familiar Friend)', () => {
  it('a Fighter whose background gives Familiar Friend has Find Familiar on the sheet', () => {
    const sheet = computeSheet(
      fighter('familiar-trainer', { choices: withChoice('background', { ability: 'WIS' }) }),
      DATA,
    );
    expect(sheet.featSpells).toEqual([
      expect.objectContaining({
        id: 'find-familiar',
        name: 'Find Familiar',
        feat: { id: 'familiar-friend', name: 'Familiar Friend' },
        sourceKey: 'background',
        ability: 'WIS',
        abilityChosen: true,
        // 8 + proficiency bonus 2 + WIS 1
        saveDc: 11,
        attack: 3,
        slots: true,
        freeKey: 'feat:background:find-familiar',
      }),
    ]);
    expect(sheet.featMissing).toEqual([]);
  });

  it('counts the free cast (once per Long Rest) and Helpful Friend (PB per Long Rest)', () => {
    const sheet = computeSheet(
      fighter('familiar-trainer', {
        level: 5,
        choices: withChoice('background', { ability: 'CHA' }),
      }),
      DATA,
    );
    expect(sheet.featUses).toEqual([
      expect.objectContaining({
        key: 'feat:background:find-familiar',
        kind: 'spell',
        max: 1,
        rest: 'long',
      }),
      expect.objectContaining({
        key: 'feat:background:helpful-friend',
        kind: 'use',
        max: 3,
        rest: 'long',
      }),
    ]);
    const resources = playResources(sheet).filter((r) => r.feat);
    expect(resources.map((r) => [r.key, r.max, r.short, r.feat])).toEqual([
      ['feat:background:find-familiar', 1, 0, 'Familiar Friend'],
      ['feat:background:helpful-friend', 3, 0, 'Familiar Friend'],
    ]);
    // spending the free cast, a Short Rest doesn't bring it back, a Long Rest does
    const spent = setResourceUsed(fighter('x').state, 'feat:background:find-familiar', 1, 1);
    expect(shortRest(spent, resources).resources['feat:background:find-familiar']).toBe(1);
    expect(longRest(spent).resources).toEqual({});
  });

  it('without the ability chosen it still lists the spell and says what is missing', () => {
    const sheet = computeSheet(fighter('familiar-trainer'), DATA);
    expect(sheet.featSpells[0]).toMatchObject({ id: 'find-familiar', abilityChosen: false });
    expect(sheet.featMissing).toEqual([
      { feat: 'Familiar Friend', key: 'background', what: 'ability' },
    ]);
  });

  it('review() asks for it in the background step', () => {
    const ch = fighter('familiar-trainer');
    const sheet = computeSheet(ch, DATA);
    const notes = review(ch, {
      classes: [DATA.classes.get('fighter')],
      background: DATA.backgrounds.get('familiar-trainer'),
      species: DATA.species.get('dwarf'),
      sheet,
      feats: DATA.feats,
      spells: new Map(),
    });
    expect(notes.background.map((n) => n.key)).toContain('create.missing.feat.ability');
  });

  it('a spell that comes at character level 3 is not there before', () => {
    const c = (level: number) =>
      computeSheet(
        fighter('x', {
          level,
          choices: {
            ...newCharacter('x', 'x').choices,
            featSlots: [{ slot: 'fighter:4', featId: 'atmokinesis-ua' }],
            ...withChoice('fighter:4', { ability: 'INT' }),
          },
        }),
        DATA,
      ).featSpells.map((s) => s.id);
    expect(c(2)).toEqual(['shocking-grasp', 'fog-cloud']);
    expect(c(3)).toEqual(['shocking-grasp', 'fog-cloud', 'gust-of-wind']);
  });

  it('a feat that raised the casting ability uses that one', () => {
    const ch = fighter('x', {
      choices: {
        ...newCharacter('x', 'x').choices,
        featSlots: [{ slot: 'fighter:4', featId: 'telepathic' }],
        abilityIncreases: [{ source: 'telepathic', ability: 'WIS', amount: 1, slot: 'fighter:4' }],
      },
    });
    expect(computeSheet(ch, DATA).featSpells[0]).toMatchObject({
      id: 'detect-thoughts',
      ability: 'WIS',
      abilityChosen: true,
    });
  });
});

describe('Magic Initiate', () => {
  const picks: FeatChoice = {
    ability: 'WIS',
    cantrips: ['guidance', 'sacred-flame'],
    spell: 'bless',
  };

  it('Acolyte: the Cleric list is fixed by the background; picks become spells', () => {
    const sheet = computeSheet(
      fighter('acolyte', { choices: withChoice('background', { ...picks }) }),
      DATA,
    );
    expect(sheet.featSpells.map((s) => [s.id, s.cantrip, s.freeKey])).toEqual([
      ['guidance', true, null],
      ['sacred-flame', true, null],
      ['bless', false, 'feat:background:bless'],
    ]);
    expect(sheet.featMissing).toEqual([]);
    expect(sheet.features.map((f) => f.name)).toContain('Magic Initiate (Cleric)');
  });

  it('lists what is still missing', () => {
    const sheet = computeSheet(
      fighter('acolyte', { choices: withChoice('background', { cantrips: ['guidance'] }) }),
      DATA,
    );
    expect(sheet.featMissing.map((m) => m.what).sort()).toEqual(['ability', 'cantrips', 'spell']);
  });

  it('can be taken twice (background and a feat slot) with different lists', () => {
    const sheet = computeSheet(
      fighter('acolyte', {
        level: 4,
        choices: {
          ...newCharacter('x', 'x').choices,
          featSlots: [{ slot: 'fighter:4', featId: 'magic-initiate' }],
          featChoices: {
            background: { ...picks },
            'fighter:4': {
              ability: 'INT',
              list: 'wizard',
              cantrips: ['mage-hand', 'light'],
              spell: 'shield',
            },
          },
        },
      }),
      DATA,
    );
    expect(sheet.featSpells.length).toBe(6);
    expect(sheet.featUses.map((u) => u.key)).toEqual([
      'feat:background:bless',
      'feat:fighter:4:shield',
    ]);
    expect(sheet.features.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Magic Initiate (Cleric)', 'Magic Initiate (Wizard)']),
    );
  });
});

describe('feats that give proficiencies, uses and bonuses', () => {
  it('Skilled: 3 skills or tools', () => {
    const sheet = computeSheet(
      fighter('charlatan', {
        choices: withChoice('background', {
          skills: ['arcana', 'stealth'],
          tools: ["Thieves' Tools"],
        }),
      }),
      DATA,
    );
    expect(sheet.skills.find((s) => s.id === 'arcana')?.proficiency).toBe('full');
    expect(sheet.skills.find((s) => s.id === 'stealth')?.proficiency).toBe('full');
    expect(sheet.proficiencies.tools).toContain("Thieves' Tools");
    expect(sheet.featMissing).toEqual([]);
    expect(computeSheet(fighter('charlatan'), DATA).featMissing.map((m) => m.what)).toEqual([
      'proficiencies',
    ]);
  });

  it('Crafter and Musician: tools; Musician needs three instruments', () => {
    const crafter = computeSheet(
      fighter('mythalkeeper', {
        choices: withChoice('background', {
          tools: ["Mason's Tools", "Potter's Tools", "Tinker's Tools"],
        }),
      }),
      DATA,
    );
    expect(crafter.proficiencies.tools).toEqual(
      expect.arrayContaining(["Mason's Tools", "Potter's Tools", "Tinker's Tools"]),
    );
    const musician = computeSheet(
      fighter('entertainer', { choices: withChoice('background', { tools: ['Lute', 'Flute'] }) }),
      DATA,
    );
    expect(musician.proficiencies.tools).toEqual(expect.arrayContaining(['Lute', 'Flute']));
    expect(musician.featMissing).toEqual([
      { feat: 'Musician', key: 'background', what: 'proficiencies' },
    ]);
  });

  it('Lucky: Luck Points equal to the proficiency bonus, named for the sheet', () => {
    const feat = { slot: 'fighter:4', featId: 'lucky' };
    const at = (level: number) =>
      computeSheet(
        fighter('x', { level, choices: { ...newCharacter('x', 'x').choices, featSlots: [feat] } }),
        DATA,
      ).featUses;
    expect(at(1)).toEqual([expect.objectContaining({ max: 2, labelKey: 'play.res.luckPoints' })]);
    expect(at(9)[0].max).toBe(4);
    expect(at(17)[0].max).toBe(6);
  });

  it('Tough: twice the level; Alert: initiative + PB; Transmuted Anatomy: +5 Speed', () => {
    const plain = computeSheet(fighter('soldier', { level: 6 }), DATA);
    const tough = computeSheet(fighter('x', { level: 6 }), DATA);
    expect(tough.hitPoints.max).toBe(plain.hitPoints.max); // neither has it
    const t = computeSheet(
      fighter('x', {
        level: 6,
        choices: {
          ...newCharacter('x', 'x').choices,
          featSlots: [{ slot: 'fighter:4', featId: 'tough' }],
        },
      }),
      DATA,
    );
    expect(t.hitPoints.max).toBe(plain.hitPoints.max + 12);
    const alert = computeSheet(
      fighter('x', {
        level: 5,
        choices: {
          ...newCharacter('x', 'x').choices,
          featSlots: [{ slot: 'fighter:4', featId: 'alert' }],
        },
      }),
      DATA,
    );
    expect(alert.initiative).toBe(2 + 3);
    const ta = computeSheet(
      fighter('x', {
        choices: {
          ...newCharacter('x', 'x').choices,
          featSlots: [{ slot: 'fighter:4', featId: 'transmuted-anatomy' }],
        },
      }),
      DATA,
    );
    expect(ta.speed['walk']).toBe(35);
  });

  it('Tavern Brawler, Harper Agent, Cult of the Dragon Initiate, Purple Dragon Rook, Portal Jumper', () => {
    const tb = computeSheet(fighter('sailor'), DATA);
    expect(tb.featMissing).toEqual([]);
    const slot = (featId: string, choice: FeatChoice = {}, level = 1) =>
      computeSheet(
        fighter('x', {
          level,
          choices: {
            ...newCharacter('x', 'x').choices,
            featSlots: [{ slot: 'fighter:4', featId }],
            ...withChoice('fighter:4', choice),
          },
        }),
        DATA,
      );
    expect(slot('tavern-brawler').proficiencies.weapons).toContain('Improvised weapons');
    const harper = slot('harper-agent', { tools: ['Lute'] });
    expect(harper.languages).toContain("Thieves' Cant");
    expect(harper.proficiencies.tools).toContain('Lute');
    // Draconic, or the language picked when it is already known
    expect(slot('cult-of-the-dragon-initiate').languages).toContain('Draconic');
    const known = computeSheet(
      {
        ...fighter('x', {
          choices: {
            ...newCharacter('x', 'x').choices,
            languages: ['Draconic', 'Elvish'],
            featSlots: [{ slot: 'fighter:4', featId: 'cult-of-the-dragon-initiate' }],
            ...withChoice('fighter:4', { languages: ['Sylvan'] }),
          },
        }),
      },
      DATA,
    );
    expect(known.languages).toEqual(expect.arrayContaining(['Draconic', 'Elvish', 'Sylvan']));
    expect(
      slot('purple-dragon-rook', { skills: ['insight'] }).skills.find((s) => s.id === 'insight')
        ?.proficiency,
    ).toBe('full');
    expect(slot('portal-jumper', { resistance: 'Psychic' }).resistances).toEqual(['Psychic']);
  });

  it('Resilient gives the saving throw of the ability it raised; Defense +1 AC in armor', () => {
    const resilient = computeSheet(
      fighter('x', {
        choices: {
          ...newCharacter('x', 'x').choices,
          featSlots: [{ slot: 'fighter:4', featId: 'resilient' }],
          abilityIncreases: [{ source: 'resilient', ability: 'WIS', amount: 1, slot: 'fighter:4' }],
        },
      }),
      DATA,
    );
    expect(resilient.savingThrows.WIS.proficient).toBe(true);
    expect(resilient.savingThrows.DEX.proficient).toBe(false);
    const withArmor = (defense: boolean) =>
      computeSheet(
        {
          ...fighter('x', {
            choices: {
              ...newCharacter('x', 'x').choices,
              featSlots: defense ? [{ slot: 'fighter:1', featId: 'defense' }] : [],
            },
          }),
          equipped: { armorId: 'chain-mail', shield: false },
          inventory: [{ id: 'chain-mail', itemId: 'chain-mail', name: '', qty: 1, equipped: true }],
        },
        DATA,
      ).armorClass.value;
    expect(withArmor(true)).toBe(withArmor(false) + 1);
  });
});

describe('the species feat (Human Versatile) and the choices of a feat in a slot', () => {
  it('Human offers an origin feat, Custom Lineage any feat; others none', () => {
    expect(speciesFeatKind(DATA.species.get('human'))).toBe('origin');
    expect(speciesFeatKind(DATA.species.get('custom-lineage'))).toBe('any');
    expect(speciesFeatKind(DATA.species.get('dwarf'))).toBeNull();
    const origin = featsForSpecies('origin', [...DATA.feats.values()]);
    expect(origin.length).toBeGreaterThan(20);
    expect(origin.every((f) => f.category === 'origin')).toBe(true);
    expect(featsForSpecies('any', [...DATA.feats.values()]).length).toBeGreaterThan(origin.length);
    expect(featsForSpecies(null, [...DATA.feats.values()])).toEqual([]);
  });

  it('the species slot gives its feat to the sheet, with its choices', () => {
    const ch = {
      ...fighter('soldier', {
        choices: {
          ...newCharacter('x', 'x').choices,
          featSlots: [{ slot: SPECIES_SLOT, featId: 'familiar-friend' }],
          ...withChoice(SPECIES_SLOT, { ability: 'INT' }),
        },
      }),
      species: { id: 'human', variant: null },
    };
    const sheet = computeSheet(ch, DATA);
    expect(sheet.featSpells[0]).toMatchObject({ id: 'find-familiar', sourceKey: 'species' });
    // review asks for the feat when the species gives one and none is chosen
    const none = { ...ch, choices: { ...ch.choices, featSlots: [] } };
    const notes = review(none, {
      classes: [DATA.classes.get('fighter')],
      species: DATA.species.get('human'),
      sheet: computeSheet(none, DATA),
      feats: DATA.feats,
      spells: new Map(),
    });
    expect(notes.species.map((n) => n.key)).toContain('create.missing.speciesFeat');
  });

  it('changing the feat of a slot drops what the old one asked', () => {
    let ch = fighter('x', {
      choices: {
        ...newCharacter('x', 'x').choices,
        featSlots: [{ slot: 'fighter:4', featId: 'familiar-friend' }],
      },
    });
    ch = withFeatChoice(ch, 'fighter:4', { ability: 'INT' });
    ch = withFeatChoice(ch, 'background', { ability: 'WIS' });
    expect(ch.choices.featChoices?.['fighter:4']).toEqual({ ability: 'INT' });
    ch = withSlotFeat(ch, 'fighter:4', 'lucky');
    expect(ch.choices.featChoices).toEqual({ background: { ability: 'WIS' } });
  });
});
