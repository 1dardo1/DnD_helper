import { Character } from '../models/character';
import { DndClass, Feature, Subclass } from '../models/compendium';
import { SpeciesPick, SpeciesTraitView } from './species-picks';
import {
  TraitChoiceSplit,
  TraitOption,
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

/**
 * Armor Model: "choose one of the following armor models: Dreadnought, Guardian, or Infiltrator"
 * with a heading for each model ("##### Dreadnaught.").
 */
const NAMED_CHOOSE =
  /\bchoose one of the following [a-z ]+?: ([A-Z][\w ]*(?:, [A-Z][\w ]*)*,? or [A-Z][\w ]*)\./;

function headedChoice(text: string): TraitChoiceSplit | null {
  if (!HEADED_CHOOSE.test(text) && !NAMED_CHOOSE.test(text)) return null;
  const parts = text.split(/^#{2,6}\s+(.+)$/m);
  if (parts.length < 5) return null;
  const options = [];
  for (let i = 1; i + 1 < parts.length; i += 2)
    options.push({ name: parts[i].trim().replace(/\.$/, ''), text: parts[i + 1].trim() });
  return { preamble: parts[0].trim(), tail: '', options };
}

/**
 * A choice made from a table's rows: "Select one of the giant types from the Mark of the Ordning
 * table" (Giant Soul), "Choose one of the Dead Three: Bane, Bhaal, or Myrkul ... as detailed in the
 * table below" (Scion of the Three). Each row is an option; its columns become what it gives:
 * "Damage Resistance" → Resistance, "Cantrip" → the cantrip, "Spells at ... Level" → the spells.
 */
const TABLE_CHOOSE =
  /\bSelect one of the [\w ]+? from the [\w'’ ]+? table\b|\bChoose one of the [\w ]+?: [A-Z][^.]*\.[^|]*\bas detailed in the table below\b/;

/** The first Markdown table of a text: its header, its rows, and the text before and after it. */
function firstTable(
  text: string,
): { head: string[]; body: string[][]; before: string; after: string } | null {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^\|/.test(l.trim()));
  if (start < 0) return null;
  const rows = lines
    .slice(start)
    .filter((l) => /^\|/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    );
  const [head, , ...body] = rows;
  if (!head) return null;
  const end = lines.slice(start).findIndex((l) => !/^\|/.test(l.trim()) && l.trim());
  return {
    head,
    body,
    before: lines.slice(0, start).join('\n').trim(),
    after:
      end < 0
        ? ''
        : lines
            .slice(start + end)
            .join('\n')
            .trim(),
  };
}

function tableChoice(text: string): TraitChoiceSplit | null {
  const m = TABLE_CHOOSE.exec(text);
  if (!m) return null;
  const table = firstTable(text);
  if (!table || table.body.length < 2) return null;
  const { head, body } = table;
  const said = (h: string, v: string): string | null =>
    /resistance/i.test(h)
      ? `You have Resistance to ${v} damage.`
      : /^cantrip$/i.test(h)
        ? `You know the ${v} cantrip.`
        : /^spells? at/i.test(h)
          ? `You always have the ${v.replace(/, ([^,]+)$/, ' and $1')} ${v.includes(',') ? 'spells' : 'spell'} prepared.`
          : null;
  const options = body.map((r) => ({
    name: r[0],
    text: head
      .slice(1)
      .map((h, i) => said(h, r[i + 1] ?? ''))
      .filter((x): x is string => !!x)
      .join(' '),
  }));
  return { preamble: table.before, tail: table.after, options };
}

/**
 * A choice made from a table's columns: "you thereafter always have the listed primordial spells
 * prepared, along with the spells corresponding to your chosen element" (Primordial Patron's
 * Elemental Spells: | Warlock Level | Primordial Spells | Air Spells | Earth Spells | ...). Each
 * column after the shared one is an option; its table is the shared spells plus its own, by level
 * (what `chosenSpellRows` in engine.ts reads to prepare them).
 */
const COLUMN_CHOOSE = /\balong with the spells corresponding to your chosen (\w+)\b/i;

function columnChoice(text: string): TraitChoiceSplit | null {
  if (!COLUMN_CHOOSE.test(text)) return null;
  const table = firstTable(text);
  if (!table || table.head.length < 4 || !table.body.length) return null;
  const { head, body } = table;
  const options = head.slice(2).map((h, i) => ({
    name: h.replace(/\s+Spells$/i, ''),
    text: [
      `| ${head[0]} | Spells |`,
      '|---|---|',
      ...body.map((r) => `| ${r[0]} | ${[r[1], r[i + 2]].filter(Boolean).join(', ')} |`),
    ].join('\n'),
  }));
  return { preamble: table.before, tail: table.after, options };
}

/**
 * A choice that other features of the same subclass depend on: "you strike a bargain with an
 * otherworldly being of your choice: | The Archfey, the Fiend, or the Great Old One | ... The choice
 * you make augments some of your subclass features, as noted below" (Profane Soul). The options are
 * the names in the table's first column; the features that follow tell, in a bold paragraph per
 * option ("***The Archfey.*** ..."), what each one gives (`linkedFeature`).
 */
const LINKED_CHOOSE = /\bThe choice you make augments some of your subclass features\b/i;

/** "The Archfey" → "archfey": how an option of a linked choice is told apart. */
const linkName = (s: string) =>
  s
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/\.$/, '')
    .toLowerCase();

function linkedChoice(text: string): FeatureSplit | null {
  if (!LINKED_CHOOSE.test(text)) return null;
  const table = firstTable(text);
  if (!table) return null;
  const names = table.body
    .flatMap((r) => r[0].split(/,\s*(?:or\s+)?|\s+or\s+/))
    .map((n) => n.trim().replace(/^the\s+/i, ''))
    .filter(Boolean);
  if (names.length < 2) return null;
  return {
    preamble: table.before,
    tail: table.after,
    options: names.map((name) => ({ name, text: '' })),
    linked: 'bold',
  };
}

/**
 * A choice of another class's subclass, read from the compendium (`related`):
 * - "Select one of the following Cleric domains: Life, Light, Trickery, or War. The Domain Spells
 *   of your chosen domain are Warlock spells for you ... you thereafter always have the listed
 *   spells prepared" (Vestige Spells): the named ones, each with its spells table (prepared by
 *   `chosenSpellRows` in engine.ts like Circle of the Land's).
 * - "choose a cleric domain from your chosen deity's list of eligible domains" (Theurgy's Divine
 *   Inspiration): every domain of the compendium (the deities' lists are not in the data); later
 *   features give that domain's benefits ("you gain your chosen domain's 1st-level benefits").
 */
const SELECT_SUBCLASS = /\bSelect one of the following (\w+) (\w+?)s?: ([^.]+)\./;
const ANY_SUBCLASS = /\bchoose an? (\w+) (domain|circle|oath|patron|college|tradition) from\b/i;

/** The subclass named `name` ("Life") of a class ("cleric"): "Life Domain", the 2024 one first. */
function namedSubclass(
  classId: string,
  name: string,
  related: ReadonlyMap<string, Subclass>,
): Subclass | undefined {
  const found = [...related.values()].filter(
    (s) =>
      s.classId === classId &&
      (s.shortName.toLowerCase() === name.toLowerCase() ||
        s.name.toLowerCase().startsWith(`${name.toLowerCase()} `)) &&
      !/\(/.test(s.name),
  );
  return found.find((s) => s.edition === '2024') ?? found[0];
}

/** A subclass's spells as a table "| Cleric Level | Spells |" (rows `chosenSpellRows` reads). */
function spellsTable(sub: Subclass): string {
  if (!sub.spells?.length) return '';
  const cls = sub.classId
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  return [
    `| ${cls} Level | Spells |`,
    '|---|---|',
    ...sub.spells.map((r) => `| ${r.classLevel} | ${r.spells.join(', ')} |`),
  ].join('\n');
}

function subclassChoice(text: string, related: ReadonlyMap<string, Subclass>): FeatureSplit | null {
  const named = SELECT_SUBCLASS.exec(text);
  if (named) {
    const classId = named[1].toLowerCase();
    const names = named[3]
      .split(/,\s*(?:or\s+)?|\s+or\s+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length < 2) return null;
    return {
      preamble: text,
      tail: '',
      options: names.map((name) => {
        const sub = namedSubclass(classId, name, related);
        return { name, text: sub ? spellsTable(sub) : '' };
      }),
    };
  }
  const any = ANY_SUBCLASS.exec(text);
  if (!any) return null;
  const classId = any[1].toLowerCase();
  const subs = [...related.values()]
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (subs.length < 2) return null;
  return {
    preamble: text,
    tail: '',
    options: subs.map((s) => ({ name: s.name, text: '' })),
    linked: 'subclass',
  };
}

/**
 * "you gain your chosen domain's 1st-level benefits" (Arcane Acolyte, Priest, High Priest), "the
 * Channel Divinity option granted at 2nd level by your chosen domain" (Channel Arcana): what a
 * feature takes from the subclass chosen in a `subclassChoice` of the same subclass.
 */
const SUBCLASS_BENEFITS = /\byou gain your chosen (\w+)'s (\d+)(?:st|nd|rd|th)-level benefits\b/i;
const SUBCLASS_CHANNEL =
  /\bthe Channel Divinity option granted at \d+(?:st|nd|rd|th) level by your chosen (\w+)\b/i;
/** "However, you do not gain any weapon or armor proficiencies from the domain." */
const NO_ARMS = /\bdo not gain any weapon or armor proficiencies\b/i;

/**
 * The chosen subclass's features a feature gives (none while nothing is chosen). The compendium
 * moved the 2014 domains' 1st- and 2nd-level features to the 2024 subclass level (3), so "1st-level
 * benefits" are its features of its first level; the Channel Divinity among them is Channel
 * Arcana's, and its Domain Spells are Arcane Initiate's (a choice of the spellbook, not prepared).
 */
function subclassBenefits(f: Feature, chosen: Subclass | undefined): Feature[] {
  if (!chosen) return [];
  const text = f.description ?? '';
  const first = Math.min(...chosen.features.map((x) => x.level));
  const channel = (x: Feature) => /Channel Divinity/i.test(`${x.name} ${x.description ?? ''}`);
  const own = chosen.features.filter((x) => !/\bSpells$/i.test(x.name));
  if (SUBCLASS_CHANNEL.test(text)) return own.filter((x) => x.level === first && channel(x));
  const m = SUBCLASS_BENEFITS.exec(text);
  if (!m) return [];
  const at = Math.max(Number(m[2]), first);
  return own.filter((x) => x.level === at && !(at === first && channel(x)));
}

/** "you gain proficiency with martial weapons and heavy armor" without the weapons and armor. */
function withoutArms(text: string): string {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => {
      const m = /^(.*\bproficiency with )([^.]+)\.$/i.exec(s);
      if (!m) return s;
      const kept = m[2]
        .split(/,\s*(?:and\s+)?|\s+and\s+/)
        .filter((x) => !/\b(?:armor|weapons?|shields?)\b/i.test(x));
      if (kept.length === m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).length) return s;
      return kept.length ? `${m[1]}${kept.join(' and ')}.` : '';
    })
    .filter(Boolean)
    .join(' ');
}

