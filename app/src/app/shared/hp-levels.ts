import { Component, computed, input, output, signal } from '@angular/core';

import {
  ClassEntry,
  HP_METHODS,
  HpMethod,
  averageHp,
  clampHp,
  hpMethodAt,
  levelHp,
  rollHitDie,
  withFirstLevelMax,
  withFixedAll,
  withHpMethod,
} from '../core/creation/hp-levels';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { useWizardTexts } from './wizard/wizard-texts';

/**
 * Hit points of each level of one class: per level the player chooses how they are obtained (roll
 * the hit die, take the average, or write a fixed value) and sees the result. Level 1 of the
 * starting class is the die's maximum by the rule, but a house rule can choose another method for
 * it too (labelled as such). Used by the wizard (all levels, also when editing) and the level up
 * (only the new level: `from`).
 */
@Component({
  selector: 'app-hp-levels',
  imports: [TranslatePipe],
  template: `
    @for (i of shown(); track i) {
      @let lvlOne = first() && i === 0;
      @let m = method(i);
      <div class="lv" [class.rolling]="rolling() === i" [class.house]="lvlOne && m !== null">
        <span class="n">{{ 'compendium.level' | t: { level: i + 1 } }}</span>
        <select
          class="method"
          [attr.aria-label]="'hp.method' | t"
          [value]="m ?? ''"
          (change)="setMethod(i, $any($event.target).value)"
        >
          @if (lvlOne) {
            <option value="">{{ 'wizard.hp.firstMax' | t: { die: die() } }}</option>
          } @else if (m === null) {
            <option value="">{{ 'hp.methodNone' | t }}</option>
          }
          @for (x of methods; track x) {
            <option [value]="x">
              {{ 'hp.method.' + x | t: { avg: avg() }
              }}{{ lvlOne ? ' (' + ('wizard.hp.houseRule' | t) + ')' : '' }}
            </option>
          }
        </select>
        @switch (m) {
          @case ('roll') {
            <button type="button" (click)="roll(i)" [disabled]="rolling() !== null">
              {{ (entry().hp[i] === null ? 'hp.roll' : 'hp.reroll') | t: { die: die() } }}
            </button>
            <input
              type="number"
              inputmode="numeric"
              min="1"
              [max]="die()"
              [attr.aria-label]="'hp.actual' | t: { die: die() }"
              [placeholder]="'hp.actualShort' | t"
              [value]="rolling() === i ? face() : (entry().hp[i] ?? '')"
              (change)="setValue(i, $any($event.target).value)"
            />
          }
          @case ('average') {
            <span class="val">{{ avg() }}</span>
          }
          @case ('fixed') {
            <input
              type="number"
              inputmode="numeric"
              min="1"
              [max]="die()"
              [attr.aria-label]="'hp.fixedValue' | t: { die: die() }"
              [placeholder]="avg()"
              [value]="entry().hp[i] ?? ''"
              (change)="setValue(i, $any($event.target).value)"
            />
          }
          @default {
            @if (lvlOne) {
              <span class="val">{{ die() }}</span>
            } @else {
              <input
                type="number"
                inputmode="numeric"
                min="1"
                [max]="die()"
                [attr.aria-label]="'hp.fixedValue' | t: { die: die() }"
                [placeholder]="avg()"
                [value]="entry().hp[i] ?? ''"
                (change)="setValue(i, $any($event.target).value)"
              />
            }
          }
        }
        @if (m === 'fixed' && shown().length > 1) {
          <button type="button" class="all" (click)="applyAll(i)">{{ 'hp.applyAll' | t }}</button>
        }
        @if (m === 'roll' && entry().hp[i] === null && rolling() !== i) {
          <small class="hint">{{
            (lvlOne ? 'wizard.hp.firstNotRolled' : 'hp.notRolled') | t: { avg: avg(), die: die() }
          }}</small>
        }
        @if (lvlOne && m !== null) {
          <small class="hint rule">{{ 'wizard.hp.firstRule' | t }}</small>
        }
        @if (con() !== null) {
          <small class="res">{{ 'hp.result' | t: { n: gained(i), total: total(i) } }}</small>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .lv {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 0.6rem;
      padding: 0.4rem 0;
      border-bottom: 1px dotted var(--border, #8884);
    }
    .n {
      min-width: 4.5rem;
      font-weight: 600;
    }
    .method {
      flex: 1 1 9rem;
      min-width: 0;
    }
    input[type='number'] {
      width: 4.5rem;
    }
    .val {
      font-weight: 600;
      min-width: 4.5rem;
    }
    .res {
      flex: 1 1 100%;
      opacity: 0.8;
    }
    .hint {
      flex: 1 1 100%;
    }
    .rule {
      font-style: italic;
      color: var(--warn);
    }
    .house .n::after {
      content: ' *';
      color: var(--warn);
    }
    .rolling input {
      animation: hp-shake 0.12s linear infinite;
    }
    @keyframes hp-shake {
      0% {
        transform: rotate(-6deg);
      }
      50% {
        transform: rotate(6deg);
      }
      100% {
        transform: rotate(-6deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .rolling input {
        animation: none;
      }
    }
  `,
})
export class HpLevels {
  /** The class entry (hp and hpMethod are read from it). */
  readonly entry = input.required<ClassEntry>();
  readonly die = input.required<number>();
  /** The class is the starting one: its level 1 is always the full die. */
  readonly first = input(false);
  /** First level index shown (the level up shows just the new level). */
  readonly from = input(0);
  /** Constitution modifier, to show the total of each level (null = don't show). */
  readonly con = input<number | null>(null);
  readonly entryChange = output<ClassEntry>();

