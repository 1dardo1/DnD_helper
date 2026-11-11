import { Component, computed, input, output, signal } from '@angular/core';

import { StepState } from '../../core/creation/wizard-steps';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { useWizardTexts } from './wizard-texts';

/** A step as the progress shows it: its label, its state and how many things it still needs. */
export interface ProgressStep {
  id: string;
  label: string;
  state: StepState;
  /** Things still to choose in it (shown as "2 por elegir"). */
  missing?: number;
}

/**
 * Where you are in a step-by-step flow (creation wizard, level up). Phones: "Paso 3 de 9 · Especie",
 * a row of numbered dots (every one goes to its step) and a list of the steps with their state
 * under "Pasos". Wide screens: every step with its label and state. States: to do, done, with
 * warnings, optional.
 */
@Component({
  selector: 'app-wizard-progress',
  imports: [TranslatePipe],
  templateUrl: './wizard-progress.html',
  styleUrl: './wizard-progress.scss',
})
export class WizardProgress {
  readonly steps = input.required<readonly ProgressStep[]>();
  readonly current = input.required<string>();
  /** Accessible name of the list of steps. */
  readonly label = input('');
  readonly go = output<string>();

  private readonly i18n = useWizardTexts();
  /** Phones: the list of steps with their names unfolded. */
  protected readonly open = signal(false);
  protected readonly index = computed(() =>
    Math.max(
      0,
      this.steps().findIndex((s) => s.id === this.current()),
    ),
  );
  protected readonly doneCount = computed(
    () => this.steps().filter((s) => s.state === 'done' || s.state === 'warn').length,
  );

  protected stateText(s: ProgressStep): string {
    if (s.state === 'todo' && s.missing)
      return this.i18n.t('wizard.state.todoN' as never, { n: s.missing });
    return this.i18n.t(`wizard.state.${s.state}` as never);
  }

  protected pick(id: string): void {
    this.open.set(false);
    this.go.emit(id);
  }
}
