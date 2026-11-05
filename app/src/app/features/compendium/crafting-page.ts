import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import {
  CraftRarity,
  MAGIC_RARITIES,
  castsSpells,
  coinsFromCp,
  costInCp,
  craftRarity,
  isConsumableType,
  isCraftable,
  magicCraft,
  magicTools,
  mundaneCraft,
  needsBaseItem,
  sharedDays,
} from '../../core/crafting/crafting';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Item } from '../../core/models/compendium';
import { SpellBinding, spellBinding } from '../../core/spell-items/spell-items';
import { LoadError } from './load-error';
import { normalise, rankName } from './compendium-search';

const RULE_MUNDANE = 'equipment/crafting-non-magical-items';
const RULE_MAGIC = 'magic-item/crafting-magical-items';

type Kind = 'all' | 'mundane' | 'magic';

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

/** "Crafting": pick an item and see what making it takes (2024 rules: tools, materials, time). */
@Component({
  selector: 'app-crafting-page',
  imports: [RouterLink, TranslatePipe, TermPipe, DataNamePipe, LoadError],
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
      <div class="filters">
        <input
          type="search"
          [placeholder]="'crafting.search' | t"
          [attr.aria-label]="'crafting.search' | t"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
        <div class="chips" role="group" [attr.aria-label]="'crafting.kind' | t">
          @for (k of kinds; track k) {
            <button
              type="button"
              [class.on]="kind() === k"
              [attr.aria-pressed]="kind() === k"
              (click)="kind.set(k)"
            >
              {{ 'crafting.kind.' + k | t }}
            </button>
          }
        </div>
        <label class="old">
          <input type="checkbox" [checked]="old()" (change)="old.set(!old())" />
          {{ 'crafting.include2014' | t }}
        </label>
      </div>

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
            <button type="button" class="btn-ghost" (click)="select(null)">✕</button>
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
            @if (it.magic && craft()?.kind === 'magic' && !isSpellScroll()) {
              <label class="inline">
                <input
                  type="checkbox"
                  [checked]="consumable()"
                  (change)="consumablePick.set(!consumable())"
                />
                {{ 'crafting.consumable' | t }}
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
      }

      <p class="count" role="status">{{ 'crafting.count' | t: { n: matches().length } }}</p>
      <ul class="results">
        @for (i of shown(); track i.id) {
          <li>
            <button type="button" [class.on]="selected()?.id === i.id" (click)="select(i.id)">
              <span class="n">{{ i.name | dataName: true }}</span>
              <small>
                @if (i.magic) {
                  {{ i.magic.rarity ?? '' | term: 'rarity' }}
                  {{ i.magic.type | term: 'magicType' }}
                } @else {
                  {{ i.category | term: 'itemCategory' }}
                  @if (i.cost; as c) {
                    · {{ cost(c.amount, c.unit) }}
                  }
                }
              </small>
            </button>
          </li>
        }
      </ul>
      @if (matches().length > shown().length) {
        <p class="hint">{{ 'crafting.more' | t: { n: matches().length - shown().length } }}</p>
      }
    }
  `,
  styles: `
    .links {
      font-size: var(--fs-sm);
    }
    .filters {
      display: grid;
      gap: var(--space-2);
      max-width: 40rem;
    }
    .filters input[type='search'] {
      width: 100%;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .chips button,
    .results button {
      min-height: var(--tap, 2.75rem);
    }
    .on {
      color: var(--card);
      background-color: var(--accent);
      border-color: var(--accent);
    }
    .old {
      font-size: var(--fs-sm);
    }
    .calc {
      margin-block: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    .calc h2 {
      margin-top: 0;
    }
    .sub {
      margin-top: 0;
      color: var(--ink-soft);
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
    .results {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
      gap: var(--space-2);
    }
    .results button {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
    }
    .results small {
      color: var(--ink-soft);
    }
    .on small {
      color: inherit;
    }
  `,
})
export class CraftingPage {
  /** Query parameter ?item=<id>. */
  readonly item = input<string>();

  private readonly compendium = inject(CompendiumService);
  private readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly ruleMundane = RULE_MUNDANE;
  protected readonly ruleMagic = RULE_MAGIC;
  protected readonly kinds: Kind[] = ['all', 'mundane', 'magic'];
  protected readonly rarities = MAGIC_RARITIES;

  protected readonly items = resource({
    loader: async () => {
      const all = (await this.compendium.all('item')).filter(isCraftable);
      return { all, byId: new Map(all.map((i) => [i.id, i])) };
    },
  });

  protected readonly query = signal('');
  protected readonly kind = signal<Kind>('all');
  protected readonly old = signal(false);
  protected readonly workers = signal(1);
  protected readonly spellLevel = signal<number | null>(null);
  protected readonly rarityPick = signal<string | null>(null);
  protected readonly consumablePick = signal<boolean | null>(null);

  protected readonly selected = computed(() => {
    const id = this.item();
    return id ? this.items.value()?.byId.get(id) : undefined;
  });

  protected readonly matches = computed(() => {
    const q = normalise(this.query());
    const kind = this.kind();
    const old = this.old();
    const found = (this.items.value()?.all ?? []).filter(
      (i) =>
        (old || i.edition === '2024') &&
        (kind === 'all' || (kind === 'magic') === !!i.magic) &&
        (!q || normalise(this.data.searchText(i.name)).includes(q)),
    );
    const rank = (i: Item) =>
      q
        ? Math.min(
            ...[i.name, this.data.shortName(i.name)].map((n) => rankName(normalise(n), q) ?? 9),
          )
        : 0;
    return found.sort(
      (a, b) =>
        rank(a) - rank(b) || this.data.shortName(a.name).localeCompare(this.data.shortName(b.name)),
    );
  });

  protected readonly shown = computed(() => this.matches().slice(0, 60));

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

  protected readonly consumable = computed(
    () => this.consumablePick() ?? isConsumableType(this.selected()?.magic?.type),
  );

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

  protected select(id: string | null): void {
    this.spellLevel.set(null);
    this.rarityPick.set(null);
    this.consumablePick.set(null);
    void this.router.navigate([], {
      queryParams: { item: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setWorkers(v: string): void {
    this.workers.set(Math.min(10, Math.max(1, Math.floor(Number(v)) || 1)));
  }

  protected shared(days: number): number {
    return sharedDays(days, this.workers());
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
