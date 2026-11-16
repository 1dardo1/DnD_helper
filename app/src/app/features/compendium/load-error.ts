import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { RepositoryService } from '../../core/data/repository.service';
import { BROWSE_TEXTS } from '../../core/i18n/browse.es';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';

/** "Failed to fetch", "network error", "Load failed" (Safari)...: the data couldn't be downloaded. */
const NETWORK = /fetch|network|load failed|offline|timed? ?out/i;

/**
 * Error while loading data: points to Settings when the GitHub connection isn't set up; when the
 * data couldn't be downloaded (no connection and no saved copy) a friendly notice with a "Retry"
 * button, if the page listens to (retry); any other error, as it is.
 */
@Component({
  selector: 'app-load-error',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (needsSetup()) {
      <p>
        <a routerLink="/settings">{{ 'compendium.needsSetup' | t }}</a>
      </p>
    } @else if (offline()) {
      <section class="no-connection" role="alert">
        <h2>{{ 'browse.noConnection.title' | t }}</h2>
        <p>{{ 'browse.noConnection.text' | t }}</p>
        @if (retryable()) {
          <button type="button" (click)="tryAgain()">{{ 'browse.retry' | t }}</button>
        }
      </section>
    } @else {
      <p role="alert">{{ 'common.error' | t: { message: message() } }}</p>
    }
  `,
  styles: `
    .no-connection {
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    .no-connection h2 {
      margin-top: 0;
    }
  `,
})
export class LoadError {
  readonly error = input<unknown>();
  /** Shows the "Retry" button; the page reloads its data on (retry). */
  readonly retryable = input(false);
  readonly retry = output<void>();

  private readonly repo = inject(RepositoryService);
  private readonly compendium = inject(CompendiumService);

  constructor() {
    inject(I18nService).extend(BROWSE_TEXTS);
  }

  protected readonly needsSetup = computed(() => this.repo.source() === null);
  protected readonly message = computed(() => {
    const e = this.error();
    return e instanceof Error ? e.message : String(e ?? '');
  });
  protected readonly offline = computed(
    () => NETWORK.test(this.message()) || (typeof navigator !== 'undefined' && !navigator.onLine),
  );

  protected tryAgain(): void {
    // forget the failed attempt, so the page's reload downloads again
    this.compendium.retry();
    this.retry.emit();
  }
}
