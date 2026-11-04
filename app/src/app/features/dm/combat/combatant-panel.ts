import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  Combatant,
  applyDamage,
  applyHealing,
  concentrationDc,
  downState,
  moveCombatant,
  removeCombatant,
  setConditionRounds,
  setInitiative,
  setTemp,
  sortByInitiative,
  toggleCombatCondition,
  updateCombatant,
} from '../../../core/dm/combat';
import { CombatStore } from '../../../core/dm/combat-store.service';
import { TranslatePipe } from '../../../core/i18n/i18n.service';
import { CONDITIONS, Condition } from '../../../core/play/conditions';

/** HP, conditions, concentration, notes and order of one combatant. */
@Component({
  selector: 'app-combatant-panel',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './combatant-panel.html',
  styleUrl: './combatant-panel.scss',
})
export class CombatantPanel {
  private readonly store = inject(CombatStore);

  readonly combatant = input.required<Combatant>();
  readonly label = input.required<string>();
  readonly current = input(false);
  /** Show the monster's stat block. */
  readonly statBlock = output<string>();

  protected readonly conditions = CONDITIONS;
  protected readonly amount = signal<number | null>(null);
  /** After damage to someone concentrating: the DC of the save. */
  protected readonly concentrationCheck = signal<number | null>(null);
  protected readonly confirmRemove = signal(false);

  protected readonly down = computed(() => downState(this.combatant()));
  protected readonly active = computed(
    () => new Map(this.combatant().conditions.map((k) => [k.id, k.rounds])),
  );
  protected readonly hpPercent = computed(() => {
    const c = this.combatant();
    return c.hp === null || !c.hpMax ? 0 : Math.round((100 * c.hp) / c.hpMax);
  });

  protected num(e: Event): number | null {
    const v = (e.target as HTMLInputElement).value.trim();
    return v === '' || !Number.isFinite(+v) ? null : Math.floor(+v);
  }

  private change(f: (c: Combatant) => Combatant): void {
    const id = this.combatant().id;
    this.store.update((s) => {
      const c = s.combatants.find((x) => x.id === id);
      return c ? updateCombatant(s, id, f(c)) : s;
    });
  }

  protected damage(): void {
    const a = this.amount();
    if (!a || a <= 0) return;
    const c = this.combatant();
    this.change((x) => applyDamage(x, a));
    this.concentrationCheck.set(c.concentration && a > 0 ? concentrationDc(a) : null);
    this.amount.set(null);
  }

  protected heal(): void {
    const a = this.amount();
    if (!a || a <= 0) return;
    this.change((x) => applyHealing(x, a));
    this.concentrationCheck.set(null);
    this.amount.set(null);
  }

  protected temp(): void {
    const a = this.amount();
    if (a === null || a < 0) return;
    this.change((x) => setTemp(x, a));
    this.amount.set(null);
  }

  protected toggle(id: Condition): void {
    this.change((c) => toggleCombatCondition(c, id));
  }

  protected rounds(id: Condition, e: Event): void {
    const r = this.num(e);
    this.change((c) => setConditionRounds(c, id, r));
  }

  protected concentration(on: boolean): void {
    this.change((c) => ({ ...c, concentration: on }));
    if (!on) this.concentrationCheck.set(null);
  }

  protected notes(e: Event): void {
    const notes = (e.target as HTMLTextAreaElement).value;
    this.change((c) => ({ ...c, notes }));
  }

  protected initiative(e: Event): void {
    const v = this.num(e);
    const id = this.combatant().id;
    this.store.update((s) => setInitiative(s, id, v));
  }

  protected resort(): void {
    this.store.update(sortByInitiative);
  }

  protected move(step: -1 | 1): void {
    const id = this.combatant().id;
    this.store.update((s) => moveCombatant(s, id, step));
  }

  protected remove(): void {
    const id = this.combatant().id;
    this.store.update((s) => removeCombatant(s, id));
  }
}
