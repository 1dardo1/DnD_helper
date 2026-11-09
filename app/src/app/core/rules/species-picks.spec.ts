import backgrounds from '../../../../../data/backgrounds.json';
import classes from '../../../../../data/classes.json';
import speciesEs from '../../../../../data/es/species.json';
import feats from '../../../../../data/feats.json';
import items from '../../../../../data/items.json';
import options from '../../../../../data/options.json';
import species from '../../../../../data/species.json';
import subclasses from '../../../../../data/subclasses.json';
import { Character, newCharacter, normalizeCharacter } from '../models/character';
import {
  Background,
  ClassOption,
  DndClass,
  Feat,
  Feature,
  Item,
  Species,
  Subclass,
} from '../models/compendium';
import { answerRestChoices, promptRestChoices } from '../play/rest-choices';
import { RulesData, computeSheet } from './engine';
import { speciesAbilityKey, speciesTraits } from './species-picks';
import {
  pickKey,
  traitChoice,
  traitChoiceKey,
  traitPicks,
  translatedOptions,
} from './trait-choices';

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

function build(
  speciesId: string,
  o: {
    level?: number;
    variant?: string | null;
    choices?: Record<string, string>;
    picks?: Record<string, string[]>;
  } = {},
): Character {
  const c = newCharacter('Test', 'test');
  return {
    ...c,
    classes: [{ id: 'fighter', level: o.level ?? 1, subclassId: null, hp: [] }],
    species: { id: speciesId, variant: o.variant ?? null },
    background: { id: 'soldier', abilityIncreases: {} },
    abilityScores: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
    },
    choices: {
      ...c.choices,
      traitChoices: o.choices ?? {},
      traitPicks: o.picks ?? {},
      weaponMasteries: ['battleaxe', 'club', 'dagger'],
    },
  };
}

const sheetOf = (id: string, o: Parameters<typeof build>[1] = {}) =>
  computeSheet(build(id, o), DATA);
const profSkills = (s: ReturnType<typeof computeSheet>) =>
  s.skills.filter((x) => x.proficiency !== 'none').map((x) => x.id);
const warned = (s: ReturnType<typeof computeSheet>, key: string) =>
  s.warnings.filter((w) => w.key === key).map((w) => w.params?.['trait']);
const key = (
  sp: string,
  trait: string,
  kind: Parameters<typeof pickKey>[1],
  v: string | null = null,
) => pickKey(traitChoiceKey(sp, v, trait), kind);
const abilityOf = (sp: string, a: string) => ({ [speciesAbilityKey(sp)]: [a] });

// -- the whole compendium: every choice phrase of a species/variant trait, and its status ------

/** Choice phrases that stay as text, and why. Anything new in the data must be decided here. */
const TEXT_ONLY: Record<string, string> = {
  // chosen each time the trait is used, in play: not a pick of the sheet
  'aasimar:Celestial Revelation': 'per use (each transformation)',
  'deep-imaskari-ua:Aura of Unlight': 'per use (each aura)',
  'hobgoblin:Fey Gift': 'per use (each Help action)',
  'kuo-toa-ua:Deific Manifestation': 'per casting of Find Familiar',
  'myconid-ua:Skill Meld': 'per ritual (allies and a skill they already have)',
  // targets, directions, "can choose to": no choice of the character
  'dhampir:Vampiric Bite': 'in play',
  'kender:Fearless': 'in play',
  'leonin:Daunting Roar': 'targets',
  'lupin:Howl': 'targets',
  'rabbitfolk-ua:Rabbit Hop': 'direction',
  'thri-kreen:Sleepless': 'in play',
  // a variant / feat / ability score elsewhere in the wizard
  'dragonborn:Draconic Ancestry': 'the variant (ancestry) picker',
  'custom-lineage:Feat': 'the species feat picker',
  'human:Versatile': 'the species feat picker',
  'revenant-ua:Human Revenant': 'ability scores (2024: from the background)',
};

const CHOICE = /of your choice|\(your choice\)|\bchoose\b/i;
const ABILITY = /Intelligence, Wisdom, or Charisma/i;

