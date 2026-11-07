import { Feature } from '../models/compendium';
import { slug } from './feat-effects';
import { joinBroken } from './trait-effects';

/**
 * A named option inside a trait's text that the player must pick one of (a species' lineage, a
 * reprint's internal tribe/creed...): its own name and the paragraph(s) that are only true when
 * it's the one chosen.
 */
export interface TraitOption {
  name: string;
  text: string;
}

/** A trait's text split into what always applies and the options it asks to choose between. */
export interface TraitChoiceSplit {
  /** Text before the list of options: always true, whichever one is picked. */
  preamble: string;
  /** Text after the list of options (Goliath's Large Form, Powerful Build): also always true. */
  tail: string;
  options: TraitOption[];
}

const CHOOSE = /Choose one of (?:these|the following)\b/i;

/** "**Forest Gnome.** text" / "***Skill Versatility (General).*** text" → { name, rest }. */
function boldHead(line: string): { name: string; rest: string } | null {
  const m = /^\*{2,3}([^*]+?)\.\*{2,3}\s*(.*)$/.exec(line);
  return m ? { name: m[1].trim(), rest: m[2] } : null;
}

/** One "- Name" bullet, with its indented continuation lines (flavor text, sub-bullets...). */
function parseBulletItem(lines: string[]): TraitOption {
  const clean = lines.map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
  const head = clean.length ? boldHead(clean[0]) : null;
  if (head)
    return { name: head.name, text: [head.rest, ...clean.slice(1)].filter(Boolean).join('\n') };
  return { name: (clean[0] ?? '').replace(/\.$/, '').trim(), text: clean.slice(1).join('\n') };
}

/**
 * Splits a trait's text into the part that always applies and a set of named, mutually exclusive
 * options the player picks one of. Returns null when the text has no such choice: most traits,
 * including ones that merely mention "choose" without being this kind of choice (a play-time
 * reselect such as a benefit picked again each time it's used, or a pick made anew each casting).
 * Pure text parsing; what counts as a genuine creation-time choice is decided by the caller.
 */
export function traitChoice(description: string | null | undefined): TraitChoiceSplit | null {
  const text = joinBroken(description ?? '').replace(/\r\n/g, '\n');
  if (!CHOOSE.test(text)) return null;

  // bullet-list style: "- Name\n  - flavor\n  - **Benefit.** text" or flat "- **Name.** text"
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^-\s*\S/.test(l));
  if (start >= 0) {
    const groups: string[][] = [];
    let i = start;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^-\s*\S/.test(l)) groups.push([l]);
      else if (groups.length && (/^\s+\S/.test(l) || l.trim() === ''))
        groups[groups.length - 1].push(l);
      else break;
    }
    if (groups.length >= 2)
      return {
        preamble: lines.slice(0, start).join('\n').trim(),
        tail: lines.slice(i).join('\n').trim(),
        options: groups.map(parseBulletItem),
      };
  }

  // bold-heading style: "**Name.** text ... **Name2.** text2", no bullets at all
  const heads = [...text.matchAll(/\*{2,3}([A-Z][^*\n]+?)\.\*{2,3}/g)];
  if (heads.length >= 2) {
    const options = heads.map((h, idx) => {
      const begin = h.index! + h[0].length;
      const end = idx + 1 < heads.length ? heads[idx + 1].index! : text.length;
      return { name: h[1].trim(), text: text.slice(begin, end).trim() };
    });
    return { preamble: text.slice(0, heads[0].index!).trim(), tail: '', options };
  }
  return null;
}

/**
 * Species traits confirmed to embed a genuine, one-time creation choice: checked explicitly so a
 * trait whose text merely contains "choose" (a play-time reselect, or a pick made anew each time
 * it's used) is never affected. Key: "<speciesId>[:<variant name slug>]:<trait name slug>".
 */
const TRAIT_CHOICE_KEYS = new Set([
  'gnome:gnomish-lineage',
  'goblin:goblin-plane-shift-zendikar:tribe',
  'goliath:giant-ancestry',
]);

/** The key under which a species/variant trait's choice is stored and looked up. */
export function traitChoiceKey(
  speciesId: string,
  variantName: string | null,
  traitName: string,
): string {
  return variantName
    ? `${speciesId}:${slug(variantName)}:${slug(traitName)}`
    : `${speciesId}:${slug(traitName)}`;
}

/** What `resolveTraitChoice` returns for one trait. */
export interface ResolvedTrait {
  /** The text to show and to read for spells/skills/resistances/uses (engine.ts, the sheet). */
  text: string;
  /** Present only when this trait is on the allowlist and its text does split into options. */
  split: TraitChoiceSplit | null;
  /** True when the trait has options (on the allowlist) but none is chosen yet. */
  missing: boolean;
}

/**
 * The split for this trait, only when `key` is on the allowlist and the text does have options —
 * what the wizard's selector checks to decide whether to show itself for a given trait.
 */
export function traitChoiceFor(t: Feature, key: string): TraitChoiceSplit | null {
  return TRAIT_CHOICE_KEYS.has(key) ? traitChoice(t.description) : null;
}

/**
 * Resolves one species/variant trait against the character's stored pick for it (by `key`, from
 * `traitChoiceKey`). Unchanged when the trait isn't on the allowlist, or its text has no options;
 * otherwise the shared text plus only the chosen option's — or, with nothing chosen, the shared
 * text alone, `missing: true`, so none of the options' spells/skills/resistances/uses apply.
 */
export function resolveTraitChoice(
  t: Feature,
  key: string,
  chosen: string | null | undefined,
): ResolvedTrait {
  const split = traitChoiceFor(t, key);
  if (!split) return { text: t.description, split: null, missing: false };
  const option = split.options.find((o) => o.name === chosen);
  const text = [split.preamble, option?.text, split.tail].filter(Boolean).join('\n\n');
  return { text, split, missing: !option };
}
