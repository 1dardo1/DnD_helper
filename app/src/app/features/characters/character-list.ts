import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';

/** Characters on this device, with their cloud status. The character sheet comes in a later phase. */
@Component({
  selector: 'app-character-list',
  imports: [RouterLink, TranslatePipe, LocalDatePipe],
  template: `
    <h1>{{ 'characters.title' | t }}</h1>
    <p>
      <a routerLink="/characters/new">+ {{ 'nav.create' | t }}</a>
    </p>

    <ul class="characters">
      @for (r of store.all(); track r.character.id) {
        <li>
          <strong>{{ r.character.name }}</strong>
          <span class="status" [attr.data-status]="r.status">{{
            'characters.status.' + r.status | t
          }}</span>
          <small>{{ r.character.updatedAt | localDate }} · {{ r.character.updatedBy }}</small>
        </li>
      } @empty {
        <li>{{ 'characters.empty' | t }}</li>
      }
    </ul>
  `,
  styles: `
    .characters {
      list-style: none;
      padding: 0;
    }
    .characters li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: baseline;
      padding: 0.5rem 0;
      border-bottom: 1px solid #eee;
    }
    .status {
      border: 1px solid currentColor;
      padding: 0 0.25rem;
    }
  `,
})
export class CharacterList implements OnInit {
  protected readonly store = inject(CharacterStore);

  ngOnInit(): void {
    void this.store.load();
  }
}