describe('every choice phrase of species traits (data/species.json) has a selector or a reason', () => {
  it('lists each phrase and its status', () => {
    const status: Record<string, 'selector' | 'text'> = {};
    for (const s of species as Species[]) {
      const scan = (traits: Feature[], variant: string | null) => {
        const views = speciesTraits(
          s,
          s.variants.find((v) => v.name === variant),
          newCharacter('x', 'x').choices,
          20,
        );
        for (const t of traits) {
          if (!CHOICE.test(t.description ?? '')) continue;
          const v = views.find((x) => x.trait === t)!;
          const split = traitChoice(t.description);
          const inOptions = split?.options.some((o) => traitPicks(o.text).length) ?? false;
          const selector =
            !!split || inOptions || v.picks.length > 0 || v.hidden || ABILITY.test(t.description);
          status[`${s.id}:${variant ? `${variant}:` : ''}${t.name}`] = selector
            ? 'selector'
            : 'text';
        }
      };
      scan(s.traits, null);
      for (const v of s.variants.filter((x) => !x.reprint)) scan(v.traits, v.name);
    }
    const text = Object.keys(status).filter((k) => status[k] === 'text');
    // every text-only one is known and explained
    expect(text.sort()).toEqual(Object.keys(TEXT_ONLY).sort());
    // and the ones with a selector include all the creation/rest choices of the task
    const selectors = Object.keys(status).filter((k) => status[k] === 'selector');
    expect(selectors).toEqual(
      expect.arrayContaining([
        'half-elf:Half-Elf Versatility',
        'kobold:Kobold Legacy',
        'astral-elf:Astral Fire',
        'warforged:Specialized Design',
        'autognome:Specialized Design',
        'vedalken:Tireless Precision',
        'satyr:Reveler',
        'khoravar:Skill Versatility',
        'githyanki:Astral Knowledge',
        'kalashtar:Severed from Dreams',
        'sea-elf:Trance',
        'shadar-kai:Trance',
        'eladrin:Trance',
        'duskling:Inner Magic',
        'simic-hybrid:Animal Enhancements',
        'aarakocra:Wind Caller',
        'viashino-ua:Wiry Frame',
      ]),
    );
  });

  it('the Spanish compendium has the same traits, so its options pair by position', () => {
    const es = new Map((speciesEs as Species[]).map((s) => [s.id, s]));
    for (const id of ['simic-hybrid', 'eladrin']) {
      const en = DATA.species.get(id)!;
      const t = en.traits.find((x) =>
        /animal enhancement|based on your season/i.test(x.description),
      )!;
      const at = en.traits.indexOf(t);
      const views = speciesTraits(en, undefined, newCharacter('x', 'x').choices, 20);
      const opts = views.find((v) => v.trait === t)!.picks.find((p) => p.pick.kind === 'option')!;
      expect(translatedOptions(es.get(id)!.traits[at].description).length).toBe(
        opts.options!.length,
      );
    }
    expect(es.get('duskling')!.traits.length).toBe(DATA.species.get('duskling')!.traits.length);
  });
});

// -- cantrips of the player's choice ------------------------------------------------------------

