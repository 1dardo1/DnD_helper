import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  COST_BUCKETS,
  CRAFT_SECTIONS,
  CRAFT_SORTS,
  CraftProfile,
  CraftRarity,
  CraftSection,
  CraftSort,
  MAGIC_RARITIES,
  MAGIC_SECTIONS,
  MUNDANE_SECTIONS,
  TIME_BUCKETS,
  castsSpells,
  coinsFromCp,
  costBucket,
  costInCp,
  craftProfile,
  craftRarity,
  groupBySection,
  isCraftable,
  magicCraft,
  magicTools,
  mundaneCraft,
  needsBaseItem,
  sharedDays,
  sortRows,
  timeBucket,
} from '../../core/crafting/crafting';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe, TranslationKey } from '../../core/i18n/i18n.service';
import { Item } from '../../core/models/compendium';
import { SpellBinding, spellBinding } from '../../core/spell-items/spell-items';
import { FacetView, FilterBar } from '../../shared/picker/filter-bar';
import { applyFacets, modeKey } from '../../shared/picker/picker-filters';
import { RARITY_ORDER } from './compendium-filters';
import { normalise, rankName } from './compendium-search';
import { LoadError } from './load-error';
import { ScrollTop } from './scroll-top';

const RULE_MUNDANE = 'equipment/crafting-non-magical-items';
const RULE_MAGIC = 'magic-item/crafting-magical-items';

/** Rows rendered at a time ("Mostrar más" for the rest). */
const PAGE = 60;

interface Craft {
  kind: 'mundane' | 'magic';
  tools: Item[];
  /** Raw materials in copper pieces (null: the data gives no figure). */
  cp: number | null;
  days: number | null;
  spells: boolean;
  base: boolean;
  notes: string[];
}

/** An item of the list with what is deduced from its data. */
interface Row {
  item: Item;
  p: CraftProfile;
}

type FacetId = 'tool' | 'requirement' | 'cost' | 'time' | 'rarity' | 'consumable';

/**
 * "Crafting": items in sections (the categories of the item list), filtered by what crafting
 * needs; pick one and see what making it takes (2024 rules: tools, materials, time).
 */
