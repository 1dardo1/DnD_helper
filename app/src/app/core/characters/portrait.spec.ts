import { describe, expect, it } from 'vitest';

import { Character, newCharacter, normalizeCharacter } from '../models/character';
import { backupOf, backupText, parseImportText } from './backup';
import {
  CENTERED,
  PORTRAIT_MAX_FILE_BYTES,
  PORTRAIT_SIZE,
  checkPortraitFile,
  cropRect,
  dragFraming,
  normalizePortrait,
  outputSize,
  portraitBytes,
  portraitToBytes,
  zoomFraming,
} from './portrait';

// a tiny WebP
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

describe('portrait file checks', () => {
  it('accepts images up to 15 MB and refuses the rest', () => {
    expect(checkPortraitFile({ type: 'image/jpeg', size: 3_000_000 })).toBeNull();
    expect(checkPortraitFile({ type: 'image/png', size: PORTRAIT_MAX_FILE_BYTES })).toBeNull();
    expect(checkPortraitFile({ type: 'image/png', size: PORTRAIT_MAX_FILE_BYTES + 1 })).toBe(
      'tooLarge',
    );
    expect(checkPortraitFile({ type: 'application/pdf', size: 100 })).toBe('format');
    expect(checkPortraitFile({ type: '', size: 100 })).toBe('format');
  });
});

describe('square crop', () => {
  it('centers the short side of a landscape photo (3000x2000)', () => {
    expect(cropRect(3000, 2000, CENTERED)).toEqual({ sx: 500, sy: 0, side: 2000 });
  });

  it('centers a portrait photo', () => {
    expect(cropRect(2000, 3000, CENTERED)).toEqual({ sx: 0, sy: 500, side: 2000 });
  });

  it('zooms in around the centre', () => {
    expect(cropRect(3000, 2000, { zoom: 2, cx: 0.5, cy: 0.5 })).toEqual({
      sx: 1000,
      sy: 500,
      side: 1000,
    });
  });

  it('never leaves the image, whatever the framing', () => {
    const r = cropRect(3000, 2000, { zoom: 3, cx: -5, cy: 9 });
    expect(r.sx).toBe(0);
    expect(r.sy + r.side).toBe(2000);
    expect(cropRect(3000, 2000, { zoom: NaN, cx: NaN, cy: NaN })).toEqual({
      sx: 500,
      sy: 0,
      side: 2000,
    });
    expect(cropRect(3000, 2000, { zoom: 99, cx: 0.5, cy: 0.5 }).side).toBe(500);
  });

  it('drags opposite to the finger and stops at the edges', () => {
    // view of 200 px over a 2000 px crop: 1 screen px = 10 source px
    const f = dragFraming(3000, 2000, CENTERED, -20, 0, 200);
    expect(cropRect(3000, 2000, f).sx).toBe(700);
    const far = dragFraming(3000, 2000, CENTERED, 99999, 0, 200);
    expect(cropRect(3000, 2000, far).sx).toBe(0);
    // a square photo at zoom 1 cannot move
    expect(cropRect(1000, 1000, dragFraming(1000, 1000, CENTERED, 50, 50, 200))).toEqual({
      sx: 0,
      sy: 0,
      side: 1000,
    });
  });

  it('zooms keeping the centre', () => {
    const f = zoomFraming(3000, 2000, { zoom: 1, cx: 0.7, cy: 0.5 }, 2);
    expect(f.zoom).toBe(2);
    const r = cropRect(3000, 2000, f);
    expect(r.sx + r.side / 2).toBeCloseTo(2100);
    expect(zoomFraming(3000, 2000, CENTERED, 50).zoom).toBe(4);
    expect(zoomFraming(3000, 2000, CENTERED, 0.1).zoom).toBe(1);
  });

  it('shrinks to 320 px at most and never upscales', () => {
    expect(outputSize(2000)).toBe(PORTRAIT_SIZE);
    expect(outputSize(320)).toBe(320);
    expect(outputSize(120)).toBe(120);
    expect(outputSize(0)).toBe(1);
  });
});

describe('portrait data URLs', () => {
  it('keeps only small, well-formed image data URLs', () => {
    expect(normalizePortrait(WEBP)).toBe(WEBP);
    expect(normalizePortrait('data:image/jpeg;base64,/9j/4AAQ')).toBeTruthy();
    expect(normalizePortrait(null)).toBeNull();
    expect(normalizePortrait(42)).toBeNull();
    expect(normalizePortrait('')).toBeNull();
    expect(normalizePortrait('https://example.com/a.png')).toBeNull();
    expect(normalizePortrait('data:text/html;base64,PGI+')).toBeNull();
    expect(normalizePortrait('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(normalizePortrait('data:image/webp;base64,' + 'A'.repeat(300_000))).toBeNull();
  });

  it('reads the bytes back (for the PDF)', () => {
    const parsed = portraitToBytes(WEBP)!;
    expect(parsed.mime).toBe('image/webp');
    expect(parsed.bytes.length).toBe(portraitBytes(WEBP));
    expect([...parsed.bytes.slice(0, 4)]).toEqual([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  });
});

describe('Character.portrait', () => {
  const base = (): Character => ({ ...newCharacter('Elara', 'PC'), id: 'elara-1' });

  it('old characters without a portrait load exactly as before', () => {
    const raw = base();
    expect('portrait' in raw).toBe(false);
    const n = normalizeCharacter(JSON.parse(JSON.stringify(raw)))!;
    expect('portrait' in n).toBe(false);
  });

  it('keeps a valid portrait and drops garbage or null', () => {
    expect(normalizeCharacter({ ...base(), portrait: WEBP })!.portrait).toBe(WEBP);
    expect('portrait' in normalizeCharacter({ ...base(), portrait: '<script>' })!).toBe(false);
    expect('portrait' in normalizeCharacter({ ...base(), portrait: null })!).toBe(false);
  });

  it('travels in backups and survives export and import', () => {
    const backup = backupOf([{ ...base(), portrait: WEBP }], new Date('2026-11-03T00:00:00.000Z'));
    const parsed = parseImportText(JSON.stringify(backup));
    expect(parsed.characters[0].portrait).toBe(WEBP);
    expect(backupText({ ...base(), portrait: WEBP })).toContain(WEBP);
  });

  it('a ~40 kB portrait keeps the file far below the 1 MB of the contents API', () => {
    const portrait = 'data:image/webp;base64,' + 'A'.repeat(54_000); // ≈ 40 kB of image
    expect(normalizePortrait(portrait)).toBe(portrait);
    expect(JSON.stringify({ ...base(), portrait }, null, 2).length).toBeLessThan(120_000);
  });
});
