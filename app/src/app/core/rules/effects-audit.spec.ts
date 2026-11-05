import classes from '../../../../../data/classes.json';
import feats from '../../../../../data/feats.json';
import options from '../../../../../data/options.json';
import species from '../../../../../data/species.json';
import subclasses from '../../../../../data/subclasses.json';
import { featRules } from './feat-effects';
import { traitRules } from './trait-effects';

/**
 * Audit of the data: every text that states a mechanical effect in a form the parser can read
 * must come out of the parser (APPLIED). What the heuristics find but the parser leaves out is a
 * conditional effect (Rage, a Bonus Action, a choice...): it stays as text on the sheet (TEXT).
 * The test fails when an unconditional statement is lost, and prints the table of counts.
 */

interface Src {
  kind: string;
  id: string;
  name: string;
  description: string;
  edition?: string;
  ua: boolean;
}

const all: Src[] = [];
const push = (kind: string, id: string, name: string, description: string, ed?: string) =>
  all.push({
    kind,
    id,
    name,
    description: description ?? '',
    edition: ed,
    ua: /-ua|\bua\b/.test(id),
  });
for (const c of classes as any[])
  for (const f of c.features) push('class', c.id, f.name, f.description, c.edition);
for (const c of subclasses as any[])
  for (const f of c.features) push('subclass', c.id, f.name, f.description, c.edition);
for (const c of species as any[]) {
  for (const f of c.traits) push('species', c.id, f.name, f.description, c.edition);
  for (const v of c.variants) {
    for (const f of v.traits) push('species', c.id, f.name, f.description, c.edition);
    push('species', c.id, v.name, v.description, c.edition);
  }
}
for (const o of options as any[]) push('option', o.id, o.name, o.description, o.edition);
for (const f of feats as any[]) push('feat', f.id, f.name, f.description, f.edition);

const COND =
  /\b(while|when|whenever|until|if|as an? (?:Bonus Action|Action|Magic action|Reaction)|as long as|choose|of your choice|nonmagical|each time|you can use|instead|Rage|transform|temporar)/i;
const sentences = (t: string) => t.replace(/\*+/g, '').split(/(?<=[.!?])\s+/);

/** Texts that state it but only in a situation (Focus Points, a form, a surge): text on the sheet. */
const TEXT_ONLY = new Set([
  'class:monk:Superior Defense',
  'subclass:sorcerer/shadow-sorcery:Umbral Form',
  'subclass:sorcerer/wild-magic-sorcery:Tamed Surge',
  'subclass:wizard/abjurer:Spell Resistance',
]);

interface Check {
  id: string;
  expect: (s: string) => boolean;
  applied: (src: Src) => boolean;
}

const checks: Check[] = [
  {
    id: 'resistance',
    expect: (s) =>
      /\bYou (?:also )?(?:have|gain) Resistance to [A-Z][a-z]+(?: damage| and)/i.test(s) &&
      !COND.test(s),
    applied: (x) => traitRules({ name: x.name, description: x.description }).resistances.length > 0,
  },
  {
    id: 'sense',
    expect: (s) =>
      /(Darkvision|Blindsight|Truesight) with a range of \d+ feet/i.test(s) && !COND.test(s),
    applied: (x) => traitRules({ name: x.name, description: x.description }).senses.length > 0,
  },
  {
    id: 'spell',
    expect: (s) =>
      /You (?:also )?(?:learn|know) the [A-Z][\w' ]+ (?:cantrip|spell)\b/.test(s) && !COND.test(s),
    applied: (x) => featRules({ name: x.name, description: x.description }).spells.length > 0,
  },
  {
    id: 'uses',
    expect: (s) =>
      /a number of times equal to your (?:Proficiency Bonus|\w+ modifier)/i.test(s) &&
      /regain/i.test(s),
    applied: (x) =>
      featRules({ name: x.name, description: x.description }).uses.length > 0 ||
      featRules({ name: x.name, description: x.description }).spells.some((g) => g.free),
  },
  {
    id: 'skill',
    expect: (s) =>
      /\bYou (?:also )?(?:have|gain) proficiency in the [A-Z][a-z]+ skill\b/.test(s) &&
      !/\bor\b/.test(s),
    applied: (x) => traitRules({ name: x.name, description: x.description }).skills.length > 0,
  },
  {
    id: 'unarmored-ac',
    expect: (s) =>
      /base Armor Class (?:equals|is) \d+/i.test(s) &&
      !COND.test(s.replace(/^While you aren't wearing[^,]*,/i, '')),
    applied: (x) => traitRules({ name: x.name, description: x.description }).unarmored.length > 0,
  },
];

describe('audit of the texts with a mechanical effect', () => {
  const rows: Record<string, { applied: number; text: number; lost: string[] }> = {};
  for (const c of checks) rows[c.id] = { applied: 0, text: 0, lost: [] };
  for (const src of all) {
    for (const c of checks) {
      const hit = sentences(src.description).some((s) => c.expect(s));
      if (!hit) continue;
      if (c.applied(src)) rows[c.id].applied++;
      else {
        rows[c.id].text++;
        if (
          src.edition === '2024' &&
          !src.ua &&
          !TEXT_ONLY.has(`${src.kind}:${src.id}:${src.name}`)
        )
          rows[c.id].lost.push(`${src.kind}:${src.id}:${src.name}`);
      }
    }
  }

  it('prints the table', () => {
    console.table(
      Object.fromEntries(
        Object.entries(rows).map(([k, v]) => [
          k,
          { applied: v.applied, notApplied: v.text, lost2024: v.lost.length },
        ]),
      ),
    );
    expect(true).toBe(true);
  });

  for (const c of checks)
    it(`${c.id}: no unconditional statement of the 2024 rules is lost`, () => {
      // a statement the parser can't read, in the 2024 PHB data, would be silently ignored
      expect(rows[c.id].lost).toEqual([]);
    });
});
