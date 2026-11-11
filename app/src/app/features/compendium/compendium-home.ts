import { Component, inject, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { BROWSE_TEXTS } from '../../core/i18n/browse.es';
import { DataNamePipe } from '../../core/i18n/data-text.service';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES } from '../../core/models/compendium';
import { LoadError } from './load-error';
import { RecentEntries } from './recent-entries';

@Component({
  selector: 'app-compendium-home',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, DataNamePipe, LoadError],
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

    @if (recent.list().length) {
      <section class="recent" aria-labelledby="recent-title">
        <h2 id="recent-title">
          {{ 'browse.recent' | t }}
          <button
            type="button"
            class="btn-ghost clear"
            [attr.aria-label]="'browse.clearRecent' | t"
            [title]="'browse.clearRecent' | t"
            (click)="recent.clear()"
          >
            ✕
          </button>
        </h2>
        <ul>
          @for (r of recent.list(); track r.type + '/' + r.id) {
            <li>
              <a [routerLink]="['/compendium', r.type, r.id]">
                {{ r.name | dataName: true }}
                <small>{{ 'type.' + r.type | t }}</small>
              </a>
            </li>
          }
        </ul>
      </section>
    }

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
        <li>
          <a routerLink="/compendium/crafting">{{ 'crafting.title' | t }}</a>
          <small>{{ 'crafting.blurb' | t }}</small>
        </li>
      </ul>
      <p>
        <small>{{ 'compendium.dataVersion' | t: { date: m.generatedAt | localDate } }}</small>
        @if (compendium.offline()) {
          <small> · {{ 'compendium.offline' | t }}</small>
        }
      </p>
      <p class="credit">
        <small
          >{{ 'monster.creditMonsters' | t }} {{ 'monster.credit' | t }}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener"
            >creativecommons.org/licenses/by/4.0</a
          ></small
        >
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
      background: hsl(calc(var(--i, 0) * 40) 38% 38%);
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
    /* short screens that aren't phones (landscape tablets): smaller cards so it all fits */
    @media (min-width: 45rem) and (max-height: 56rem) {
      .sections {
        gap: var(--space-2);
        margin-block: var(--space-2);
      }
      .sections li {
        padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
      }
      .sections a {
        font-size: var(--fs-lg);
      }
      p {
        margin-block: var(--space-2);
      }
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
    .sections li:nth-child(10) {
      --i: 8.5;
    }
    .sections li:nth-child(n + 11) {
      --i: 4.5;
    }
    .credit {
      color: var(--ink-soft);
    }
    /* recently viewed: one row of small cards, sideways on phones */
    .recent h2 {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: var(--space-4) 0 var(--space-2);
      font-size: var(--fs-lg);
    }
    .recent .clear {
      min-height: var(--tap);
      min-width: var(--tap);
      padding: 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .recent ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .recent li {
      margin: 0;
    }
    .recent a {
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      min-height: var(--tap);
      padding: 0.25rem 0.75rem;
      line-height: 1.2;
      text-decoration: none;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    .recent small {
      font-size: var(--fs-xs);
      color: var(--ink-soft);
    }
    /* phones: the eleven sections in two columns of short cards (one long column took three
       screens), and the recent pages in one row that scrolls sideways */
    @media (max-width: 44.99rem) {
      .sections {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2);
      }
      .sections li {
        justify-content: center;
        min-height: 4.5rem;
        padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      }
      .sections a {
        font-size: var(--fs-lg);
      }
      .recent ul {
        flex-wrap: nowrap;
        overflow-x: auto;
        margin-inline: -1rem;
        padding: 0 1rem var(--space-1);
        scrollbar-width: thin;
      }
      .recent li {
        flex: none;
        max-width: 70vw;
      }
    }
  `,
})
export class CompendiumHome {
  protected readonly compendium = inject(CompendiumService);
  protected readonly recent = inject(RecentEntries);
  private readonly router = inject(Router);
  protected readonly types = ENTRY_TYPES;
  protected readonly meta = resource({ loader: () => this.compendium.getMeta() });

  constructor() {
    inject(I18nService).extend(BROWSE_TEXTS);
  }

  protected search(event: Event, q: string): void {
    event.preventDefault();
    this.router.navigate(['/compendium/search'], { queryParams: q.trim() ? { q } : {} });
  }
}
