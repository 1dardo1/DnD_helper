import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES, Entry, EntryType } from '../../core/models/compendium';
import { LoadError } from './load-error';
import { entrySummary } from './entry-summary';

@Component({
  selector: 'app-entry-list',
  imports: [RouterLink, TranslatePipe, LoadError],
  template: `
    <p>
      <a routerLink="/compendium">← {{ 'compendium.title' | t }}</a>
    </p>
    <h1>{{ 'type.' + entryType() | t }}</h1>

    <input
      type="search"
      [placeholder]="'common.search' | t"
      [value]="query()"
      (input)="query.set($any($event.target).value)"
      [attr.aria-label]="'common.search' | t"
    />

    @if (entries.isLoading()) {
      <p>{{ 'common.loading' | t }}</p>
    } @else if (entries.error()) {
      <app-load-error [error]="entries.error()" />
    } @else {
      <ul class="entries">
        @for (e of filtered(); track e.id) {
          <li>
            <a [routerLink]="['/compendium', entryType(), e.id]">{{ e.name }}</a>
            <small>{{ summary(e) }}</small>
            @if (e.edition === '2014') {
              <small class="edition">2014</small>
            }
          </li>
        } @empty {
          <li>{{ 'common.noResults' | t }}</li>
        }
      </ul>
    }
  `,
  styles: `
    input[type='search'] {
      width: 100%;
      max-width: 24rem;
      margin-bottom: 1rem;
    }
    .entries {
      list-style: none;
      padding: 0;
    }
    .entries li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: baseline;
      padding: 0.25rem 0;
    }
    .edition {
      border: 1px solid currentColor;
      padding: 0 0.25rem;
    }
  `,
})
export class EntryList {
  /** Route parameter. */
  readonly type = input.required<string>();
  private readonly compendium = inject(CompendiumService);

  protected readonly entryType = computed<EntryType>(() =>
    ENTRY_TYPES.includes(this.type() as EntryType) ? (this.type() as EntryType) : 'class',
  );
  protected readonly query = signal('');
  protected readonly entries = resource({
    params: () => this.entryType(),
    loader: ({ params }) => this.compendium.all(params) as Promise<Entry[]>,
  });
  protected readonly filtered = computed(() => {
    const q = normalise(this.query());
    const list = this.entries.value() ?? [];
    const matches = q ? list.filter((e) => normalise(e.name).includes(q)) : list;
    return [...matches].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected summary(e: Entry): string {
    return entrySummary(e);
  }
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
