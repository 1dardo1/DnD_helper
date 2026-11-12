import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataNamePipe } from '../../core/i18n/data-text.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { STATES_TEXTS } from '../../core/i18n/states.es';
import { Character } from '../../core/models/character';
import { Monster } from '../../core/models/compendium';
import { assumeForm, switchState, usesLeftFor } from '../../core/play/active-play';
import { PlayState, playResources } from '../../core/play/play-state';
import { SheetActiveState } from '../../core/rules/active-states';
import { Sheet } from '../../core/rules/sheet';
import { WildShapeRules } from '../../core/rules/wild-shape';
import { crText } from '../../shared/picker/entry-facets';

/**
 * The states the character can switch on (core/rules/active-states.ts): Rage, Wild Shape, Hex,
 * Hunter's Mark, Innate Sorcery. A switch each, what it does while on (dimmed while off) and how
 * long it lasts; switching on spends the use its text asks for. It only computes the new play
 * state; the host saves it.
 */
@Component({
  selector: 'app-active-states-bar',
  imports: [RouterLink, TranslatePipe, DataNamePipe],
  templateUrl: './active-states-bar.html',
  styleUrl: './active-states-bar.scss',
})
export class ActiveStatesBar {
  readonly character = input.required<Character>();
  readonly sheet = input.required<Sheet>();
  /** The known Wild Shape forms the Druid may take now. */
  readonly forms = input<readonly Monster[]>([]);
  /** The form the Druid is in, if known. */
  readonly current = input<Monster | null>(null);
  readonly rules = input<WildShapeRules | null>(null);
  readonly changed = output<PlayState>();

  private readonly i18n = inject(I18nService);

  constructor() {
    this.i18n.extend(STATES_TEXTS);
    // the form picked in the list follows the known forms
    effect(() => {
      const forms = this.forms();
      if (!forms.some((f) => f.id === this.picked())) this.picked.set(forms[0]?.id ?? '');
    });
  }

  /** Wild Shape follows the character itself (the host's sheet may be from before the change). */
  protected readonly states = computed(() =>
    (this.sheet().combat.states ?? []).map((s) =>
      s.id === 'wildShape' ? { ...s, on: !!this.character().state.wildShape } : s,
    ),
  );
  private readonly resources = computed(() => playResources(this.sheet()));
  private readonly state = computed(() => this.character().state);
  protected readonly picked = signal('');

  protected left(s: SheetActiveState): number {
    return usesLeftFor(this.state(), s.id, this.resources());
  }

  protected switchLabel(s: SheetActiveState): string {
    const left = this.left(s);
    if (left === 0) return this.i18n.t('state.noUses' as never);
    const key = s.id === 'wildShape' ? 'ws.transformCost' : 'state.activateCost';
    return Number.isFinite(left)
      ? this.i18n.t(key as never, { left })
      : this.i18n.t((s.id === 'wildShape' ? 'ws.transform' : 'state.activate') as never);
  }

  protected set(s: SheetActiveState, on: boolean): void {
    this.emit(switchState(this.state(), this.sheet(), this.resources(), s.id, on));
  }

  protected transform(): void {
    const rules = this.rules();
    const id = this.picked();
    if (!rules || !id) return;
    this.emit(assumeForm(this.state(), this.resources(), id, rules));
  }

  protected pick(e: Event): void {
    this.picked.set((e.target as HTMLSelectElement).value);
  }

  private emit(next: PlayState): void {
    if (next !== this.state()) this.changed.emit(next);
  }

  /** What it does while on, with this character's numbers. */
  protected effects(s: SheetActiveState): string {
    const t = (key: string, p?: Record<string, string | number>) => this.i18n.t(key as never, p);
    const sheet = this.sheet();
    switch (s.id) {
      case 'rage':
        return t('state.fx.rage', { n: sheet.combat.rageDamage ?? 0 });
      case 'hex':
        return t('state.fx.hex');
      case 'huntersMark': {
        const note = sheet.combat.notes.find((n) => n.id === 'huntersMark');
        return t('state.fx.huntersMark', { die: String(note?.params?.['die'] ?? 'd6') });
      }
      case 'innateSorcery': {
        const dc = sheet.spellcasting.classes.find((c) => c.classId === 'sorcerer')?.saveDc ?? 0;
        return t('state.fx.innateSorcery', { dc: s.on && !s.ended ? dc : dc + 1 });
      }
      case 'wildShape': {
        const r = this.rules();
        if (!r) return '';
        return t('ws.rules', {
          known: r.known,
          cr: crText(r.maxCr),
          fly: t(r.fly ? 'ws.fly.yes' : 'ws.fly.no'),
          hours: r.hours,
          thp: r.tempHp,
        });
      }
    }
  }

  protected duration(s: SheetActiveState): string {
    const t = (key: string) => this.i18n.t(key as never);
    switch (s.id) {
      case 'rage':
        return t(
          this.sheet().features.some((f) => f.name === 'Persistent Rage')
            ? 'state.dur.ragePersistent'
            : 'state.dur.rage',
        );
      case 'hex':
      case 'huntersMark':
        return t('state.dur.concentration');
      case 'innateSorcery':
        return t('state.dur.innateSorcery');
      case 'wildShape':
        return '';
    }
  }
}