@Component({
  selector: 'app-crafting-page',
  imports: [RouterLink, TranslatePipe, TermPipe, DataNamePipe, LoadError, FilterBar, ScrollTop],
  template: `
    <p>
      <a routerLink="/compendium">← {{ 'nav.compendium' | t }}</a>
    </p>
    <h1>{{ 'crafting.title' | t }}</h1>
    <p>{{ 'crafting.intro' | t }}</p>
    <p class="links">
      <a [routerLink]="['/compendium', 'rule', ruleMundane]">{{ 'crafting.ruleMundane' | t }}</a>
      ·
      <a [routerLink]="['/compendium', 'rule', ruleMagic]">{{ 'crafting.ruleMagic' | t }}</a>
    </p>

    @if (items.isLoading()) {
      <p>{{ 'common.loading' | t }}</p>
    } @else if (items.error()) {
      <app-load-error [error]="items.error()" />
    } @else {
      <nav class="sections" [attr.aria-label]="'crafting.sections' | t">
        <div class="strip">
          <button
            type="button"
            class="chip"
            [class.on]="section() === 'all'"
            [attr.aria-pressed]="section() === 'all'"
            (click)="setSection('all')"
          >
            {{ 'crafting.section.all' | t }} <small>{{ base().length }}</small>
          </button>
          @for (g of groups(); track g.key) {
            <span class="group-label">{{ g.label | t }}</span>
            @for (s of g.sections; track s.section) {
              <button
                type="button"
                class="chip"
                [class.on]="section() === s.section"
                [attr.aria-pressed]="section() === s.section"
                (click)="setSection(s.section)"
              >
                {{ sectionLabel(s.section) }} <small>{{ s.count }}</small>
              </button>
            }
          }
        </div>
      </nav>

      <div class="layout">
        <div class="browse">
          <app-filter-bar
            [query]="query()"
            [facets]="facets()"
            [shown]="matches().length"
            [total]="inSection().length"
            (queryChange)="query.set($event)"
            (facetChange)="setFacet($event.key, $event.value)"
            (clear)="clear()"
          >
            <label class="sort">
              {{ 'picker.sort' | t }}
              <select (change)="sort.set($any($event.target).value)">
                @for (o of sorts; track o) {
                  <option [value]="o" [selected]="sort() === o">
                    {{ sortLabel(o) }}
                  </option>
                }
              </select>
            </label>
            <label class="old">
              <input type="checkbox" [checked]="old()" (change)="old.set(!old())" />
              {{ 'crafting.include2014' | t }}
            </label>
          </app-filter-bar>

          <ul class="results">
            @for (r of shown(); track r.item.id) {
              <li>
                <button
                  type="button"
                  [class.on]="selected()?.id === r.item.id"
                  [attr.aria-pressed]="selected()?.id === r.item.id"
                  (click)="select(r.item.id)"
                >
                  <span class="main">
                    <span class="n">{{ r.item.name | dataName: true }}</span>
                    @if (r.p.consumable) {
                      <span class="tag" [title]="'crafting.tagConsumableHint' | t">{{
                        'crafting.tagConsumable' | t
                      }}</span>
                    }
                    <small class="meta">
                      @if (r.item.magic) {
                        {{ r.item.magic.rarity ?? '' | term: 'rarity' }}
                        {{ r.item.magic.type | term: 'magicType' }}
                      } @else {
                        {{ r.item.category | term: 'itemCategory' }}
                        @if (r.item.cost; as c) {
                          · {{ cost(c.amount, c.unit) }}
                        }
                      }
                    </small>
                  </span>
                  <span class="figures">
                    <span>
                      <small>{{ 'crafting.materialsShort' | t }}</small>
                      <strong>{{
                        r.p.cp === null ? ('crafting.varies' | t) : coins(r.p.cp)
                      }}</strong>
                    </span>
                    <span>
                      <small>{{ 'crafting.timeShort' | t }}</small>
                      <strong>{{
                        r.p.days === null ? ('crafting.varies' | t) : days(r.p.days)
                      }}</strong>
                    </span>
                  </span>
                </button>
              </li>
            } @empty {
              <li class="empty">{{ 'common.noResults' | t }}</li>
            }
          </ul>
          @if (matches().length > shown().length) {
            <p class="more">
              <button type="button" (click)="showMore()">
                {{ 'picker.showMore' | t: { count: matches().length - shown().length } }}
              </button>
            </p>
          }
        </div>

        <div class="side">
          @if (selected(); as it) {
            <section class="calc" aria-live="polite">
              <h2>{{ it.name | dataName }}</h2>
              <p class="sub">
                <a [routerLink]="['/compendium', 'item', it.id]">{{ 'crafting.viewItem' | t }}</a>
                @if (it.magic?.rarity; as r) {
                  · {{ r | term: 'rarity' }}
                }
                @if (it.cost; as c) {
                  · {{ cost(c.amount, c.unit) }}
                }
                @if (consumable()) {
                  <span class="tag" [title]="'crafting.tagConsumableHint' | t">{{
                    'crafting.tagConsumable' | t
                  }}</span>
                }
                <button
                  type="button"
                  class="btn-ghost"
                  [attr.aria-label]="'crafting.close' | t"
                  (click)="select(null)"
                >
                  ✕
                </button>
              </p>

              <div class="options">
                <label>
                  {{ 'crafting.workers' | t }}
                  <input
                    type="number"
                    min="1"
                    max="10"
                    inputmode="numeric"
                    [value]="workers()"
                    (change)="setWorkers($any($event.target).value)"
                  />
                </label>
                @if (binding(); as b) {
                  <label>
                    {{ 'crafting.spellLevel' | t }}
                    <select (change)="spellLevel.set(+$any($event.target).value)">
                      @for (l of levelsOf(b); track l) {
                        <option [value]="l" [selected]="l === level()">
                          {{ l === 0 ? ('spellitem.cantrip' | t) : l }}
                        </option>
                      }
                    </select>
                  </label>
                } @else if (it.magic && !fixedRarity()) {
                  <label>
                    {{ 'crafting.rarity' | t }}
                    <select (change)="rarityPick.set($any($event.target).value)">
                      @for (r of rarities; track r) {
                        <option [value]="r" [selected]="r === rarity()">
                          {{ r | term: 'rarity' }}
                        </option>
                      }
                    </select>
                  </label>
                }
              </div>

              @if (craft(); as c) {
                <dl class="fields">
                  @if (c.tools.length) {
                    <dt>{{ 'crafting.tool' | t }}</dt>
                    <dd>
                      @for (t of c.tools; track t.id; let last = $last) {
                        <a [routerLink]="['/compendium', 'item', t.id]">{{ t.name | dataName }}</a
                        >{{ last ? '' : ' ' + ('compendium.or' | t) + ' ' }}
                      }
                    </dd>
                  } @else {
                    <dt>{{ 'crafting.tool' | t }}</dt>
                    <dd>{{ 'crafting.toolUnknown' | t }}</dd>
                  }
                  <dt>{{ 'crafting.proficiency' | t }}</dt>
                  <dd>
                    {{ (c.kind === 'magic' ? 'crafting.profMagic' : 'crafting.profMundane') | t }}
                  </dd>
                  @if (c.cp !== null) {
                    <dt>{{ 'crafting.materials' | t }}</dt>
                    <dd>
                      <strong>{{ coins(c.cp) }}</strong>
                      @if (c.kind === 'mundane') {
                        <small> · {{ 'crafting.materialsHalf' | t }}</small>
                      }
                    </dd>
                  }
                  @if (c.days !== null) {
                    <dt>{{ 'crafting.time' | t }}</dt>
                    <dd>
                      <strong>{{ days(c.days) }}</strong>
                      <small> · {{ 'crafting.hoursPerDay' | t }}</small>
                      @if (workers() > 1) {
                        <br />
                        {{ 'crafting.withHelpers' | t: { n: workers() } }}:
                        <strong>{{ days(shared(c.days)) }}</strong>
                      }
                    </dd>
                  }
                  @if (c.kind === 'magic') {
                    <dt>{{ 'crafting.requirements' | t }}</dt>
                    <dd>
                      <ul>
                        <li>{{ 'crafting.reqArcana' | t }}</li>
                        @if (c.spells) {
                          <li>{{ 'crafting.reqSpells' | t }}</li>
                        }
                        @if (c.base) {
                          <li>{{ 'crafting.reqBase' | t }}</li>
                        }
                        <li>{{ 'crafting.reqMaterials' | t }}</li>
                      </ul>
                    </dd>
                  }
                </dl>
                @for (n of c.notes; track n) {
                  <p class="note">{{ n | t }}</p>
                }
              }
            </section>
          } @else {
            <p class="pick">{{ 'crafting.pick' | t }}</p>
          }
        </div>
      </div>
    }
    <app-scroll-top />
  `,
  styles: `
    .links {
      font-size: var(--fs-sm);
    }

    // -- sections: a strip of chips, scrolling sideways on phones --------------------------
    .sections {
      margin-block: var(--space-3);
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1) 0.4rem;
    }
    .group-label {
      flex-basis: 100%;
      margin-top: var(--space-1);
      font-family: var(--font-title);
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: var(--tap, 2.75rem);
      white-space: nowrap;
    }
    .chip small {
      opacity: 0.75;
    }
    @media (max-width: 44.99rem) {
      .strip {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-bottom: var(--space-1);
        scroll-snap-type: x proximity;
        -webkit-overflow-scrolling: touch;
      }
      .strip > * {
        flex: none;
        scroll-snap-align: start;
      }
      .group-label {
        flex-basis: auto;
        margin: 0 0 0 var(--space-2);
      }
    }
    .chip.on {
      color: var(--card);
      background-color: var(--accent);
      border-color: var(--accent);
    }
    .chip.on small {
      color: inherit;
      opacity: 0.85;
    }

    // -- layout: list and details side by side on wide screens -----------------------------
    .layout {
      display: grid;
      gap: var(--space-4);
    }
    .browse,
    .side {
      min-width: 0;
    }
    @media (max-width: 63.99rem) {
      .side {
        order: -1;
      }
      .side:has(.pick) {
        display: none;
      }
    }
    @media (min-width: 64rem) {
      .layout {
        grid-template-columns: minmax(0, 1fr) minmax(22rem, 30rem);
        align-items: start;
      }
      .side {
        position: sticky;
        top: var(--space-3);
        max-height: calc(100vh - 2 * var(--space-3));
        overflow-y: auto;
      }
    }
    .pick {
      color: var(--ink-soft);
    }

    .sort,
    .old {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--fs-sm);
    }
    .old {
      min-height: var(--tap, 2.75rem);
    }

    .calc {
      margin-block: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
      scroll-margin-top: var(--space-3);
    }
    @media (min-width: 64rem) {
      .calc {
        margin-block: 0;
      }
    }
    .calc h2 {
      margin-top: 0;
    }
    .sub {
      margin-top: 0;
      color: var(--ink-soft);
    }
    .tag {
      display: inline-block;
      margin-left: var(--space-1);
      padding: 0 0.5em;
      font-size: var(--fs-xs);
      line-height: 1.6;
      color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 0.8em;
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }
    .options label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .options input[type='number'] {
      width: 4rem;
    }
    .fields {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--space-1) var(--space-3);
      margin: 0;
    }
    .fields dt {
      font-weight: 700;
    }
    .fields dd {
      margin: 0;
    }
    @media (max-width: 44.99rem) {
      .fields {
        grid-template-columns: 1fr;
      }
      .fields dd {
        margin-bottom: var(--space-2);
      }
    }
    .fields ul {
      margin: 0;
      padding-left: 1.2rem;
    }
    .note {
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }

    // -- results: one row per item with its cost and time ----------------------------------
    .results {
      list-style: none;
      margin: var(--space-3) 0 0;
      padding: 0;
      display: grid;
      gap: var(--space-2);
    }
    .results button {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-1) var(--space-3);
      width: 100%;
      min-height: var(--tap, 2.75rem);
      text-align: left;
    }
    .main {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 var(--space-1);
      min-width: 0;
    }
    .main .n {
      overflow-wrap: anywhere;
    }
    .meta {
      flex-basis: 100%;
      color: var(--ink-soft);
    }
    .figures {
      display: flex;
      gap: var(--space-3);
      text-align: right;
    }
    .figures span {
      display: grid;
    }
    .figures small {
      font-size: var(--fs-xs);
      color: var(--ink-soft);
    }
    .results button.on {
      color: var(--ink);
      background: var(--highlight);
      border-color: var(--accent);
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    @media (max-width: 44.99rem) {
      .results button {
        grid-template-columns: 1fr;
      }
      .figures {
        justify-content: space-between;
        text-align: left;
      }
    }
    .empty {
      color: var(--ink-soft);
    }
    .more button {
      min-height: var(--tap, 2.75rem);
    }
  `,
})
export class CraftingPage {
  /** Query parameter ?item=<id>. */
  readonly item = input<string>();
  /** Query parameter ?section=<weapon|magic:potion|…> (empty: all of them). */
  readonly sectionParam = input<string>(undefined, { alias: 'section' });

