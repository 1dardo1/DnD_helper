import { Component, input } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { useWizardTexts } from './wizard-texts';

/**
 * The header of a step: "Paso 3 de 9", its name, what is decided here (lead) and, folded, why it
 * goes here and how it works (jargon explained). Anything projected goes under it (a hint that
 * depends on the character, a jump list...).
 */
@Component({
  selector: 'app-wizard-step-head',
  imports: [TranslatePipe],
  template: `
    <header class="wz-head">
      @if (total()) {
        <p class="kicker">{{ 'wizard.stepOf' | t: { n: n(), total: total() } }}</p>
      }
      <h2 [attr.id]="headingId() || null">{{ title() }}</h2>
      @if (lead()) {
        <p class="lead">{{ lead() }}</p>
      }
      @if (why()) {
        <details class="why">
          <summary>{{ 'wizard.why' | t }}</summary>
          <p>{{ why() }}</p>
        </details>
      }
      <ng-content />
    </header>
  `,
  styles: `
    :host {
      display: block;
    }

    .wz-head {
      display: grid;
      gap: var(--space-2);
      padding-bottom: var(--space-3);
      border-bottom: 1px dashed var(--line-strong);
    }

    /* phones and tablets: the progress bar above already says "Paso 3 de 9" */
    @media (max-width: 59.99rem) {
      .kicker {
        display: none;
      }
    }

    .kicker {
      margin: 0;
      font-family: var(--font-note);
      font-size: var(--fs-sm);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ink-soft);
    }

    h2 {
      margin: 0;
      font-size: var(--fs-2xl);
      line-height: 1.1;
    }

    .lead {
      margin: 0;
      max-width: var(--measure);
      font-size: var(--fs-md);
    }

    .why {
      max-width: var(--measure);

      summary {
        min-height: var(--tap);
        display: flex;
        align-items: center;
        color: var(--ink-blue);
        cursor: pointer;
      }

      p {
        margin: 0 0 var(--space-2);
        color: var(--ink-soft);
      }
    }
  `,
})
export class WizardStepHead {
  readonly n = input(0);
  readonly total = input(0);
  readonly title = input.required<string>();
  readonly lead = input('');
  readonly why = input('');
  readonly headingId = input('');

  constructor() {
    useWizardTexts();
  }
}
