import { Component, computed, input, output, signal } from '@angular/core';

import { StepState } from '../../core/creation/wizard-steps';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { useWizardTexts } from './wizard-texts';

/** Something still to do in the step, as the footer lists it (a tap goes to solve it). */
export interface FooterNote {
  text: string;
  issue: boolean;
  /** Anything the page needs to find what to show (a step and an anchor). */
  target?: unknown;
}

/**
 * The bar at the bottom of a step-by-step flow, always within reach of the thumb: Back, the state
 * of the step (a tap lists what's still missing, each item goes to it) and Next (with the name of
 * the next step; "Saltar" on an optional step left empty) or the final action on the last step.
 * Next is never locked: the wizard lets you go on and come back (a character can be saved
 * unfinished), so instead of a disabled button it says what is missing. `nextDisabled` exists
 * for flows that can't go on at all (level up without a class), with its reason.
 */
@Component({
  selector: 'app-wizard-footer',
  imports: [TranslatePipe],
  templateUrl: './wizard-footer.html',
  styleUrl: './wizard-footer.scss',
})
export class WizardFooter {
  readonly canBack = input(true);
  readonly state = input<StepState>('done');
  readonly notes = input<readonly FooterNote[]>([]);
  /** Label of the next step (none on the last one). */
  readonly nextStep = input<string | null>(null);
  /** Last step: the main action ("Crear personaje", "Guardar cambios"...). */
  readonly finalLabel = input<string | null>(null);
  readonly busy = input(false);
  readonly nextDisabled = input(false);
  /** Why Next can't be pressed (shown next to it). */
  readonly blockedReason = input('');
  readonly back = output<void>();
  readonly next = output<void>();
  readonly finish = output<void>();
  readonly note = output<FooterNote>();

  private readonly i18n = useWizardTexts();
  protected readonly listOpen = signal(false);
  protected readonly missing = computed(() => this.notes().filter((n) => !n.issue).length);
  protected readonly issues = computed(() => this.notes().filter((n) => n.issue).length);

  protected readonly status = computed(() => {
    const s = this.state();
    if (this.missing()) return this.i18n.t('wizard.toChoose' as never, { n: this.missing() });
    if (this.issues()) return this.i18n.t('wizard.warnings' as never, { n: this.issues() });
    return this.i18n.t((s === 'optional' ? 'wizard.state.optional' : 'wizard.ready') as never);
  });

  protected toggle(): void {
    if (this.notes().length) this.listOpen.update((v) => !v);
  }

  protected pick(n: FooterNote): void {
    this.listOpen.set(false);
    this.note.emit(n);
  }
}
