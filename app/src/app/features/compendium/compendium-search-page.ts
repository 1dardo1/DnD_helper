import { Component, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES, Entry, EntryType } from '../../core/models/compendium';
import { SearchDoc, normalise, searchDocs } from './compendium-search';
import { entrySummary } from './entry-summary';
import { LoadError } from './load-error';

/** Results shown per type before "show all". */
const PREVIEW = 20;

/** Searches every type at once (?q=…&text=1); results grouped by type, best matches first. */
@Component({
  selector: 'app-compendium-search-page',
  imports: [RouterLink, TranslatePipe, DataNamePipe, LoadError],
  template: `
    <p>
      <a routerLink="/compendium">← {{ 'compendium.title' | t }}</a>
    </p>
    <h1>{{ 'search.title' | t }}</h1>

    <form class="controls" role="search" (submit)="$event.preventDefault()">
      <input
        type="search"
        [placeholder]="'search.placeholder' | t"
        [attr.aria-label]="'search.placeholder' | t"
        [value]="query()"
        (input)="setParams({ q: $any($event.target).value }, true)"
        autofocus
      />
      <label>
        <input
          type="checkbox"
          [checked]="withText()"
          (change)="setParams({ text: $any($event.target).checked ? '1' : null })"
        />
        {{ 'search.inText' | t }}
      </label>
    </form>

    @if (all.isLoading()) {
      <p>{{ 'common.loading' | t }}</p>
    } @else if (all.error()) {
      <app-load-error [error]="all.error()" />
    } @else if (normalised().length < 2) {
      <p>{{ 'search.hint' | t }}</p>
    } @else {
      <p aria-live="polite">
        <small>{{ 'search.total' | t: { count: total() } }}</small>
      </p>
      @if (groups().length > 1) {
        <nav class="jump" [attr.aria-label]="'search.types' | t">
          @for (g of groups(); track g.type) {
            <button type="button" (click)="jump(g.type)">
              {{ 'type.' + g.type | t }} ({{ g.hits.length }})
            </button>
          }
        </nav>
      }
      @for (g of groups(); track g.type) {
        <section [id]="'results-' + g.type">
          <h2>{{ 'type.' + g.type | t }} ({{ g.hits.length }})</h2>
          <ul class="entries">
            @for (
              h of expanded().has(g.type) ? g.hits : g.hits.slice(0, preview);
              track h.entry.id
            ) {
              <li>
                <a [routerLink]="['/compendium', g.type, h.entry.id]">{{
                  h.entry.name | dataName
                }}</a>
                <small>{{ summary(h.entry) }}</small>
                @if (h.entry.edition === '2014') {
                  <small class="edition">2014</small>
                }
                @if (h.rank === 4) {
                  <small class="in-text">{{ 'search.matchInText' | t }}</small>
                }
              </li>
            }
          </ul>
          @if (g.hits.length > preview && !expanded().has(g.type)) {
            <button type="button" (click)="expand(g.type)">
              {{ 'search.showAll' | t: { count: g.hits.length } }}
            </button>
          }
        </section>
      } @empty {
        <p>{{ 'common.noResults' | t }}</p>
      }
    }
  `,
  styles: `
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      align-items: center;
    }
    input[type='search'] {
      width: 100%;
      max-width: 24rem;
    }
    .jump {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.75rem;
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
    .edition,
    .in-text {
      border: 1px solid currentColor;
      padding: 0 0.25rem;
    }
  `,
})
export class CompendiumSearchPage {
  private readonly compendium = inject(CompendiumService);
  private readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly preview = PREVIEW;
  protected readonly query = computed(() => this.params().get('q') ?? '');
  protected readonly normalised = computed(() => normalise(this.query()));
  protected readonly withText = computed(() => this.params().get('text') === '1');
  /** Types whose results are all shown; starts again with every new search. */
  protected readonly expanded = signal(new Set<EntryType>());

  protected readonly all = resource({
    loader: () =>
      Promise.all(
        ENTRY_TYPES.map(async (type) => ({ type, entries: await this.compendium.all(type) })),
      ),
  });

  private readonly classNames = computed(() => {
    const classes = this.all.value()?.find((g) => g.type === 'class')?.entries ?? [];
    return new Map(classes.map((c) => [c.id, this.data.shortName(c.name)]));
  });

  /** Names in both languages; follows the language of the texts shown. */
  private readonly nameDocs = computed(() => {
    this.data.shownLanguage();
    return (this.all.value() ?? []).map(({ type, entries }) => ({
      type,
      docs: (entries as Entry[]).map((entry) => this.doc(entry)),
    }));
  });

  /** The same, plus descriptions (English and translated); only built when asked for. */
  private readonly textDocs = computed(() =>
    this.nameDocs().map(({ type, docs }) => ({
      type,
      docs: docs.map((d) => ({
        ...d,
        text: normalise(`${d.entry.description} ${this.data.text(d.entry.description)}`),
      })),
    })),
  );

  protected readonly groups = computed(() => {
    const q = this.query();
    if (this.normalised().length < 2) return [];
    const withText = this.withText();
    const sortName = (e: Entry) => this.data.shortName(e.name);
    return (withText ? this.textDocs() : this.nameDocs())
      .map(({ type, docs }) => ({ type, hits: searchDocs(docs, q, withText, sortName) }))
      .filter((g) => g.hits.length);
  });

  protected readonly total = computed(() =>
    this.groups().reduce((sum, g) => sum + g.hits.length, 0),
  );

  private doc(entry: Entry): SearchDoc {
    const shown = this.data.shortName(entry.name);
    return { entry, names: [...new Set([normalise(entry.name), normalise(shown)])] };
  }

  protected setParams(
    params: { q?: string | null; text?: string | null },
    replaceUrl = false,
  ): void {
    if ('q' in params) {
      this.expanded.set(new Set());
      params = { ...params, q: params.q || null };
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  protected expand(type: EntryType): void {
    this.expanded.update((s) => new Set(s).add(type));
  }

  /** Scrolls to a type's results (in-page anchors don't mix with hash routing). */
  protected jump(type: EntryType): void {
    document.getElementById(`results-${type}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  protected summary(e: Entry): string {
    return entrySummary(e, this.i18n.language(), this.i18n.t('spell.cantrip'), this.classNames());
  }
}
