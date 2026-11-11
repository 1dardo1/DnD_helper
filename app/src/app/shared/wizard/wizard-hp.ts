import { Component, computed, input, output, signal } from '@angular/core';

import { spreadHpTotal, withMethodEverywhere } from '../../core/creation/hp-actions';
import { ClassEntry } from '../../core/creation/hp-levels';
import { DataNamePipe } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Sheet } from '../../core/rules/sheet';
import { HpLevels } from '../hp-levels';
import { useWizardTexts } from './wizard-texts';

/**
 * The hit points step of the wizard: the maximum always in view with where it comes from (dice,
 * Constitution, feats and traits), actions for every level at once (roll them all, the average on
 * all, or write the total by hand and spread it over the levels), and each class with its levels
 * (roll / average / fixed value each; level 1 of the first class is the die's maximum by the rule,
 * another method there is marked as a house rule).
 */
@Component({
  selector: 'app-wizard-hp',
  imports: [TranslatePipe, DataNamePipe, HpLevels],
  template: `
    @let hp = parts();
    <section class="hp-total" aria-live="polite">
      <p class="big">
        <span>{{ 'wizard.hp.total' | t }}</span>
        <strong>{{ hp.max }}</strong>
      </p>
      <p class="formula">
        {{
          'wizard.hp.formula'
            | t
              : {
                  dice: hp.dice,
                  con: plusMinus(hp.con),
                  levels: hp.levels,
                  other: hp.other ? ('wizard.hp.other' | t: { n: hp.other }) : '',
                  total: hp.max,
                }
        }}
      </p>
    </section>
    <fieldset class="hp-all">
      <legend>{{ 'wizard.hp.all' | t }}</legend>
      <button type="button" (click)="everywhere('roll')">{{ 'wizard.hp.rollAll' | t }}</button>
      <button type="button" (click)="everywhere('average')">
        {{ 'wizard.hp.averageAll' | t }}
      </button>
      <button type="button" [attr.aria-expanded]="writing()" (click)="writing.set(!writing())">
        ✎ {{ 'wizard.hp.writeTotal' | t }}
      </button>
      @if (writing()) {
        <div class="hp-write">
          <label>
            {{ 'wizard.hp.totalLabel' | t }}
            <input #hpIn type="number" inputmode="numeric" min="1" [value]="hp.max" />
          </label>
          <button type="button" class="primary" (click)="spread(hpIn.value)">
            {{ 'wizard.hp.spread' | t }}
          </button>
          <p class="hint">{{ 'wizard.hp.spreadHint' | t }}</p>
          @if (off(); as o) {
            <p class="issue" role="status">
              {{ 'wizard.hp.spreadOff' | t: { got: o.got, off: signed(o.diff) } }}
            </p>
          }
        </div>
      }
    </fieldset>
    <p class="hint rule">{{ 'wizard.hp.firstRule' | t }}</p>
    @for (k of classes(); track $index; let i = $index) {
      @if (dieOf(k.id); as die) {
        <fieldset class="hp-class">
          <legend>
            {{ 'wizard.hp.ofClass' | t: { cls: (nameOf(k.id) | dataName: true), die } }}
          </legend>
          <app-hp-levels
            [entry]="k"
            [die]="die"
            [first]="i === 0"
            [con]="sheet().abilities.CON.modifier"
            (entryChange)="setEntry(i, $event)"
          />
        </fieldset>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }

    .hp-total {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);

      .big {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        margin: 0;
        font-family: var(--font-title);
        font-size: var(--fs-lg);
      }

      strong {
        font-family: var(--font-hand);
        font-size: 2.6rem;
        line-height: 1;
        color: var(--accent);
      }

      .formula {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--ink-soft);
      }
    }

    fieldset {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      margin: 0;

      > app-hp-levels {
        flex: 1 1 100%;
      }
    }

    .hp-all button {
      min-height: var(--tap);
    }

    .hp-write {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--space-2) var(--space-3);
      flex: 1 1 100%;

      label {
        display: grid;
        gap: 0.3rem;
        font-family: var(--font-note);
        font-weight: 700;
      }

      input {
        width: 6rem;
      }

      p {
        flex: 1 1 100%;
        margin: 0;
      }
    }

    .hint {
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }

    .rule {
      font-style: italic;
    }

    .issue {
      color: var(--danger);
    }
  `,
})
export class WizardHp {
  /** The character's classes (the first one is the starting class). */
  readonly classes = input.required<readonly ClassEntry[]>();
  /** Hit die and name of each class, by id. */
  readonly info = input.required<Readonly<Record<string, { die: number; name: string }>>>();
  /** The sheet as it stands (Constitution, and the maximum with feats and traits). */
  readonly sheet = input.required<Sheet>();
  readonly classesChange = output<ClassEntry[]>();

  constructor() {
    useWizardTexts();
  }

  /** "Escribir el total a mano" open, and how the last spread went (null = exact or none). */
  protected readonly writing = signal(false);
  protected readonly off = signal<{ got: number; diff: number } | null>(null);

  protected readonly dieOf = (id: string) => this.info()[id]?.die;
  protected readonly nameOf = (id: string) => this.info()[id]?.name ?? id;

  /** Dice, Constitution and other parts of the maximum. */
  protected readonly parts = computed(() => {
    const h = this.sheet().hitPoints;
    const dice = h.levels.reduce((n, r) => n + r.gained, 0);
    const con = h.levels.reduce((n, r) => n + (r.total - r.gained), 0);
    return { max: h.max, dice, con, levels: h.levels.length, other: h.bonus };
  });

  protected everywhere(method: 'roll' | 'average'): void {
    this.off.set(null);
    this.classesChange.emit(withMethodEverywhere(this.classes(), this.dieOf, method));
  }

  /** A maximum written by hand, spread over the levels as fixed values. */
  protected spread(raw: string): void {
    const total = parseInt(raw, 10);
    if (!Number.isFinite(total) || total < 1) return;
    const sheet = this.sheet();
    const r = spreadHpTotal(
      this.classes(),
      this.dieOf,
      sheet.abilities.CON.modifier,
      sheet.hitPoints.bonus,
      total,
    );
    this.classesChange.emit(r.classes);
    this.off.set(r.off ? { got: total - r.off, diff: -r.off } : null);
  }

  protected setEntry(i: number, entry: ClassEntry): void {
    const out = [...this.classes()];
    out[i] = { ...out[i], hp: entry.hp, hpMethod: entry.hpMethod };
    this.classesChange.emit(out);
  }

  /** "+ 10" / "− 5": a term added to a sum. */
  protected plusMinus(n: number): string {
    return n < 0 ? `− ${-n}` : `+ ${n}`;
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }
}
