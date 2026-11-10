import { Character } from '../models/character';
import { Ability, Feature, Item, Species, SpeciesVariant } from '../models/compendium';
import { proficientWith } from './attacks';
import { featRules } from './feat-effects';
import { Sheet } from './sheet';
import {
  SKILL_IDS,
  TraitOption,
  TraitPick,
  pickKey,
  resolveTraitChoice,
  splitOptions,
  traitChoiceKey,
  traitPicks,
  validPicks,
} from './trait-choices';
import { joinBroken } from './trait-effects';

/**
 * Everything a species (and its chosen variant) asks the player to pick inside its traits, worked
 * out from the text: the option of a trait that embeds its own choice (trait-choices.ts'
 * `traitChoice`), the skills / damage type / tools / weapons / cantrip "of your choice", a set of
 * named options to pick some of (Simic Hybrid's Animal Enhancements, an Eladrin's season, a
 * Duskling's Inner Magic benefit) and the spellcasting ability "chosen when you select this
 * species". Shared by the rules engine (what applies), the wizard (the selectors) and the rest
 * dialog (the picks the text lets the player change after a rest).
 */

/** One pick inside a species/variant trait, with what the character has picked for it. */
export interface SpeciesPick {
  /** Where it's stored: `choices.traitPicks[key]` (`pickKey(traitKey, kind)`). */
  key: string;
  traitKey: string;
  /** English name of the trait. */
  trait: string;
  pick: TraitPick;
  /** How many the character picks at its current level (Simic Hybrid: 1, then 2 at 5th). */
  count: number;
  /** The valid picks stored for it (from the allowed list, no more than `count`). */
  picked: string[];
  /** 'option' / 'form': the options, each with the character level it needs. */
  options?: (TraitOption & { level: number })[];
  /** Nothing picked is fine: the trait's own default stays (Khoravar's Friends). */
  optional?: boolean;
}

/** A species/variant trait as it applies to the character. */
export interface SpeciesTraitView {
  trait: Feature;
  variantName: string | null;
  key: string;
  /** The text to show and to read for spells/skills/uses: only the chosen options' part. */
  text: string;
  /** The trait embeds its own choice (a lineage...) and none is picked. */
  choiceMissing: boolean;
  /** One of the options of another trait's pick (Duskling's Ardor/Mobility/Vigor), not picked. */
  hidden: boolean;
  /** One of those options, and the one picked: its benefit is on while it stays picked. */
  pickedOption?: boolean;
  picks: SpeciesPick[];
}

/** Where the species' spellcasting ability is stored (`choices.traitPicks`). */
export const speciesAbilityKey = (speciesId: string): string => `${speciesId}#ability`;

