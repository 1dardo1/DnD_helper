import { Injectable, signal } from '@angular/core';

import { ENTRY_TYPES, EntryType } from '../../core/models/compendium';

/** A compendium page the user opened: enough to link to it and show its name. */
export interface RecentEntry {
  type: EntryType;
  id: string;
  /** The entry's name in the data (English), shown through the dataName pipe. */
  name: string;
}

/** How many pages the list keeps. */
export const MAX_RECENT = 8;

const STORAGE_KEY = 'dnd-helper.compendium-recent';

/** The list with `entry` first (moved there if it was already in it), at most `max` long. */
export function pushRecent(
  list: readonly RecentEntry[],
  entry: RecentEntry,
  max = MAX_RECENT,
): RecentEntry[] {
  const rest = list.filter((r) => r.type !== entry.type || r.id !== entry.id);
  return [entry, ...rest].slice(0, max);
}

/** What localStorage held, keeping only well-formed entries of known types. */
export function parseRecent(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (r): r is RecentEntry =>
          !!r &&
          typeof r.id === 'string' &&
          typeof r.name === 'string' &&
          ENTRY_TYPES.includes(r.type),
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/**
 * The compendium pages opened last on this device ("Vistos hace poco" on the compendium's home).
 * A per-device convenience: kept in localStorage, never synced.
 */
@Injectable({ providedIn: 'root' })
export class RecentEntries {
  private readonly state = signal<RecentEntry[]>(load());
  readonly list = this.state.asReadonly();

  add(entry: RecentEntry): void {
    const next = pushRecent(this.state(), entry);
    this.state.set(next);
    save(next);
  }

  clear(): void {
    this.state.set([]);
    save([]);
  }
}

function load(): RecentEntry[] {
  try {
    return parseRecent(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function save(list: RecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // private mode or storage disabled: the list lasts for this session only
  }
}
