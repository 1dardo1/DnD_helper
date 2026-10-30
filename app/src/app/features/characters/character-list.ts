import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';

/** Characters on this device (plus any new ones in the repo), with their cloud status. */
@Component({
  selector: 'app-character-list',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, ClassThemeDirective],
  template: `
    <h1>{{ 'characters.title' | t }}</h1>
    <p>
      <a class="btn btn-primary new" routerLink="/characters/new">+ {{ 'nav.create' | t }}</a>
    </p>

    @if (sync.lastError()) {
      <p role="alert">{{ 'common.error' | t: { message: sync.lastError() ?? '' } }}</p>
    }

    <ul class="characters">
      @for (r of store.all(); track r.character.id) {
        <li
          [appClassTheme]="{
            classId: r.character.classes[0]?.id,
            subclassId: r.character.classes[0]?.subclassId,
          }"
        >
          <a [routerLink]="['/characters', r.character.id]"
            ><strong>{{ r.character.name }}</strong></a
          >
          <span class="status" [attr.data-status]="r.status">{{
            'characters.status.' + r.status | t
          }}</span>
          @if (r.status === 'conflict') {
            <a [routerLink]="['/characters', r.character.id, 'conflict']">{{
              'conflict.resolve' | t
            }}</a>
          }
          <small>{{ r.character.updatedAt | localDate }} · {{ r.character.updatedBy }}</small>
        </li>
      } @empty {
        <li>{{ 'characters.empty' | t }}</li>
      }
    </ul>
  `,
  styles: `
    .characters {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }
    .characters li {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-3);
      align-items: center;
      margin: 0;
      padding: 2rem var(--space-4) var(--space-3);
      background-color: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    .characters li.class-theme::after {
      top: 1.5rem;
      width: 4.5rem;
    }
    .characters li > a:first-child {
      flex: 1 1 100%;
      font-family: var(--font-hand);
      font-size: var(--fs-2xl);
      line-height: 1.1;
      color: var(--accent);
      text-decoration: none;
    }
    .characters li > a:first-child::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .characters li > a:first-child strong {
      font-weight: 700;
    }
    .characters li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .characters li > a:first-child:focus-visible {
      outline: none;
    }
    .characters li > a:not(:first-child) {
      position: relative;
      z-index: 1;
      font-weight: 700;
      color: var(--danger);
    }
    .characters small {
      flex: 1 1 100%;
    }
    .new {
      font-family: var(--font-note);
      font-weight: 700;
    }
  `,
})
export class CharacterList implements OnInit {
  protected readonly store = inject(CharacterStore);
  protected readonly sync = inject(SyncService);

  async ngOnInit(): Promise<void> {
    await this.store.load();
    void this.sync.sync();
  }
}
