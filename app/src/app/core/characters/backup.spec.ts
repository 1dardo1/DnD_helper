import { describe, expect, it } from 'vitest';

import { Character, newCharacter } from '../models/character';
import {
  backupFileName,
  backupOf,
  backupText,
  characterFileName,
  defaultChoice,
  isSafeId,
  parseImportText,
  planImport,
  resolveImport,
} from './backup';

function character(id: string, name: string, updatedAt: string, notes = ''): Character {
  return { ...newCharacter(name, 'PC'), id, updatedAt, notes };
}

const thorin = character('thorin-1', 'Thorin', '2026-10-01T10:00:00.000Z');
const lia = character('lia-2', 'Lía', '2026-10-02T10:00:00.000Z');

describe('backup files', () => {
  it('names files after the character or the backup word and the date', () => {
    const d = new Date(2026, 10, 3, 12);
    expect(characterFileName('Thorin Escudo de Roble', d)).toBe(
      'dnd-helper-thorin-escudo-de-roble-2026-11-03.json',
    );
    expect(characterFileName('Lía', d)).toBe('dnd-helper-lia-2026-11-03.json');
    expect(characterFileName('???', d)).toBe('dnd-helper-personaje-2026-11-03.json');
    expect(backupFileName('copia', d)).toBe('dnd-helper-copia-2026-11-03.json');
  });

  it('writes the character as in the repo and backups with a header', () => {
    expect(backupText(thorin)).toBe(JSON.stringify(thorin, null, 2) + '\n');
    const b = backupOf([thorin, lia], new Date('2026-11-03T00:00:00.000Z'));
    expect(b).toEqual({
      app: 'dnd-helper',
      kind: 'backup',
      version: 1,
      exportedAt: '2026-11-03T00:00:00.000Z',
      characters: [thorin, lia],
      backgrounds: [],
    });
  });
});

describe('parseImportText', () => {
  it('reads a single character file', () => {
    const r = parseImportText(backupText(thorin));
    expect(r.error).toBeUndefined();
    expect(r.characters.map((c) => c.id)).toEqual(['thorin-1']);
  });

  it('reads a backup, counting entries that are not characters', () => {
    const text = JSON.stringify({
      ...backupOf([thorin, lia]),
      characters: [thorin, { x: 1 }, lia],
    });
    const r = parseImportText(text);
    expect(r.characters.map((c) => c.name)).toEqual(['Thorin', 'Lía']);
    expect(r.invalid).toBe(1);
  });

  it('reads a plain array of characters', () => {
    expect(parseImportText(JSON.stringify([lia])).characters).toHaveLength(1);
  });

  it('upgrades old character files with normalizeCharacter', () => {
    const old = { id: 'old-1', name: 'Viejo', classes: [{ id: 'fighter', level: 2 }] };
    const [c] = parseImportText(JSON.stringify(old)).characters;
    expect(c.classes[0]).toMatchObject({ id: 'fighter', level: 2, hp: [], subclassId: null });
    expect(c.inventory).toEqual([]);
    expect(c.schemaVersion).toBe(1);
  });

  it('accepts a byte order mark', () => {
    expect(parseImportText('﻿' + backupText(thorin)).characters).toHaveLength(1);
  });

  it('rejects what is not JSON or not a character', () => {
    expect(parseImportText('hola').error).toBe('not-json');
    expect(parseImportText('{"foo": 1}').error).toBe('unknown-format');
    expect(parseImportText('42').error).toBe('unknown-format');
    expect(parseImportText(JSON.stringify({ ...backupOf([thorin]), version: 2 })).error).toBe(
      'newer-version',
    );
  });

  it('refuses ids that would write outside characters/', () => {
    expect(isSafeId('thorin-1777777777')).toBe(true);
    expect(isSafeId('a.b_c')).toBe(true);
    for (const bad of ['../token', 'a/b', '', '.hidden', 'a..b', 'a b', 'x'.repeat(200)]) {
      expect(isSafeId(bad)).toBe(false);
    }
    const r = parseImportText(JSON.stringify([{ ...thorin, id: '../../app/public/x' }]));
    expect(r.characters).toEqual([]);
    expect(r.invalid).toBe(1);
  });
});