  private readonly compendium = inject(CompendiumService);
  private readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly ruleMundane = RULE_MUNDANE;
  protected readonly ruleMagic = RULE_MAGIC;
  protected readonly rarities = MAGIC_RARITIES;
  protected readonly sorts = CRAFT_SORTS;

  protected readonly items = resource({
    loader: async () => {
      const all = (await this.compendium.all('item')).filter(isCraftable);
      const rows: Row[] = all.map((item) => ({ item, p: craftProfile(item) }));
      return {
        all,
        rows,
        byId: new Map(all.map((i) => [i.id, i])),
        rowById: new Map(rows.map((r) => [r.item.id, r])),
      };
    },
  });

  protected readonly query = signal('');
  protected readonly old = signal(false);
  protected readonly sort = signal<CraftSort>('name');
  protected readonly workers = signal(1);
  protected readonly spellLevel = signal<number | null>(null);
  protected readonly rarityPick = signal<string | null>(null);

  // -- sections ------------------------------------------------------------------------------
  /** Rows of the editions shown. */
  protected readonly base = computed(() => {
    const old = this.old();
    return (this.items.value()?.rows ?? []).filter((r) => old || r.item.edition === '2024');
  });

  /** Sections that have items, with their counts, in two groups. */
  protected readonly groups = computed(() => {
    const counts = new Map(
      groupBySection(this.base().map((r) => r.item)).map((g) => [g.section, g.items.length]),
    );
    const mk = (key: string, label: TranslationKey, of: readonly CraftSection[]) => ({
      key,
      label,
      sections: of.filter((s) => counts.has(s)).map((s) => ({ section: s, count: counts.get(s)! })),
    });
    const known = new Set<CraftSection>(CRAFT_SECTIONS);
    const extra = [...counts.keys()].filter((s) => !known.has(s));
    return [
      mk('mundane', 'crafting.group.mundane', MUNDANE_SECTIONS),
      mk('magic', 'crafting.group.magic', [...MAGIC_SECTIONS, ...extra]),
    ].filter((g) => g.sections.length);
  });

