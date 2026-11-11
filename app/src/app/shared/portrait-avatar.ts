import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TranslatePipe } from '../core/i18n/i18n.service';

/**
 * The character's picture in a gilded round frame, or, without one, the class icon (needs a
 * themed ancestor, see ClassThemeDirective). The size is `--portrait` (default 3.5rem ≈ 56 px)
 * so each place sets it with CSS.
 */
@Component({
  selector: 'app-portrait-avatar',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (portrait(); as src) {
      <img [src]="src" [alt]="'portrait.preview' | t: { name: name() }" />
    } @else {
      <span class="class-icon" aria-hidden="true"></span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: var(--portrait, 3.5rem);
      height: var(--portrait, 3.5rem);
      overflow: hidden;
      border-radius: 50%;
      background: var(--paper-2);
      border: 2px solid var(--accent-2, var(--brass));
      box-shadow:
        0 0 0 2px var(--card),
        0 0 0 3px var(--line-strong),
        var(--shadow-1);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .class-icon {
      width: 70%;
      height: 70%;
      margin: 0;
    }
  `,
})
export class PortraitAvatar {
  readonly portrait = input<string | null | undefined>(null);
  readonly name = input('');
}
