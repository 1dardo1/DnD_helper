import { Feature } from '../models/compendium';
import { slug } from './feat-effects';
import { SKILL_ABILITY } from './tables';
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

const CHOOSE = /Choose one of (?:these|the following)\b|one of the following options\b/i;
/** A pick made anew at every rest or use: not a choice of the character sheet. */
const RECHOOSE = /\beach time\b|\buntil you choose a different\b/i;
/** A skill / damage type picked again after a rest (Kalashtar, Astral Trance), not once. */
const REPICK =
  /\beach time\b|\bwhenever you finish\b|\bwhen you finish a (?:long|short) rest\b|\buntil you choose a different\b/i;

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
  // a bare sentence ("- Proficiency in one skill of your choice."): it is the option's own text too
  const name = (clean[0] ?? '').replace(/\.$/, '').trim();
  return { name, text: clean.length > 1 ? clean.slice(1).join('\n') : (clean[0] ?? '') };
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
  const found = CHOOSE.exec(text);
  if (!found) return null;
  // the line that asks for the pick says it's made again every rest / use: leave it as text
  const lineStart = text.lastIndexOf('\n', found.index) + 1;
  const lineEnd = text.indexOf('\n', found.index);
  if (RECHOOSE.test(text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd))) return null;
  return splitOptions(text);
}

/**
 * The options of a trait's text in another language (the Spanish translation, which doesn't
 * say "Choose one of the following" in English words): same split, no gate. The wizard pairs these
 * with the English options by position to show them translated.
 */
export function translatedOptions(description: string | null | undefined): TraitOption[] {
  return splitOptions(joinBroken(description ?? '').replace(/\r\n/g, '\n'))?.options ?? [];
}

function splitOptions(text: string): TraitChoiceSplit | null {
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
  /** Present only when the trait's text splits into options to choose one of. */
  split: TraitChoiceSplit | null;
  /** True when the trait has options but none is chosen yet. */
  missing: boolean;
}

/**
 * The split for this trait when its text has options to choose one of; the text alone decides
 * (`_key` is kept for callers that have it). What the wizard's selector checks to show itself.
 */
export function traitChoiceFor(t: Feature, _key?: string): TraitChoiceSplit | null {
  return traitChoice(t.description);
}

/**
 * Resolves one species/variant trait against the character's stored pick for it (by `key`, from
 * `traitChoiceKey`). Unchanged when its text has no options;
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

/**
 * Something the player picks inside a trait (or inside the option of it that was chosen): which
 * skills ("one of the following skills of your choice: ..."), or which damage type to resist.
 * `from` is the closed list the text names, null when any is allowed. Picks made anew at every
 * rest or use are not picks of the character sheet and aren't returned.
 */
export interface TraitPick {
  kind: 'skill' | 'resistance';
  count: number;
  /** Skill ids (kind 'skill') or damage type names (kind 'resistance'); null = any skill. */
  from: string[] | null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3 };
const SKILL_IDS = new Set(Object.keys(SKILL_ABILITY));

function skillList(list: string): string[] {
  return list
    .split(/,|\bor\b|\band\b/)
    .map((w) => w.trim().replace(/\.$/, '').toLowerCase().replace(/\s+/g, '-'))
    .filter((id) => SKILL_IDS.has(id));
}

/** The picks a trait's (already option-resolved) text asks the player for. */
export function traitPicks(description: string | null | undefined): TraitPick[] {
  const text = joinBroken(description ?? '').replace(/\r\n/g, '\n');
  const out: TraitPick[] = [];
  for (const sentence of text.split(/(?<=\.)\s+|\n+/)) {
    if (REPICK.test(sentence) || /\btools?\b|\bweapon/i.test(sentence)) continue;
    const sk =
      /\b(one|two|three)\s+(?:of the following\s+)?skills?\b(?:\s+proficienc\w+)?[^.:]*?\bof your choice\b(?::\s*(.+))?/i.exec(
        sentence,
      );
    if (sk) {
      const from = sk[2] ? skillList(sk[2]) : [];
      out.push({
        kind: 'skill',
        count: NUMBER_WORDS[sk[1].toLowerCase()],
        from: from.length ? from : null,
      });
      continue;
    }
    const res = /Resistance to one of the following damage types of your choice:\s*(.+?)\.?$/i.exec(
      sentence,
    );
    if (res) {
      const from = res[1]
        .split(/,|\bor\b/)
        .map((w) => w.trim())
        .filter(Boolean);
      if (from.length) out.push({ kind: 'resistance', count: 1, from });
    }
  }
  return out;
}

/** Where the picks of one kind inside a trait are stored (`choices.traitPicks`). */
export const pickKey = (traitKey: string, kind: TraitPick['kind']): string => `${traitKey}#${kind}`;

/** The picks the player made that are valid for `pick` (from the allowed list, no more than asked). */
export function validPicks(pick: TraitPick, stored: string[] | undefined): string[] {
  const ok = (stored ?? []).filter((v) => !pick.from || pick.from.includes(v));
  return [...new Set(ok)].slice(0, pick.count);
}
