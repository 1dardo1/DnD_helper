import { Component, computed, input, output, signal } from '@angular/core';

import {
  ClassEntry,
  HP_METHODS,
  HpMethod,
  averageHp,
  clampHp,
  hpMethodAt,
  rollHitDie,
  withFixedAll,
  withHpMethod,
} from '../core/creation/hp-levels';
import { TranslatePipe } from '../core/i18n/i18n.service';

/**
 * Hit points of each level of one class: per level the player chooses how they are obtained (roll
 * the hit die, take the average, or write a fixed value) and sees the result. Used by the wizard
 * (all levels, also when editing) and the level up (only the new level: `from`).
 */
@Component({
  selector: 'app-hp-levels',
  imports: [TranslatePipe],
  template: `
    @for (i of shown(); track i) {
      <div class="lv" [class.rolling]="rolling() === i">
        <span class="n">{{ 'compendium.level' | t: { level: i + 1 } }}</span>
        @if (first() && i === 0) {
          <span class="max"
            >{{ 'hp.levelOne' | t: { n: die() } }}
            @if (con() !== null) {
              <small> {{ 'hp.withCon' | t: { total: total(i) } }}</small>
            }
          </span>
        } @else {
          <select
            class="method"
            [attr.aria-label]="'hp.method' | t"
            [value]="method(i) ?? ''"
            (change)="setMethod(i, $any($event.target).value)"
          >
            @if (method(i) === null) {
              <option value="">{{ 'hp.methodNone' | t }}</option>
            }
            @for (m of methods; track m) {
              <option [value]="m">{{ 'hp.method.' + m | t: { avg: avg() } }}</option>
            }
          </select>
          @switch (method(i)) {
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
            @default {
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
          @if (method(i) === 'fixed' && shown().length > 1) {
            <button type="button" class="all" (click)="applyAll(i)">{{ 'hp.applyAll' | t }}</button>
          }
          @if (method(i) === 'roll' && entry().hp[i] === null && rolling() !== i) {
            <small class="hint">{{ 'hp.notRolled' | t: { avg: avg() } }}</small>
          }
          @if (con() !== null) {
            <small class="res">{{ 'hp.result' | t: { n: gained(i), total: total(i) } }}</small>
          }
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
    if (this.first() && i === 0) return this.die();
    return this.entry().hp[i] ?? this.avg();
  }

  protected total(i: number): number {
    return Math.max(this.gained(i) + (this.con() ?? 0), 1);
  }

  protected setMethod(i: number, raw: string): void {
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
