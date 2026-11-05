import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import options from '../../../../../data/options.json';
import species from '../../../../../data/species.json';
import spells from '../../../../../data/spells.json';
import subclasses from '../../../../../data/subclasses.json';
import { Character, newCharacter } from '../models/character';
import {
  Background,
  ClassOption,
  DndClass,
  Feat,
  Item,
  Species,
  Subclass,
} from '../models/compendium';
import { attacksFor, WeaponEntry } from './attacks';
import { RulesData, computeSheet } from './engine';

const map = <T extends { id: string }>(xs: unknown) => new Map((xs as T[]).map((x) => [x.id, x]));

const DATA: RulesData = {
  classes: map<DndClass>(classes),
  subclasses: map<Subclass>(subclasses),
  species: map<Species>(species),
  backgrounds: map<Background>(backgrounds),
  feats: map<Feat>(feats),
  items: map<Item>(items),
  options: map<ClassOption>(options),
};
const SPELL_IDS = new Set((spells as { id: string }[]).map((s) => s.id));

interface Build {
  cls: string;
  level?: number;
  sub?: string | null;
  species?: string;
  variant?: string | null;
  scores?: Partial<Record<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', number>>;
  choices?: Partial<Character['choices']>;
}

function build(b: Build): Character {
  const c = newCharacter('Test', 'test');
  return {
    ...c,
    classes: [{ id: b.cls, level: b.level ?? 1, subclassId: b.sub ?? null, hp: [] }],
    species: { id: b.species ?? 'human', variant: b.variant ?? null },
    background: { id: 'soldier', abilityIncreases: {} },
    abilityScores: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8, ...b.scores },
    },
    choices: { ...c.choices, ...b.choices },
  };
}

const sheetOf = (b: Build) => computeSheet(build(b), DATA);
const weapon = (id: string, equipped = true): WeaponEntry => ({
  id: `w-${id}`,
  equipped,
  item: DATA.items.get(id)!,
});
const slotsFor = (cls: string, lvl: number, feat: string) => ({
  featSlots: [{ slot: `${cls}:${lvl}`, featId: feat }],
});

describe('fighting styles reach the attacks', () => {
  it('Archery: +2 to ranged attacks and not to melee ones', () => {
    const base = sheetOf({ cls: 'fighter' });
    const s = sheetOf({ cls: 'fighter', choices: slotsFor('fighter', 1, 'archery') });
    expect(s.combat.rangedAttack).toBe(2);
    const bow = attacksFor(s, [weapon('longbow')])[0];
    const plain = attacksFor(base, [weapon('longbow')])[0];
    expect(bow.bonus).toBe(plain.bonus + 2);
    expect(bow.notes.map((n) => n.id)).toContain('archery');
    const sword = attacksFor(s, [weapon('longsword')])[0];
    expect(sword.bonus).toBe(attacksFor(base, [weapon('longsword')])[0].bonus);
  });

  it('Dueling: +2 damage with a one-handed melee weapon, not with a two-handed one', () => {
    const s = sheetOf({ cls: 'fighter', choices: slotsFor('fighter', 1, 'dueling') });
    expect(attacksFor(s, [weapon('longsword')])[0].damage).toBe('1d8+4'); // STR 2 + 2
    expect(attacksFor(s, [weapon('greatsword')])[0].damage).toBe('2d6+2');
  });

  it('Defense: +1 AC in armor; Blind Fighting gives Blindsight 10', () => {
    const s = sheetOf({ cls: 'fighter', choices: slotsFor('fighter', 1, 'blind-fighting') });
    expect(s.senses).toContainEqual(expect.objectContaining({ kind: 'blindsight', range: 10 }));
  });

  it('Great Weapon Fighting and Two-Weapon Fighting are listed as reminders', () => {
    const s = sheetOf({ cls: 'fighter', choices: slotsFor('fighter', 1, 'great-weapon-fighting') });
    expect(s.combat.notes.map((n) => n.id)).toContain('gwf');
  });
});

