import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Measure } from './pdf-text';
import { Character, normalizeCharacter } from '../models/character';
import { ClassOption, DndClass, Item, Spell, Subclass } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import { PdfOp, PdfSpellRow, composeSheetPdf } from './sheet-pdf';
import { PdfSource, buildSheetPdfInput } from './sheet-pdf-input';

/**
 * These tests go through the real pipeline: real class/item/option data, the real character of a
 * multiclass Artificer/Warlock (characters/oren-bianic-*.json), computeSheet, buildSheetPdfInput and
 * composeSheetPdf — the same path the app's PDF export takes, with `t`/`shortName`/`text` as the
 * identity (no translation) so assertions can check for the English book text directly.
 */

const root = join(process.cwd(), '..');
const read = <T>(f: string): T[] => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

function rulesData(): RulesData {
  return {
    classes: byId(read<DndClass>('classes.json')),
    subclasses: byId(read<Subclass>('subclasses.json')),
    species: byId(read<never>('species.json')),
    backgrounds: byId(read<never>('backgrounds.json')),
    feats: byId(read<never>('feats.json')),
    items: byId(read<Item>('items.json')),
    options: byId(read<ClassOption>('options.json')),
  };
}

const spells = read<Spell>('spells.json');

const measure: Measure = (text, size, bold) => text.length * size * (bold ? 0.55 : 0.5);

function loadCharacter(file: string): Character {
  return normalizeCharacter(JSON.parse(readFileSync(join(root, 'characters', file), 'utf8')))!;
}

function source(ch: Character, rules: RulesData): PdfSource {
  return {
    character: ch,
    sheet: computeSheet(ch, rules),
    rules,
    spells,
    t: (key, params) => (params ? `${key}(${JSON.stringify(params)})` : key),
    shortName: (e) => e ?? '',
    text: (e) => e ?? '',
    entry: (_type, e) => e,
    term: (_domain, v) => v ?? '',
  };
}

const texts = (pages: { ops: PdfOp[] }[]) =>
  pages.flatMap((p) => p.ops.flatMap((o) => (o.k === 'text' ? [o.text] : [])));

describe('Replicate Magic Item: the plan reference table never reaches the PDF', () => {
  const rules = rulesData();
  const ch = loadCharacter('oren-bianic-1793811890281.json');
  const input = buildSheetPdfInput(source(ch, rules));
  const pages = composeSheetPdf(input, measure);
  const all = texts(pages).join('\n');

  it('drops the book table of every possible plan, at every level bracket', () => {
    // plans Oren does not know, from the level 2+, 6+, 10+ and 14+ tables (and only there — some
    // plan names, like Bag of Holding, are also recommended in the feature's own prose, which the
    // generic strip must not touch, so this list avoids those)
    for (const name of [
      'Manifold Tool',
      'Returning Weapon',
      'Boots of Elvenkind',
      'Wand of Magic Missiles',
      'Armor of Resistance',
      'Ring of Mind Shielding',
      'Ring of Free Action',
      'Flame Tongue',
    ]) {
      expect(all).not.toContain(name);
    }
  });

  it('keeps the rest of the feature description', () => {
    expect(all).toContain('Spellcasting Focus');
    expect(all).toContain('Duration');
  });

  it('shows a compact line of the plans the character actually knows', () => {
    const feature = input.features.find((f) => f.name === 'Replicate Magical Item')!;
    expect(feature).toBeTruthy();
    expect(feature.text).toContain('pdf.knownPlans');
    // Oren's choices.options: alchemy-jug, common:cast-off-armor, repeating-shot, goggles-of-night
    for (const name of ['Alchemy Jug', 'Cast-Off Armor', 'Repeating Shot', 'Goggles of Night']) {
      expect(feature.text).toContain(name);
    }
  });
});

describe('stripReferenceTables: general, and conservative', () => {
  it('leaves a book table that is not a Yes/No reference list untouched', () => {
    const rules = rulesData();
    const ch = loadCharacter('oren-bianic-1793811890281.json');
    const input = buildSheetPdfInput(source(ch, rules));
    // Tinker's Magic has its own long table (a plain item list, no boolean column): kept whole
    const tinker = input.features.find((f) => f.name === "Tinker's Magic");
    expect(tinker).toBeTruthy();
    expect(tinker!.text).toContain('Ball Bearings');
    expect(tinker!.text).toContain('Crowbar');
  });
});

describe('spellcasting: several casters get their own section, not one mixed table', () => {
  const rules = rulesData();
  const ch = loadCharacter('oren-bianic-1793811890281.json');
  const input = buildSheetPdfInput(source(ch, rules));

  const isHeader = (r: PdfSpellRow): r is { header: string } => 'header' in r;
  const headers = input.spells.filter(isHeader).map((r) => r.header);

  it('has a spellcasting header per class, each with its own DC and attack', () => {
    expect(input.spellcasting?.classes.map((c) => c.name)).toEqual(['Artificer', 'Warlock']);
    expect(input.spellcasting?.classes[0].dc).not.toBe(input.spellcasting?.classes[1].dc);
  });

  it('groups the spell rows under one header per caster class, in class order', () => {
    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain('Artificer');
    expect(headers[1]).toContain('Warlock');
  });

  it('keeps each class spell under its own group, never under the other one', () => {
    let current = '';
    const byGroup: Record<string, string[]> = {};
    for (const r of input.spells) {
      if (isHeader(r)) {
        current = r.header;
        byGroup[current] = [];
      } else {
        byGroup[current]?.push(r.name);
      }
    }
    const artificerGroup = byGroup[headers[0]];
    const warlockGroup = byGroup[headers[1]];
    expect(artificerGroup).toContain('Cure Wounds');
    expect(warlockGroup).toContain('Unseen Servant');
    expect(artificerGroup).not.toContain('Unseen Servant');
    expect(warlockGroup).not.toContain('Cure Wounds');
  });

  it('draws the group headers, and no spell note mixes classes any more', () => {
    const pages = composeSheetPdf(input, measure);
    const all = texts(pages).join('\n');
    expect(all).toContain(headers[0]);
    expect(all).toContain(headers[1]);
  });

  it('renders as a single flat table when there is only one caster class', () => {
    const single: Character = {
      ...ch,
      classes: ch.classes.filter((c) => c.id === 'artificer'),
    };
    const singleInput = buildSheetPdfInput(source(single, rules));
    expect(singleInput.spells.some(isHeader)).toBe(false);
  });
});
