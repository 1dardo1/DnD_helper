import { Component, computed, inject, input } from '@angular/core';

import { DataNamePipe, DataTextPipe } from '../../core/i18n/data-text.service';
import { TermPipe, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { STATES_TEXTS } from '../../core/i18n/states.es';
import { Ability } from '../../core/models/compendium';
import { PlayState, currentHp } from '../../core/play/play-state';
import { Sheet } from '../../core/rules/sheet';
import { FormAttack, FormView } from '../../core/rules/wild-shape';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { crText } from '../../shared/picker/entry-facets';

const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/**
 * The character's sheet while in a Wild Shape form (core/rules/wild-shape.ts' formView): the
 * Beast's AC, Speeds, physical scores and attacks with the character's own Hit Points, mental
 * scores and proficiencies; what is kept and what changes, and what can be cast.
 */
@Component({
  selector: 'app-wild-shape-form',
  imports: [TranslatePipe, TermPipe, DataNamePipe, DataTextPipe, MarkdownPipe],
  templateUrl: './wild-shape-form.html',
  styleUrl: './wild-shape-form.scss',
})
export class WildShapeForm {
  readonly view = input.required<FormView>();
  readonly sheet = input.required<Sheet>();
  readonly state = input.required<PlayState>();

  private readonly i18n = inject(I18nService);

  constructor() {
    this.i18n.extend(STATES_TEXTS);
  }

  protected readonly abilities = ABILITIES;
  protected readonly hp = computed(() => currentHp(this.state(), this.sheet().hitPoints.max));
  protected readonly speeds = computed(() =>
    Object.entries(this.view().speed)
      .filter(([, v]) => typeof v === 'number')
      .map(([kind, value]) => ({ kind, value: value as number })),
  );
  protected readonly senses = computed(() =>
    Object.entries(this.view().monster.senses).map(([kind, range]) => ({ kind, range })),
  );
  protected readonly cr = computed(() => crText(this.view().monster.cr));
  protected readonly spellDc = computed(
    () => this.sheet().spellcasting.classes.find((c) => c.classId === 'druid')?.saveDc ?? 0,
  );

  protected dateOf(iso: string): string {
    return this.i18n.date(iso);
  }

  protected signed(n: number | null): string {
    if (n === null) return '';
    return n >= 0 ? `+${n}` : `${n}`;
  }

  /** "1d6+2 perforante + 1d4 veneno". */
  protected damage(a: FormAttack): string {
    const lang = this.i18n.language();
    const parts = a.damage ? [`${a.damage} ${term(lang, 'damage', a.type ?? '')}`] : [];
    for (const x of a.extra) parts.push(`${x.damage} ${term(lang, 'damage', x.type)}`);
    return parts.join(' + ');
  }

  protected terms(values: readonly string[], domain: 'damage' | 'condition'): string {
    return values.map((v) => term(this.i18n.language(), domain, v)).join(', ');
  }
}