describe('planImport', () => {
  it('adds new ones, skips identical ones, and flags different versions', () => {
    const changed = { ...thorin, notes: 'otra', updatedAt: '2026-10-05T00:00:00.000Z' };
    const items = planImport(
      [changed, lia, character('new-3', 'Nuevo', '2026-01-01')],
      [thorin, { ...lia }],
    );
    expect(items.map((i) => [i.incoming.id, i.kind, i.newer])).toEqual([
      ['thorin-1', 'conflict', 'file'],
      ['lia-2', 'identical', 'same'],
      ['new-3', 'new', 'file'],
    ]);
  });

  it('identical ignores key order', () => {
    const reordered = Object.fromEntries(Object.entries(thorin).reverse()) as unknown as Character;
    expect(planImport([reordered], [thorin])[0].kind).toBe('identical');
  });

  it('says which version is newer', () => {
    const older = { ...thorin, notes: 'x', updatedAt: '2026-09-01T00:00:00.000Z' };
    const same = { ...thorin, notes: 'y' };
    expect(planImport([older], [thorin])[0].newer).toBe('device');
    expect(planImport([same], [thorin])[0].newer).toBe('same');
  });

  it('the same id twice in the files keeps the most recent', () => {
    const a = { ...thorin, notes: 'a', updatedAt: '2026-10-03T00:00:00.000Z' };
    const b = { ...thorin, notes: 'b', updatedAt: '2026-10-04T00:00:00.000Z' };
    const items = planImport([b, a], []);
    expect(items).toHaveLength(1);
    expect(items[0].incoming.notes).toBe('b');
  });
});

describe('resolveImport', () => {
  const newer = { ...thorin, notes: 'nuevas', updatedAt: '2026-12-01T00:00:00.000Z' };
  const older = { ...lia, notes: 'viejas', updatedAt: '2026-01-01T00:00:00.000Z' };
  const items = planImport(
    [newer, older, character('new-3', 'Nuevo', '2026-01-01')],
    [thorin, lia],
  );

  it('suggests replacing only when the file is newer', () => {
    expect(items.filter((i) => i.kind === 'conflict').map(defaultChoice)).toEqual([
      'replace',
      'skip',
    ]);
  });

  it('applies the defaults', () => {
    const r = resolveImport(items, {}, 'copia');
    expect(r.toWrite.map((c) => c.id)).toEqual(['thorin-1', 'new-3']);
    expect(r).toMatchObject({ imported: 1, replaced: 1, copies: 0, skipped: 1 });
  });

  it('keep both: a copy with a new id and "(copia)" in the name', () => {
    const r = resolveImport(items, { 'thorin-1': 'skip', 'lia-2': 'both' }, 'copia', 123);
    expect(r.toWrite.map((c) => [c.id, c.name])).toEqual([
      ['lia-2-123', 'Lía (copia)'],
      ['new-3', 'Nuevo'],
    ]);
    expect(r.toWrite[0].notes).toBe('viejas');
    expect(r).toMatchObject({ imported: 1, replaced: 0, copies: 1, skipped: 1 });
  });

  it('copy ids never collide', () => {
    const clash = planImport(
      [{ ...thorin, notes: 'z' }, character('thorin-1-5', 'T', '2026')],
      [thorin],
    );
    const r = resolveImport(clash, { 'thorin-1': 'both' }, 'copy', 5);
    expect(new Set(r.toWrite.map((c) => c.id)).size).toBe(2);
    expect(r.toWrite.map((c) => c.id)).toContain('thorin-1-5-2');
  });

  it('counts identical ones as skipped', () => {
    const r = resolveImport(planImport([thorin], [thorin]), {}, 'copia');
    expect(r).toMatchObject({ toWrite: [], imported: 0, skipped: 1 });
  });
});