describe('cantrips "of your choice" inside a species trait', () => {
  const he = traitChoiceKey('half-elf', null, 'Half-Elf Versatility');
  const cantrip = 'Cantrip (High Elf Heritage)';

  it('Half-Elf, Cantrip (High Elf Heritage): nothing picked → no cantrip and a warning', () => {
    const s = sheetOf('half-elf', { choices: { [he]: cantrip } });
    expect(s.featSpells.filter((f) => f.origin === 'species')).toEqual([]);
    expect(warned(s, 'sheet.warn.traitPickMissing')).toEqual(['Half-Elf Versatility']);
  });

  it('picked: only that cantrip, from the species, with Intelligence (the text fixes it)', () => {
    const s = sheetOf('half-elf', {
      choices: { [he]: cantrip },
      picks: { [pickKey(he, 'cantrip')]: ['fire-bolt'] },
    });
    const sp = s.featSpells.filter((f) => f.origin === 'species');
    expect(sp.map((f) => [f.id, f.ability, f.abilityChosen])).toEqual([['fire-bolt', 'INT', true]]);
    expect(s.warnings).toEqual([]);
    // shown under the trait
    const f = s.features.find((x) => x.name === 'Half-Elf Versatility')!;
    expect(f.chosen).toEqual([{ kind: 'cantrip', values: ['fire-bolt'] }]);
  });

  it('a cantrip picked for that option does not carry over to another option', () => {
    const s = sheetOf('half-elf', {
      choices: { [he]: 'Mask of the Wild (Wood Elf Heritage)' },
      picks: { [pickKey(he, 'cantrip')]: ['fire-bolt'] },
    });
    expect(s.featSpells.map((f) => f.id)).not.toContain('fire-bolt');
  });

  it('Kobold, Draconic Sorcery: the cantrip, and the INT/WIS/CHA it asks for', () => {
    const kl = traitChoiceKey('kobold', null, 'Kobold Legacy');
    const noAbility = sheetOf('kobold', {
      choices: { [kl]: 'Draconic Sorcery' },
      picks: { [pickKey(kl, 'cantrip')]: ['mage-hand'] },
    });
    expect(warned(noAbility, 'sheet.warn.speciesAbilityMissing')).toEqual(['Kobold']);
    expect(noAbility.featSpells.find((f) => f.id === 'mage-hand')?.abilityChosen).toBe(false);
    const ok = sheetOf('kobold', {
      choices: { [kl]: 'Draconic Sorcery' },
      picks: { [pickKey(kl, 'cantrip')]: ['mage-hand'], ...abilityOf('kobold', 'CHA') },
    });
    const mh = ok.featSpells.find((f) => f.id === 'mage-hand')!;
    expect([mh.ability, mh.abilityChosen, mh.origin]).toEqual(['CHA', true, 'species']);
    expect(ok.warnings).toEqual([]);
    // Defiance asks for no ability
    const def = sheetOf('kobold', { choices: { [kl]: 'Defiance' } });
    expect(warned(def, 'sheet.warn.speciesAbilityMissing')).toEqual([]);
  });

  it('Astral Elf, Astral Fire: only one of the three it names', () => {
    const k = key('astral-elf', 'Astral Fire', 'cantrip');
    const none = sheetOf('astral-elf', abilityPick('astral-elf'));
    expect(warned(none, 'sheet.warn.traitPickMissing')).toContain('Astral Fire');
    const wrong = sheetOf('astral-elf', {
      picks: { [k]: ['eldritch-blast'], ...abilityOf('astral-elf', 'WIS') },
    });
    expect(wrong.featSpells.map((f) => f.id)).not.toContain('eldritch-blast');
    const ok = sheetOf('astral-elf', {
      picks: { [k]: ['sacred-flame'], ...abilityOf('astral-elf', 'WIS') },
    });
    const sf = ok.featSpells.find((f) => f.id === 'sacred-flame')!;
    expect([sf.ability, sf.origin]).toEqual(['WIS', 'species']);
  });

  it('Khoravar, Fey Gift: Friends until another cantrip is picked, which then replaces it', () => {
    const k = key('khoravar', 'Fey Gift', 'cantrip');
    const base = sheetOf('khoravar', { picks: abilityOf('khoravar', 'CHA') });
    expect(base.featSpells.map((f) => f.id)).toContain('friends');
    expect(warned(base, 'sheet.warn.traitPickMissing')).not.toContain('Fey Gift');
    const swapped = sheetOf('khoravar', {
      picks: { [k]: ['guidance'], ...abilityOf('khoravar', 'CHA') },
    });
    expect(swapped.featSpells.map((f) => f.id)).toContain('guidance');
    expect(swapped.featSpells.map((f) => f.id)).not.toContain('friends');
    expect(swapped.restPicks?.map((r) => r.key)).toContain(k);
  });
});

function abilityPick(sp: string) {
  return { picks: abilityOf(sp, 'INT') };
}

// -- tools, weapons, skills of the player's choice ------------------------------------------------

