import backgrounds from '../../../../../data/backgrounds.json';
import feats from '../../../../../data/feats.json';
import spells from '../../../../../data/spells.json';
import { Background, Feat } from '../models/compendium';
import { playResources } from '../play/play-state';
import {
  FEAT_PICKS,
  abilityRule,
  featList,
  featPicks,
  featRules,
  listOfFeatName,
  pickable,
  poolKey,
  togglePick,
} from './feat-effects';
import { sheetOf } from './real-data.testing';

const all = feats as unknown as Feat[];
const byId = new Map(all.map((f) => [f.id, f]));
const rules = (id: string) => featRules(byId.get(id)!);

describe('featRules: what the text of a feat gives', () => {
  it('Familiar Friend gives Find Familiar: free once per Long Rest, also with slots', () => {
    const r = rules('familiar-friend');
    expect(r.spells).toEqual([
      expect.objectContaining({
        id: 'find-familiar',
        name: 'Find Familiar',
        free: true,
        slots: true,
        cantrip: false,
      }),
    ]);
    expect(r.ability).toEqual({ mode: 'choice' });
    expect(r.uses).toEqual([{ label: 'Helpful Friend', max: 'pb', rest: 'long' }]);
  });

  it('tells cantrips (always available) from spells (free cast once)', () => {
    const arcane = rules('arcane-safeguard');
    expect(arcane.spells).toEqual([expect.objectContaining({ id: 'resistance', cantrip: true })]);
    expect(arcane.spells[0].free).toBe(false);
    expect(rules('child-of-the-sun').spells[0]).toMatchObject({ id: 'faerie-fire', free: true });
    // Speak with Animals: prepared, cast with slots, no free cast
    expect(rules('emerald-enclave-fledgling').spells[0]).toMatchObject({
      id: 'speak-with-animals',
      free: false,
    });
  });

  it('reads several spells, character level gates and names with "and"', () => {
    const atmo = rules('atmokinesis-ua').spells;
    expect(atmo.map((s) => s.id)).toEqual(['shocking-grasp', 'fog-cloud', 'gust-of-wind']);
    expect(atmo[2].minLevel).toBe(3);
    expect(rules('clairsentience-ua').spells.map((s) => s.id)).toContain('detect-evil-and-good');
    expect(rules('cryokinesis-ua').spells.filter((s) => s.free).length).toBe(2);
    expect(rules('fey-touched').spells[0]).toMatchObject({ id: 'misty-step', free: true });
  });

  it('counts the uses: Luck Points = PB, once per rest, short or long', () => {
    expect(rules('lucky').uses).toEqual([{ label: 'Luck Points', max: 'pb', rest: 'long' }]);
    expect(rules('survivor').uses).toEqual([{ label: 'Steel Yourself', max: 1, rest: 'long' }]);
    expect(rules('tireless-reveler').uses[0]).toMatchObject({ max: 'pb', rest: 'short-or-long' });
    expect(rules('vampire-hunter').uses[0]).toMatchObject({ max: 1, rest: 'short-or-long' });
    expect(rules('portal-jumper').uses[0]).toMatchObject({ label: 'Portal Step', max: 'pb' });
    expect(rules('lich-ascension-ua').spells[0].freeUses).toBe('mod');
    // a free cast is not a "use" of its own
    expect(rules('fey-touched').uses).toEqual([]);
  });

  it('counts "once, until you roll Initiative or finish a Short or Long rest" as one use', () => {
    // the Initiative part is not counted: the use comes back on the rest only
    expect(rules('boon-of-erupting-spellpower').uses).toEqual([
      { label: 'Spell Overload', max: 1, rest: 'short-or-long' },
    ]);
    expect(rules('boon-of-unwavering-devotion-ua').uses).toEqual([
      { label: 'Undeniable Confidence', max: 1, rest: 'short-or-long' },
    ]);
    // two benefits, each with its own use
    expect(rules('tactical-combatant').uses).toEqual([
      { label: 'Buffering Strike', max: 1, rest: 'short-or-long' },
      { label: 'Honed Instincts', max: 1, rest: 'short-or-long' },
    ]);
  });

  it('reads flat bonuses', () => {
    expect(rules('tough').hpPerLevel).toBe(2);
    expect(rules('boon-of-fortitude').hpFlat).toBe(40);
    expect(rules('speedy').speed).toBe(10);
    expect(rules('transmuted-anatomy').speed).toBe(5);
    expect(rules('boon-of-speed').speed).toBe(30);
    // "when you take the Dash action, your Speed increases by 10 feet for that action"
    expect(rules('charger').speed).toBe(0);
    expect(rules('defense').ac).toBe(1);
    expect(rules('harper-agent').languages).toEqual(["Thieves' Cant"]);
    expect(rules('tavern-brawler').weapons).toEqual(['Improvised weapons']);
    expect(rules('lich-ascension-ua').resistances).toEqual(['Necrotic', 'Poison']);
  });

  it('the spellcasting ability: chosen, fixed, or the one the feat raised', () => {
    expect(abilityRule(byId.get('familiar-friend')!)).toEqual({ mode: 'choice' });
    expect(abilityRule(byId.get('death-knight-initiate-ua')!)).toEqual({
      mode: 'fixed',
      ability: 'CHA',
    });
    expect(abilityRule(byId.get('telepathic')!)).toEqual({ mode: 'increased' });
    // the data's Magic Initiate text lost its cantrips paragraph: the picks say it is a choice
    expect(abilityRule(byId.get('magic-initiate')!)).toEqual({ mode: 'choice' });
    expect(abilityRule(byId.get('alert')!)).toEqual({ mode: 'none' });
  });

  it('every spell a feat names exists in the compendium (but two UA ones)', () => {
    const ids = new Set(spells.map((s) => s.id));
    const unknown = all
      .filter((f) => f.edition === '2024')
      .flatMap((f) => featRules(f).spells.map((s) => s.id))
      .filter((id) => !ids.has(id));
    expect(new Set(unknown)).toEqual(new Set(['mind-blast', 'telekinetic-fling']));
  });

  it('the feats with picks exist and the spell lists they offer have spells', () => {
    for (const id of Object.keys(FEAT_PICKS)) expect(byId.has(id)).toBe(true);
    const sp = spells as unknown as Parameters<typeof pickable>[0];
    for (const list of ['cleric', 'druid', 'wizard']) {
      const rule = FEAT_PICKS['magic-initiate'];
      expect(pickable(sp, rule.cantrips!, list).length).toBeGreaterThan(5);
      expect(pickable(sp, rule.spell!, list).length).toBeGreaterThan(5);
    }
    // Fey Touched: level 1 Divination or Enchantment, from any list
    const fey = pickable(sp, FEAT_PICKS['fey-touched'].spell!, null);
    expect(fey.length).toBeGreaterThan(3);
    expect(fey.every((s) => ['divination', 'enchantment'].includes(s.school.toLowerCase()))).toBe(
      true,
    );
    // Arcane Undertaker: Necromancy cantrips of the Cleric or Wizard list
    expect(
      pickable(sp, FEAT_PICKS['arcane-undertaker'].cantrips!, null).map((s) => s.id),
    ).toContain('chill-touch');
  });
});