/** A class/subclass feature's options, and whether other features depend on the one chosen. */
export interface FeatureSplit extends TraitChoiceSplit {
  /**
   * 'bold': other features of the subclass have a bold paragraph per option (Profane Soul's
   * patron); 'subclass': they give the chosen subclass's benefits (Theurgy's domain).
   */
  linked?: 'bold' | 'subclass';
}

/** "one of the following [sacred roles|options|feature options] of your choice". */
const CLASS_CHOOSE =
  /\bone of the following\b[^.\n]*\bof your choice\b|\bChoose one of (?:these|the following)\b|\bone of the following (?:feature )?options\b|\bChoose an? \w+ from the following options\b/i;
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
  /When(?:ever)? you finish a (Short or Long|Long|Short) Rest, you can (?:replace the chosen option|change your choice)/i;
/** "You can change the armor's model whenever you finish a Short or Long Rest" (Armor Model). */
const CHANGE_REST =
  /You can change the [\w'’ ]+? whenever you finish a (Short or Long|Long|Short) Rest/i;

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

/**
 * The options of a feature that offers a choice of one of them (null: no such choice). `related`:
 * the compendium's subclasses, for a choice of another class's subclass (Vestige Spells' domain).
 */
export function featureChoice(
  description: string | null | undefined,
  related?: ReadonlyMap<string, Subclass>,
): FeatureSplit | null {
  const text = joinBroken(description ?? '').replace(/\r\n/g, '\n');
  const headed =
    headedChoice(text) ??
    tableChoice(text) ??
    columnChoice(text) ??
    linkedChoice(text) ??
    (related ? subclassChoice(text, related) : null);
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

/** `f` with another description, the same object for the same `k` (the rules cache by object). */
function withText(f: Feature, k: string, description: () => string): Feature {
  let byChoice = resolvedCache.get(f);
  if (!byChoice) resolvedCache.set(f, (byChoice = new Map()));
  let out = byChoice.get(k);
  if (!out) {
    out = { ...f, description: description() };
    byChoice.set(k, out);
  }
  return out;
}

/** The feature with only the shared text and the chosen option's (same object for the same pick). */
export function resolvedFeature(
  f: Feature,
  split: TraitChoiceSplit,
  chosen: string | null,
): Feature {
  return withText(f, chosen ?? '', () => {
    const option = split.options.find((o) => o.name === chosen);
    // the chosen option's text as plain text (not a bold benefit): it applies like the rest
    return [split.preamble, option?.text ?? '', split.tail].filter(Boolean).join('\n\n');
  });
}

/**
 * "You gain two animal tattoos. Choose two tattoos from the following options. **Bat.** ...
 * **Butterfly.** ..." (Beast Tattoo): some of the options, all at once.
 */
const SOME_OPTIONS = /\bChoose (two|three) [\w ]+? from the following options\b/i;
const COUNT_WORDS: Record<string, number> = { two: 2, three: 3 };

function someOptions(text: string): {
  pick: TraitPick;
  split: TraitChoiceSplit;
  options: (TraitOption & { level: number })[];
} | null {
  const m = SOME_OPTIONS.exec(text);
  if (!m) return null;
  const count = COUNT_WORDS[m[1].toLowerCase()];
  const split = splitOptions(joinBroken(text).replace(/\r\n/g, '\n'));
  if (!split || split.options.length <= count) return null;
  return {
    pick: { kind: 'option', count, from: split.options.map((o) => o.name) },
    split,
    options: split.options.map((o) => ({ ...o, level: 1 })),
  };
}

/**
 * A feature of the subclass that depends on a linked choice (`FeatureSplit.linked`): its text with
 * only the chosen option's part (Profane Soul's Rite Focus: "***The Archfey.*** ..."), or with the
 * chosen subclass's benefits added (Theurgy's Arcane Acolyte). null: it doesn't depend on it.
 */
function linkedFeature(
  f: Feature,
  master: FeatureSplit,
  chosen: string | null,
  related: ReadonlyMap<string, Subclass> | undefined,
): { feature: Feature; summary: (option: string) => string } | null {
  const text = joinBroken(f.description ?? '').replace(/\r\n/g, '\n');
  if (master.linked === 'bold') {
    const names = new Set(master.options.map((o) => linkName(o.name)));
    const split = splitOptions(text);
    if (
      !split ||
      split.options.length < 2 ||
      !split.options.every((o) => names.has(linkName(o.name)))
    )
      return null;
    const part = (option: string | null) =>
      split.options.find((o) => option && linkName(o.name) === linkName(option))?.text ?? '';
    return {
      feature: withText(f, `linked:${chosen ?? ''}`, () =>
        [split.preamble, part(chosen), split.tail].filter(Boolean).join('\n\n'),
      ),
      summary: part,
    };
  }
  if (!SUBCLASS_BENEFITS.test(text) && !SUBCLASS_CHANNEL.test(text)) return null;
  const subOf = (name: string | null) =>
    [...(related?.values() ?? [])].find((s) => !!name && s.name === name);
  const gained = (name: string | null) => subclassBenefits(f, subOf(name));
  return {
    feature: withText(f, `linked:${chosen ?? ''}`, () =>
      [
        text,
        ...gained(chosen).map((x) =>
          NO_ARMS.test(text) ? withoutArms(joinBroken(x.description ?? '')) : x.description,
        ),
      ]
        .filter(Boolean)
        .join('\n\n'),
    ),
    summary: (option) =>
      gained(option)
        .map((x) => x.name)
        .join(', '),
  };
}

/**
 * The class and subclass features the character has, resolved against its picks: with the chosen
 * option only (none of them while nothing is chosen) and what each one asks to pick. `related`:
 * the compendium's subclasses, for the features that choose one of another class's (Vestige
 * Spells, Theurgy).
 */
export function classFeatureViews(
  classes: { cls: DndClass; sub?: Subclass; level: number }[],
  choices: Character['choices'],
  related?: ReadonlyMap<string, Subclass>,
): FeatureChoiceView[] {
  const stored = choices.traitPicks ?? {};
  const out: FeatureChoiceView[] = [];
  const scan = (features: Feature[], level: number, owner: FeatureChoiceView['owner']) => {
    // a choice other features of the subclass depend on (Profane Soul's patron, Theurgy's domain)
    let master: { f: Feature; split: FeatureSplit; chosen: string | null } | null = null;
    for (const f of features) {
      const split = featureChoice(f.description, related);
      if (!split?.linked) continue;
      const chosenName = choices.traitChoices?.[featureChoiceKey(owner.id, f.name)] ?? null;
      const chosen = split.options.some((o) => o.name === chosenName) ? chosenName : null;
      master = { f, split, chosen };
      break;
    }
    const dependents = new Map<Feature, NonNullable<ReturnType<typeof linkedFeature>>>();
    if (master)
      for (const f of features)
        if (f !== master.f) {
          const d = linkedFeature(f, master.split, master.chosen, related);
          if (d) dependents.set(f, d);
        }

    for (const f of features) {
      if (f.level > level) continue;
      const key = featureChoiceKey(owner.id, f.name);
      const dependent = dependents.get(f);
      let split: FeatureSplit | null = dependent ? null : featureChoice(f.description, related);
      if (split && master && f === master.f)
        // each option says what it gives in the features that depend on it
        split = {
          ...split,
          options: split.options.map((o) => ({
            name: o.name,
            text: [...dependents]
              .map(([g, d]) => ({ g, said: d.summary(o.name) }))
              .filter((x) => x.said)
              .map((x) => `**${x.g.name} (${x.g.level}).** ${x.said}`)
              .join('\n\n'),
          })),
        };
      const chosenName = choices.traitChoices?.[key] ?? null;
      const chosen = dependent
        ? (master?.chosen ?? null)
        : split?.options.some((o) => o.name === chosenName)
          ? chosenName
          : null;
      const some = split || dependent ? null : someOptions(f.description ?? '');
      const picks: SpeciesPick[] = [];
      const make = (pick: TraitPick, extra: Partial<SpeciesPick> = {}): SpeciesPick => {
        const k = pickKey(key, pick.kind);
        return {
          key: k,
          traitKey: key,
          trait: f.name,
          pick,
          count: pick.count,
          picked: validPicks(pick, stored[k] ?? [], pick.count),
          ...extra,
        };
      };
      let trait: Feature = f;
      if (dependent) trait = dependent.feature;
      // the linked choice's own text gives nothing: what each option gives is in other features
      else if (split && !split.linked) trait = resolvedFeature(f, split, chosen);
      else if (some) {
        const p = make(some.pick, { options: some.options });
        picks.push(p);
        const picked = some.split.options.filter((o) => p.picked.includes(o.name));
        trait = withText(f, `some:${p.picked.join('|')}`, () =>
          // the chosen options' texts as plain text (not bold options): they apply like the rest
          [some.split.preamble, ...picked.map((o) => o.text), some.split.tail]
            .filter(Boolean)
            .join('\n\n'),
        );
      }
      for (const pick of classPicks(trait.description)) picks.push(make(pick));
      const arcanum = arcanumPick(f.description ?? '', level);
      if (arcanum) picks.push(make(arcanum));
      const rest = split
        ? (OPTION_REST.exec(f.description ?? '') ??
          CHANGE_REST.exec(f.description ?? '') ??
          REST_CHOICE.exec(f.description ?? ''))
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

/**
 * Mystic Arcanum: "Choose one level 6 Warlock spell as this arcanum ... you gain another Warlock
 * spell of your choice that can be cast in this way when you reach Warlock levels 13 (level 7
 * spell), 15 (level 8 spell), and 17 (level 9 spell)": one spell of each level gained so far.
 */
export function arcanumPick(text: string, level: number): TraitPick | null {
  const first = /Choose one level (\d) (\w+) spell as this arcanum/i.exec(text);
  if (!first) return null;
  const levels = [Number(first[1])];
  for (const m of text.matchAll(/(\d+) \(level (\d) spell\)/g))
    if (Number(m[1]) <= level) levels.push(Number(m[2]));
  return {
    kind: 'cantrip',
    count: levels.length,
    from: null,
    lists: [first[2].toLowerCase()],
    spellLevels: 'any',
    levels,
  };
}
