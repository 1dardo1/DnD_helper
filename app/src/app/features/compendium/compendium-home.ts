import { Component, inject, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES } from '../../core/models/compendium';
import { LoadError } from './load-error';

@Component({
  selector: 'app-compendium-home',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, LoadError],
  template: `
    <h1>{{ 'compendium.title' | t }}</h1>
    <p>{{ 'compendium.intro' | t }}</p>

    <form class="search" role="search" (submit)="search($event, q.value)">
      <input
        #q
        type="search"
        name="q"
        [placeholder]="'search.placeholder' | t"
        [attr.aria-label]="'search.placeholder' | t"
      />
      <button type="submit">{{ 'common.search' | t }}</button>
    </form>

    @if (meta.isLoading()) {
      <p>{{ 'common.loading' | t }}</p>
    } @else if (meta.error()) {
      <app-load-error [error]="meta.error()" />
    } @else if (meta.value(); as m) {
      <ul class="sections">
        @for (type of types; track type) {
          <li>
            <a [routerLink]="['/compendium', type]">{{ 'type.' + type | t }}</a>
            <small>{{ 'compendium.entries' | t: { count: m.counts[type] ?? 0 } }}</small>
          </li>
        }
      </ul>
      <p>
        <small>{{ 'compendium.dataVersion' | t: { date: m.generatedAt | localDate } }}</small>
        @if (compendium.offline()) {
          <small> · {{ 'compendium.offline' | t }}</small>
        }
      </p>
    }
  `,
  styles: `
    .search {
      display: flex;
      gap: 0.5rem;
      max-width: 30rem;
    }
    .search input {
      flex: 1;
      min-width: 0;
    }
    .sections {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
      gap: var(--space-3);
      padding: 0;
      list-style: none;
    }
    .sections li {
      position: relative;
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: var(--space-3) var(--space-4) var(--space-3) var(--space-5);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 3px var(--radius-md) var(--radius-md) 3px;
      box-shadow: var(--shadow-1);
    }
    /* coloured divider edge */
    .sections li::before {
      content: '';
      position: absolute;
      inset: -1px auto -1px -1px;
      width: 0.5rem;
      border-radius: 3px 0 0 3px;
      background: hsl(calc(var(--i, 0) * 40) 45% 55%);
    }
    .sections a {
      font-family: var(--font-hand);
      font-size: var(--fs-xl);
      font-weight: 700;
      line-height: 1.2;
      text-decoration: none;
    }
    .sections a::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .sections li:hover {
      border-color: var(--line-strong);
      box-shadow: var(--shadow-2);
    }
    .sections li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .sections a:focus-visible {
      outline: none;
    }
    .sections li:nth-child(2) {
      --i: 1;
    }
    .sections li:nth-child(3) {
      --i: 2;
    }
    .sections li:nth-child(4) {
      --i: 3;
    }
    .sections li:nth-child(5) {
      --i: 4;
    }
    .sections li:nth-child(6) {
      --i: 5;
    }
    .sections li:nth-child(7) {
      --i: 6;
    }
    .sections li:nth-child(8) {
      --i: 7;
    }
    .sections li:nth-child(9) {
      --i: 8;
    }
    .sections li:nth-child(n + 10) {
      --i: 4.5;
    }
  `,
})
export class CompendiumHome {
  protected readonly compendium = inject(CompendiumService);
  private readonly router = inject(Router);
  protected readonly types = ENTRY_TYPES;
  protected readonly meta = resource({ loader: () => this.compendium.getMeta() });

  protected search(event: Event, q: string): void {
    event.preventDefault();
    this.router.navigate(['/compendium/search'], { queryParams: q.trim() ? { q } : {} });
  }
}
