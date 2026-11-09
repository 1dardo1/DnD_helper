import { DEFS, dcValue, writtenDc } from './feature-stats';
import { attacksFor } from './attacks';
import { critRangeOf } from './engine';
import { REAL, REAL_CLASSES, REAL_SUBCLASSES, sheetOf } from './real-data.testing';

const classFeatures = (cls: string) => REAL_CLASSES.find((c) => c.id === cls)!.features;
const subFeatures = (sub: string) => REAL_SUBCLASSES.find((s) => s.id === sub)!.features;
const featuresOf = (cls: string, sub?: string) => (sub ? subFeatures(sub) : classFeatures(cls));

describe('every number comes from a sentence of the real text', () => {
  for (const d of DEFS)
    it(`${d.sub ?? d.cls}: ${d.feature} -> ${d.id}`, () => {
      const list = featuresOf(d.cls, d.sub);
      const f = list.find((x) => x.name === d.feature);
      expect(f, `${d.feature} not in the data`).toBeDefined();
      expect(f!.description.replace(/\s+/g, ' ')).toMatch(d.anchor);
      for (const a of d.also ?? []) {
        // the growth can be in a feature of the class, or of the subclass
        const g = [...classFeatures(d.cls), ...(d.sub ? subFeatures(d.sub) : [])].filter(
          (x) => x.name === a.feature,
        );
        expect(g.length, `${a.feature} not in the data`).toBeGreaterThan(0);
        expect(g.some((x) => a.anchor.test(x.description.replace(/\s+/g, ' ')))).toBe(true);
      }
    });
});

describe('save DCs written in the text', () => {
  it('reads the usual phrasings', () => {
    const mod = (a: string) => ({ STR: 3, DEX: 4, CON: 1, INT: 0, WIS: 2, CHA: -1 })[a]!;
    const dc = (t: string) => writtenDc(t).map((x) => dcValue(x, mod as never, 3));
    expect(dc('(DC 8 plus your Strength modifier and Proficiency Bonus)')).toEqual([14]);
    expect(dc('The save DC equals 8 plus your Wisdom modifier and Proficiency Bonus.')).toEqual([
      13,
    ]);
    expect(dc('DC equals 8 + your proficiency bonus + your Constitution modifier')).toEqual([12]);
    // the better of two when the text lets you pick
    expect(
      dc(
        'DC equals 8 plus your Strength or Dexterity modifier (your choice) and Proficiency Bonus',
      ),
    ).toEqual([15]);
    expect(dc('A Dexterity saving throw against your spell save DC')).toEqual([]);
  });

  it('shows them for the features of the character, with the real values', () => {
    // Monk 5, WIS 14 (+2), PB 3: Monk's Focus 8 + 3 + 2
    const monk = sheetOf('monk', 5, 'monk/warrior-of-the-open-hand');
    expect(monk.combat.stats).toContainEqual(
      expect.objectContaining({
        id: 'dc',
        source: "Monk's Focus",
        params: { n: 13 },
        ability: 'WIS',
      }),
    );
    const rogue = sheetOf('rogue', 5, 'rogue/soulknife');
    expect(rogue.combat.stats).toContainEqual(
      expect.objectContaining({
        id: 'dc',
        source: 'Cunning Strike',
        params: { n: 13 },
        ability: 'DEX',
      }),
    );
    // Battle Master: the better of Strength (+3) and Dexterity (+2)
    const bm = sheetOf('fighter', 3, 'fighter/battle-master');
    expect(bm.combat.stats).toContainEqual(
      expect.objectContaining({ id: 'dc', source: 'Combat Superiority', params: { n: 13 } }),
    );
  });
});