  protected readonly section = computed<CraftSection | 'all'>(() => {
    const s = this.sectionParam();
    return s && this.groups().some((g) => g.sections.some((x) => x.section === s))
      ? (s as CraftSection)
      : 'all';
  });

  /** Selected values per facet (and their "all at once" modes); each section starts clean. */
  protected readonly sel = linkedSignal<CraftSection | 'all', Record<string, string>>({
    source: this.section,
    computation: () => ({}),
  });

  /** Keeps the section that's open in view on the strip (it scrolls sideways on phones). */
  private readonly keepChipInView = effect(() => {
    this.section();
    this.groups();
    setTimeout(() => {
      try {
        document
          .querySelector('.sections .on')
          ?.scrollIntoView({ inline: 'center', block: 'nearest' });
      } catch {
        // no layout (tests): nothing to scroll
      }
    });
  });

  protected readonly inSection = computed(() => {
    const s = this.section();
    return s === 'all' ? this.base() : this.base().filter((r) => r.p.section === s);
  });

  // -- filters -------------------------------------------------------------------------------
  private facetValues(r: Row, key: FacetId): string[] {
    switch (key) {
      case 'tool':
        return r.p.tools;
      case 'requirement':
        return r.p.requirements;
      case 'cost':
        return [costBucket(r.p.cp)];
      case 'time':
        return [timeBucket(r.p.days)];
      case 'rarity':
        return r.item.magic?.rarity ? [r.item.magic.rarity.toLowerCase()] : [];
      case 'consumable':
        return r.item.magic ? [r.p.consumable ? 'yes' : 'no'] : [];
    }
  }

