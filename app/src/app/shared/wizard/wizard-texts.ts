import { inject } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';
import { wizardEn } from '../../core/i18n/wizard.en';
import { wizardEs } from '../../core/i18n/wizard.es';

/** The wizard's own texts (core/i18n/wizard.*.ts), loaded with its chunk, not the app's first load. */
export const WIZARD_TEXTS = { en: wizardEn, es: wizardEs };

export type WizardTextKey = keyof typeof wizardEn;

/** Adds the wizard's texts to the translations; call it in the constructor of a component. */
export function useWizardTexts(): I18nService {
  const i18n = inject(I18nService);
  i18n.extend(WIZARD_TEXTS);
  return i18n;
}
