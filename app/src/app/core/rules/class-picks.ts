import { Character } from '../models/character';
import { DndClass, Feature, Subclass } from '../models/compendium';
import { SpeciesPick, SpeciesTraitView } from './species-picks';
import {
  TraitChoiceSplit,
  TraitPick,
  pickKey,
  splitOptions,
  traitPicks,
  validPicks,
} from './trait-choices';
import { joinBroken } from './trait-effects';

/**
 * Choices inside class and subclass features, worked out from their text like the species' ones
 * (species-picks.ts): a feature that offers "one of the following options of your choice" (Divine
 * Order, Primal Order, Blessed Strikes, Elemental Fury, Hunter's Prey...) and what a feature asks to
 * pick inside it (a skill, a damage type, a cantrip, tools...). Stored with the species' picks:
 * the option in `choices.traitChoices[key]`, the picks in `choices.traitPicks[pickKey(key, kind)]`,
 * with keys "class:<class or subclass id>:<feature>" that can't clash with the species' ones.
 */

/**
 * "Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical.
 * Consult the table below that corresponds to the chosen type" (Circle of the Land): the options
 * are the headings ("##### Arid Land") with their tables.
 */
const HEADED_CHOOSE =
  /\bchoose one type of (\w+)\b[^.]*\.\s*Consult the table below that corresponds/i;

