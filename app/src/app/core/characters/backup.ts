import { toJsonText } from '../data/data-source';
import { CustomBackground, normalizeCustomBackground } from '../homebrew/custom-background';
import { Character, normalizeCharacter } from '../models/character';

/**
 * Backups of the characters as files, so they don't depend only on GitHub. Pure functions: what a
 * file contains, how one is read back, and what importing it would do. BackupService does the I/O.
 *
 *  - One character: the character JSON exactly as in the repo (characters/<id>.json).
 *  - All of them: { app: 'dnd-helper', kind: 'backup', version: 1, exportedAt, characters: [...],
 *    backgrounds: [...] } (the user's own backgrounds; files from before them lack the field).
 */
export const BACKUP_APP = 'dnd-helper';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  kind: 'backup';
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  characters: Character[];
  /** The user's own backgrounds (absent in files made before they existed). */
  backgrounds: CustomBackground[];
}

export function backupOf(
  characters: Character[],
  now = new Date(),
  backgrounds: CustomBackground[] = [],
): BackupFile {
  return {
    app: BACKUP_APP,
    kind: 'backup',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    characters,
    backgrounds,
  };
}

/** File text: same format as the repo's files (2-space JSON and a final newline). */
export function backupText(content: Character | BackupFile): string {
  return toJsonText(content);
}

/** "dnd-helper-thorin-escudo-de-roble-2026-11-03.json" */
export function characterFileName(name: string, now = new Date()): string {
  return `${BACKUP_APP}-${slugify(name) || 'personaje'}-${day(now)}.json`;
}

/** "dnd-helper-copia-2026-11-03.json" (word: "copia" / "backup", by language). */
export function backupFileName(word: string, now = new Date()): string {
  return `${BACKUP_APP}-${slugify(word) || 'backup'}-${day(now)}.json`;
}

function day(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// -- reading files -------------------------------------------------------------------

/**
 * The id becomes a path in the repo (characters/<id>.json): only letters, digits, "-", "_" and
 * dots inside, so an imported file can never write anywhere else.
 */
const SAFE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?!\.)){0,119}$/;

export function isSafeId(id: string): boolean {
  return SAFE_ID.test(id);
}

export interface ParsedFile {
  /** Valid characters found in the file. */
  characters: Character[];
  /** Valid custom backgrounds found in the file (backups only). */
  backgrounds: CustomBackground[];
  /** Entries that aren't characters (or have an unsafe id). */
  invalid: number;
  /** The file isn't JSON, or isn't a character, a backup or a list of characters. */
  error?: 'not-json' | 'unknown-format' | 'newer-version';
}

/** Reads one file: a single character, a backup, or a plain array of characters. */
export function parseImportText(text: string): ParsedFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { characters: [], backgrounds: [], invalid: 0, error: 'not-json' };
  }
  if (Array.isArray(raw)) return parseEntries(raw);
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o['kind'] === 'backup' && Array.isArray(o['characters'])) {
      if (typeof o['version'] === 'number' && o['version'] > BACKUP_VERSION) {
        return { characters: [], backgrounds: [], invalid: 0, error: 'newer-version' };
      }
      const parsed = parseEntries(o['characters']);
      const raw = Array.isArray(o['backgrounds']) ? o['backgrounds'] : [];
      const backgrounds = raw
        .map((b) => normalizeCustomBackground(b))
        .filter((b): b is CustomBackground => !!b);
      return { ...parsed, backgrounds, invalid: parsed.invalid + raw.length - backgrounds.length };
    }
    const c = validCharacter(raw);
    if (c) return { characters: [c], backgrounds: [], invalid: 0 };
  }
  return { characters: [], backgrounds: [], invalid: 0, error: 'unknown-format' };
}

function parseEntries(entries: unknown[]): ParsedFile {
  const characters: Character[] = [];
  let invalid = 0;
  for (const e of entries) {
    const c = validCharacter(e);
    if (c) characters.push(c);
    else invalid++;
  }
  return { characters, backgrounds: [], invalid };
}