describe('togglePick', () => {
  it('adds up to the maximum, ignores repeats and removes', () => {
    expect(togglePick([], 'light', true, 2)).toEqual(['light']);
    expect(togglePick(['light'], 'light', true, 2)).toEqual(['light']);
    expect(togglePick(['light', 'guidance'], 'mending', true, 2)).toEqual(['light', 'guidance']);
    expect(togglePick(['light', 'guidance'], 'light', false, 2)).toEqual(['guidance']);
    expect(togglePick(['a', 'b', 'c'], 'a', false, 2)).toEqual(['b', 'c']);
  });
});

describe('Magic Initiate from a background', () => {
  it('takes the spell list from the background name', () => {
    expect(listOfFeatName('Magic Initiate (Cleric)')).toBe('cleric');
    expect(listOfFeatName('Skilled')).toBeUndefined();
    const lists = (backgrounds as unknown as Background[])
      .filter((b) => b.featId === 'magic-initiate')
      .map((b) => listOfFeatName(b.feat));
    expect(lists.every((l) => !!l)).toBe(true);
  });

  it("an unfixed list is the player's pick", () => {
    const feat = byId.get('magic-initiate')!;
    expect(featList({ key: 'fighter:4', feat }, { list: 'druid' })).toBe('druid');
    expect(featList({ key: 'background', feat, fixedList: 'cleric' }, { list: 'druid' })).toBe(
      'cleric',
    );
    expect(featList({ key: 'x', feat }, undefined)).toBeNull();
    expect(featPicks(feat).list).toEqual(['cleric', 'druid', 'wizard']);
  });
});