function headedChoice(text: string): TraitChoiceSplit | null {
  const m = HEADED_CHOOSE.exec(text);
  if (!m) return null;
  const parts = text.split(/^#{2,6}\s+(.+)$/m);
  if (parts.length < 5) return null;
  const options = [];
  for (let i = 1; i + 1 < parts.length; i += 2)
    options.push({ name: parts[i].trim(), text: parts[i + 1].trim() });
  return { preamble: parts[0].trim(), tail: '', options };
}

/** "one of the following [sacred roles|options|feature options] of your choice". */
const CLASS_CHOOSE =
  /\bone of the following\b[^.\n]*\bof your choice\b|\bChoose one of (?:these|the following)\b|\bone of the following (?:feature )?options\b/i;
/**
 * The options are effects picked in play, every time the feature is used (Blade Flourish, Spellfire
 * Burst, a Rage's animal...): not a choice of the character sheet.
 */
const IN_PLAY =
  /\beach time\b|\bas an? (?:Bonus Action|action|Magic action|Reaction)\b|\bwhen you (?:hit|use|cast|take|activate|score|spend|do so|reach)\b|\bwhenever you (?:activate|create|take|cast|score|hit)\b|\bwhile\b|\bonce per turn\b|\bfor each\b|\bthe target\b|\buntil the end\b|\bfor the duration\b/i;
/** "one of the following skills / damage types / cantrips": a pick (traitPicks), not named options. */
const PLAIN_PICK =
  /one of the following (?:skills?|languages?|damage types?|cantrips?|spells?|conditions?)\b/i;
/** "When you finish a short or long rest, choose one of the following benefits" (Bestial Soul). */
const REST_CHOICE =
  /When(?:ever)? you finish a (short or long|long|short) rest, choose one (?:of the following|type of)/i;
/** "Whenever you finish a Short or Long Rest, you can replace the chosen option with the other". */
const OPTION_REST =
  /Whenever you finish a (Short or Long|Long|Short) Rest, you can (?:replace the chosen option|change your choice)/i;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Where a class/subclass feature's choice is stored. `owner`: class id or subclass id. */
export const featureChoiceKey = (owner: string, featureName: string): string =>
  `class:${owner}:${slug(featureName)}`;

/** A class/subclass feature as it applies to the character (same shape as a species trait). */
export interface FeatureChoiceView extends SpeciesTraitView {
  /** Class (or subclass) that grants it, and the class it belongs to. */
  owner: { type: 'class' | 'subclass'; id: string; classId: string };
  /** The named options, when the feature is a choice of one of them. */
  split: TraitChoiceSplit | null;
  /** The chosen option's name. */
  chosen: string | null;
  /** The option can be changed after this rest (Hunter's Prey, Defensive Tactics). */
  optionRest?: 'long' | 'short';
}

/** The options of a feature that offers a choice of one of them (null: no such choice). */
export function featureChoice(description: string | null | undefined): TraitChoiceSplit | null {
  const text = joinBroken(description ?? '').replace(/\r\n/g, '\n');
  const headed = headedChoice(text);
  if (headed) return headed;
  const found = CLASS_CHOOSE.exec(text);
  if (!found) return null;
  const lineStart = text.lastIndexOf('\n', found.index) + 1;
  const lineEnd = text.indexOf('\n', found.index);
  const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim();
  // inside a bold benefit or a table row: a pick of that benefit, not a choice of the feature
  if (/^\*\*|^\|/.test(line) || PLAIN_PICK.test(line)) return null;
  if (!REST_CHOICE.test(line) && IN_PLAY.test(line)) return null;
  const split = splitOptions(text);
  return split && split.options.length >= 2 ? split : null;
}

const resolvedCache = new WeakMap<Feature, Map<string, Feature>>();

/** The feature with only the shared text and the chosen option's (same object for the same pick). */
export function resolvedFeature(
  f: Feature,
  split: TraitChoiceSplit,
  chosen: string | null,
): Feature {
  let byChoice = resolvedCache.get(f);
  if (!byChoice) resolvedCache.set(f, (byChoice = new Map()));
  const k = chosen ?? '';
  let out = byChoice.get(k);
  if (!out) {
    const option = split.options.find((o) => o.name === chosen);
    // the chosen option's text as plain text (not a bold benefit): it applies like the rest
    const description = [split.preamble, option?.text ?? '', split.tail]
      .filter(Boolean)
      .join('\n\n');
    out = { ...f, description };
    byChoice.set(k, out);
  }
  return out;
}

/**
 * The class and subclass features the character has, resolved against its picks: with the chosen
 * option only (none of them while nothing is chosen) and what each one asks to pick.
 */
export function classFeatureViews(
  classes: { cls: DndClass; sub?: Subclass; level: number }[],
  choices: Character['choices'],
): FeatureChoiceView[] {
  const stored = choices.traitPicks ?? {};
  const out: FeatureChoiceView[] = [];
  const scan = (features: Feature[], level: number, owner: FeatureChoiceView['owner']) => {
    for (const f of features) {
      if (f.level > level) continue;
      const key = featureChoiceKey(owner.id, f.name);
      const split = featureChoice(f.description);
      const chosenName = choices.traitChoices?.[key] ?? null;
      const chosen = split?.options.some((o) => o.name === chosenName) ? chosenName : null;
      const trait = split ? resolvedFeature(f, split, chosen) : f;
      const picks: SpeciesPick[] = [];
      const make = (pick: TraitPick): SpeciesPick => {
        const k = pickKey(key, pick.kind);
        return {
          key: k,
          traitKey: key,
          trait: f.name,
          pick,
          count: pick.count,
          picked: validPicks(pick, stored[k] ?? [], pick.count),
        };
      };
      for (const pick of classPicks(trait.description)) picks.push(make(pick));
      const rest = split
        ? (OPTION_REST.exec(f.description ?? '') ?? REST_CHOICE.exec(f.description ?? ''))
        : null;
      out.push({
        trait,
        variantName: null,
        key,
        text: trait.description,
        choiceMissing: !!split && !chosen,
        hidden: false,
        picks,
        owner,
        split,
        chosen,
        ...(rest
          ? { optionRest: /short/i.test(rest[1]) ? ('short' as const) : ('long' as const) }
          : {}),
      });
    }
  };
  for (const c of classes) {
    scan(c.cls.features, c.level, { type: 'class', id: c.cls.id, classId: c.cls.id });
    if (c.sub) scan(c.sub.features, c.level, { type: 'subclass', id: c.sub.id, classId: c.cls.id });
  }
  return out;
}

/**
 * What a class feature asks to pick. The species' reader (traitPicks), minus what doesn't belong
 * to the character sheet in a class's text: picks made in play ("choose when you hit", "each
 * time") and picks of the spell lists (the spell selection handles those).
 */
export function classPicks(text: string): TraitPick[] {
  return traitPicks(text).filter((p) => p.kind !== 'option' && p.kind !== 'form');
}