/** "INT, WIS or CHA is your spellcasting ability ... (choose when you select this race)". */
const ABILITY_CHOICE =
  /Intelligence, Wisdom, or Charisma (?:is your spellcasting ability|modifier \(choose)|your choice of Intelligence, Wisdom, or Charisma/i;

const ORDINAL = /\((\d+)(?:st|nd|rd|th) level\)/i;

/** A set of named options inside (or right after) a trait that the player picks some of. */
interface OptionPick {
  pick: TraitPick;
  options: (TraitOption & { level: number })[];
  /** The options are the traits that follow it (Duskling), not part of its own text. */
  siblings: boolean;
  /** Text that always applies, whichever options are picked. */
  preamble: string;
}

function optionPickOf(t: Feature, following: Feature[], speciesText: string): OptionPick | null {
  const text = joinBroken(t.description ?? '').replace(/\r\n/g, '\n');
  // Simic Hybrid: "You choose one animal enhancement now and one at 5th level."
  const grow = /You choose one [\w ]+? now and one at (\d+)(?:st|nd|rd|th) level/i.exec(text);
  if (grow) {
    const split = splitOptions(text);
    if (!split) return null;
    const options = split.options.map((o) => ({
      ...o,
      level: Number(ORDINAL.exec(o.name)?.[1] ?? 1),
    }));
    return {
      pick: {
        kind: 'option',
        count: 2,
        from: options.map((o) => o.name),
        unlock: [1, Number(grow[1])],
      },
      options,
      siblings: false,
      preamble: split.preamble,
    };
  }
  // Eladrin: "your Fey Step gains an additional effect based on your season" — Autumn, Winter...
  // ("Whenever you finish this trance, you can change your season")
  if (/based on your season/i.test(text)) {
    const split = splitOptions(text);
    if (!split || split.options.length < 2) return null;
    const clean = (s: string) => s.replace(/\n\s*-\s*$/, '').trim();
    return {
      pick: {
        kind: 'option',
        count: 1,
        from: split.options.map((o) => o.name),
        ...(/change your season/i.test(speciesText) ? { rest: 'long' as const } : {}),
      },
      options: split.options.map((o) => ({ name: o.name, text: clean(o.text), level: 1 })),
      siblings: false,
      preamble: clean(split.preamble),
    };
  }
  // Duskling: "When you finish a Long Rest, choose one of the following benefits" — the benefits
  // are the traits that follow it (Ardor, Mobility, Vigor)
  if (
    /choose one of the following benefits/i.test(text) &&
    !splitOptions(text) &&
    following.length
  ) {
    return {
      pick: {
        kind: 'option',
        count: 1,
        from: following.map((f) => f.name),
        ...(/When you finish a Long Rest, choose/i.test(text) ? { rest: 'long' as const } : {}),
      },
      options: following.map((f) => ({ name: f.name, text: f.description, level: 1 })),
      siblings: true,
      preamble: text,
    };
  }
  return null;
}

/**
 * The species' traits, then the chosen variant's, as they apply to the character: resolved
 * against its picks (`choices.traitChoices` / `choices.traitPicks`), with what each asks to pick.
 */
export function speciesTraits(
  species: Species,
  variant: SpeciesVariant | undefined,
  choices: Character['choices'],
  level: number,
): SpeciesTraitView[] {
  const stored = choices.traitPicks ?? {};
  const all = [...species.traits, ...(variant?.traits ?? [])];
  const speciesText = all.map((t) => t.description ?? '').join('\n');
  const out: SpeciesTraitView[] = [];
  const hidden = new Set<Feature>();
  const picked = new Set<Feature>();

  const scan = (traits: Feature[], variantName: string | null) => {
    traits.forEach((t, i) => {
      const key = traitChoiceKey(species.id, variantName, t.name);
      const r = resolveTraitChoice(t, key, choices.traitChoices?.[key]);
      let text = r.text;
      const picks: SpeciesPick[] = [];
      const make = (pick: TraitPick, extra: Partial<SpeciesPick> = {}): SpeciesPick => {
        const k = pickKey(key, pick.kind);
        const count = pick.unlock ? pick.unlock.filter((l) => l <= level).length : pick.count;
        const levelOk = (v: string) =>
          !extra.options || (extra.options.find((o) => o.name === v)?.level ?? 1) <= level;
        const picked = validPicks(pick, (stored[k] ?? []).filter(levelOk), count);
        return { key: k, traitKey: key, trait: t.name, pick, count, picked, ...extra };
      };

      const op = hidden.has(t) ? null : optionPickOf(t, traits.slice(i + 1), speciesText);
      if (op) {
        const p = make(op.pick, { options: op.options });
        picks.push(p);
        if (op.siblings) {
          for (const o of traits.slice(i + 1)) (p.picked.includes(o.name) ? picked : hidden).add(o);
        } else {
          const chosen = op.options.filter((o) => p.picked.includes(o.name));
          text = [op.preamble, ...chosen.map((o) => `**${o.name}.** ${o.text}`)]
            .filter(Boolean)
            .join('\n\n');
        }
      }
      // what the (chosen part of the) text asks to pick: skills, a damage type, tools, a cantrip...
      for (const pick of traitPicks(text))
        picks.push(make(pick, pick.replaces ? { optional: true } : {}));
      // Simic Hybrid's Grappling Appendages: "Choose whether they're both claws or tentacles."
      const form = /Choose whether they're both (\w+) or (\w+)/i.exec(text);
      if (form) {
        const from = [form[1].toLowerCase(), form[2].toLowerCase()];
        picks.push(
          make(
            { kind: 'form', count: 1, from },
            { options: from.map((name) => ({ name, text: '', level: 1 })) },
          ),
        );
      }
      out.push({
        trait: t,
        variantName,
        key,
        text,
        choiceMissing: !!r.split && r.missing,
        hidden: false,
        picks,
      });
    });
  };
  scan(species.traits, null);
  if (variant) scan(variant.traits, variant.name);
  for (const v of out) {
    if (hidden.has(v.trait)) v.hidden = true;
    if (picked.has(v.trait)) v.pickedOption = true;
  }
  return out;
}

/** Whether the (shown) species traits ask the player to choose INT, WIS or CHA. */
export function speciesAbilityNeeded(views: SpeciesTraitView[]): boolean {
  return views.some((v) => !v.hidden && ABILITY_CHOICE.test(joinBroken(v.text)));
}

/** The spellcasting ability the player picked for the species' traits, if any. */
export function speciesAbility(speciesId: string, choices: Character['choices']): Ability | null {
  const picked = choices.traitPicks?.[speciesAbilityKey(speciesId)]?.[0];
  if (picked === 'INT' || picked === 'WIS' || picked === 'CHA') return picked;
  return choices.featChoices?.['species']?.ability ?? null;
}

/** 'weapon-or-tool' picks store weapons as "weapon:<name>" and tools by their name. */
export const WEAPON_PREFIX = 'weapon:';

/** What the picks inside the species' traits give the character. */
export interface SpeciesGains {
  skills: string[];
  resistances: string[];
  tools: string[];
  weapons: string[];
  /** Cantrips picked, with the trait they come from and its own fixed ability, if any. */
  cantrips: { trait: string; id: string; own: Ability | null }[];
  /** Spells a pick takes the place of (Khoravar's Friends, once another cantrip is picked). */
  replaced: string[];
  /** Traits with a pick still to make. */
  missing: string[];
  /** Picks the text lets the player change after a rest. */
  rest: { key: string; trait: string; rest: 'long' | 'short' }[];
}

export function speciesGains(views: SpeciesTraitView[]): SpeciesGains {
  const g: SpeciesGains = {
    skills: [],
    resistances: [],
    tools: [],
    weapons: [],
    cantrips: [],
    replaced: [],
    missing: [],
    rest: [],
  };
  for (const v of views) {
    if (v.hidden) continue;
    for (const p of v.picks) {
      if (p.picked.length < p.count && !p.optional && !g.missing.includes(v.trait.name))
        g.missing.push(v.trait.name);
      if (p.pick.rest) g.rest.push({ key: p.key, trait: v.trait.name, rest: p.pick.rest });
      for (const value of p.picked)
        switch (p.pick.kind) {
          case 'skill':
            g.skills.push(value);
            break;
          case 'resistance':
            g.resistances.push(value);
            break;
          case 'tool':
            g.tools.push(value);
            break;
          case 'skill-or-tool':
            (SKILL_IDS.has(value) ? g.skills : g.tools).push(value);
            break;
          case 'weapon-or-tool':
            if (value.startsWith(WEAPON_PREFIX)) g.weapons.push(value.slice(WEAPON_PREFIX.length));
            else g.tools.push(value);
            break;
          case 'cantrip': {
            const rules = featRules({ name: v.trait.name, description: v.text });
            const own = rules.ability.mode === 'fixed' ? rules.ability.ability : null;
            g.cantrips.push({ trait: v.trait.name, id: value, own });
            if (p.pick.replaces) g.replaced.push(p.pick.replaces);
            break;
          }
        }
    }
  }
  return g;
}

/** What is shown under a trait on the sheet: the picks made for it. */
export function chosenOf(
  v: SpeciesTraitView,
  ability: Ability | null,
): { kind: string; values: string[] }[] {
  const out: { kind: string; values: string[] }[] = v.picks
    .filter((p) => p.picked.length)
    .map((p) => ({ kind: p.pick.kind, values: p.picked }));
  if (ability && ABILITY_CHOICE.test(joinBroken(v.text)))
    out.push({ kind: 'ability', values: [ability] });
  return out;
}

/**
 * The values of a pick the character already has from somewhere else (background, class, another
 * trait...), not counting what this very pick gives: skills and tools it's proficient with,
 * weapons ("weapon:<name>") it can use, cantrips it knows. For a pick that must be new ("that you
 * don't have", "a different cantrip") these can't be chosen; for the others they're only flagged.
 */
export function hadValues(
  sheet: Sheet,
  p: SpeciesPick,
  weapons: readonly Item[],
  classSpells: readonly string[],
): Set<string> {
  const out = new Set<string>();
  const mine = new Set(p.picked);
  const tools = new Map(sheet.proficiencies.tools.map((t) => [t.toLowerCase(), t]));
  const weaponNames = sheet.proficiencies.weapons.filter((w) => !mine.has(`${WEAPON_PREFIX}${w}`));
  const kind = p.pick.kind;
  if (kind === 'skill' || kind === 'skill-or-tool')
    for (const s of sheet.skills)
      if ((s.proficiency === 'full' || s.proficiency === 'expertise') && !mine.has(s.id))
        out.add(s.id);
  if (kind === 'tool' || kind === 'skill-or-tool' || kind === 'weapon-or-tool')
    for (const [, t] of tools) if (!mine.has(t)) out.add(t);
  if (kind === 'weapon-or-tool')
    for (const w of weapons)
      if (proficientWith(weaponNames, w)) out.add(`${WEAPON_PREFIX}${w.name}`);
  if (kind === 'cantrip') {
    for (const id of [...classSpells, ...sheet.featSpells.map((f) => f.id)])
      if (!mine.has(id)) out.add(id);
    if (p.pick.replaces) out.add(p.pick.replaces);
  }
  return out;
}
