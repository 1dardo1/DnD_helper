import { Component, computed, inject, input, output, signal } from '@angular/core';

import { DataNamePipe } from '../../core/i18n/data-text.service';
import { TermPipe } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import {
  PlayResource,
  PlayState,
  applyDamage,
  averageHitDie,
  currentHp,
  heal,
  longRest,
  playResources,
  setDeathSaves,
  setHeroicInspiration,
  setHitDiceSpent,
  setHp,
  setPactSpent,
  setResourceUsed,
  setSpentSlots,
  setTempHp,
  shortRest,
  spendHitDie,
  tapPip,
} from '../../core/play/play-state';
import {
  CONDITIONS,
  Condition,
  MAX_EXHAUSTION,
  exhaustionEffects,
  setExhaustion,
  toggleCondition,
} from '../../core/play/conditions';
import { swapsAfterLongRest } from '../../core/play/spell-swap';
import { Sheet } from '../../core/rules/sheet';

/** Up to this many uses are shown as pips; more (Focus Points, Sorcery Points) as a counter. */
const MAX_PIPS = 10;

/**
 * "In play" panel of the character sheet: hit points, slots, resources, Hit Dice, death saves
 * and rests. It only computes the new state; the sheet saves it.
 */
@Component({
  selector: 'app-play-panel',
  imports: [TranslatePipe, TermPipe, DataNamePipe],
  templateUrl: './play-panel.html',
  styleUrl: './play-panel.scss',
})
export class PlayPanel {
  readonly sheet = input.required<Sheet>();
  readonly state = input.required<PlayState>();
  readonly changed = output<PlayState>();
  private readonly i18n = inject(I18nService);

  protected readonly maxPips = MAX_PIPS;
  protected readonly tapPip = tapPip;
  protected readonly conditions = CONDITIONS;
  protected readonly maxExhaustion = MAX_EXHAUSTION;
  protected readonly deathKinds = ['successes', 'failures'] as const;
  /** What's typed in the hit points box. */
  protected readonly amount = signal<number | null>(null);
  /** Rolls typed for each Hit Die size. */
  protected readonly rolls = signal<Record<number, number | null>>({});

  protected readonly maxHp = computed(() => this.sheet().hitPoints.max);
  protected readonly hp = computed(() => currentHp(this.state(), this.maxHp()));
  protected readonly resources = computed(() => playResources(this.sheet()));
  protected readonly exhaustion = computed(() => exhaustionEffects(this.state().exhaustion));
  /** Shown next to the folded "Conditions": active conditions plus Exhaustion, if any. */
  protected readonly conditionCount = computed(
    () => this.state().conditions.length + (this.state().exhaustion ? 1 : 0),
  );
  protected readonly activeConditions = computed(() =>
    CONDITIONS.filter((c) => this.state().conditions.includes(c)),
  );
  protected readonly slots = computed(() =>
    this.sheet()
      .spellcasting.slots.map((max, i) => ({
        level: i + 1,
        max,
        spent: Math.min(this.state().spentSlots[i] ?? 0, max),
      }))
      .filter((s) => s.max > 0),
  );
  protected readonly conModifier = computed(() => this.sheet().abilities.CON.modifier);
  protected readonly hitDice = computed(() =>
    this.sheet().hitPoints.hitDice.map((d) => ({
      ...d,
      spent: Math.min(this.state().hitDiceSpent[`d${d.die}`] ?? 0, d.count),
      average: averageHitDie(d.die),
    })),
  );

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected usedOf(r: PlayResource): number {
    return Math.min(this.state().resources[r.key] ?? 0, r.max);
  }

  protected className(id: string): string | null {
    const classes = this.sheet().classes;
    return classes.length > 1 ? (classes.find((c) => c.id === id)?.name ?? id) : null;
  }

  // -- hit points --

  protected damage(): void {
    this.applyAmount((s, n) => applyDamage(s, n, this.maxHp()));
  }

  protected heal(): void {
    this.applyAmount((s, n) => heal(s, n, this.maxHp()));
  }

  protected setHp(): void {
    this.applyAmount((s, n) => setHp(s, n, this.maxHp()), true);
  }

  protected setTemp(): void {
    this.applyAmount((s, n) => setTempHp(s, n), true);
  }

  private applyAmount(change: (s: PlayState, n: number) => PlayState, zeroOk = false): void {
    const n = this.amount();
    if (n === null || !Number.isFinite(n) || n < 0 || (n === 0 && !zeroOk)) return;
    this.amount.set(null);
    this.emit(change(this.state(), n));
  }

  // -- spending --

  protected tapSlot(level: number, max: number, spent: number, index: number): void {
    this.emit(setSpentSlots(this.state(), level, tapPip(spent, index), max));
  }

  protected tapPact(max: number, index: number): void {
    this.emit(setPactSpent(this.state(), tapPip(this.state().pactSlotsSpent, index), max));
  }

  protected toNumber(e: Event): number {
    return Number((e.target as HTMLInputElement).value) || 0;
  }

  protected setUsed(r: PlayResource, used: number): void {
    this.emit(setResourceUsed(this.state(), r.key, used, r.max));
  }

  protected setHitDiceSpent(d: { die: number; count: number }, spent: number): void {
    this.emit(setHitDiceSpent(this.state(), `d${d.die}`, spent, d.count));
  }

  protected setRoll(die: number, value: number | null): void {
    this.rolls.update((r) => ({ ...r, [die]: value }));
  }

  /** roll: the typed one, or the average when not given. */
  protected spendHitDie(d: { die: number; count: number }, roll?: number | null): void {
    const value = roll ?? averageHitDie(d.die);
    if (!(value >= 1 && value <= d.die)) return;
    this.setRoll(d.die, null);
    this.emit(spendHitDie(this.state(), d, value, this.conModifier(), this.maxHp()));
  }

  protected tapDeathSave(kind: 'successes' | 'failures', index: number): void {
    const saves = { ...this.state().deathSaves };
    saves[kind] = tapPip(saves[kind], index);
    this.emit(setDeathSaves(this.state(), saves.successes, saves.failures));
  }

  protected toggleInspiration(on: boolean): void {
    this.emit(setHeroicInspiration(this.state(), on));
  }

  protected toggleCondition(id: Condition): void {
    this.emit(toggleCondition(this.state(), id));
  }

  protected setExhaustion(level: number): void {
    this.emit(setExhaustion(this.state(), level));
  }

  // -- rests --

  protected shortRest(): void {
    if (!confirm(this.i18n.t('play.confirmShort'))) return;
    this.emit(shortRest(this.state(), this.resources()));
  }

  protected longRest(): void {
    if (!confirm(this.i18n.t('play.confirmLong'))) return;
    this.emit({ ...longRest(this.state()), spellSwap: swapsAfterLongRest(this.sheet()) });
  }

  private emit(next: PlayState): void {
    if (next !== this.state()) this.changed.emit(next);
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  /** Reads a number input; empty → null. */
  protected num(event: Event): number | null {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? value : null;
  }
}
