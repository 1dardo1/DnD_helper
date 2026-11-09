import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService, TranslationKey } from '../core/i18n/i18n.service';
import { NavHistory } from '../core/navigation/nav-history.service';

/**
 * "← back" at the top of a page. If the user came from another page of the app (the character
 * wizard, a search, a sheet...), it goes back there, exactly as the browser's back button does,
 * and names that page; otherwise it follows `fallback` (a direct link, a reload).
 */
@Component({
  selector: 'app-back-link',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="back-link" [routerLink]="fallback()" (click)="go($event)"
    >← {{ label() }}</a
  >`,
})
export class BackLink {
  /** Where to go when there is no previous page of the app. */
  readonly fallback = input.required<unknown[] | string>();
  /** Text of the link in that case (already translated). */
  readonly fallbackLabel = input.required<string>();

  private readonly history = inject(NavHistory);
  private readonly i18n = inject(I18nService);

  protected readonly label = computed(() => {
    const t = this.history.target();
    return t.kind === 'history' && t.label
      ? this.i18n.t(t.label.key as TranslationKey)
      : this.fallbackLabel();
  });

  protected go(event: MouseEvent): void {
    // ctrl/cmd/shift/middle click still open the fallback address in a new tab or window
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    if (this.history.target().kind !== 'history') return;
    event.preventDefault();
    void this.history.back(this.fallback());
  }
}