  /** The filters worth showing for this section: more than one value, or one in use. */
  protected readonly facets = computed<FacetView[]>(() => {
    const rows = this.inSection();
    const sel = this.sel();
    const byId = this.items.value()?.byId;
    const lang = this.i18n.language();
    const t = (k: string) => this.i18n.t(k as TranslationKey);
    const present = (key: FacetId) => new Set(rows.flatMap((r) => this.facetValues(r, key)));

    const toolIds = [...present('tool')]
      .filter((id) => byId?.has(id))
      .sort((a, b) => this.toolName(a).localeCompare(this.toolName(b)));
    const rarityValues = [...present('rarity')].sort((a, b) => {
      const pos = (v: string) => (RARITY_ORDER.indexOf(v) < 0 ? 99 : RARITY_ORDER.indexOf(v));
      return pos(a) - pos(b) || a.localeCompare(b);
    });
    const hasBoth = (key: FacetId) => present(key).size > 1;
    const options: Record<FacetId, { value: string; label: string }[]> = {
      tool: toolIds.map((id) => ({ value: id, label: this.toolName(id) })),
      requirement: (['arcana', 'spells', 'base'] as const)
        .filter((v) => present('requirement').has(v))
        .map((value) => ({ value, label: t(`crafting.req.${value}`) })),
      cost: COST_BUCKETS.filter((v) => present('cost').has(v)).map((value) => ({
        value,
        label: t(`crafting.cost.${value}`),
      })),
      time: TIME_BUCKETS.filter((v) => present('time').has(v)).map((value) => ({
        value,
        label: t(`crafting.time.${value}`),
      })),
      rarity: rarityValues.map((value) => ({ value, label: term(lang, 'rarity', value) })),
      consumable: (['yes', 'no'] as const)
        .filter((v) => present('consumable').has(v))
        .map((value) => ({ value, label: t(`crafting.consumable.${value}`) })),
    };
    const order: FacetId[] = ['tool', 'cost', 'time', 'rarity', 'consumable', 'requirement'];
    return order
      .map((key) => ({
        key,
        label: t(`crafting.f.${key}`),
        options: options[key],
        selected: sel[key] ?? '',
        more: key === 'requirement',
        mode: sel[modeKey(key)] === 'and' ? ('and' as const) : ('or' as const),
        // an item has several requirements at once, but its tools are alternatives
        canCombine: key === 'requirement' && hasBoth(key),
        // consumable yes/no: when every item has one of the two, excluding one is ticking the other
        canExclude: !(key === 'consumable' && rows.every((r) => !!r.item.magic)),
      }))
      .filter((f) => f.options.length > 1 || f.selected);
  });

