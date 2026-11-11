import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { SUMMARY_STEPS, WizardSummary } from '../../core/creation/wizard-summary';
import { StepState } from '../../core/creation/wizard-steps';
import { DataNamePipe, DataTextService } from '../../core/i18n/data-text.service';
import { TermPipe, TermDomain, term } from '../../core/i18n/glossary';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { Attack } from '../../core/rules/attacks';
import { Sheet } from '../../core/rules/sheet';
import { ABILITIES } from '../../core/rules/tables';
import { ClassThemeDirective } from '../theme/class-theme.directive';
import { useWizardTexts } from './wizard-texts';

type Section = keyof typeof SUMMARY_STEPS;

/**
 * The character as it stands while it's being created: name, classes, species and background, hit
 * points (with where they come from), AC, abilities, proficiencies, attacks, spells, feats and
 * equipment. What isn't decided yet says so, and a tap goes to the step where it is decided.
 * `full`: the last step's version (everything open, every attack and feature). Otherwise a panel:
 * folded to one line on phones and tablets, a side column on wide screens.
 */
@Component({
  selector: 'app-wizard-summary',
  imports: [NgTemplateOutlet, TranslatePipe, DataNamePipe, TermPipe, ClassThemeDirective],
  templateUrl: './wizard-summary.html',
  styleUrl: './wizard-summary.scss',
})
export class WizardSummaryPanel {
  readonly sheet = input.required<Sheet>();
  readonly character = input.required<Character>();
  readonly summary = input.required<WizardSummary>();
  /** State of each step of the wizard (by id), to mark what's pending. */
  readonly states = input<Readonly<Record<string, StepState>>>({});
  readonly stepLabels = input<Readonly<Record<string, string>>>({});
  readonly attacks = input<readonly Attack[]>([]);
  readonly full = input(false, { transform: booleanAttribute });
  readonly go = output<string>();

  private readonly i18n: I18nService = useWizardTexts();
  private readonly dataText = inject(DataTextService);
  protected readonly abilities = ABILITIES;
  /** Phones and tablets: the panel unfolded. */
  protected readonly open = signal(false);

  protected readonly hp = computed(() => {
    const h = this.sheet().hitPoints;
    const dice = h.levels.reduce((n, r) => n + r.gained, 0);
    const con = h.levels.reduce((n, r) => n + (r.total - r.gained), 0);
    return { max: h.max, dice, con, other: h.bonus };
  });

  protected readonly speed = computed(() => this.sheet().speed['walk'] ?? 0);

  /** The first step of a section that still has something to choose (null = nothing pending). */
  protected pending(section: Section): string | null {
    const states = this.states();
    return SUMMARY_STEPS[section].find((s) => states[s] === 'todo') ?? null;
  }

  protected goLabel(step: string): string {
    return this.i18n.t('wizard.summary.goTo' as never, { step: this.stepLabels()[step] ?? step });
  }

  /** A class of the character by its id, by the name shown. */
  protected className(id: string): string {
    const k = this.sheet().classes.find((x) => x.id === id);
    return this.dataText.shortName(k?.name ?? id);
  }

  protected signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  protected terms(values: readonly string[], domain: TermDomain): string {
    return values.map((v) => term(this.i18n.language(), domain, v)).join(', ');
  }
}