describe('tools / weapons "of your choice" (and the skill in the same sentence)', () => {
  it('Warforged, Specialized Design: one skill and one tool, each apart', () => {
    const sk = key('warforged', 'Specialized Design', 'skill');
    const tl = key('warforged', 'Specialized Design', 'tool');
    const none = sheetOf('warforged');
    expect(warned(none, 'sheet.warn.traitPickMissing')).toEqual(['Specialized Design']);
    expect(none.proficiencies.tools).toEqual([]);
    const skillOnly = sheetOf('warforged', { picks: { [sk]: ['arcana'] } });
    expect(profSkills(skillOnly)).toContain('arcana');
    expect(warned(skillOnly, 'sheet.warn.traitPickMissing')).toEqual(['Specialized Design']);
    const both = sheetOf('warforged', {
      picks: { [sk]: ['arcana'], [tl]: ["Tinker's Tools", 'Lute'] },
    });
    expect(both.proficiencies.tools).toEqual(["Tinker's Tools"]);
    expect(both.warnings.filter((w) => w.key !== 'sheet.warn.noSubclass')).toEqual([]);
  });

  it('Vedalken: a skill of the six it names, and any tool', () => {
    const sk = key('vedalken', 'Tireless Precision', 'skill');
    const tl = key('vedalken', 'Tireless Precision', 'tool');
    const s = sheetOf('vedalken', { picks: { [sk]: ['stealth'], [tl]: ["Thieves' Tools"] } });
    expect(profSkills(s)).not.toContain('stealth');
    expect(s.proficiencies.tools).toContain("Thieves' Tools");
    expect(warned(s, 'sheet.warn.traitPickMissing')).toEqual(['Tireless Precision']);
  });

  it('Autognome: two tools; Satyr: one musical instrument', () => {
    const au = key('autognome', 'Specialized Design', 'tool');
    const s = sheetOf('autognome', { picks: { [au]: ['Dice', "Smith's Tools"] } });
    expect(s.proficiencies.tools).toEqual(expect.arrayContaining(['Dice', "Smith's Tools"]));
    expect(
      traitPicks(DATA.species.get('satyr')!.traits.find((t) => t.name === 'Reveler')!.description),
    ).toEqual([{ kind: 'tool', count: 1, from: null, group: 'Musical Instrument' }]);
  });

  it('Khoravar, Skill Versatility: one skill OR one tool, changeable on a Long Rest', () => {
    const k = key('khoravar', 'Skill Versatility', 'skill-or-tool');
    const tool = sheetOf('khoravar', { picks: { [k]: ["Cook's Utensils"] } });
    expect(tool.proficiencies.tools).toContain("Cook's Utensils");
    const skill = sheetOf('khoravar', { picks: { [k]: ['stealth'] } });
    expect(profSkills(skill)).toContain('stealth');
    expect(skill.restPicks).toContainEqual({ key: k, trait: 'Skill Versatility', rest: 'long' });
  });

  it('Githyanki, Astral Knowledge: a skill and a weapon or tool, both re-picked on Long Rests', () => {
    const sk = key('githyanki', 'Astral Knowledge', 'skill');
    const wt = key('githyanki', 'Astral Knowledge', 'weapon-or-tool');
    const s = sheetOf('githyanki', {
      picks: { [sk]: ['history'], [wt]: ['weapon:Longbow'], ...abilityOf('githyanki', 'INT') },
    });
    expect(profSkills(s)).toContain('history');
    expect(s.proficiencies.weapons).toContain('Longbow');
    expect(s.restPicks?.map((r) => r.key).sort()).toEqual([sk, wt].sort());
  });

  it('Eladrin: two weapons/tools "that you don\'t have" and the season, on a Long Rest', () => {
    const t = DATA.species.get('eladrin')!.traits.find((x) => x.name === 'Trance')!;
    expect(traitPicks(t.description)).toEqual([
      { kind: 'weapon-or-tool', count: 2, from: null, notHad: true, rest: 'long' },
    ]);
    const season = key('eladrin', 'Fey Step', 'option');
    const none = sheetOf('eladrin', { level: 3, picks: abilityOf('eladrin', 'CHA') });
    expect(warned(none, 'sheet.warn.traitPickMissing')).toContain('Fey Step');
    const s = sheetOf('eladrin', {
      level: 3,
      picks: { [season]: ['Winter'], ...abilityOf('eladrin', 'CHA') },
    });
    const fey = s.features.find((f) => f.name === 'Fey Step')!.description;
    expect(fey).toContain('frightened');
    expect(fey).not.toContain('charmed by you');
    expect(s.restPicks?.map((r) => r.key)).toContain(season);
  });
});

