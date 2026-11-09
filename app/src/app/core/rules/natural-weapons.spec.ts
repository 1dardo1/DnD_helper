import { attacksFor } from './attacks';
import { naturalWeaponOf, unarmedTypeOf } from './natural-weapons';
import { REAL, hero, sheetOf } from './real-data.testing';
import { computeSheet } from './engine';

const traitsOf = (id: string) => {
  const sp = REAL.species.get(id)!;
  return [...sp.traits, ...sp.variants.flatMap((v) => v.traits)];
};

describe('natural weapons are read from the species traits', () => {
  it('Tabaxi claws: 1d6 + Strength slashing', () => {
    const t = traitsOf('tabaxi').find((x) => x.name === "Cat's Claws")!;
    expect(naturalWeaponOf(t.name, t.description)).toEqual({
      name: "Cat's Claws",
      dice: '1d6',
      ability: 'STR',
      type: 'slashing',
    });
  });

  it('Lizardfolk bite and Minotaur horns', () => {
    const bite = traitsOf('lizardfolk').find((x) => x.name === 'Bite')!;
    expect(naturalWeaponOf(bite.name, bite.description)).toMatchObject({ type: 'slashing' });
    const horns = traitsOf('minotaur').find((x) => x.name === 'Horns')!;
    expect(naturalWeaponOf(horns.name, horns.description)).toMatchObject({
      dice: '1d6',
      type: 'piercing',
    });
  });

  it("Dhampir's Vampiric Bite uses Constitution; Lupin's unarmed strikes slash", () => {
    const bite = traitsOf('dhampir').find((x) => x.name === 'Vampiric Bite')!;
    expect(naturalWeaponOf(bite.name, bite.description)).toMatchObject({
      dice: '1d4',
      ability: 'CON',
      type: 'piercing',
    });
    const pounce = traitsOf('lupin').find((x) => x.name === 'Feral Pounce')!;
    expect(unarmedTypeOf(pounce.description)).toBe('slashing');
  });

  it('no trait that merely mentions an Unarmed Strike becomes a weapon', () => {
    const found: string[] = [];
    for (const sp of REAL.species.values())
      for (const t of [...sp.traits, ...sp.variants.flatMap((v) => v.traits)]) {
        const w = naturalWeaponOf(t.name, t.description);
        if (w) found.push(`${sp.id}:${t.name}`);
      }
    // the ones in the compendium today (a new one must be looked at before being added here)
    for (const f of found) expect(f).toMatch(/^[a-z-]+:[\w' -]+$/);
    expect([...new Set(found)].sort()).toEqual([
      'aarakocra:Talons',
      'centaur:Hooves',
      'dhampir:Vampiric Bite',
      'leonin:Claws',
      'lizardfolk:Bite',
      'minotaur:Horns',
      'minotaur:Natural Weapon',
      'naga:Natural Weapons',
      'satyr:Ram',
      "tabaxi:Cat's Claws",
      'tortle:Claws',
      'viashino-ua:Bite',
      'viashino-ua:Lashing Tail',
    ]);
    expect(found).not.toContain('shifter:Shifting');
  });
});

describe('the attacks table', () => {
  const withSpecies = (speciesId: string) =>
    computeSheet(hero('fighter', 1, null, { speciesId }), REAL);

  it('adds a line per natural weapon with the damage of the trait', () => {
    const sheet = withSpecies('tabaxi');
    const rows = attacksFor(sheet, []);
    const claws = rows.find((a) => a.name === "Cat's Claws");
    expect(claws).toMatchObject({ damage: '1d6+3', damageType: 'slashing', bonus: 5 });
    expect(rows.find((a) => a.nameKey === 'sheet.unarmedStrike')?.damage).toBe('4');
  });

  it("Lupin's Unarmed Strike deals slashing damage", () => {
    const rows = attacksFor(withSpecies('lupin'), []);
    expect(rows.find((a) => a.nameKey === 'sheet.unarmedStrike')?.damageType).toBe('slashing');
  });

  it('a species without natural weapons adds nothing', () => {
    expect(attacksFor(withSpecies('human'), []).map((a) => a.entryId)).toEqual(['']);
  });
});

describe('Pact of the Blade', () => {
  const sword = { id: 'longsword', equipped: true, item: REAL.items.get('longsword')! };
  const bow = { id: 'longbow', equipped: true, item: REAL.items.get('longbow')! };

  it('tells the Charisma attack and damage on melee weapons only', () => {
    const sheet = sheetOf('warlock', 5, null, {
      options: ['eldritch-invocation/pact-of-the-blade'],
      scores: { STR: 10, CHA: 18 },
    });
    const rows = attacksFor(sheet, [sword, bow]);
    const note = (id: string) =>
      rows.find((a) => a.entryId === id)?.notes.find((n) => n.id === 'pactBlade');
    // Strength 10 (+0), Charisma 18 (+4), proficiency +3
    expect(note('longsword')?.params).toEqual({ hit: '+7', dmg: '1d8+4' });
    expect(note('longbow')).toBeUndefined();
    // without the invocation: nothing
    const plain = attacksFor(sheetOf('warlock', 5, null, { scores: { CHA: 18 } }), [sword]);
    expect(plain.some((a) => a.notes.some((n) => n.id === 'pactBlade'))).toBe(false);
  });
});
