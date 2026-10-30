import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES, Entry, EntryType } from '../../core/models/compendium';
import { LoadError } from './load-error';
import { entrySummary } from './entry-summary';

@Component({
  selector: 'app-entry-list',
  imports: [RouterLink, TranslatePipe, DataNamePipe, LoadError],
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
            <a [routerLink]="['/compendium', entryType(), e.id]">{{ e.name | dataName }}</a>
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
      max-width: 28rem;
      margin-bottom: var(--space-4);
    }
    .entries {
      columns: 2 22rem;
      column-gap: var(--space-6);
      padding: 0;
      list-style: none;
    }
    .entries li {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--space-2);
      align-items: baseline;
      margin: 0;
      padding: 0.45rem 0.25rem;
      border-bottom: 1px dashed var(--line);
      break-inside: avoid;
    }
    .entries a {
      font-weight: 600;
    }
    .entries small {
      margin-left: auto;
      text-align: right;
    }
    .entries .edition {
      margin-left: 0;
      padding: 0 0.4em;
      font-family: var(--font-note);
      border: 1.5px solid currentColor;
      border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    }
    @media (pointer: coarse) {
      .entries li {
        min-height: var(--tap);
        align-items: center;
      }
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
  private readonly data = inject(DataTextService);
  /** Searches the name shown and the English one; sorted by the name shown. */
  protected readonly filtered = computed(() => {
    const q = normalise(this.query());
    const list = this.entries.value() ?? [];
    const matches = q
      ? list.filter((e) => normalise(this.data.searchText(e.name)).includes(q))
      : list;
    const shown = (e: Entry) => this.data.shortName(e.name);
    return [...matches].sort((a, b) => shown(a).localeCompare(shown(b)));
  });

  private readonly i18n = inject(I18nService);
  private readonly classNames = resource({
    loader: async () => new Map((await this.compendium.all('class')).map((c) => [c.id, c.name])),
  });

  protected summary(e: Entry): string {
    return entrySummary(
      e,
      this.i18n.language(),
      this.i18n.t('spell.cantrip'),
      new Map(
        [...(this.classNames.value() ?? new Map())].map(([id, n]) => [id, this.data.shortName(n)]),
      ),
    );
  }
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
