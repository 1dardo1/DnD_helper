import { Injectable, computed, effect, signal } from '@angular/core';

export type Language = 'es' | 'en';
export type DataSourceKind = 'github' | 'local';

export interface Settings {
  language: Language;
  /** Where data/ and characters/ are read from: the GitHub repo, or the files served by `npm start`. */
  dataSource: DataSourceKind;
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  /** Shown next to each saved version ("Móvil", "PC"...), e.g. when resolving a conflict. */
  deviceName: string;
}

const STORAGE_KEY = 'dnd-helper.settings';

export const DEFAULT_SETTINGS: Settings = {
  language: navigator.language?.startsWith('es') ? 'es' : 'en',
  dataSource: 'github',
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
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
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