describe('spells cast by expending Death Points (Death Knight feats)', () => {
  const spellOf = (featId: string) => rules(featId).spells[0];

  it.each([
    ['death-knight-initiate-ua', 'wrathful-smite'],
    ['deathly-presence-ua', 'fear'],
    ['dread-authority-ua', 'command'],
    ['unholy-steed-ua', 'find-steed'],
    ['harbinger-of-doom-ua', 'bane'],
  ])('%s: %s costs 1 Death Point, so it is not at will', (featId, spellId) => {
    expect(spellOf(featId)).toMatchObject({
      id: spellId,
      poolCost: { pool: 'death-points', n: 1 },
      atWill: false,
      free: false,
      slots: true,
    });
  });

  it('a spell the text gives without a spell slot and with no cost stays at will', () => {
    // Boon of the Cleansed Heart: "You can cast Dispel Evil and Good without expending a spell slot."
    expect(spellOf('boon-of-the-cleansed-heart-ua')).toMatchObject({
      id: 'dispel-evil-and-good',
      atWill: true,
    });
    expect(spellOf('boon-of-the-cleansed-heart-ua').poolCost).toBeUndefined();
  });

  it('Wrathful Smite and Fear share the Initiate Death Points counter (Proficiency Bonus 3 at level 5)', () => {
    const sheet = sheetOf('fighter', 5, null, {
      featSlots: ['death-knight-initiate-ua', 'deathly-presence-ua'].map((featId, i) => ({
        slot: `fighter:${4 + i}`,
        featId,
      })),
    } as never);
    const pool = poolKey('death-points');
    const smite = sheet.featSpells.find((s) => s.id === 'wrathful-smite')!;
    const fear = sheet.featSpells.find((s) => s.id === 'fear')!;
    expect(smite).toMatchObject({
      atWill: false,
      freeKey: pool,
      poolCost: { pool: 'death-points', n: 1 },
    });
    expect(fear).toMatchObject({
      atWill: false,
      freeKey: pool,
      poolCost: { pool: 'death-points', n: 1 },
    });
    const counters = playResources(sheet).filter((r) => r.key === pool);
    expect(counters).toHaveLength(1);
    expect(counters[0]).toMatchObject({ max: 3, labelKey: 'play.res.deathPoints' });
  });
});

describe('spells paid with a Psionic Energy Die (Illithid feats)', () => {
  const featById = (id: string) => (feats as { id: string }[]).find((f) => f.id === id)!;
  it.each([
    ['full-ceremorphosis-ua', 'detect-thoughts'],
    ['illithid-thrallmaker-ua', 'charm-person'],
    ['tadpoles-safeguard-ua', 'shield'],
  ])('%s: %s costs a die instead of being at will', (featId, spellId) => {
    const spell = featRules(featById(featId) as never).spells.find((s) => s.id === spellId)!;
    expect(spell).toMatchObject({ atWill: false, poolCost: { pool: 'psionic-energy-dice', n: 1 } });
  });
});
