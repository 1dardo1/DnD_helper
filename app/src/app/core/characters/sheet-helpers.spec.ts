import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Character, normalizeCharacter } from '../models/character';
import { ClassOption, DndClass, Item, Subclass } from '../models/compendium';
import { RulesData, computeSheet } from '../rules/engine';
import { SheetFeature } from '../rules/sheet';
import { filterGroups, fold, matchesQuery, warningFix } from './sheet-helpers';

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

function loadCharacter(file: string): Character {
  return normalizeCharacter(JSON.parse(readFileSync(join(root, 'characters', file), 'utf8')))!;
}

describe('fold / matchesQuery', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(fold('  Conjuros  de ÁREA ')).toBe('conjuros de area');
    expect(matchesQuery('area conj', 'Conjuros de área')).toBe(true);
    expect(matchesQuery('cañon', 'Cañón sobrenatural')).toBe(true);
  });

  it('needs every word, in any of the texts', () => {
    expect(matchesQuery('eldritch canon', 'Eldritch Cannon', 'Cañón sobrenatural')).toBe(true);
    expect(matchesQuery('eldritch blast', 'Eldritch Cannon')).toBe(false);
    expect(matchesQuery('', 'whatever')).toBe(true);
  });
});

describe('filterGroups on a real sheet (Oren, Artificer 3 / Warlock 1)', () => {
  const sheet = computeSheet(loadCharacter('oren-bianic-1793811890281.json'), rulesData());
  const groups = (() => {
    const map = new Map<string, SheetFeature[]>();
    for (const f of sheet.features) {
      const k = `${f.source.type}:${f.source.name}`;
      map.set(k, [...(map.get(k) ?? []), f]);
    }
    return [...map.values()].map((features) => ({ source: features[0].source, features }));
  })();
  const text = (f: SheetFeature) => [f.name, f.description];

  it('keeps everything (the same array) with an empty query', () => {
    expect(filterGroups(groups, '  ', text)).toBe(groups);
  });

  it('finds a feature by its name and drops the groups left empty', () => {
    const out = filterGroups(groups, 'eldritch cannon', text);
    const names = out.flatMap((g) => g.features.map((f) => f.name));
    expect(names).toContain('Eldritch Cannon');
    expect(out.every((g) => g.features.length > 0)).toBe(true);
    expect(out.length).toBeLessThan(groups.length);
  });

  it('finds features by words of their description (each word anywhere)', () => {
    const out = filterGroups(groups, 'short rest', text);
    expect(out.length).toBeGreaterThan(0);
    for (const g of out)
      for (const f of g.features) {
        expect(fold(f.description)).toContain('short');
        expect(fold(f.description)).toContain('rest');
      }
  });

  it('gives nothing for a query nothing has', () => {
    expect(filterGroups(groups, 'zzqx', text)).toEqual([]);
  });
});

describe('warningFix', () => {
  it('sends the species picks to the species step of the editor', () => {
    const sheet = computeSheet(loadCharacter('oren-bianic-1793811890281.json'), rulesData());
    const keys = sheet.warnings.map((w) => w.key);
    expect(keys).toContain('sheet.warn.traitChoiceMissing');
    for (const w of sheet.warnings.filter((x) => x.key === 'sheet.warn.traitChoiceMissing'))
      expect(warningFix(w)).toEqual({ step: 'species' });
  });

  it('maps the rest to a step, a tab or nothing', () => {
    expect(warningFix({ key: 'sheet.warn.noSubclass' })).toEqual({ step: 'class' });
    expect(warningFix({ key: 'sheet.warn.armorBase' })).toEqual({ tab: 'equipo' });
    expect(warningFix({ key: 'sheet.warn.weaponMastery' })).toEqual({ tab: 'resumen' });
    expect(warningFix({ key: 'sheet.warn.notFound', params: { what: 'feat' } })).toEqual({
      step: 'choices',
    });
    expect(warningFix({ key: 'sheet.warn.twoPacts' })).toBeNull();
  });
});
