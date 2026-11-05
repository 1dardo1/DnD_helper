import { Component, booleanAttribute, inject, input, output, signal } from '@angular/core';

import { SheetPdfService } from '../../core/export/sheet-pdf.service';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';

/** "Export as PDF" button of the character sheet (also "Share" where files can be shared). */
@Component({
  selector: 'app-export-pdf-button',
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      class="btn"
      [attr.role]="menuItem() ? 'menuitem' : null"
      [disabled]="busy()"
      (click)="run()"
    >
      {{ (busy() ? 'pdf.working' : 'pdf.button') | t }}
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class ExportPdfButton {
  readonly character = input.required<Character>();
  /** Inside the sheet's actions menu: a menu item. */
  readonly menuItem = input(false, { transform: booleanAttribute });
  /** The export finished (the menu can close). */
  readonly done = output<void>();
  private readonly pdf = inject(SheetPdfService);
  private readonly i18n = inject(I18nService);
  protected readonly busy = signal(false);

  /** A download on the web; in the Android app, the share sheet. */
  protected async run(): Promise<void> {
    this.busy.set(true);
    try {
      await this.pdf.export(this.character());
    } catch (e) {
      alert(this.i18n.t('common.error', { message: (e as Error).message }));
    } finally {
      this.busy.set(false);
      this.done.emit();
    }
  }
}
