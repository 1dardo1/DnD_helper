import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApkUpdateService } from '../core/app-update/apk-update.service';
import { CharacterStore } from '../core/characters/character-store.service';
import { SyncService } from '../core/characters/sync.service';
import { RepositoryService } from '../core/data/repository.service';
import { DevUpdateService } from '../core/dev/dev-update.service';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { AppUpdateService } from '../core/pwa/app-update.service';

/**
 * The top bar's status: is everything saved to GitHub, sync now, a new version to reload. It is a
 * deferred block of the shell (app.html, `@defer (on idle)`): the character store, the sync of
 * characters, encounters and backgrounds and their models stay out of the app's first load, and
 * synchronisation starts as soon as the first page is on screen.
 */
@Component({
  selector: 'app-shell-status',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (readOnly()) {
      <small>{{ 'sync.readOnly' | t }}</small>
    } @else if (state() !== 'conflicts') {
      <small class="state" [attr.data-state]="state()" [title]="sync.lastError() ?? ''">
        @switch (state()) {
          @case ('syncing') {
            {{ 'sync.syncing' | t }}
          }
          @case ('offline') {
            {{ 'sync.offline' | t }}
          }
          @case ('error') {
            {{ 'sync.error' | t }}
          }
          @case ('pending') {
            {{ 'sync.pending' | t: { count: store.pending() } }}
          }
          @case ('ok') {
            {{ 'sync.ok' | t }}
          }
        }
      </small>
      @if (store.conflicts().length) {
        <a routerLink="/characters"
          ><small>{{ 'sync.conflicts' | t: { count: store.conflicts().length } }}</small></a
        >
      }
      <button type="button" (click)="sync.sync()" [disabled]="sync.state() === 'syncing'">
        {{ 'sync.now' | t }}
      </button>
    }
    @if (appUpdate.ready()) {
      <small>{{ 'appUpdate.ready' | t }}</small>
      <button type="button" (click)="appUpdate.reload()">{{ 'appUpdate.reload' | t }}</button>
    }
    @if (update.available()) {
      @if (update.message()) {
        <small class="update-message" [title]="update.message()">{{ update.message() }}</small>
      }
      <button type="button" (click)="update.run()" [disabled]="update.updating()">
        {{ (update.updating() ? 'update.running' : 'update.button') | t }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: inherit;
      gap: 0.25rem 0.6rem;
      min-width: 0;
    }

    small {
      color: color-mix(in srgb, var(--cover-ink) 85%, transparent);
      font-size: 0.85rem;
      font-style: italic;
      line-height: 1.2;
    }

    // a small lamp before the state: green saved, amber waiting, red failed
    .state::before {
      content: '';
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      margin-right: 0.35rem;
      border-radius: 50%;
      vertical-align: 0.05rem;
      background: #8fd197;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
    }

    .state:is([data-state='pending'], [data-state='syncing'], [data-state='offline'])::before {
      background: #f0b860;
    }

    .state[data-state='error']::before {
      background: #ff8a7a;
    }

    // Git's reasons can be long: one line here, the rest on hover.
    .update-message {
      overflow: hidden;
      max-width: 14rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    a {
      color: #f3c46b;
      font-weight: 700;
    }

    button {
      min-height: 2rem;
      padding: 0.1rem 0.7rem;
      font-size: 0.9rem;
      color: var(--cover-ink);
      background: rgb(255 255 255 / 0.06);
      border: 1px solid rgb(232 207 150 / 0.5);
      box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.2);

      &:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.14);
        border-color: rgb(232 207 150 / 0.8);
      }
    }
  `,
})
export class ShellStatus {
  protected readonly sync = inject(SyncService);
  protected readonly store = inject(CharacterStore);
  protected readonly update = inject(DevUpdateService);
  protected readonly appUpdate = inject(AppUpdateService);
  private readonly repo = inject(RepositoryService);
  /** Local files can't be written: say so instead of "not saved to the cloud". */
  protected readonly readOnly = computed(() => this.repo.source()?.canWrite === false);

  /** One word for the lamp and the text. */
  protected readonly state = computed(() => {
    const s = this.sync.state();
    if (s !== 'idle') return s;
    if (this.store.pending()) return 'pending';
    return this.store.conflicts().length ? 'conflicts' : 'ok';
  });

  constructor() {
    void this.store.load();
    this.sync.start(inject(DestroyRef));
    void inject(ApkUpdateService).start();
  }
}
