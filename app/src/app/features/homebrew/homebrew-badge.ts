import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';

/**
 * "Custom — waiting for the DM's approval" wherever a custom background is used. `status` is a
 * stamp (compendium, wizard); `inline` plain words after the name ("(personalizado, pendiente
 * de aprobación del DM)", the character sheet).
 */
@Component({
  selector: 'app-homebrew-badge',
  imports: [TranslatePipe],
  template: `
    @if (variant() === 'inline') {
      <span class="inline" [class.ok]="approved()">{{ inlineKey() | t }}</span>
    } @else {
      <span class="stamp" [class.ok]="approved()">{{ statusKey() | t }}</span>
    }
  `,
  styles: `
    .stamp {
      display: inline-block;
      padding: 0.05em 0.7em;
      font-family: var(--font-title);
      font-size: var(--fs-sm);
      line-height: 1.5;
      color: var(--warn);
      border: 1px solid currentColor;
      border-radius: 0.8em;

      &.ok {
        color: var(--ok);
      }
    }

    .inline {
      font-family: var(--font-body);
      font-size: var(--fs-sm);
      font-style: italic;
      color: var(--warn);

      &.ok {
        color: var(--ok);
      }
    }
  `,
})
export class HomebrewBadge {
  readonly approved = input(false);
  readonly variant = input<'status' | 'inline'>('status');

  protected readonly statusKey = computed(() =>
    this.approved() ? 'homebrew.status.approved' : 'homebrew.status.pending',
  );
  protected readonly inlineKey = computed(() =>
    this.approved() ? 'homebrew.inline.approved' : 'homebrew.inline.pending',
  );
}
