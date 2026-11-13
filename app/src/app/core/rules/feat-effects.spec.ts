import backgrounds from '../../../../../data/backgrounds.json';
import feats from '../../../../../data/feats.json';
import spells from '../../../../../data/spells.json';
import { Background, Feat } from '../models/compendium';
import {
  FEAT_PICKS,
  abilityRule,
  featList,
  featPicks,
  featRules,
  listOfFeatName,
  pickable,
  togglePick,
} from './feat-effects';

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
