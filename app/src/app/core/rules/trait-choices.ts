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

/** "**Forest Gnome.** text" / "***Skill Versatility (General).*** text" → { name, rest }. */
function boldHead(line: string): { name: string; rest: string } | null {
  const m = /^\*{2,3}([^*]+?)\.\*{2,3}\s*(.*)$/.exec(line);
  return m ? { name: m[1].trim(), rest: m[2] } : null;
}

/** One "- Name" bullet, with its indented continuation lines (flavor text, sub-bullets...). */
function parseBulletItem(lines: string[]): TraitOption {
  // Reprints tell each option as "- Name" + a sub-bullet of flavor + sub-bullets that are the
  // benefits ("**Grotag Tamer.** You have proficiency in..."). When there are benefits, the flavor
  // sub-bullets are dropped: what matters when choosing is what the option gives.
  const subs = lines.slice(1).filter((l) => /^[ \t]+-[ \t]*\S/.test(l));
  const benefit = subs.some((l) => boldHead(l.replace(/^[ \t]*-[ \t]*/, '').trim()));
  const kept = benefit
    ? lines.filter(
        (l, i) =>
          i === 0 ||
          !/^[ \t]+-[ \t]*\S/.test(l) ||
          boldHead(l.replace(/^[ \t]*-[ \t]*/, '').trim()),
      )
    : lines;
  const clean = kept.map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
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

export function splitOptions(text: string): TraitChoiceSplit | null {
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
 * skills ("one of the following skills of your choice: ..."), which damage type to resist, which
 * tools, weapons or cantrip, or which of a set of named options (Simic Hybrid's enhancements, an
 * Eladrin's season, a Duskling's benefit). `from` is the closed list the text names, null when any
 * is allowed. `rest` marks a pick the text lets the player make anew after every rest (Kalashtar,
 * Astral Knowledge, an Eladrin's Trance...): it is still the character's current choice.
 */
export interface TraitPick {
  kind: TraitPickKind;
  count: number;
  /**
   * Skill ids ('skill'), damage types ('resistance'), cantrip ids ('cantrip'), tool names ('tool')
   * or option names ('option', 'form'); null = any of its kind.
   */
  from: string[] | null;
  /** 'tool': only this kind of tool (a key of TOOL_GROUPS: "Musical Instrument"). */
  group?: string;
  /** 'cantrip': the spell lists it may come from ("wizard"). */
  lists?: string[];
  /** Chosen anew when the character finishes this rest. */
  rest?: 'long' | 'short';
  /** The text asks for something the character doesn't have yet ("that you don't have", "a different cantrip"). */
  notHad?: boolean;
  /** 'cantrip': the spell (id) the pick takes the place of (Khoravar's Fey Gift: Friends). */
  replaces?: string;
  /** 'option': the character level at which each pick is gained (Simic Hybrid: [1, 5]). */
  unlock?: number[];
}

export type TraitPickKind =
  | 'skill'
  | 'resistance'
  | 'tool'
  | 'skill-or-tool'
  | 'weapon-or-tool'
  | 'cantrip'
  | 'option'
  | 'form';

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3 };
export const SKILL_IDS = new Set(Object.keys(SKILL_ABILITY));

function skillList(list: string): string[] {
  return list
    .split(/,|\bor\b|\band\b/)
    .map((w) => w.trim().replace(/\.$/, '').toLowerCase().replace(/\s+/g, '-'))
    .filter((id) => SKILL_IDS.has(id));
}

/** "Dancing Lights, Light, or Sacred Flame" → spell ids. */
function spellIds(list: string): string[] {
  return list
    .split(/,\s*(?:or\s+)?|\s+or\s+/)
    .map((w) => slug(w.replace(/\.$/, '').trim()))
    .filter(Boolean);
}

/** A whole sentence that says the pick can be changed after a rest. */
const REST_SENTENCE =
  /\bwhenever you finish (?:a |your |this )?(?:long rest|short rest|trance)|\bwhen you finish a (?:long|short) rest\b/i;
/** "Whenever you finish a Long Rest, you can replace it with another skill or tool proficiency." */
const REPLACE_ON_REST =
  /Whenever you finish a (Long|Short) Rest, you can replace (?:it|that cantrip)\b/i;

/** The picks a trait's (already option-resolved) text asks the player for. */
export function traitPicks(description: string | null | undefined): TraitPick[] {
  const text = joinBroken(description ?? '').replace(/\r\n/g, '\n');
  const out: TraitPick[] = [];
  const replace = REPLACE_ON_REST.exec(text);
  const traitRest = replace ? (replace[1].toLowerCase() as 'long' | 'short') : undefined;
  for (const sentence of text.split(/(?<=\.)\s+|\n+/)) {
    // a pick "each time" the trait is used (Fey Gift's Help, a transformation) is not a pick of
    // the sheet; one made anew at every rest is the character's current choice
    if (/\beach time\b|\buntil you choose a different\b/i.test(sentence)) continue;
    const rest: TraitPick['rest'] = REST_SENTENCE.test(sentence)
      ? /short rest/i.test(sentence)
        ? 'short'
        : 'long'
      : traitRest;
    const add = (p: TraitPick) => out.push(rest ? { ...p, rest } : p);

    // Khoravar: "one skill or with one tool of your choice" — one pick, of either kind
    if (/\bone skill or (?:with )?one tool of your choice/i.test(sentence)) {
      add({ kind: 'skill-or-tool', count: 1, from: null });
      continue;
    }
    // Khoravar's Fey Gift: "replace that cantrip with a different cantrip from the Cleric, Druid,
    // or Wizard spell list"
    const swap =
      /replace that cantrip with a different cantrip from the ([A-Za-z, ]+?) spell lists?/i.exec(
        sentence,
      );
    if (swap) {
      const known = /You know the ([A-Z][\w'’ ]+?) cantrip/.exec(text);
      add({
        kind: 'cantrip',
        count: 1,
        from: null,
        lists: listNames(swap[1]),
        notHad: true,
        ...(known ? { replaces: slug(known[1]) } : {}),
      });
      continue;
    }
    // "one weapon or tool of your choice" / "two proficiencies that you don't have, each one with
    // a weapon or a tool of your choice"
    const wt =
      /\b(one|two)\s+(?:proficiencies\b([^.]*?)\beach one with a\s+)?weapon or (?:a\s+)?tool\b/i.exec(
        sentence,
      );
    if (wt)
      add({
        kind: 'weapon-or-tool',
        count: NUMBER_WORDS[wt[1].toLowerCase()],
        from: null,
        ...(/don'?t have|do not have/i.test(wt[2] ?? '') ? { notHad: true } : {}),
      });
    // tools: "one tool proficiency of your choice", "two tool proficiencies of your choice",
    // "proficient with one tool of your choice", "one musical instrument of your choice"
    const tl =
      /\b(one|two)\s+tool proficienc(?:y|ies) of your choice|\bwith (one) tool of your choice/i.exec(
        sentence,
      );
    if (tl) add({ kind: 'tool', count: NUMBER_WORDS[(tl[1] ?? tl[2]).toLowerCase()], from: null });
    const kind = /\b(one|two)\s+(musical instrument|gaming set)s? of your choice/i.exec(sentence);
    if (kind)
      add({
        kind: 'tool',
        count: NUMBER_WORDS[kind[1].toLowerCase()],
        from: null,
        group: kind[2].toLowerCase() === 'gaming set' ? 'Gaming Set' : 'Musical Instrument',
      });
    // cantrips: "one cantrip of your choice from the wizard spell list", "one of the following
    // cantrips of your choice: Dancing Lights, Light, or Sacred Flame"
    const cl = /\bone cantrip of your choice from the (\w+) spell list/i.exec(sentence);
    if (cl) add({ kind: 'cantrip', count: 1, from: null, lists: [cl[1].toLowerCase()] });
    const cf = /\bone of the following cantrips of your choice:\s*(.+?)\.?$/i.exec(sentence);
    if (cf) add({ kind: 'cantrip', count: 1, from: spellIds(cf[1]) });

    const sk =
      /\b(one|two|three)\s+(?:of the following\s+)?skills?\b(?:\s+proficienc\w+)?[^.:]*?\bof your choice\b(?::\s*(.+))?/i.exec(
        sentence,
      );
    if (sk) {
      const from = sk[2] ? skillList(sk[2]) : [];
      add({
        kind: 'skill',
        count: NUMBER_WORDS[sk[1].toLowerCase()],
        from: from.length ? from : null,
      });
      continue;
    }
    // Viashino: "proficiency in the Acrobatics or the Stealth skill (your choice)"
    const two = /proficiency in the (\w[\w ]*?) or the (\w[\w ]*?) skill \(your choice\)/i.exec(
      sentence,
    );
    if (two) {
      add({ kind: 'skill', count: 1, from: skillList(`${two[1]}, ${two[2]}`) });
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
      if (from.length) add({ kind: 'resistance', count: 1, from });
    }
  }
  return out;
}

/** "Cleric, Druid, or Wizard" → ['cleric', 'druid', 'wizard']. */
function listNames(raw: string): string[] {
  return raw
    .split(/,\s*(?:or\s+)?|\s+or\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

/** Where the picks of one kind inside a trait are stored (`choices.traitPicks`). */
export const pickKey = (traitKey: string, kind: TraitPickKind): string => `${traitKey}#${kind}`;

/** The picks the player made that are valid for `pick` (from the allowed list, no more than asked). */
export function validPicks(
  pick: TraitPick,
  stored: string[] | undefined,
  count: number = pick.count,
): string[] {
  const ok = (stored ?? []).filter((v) => !pick.from || pick.from.includes(v));
  return [...new Set(ok)].slice(0, count);
}