  protected readonly matches = computed(() => {
    const rows = this.inSection();
    const q = normalise(this.query());
    const texts = rows.map((r) => normalise(this.data.searchText(r.item.name)));
    const found = applyFacets(
      rows,
      texts,
      (i, key) => this.facetValues(rows[i], key as FacetId),
      this.sel(),
      this.query(),
    );
    const name = (r: Row) => this.data.shortName(r.item.name);
    if (this.sort() === 'name' && q) {
      const rank = (r: Row) =>
        Math.min(...[r.item.name, name(r)].map((n) => rankName(normalise(n), q) ?? 9));
      return [...found].sort((a, b) => rank(a) - rank(b) || name(a).localeCompare(name(b)));
    }
    return sortRows(found, this.sort(), (r) => r.p, name);
  });

  /** Back to one page whenever the list changes. */
  protected readonly limit = linkedSignal({
    source: computed(
      () =>
        `${this.section()}|${this.query()}|${this.sort()}|${this.old()}|${JSON.stringify(this.sel())}`,
    ),
    computation: () => PAGE,
  });
  protected readonly shown = computed(() => this.matches().slice(0, this.limit()));

  // -- selected item -------------------------------------------------------------------------
  protected readonly selected = computed(() => {
    const id = this.item();
    return id ? this.items.value()?.byId.get(id) : undefined;
  });

  protected readonly profile = computed(() => {
    const it = this.selected();
    return it ? this.items.value()?.rowById.get(it.id)?.p : undefined;
  });

  protected readonly binding = computed<SpellBinding | null>(() => {
    const it = this.selected();
    return it ? spellBinding(it) : null;
  });

  protected readonly isSpellScroll = computed(() => this.selected()?.id === 'spell-scroll');

  protected levelsOf(b: SpellBinding): number[] {
    return Array.from({ length: b.maxLevel - b.minLevel + 1 }, (_, i) => b.minLevel + i);
  }

  protected readonly level = computed(() => {
    const b = this.binding();
    if (!b) return null;
    const l = this.spellLevel();
    return l !== null && l >= b.minLevel && l <= b.maxLevel ? l : b.minLevel;
  });

  /** The item's own rarity when it is one the crafting table knows. */
  protected readonly fixedRarity = computed<CraftRarity | null>(() => {
    const it = this.selected();
    if (!it?.magic) return null;
    const b = this.binding();
    if (b?.kind === 'bound') {
      const row = b.table.find((r) => r.level === this.level());
      return craftRarity(row?.rarity);
    }
    return craftRarity(it.magic.rarity);
  });

  protected readonly rarity = computed<CraftRarity>(() => {
    const picked = craftRarity(this.rarityPick());
    return this.fixedRarity() ?? picked ?? 'common';
  });

  /** Deduced from the item's type and text: halves time and cost of a magic item. */
  protected readonly consumable = computed(() => this.profile()?.consumable ?? false);

