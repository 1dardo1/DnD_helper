// Lists the game terms in data/ (and in the app's fixed lists) that have no Spanish translation in
// src/app/core/i18n/glossary.es.json, so a new extraction cannot slip English labels into the app.
// Closed domains (schools, rarities, sizes...) fail the run; open ones (table columns, rule
// categories, proficiency texts) only warn, since a missing entry there just shows the original.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '..', 'data');
const glossary = JSON.parse(readFileSync(join(root, 'src/app/core/i18n/glossary.es.json'), 'utf8'));
const load = (name) => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'));

/** domain -> set of values found */
const found = {};
const add = (domain, value) => {
  if (typeof value !== 'string' || !value.trim()) return;
  (found[domain] ??= new Set()).add(value.trim());
};

for (const s of load('spells')) add('school', s.school);
for (const f of load('feats')) add('featCategory', f.category);
for (const o of load('options')) add('optionGroup', o.group);
for (const r of load('rules')) add('ruleCategory', r.category);
for (const i of load('items')) {
  add('itemCategory', i.category);
  add('rarity', i.magic?.rarity);
  add('magicType', i.magic?.type);
  add('armor', i.armor?.kind);
  if (i.weapon) {
    add('weapon', i.weapon.kind);
    add('mastery', i.weapon.mastery);
    for (const d of i.weapon.damage ?? []) add('damage', d.type);
    // "Ammunition (Range 80/320; Arrow)" -> "Ammunition"
    for (const p of i.weapon.properties ?? []) add('property', p.replace(/\s*\(.*$/, ''));
  }
}
for (const sp of load('species')) {
  add('creatureType', sp.creatureType);
  for (const z of sp.size ?? []) add('size', z);
  for (const k of Object.keys(sp.speed ?? {})) add('speed', k);
}
for (const c of load('classes')) {
  for (const col of c.progression?.columns ?? []) add('column', col);
  for (const a of c.proficiencies?.armor ?? []) add('proficiency', a);
  for (const w of c.proficiencies?.weapons ?? []) add('proficiency', w);
}
for (const s of load('subclasses')) {
  for (const col of s.progression?.columns ?? []) add('column', col);
}

// Fixed lists in the creation rules: languages, tools and tool groups.
const rules = readFileSync(join(root, 'src/app/core/creation/creation-rules.ts'), 'utf8');
const block = (start, end) => {
  const from = rules.indexOf(start);
  if (from < 0) throw new Error(`creation-rules.ts: ${start} not found`);
  return rules.slice(from, rules.indexOf(end, from));
};
const strings = (text) =>
  [...text.matchAll(/'((?:[^'\\]|\\.)*)'|"([^"]*)"/g)].map((m) =>
    (m[1] ?? m[2]).replace(/\\'/g, "'"),
  );
for (const l of strings(block('export const STANDARD_LANGUAGES', '];'))) add('language', l);
for (const l of strings(block('export const RARE_LANGUAGES', '];'))) add('language', l);
add('language', 'Common');
const groups = block('export const TOOL_GROUPS', '\n};');
for (const g of groups.matchAll(/^ {2}(?:'([^']+)'|"([^"]+)"): \[/gm))
  add('toolGroup', g[1] ?? g[2]);
for (const t of strings(groups)) if (!found.toolGroup.has(t)) add('tool', t);

const OPEN = new Set(['column', 'ruleCategory', 'proficiency']);
const has = (domain, value) => {
  const key = value.toLowerCase();
  if (domain === 'proficiency') return key in glossary.armor || key in glossary.weapon;
  return key in (glossary[domain] ?? {});
};

let errors = 0;
for (const [domain, values] of Object.entries(found)) {
  const missing = [...values].filter((v) => !has(domain, v)).sort();
  if (!missing.length) continue;
  const closed = !OPEN.has(domain);
  if (closed) errors += missing.length;
  console.log(
    `${closed ? 'ERROR' : 'aviso'} ${domain}: ${missing.map((m) => JSON.stringify(m)).join(', ')}`,
  );
}
console.log(errors ? `${errors} términos sin traducir.` : 'Glosario completo.');
process.exit(errors ? 1 : 0);
