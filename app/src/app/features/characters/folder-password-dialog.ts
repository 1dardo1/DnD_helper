import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { MIN_FOLDER_PASSWORD } from '../../core/organize/folder-lock';
import { FolderLockService } from '../../core/organize/folder-lock.service';

export type FolderPasswordMode = 'unlock' | 'set' | 'change' | 'remove';

/**
 * Asks for a folder's password and does what it was opened for: open the folder for this session,
 * put a password on it, change it or remove it. Setting, changing or removing it uploads the
 * folder's characters again, encrypted with the new key or in clear.
 */
@Component({
  selector: 'app-folder-password-dialog',
  imports: [TranslatePipe],
  template: `
    <dialog #dialog (cancel)="$event.preventDefault(); cancel()">
      <form (submit)="$event.preventDefault(); submit()">
        <h2>{{ 'folderLock.title.' + mode() | t: { folder: folder() } }}</h2>
        @if (mode() === 'set' || mode() === 'change') {
          <p class="explain">{{ 'folderLock.explain' | t }}</p>
        } @else if (mode() === 'remove') {
          <p class="explain">{{ 'folderLock.explainRemove' | t }}</p>
        }
        <label>
          {{ 'folderLock.password' | t }}
          <input
            #first
            type="password"
            autocomplete="off"
            [value]="password()"
            (input)="password.set($any($event.target).value)"
          />
        </label>
        @if (asksTwice()) {
          <label>
            {{ 'folderLock.repeat' | t }}
            <input
              type="password"
              autocomplete="off"
              [value]="repeat()"
              (input)="repeat.set($any($event.target).value)"
            />
          </label>
        }
        @if (error()) {
          <p role="alert" class="error">{{ error()! | t: { n: min } }}</p>
        }
        <p class="buttons">
          <button type="button" (click)="cancel()" [disabled]="busy()">
            {{ 'folderLock.cancel' | t }}
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="busy()">
            {{ (busy() ? 'folderLock.working' : 'folderLock.ok') | t }}
          </button>
        </p>
      </form>
    </dialog>
  `,
  styles: `
    dialog {
      max-width: min(30rem, calc(100vw - 2rem));
      background: var(--card);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    form {
      display: grid;
      gap: var(--space-3);
    }
    h2 {
      margin: 0;
      font-size: var(--fs-lg);
    }
    label {
      display: grid;
      gap: var(--space-1);
    }
    .explain {
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .error {
      margin: 0;
      color: var(--danger);
      font-weight: 700;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin: 0;
    }
  `,
})
export class FolderPasswordDialog {
  private readonly locks = inject(FolderLockService);
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);

  readonly folder = input.required<string>();
  readonly mode = input.required<FolderPasswordMode>();
  /** true when done (the folder changed), false when cancelled. */
  readonly closed = output<boolean>();

  protected readonly min = MIN_FOLDER_PASSWORD;
  protected readonly password = signal('');
  protected readonly repeat = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly first = viewChild.required<ElementRef<HTMLInputElement>>('first');

  constructor() {
    afterNextRender(() => {
      const d = this.dialog().nativeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      this.first().nativeElement.focus();
    });
  }

  protected asksTwice(): boolean {
    return this.mode() === 'set' || this.mode() === 'change';
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.finish(false);
  }

  protected async submit(): Promise<void> {
    const folder = this.folder();
    const password = this.password();
    this.error.set(null);
    if (this.asksTwice()) {
      if (password.length < MIN_FOLDER_PASSWORD) return this.error.set('folderLock.tooShort');
      if (password !== this.repeat()) return this.error.set('folderLock.mismatch');
    }
    this.busy.set(true);
    try {
      switch (this.mode()) {
        case 'unlock':
          if (!(await this.locks.unlock(folder, password)))
            return this.error.set('folderLock.wrong');
          // the folder's characters that are only in the repo can be read now
          void this.sync.sync();
          break;
        case 'set':
        case 'change':
          // first bring every character of the folder (encrypted with the old key, if any), so all
          // of them get the new one
          await this.sync.sync();
          await this.locks.setPassword(folder, password);
          await this.store.reupload(folder);
          void this.sync.sync();
          break;
        case 'remove':
          if (!(await this.locks.unlock(folder, password)))
            return this.error.set('folderLock.wrong');
          await this.sync.sync();
          this.locks.removePassword(folder);
          await this.store.reupload(folder);
          void this.sync.sync();
          break;
      }
      this.finish(true);
    } finally {
      this.busy.set(false);
    }
  }

  private finish(done: boolean): void {
    this.password.set('');
    this.repeat.set('');
    const d = this.dialog().nativeElement;
    if (d.open && typeof d.close === 'function') d.close();
    this.closed.emit(done);
  }
}