function validCharacter(raw: unknown): Character | null {
  const c = normalizeCharacter(raw);
  if (!c || !isSafeId(c.id) || !c.name.trim()) return null;
  return c;
}

// -- deciding what to do -------------------------------------------------------------

export type Newer = 'file' | 'device' | 'same';

export interface ImportItem {
  incoming: Character;
  /** The character with that id already on this device, if any. */
  existing: Character | null;
  /**
   * new: not on this device, it's added. identical: same content already here, nothing to do.
   * conflict: a different version is here; the user picks replace / keep both / skip.
   */
  kind: 'new' | 'identical' | 'conflict';
  /** Which one was edited later (by updatedAt), for conflicts. */
  newer: Newer;
}

export type ConflictChoice = 'replace' | 'both' | 'skip';

/**
 * What importing these characters would do, given the ones on this device. The same id twice in
 * the selected files keeps the most recently edited one.
 */
export function planImport(incoming: Character[], existing: Character[]): ImportItem[] {
  const latest = new Map<string, Character>();
  for (const c of incoming) {
    const seen = latest.get(c.id);
    if (!seen || compareDates(c.updatedAt, seen.updatedAt) > 0) latest.set(c.id, c);
  }
  const here = new Map(existing.map((c) => [c.id, c]));
  return [...latest.values()].map((c) => {
    const e = here.get(c.id) ?? null;
    if (!e) return { incoming: c, existing: null, kind: 'new', newer: 'file' };
    if (sameContent(c, e)) return { incoming: c, existing: e, kind: 'identical', newer: 'same' };
    const cmp = compareDates(c.updatedAt, e.updatedAt);
    return {
      incoming: c,
      existing: e,
      kind: 'conflict',
      newer: cmp > 0 ? 'file' : cmp < 0 ? 'device' : 'same',
    };
  });
}

/** Suggested choice for a conflict: replace when the file is newer, skip otherwise. */
export function defaultChoice(item: ImportItem): ConflictChoice {
  return item.newer === 'file' ? 'replace' : 'skip';
}

export interface ImportSummary {
  /** Characters to write on this device (new, replacements and copies). */
  toWrite: Character[];
  imported: number;
  replaced: number;
  copies: number;
  /** Skipped by choice or already identical. */
  skipped: number;
}

/**
 * The characters to write, given a choice for each conflict (by id; missing = default).
 * "Keep both" imports the file's version under a new id and name "Name (suffix)".
 */
export function resolveImport(
  items: ImportItem[],
  choices: Record<string, ConflictChoice>,
  copySuffix: string,
  now = Date.now(),
): ImportSummary {
  const summary: ImportSummary = { toWrite: [], imported: 0, replaced: 0, copies: 0, skipped: 0 };
  const taken = new Set(items.flatMap((i) => [i.incoming.id, i.existing?.id ?? '']));
  for (const item of items) {
    if (item.kind === 'new') {
      summary.toWrite.push(item.incoming);
      summary.imported++;
      continue;
    }
    if (item.kind === 'identical') {
      summary.skipped++;
      continue;
    }
    const choice = choices[item.incoming.id] ?? defaultChoice(item);
    if (choice === 'replace') {
      summary.toWrite.push(item.incoming);
      summary.replaced++;
    } else if (choice === 'both') {
      let id = `${item.incoming.id}-${now}`;
      for (let n = 2; taken.has(id); n++) id = `${item.incoming.id}-${now}-${n}`;
      taken.add(id);
      summary.toWrite.push({
        ...item.incoming,
        id,
        name: `${item.incoming.name} (${copySuffix})`,
      });
      summary.copies++;
    } else {
      summary.skipped++;
    }
  }
  return summary;
}

function compareDates(a: string, b: string): number {
  const ta = Date.parse(a) || 0;
  const tb = Date.parse(b) || 0;
  return ta - tb;
}

/** Same character apart from key order. */
function sameContent(a: Character, b: Character): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)),
        )
      : v,
  );
}
