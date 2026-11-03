import { Component, computed, effect, inject, input, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe, TranslationKey } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES, Entry, EntryType, Item } from '../../core/models/compendium';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { EntryCard } from '../../shared/picker/entry-card';
import { ENTRY_FACETS, FacetKey, facetValues, sortByPrice } from '../../shared/picker/entry-facets';
import { EntryLabels } from '../../shared/picker/entry-labels.service';
import { defaultOrder } from '../../shared/picker/entry-order';
import { FilterBar } from '../../shared/picker/filter-bar';
import { applyFacets, modeKey } from '../../shared/picker/picker-filters';
import { normalise } from './compendium-search';
import { LoadError } from './load-error';

/** Types long enough to first choose a group (feats by category, options by group...). */
const GROUPED: Partial<Record<EntryType, FacetKey>> = {
  feat: 'category',
  option: 'group',
  item: 'category',
  subclass: 'class',
};

/** Types whose list can also be sorted by price (?sort=price-asc|price-desc). */
const PRICED = new Set<EntryType>(['item']);

/** Cards rendered at a time ("Mostrar más" for the rest). */
const PAGE = 60;

/**
 * Entries of one type as summary cards (the same ones the wizard pickers show), with a name search
 * and filters; both live in the URL (?q=…&school=…). Feats, class options, items and subclasses
 * first offer a card per group (?category=general, ?class=wizard); ?all=1 lists every entry.
 */
@Component({
  selector: 'app-entry-list',
  imports: [RouterLink, TranslatePipe, LoadError, EntryCard, FilterBar, ClassThemeDirective],
  templateUrl: './entry-list.html',
  styleUrl: './entry-list.scss',
})
export class EntryList {
  /** Route parameter. */
  readonly type = input.required<string>();
  private readonly compendium = inject(CompendiumService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly labels = inject(EntryLabels);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly entryType = computed<EntryType>(() =>
    ENTRY_TYPES.includes(this.type() as EntryType) ? (this.type() as EntryType) : 'class',
  );
  protected readonly query = computed(() => this.params().get('q') ?? '');
  private readonly keys = computed(() => ENTRY_FACETS[this.entryType()]);
  /** Filter values and their "and" modes, from the URL. */
  private readonly selected = computed(() =>
    Object.fromEntries(
      this.keys().flatMap((k) => [
        [k, this.params().get(k) ?? ''],
        [modeKey(k), this.params().get(modeKey(k)) ?? ''],
      ]),
    ),
  );

  protected readonly entries = resource({
    params: () => this.entryType(),
    loader: ({ params }) => this.compendium.all(params) as Promise<Entry[]>,
  });

  /** Sorted by the name shown (spells by level, feats by ability...), with the names to search by. */
  private readonly sorted = computed(() => {
    const shown = (e: Entry) => this.data.shortName(e.name);
    const list = defaultOrder(this.entries.value() ?? [], shown);
    return { list, texts: list.map((e) => normalise(this.data.searchText(e.name))) };
  });

  // -- groups --------------------------------------------------------------------------------
  /** The facet this type is grouped by, if any. */
  protected readonly groupKey = computed(() => GROUPED[this.entryType()] ?? null);
  /** Entering or leaving a group (same page, other query) starts at the top, like a new page. */
  private readonly groupScroll = (() => {
    let last: string | undefined;
    return effect(() => {
      const key = `${this.choosing()}|${this.groupLabel() ?? ''}`;
      if (last !== undefined && key !== last) window.scrollTo({ top: 0 });
      last = key;
    });
  })();
  /** The group open (its label), for the title. */
  protected readonly groupLabel = computed(() => {
    const key = this.groupKey();
    const value = key && this.selected()[key];
    return value ? this.labels.optionLabel(this.entryType(), key, value) : '';
  });
  /** Show the group cards: a grouped type with no group, filter, search or ?all=1. */
  protected readonly choosing = computed(
    () =>
      !!this.groupKey() &&
      !this.params().get('all') &&
      !this.query() &&
      !Object.values(this.selected()).some(Boolean),
  );
  protected readonly groups = computed(() => {
    const key = this.groupKey();
    if (!key) return [];
    const type = this.entryType();
    const counts = new Map<string, number>();
    for (const e of this.entries.value() ?? [])
      for (const v of facetValues(e, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
    return (
      [...counts]
        .map(([value, count]) => {
          const infoKey = `picker.groupInfo.${type}.${value}`;
          const info = this.i18n.t(infoKey as TranslationKey);
          return {
            value,
            params: { [key]: value },
            count,
            label: this.labels.optionLabel(type, key, value),
            info: info === infoKey ? '' : info,
          };
        })
        // classes alphabetically; other groups from the biggest
        .sort((a, b) => (key === 'class' ? 0 : b.count - a.count) || a.label.localeCompare(b.label))
    );
  });

  // -- list ----------------------------------------------------------------------------------
  /** Every entry, or those of the group that's open. */
  protected readonly inGroup = computed(() => {
    const group = this.groupKey();
    const value = group ? this.selected()[group] : '';
    const all = this.entries.value() ?? [];
    return value ? all.filter((e) => facetValues(e, group!).includes(value)) : all;
  });

  /** The filters, except the group when one is open (the title says which; the chooser changes it). */
  protected readonly facets = computed(() => {
    const group = this.groupKey();
    const keys = this.keys().filter((k) => k !== group || !this.groupLabel());
    return this.labels.facetViews(this.entryType(), this.inGroup(), keys, this.selected());
  });

  protected readonly priced = computed(() => PRICED.has(this.entryType()));
  protected readonly sort = computed(() => this.params().get('sort') ?? '');

  protected readonly filtered = computed(() => {
    const { list, texts } = this.sorted();
    const found = applyFacets(
      list,
      texts,
      (i, k) => facetValues(list[i], k as FacetKey),
      this.selected(),
      this.query(),
    );
    const sort = this.priced() ? this.sort() : '';
    return sort.startsWith('price-') ? sortByPrice(found as Item[], sort === 'price-desc') : found;
  });

  /** Back to one page whenever the type, search or filters change. */
  protected readonly limit = linkedSignal({
    source: computed(
      () => `${this.entryType()}|${this.query()}|${this.sort()}|${JSON.stringify(this.selected())}`,
    ),
    computation: () => PAGE,
  });
  protected readonly visible = computed(() => this.filtered().slice(0, this.limit()));

  protected showMore(): void {
    this.limit.update((n) => n + PAGE);
  }

  /** Updates one query parameter; typing replaces the history entry instead of adding one. */
  protected setParam(key: string, value: string, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value || null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  /** Clears search and filters but stays in the group that's open. */
  protected clear(): void {
    const key = this.groupKey();
    const group = key ? this.selected()[key] : '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: key && group ? { [key]: group } : key ? { all: 1 } : {},
    });
  }
}