// -- named options: Duskling, Simic Hybrid ------------------------------------------------------

describe('options to pick some of', () => {
  const inner = key('duskling', 'Inner Magic', 'option');

  it('Duskling: nothing picked → none of Ardor / Mobility / Vigor applies, and it warns', () => {
    const s = sheetOf('duskling');
    const names = s.features.map((f) => f.name);
    expect(names).not.toContain('Mobility');
    expect(names).not.toContain('Ardor');
    expect(s.speed['walk']).toBe(30);
    expect(warned(s, 'sheet.warn.traitPickMissing')).toEqual(['Inner Magic']);
  });

  it('Duskling, Mobility: only that benefit, +10 ft of Speed, and offered after a Long Rest', () => {
    const s = sheetOf('duskling', { picks: { [inner]: ['Mobility'] } });
    const names = s.features.map((f) => f.name);
    expect(names).toContain('Mobility');
    expect(names).not.toContain('Vigor');
    expect(s.speed['walk']).toBe(40);
    expect(s.restPicks).toEqual([{ key: inner, trait: 'Inner Magic', rest: 'long' }]);
  });

  it('Simic Hybrid at level 1: one 1st-level enhancement; no swim speed until picked', () => {
    const k = key('simic-hybrid', 'Animal Enhancements', 'option');
    const none = sheetOf('simic-hybrid');
    expect(none.speed['swim']).toBeUndefined();
    expect(warned(none, 'sheet.warn.traitPickMissing')).toEqual(['Animal Enhancements']);
    const swim = sheetOf('simic-hybrid', { picks: { [k]: ['Underwater Adaptation (1st level)'] } });
    expect(swim.speed['swim']).toBe(30);
    expect(swim.warnings.filter((w) => w.key === 'sheet.warn.traitPickMissing')).toEqual([]);
    // a 5th-level enhancement isn't available yet
    const early = sheetOf('simic-hybrid', { picks: { [k]: ['Carapace (5th level)'] } });
    expect(warned(early, 'sheet.warn.traitPickMissing')).toEqual(['Animal Enhancements']);
  });

  it('Simic Hybrid at level 5: a second one; Grappling Appendages asks claws or tentacles', () => {
    const k = key('simic-hybrid', 'Animal Enhancements', 'option');
    const form = key('simic-hybrid', 'Animal Enhancements', 'form');
    const one = sheetOf('simic-hybrid', {
      level: 5,
      picks: { [k]: ['Nimble Climber (1st level)'] },
    });
    expect(one.speed['climb']).toBe(30);
    expect(warned(one, 'sheet.warn.traitPickMissing')).toEqual(['Animal Enhancements']);
    const two = sheetOf('simic-hybrid', {
      level: 5,
      picks: { [k]: ['Nimble Climber (1st level)', 'Grappling Appendages (5th level)'] },
    });
    expect(warned(two, 'sheet.warn.traitPickMissing')).toEqual(['Animal Enhancements']);
    const done = sheetOf('simic-hybrid', {
      level: 5,
      picks: {
        [k]: ['Nimble Climber (1st level)', 'Grappling Appendages (5th level)'],
        [form]: ['tentacles'],
      },
    });
    expect(warned(done, 'sheet.warn.traitPickMissing')).toEqual([]);
    const f = done.features.find((x) => x.name === 'Animal Enhancements')!;
    expect(f.description).toContain('Grappling Appendages');
    expect(f.description).not.toContain('Acid Spit');
  });
});

