import { Component, booleanAttribute, computed, input, output, signal } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { MIN_PASSWORD_LENGTH } from '../../core/settings/token-vault';

export interface PasswordSubmit {
  password: string;
  remember: boolean;
}

/**
 * A password, typed twice when it's new (at least MIN_PASSWORD_LENGTH characters), with "remember
 * on this device". Whatever is projected goes first in the form (e.g. the encounter's name).
 */
@Component({
  selector: 'app-password-form',
  imports: [TranslatePipe],
  template: `
    <form class="pw" (submit)="submit($event)">
      <ng-content />
      @if (!hidePassword()) {
        <label>
          {{ (mode() === 'new' ? 'vault.newPassword' : 'vault.password') | t }}
          <input
            type="password"
            name="password"
            [attr.autocomplete]="mode() === 'new' ? 'new-password' : 'current-password'"
            [value]="password()"
            (input)="password.set($any($event.target).value)"
          />
        </label>
        @if (mode() === 'new') {
          <label>
            {{ 'vault.passwordAgain' | t }}
            <input
              type="password"
              name="passwordAgain"
              autocomplete="new-password"
              [value]="again()"
              (input)="again.set($any($event.target).value)"
            />
          </label>
          <small class="muted">{{ 'vault.minLength' | t: { min: min } }}</small>
        }
        <label class="remember">
          <input
            type="checkbox"
            name="remember"
            [checked]="remember()"
            (change)="remember.set($any($event.target).checked)"
          />
          {{ 'vault.remember' | t }}
        </label>
      }
      @if (shownError(); as e) {
        <p class="issue" role="alert">{{ e | t: { min: min } }}</p>
      }
      <div class="row">
        <button type="submit" class="primary" [disabled]="busy()">
          {{ busy() ? ('vault.working' | t) : submitLabel() }}
        </button>
        @if (cancelable()) {
          <button type="button" class="btn-ghost" (click)="cancelled.emit()">
            {{ 'common.cancel' | t }}
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    .pw {
      display: grid;
      gap: var(--space-2);
      max-width: 28rem;
    }
    label:not(.remember) {
      display: grid;
      gap: 0.15rem;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    label input[type='password'] {
      font-size: var(--fs-md);
    }
    .remember {
      justify-self: start;
    }
    .issue {
      margin: 0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class PasswordForm {
  /** 'new': typed twice; 'current': an existing password. */
  readonly mode = input<'new' | 'current'>('current');
  readonly submitLabel = input.required<string>();
  readonly busy = input(false);
  /** i18n key of an error from the caller (e.g. "wrong password"). */
  readonly error = input<string | null>(null);
  readonly cancelable = input(false, { transform: booleanAttribute });
  /** No password needed (e.g. the key is already unlocked): only the projected fields. */
  readonly hidePassword = input(false);

  readonly submitted = output<PasswordSubmit>();
  readonly cancelled = output<void>();

  protected readonly min = MIN_PASSWORD_LENGTH;
  protected readonly password = signal('');
  protected readonly again = signal('');
  protected readonly remember = signal(true);
  /** The last submit failed the form's own checks. */
  private readonly ownError = signal<string | null>(null);
  protected readonly shownError = computed(() => this.ownError() ?? this.error());

  protected submit(event: Event): void {
    event.preventDefault();
    this.ownError.set(null);
    if (this.busy()) return;
    if (!this.hidePassword()) {
      const p = this.password();
      if (this.mode() === 'new' && p.length < MIN_PASSWORD_LENGTH)
        return this.ownError.set('vault.tooShort');
      if (this.mode() === 'new' && p !== this.again()) return this.ownError.set('vault.mismatch');
      if (!p) return this.ownError.set('vault.empty');
    }
    this.submitted.emit({ password: this.password(), remember: this.remember() });
  }

  /** Empties the fields (after success). */
  reset(): void {
    this.password.set('');
    this.again.set('');
    this.ownError.set(null);
  }
}
