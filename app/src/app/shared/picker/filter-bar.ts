import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { isExcluded, modeKey, selectedValues, toggleExcluded, toggleValue } from './picker-filters';

/** A facet ready to show: its label, its options (value + label) and the value selected. */
export interface FacetView {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  /** Less used: shown under "Más filtros". */
  more?: boolean;
  /** How included values combine: any of them, or all at once (only when `canAnd`). */
  mode: 'or' | 'and';
  /** Whether an entry can have several values of this facet, so "all at once" means something. */
  canAnd: boolean;
}

/** Wider screens show the filters open; phones start with them folded under "Filtros". */
function wideScreen(): boolean {
  try {
    return matchMedia('(min-width: 45rem)').matches;
  } catch {
    return true;
  }
}

/**
 * Search box, filters (one foldable column per facet: tick to include, ✕ to exclude, "O" / "Y"; folded on phones), "N de M" and "Quitar filtros".
 * Holds no state of its own: the wizard pickers keep it in signals, the compendium in the URL.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [NgTemplateOutlet, TranslatePipe],
  template: `
    <ng-template #facet let-f>
      <details class="col" [class.on]="!!f.selected" [open]="startOpen(f)">
        <summary>
          {{ f.label }}
          @if (count(f); as n) {
            <span class="chip">{{ n }}</span>
          }
        </summary>
        @if (f.canAnd) {
          <div class="mode" role="group" [attr.aria-label]="'picker.mode' | t">
            <button
              type="button"
              [attr.aria-pressed]="f.mode === 'or'"
              [title]="'picker.modeOrHint' | t"
              (click)="facetChange.emit({ key: modeKey(f.key), value: '' })"
            >
              {{ 'picker.modeOr' | t }}
            </button>
            <button
              type="button"
              [attr.aria-pressed]="f.mode === 'and'"
              [title]="'picker.modeAndHint' | t"
              (click)="facetChange.emit({ key: modeKey(f.key), value: 'and' })"
            >
              {{ 'picker.modeAnd' | t }}
            </button>
          </div>
        }
        <ul>
          @for (o of f.options; track o.value) {
            <li [class.excluded]="isOff(f, o.value)">
              <label>
                <input
                  type="checkbox"
                  [checked]="isOn(f, o.value)"
                  (change)="facetChange.emit({ key: f.key, value: toggled(f, o.value) })"
                />
                {{ o.label }}
              </label>
              <button
                type="button"
                class="exclude"
                [attr.aria-pressed]="isOff(f, o.value)"
                [attr.aria-label]="('picker.exclude' | t) + ': ' + o.label"
                [title]="'picker.excludeHint' | t"
                (click)="facetChange.emit({ key: f.key, value: excluded(f, o.value) })"
              >
                ✕
              </button>
            </li>
          }
        </ul>
      </details>
    </ng-template>
    <input
      type="search"
      [placeholder]="'common.search' | t"
      [attr.aria-label]="'common.search' | t"
      [value]="query()"
      (input)="queryChange.emit($any($event.target).value)"
    />
    @if (facets().length) {
      <details class="filters" [open]="open()" (toggle)="open.set($any($event.target).open)">
        <summary>
          {{ 'picker.filters' | t }}
          @if (active()) {
            <span class="chip">{{ active() }}</span>
          }
        </summary>
        <div class="facets">
          @for (f of primary(); track f.key) {
            <ng-container *ngTemplateOutlet="facet; context: { $implicit: f }" />
          }
        </div>
        @if (more().length) {
          <details
            class="more"
            [open]="moreOpen()"
            (toggle)="moreOpen.set($any($event.target).open)"
          >
            <summary>
              {{ 'picker.moreFilters' | t }}
              @if (moreActive()) {
                <span class="chip">{{ moreActive() }}</span>
              }
            </summary>
            <div class="facets">
              @for (f of more(); track f.key) {
                <ng-container *ngTemplateOutlet="facet; context: { $implicit: f }" />
              }
            </div>
          </details>
        }
      </details>
    }
    <p class="count" aria-live="polite">
      <small>{{ 'picker.count' | t: { shown: shown(), total: total() } }}</small>
      <ng-content />
      @if (active() || query()) {
        <button type="button" class="btn-ghost" (click)="clear.emit()">
          {{ 'filter.clear' | t }}
        </button>
      }
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
    }

    input[type='search'] {
      width: 100%;
      max-width: 28rem;
    }

    .filters {
      margin: 0;
    }

    .col {
      align-self: start;
      margin: 0;
      padding: var(--space-1) var(--space-2);
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-sm);

      > summary {
        font-family: var(--font-title);
        font-size: var(--fs-sm);
        color: var(--ink-soft);
        cursor: pointer;
      }

      &.on > summary {
        color: var(--accent);
      }

      ul {
        max-height: 15rem;
        overflow-y: auto;
        margin: var(--space-1) 0 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      li.excluded label {
        text-decoration: line-through;
        color: var(--ink-soft);
      }

      .exclude {
        min-height: 2rem;
        min-width: 2rem;
        padding: 0;
        margin-left: auto;
        font-size: 1rem;
        line-height: 1;
        color: var(--ink-soft);
        background: none;
        border: 0;
        box-shadow: none;
        opacity: 0.55;

        &:hover,
        &[aria-pressed='true'] {
          opacity: 1;
        }

        &[aria-pressed='true'] {
          color: var(--danger, var(--accent));
        }
      }

      li label {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-height: 2rem;
        font-size: var(--fs-sm);
        cursor: pointer;
      }
    }

    // "O" / "Y": any of the ticked values, or all of them at once
    .mode {
      display: inline-flex;
      margin-top: var(--space-1);

      button {
        min-height: 2rem;
        padding: 0 0.7rem;
        font-size: var(--fs-xs);
        border-radius: 0;
        box-shadow: none;
      }

      button:first-child {
        border-radius: 1rem 0 0 1rem;
      }

      button + button {
        border-left: 0;
      }

      button:last-child {
        border-radius: 0 1rem 1rem 0;
      }

      [aria-pressed='true'] {
        color: var(--on-accent);
        background: var(--accent);
        border-color: var(--accent);
      }
    }

    .more {
      margin: var(--space-2) 0 0;
      font-size: var(--fs-sm);
    }

    summary .chip {
      display: inline-block;
      min-width: 1.4em;
      padding: 0 0.35em;
      font-size: var(--fs-xs);
      line-height: 1.4;
      text-align: center;
      color: var(--on-accent);
      background: var(--accent);
      border-radius: 0.7em;
    }

    .facets {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
      align-items: start;
      gap: var(--space-2) var(--space-3);
    }

    .count {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      margin: 0;

      button {
        min-height: var(--tap);
        padding-inline: 0.5rem;
        color: var(--accent);
        text-decoration: underline;
      }
    }
  `,
})
export class FilterBar {
  readonly query = input('');
  readonly facets = input<FacetView[]>([]);
  readonly shown = input(0);
  readonly total = input(0);
  readonly queryChange = output<string>();
  readonly facetChange = output<{ key: string; value: string }>();
  readonly clear = output<void>();

  protected readonly open = signal(wideScreen());

  protected readonly modeKey = modeKey;

  /** Ticked values of a column. */
  protected count(f: FacetView): number {
    return selectedValues(f.selected).length;
  }

  /** Columns in use start open; the main ones too on wide screens; the rest folded. */
  protected startOpen(f: FacetView): boolean {
    return !!f.selected || (!f.more && wideScreen());
  }

  protected isOn(f: FacetView, value: string): boolean {
    return selectedValues(f.selected).includes(value);
  }

  protected toggled(f: FacetView, value: string): string {
    return toggleValue(f.selected, value);
  }

  protected isOff(f: FacetView, value: string): boolean {
    return isExcluded(f.selected, value);
  }

  protected excluded(f: FacetView, value: string): string {
    return toggleExcluded(f.selected, value);
  }

  protected readonly primary = computed(() => this.facets().filter((f) => !f.more));
  protected readonly more = computed(() => this.facets().filter((f) => f.more));
  protected readonly active = computed(() => this.facets().filter((f) => f.selected).length);
  protected readonly moreActive = computed(() => this.more().filter((f) => f.selected).length);
  /** "Más filtros" starts open when one of them is in use (a link to a filtered list). */
  protected readonly moreOpen = linkedSignal(() => this.moreActive() > 0);
}
