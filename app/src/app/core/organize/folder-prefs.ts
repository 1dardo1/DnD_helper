import { signal } from '@angular/core';

export interface FolderPrefsData {
  /** Folder names the user has created, in the order they should be listed (includes empty ones). */
  names: string[];
  /** Folder names, or '' for "no folder", currently collapsed. */
  collapsed: string[];
}

/**
 * This device's folder preferences for one screen (characters or encounters): the folder names
 * the user created here, so an empty one doesn't disappear and is offered as a suggestion for the
 * next one, and which folders are collapsed. Kept in this browser's localStorage only; it doesn't
 * go through GitHub/IndexedDB sync.
 *
 * Folders that hold something do travel between devices: each Character and Encounter carries its
 * own `folder` field, which is synced. The folder list the screens show is the union of both
 * (`knownFolderNames` in folders.ts), so a new device lists those folders even with empty local
 * storage. The limit: an empty folder created on one device doesn't appear on another, and the
 * collapsed state is per device on purpose (a screen preference, not data).
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
