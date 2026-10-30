import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { selectedValues, toggleValue } from './picker-filters';

/** A facet ready to show: its label, its options (value + label) and the value selected. */
export interface FacetView {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  /** Less used: shown under "Más filtros". */
  more?: boolean;
  /** Several values at once (comma-separated in `selected`): shown as toggle chips. */
  multi?: boolean;
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
 * Search box, filters (one select per facet, folded on phones), "N de M" and "Quitar filtros".
 * Holds no state of its own: the wizard pickers keep it in signals, the compendium in the URL.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [NgTemplateOutlet, TranslatePipe],
  template: `
    <ng-template #facet let-f>
      @if (f.multi) {
        <fieldset class="multi" [class.on]="!!f.selected">
          <legend>{{ f.label }}</legend>
          @for (o of f.options; track o.value) {
            <button
              type="button"
              class="toggle"
              [attr.aria-pressed]="isOn(f, o.value)"
              (click)="facetChange.emit({ key: f.key, value: toggled(f, o.value) })"
            >
              {{ o.label }}
            </button>
          }
        </fieldset>
      } @else {
        <label [class.on]="!!f.selected">
          <span>{{ f.label }}</span>
          <select
            [value]="f.selected"
            (change)="facetChange.emit({ key: f.key, value: $any($event.target).value })"
          >
            <option value="">{{ 'filter.all' | t }}</option>
            @for (o of f.options; track o.value) {
              <option [value]="o.value" [selected]="o.value === f.selected">
                {{ o.label }}
              </option>
            }
          </select>
        </label>
      }
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

    .multi {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin: 0;
      padding: var(--space-1) var(--space-2) var(--space-2);
      border: 1px dashed var(--line-strong);

      legend {
        padding: 0 0.3rem;
        font-size: var(--fs-sm);
        color: var(--ink-soft);
      }

      &.on legend {
        color: var(--accent);
      }
    }

    .toggle {
      min-height: var(--tap);
      padding: 0.1rem 0.7rem;
      font-size: var(--fs-sm);
      border-radius: 1.2rem;

      &[aria-pressed='true'] {
        color: var(--on-accent);
        background: var(--accent);
        border-color: var(--accent);
        box-shadow: none;
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
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
      gap: var(--space-2) var(--space-3);
    }

    label {
      display: grid;
      gap: 0.1rem;
      font-family: var(--font-title);
      font-size: var(--fs-sm);
      color: var(--ink-soft);

      &.on {
        color: var(--accent);
      }

      select {
        width: 100%;
        min-height: var(--tap);
        font-family: var(--font-body);
        color: var(--ink);
      }
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

  protected isOn(f: FacetView, value: string): boolean {
    return selectedValues(f.selected).includes(value);
  }

  protected toggled(f: FacetView, value: string): string {
    return toggleValue(f.selected, value);
  }

  protected readonly primary = computed(() => this.facets().filter((f) => !f.more));
  protected readonly more = computed(() => this.facets().filter((f) => f.more));
  protected readonly active = computed(() => this.facets().filter((f) => f.selected).length);
  protected readonly moreActive = computed(() => this.more().filter((f) => f.selected).length);
  /** "Más filtros" starts open when one of them is in use (a link to a filtered list). */
  protected readonly moreOpen = linkedSignal(() => this.moreActive() > 0);
}
