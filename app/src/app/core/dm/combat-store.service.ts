import { Injectable, signal } from '@angular/core';

import { CombatState, emptyCombat, normalizeCombat } from './combat';

const KEY = 'dnd-helper.combat';

/**
 * The combat in progress. Saved on the device (localStorage) after every change, so a reload, a
 * visit to the compendium or closing the app keeps it until "End combat".
 */
@Injectable({ providedIn: 'root' })
export class CombatStore {
  private readonly current = signal<CombatState>(this.read());
  readonly state = this.current.asReadonly();

  /** Applies a pure change (see combat.ts) and saves. */
  update(change: (s: CombatState) => CombatState): void {
    const next = change(this.current());
    if (next === this.current()) return;
    this.current.set(next);
    this.write(next);
  }

  /** Ends the combat: everything is cleared. */
  clear(): void {
    this.current.set(emptyCombat());
    try {
      localStorage.removeItem(KEY);
    } catch {
      // storage blocked: it only lived in memory anyway
    }
  }

  private read(): CombatState {
    try {
      const raw = localStorage.getItem(KEY);
      return (raw && normalizeCombat(JSON.parse(raw))) || emptyCombat();
    } catch {
      return emptyCombat();
    }
  }

  private write(s: CombatState): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // storage blocked or full: the combat stays in memory for this session
    }
  }
}
