import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RepositoryService } from '../../core/data/repository.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Error while loading data: points to Settings when the GitHub connection isn't set up. */
@Component({
  selector: 'app-load-error',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (needsSetup()) {
      <p>
        <a routerLink="/settings">{{ 'compendium.needsSetup' | t }}</a>
      </p>
    } @else {
      <p role="alert">{{ 'common.error' | t: { message: message() } }}</p>
    }
  `,
})
export class LoadError {
  readonly error = input<unknown>();
  private readonly repo = inject(RepositoryService);

  protected readonly needsSetup = computed(() => this.repo.source() === null);
  protected readonly message = computed(() => {
    const e = this.error();
    return e instanceof Error ? e.message : String(e ?? '');
  });
}
