import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SyncService } from '../../core/characters/sync.service';
import { CustomBackground } from '../../core/homebrew/custom-background';
import { HomebrewStore } from '../../core/homebrew/homebrew-store.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { BackgroundEditor } from './background-editor';
import { HomebrewBadge } from './homebrew-badge';

/**
 * Under the title of a custom background in the compendium: whether the DM approved it (the
 * user's own tick, an honour system), and Edit / Delete.
 */
@Component({
  selector: 'app-custom-background-panel',
  imports: [TranslatePipe, HomebrewBadge, BackgroundEditor],
  template: `
    @let b = background();
    <aside class="panel" [class.approved]="b.dmApproved" role="note">
      <p class="badge-row"><app-homebrew-badge [approved]="b.dmApproved" /></p>
      <p class="note">
        {{ (b.dmApproved ? 'homebrew.approve.approvedNote' : 'homebrew.warn.text') | t }}
      </p>
      <label class="tick">
        <input
          type="checkbox"
          [checked]="b.dmApproved"
          (change)="approve($any($event.target).checked)"
          data-testid="bg-approved"
        />
        {{ 'homebrew.approve.label' | t }}
      </label>
      <small>{{ 'homebrew.approve.hint' | t }}</small>
      <p class="buttons">
        <button type="button" class="btn" (click)="editing.set(true)">
          {{ 'homebrew.edit' | t }}
        </button>
        <button type="button" class="btn" (click)="remove()">{{ 'homebrew.delete' | t }}</button>
      </p>
    </aside>
    @if (editing()) {
      <app-background-editor [background]="b" (saved)="afterSave()" (closed)="editing.set(false)" />
    }
  `,
  styles: `
    .panel {
      display: grid;
      gap: var(--space-2);
      margin: var(--space-3) 0;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--warn);
      border-left-width: 5px;
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--warn) 9%, var(--card));

      &.approved {
        border-color: var(--ok);
        background: color-mix(in srgb, var(--ok) 8%, var(--card));
      }

      p {
        margin: 0;
      }
    }

    .tick {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      min-height: var(--tap);
      font-family: var(--font-title);
      font-size: var(--fs-md);
    }

    small {
      color: var(--ink-soft);
    }

    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class CustomBackgroundPanel {
  readonly background = input.required<CustomBackground>();

  private readonly store = inject(HomebrewStore);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly editing = signal(false);

  protected async approve(on: boolean): Promise<void> {
    await this.store.setApproved(this.background().id, on);
    void this.sync.sync();
  }

  protected afterSave(): void {
    void this.sync.sync();
  }

  protected async remove(): Promise<void> {
    const b = this.background();
    if (!confirm(this.i18n.t('homebrew.confirmDelete', { name: b.name }))) return;
    await this.store.remove(b.id);
    void this.sync.sync();
    await this.router.navigate(['/compendium', 'background']);
  }
}