describe('numbers for the character', () => {
  const stat = (s: ReturnType<typeof sheetOf>, id: string) =>
    s.combat.stats.find((x) => x.id === id);
  const note = (s: ReturnType<typeof sheetOf>, id: string) =>
    s.combat.notes.find((x) => x.id === id);

  it('Monk: Deflect Attacks 1d10 + DEX + level, Uncanny Metabolism with the Martial Arts die', () => {
    const s = sheetOf('monk', 5, 'monk/warrior-of-the-open-hand');
    expect(stat(s, 'deflectAttacks')?.params).toEqual({ n: '1d10+7' });
    expect(stat(s, 'uncannyMetabolism')?.params).toEqual({ n: '1d8+5' });
    expect(stat(s, 'slowFall')?.params).toEqual({ n: 25 });
  });

  it('Paladin: Aura of Protection grows to 30 feet, Radiant Strikes and Divine Smite are noted', () => {
    expect(stat(sheetOf('paladin', 6), 'auraOfProtection')?.params).toEqual({ n: 2, r: 10 });
    expect(stat(sheetOf('paladin', 18), 'auraOfProtection')?.params).toEqual({ n: 2, r: 30 });
    expect(note(sheetOf('paladin', 10), 'radiantStrikes')).toBeUndefined();
    expect(note(sheetOf('paladin', 11), 'radiantStrikes')).toBeDefined();
    expect(note(sheetOf('paladin', 2), 'divineSmite')).toBeDefined();
    expect(stat(sheetOf('paladin', 5), 'channelDivinityDc')?.params).toEqual({ n: 13 });
  });

  it("Ranger: Hunter's Mark d6, d10 with Foe Slayer", () => {
    expect(note(sheetOf('ranger', 5), 'huntersMark')?.params).toEqual({ die: 'd6' });
    expect(note(sheetOf('ranger', 20), 'huntersMark')?.params).toEqual({ die: 'd10' });
  });

  it('subclass riders: Fey Wanderer, Gloom Stalker, Zealot, Berserker', () => {
    expect(note(sheetOf('ranger', 3, 'ranger/fey-wanderer'), 'dreadfulStrikes')?.params).toEqual({
      dice: '1d4',
    });
    expect(note(sheetOf('ranger', 11, 'ranger/fey-wanderer'), 'dreadfulStrikes')?.params).toEqual({
      dice: '1d6',
    });
    expect(note(sheetOf('ranger', 11, 'ranger/gloom-stalker'), 'dreadfulStrike')?.params).toEqual({
      dice: '2d8',
      n: 2,
    });
    expect(
      note(sheetOf('barbarian', 10, 'barbarian/path-of-the-zealot'), 'divineFury')?.params,
    ).toEqual({ dmg: '1d6+5' });
    // Rage Damage +2 at level 3
    expect(
      note(sheetOf('barbarian', 3, 'barbarian/path-of-the-berserker'), 'frenzy')?.params,
    ).toEqual({ dice: '2d6' });
  });

  it('Brutal Strike 1d10, 2d10 from level 17; Blessed Strikes 1d8, 2d8 from 14', () => {
    expect(note(sheetOf('barbarian', 9), 'brutalStrike')?.params).toEqual({ dice: '1d10' });
    expect(note(sheetOf('barbarian', 17), 'brutalStrike')?.params).toEqual({ dice: '2d10' });
    expect(note(sheetOf('cleric', 7), 'divineStrike')?.params).toEqual({ dice: '1d8' });
    expect(note(sheetOf('cleric', 14), 'divineStrike')?.params).toEqual({ dice: '2d8' });
  });

  it('Psi Warrior: the die of the pool plus Intelligence', () => {
    const s = sheetOf('fighter', 11, 'fighter/psi-warrior');
    expect(note(s, 'psionicStrike')?.params).toEqual({ n: 'd10+1' });
    expect(stat(s, 'protectiveField')?.params).toEqual({ n: 'd10+1' });
  });

  it('Hex is noted when the spell is chosen', () => {
    const s = sheetOf('warlock', 5, null, { spells: ['hex'] });
    expect(note(s, 'hex')).toBeDefined();
    expect(note(sheetOf('warlock', 5), 'hex')).toBeUndefined();
  });

  it('Wizard Arcane Recovery levels and Abjurer ward Hit Points', () => {
    expect(stat(sheetOf('wizard', 5), 'arcaneRecovery')?.params).toEqual({ n: 3 });
    expect(stat(sheetOf('wizard', 6, 'wizard/abjurer'), 'arcaneWard')?.params).toEqual({ n: 13 });
  });

  it('Cleric/Fighter/Sorcerer', () => {
    expect(stat(sheetOf('cleric', 5), 'searUndead')?.params).toEqual({ dice: '2d8' });
    expect(stat(sheetOf('fighter', 5), 'secondWind')?.params).toEqual({ n: '1d10+5' });
    expect(stat(sheetOf('sorcerer', 5), 'innateSorcery')?.params).toEqual({ n: 14 });
    expect(stat(sheetOf('sorcerer', 5), 'sorcerousRestoration')?.params).toEqual({ n: 2 });
  });
});

describe('critical hit range', () => {
  it('Champion: 19-20 from level 3 and 18-20 from level 15', () => {
    expect(sheetOf('fighter', 2, 'fighter/champion').combat.critRange).toBe(20);
    expect(sheetOf('fighter', 3, 'fighter/champion').combat.critRange).toBe(19);
    expect(sheetOf('fighter', 15, 'fighter/champion').combat.critRange).toBe(18);
    expect(sheetOf('fighter', 15, 'fighter/battle-master').combat.critRange).toBe(20);
  });

  it('reads the number from the text', () => {
    expect(
      critRangeOf([
        {
          name: 'Improved Critical',
          description:
            'Your attack rolls can score a Critical Hit on a roll of 19 or 20 on the d20.',
        },
      ]),
    ).toBe(19);
  });
});

describe('notes on the attack lines', () => {
  const sword = { id: 'longsword', equipped: true, item: REAL.items.get('longsword')! };
  const bow = { id: 'longbow', equipped: true, item: REAL.items.get('longbow')! };

  it('Champion: every line says the critical range', () => {
    const rows = attacksFor(sheetOf('fighter', 3, 'fighter/champion'), [sword, bow]);
    expect(rows.length).toBeGreaterThan(2);
    for (const a of rows) expect(a.notes).toContainEqual({ id: 'crit', params: { n: 19 } });
    const plain = attacksFor(sheetOf('fighter', 3, 'fighter/battle-master'), [sword]);
    expect(plain.some((a) => a.notes.some((n) => n.id === 'crit'))).toBe(false);
  });

  it('Paladin 11+: Radiant Strikes on melee weapons and the Unarmed Strike, not on the bow', () => {
    const rows = attacksFor(sheetOf('paladin', 11), [sword, bow]);
    const has = (id: string) =>
      rows.find((a) => a.entryId === id)?.notes.some((n) => n.id === 'radiantStrikesRow');
    expect(has('longsword')).toBe(true);
    expect(has('longbow')).toBe(false);
    expect(
      rows.find((a) => a.entryId === '')?.notes.some((n) => n.id === 'radiantStrikesRow'),
    ).toBe(true);
    const before = attacksFor(sheetOf('paladin', 10), [sword]);
    expect(before.some((a) => a.notes.some((n) => n.id === 'radiantStrikesRow'))).toBe(false);
  });
});
