import { Component, input, output } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/i18n.service';
import { FooterNote } from './wizard-footer';
import { useWizardTexts } from './wizard-texts';

/** What's still to do, step by step, as the last step lists it. */
export interface PendingGroup {
  step: string;
  label: string;
  items: FooterNote[];
}

/**
 * The last step's list of what's still missing or flagged, by step: the step's name goes to it and
 * each item to the part of the step that solves it. "Everything chosen" when there's nothing.
 */
@Component({
  selector: 'app-wizard-pending',
  imports: [TranslatePipe],
  template: `
    <section class="pending" [class.ok]="!groups().length">
      <h3>{{ 'wizard.review.pending' | t }}</h3>
      @for (g of groups(); track g.step) {
        <h4>
          <button type="button" class="link" (click)="step.emit(g.step)">{{ g.label }} →</button>
        </h4>
        <ul>
          @for (i of g.items; track $index) {
            <li>
              <button type="button" class="item" [class.issue]="i.issue" (click)="item.emit(i)">
                <span aria-hidden="true">{{ i.issue ? '⚠' : '○' }}</span>
                <span>{{ i.text }}</span>
                <span class="arrow">{{ 'wizard.review.goTo' | t }} →</span>
              </button>
            </li>
          }
        </ul>
      } @empty {
        <p>✓ {{ 'wizard.review.allDone' | t }}</p>
      }
      @if (groups().length) {
        <p class="hint">{{ 'create.canFinishLater' | t }}</p>
      }
    </section>
  `,
  styles: `
    @use '../theme/notebook' as nb;

    :host {
      display: block;
    }

    .pending {
      @include nb.sticky-note(-0.3deg);
    }

    h3 {
      margin: 0 0 var(--space-2);
    }

    h4 {
      margin: var(--space-2) 0 0;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .link {
      min-height: var(--tap);
      padding: 0;
      color: var(--ink-blue);
      background: none;
      border: 0;
      box-shadow: none;
    }

    .item {
      display: flex;
      justify-content: flex-start;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--tap);
      padding: 0.15rem 0.3rem;
      font-family: var(--font-body);
      font-size: var(--fs-sm);
      text-align: left;
      background: none;
      border: 0;
      box-shadow: none;

      &.issue {
        color: var(--danger);
      }

      .arrow {
        margin-left: auto;
        white-space: nowrap;
        color: var(--ink-blue);
      }
    }

    .hint {
      margin: var(--space-2) 0 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }

    .ok p {
      margin: 0;
      color: var(--ok);
    }
  `,
})
export class WizardPending {
  readonly groups = input.required<readonly PendingGroup[]>();
  /** The name of a step tapped. */
  readonly step = output<string>();
  /** An item tapped (its target says where it is solved). */
  readonly item = output<FooterNote>();

  constructor() {
    useWizardTexts();
  }
}
