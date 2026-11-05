import { Component, computed, inject, input, output, resource, signal } from '@angular/core';

import { CompendiumService } from '../core/compendium/compendium.service';
import { DataNamePipe, DataTextService } from '../core/i18n/data-text.service';
import { TermPipe } from '../core/i18n/glossary';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { Item, Spell } from '../core/models/compendium';
import { SpellBinding, levelStats, spellAllowed } from '../core/spell-items/spell-items';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * "Add with the spell you want": a spell search with level filter for the items that hold a spell
 * (Spell Scroll, Enspelled armor...). The item limits the level, and sometimes the school.
 */
@Component({
  selector: 'app-spell-item-picker',
  imports: [TranslatePipe, DataNamePipe, TermPipe],
  template: `
    <div
      class="picker"
      role="group"
      [attr.aria-label]="'spellitem.pickTitle' | t: { item: item().name }"
    >
      <p class="title">
        <strong>{{ 'spellitem.pickTitle' | t: { item: (item().name | dataName) } }}</strong>
      </p>
      @if (binding().schools; as schools) {
        <p class="hint">
          {{ 'spellitem.schools' | t }}
          @for (s of schools; track s; let last = $last) {
            {{ s | term: 'school' }}{{ last ? '' : ', ' }}
          }
        </p>
      }
      <input
        type="search"
        [placeholder]="'spellitem.search' | t"
        [attr.aria-label]="'spellitem.search' | t"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
      <div class="levels" role="group" [attr.aria-label]="'spellitem.level' | t">
        <button type="button" [class.on]="level() === null" (click)="level.set(null)">
          {{ 'spellitem.allLevels' | t }}
        </button>
        @for (l of levels(); track l) {
          <button type="button" [class.on]="level() === l" (click)="level.set(l)">
            {{ l === 0 ? ('spellitem.cantrip' | t) : l }}
          </button>
        }
      </div>
      <ul class="results">
        @for (s of results(); track s.id) {
          <li>
            <button type="button" (click)="picked.emit(s)">
              <span class="n">{{ s.name | dataName }}</span>
              <small>
                {{
                  s.level === 0
                    ? ('spellitem.cantrip' | t)
                    : ('spellitem.levelN' | t: { n: s.level })
                }}
                · {{ s.school | term: 'school' }}
                @if (stats(s); as st) {
                  · {{ 'spellitem.stats' | t: { dc: st.dc, attack: '+' + st.attack } }}
                }
              </small>
            </button>
          </li>
        } @empty {
          <li class="muted">{{ 'spellitem.none' | t }}</li>
        }
      </ul>
      <button type="button" class="btn-ghost" (click)="cancelled.emit()">
        {{ 'common.cancel' | t }}
      </button>
    </div>
  `,
  styles: `
    .picker {
      display: grid;
      gap: var(--space-2);
      margin-top: var(--space-2);
      padding: var(--space-3);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
    }
    .title,
    .hint {
      margin: 0;
    }
    .hint {
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    input {
      width: 100%;
      max-width: 28rem;
    }
    .levels {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .levels button {
      min-width: 2.5rem;
      min-height: var(--tap, 2.75rem);
    }
    .levels .on {
      color: var(--card);
      background-color: var(--accent);
      border-color: var(--accent);
    }
    .results {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 16rem;
      overflow-y: auto;
      display: grid;
      gap: 0.3rem;
    }
    .results button {
      width: 100%;
      min-height: var(--tap, 2.75rem);
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2rem 0.6rem;
      text-align: left;
    }
    small {
      color: var(--ink-soft);
    }
  `,
})
export class SpellItemPicker {
  readonly item = input.required<Item>();
  readonly binding = input.required<SpellBinding>();
  readonly picked = output<Spell>();
  readonly cancelled = output<void>();

  private readonly compendium = inject(CompendiumService);
  private readonly dataText = inject(DataTextService);

  private readonly spells = resource({ loader: () => this.compendium.all('spell') });

  protected readonly query = signal('');
  protected readonly level = signal<number | null>(null);

  protected readonly levels = computed(() => {
    const b = this.binding();
    return Array.from({ length: b.maxLevel - b.minLevel + 1 }, (_, i) => b.minLevel + i);
  });

  protected readonly results = computed(() => {
    const b = this.binding();
    const q = norm(this.query());
    const l = this.level();
    return (this.spells.value() ?? [])
      .filter(
        (s) =>
          spellAllowed(b, s) &&
          (l === null || s.level === l) &&
          (!q || norm(this.dataText.searchText(s.name)).includes(q)),
      )
      .sort(
        (a, c) =>
          a.level - c.level ||
          this.dataText.shortName(a.name).localeCompare(this.dataText.shortName(c.name)),
      )
      .slice(0, 60);
  });

  protected stats(s: Spell) {
    return levelStats(this.binding(), s.level);
  }
}