  protected readonly methods = HP_METHODS;

  constructor() {
    useWizardTexts();
  }
  protected readonly rolling = signal<number | null>(null);
  protected readonly face = signal(1);
  protected readonly avg = computed(() => averageHp(this.die()));
  protected readonly shown = computed(() => {
    const out: number[] = [];
    for (let i = this.from(); i < this.entry().level; i++) out.push(i);
    return out;
  });

  protected method(i: number): HpMethod | null {
    return hpMethodAt(this.entry(), i);
  }

  protected gained(i: number): number {
    return levelHp(this.entry(), i, this.die(), this.first());
  }

  protected total(i: number): number {
    return Math.max(this.gained(i) + (this.con() ?? 0), 1);
  }

  protected setMethod(i: number, raw: string): void {
    // level 1 of the starting class back to the rule: the die's maximum
    if (raw === '' && this.first() && i === 0) {
      this.entryChange.emit(withFirstLevelMax(this.entry()));
      return;
    }
    if (raw !== 'roll' && raw !== 'average' && raw !== 'fixed') return;
    const old = this.entry().hp[i];
    const value = raw === 'fixed' ? (old ?? this.avg()) : raw === 'roll' ? old : null;
    this.entryChange.emit(withHpMethod(this.entry(), i, this.die(), raw, value));
  }

  protected setValue(i: number, raw: string): void {
    const m = this.method(i) ?? 'fixed';
    this.entryChange.emit(withHpMethod(this.entry(), i, this.die(), m, clampHp(raw, this.die())));
  }

  protected applyAll(i: number): void {
    const v = this.entry().hp[i] ?? this.avg();
    const levels = this.shown().filter((j) => !(this.first() && j === 0));
    this.entryChange.emit(withFixedAll(this.entry(), levels, this.die(), v));
  }

  /** Animated roll: the die face changes a few times and settles on the result. */
  protected roll(i: number): void {
    if (this.rolling() !== null) return;
    const result = rollHitDie(this.die());
    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      this.rolling.set(null);
      this.entryChange.emit(withHpMethod(this.entry(), i, this.die(), 'roll', result));
    };
    if (reduce) return finish();
    this.rolling.set(i);
    let ticks = 0;
    const timer = setInterval(() => {
      if (++ticks >= 10) {
        clearInterval(timer);
        this.face.set(result);
        setTimeout(finish, 120);
      } else this.face.set(rollHitDie(this.die()));
    }, 55);
  }
}
