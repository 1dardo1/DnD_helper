import { describe, expect, it } from 'vitest';

import { normalizeCustomBackground } from '../homebrew/custom-background';
import { newCharacter } from '../models/character';
import { backupOf, backupText, parseImportText } from './backup';

const thorin = {
  ...newCharacter('Thorin', 'PC'),
  id: 'thorin-1',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const custom = normalizeCustomBackground({
  id: 'custom-faro-abc123',
  name: 'Farero',
  description: 'Cuidaba el faro.',
  abilityScores: ['STR', 'CON', 'WIS'],
  featId: 'alert',
  feat: 'Alert',
  skills: ['perception', 'survival'],
  tools: "Navigator's Tools",
})!;

describe('backups with custom backgrounds', () => {
  it('puts them in the backup file and reads them back', () => {
    const text = backupText(backupOf([thorin], new Date(), [custom]));
    expect(JSON.parse(text).backgrounds).toHaveLength(1);
    const parsed = parseImportText(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.characters.map((c) => c.id)).toEqual(['thorin-1']);
    expect(parsed.backgrounds).toEqual([custom]);
  });

  it('reads backups made before they existed (no backgrounds field)', () => {
    const old = JSON.stringify({
      app: 'dnd-helper',
      kind: 'backup',
      version: 1,
      exportedAt: '2026-11-03T00:00:00.000Z',
      characters: [thorin],
    });
    const parsed = parseImportText(old);
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.backgrounds).toEqual([]);
    expect(parsed.invalid).toBe(0);
  });

  it('counts invalid backgrounds and ignores unsafe ids', () => {
    const text = JSON.stringify({
      kind: 'backup',
      version: 1,
      characters: [],
      backgrounds: [custom, { id: '../x', name: 'Evil' }, 'nope'],
    });
    const parsed = parseImportText(text);
    expect(parsed.backgrounds).toEqual([custom]);
    expect(parsed.invalid).toBe(2);
  });

  it('single character files and plain arrays have no backgrounds', () => {
    expect(parseImportText(backupText(thorin)).backgrounds).toEqual([]);
    expect(parseImportText(JSON.stringify([thorin])).backgrounds).toEqual([]);
  });
});
