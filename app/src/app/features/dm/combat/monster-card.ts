import { Component, computed, inject, input, output, signal } from '@angular/core';

import {
  CombatMonster,
  applyDamage,
  applyHealing,
  isDefeated,
  setTemp,
  updateMonster,
} from '../../../core/dm/combat';
import { CombatStore } from '../../../core/dm/combat-store.service';
import { term } from '../../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../../core/i18n/i18n.service';
import { Monster } from '../../../core/models/compendium';
import { EntryLabels } from '../../../shared/picker/entry-labels.service';
import { MonsterSummary } from './monster-summary';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The summary card of one monster: AC, hit points (damage, healing, temporary), speed and
 * defences, then what it can do (MonsterSummary).
 */
@Component({
  selector: 'app-monster-card',
  imports: [TranslatePipe, MonsterSummary],
  template: `
    @let m = instance();
    <article class="card" [class.down]="defeated()" [attr.aria-label]="label()">
      <header>
        <h2>
          {{ label() }}
          @if (defeated()) {
            <span class="badge">{{ 'combat.defeated' | t }}</span>
          }
        </h2>
        <div class="links">
          <button type="button" class="btn-ghost order-link" (click)="toOrder.emit()">
            ↑ {{ 'combat.toOrder' | t }}
          </button>
          <button type="button" class="btn-ghost" (click)="statBlock.emit(m.monsterId)">
            {{ 'combat.statBlock' | t }}
          </button>
        </div>
      </header>

      <div class="stats">
        <div class="ac" [title]="'monster.ac' | t">
          <span class="k">{{ 'monster.ac' | t }}</span>
          <strong>{{ m.ac }}</strong>
        </div>
        <div class="hp" aria-live="polite">
          <span class="k">{{ 'monster.hp' | t }}</span>
          <span
            ><strong [class.low]="m.hp * 2 <= m.hpMax">{{ m.hp }}</strong
            ><span class="max">/{{ m.hpMax }}</span></span
          >
          @if (m.temp) {
            <span class="temp">+{{ m.temp }} {{ 'combat.temp' | t }}</span>
          }
          <span class="bar" [style.--pct.%]="hpPercent()"></span>
        </div>
        <div class="init">
          <span class="k">{{ 'combat.initiative' | t }}</span>
          <strong>{{ m.initiative ?? '—' }}</strong>
          <small>({{ signed(m.initBonus) }})</small>
        </div>
      </div>

      <div class="hp-controls">
        <label>
          <span class="visually-hidden">{{ 'combat.amount' | t }}</span>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            [placeholder]="'combat.amount' | t"
            [value]="amount() ?? ''"
            (input)="amount.set(num($event))"
            (keydown.enter)="damage()"
          />
        </label>
        <button type="button" class="btn-danger" [disabled]="!amount()" (click)="damage()">
          − {{ 'combat.damage' | t }}
        </button>
        <button type="button" [disabled]="!amount()" (click)="heal()">
          + {{ 'combat.heal' | t }}
        </button>
        <button type="button" [disabled]="amount() === null" (click)="temp()">
          {{ 'combat.setTemp' | t }}
        </button>
      </div>

      @if (monster(); as mon) {
        <p class="line">
          <b>{{ 'monster.speed' | t }}</b> {{ speed() }}
        </p>
        @for (d of defences(); track d.key) {
          <p class="line">
            <b>{{ d.key | t }}</b> {{ d.value }}
          </p>
        }
        <app-monster-summary [monster]="mon" [instance]="m" />
      }
    </article>
  `,
  styleUrl: './monster-card.scss',
})
export class MonsterCard {
  private readonly store = inject(CombatStore);
  private readonly i18n = inject(I18nService);
  private readonly labels = inject(EntryLabels);

  readonly instance = input.required<CombatMonster>();
  readonly monster = input<Monster | undefined>();
  readonly label = input.required<string>();
  readonly statBlock = output<string>();
  readonly toOrder = output<void>();

  protected readonly amount = signal<number | null>(null);
  protected readonly defeated = computed(() => isDefeated(this.instance()));
  protected readonly hpPercent = computed(() => {
    const m = this.instance();
    return Math.round((100 * m.hp) / m.hpMax);
  });

  protected readonly speed = computed(() => {
    const m = this.monster();
    return m ? this.labels.monsterSpeed(m) : '';
  });

  /** Vulnerabilities, resistances, immunities (damage; then conditions), only those it has. */
  protected readonly defences = computed(() => {
    const m = this.monster();
    if (!m) return [];
    const lang = this.i18n.language();
    const list = (domain: 'damage' | 'condition', xs: string[]) =>
      xs.map((x) => term(lang, domain, x)).join(', ');
    return [
      { key: 'monster.vulnerabilities', value: list('damage', m.vulnerabilities) },
      { key: 'monster.resistances', value: list('damage', m.resistances) },
      {
        key: 'monster.immunities',
        value: [list('damage', m.immunities), list('condition', m.conditionImmunities)]
          .filter(Boolean)
          .join('; '),
      },
    ]
      .filter((d) => d.value)
      .map((d) => ({ ...d, value: capitalise(d.value) }));
  });

  protected signed(n: number): string {
    return n < 0 ? `−${-n}` : `+${n}`;
  }

  protected num(e: Event): number | null {
    const v = (e.target as HTMLInputElement).value.trim();
    return v === '' || !Number.isFinite(+v) ? null : Math.max(0, Math.floor(+v));
  }

  private change(f: (m: CombatMonster) => CombatMonster): void {
    const id = this.instance().id;
    this.store.update((s) => updateMonster(s, id, f));
    this.amount.set(null);
  }

  protected damage(): void {
    const a = this.amount();
    if (a) this.change((m) => applyDamage(m, a));
  }

  protected heal(): void {
    const a = this.amount();
    if (a) this.change((m) => applyHealing(m, a));
  }

  protected temp(): void {
    const a = this.amount();
    if (a !== null) this.change((m) => setTemp(m, a));
  }
}
