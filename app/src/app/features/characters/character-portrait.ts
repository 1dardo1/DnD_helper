import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { PortraitAvatar } from '../../shared/portrait-avatar';
import { PortraitPicker } from '../../shared/portrait-picker';

/**
 * The sheet header's avatar (~56 px, round): tap it to see the picture larger and to upload,
 * frame or remove it (the picker loads on demand, only when the dialog opens).
 */
@Component({
  selector: 'app-character-portrait',
  imports: [TranslatePipe, PortraitAvatar, PortraitPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="avatar-button"
      data-testid="portrait-open"
      [attr.aria-label]="'portrait.edit' | t: { name: name() }"
      (click)="open()"
    >
      <app-portrait-avatar [portrait]="portrait()" [name]="name()" />
    </button>
    <dialog
      #dialog
      class="portrait-dialog"
      aria-labelledby="portrait-title"
      data-testid="portrait-dialog"
      (close)="isOpen.set(false)"
      (click)="backdrop($event)"
    >
      <div class="body">
        <h2 id="portrait-title">{{ 'portrait.label' | t }}</h2>
        @if (portrait(); as src) {
          <img class="big" [src]="src" [alt]="'portrait.preview' | t: { name: name() }" />
        }
        @if (isOpen()) {
          <app-portrait-picker
            [value]="portrait()"
            [name]="name()"
            (valueChange)="portraitChange.emit($event)"
          />
        }
        <div class="actions">
          <button type="button" class="btn" (click)="close()">{{ 'portrait.close' | t }}</button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    .avatar-button {
      display: inline-flex;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .avatar-button:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
    .portrait-dialog {
      width: min(24rem, calc(100vw - 1.5rem));
      max-height: calc(100dvh - 2rem);
      padding: 0;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      background: var(--paper);
      color: var(--ink);
      box-shadow: var(--shadow-2);
      &::backdrop {
        background: rgb(0 0 0 / 0.55);
      }
      h2 {
        font-size: var(--fs-lg);
      }
    }
    .body {
      padding: 0 1rem 1rem;
    }
    .big {
      display: block;
      width: min(100%, 16rem);
      aspect-ratio: 1;
      margin: 0 auto var(--space-3);
      object-fit: cover;
      border-radius: 50%;
      border: 3px solid var(--brass);
      box-shadow:
        0 0 0 3px var(--card),
        0 0 0 4px var(--line-strong),
        var(--shadow-2);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-3);
    }
  `,
})
export class CharacterPortrait {
  readonly portrait = input<string | null | undefined>(null);
  readonly name = input('');
  readonly portraitChange = output<string | null>();

  protected readonly isOpen = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected open(): void {
    this.isOpen.set(true);
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** A click on the backdrop (the dialog element itself, not its content) closes it. */
  protected backdrop(e: MouseEvent): void {
    if (e.target === this.dialog().nativeElement) this.close();
  }
}
