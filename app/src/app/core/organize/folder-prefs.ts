import { signal } from '@angular/core';

export interface FolderPrefsData {
  /** Folder names the user has created, in the order they should be listed (includes empty ones). */
  names: string[];
  /** Folder names, or '' for "no folder", currently collapsed. */
  collapsed: string[];
}

/**
 * Which folders the user created (so an empty one doesn't disappear, and it's offered as a
 * suggestion for the next one) and which are collapsed, for one screen (characters or
 * encounters). Kept in this browser's localStorage only: it's an organizing preference, not game
 * data, so it doesn't go through GitHub/IndexedDB sync — see the `folder` field on Character and
 * Encounter for the data that does. If folders ever need to roam between a player's devices,
 * this is the piece to move into the synced record instead.
 */
export class FolderPrefs {
  private readonly data;

  constructor(private readonly storageKey: string) {
    this.data = signal<FolderPrefsData>(load(storageKey));
  }

  readonly names = (): string[] => this.data().names;

  isCollapsed(folder: string | null): boolean {
    return this.data().collapsed.includes(folder ?? '');
  }

  /** Adds `name` to the known folders if it isn't there yet. */
  ensure(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || this.data().names.includes(trimmed)) return;
    this.update((d) => ({ ...d, names: [...d.names, trimmed] }));
  }

  /** Renames a known folder (and its collapsed state, if set) and returns the name that was kept. */
  rename(from: string, to: string): string {
    const trimmed = to.trim();
    if (!trimmed || trimmed === from) return from;
    this.update((d) => ({
      names: d.names.includes(from) ? d.names.map((n) => (n === from ? trimmed : n)) : d.names,
      collapsed: d.collapsed.map((c) => (c === from ? trimmed : c)),
    }));
    return trimmed;
  }

  remove(name: string): void {
    this.update((d) => ({
      names: d.names.filter((n) => n !== name),
      collapsed: d.collapsed.filter((c) => c !== name),
    }));
  }

  toggle(folder: string | null): void {
    const key = folder ?? '';
    this.update((d) => ({
      ...d,
      collapsed: d.collapsed.includes(key)
        ? d.collapsed.filter((c) => c !== key)
        : [...d.collapsed, key],
    }));
  }

  private update(fn: (d: FolderPrefsData) => FolderPrefsData): void {
    this.data.update(fn);
    save(this.storageKey, this.data());
  }
}

function load(key: string): FolderPrefsData {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { names: [], collapsed: [] };
    const parsed = JSON.parse(raw);
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    return { names: strings(parsed.names), collapsed: strings(parsed.collapsed) };
  } catch {
    return { names: [], collapsed: [] };
  }
}

function save(key: string, data: FolderPrefsData): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Private mode or storage disabled: folders stay for this session only.
  }
}
