import { Injectable, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

import { EMPTY_STACK, NavStack, popTo, resolveBack, visit } from './nav-stack';

/**
 * Remembers the pages the user opened inside the app, so "back" links (and the browser or
 * Android back button, which do the same) return to the page the user came from instead of to a
 * fixed parent. Created once by the root component.
 */
@Injectable({ providedIn: 'root' })
export class NavHistory {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly stack = signal<NavStack>(EMPTY_STACK);

  /** How the navigation in course started: replacing the entry, or coming from the browser. */
  private pending: { replace: boolean; pop: number | null } = { replace: false, pop: null };

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        const nav = this.router.currentNavigation();
        this.pending = {
          replace: !!nav?.extras?.replaceUrl,
          pop: e.navigationTrigger === 'popstate' ? (e.restoredState?.navigationId ?? null) : null,
        };
      } else if (e instanceof NavigationEnd) {
        const { replace, pop } = this.pending;
        const url = e.urlAfterRedirects;
        this.stack.update((s) =>
          pop !== null ? popTo(s, { url, id: pop }) : visit(s, { url, id: e.id }, replace),
        );
        this.pending = { replace: false, pop: null };
      }
    });
  }

  /** Where a "back" link goes now (reads a signal, so templates and computeds follow it). */
  target() {
    return resolveBack(this.stack());
  }

  /** Goes to the previous page of the app, or follows `fallback` when the visit began here. */
  async back(fallback: unknown[] | string): Promise<void> {
    if (this.target().kind === 'history') {
      this.location.back();
      return;
    }
    await this.router.navigate(typeof fallback === 'string' ? [fallback] : fallback);
  }
}
