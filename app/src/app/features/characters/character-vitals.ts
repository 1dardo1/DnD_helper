import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { vitalsOf } from '../../core/rules/vitals';
import { RulesData } from '../../core/rules/engine';

/**
 * "PG 23/31" and "CA 16" chips for a card of the character list. The sheet is computed only when
 * this card renders (and again only when its character changes). Shows nothing while the
 * compendium is not loaded yet, or when the sheet cannot be computed.
 */
@Component({
  selector: 'app-character-vitals',
  imports: [TranslatePipe],
  template: `
    @if (vitals(); as v) {
      <span class="chip hp" data-testid="vitals-hp">
        <span class="label">{{ 'sheet.hitPointsShort' | t }}</span>
        {{ v.hp }}/{{ v.hpMax }}
      </span>
      <span class="chip" data-testid="vitals-ac">
        <span class="label">{{ 'sheet.armorClassShort' | t }}</span>
        {{ v.ac }}
      </span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1 1 100%;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    :host:empty {
      display: none;
    }
    .chip {
      display: inline-flex;
      align-items: baseline;
      gap: var(--space-1);
      padding: 0.1rem 0.5rem;
      font-family: var(--font-note);
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--ink);
      background-color: var(--paper, transparent);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm, 0.4rem);
    }
    .label {
      font-size: var(--fs-xs, 0.75rem);
      color: var(--ink-soft);
      text-transform: uppercase;
    }
  `,
})
export class CharacterVitals {
  readonly character = input.required<Character>();
  /** The compendium tables, loaded once by the list (null while loading). */
  readonly data = input<RulesData | null | undefined>(null);

  protected readonly vitals = computed(() => {
    const data = this.data();
    return data ? vitalsOf(this.character(), data) : null;
  });
}
