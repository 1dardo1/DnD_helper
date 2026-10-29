import { Injectable, computed, effect, signal } from '@angular/core';

export type Language = 'es' | 'en';

export interface Settings {
  language: Language;
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  /** Shown next to each saved version ("Móvil de Lucía", "PC de Lucía"...), e.g. when resolving a conflict. */
  deviceName: string;
}

const STORAGE_KEY = 'dnd-helper.settings';

export const DEFAULT_SETTINGS: Settings = {
  language: navigator.language?.startsWith('es') ? 'es' : 'en',
  githubToken: '',
  owner: '1dardo1',
  repo: 'DnD_helper',
  branch: 'claude/practical-ride-qnr51a',
  deviceName: '',
};

/** User settings, kept in this browser's localStorage (they never leave the device). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<Settings>(load());

  readonly settings = this.state.asReadonly();
  readonly language = computed(() => this.state().language);
  /** True when the GitHub data source has what it needs to work. */
  readonly githubReady = computed(() => {
    const s = this.state();
    return !!(s.githubToken && s.owner && s.repo && s.branch);
  });

  constructor() {
    effect(() => save(this.state()));
  }

  update(patch: Partial<Settings>): void {
    this.state.update((s) => ({ ...s, ...patch }));
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    // dataSource was a setting in older versions; the source is chosen automatically now.
    const { dataSource: _, ...stored } = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage disabled: settings last for this session only.
  }
}
