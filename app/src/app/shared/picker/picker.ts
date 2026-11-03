import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
} from '@angular/core';

import { normalise } from '../../features/compendium/compendium-search';
import { DataTextService } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Entry, EntryType } from '../../core/models/compendium';
import { EntryCard } from './entry-card';
import { EntryDetails } from './entry-details';
import { FacetKey, facetValues } from './entry-facets';
import { EntryLabels } from './entry-labels.service';
import { FilterBar } from './filter-bar';
import { FacetSelection, activeFacets, applyFacets } from './picker-filters';

/** What a picker can list: compendium entries, or anything with an id and an English name. */
export interface PickItem {
  id: string;
  name: string;
}

/** Below this many items there's no search box or filters. */
const SEARCH_FROM = 8;

/**
 * Choosing from a list of cards (classes, backgrounds, species, spells...), with a search by name
 * in both languages, filters and "Ver más" to read the whole entry without leaving the page.
 *
 * - Single choice: once something is chosen only its card is shown, with "Cambiar" to browse again.
 * - Multiple choice (`multiple`): every card toggles; "Solo los elegidos" narrows to the chosen.
 * - Cards are entry summaries (EntryCard) unless an `<ng-template #card let-item>` is given;
 *   likewise `<ng-template #details let-item>` replaces the expanded text.
 * - Long lists render `pageSize` cards at a time ("Mostrar más").
 *
 * It only reports clicks (`picked`); the caller changes the character as before.
 */
@Component({
  selector: 'app-picker',
  imports: [NgTemplateOutlet, TranslatePipe, EntryCard, EntryDetails, FilterBar],
  templateUrl: './picker.html',
  styleUrl: './picker.scss',
})
export class Picker<T extends PickItem> {
  readonly items = input.required<readonly T[]>();
  /** Ids chosen. */
  readonly selected = input<readonly string[]>([]);
  readonly multiple = input(false, { transform: booleanAttribute });
  /** Facets to filter by (for compendium entries). */
  readonly facets = input<readonly FacetKey[]>([]);
  readonly pageSize = input(24);
  /** Accessible name of the list. */
  readonly label = input('');
  /** id + true (chosen) / false (unticked, multiple only). */
  readonly picked = output<{ id: string; on: boolean }>();

  protected readonly cardTpl = contentChild<TemplateRef<{ $implicit: T }>>('card');
  protected readonly detailsTpl = contentChild<TemplateRef<{ $implicit: T }>>('details');

  private readonly dataText = inject(DataTextService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly labels = inject(EntryLabels);

  protected readonly query = signal('');
  protected readonly selection = signal<FacetSelection>({});
  protected readonly chosenOnly = signal(false);
  /** Browsing the list although something is chosen (single choice). */
  protected readonly browsing = signal(false);
  protected readonly open = signal<ReadonlySet<string>>(new Set());

  private readonly chosenSet = computed(() => new Set(this.selected()));
  private readonly type = computed(() => (this.items()[0] as Partial<Entry> | undefined)?.type);

  /** Single choice with something chosen and not browsing: only the chosen card. */
  protected readonly collapsed = computed(
    () => !this.multiple() && !this.browsing() && this.chosenItems().length > 0,
  );
  protected readonly chosenItems = computed(() =>
    this.items().filter((i) => this.chosenSet().has(i.id)),
  );
  protected readonly searchable = computed(() => this.items().length >= SEARCH_FROM);

  /** Normalised names (shown and English) of every item, recomputed when the language changes. */
  private readonly texts = computed(() =>
    this.items().map((i) => normalise(this.dataText.searchText(i.name))),
  );
  private readonly values = computed(() => {
    const keys = this.facets();
    return this.items().map(
      (i) => new Map(keys.map((k) => [k, facetValues(i as unknown as Entry, k)])),
    );
  });

  protected readonly facetViews = computed(() => {
    const type = this.type();
    if (!type || !this.searchable()) return [];
    return this.labels.facetViews(
      type as EntryType,
      this.items() as unknown as Entry[],
      this.facets(),
      this.selection(),
    );
  });

  protected readonly filtered = computed(() => {
    const values = this.values();
    const list = applyFacets(
      this.items(),
      this.texts(),
      (i, k) => values[i].get(k as FacetKey) ?? [],
      this.selection(),
      this.query(),
    );
    return this.chosenOnly() ? list.filter((i) => this.chosenSet().has(i.id)) : list;
  });

  /** How many cards are rendered; back to one page whenever the filters change. */
  private readonly filterKey = computed(() =>
    JSON.stringify([this.query(), this.selection(), this.chosenOnly(), this.items().length]),
  );
  protected readonly limit = linkedSignal({
    source: this.filterKey,
    computation: () => this.pageSize(),
  });
  protected readonly visible = computed(() => this.filtered().slice(0, this.limit()));

  protected readonly anyFilter = computed(
    () => !!this.query() || activeFacets(this.selection()) > 0 || this.chosenOnly(),
  );

  protected isChosen(item: T): boolean {
    return this.chosenSet().has(item.id);
  }

  protected isOpen(item: T): boolean {
    return this.open().has(item.id);
  }

  protected choose(item: T): void {
    if (this.multiple()) {
      this.picked.emit({ id: item.id, on: !this.isChosen(item) });
      return;
    }
    if (!this.isChosen(item)) this.picked.emit({ id: item.id, on: true });
    this.browsing.set(false);
    // the list folds to the chosen card: bring it back into view if it went above the screen
    afterNextRender(
      () => {
        const el = this.host.nativeElement;
        if (el.getBoundingClientRect().top < 0)
          el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  protected toggleOpen(item: T): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (!next.delete(item.id)) next.add(item.id);
      return next;
    });
  }

  protected setFacet(key: string, value: string): void {
    this.selection.update((s) => ({ ...s, [key]: value }));
  }

  protected clear(): void {
    this.query.set('');
    this.selection.set({});
    this.chosenOnly.set(false);
  }

  protected showMore(): void {
    this.limit.update((n) => n + this.pageSize());
  }

  protected asEntry(item: T): Entry {
    return item as unknown as Entry;
  }
}