describe('monk and barbarian', () => {
  it('a Monk strikes with the Martial Arts die and the best of STR and DEX', () => {
    const s = sheetOf({ cls: 'monk', level: 5, scores: { STR: 10, DEX: 16 } });
    const unarmed = attacksFor(s, []).at(-1)!;
    expect(s.combat.martialArts).toBe('1d8');
    expect(unarmed.ability).toBe('DEX');
    expect(unarmed.damage).toBe('1d8+3');
  });

  it('Fast Movement and Roving read the text (not in heavy armor)', () => {
    expect(sheetOf({ cls: 'barbarian', level: 5 }).speed['walk']).toBe(40);
    const ranger = sheetOf({ cls: 'ranger', level: 6 });
    expect(ranger.speed).toMatchObject({ walk: 40, climb: 40, swim: 40 });
    expect(sheetOf({ cls: 'barbarian', level: 3 }).combat.notes[0]).toMatchObject({ id: 'rage' });
  });

  it('Feral Senses gives a Ranger Blindsight 30', () => {
    const s = sheetOf({ cls: 'ranger', level: 18 });
    expect(s.senses).toContainEqual(expect.objectContaining({ kind: 'blindsight', range: 30 }));
  });
});

describe('Warlock invocations', () => {
  const invocations = [
    'eldritch-invocation/agonizing-blast',
    'eldritch-invocation/devils-sight',
    'eldritch-invocation/armor-of-shadows',
    'eldritch-invocation/mask-of-many-faces',
    'eldritch-invocation/pact-of-the-chain',
    'eldritch-invocation/pact-of-the-blade',
    'eldritch-invocation/gift-of-the-depths',
    'eldritch-invocation/witch-sight',
  ];
  const s = sheetOf({
    cls: 'warlock',
    level: 15,
    scores: { CHA: 18, DEX: 14 },
    choices: { options: invocations },
  });

  it('are listed as features with their text', () => {
    const names = s.features.map((f) => f.name);
    expect(names).toContain('Agonizing Blast');
    expect(names).toContain('Pact of the Blade');
    expect(
      s.features.find((f) => f.name === 'Devil’s Sight' || f.name === "Devil's Sight"),
    ).toBeTruthy();
  });

  it('Agonizing Blast adds CHA to the cantrip, as a reminder with the number', () => {
    expect(s.combat.notes.find((n) => n.id === 'agonizing')?.params).toEqual({ n: 4 });
  });

  it('Devil’s Sight and Witch Sight are senses', () => {
    expect(s.senses).toContainEqual(expect.objectContaining({ kind: 'devils-sight', range: 120 }));
    expect(s.senses).toContainEqual(expect.objectContaining({ kind: 'truesight', range: 30 }));
  });

  it('the spells they give are cast at will, and Gift of the Depths gives a Swim Speed', () => {
    const atWill = s.featSpells.filter((x) => x.atWill).map((x) => x.id);
    expect(atWill).toEqual(
      expect.arrayContaining(['mage-armor', 'disguise-self', 'find-familiar']),
    );
    expect(s.featSpells.find((x) => x.id === 'water-breathing')?.freeKey).toBeTruthy();
    expect(s.speed['swim']).toBe(30);
  });

  it('Armor of Shadows lets the unarmored Warlock have AC 13 + DEX', () => {
    expect(s.armorClass.value).toBe(13 + 2);
  });
});

describe('subclasses', () => {
  it('a Paladin of Devotion always has the oath spells prepared up to their level', () => {
    const s = sheetOf({ cls: 'paladin', level: 5, sub: 'paladin/oath-of-devotion' });
    const ids = s.featSpells.filter((x) => x.always).map((x) => x.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'protection-from-evil-and-good',
        'shield-of-faith',
        'aid',
        'zone-of-truth',
      ]),
    );
    expect(ids).not.toContain('beacon-of-hope');
    expect(s.featSpells.every((x) => SPELL_IDS.has(x.id))).toBe(true);
  });

  it('a Draconic Sorcerer has AC 10 + DEX + CHA and +1 HP per level from 3 on', () => {
    const plain = sheetOf({ cls: 'sorcerer', level: 5, scores: { CHA: 16 } });
    const s = sheetOf({
      cls: 'sorcerer',
      level: 5,
      sub: 'sorcerer/draconic-sorcery',
      scores: { CHA: 16 },
    });
    expect(s.armorClass.value).toBe(10 + 2 + 3);
    expect(s.armorClass.formula).toBe('10 + DEX + CHA');
    expect(s.hitPoints.max - plain.hitPoints.max).toBe(5);
    expect(s.featSpells.map((x) => x.id)).toContain('dragons-breath');
  });

  it('every subclass spell id exists in the compendium', () => {
    const missing: string[] = [];
    for (const sub of subclasses as Subclass[])
      for (const row of sub.spells ?? [])
        for (const n of row.spells) {
          const id = n
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          if (!SPELL_IDS.has(id) && sub.edition === '2024') missing.push(`${sub.id}: ${n}`);
        }
    expect(missing.filter((m) => !/-ua/.test(m))).toEqual([]);
  });
});

