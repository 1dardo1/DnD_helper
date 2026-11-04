import { CanDeactivateFn } from '@angular/router';

/** A page that may hold changes that would be lost on leaving it. */
export interface LeaveCheck {
  /** True if it can be left now (asking the user first when something would be lost). */
  canLeave(): boolean;
}

/**
 * Asks before leaving the edit wizard only when its changes would really be lost: normally they
 * are kept as a draft in this browser, so leaving is free and the sheet offers to continue.
 */
export const unsavedEditGuard: CanDeactivateFn<LeaveCheck> = (page) => page?.canLeave?.() ?? true;
