import { Component, computed, inject, input, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermDomain, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES, Entry, EntryType } from '../../core/models/compendium';
import { FILTERS, FilterKey, applyFilters, filterChoices } from './compendium-filters';
import { normalise } from './compendium-search';
import { LoadError } from './load-error';
import { entrySummary } from './entry-summary';

/** Glossary domain of the "category" filter for each type that has one. */
const CATEGORY_DOMAIN: Partial<Record<EntryType, TermDomain>> = {
  feat: 'featCategory',
  item: 'itemCategory',
  rule: 'ruleCategory',
};

/** Entries of one type, with a name search and filters; both live in the URL (?q=…&school=…). */
@Component({
  selector: 'app-entry-list',
  imports: [RouterLink, TranslatePipe, DataNamePipe, LoadError],
  template: `
    <p>
      <a routerLink="/compendium">← {{ 'compendium.title' | t }}</a>
    </p>
    <h1>{{ 'type.' + entryType() | t }}</h1>

    <div class="controls">
      <input
        type="search"
        [placeholder]="'common.search' | t"
        [value]="query()"
        (input)="setParam('q', $any($event.target).value, true)"
        [attr.aria-label]="'common.search' | t"
      />
      @for (f of filters(); track f.key) {
        <label>
          {{ 'filter.' + f.key | t }}
          <select (change)="setParam(f.key, $any($event.target).value)">
            <option value="" [selected]="!f.selected">{{ 'filter.all' | t }}</option>
            @for (c of f.choices; track c.value) {
              <option [value]="c.value" [selected]="c.value === f.selected">{{ c.label }}</option>
            }
          </select>
        </label>
      }
      @if (anyActive()) {
        <button type="button" (click)="clear()">{{ 'filter.clear' | t }}</button>
      }
    </div>

    @if (entries.isLoading()) {
      <p>{{ 'common.loading' | t }}</p>
    } @else if (entries.error()) {
      <app-load-error [error]="entries.error()" />
    } @else {
      <p class="count" aria-live="polite">
        <small>{{ 'filter.count' | t: { count: filtered().length } }}</small>
      </p>
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
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      align-items: end;
      margin-bottom: 0.5rem;
    }
    .controls label {
      display: flex;
      flex-direction: column;
      font-size: 0.875rem;
    }
    .controls select {
      max-width: 14rem;
    }
    input[type='search'] {
      width: 100%;
      max-width: 24rem;
    }
    .count {
      margin: 0;
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly entryType = computed<EntryType>(() =>
    ENTRY_TYPES.includes(this.type() as EntryType) ? (this.type() as EntryType) : 'class',
  );
  protected readonly query = computed(() => this.params().get('q') ?? '');
  private readonly selected = computed(
    () =>
      Object.fromEntries(
        FILTERS[this.entryType()].map((k) => [k, this.params().get(k) ?? '']),
      ) as Record<FilterKey, string>,
  );
  protected readonly anyActive = computed(
    () => !!this.query() || Object.values(this.selected()).some(Boolean),
  );

  protected readonly entries = resource({
    params: () => this.entryType(),
    loader: ({ params }) => this.compendium.all(params) as Promise<Entry[]>,
  });
  private readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly classNames = resource({
    loader: async () => new Map((await this.compendium.all('class')).map((c) => [c.id, c.name])),
  });

  /** The filters worth showing (more than one value to choose from), with their labels. */
  protected readonly filters = computed(() => {
    const list = this.entries.value() ?? [];
    return FILTERS[this.entryType()]
      .map((key) => {
        const choices = filterChoices(list, key).map((value) => ({
          value,
          label: this.label(key, value),
        }));
        // Levels and rarities keep their game order; the rest go alphabetically by label.
        if (key !== 'level' && key !== 'rarity') {
          choices.sort((a, b) => a.label.localeCompare(b.label));
        }
        return { key, selected: this.selected()[key], choices };
      })
      .filter((f) => f.choices.length > 1 || f.selected);
  });

  /** Searches the name shown and the English one; sorted by the name shown. */
  protected readonly filtered = computed(() => {
    const q = normalise(this.query());
    const list = applyFilters(this.entries.value() ?? [], this.selected());
    const matches = q
      ? list.filter((e) => normalise(this.data.searchText(e.name)).includes(q))
      : list;
    const shown = (e: Entry) => this.data.shortName(e.name);
    return [...matches].sort((a, b) => shown(a).localeCompare(shown(b)));
  });

  /** Updates one query parameter; typing replaces the history entry instead of adding one. */
  protected setParam(key: 'q' | FilterKey, value: string, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value || null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  protected clear(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  private label(key: FilterKey, value: string): string {
    const lang = this.i18n.language();
    let text: string;
    switch (key) {
      case 'level':
        text =
          value === '0'
            ? this.i18n.t('spell.cantrip')
            : this.i18n.t('filter.levelN', { level: value });
        break;
      case 'school':
        text = term(lang, 'school', value);
        break;
      case 'class':
        text = this.data.shortName(this.classNames.value()?.get(value) ?? value);
        break;
      case 'category': {
        const domain = CATEGORY_DOMAIN[this.entryType()];
        text = domain ? term(lang, domain, value) : value;
        break;
      }
      case 'rarity':
        text = term(lang, 'rarity', value);
        break;
      case 'magic':
        text = this.i18n.t(value === 'magic' ? 'filter.magicOnly' : 'filter.mundaneOnly');
        break;
      case 'group':
        text = term(lang, 'optionGroup', value);
        break;
      case 'edition':
        text = this.i18n.t('common.edition', { edition: value });
        break;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

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
