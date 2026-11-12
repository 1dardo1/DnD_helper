import { Injectable, signal } from '@angular/core';

import { ConcentrationLoss } from '../../core/play/concentration';

/** What the concentration chip tells the player right now (one at a time). */
export type ConcentrationNotice =
  /** The player took damage while concentrating: remind them of the save. */
  | { kind: 'check'; spellId: string; damage: number }
  /** Concentration ended by itself (0 HP, condition, rest). */
  | { kind: 'lost'; spellId: string; reason: ConcentrationLoss }
  /** A new concentration spell replaced the old one. */
  | { kind: 'replaced'; oldId: string; newId: string };

/**
 * A line shared by whoever changes the concentration (play panel, spell book, combat tab) and
 * the chip that shows it. Only lives with the sheet: it is cleared when the chip goes away.
 */
@Injectable({ providedIn: 'root' })
export class ConcentrationNotices {
  readonly notice = signal<ConcentrationNotice | null>(null);

  show(n: ConcentrationNotice): void {
    this.notice.set(n);
  }

  clear(): void {
    this.notice.set(null);
  }
}
