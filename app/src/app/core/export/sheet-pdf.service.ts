import { Injectable, inject } from '@angular/core';

import { BackupService, ExportOutcome } from '../characters/backup.service';
import { pdfFileName } from '../characters/backup';
import { CompendiumService } from '../compendium/compendium.service';
import { DataTextService } from '../i18n/data-text.service';
import { term } from '../i18n/glossary';
import { I18nService } from '../i18n/i18n.service';
import { Character } from '../models/character';
import { computeSheet } from '../rules/engine';
import { RulesDataService } from '../rules/rules-data.service';
import { buildSheetPdfInput } from './sheet-pdf-input';

/**
 * Makes the PDF of a character sheet in the language of the app and hands it over like the
 * backup files: a download, or the share sheet in the Android app. The drawing code (pdf-lib) is
 * loaded only when a PDF is asked for.
 */
@Injectable({ providedIn: 'root' })
export class SheetPdfService {
  private readonly rules = inject(RulesDataService);
  private readonly compendium = inject(CompendiumService);
  private readonly data = inject(DataTextService);
  private readonly i18n = inject(I18nService);
  private readonly backup = inject(BackupService);

  readonly native = this.backup.native;
  readonly canShare = this.backup.canShareFiles;

  async make(character: Character): Promise<Uint8Array> {
    const [rules, spells, { renderSheetPdf }] = await Promise.all([
      this.rules.load(),
      this.compendium.all('spell'),
      import('./sheet-pdf-render'),
    ]);
    const input = buildSheetPdfInput({
      character,
      sheet: computeSheet(character, rules),
      rules,
      spells,
      t: (key, params) => this.i18n.t(key, params),
      shortName: (e) => this.data.shortName(e),
      text: (e) => this.data.text(e),
      entry: (type, e) => this.data.entry(type, e),
      term: (domain, v) => term(this.i18n.language(), domain, v),
    });
    return renderSheetPdf(input);
  }

  async export(character: Character, share = false): Promise<ExportOutcome> {
    const bytes = await this.make(character);
    return this.backup.exportBinary(pdfFileName(character.name), bytes, 'application/pdf', share);
  }
}