// -- spellcasting ability of the species' traits --------------------------------------------------

describe('the INT/WIS/CHA "chosen when you select this race"', () => {
  it('Aarakocra: Gust of Wind from level 3, with the ability picked; none → it warns', () => {
    const none = sheetOf('aarakocra', { level: 3 });
    expect(warned(none, 'sheet.warn.speciesAbilityMissing')).toEqual(['Aarakocra']);
    expect(none.featSpells.find((f) => f.id === 'gust-of-wind')?.abilityChosen).toBe(false);
    const s = sheetOf('aarakocra', { level: 3, picks: abilityOf('aarakocra', 'WIS') });
    const g = s.featSpells.find((f) => f.id === 'gust-of-wind')!;
    expect([g.ability, g.abilityChosen, !!g.freeKey, g.slots]).toEqual(['WIS', true, true, true]);
    // one free cast per Long Rest, not a second counter for the trait
    expect(s.featUses.filter((u) => u.feat === 'Wind Caller').length).toBe(1);
  });

  it('Githyanki: Jump at 3, Misty Step at 5', () => {
    const at = (level: number) =>
      sheetOf('githyanki', { level, picks: abilityOf('githyanki', 'INT') }).featSpells.map(
        (f) => f.id,
      );
    expect(at(1)).not.toContain('jump');
    expect(at(3)).toContain('jump');
    expect(at(3)).not.toContain('misty-step');
    expect(at(5)).toContain('misty-step');
  });
});

// -- what stays as text -------------------------------------------------------------------------

describe('choices made each time a trait is used stay as text', () => {
  it('Hobgoblin Fey Gift, Aasimar Celestial Revelation: no pick, nothing offered on rests', () => {
    for (const id of ['hobgoblin', 'aasimar', 'deep-imaskari-ua']) {
      const s = sheetOf(id, { level: 3 });
      expect(s.restPicks).toBeUndefined();
      expect(warned(s, 'sheet.warn.traitPickMissing')).toEqual([]);
    }
  });
});

// -- rests: keep or change -------------------------------------------------------------------

describe('after a rest: keep or change the picks that the text allows', () => {
  const k = key('kalashtar', 'Severed from Dreams', 'skill');
  const ch = build('kalashtar', { picks: { [k]: ['insight'] } });
  const sheet = computeSheet(ch, DATA);

  it('a Long Rest offers the Kalashtar skill; a Short Rest does not', () => {
    expect(promptRestChoices(ch.state, sheet, 'long').restChoices).toEqual([k]);
    expect(promptRestChoices(ch.state, sheet, 'short').restChoices).toBeUndefined();
    // a character without such picks gets nothing
    const fighter = build('human');
    expect(promptRestChoices(fighter.state, computeSheet(fighter, DATA), 'long')).toBe(
      fighter.state,
    );
  });

  it('keep: the same skill, and the question is gone', () => {
    const asked = { ...ch, state: promptRestChoices(ch.state, sheet, 'long') };
    const kept = answerRestChoices(asked, {});
    expect(kept.state.restChoices).toBeUndefined();
    expect(profSkills(computeSheet(kept, DATA))).toContain('insight');
  });

  it('change: the new skill replaces the old one', () => {
    const asked = { ...ch, state: promptRestChoices(ch.state, sheet, 'long') };
    const changed = answerRestChoices(asked, { [k]: ['arcana'] });
    const s = computeSheet(changed, DATA);
    expect(profSkills(s)).toContain('arcana');
    expect(profSkills(s)).not.toContain('insight');
    expect(changed.state.restChoices).toBeUndefined();
  });

  it('the pending question survives saving (normalizeCharacter), junk does not', () => {
    const asked = { ...ch, state: { ...ch.state, restChoices: [k, k, 3 as unknown as string] } };
    expect(normalizeCharacter(asked)!.state.restChoices).toEqual([k]);
    const old = { ...ch, state: { ...ch.state } } as Character;
    delete old.state.restChoices;
    expect('restChoices' in normalizeCharacter(old)!.state).toBe(false);
  });
});