  protected readonly craft = computed<Craft | null>(() => {
    const it = this.selected();
    const byId = this.items.value()?.byId;
    if (!it || !byId) return null;
    const toolsOf = (ids: string[]) => ids.map((id) => byId.get(id)).filter((t): t is Item => !!t);

    if (!it.magic) {
      const price = costInCp(it);
      if (price === null) return null;
      const m = mundaneCraft(price);
      return {
        kind: 'mundane',
        tools: [],
        cp: m.materialsCp,
        days: m.days,
        spells: false,
        base: false,
        notes: ['crafting.noteMundaneTool', 'crafting.noteMundaneAvail'],
      };
    }

    const type = it.magic.type;
    const tools = toolsOf(magicTools(type));
    const spells = castsSpells(it) || !!this.binding();
    const base = needsBaseItem(type);
    const notes = ['crafting.noteMagicAvail'];
    if (type.toLowerCase() === 'wondrous item') notes.push('crafting.noteWondrousTool');
    if (['armor', 'weapon', 'shield'].includes(type.toLowerCase()))
      notes.push('crafting.noteToolByKind');

    // Spell Scroll: the book gives the time and cost of the Player's Handbook, not this table
    if (this.isSpellScroll()) {
      const lvl = this.level() ?? 0;
      const fixed = byId.get(lvl === 0 ? 'spell-scroll-cantrip' : `spell-scroll-level-${lvl}`);
      const price = fixed ? costInCp(fixed) : null;
      const m = price !== null ? mundaneCraft(price) : null;
      return {
        kind: 'magic',
        tools,
        cp: m?.materialsCp ?? null,
        days: m?.days ?? null,
        spells: true,
        base: false,
        notes: [
          m ? 'crafting.noteScrollKnown' : 'crafting.noteScrollUnknown',
          'crafting.noteMagicAvail',
        ],
      };
    }

    const rarity = this.rarity();
    const f = magicCraft(rarity, this.consumable());
    if (
      !this.fixedRarity() &&
      !this.rarityPick() &&
      (it.magic.rarity === null || it.magic.rarity === 'varies')
    )
      notes.push('crafting.noteRarityPick');
    if (!this.fixedRarity()) notes.push('crafting.noteRarityNone');
    if (this.consumable()) notes.push('crafting.noteConsumable');
    return {
      kind: 'magic',
      tools,
      cp: f.gp * 100,
      days: f.days,
      spells,
      base,
      notes,
    };
  });

  // -- actions -------------------------------------------------------------------------------
  protected setSection(s: CraftSection | 'all'): void {
    void this.router.navigate([], {
      queryParams: { section: s === 'all' ? null : s },
      queryParamsHandling: 'merge',
    });
  }

  protected setFacet(key: string, value: string): void {
    this.sel.update((s) => ({ ...s, [key]: value }));
  }

  protected clear(): void {
    this.sel.set({});
    this.query.set('');
  }

  protected showMore(): void {
    this.limit.update((n) => n + PAGE);
  }

  protected select(id: string | null): void {
    this.spellLevel.set(null);
    this.rarityPick.set(null);
    void this.router
      .navigate([], {
        queryParams: { item: id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      })
      .then(() => {
        // on phones and tablets the details sit above the list: bring them into view
        if (!id) return;
        try {
          if (!matchMedia('(min-width: 64rem)').matches)
            document.querySelector('.calc')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } catch {
          // no layout (tests)
        }
      });
  }

  protected setWorkers(v: string): void {
    this.workers.set(Math.min(10, Math.max(1, Math.floor(Number(v)) || 1)));
  }

  protected shared(days: number): number {
    return sharedDays(days, this.workers());
  }

  // -- text ----------------------------------------------------------------------------------
  protected sectionLabel(s: CraftSection): string {
    const key = `crafting.section.${s}` as TranslationKey;
    const label = this.i18n.t(key);
    // a magic type without its own label shows the type's name
    return label === key ? term(this.i18n.language(), 'magicType', s.replace('magic:', '')) : label;
  }

  protected sortLabel(s: CraftSort): string {
    return this.i18n.t(`crafting.sort.${s}` as TranslationKey);
  }

  private toolName(id: string): string {
    const tool = this.items.value()?.byId.get(id);
    return tool ? this.data.shortName(tool.name) : id;
  }

  protected days(n: number): string {
    return this.i18n.t(n === 1 ? 'crafting.day' : 'crafting.days', {
      n: n.toLocaleString(this.i18n.language()),
    });
  }

  protected cost(amount: number, unit: string): string {
    return this.i18n.t('compendium.cost', {
      amount: amount.toLocaleString(this.i18n.language()),
      unit: this.i18n.t(`compendium.coin.${unit}` as never),
    });
  }

  protected coins(cp: number): string {
    const c = coinsFromCp(cp);
    const parts = (['gp', 'sp', 'cp'] as const)
      .filter((u) => c[u] > 0)
      .map((u) => this.cost(c[u], u));
    return parts.length ? parts.join(' ') : this.cost(0, 'gp');
  }
}
