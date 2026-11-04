import { Ability } from '../models/compendium';

/**
 * Reads the stat blocks written as markdown tables inside spell and feature descriptions (the
 * 2024 "Summon X" spirits, familiars, steeds, companions…) into a template: the formulas are kept
 * as text ("11 + the spell's level"), and resolve.ts turns them into numbers for a slot level.
 * Pure; whatever it does not understand is kept in `rows` so nothing is lost.
 */

export type BlockSection = 'traits' | 'actions' | 'bonusActions' | 'reactions';

export interface BlockRow {
  /** "Rend" ("Bite (Tyrannosaur Only)" → name "Bite"). */
  name: string;
  /** What was in parentheses after the name: ["Tyrannosaur Only"], ["1/Day"]. */
  tags: string[];
  /** The text after the name (markdown). */
  text: string;
}

export interface StatBlockTemplate {
  /** "Bestial Spirit". */
  title: string;
  /** "Small Beast, Neutral" as written. */
  typeLine: string;
  /** Formulas, as written. */
  ac: string;
  hp: string;
  speed: string;
  abilities: Record<Ability, number>;
  /** Raw "Acid (Water only), Lightning and Thunder (Air only)". */
  vulnerabilities: string;
  resistances: string;
  /** Damage and conditions together, as written. */
  immunities: string;
  senses: string;
  languages: string;
  sections: Record<BlockSection, BlockRow[]>;
}

const ABILITY_CODES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** Cells of a markdown table row: "| a | b |" → ["a", "b"]. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

const clean = (s: string) =>
  s
    .replace(/\*\*|__/g, '')
    .replace(/^#+\s*/, '')
    .replace(/[*_]+$/g, '')
    .trim();

/** The text up to the first ". " that isn't inside parentheses/brackets → [name, rest]. */
function splitName(row: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === '.' && depth === 0 && (row[i + 1] === ' ' || i === row.length - 1)) {
      return [row.slice(0, i), row.slice(i + 1).trim()];
    }
  }
  return [row, ''];
}

/** "Bite (Tyrannosaur Only; Recharges after a Long Rest)" → name and tags. */
export function splitTags(full: string): { name: string; tags: string[] } {
  const tags: string[] = [];
  const name = full
    .replace(/\s*\(([^()]*)\)/g, (_, inner: string) => {
      tags.push(...inner.split(/;\s*/).map((t) => t.trim()));
      return '';
    })
    .trim();
  return { name, tags: tags.filter(Boolean) };
}

const SECTION_HEADS: [RegExp, BlockSection][] = [
  [/^traits$/i, 'traits'],
  [/^actions$/i, 'actions'],
  [/^bonus actions?$/i, 'bonusActions'],
  [/^reactions?$/i, 'reactions'],
];

/**
 * Lists that put the condition first ("(Gem Only) force, necrotic") get it after each name, and
 * several lines of the same kind become one list.
 */
function join(old: string, value: string): string {
  const lead = /^\(([^()]*)\)\s*(.*)$/.exec(value);
  const v = lead
    ? lead[2]
        .split(/,\s*/)
        .map((n) => `${n} (${lead[1]})`)
        .join(', ')
    : value;
  return old ? `${old}, ${v}` : v;
}

/** The tables that are stat blocks (they have an "Armor Class:" row) in a markdown text. */
export function extractStatBlocks(markdown: string): StatBlockTemplate[] {
  const lines = markdown.split('\n');
  const out: StatBlockTemplate[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\|\s*Armor Class\b/i.test(lines[i])) continue;
    // the table starts at the type line, two rows above (header + separator)
    let start = i - 1;
    if (!/^\|\s*-/.test(lines[start] ?? '')) continue;
    start -= 1;
    if (start < 0 || !lines[start].startsWith('|')) continue;
    let end = i;
    while (end + 1 < lines.length && lines[end + 1].startsWith('|')) end++;
    let t = start - 1;
    while (t >= 0 && !lines[t].trim()) t--;
    const title = t >= 0 ? clean(lines[t]) : '';
    out.push(parseTable(title, lines.slice(start, end + 1)));
    i = end;
  }
  return out;
}

function parseTable(title: string, table: string[]): StatBlockTemplate {
  const block: StatBlockTemplate = {
    title,
    typeLine: clean(cells(table[0])[0] ?? ''),
    ac: '',
    hp: '',
    speed: '',
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    vulnerabilities: '',
    resistances: '',
    immunities: '',
    senses: '',
    languages: '',
    sections: { traits: [], actions: [], bonusActions: [], reactions: [] },
  };
  let section: BlockSection = 'traits';
  let abilityRow = false;
  const damageImm: string[] = [];
  const conditionImm: string[] = [];
  for (const line of table.slice(2)) {
    const raw = clean(cells(line)[0] ?? '');
    if (!raw) continue;
    if (abilityRow) {
      abilityRow = false;
      // "18 (+4/+4) | 11 (+0/+0) | …": the scores in the columns
      cells(line).forEach((c, k) => {
        const n = /^(\d+)/.exec(c);
        if (n && ABILITY_CODES[k]) block.abilities[ABILITY_CODES[k]] = +n[1];
      });
      continue;
    }
    if (/^STR\b/i.test(raw)) {
      abilityRow = true;
      continue;
    }
    const head = SECTION_HEADS.find(([rx]) => rx.test(raw));
    if (head) {
      section = head[1];
      continue;
    }
    const field =
      /^(Armor Class|Hit Points|Speed|Initiative|Senses|Languages?|Challenge(?: Rating)?|Proficiency Bonus|Saving Throws|Skills|Vulnerabilities|Damage Vulnerabilities|Resistances|Damage Resistances|Immunities|Damage Immunities|Condition Immunities)\b:?\s*(.*)$/i.exec(
        raw,
      );
    if (field) {
      const key = field[1].toLowerCase();
      const value = field[2].trim();
      if (key === 'armor class') block.ac = value;
      else if (key === 'hit points') block.hp = value.replace(/^HP\s+/i, '');
      else if (key === 'speed') block.speed = value.replace(/^Speed\s+/i, '');
      else if (key.startsWith('language')) block.languages = value;
      else if (key === 'senses') block.senses = value;
      else if (/vulnerabilities$/.test(key))
        block.vulnerabilities = join(block.vulnerabilities, value);
      else if (/resistances$/.test(key)) block.resistances = join(block.resistances, value);
      else if (key === 'condition immunities') conditionImm.push(join('', value));
      else if (key === 'damage immunities') damageImm.push(join('', value));
      else if (key === 'immunities') damageImm.push(value.replace(/^Immunities\s+/i, ''));
      continue;
    }
    // a feature row: "Name (tags). Text"
    let [full, text] = splitName(raw);
    // "Haunt Creature The spirit targets…": a row with no period after its name
    if (full.length > 60) {
      const cut = /^(.{3,40}?)\s+(?=(?:The|Each|When|Whenever|You|It|At)\s)/.exec(raw);
      if (cut) [full, text] = [cut[1], raw.slice(cut[0].length)];
    }
    const { name, tags } = splitTags(full);
    block.sections[section].push({ name, tags, text });
  }
  block.immunities = [...damageImm, ...conditionImm].filter(Boolean).join('; ');
  return block;
}
