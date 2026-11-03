import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe, TranslationKey } from '../../core/i18n/i18n.service';
import {
  ClassOption,
  ENTRY_TYPES,
  Entry,
  EntryType,
  Item,
  Monster,
} from '../../core/models/compendium';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';
import { EntryCard } from '../../shared/picker/entry-card';
import { ENTRY_FACETS, FacetKey, facetValues, sortByPrice } from '../../shared/picker/entry-facets';
import { EntryLabels } from '../../shared/picker/entry-labels.service';
import { defaultOrder, groupOrder } from '../../shared/picker/entry-order';
import { FilterBar } from '../../shared/picker/filter-bar';
import { applyFacets, modeKey } from '../../shared/picker/picker-filters';
import { sectionsBySpecies } from '../../shared/picker/racial-feats';
import { normalise } from './compendium-search';
import { LoadError } from './load-error';

/** Types long enough to first choose a group (feats by category, options by group...). */
const GROUPED: Partial<Record<EntryType, FacetKey>> = {
  feat: 'category',
  option: 'group',
  item: 'category',
  subclass: 'class',
};

/** Other orders a type's list offers (?sort=…), with the label of the default one. */
const SORTS: Partial<
  Record<EntryType, { default: string; options: { value: string; label: string }[] }>
> = {
  item: {
    default: 'picker.sort.default',
    options: [
      { value: 'price-asc', label: 'picker.sort.priceAsc' },
      { value: 'price-desc', label: 'picker.sort.priceDesc' },
    ],
  },
  // monsters are listed by challenge rating; the hardest first or by name on request
  monster: {
    default: 'picker.sort.crAsc',
    options: [
      { value: 'cr-desc', label: 'picker.sort.crDesc' },
      { value: 'name', label: 'picker.sort.name' },
    ],
  },
};

/** Cards rendered at a time ("Mostrar más" for the rest). */
const PAGE = 60;

/**
 * Entries of one type as summary cards (the same ones the wizard pickers show), with a name search
 * and filters; both live in the URL (?q=…&school=…). Feats, class options, items and subclasses
 * first offer a card per group (?category=general, ?class=wizard); ?all=1 lists every entry.
 */
@Component({
  selector: 'app-entry-list',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    LoadError,
    EntryCard,
    FilterBar,
    ClassThemeDirective,
  ],
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
    const list = defaultOrder(
      this.entries.value() ?? [],
      shown,
      (id) => this.labels.speciesName(id),
      (id) => this.labels.className(id),
    );
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
    // class options: the class of each group, to order the cards by class
    const classOf = new Map<string, string>();
    if (type === 'option')
      for (const e of this.entries.value() ?? []) {
        const o = e as ClassOption;
        if (o.classId) classOf.set(o.group, this.labels.className(o.classId));
      }
    const cards = [...counts].map(([value, count]) => {
      const infoKey = `picker.groupInfo.${type}.${value}`;
      const info = this.i18n.t(infoKey as TranslationKey);
      return {
        value,
        params: { [key]: value },
        count,
        label: this.labels.optionLabel(type, key, value),
        classLabel: classOf.get(value),
        info: info === infoKey ? '' : info,
      };
    });
    return groupOrder(type, key, cards);
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

  protected readonly sorts = computed(() => SORTS[this.entryType()] ?? null);
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
    const sort = this.sorts()?.options.some((o) => o.value === this.sort()) ? this.sort() : '';
    if (sort.startsWith('price-')) return sortByPrice(found as Item[], sort === 'price-desc');
    // stable sorts: the default order (by name within a rating) is kept where they tie
    if (sort === 'cr-desc') return [...found].sort((a, b) => (b as Monster).cr - (a as Monster).cr);
    if (sort === 'name') {
      const shown = (e: Entry) => this.data.shortName(e.name);
      return [...found].sort((a, b) => shown(a).localeCompare(shown(b)));
    }
    return found;
  });

  /** Back to one page whenever the type, search or filters change. */
  protected readonly limit = linkedSignal({
    source: computed(
      () => `${this.entryType()}|${this.query()}|${this.sort()}|${JSON.stringify(this.selected())}`,
    ),
    computation: () => PAGE,
  });
  protected readonly visible = computed(() => this.filtered().slice(0, this.limit()));

  /** Racial feats shown by the species they require (null: a plain list). */
  protected readonly sections = computed(() =>
    sectionsBySpecies(
      this.visible(),
      (id) => this.labels.speciesName(id),
      (e) => this.data.shortName(e.name),
    ),
  );

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