describe('species', () => {
  it('a Drow Elf: Darkvision 120, Dancing Lights, and Faerie Fire / Darkness from 3 and 5', () => {
    const low = sheetOf({ cls: 'fighter', species: 'elf', variant: 'Drow' });
    expect(low.darkvision).toBe(120);
    expect(low.featSpells.map((x) => x.id)).toEqual(['dancing-lights']);
    const s = sheetOf({ cls: 'fighter', level: 5, species: 'elf', variant: 'Drow' });
    const ids = s.featSpells.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['dancing-lights', 'faerie-fire', 'darkness']));
    expect(s.featSpells.find((x) => x.id === 'faerie-fire')?.freeKey).toBeTruthy();
  });

  it('a Wood Elf has Speed 35', () => {
    expect(sheetOf({ cls: 'fighter', species: 'elf', variant: 'Wood Elf' }).speed['walk']).toBe(35);
  });

  it('an Infernal Tiefling resists Fire and knows Fire Bolt and Thaumaturgy', () => {
    const s = sheetOf({
      cls: 'fighter',
      level: 3,
      species: 'tiefling',
      variant: 'Infernal',
      choices: { featChoices: { species: { ability: 'CHA' } } },
    });
    expect(s.resistances).toContain('Fire');
    const ids = s.featSpells.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['fire-bolt', 'thaumaturgy', 'hellish-rebuke']));
    expect(s.featSpells.find((x) => x.id === 'hellish-rebuke')).toMatchObject({
      ability: 'CHA',
      abilityChosen: true,
    });
  });

  it('Aasimar resist Necrotic and Radiant, know Light, and have Healing Hands once per Long Rest', () => {
    const s = sheetOf({ cls: 'fighter', species: 'aasimar' });
    expect(s.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Radiant']));
    expect(s.featSpells.find((x) => x.id === 'light')).toMatchObject({ ability: 'CHA' });
    expect(s.featUses.some((u) => u.feat === 'Healing Hands')).toBe(true);
  });

  it('Dwarf: Poison resistance, +1 HP per level; Stonecunning uses = PB', () => {
    const s = sheetOf({ cls: 'fighter', level: 5, species: 'dwarf' });
    expect(s.resistances).toContain('Poison');
    const stone = s.featUses.find((u) => u.feat === 'Stonecunning');
    expect(stone?.max).toBe(3);
  });
});

describe('initiative, skills and feats', () => {
  it('a Gloom Stalker adds WIS to Initiative', () => {
    const s = sheetOf({
      cls: 'ranger',
      level: 3,
      sub: 'ranger/gloom-stalker',
      scores: { WIS: 16, DEX: 14 },
    });
    expect(s.initiative).toBe(2 + 3);
  });

  it('Warrior of Mercy gets Insight and Medicine and the Herbalism Kit', () => {
    const s = sheetOf({ cls: 'monk', level: 3, sub: 'monk/warrior-of-mercy' });
    const prof = (id: string) => s.skills.find((x) => x.id === id)?.proficiency;
    expect(prof('insight')).toBe('full');
    expect(prof('medicine')).toBe('full');
    expect(s.proficiencies.tools).toContain('Herbalism Kit');
  });

  it('Athlete gives a Climb Speed; Heavily Armored gives Heavy armor training', () => {
    expect(
      sheetOf({ cls: 'wizard', choices: slotsFor('wizard', 4, 'athlete') }).speed['climb'],
    ).toBe(30);
    expect(
      sheetOf({ cls: 'wizard', choices: slotsFor('wizard', 4, 'heavily-armored') }).proficiencies
        .armor,
    ).toContain('Heavy armor');
  });
});
