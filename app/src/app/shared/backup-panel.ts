import { Component, inject, signal } from '@angular/core';

import {
  ConflictChoice,
  ImportItem,
  defaultChoice,
  planImport,
  resolveImport,
} from '../core/characters/backup';
import { BackupService } from '../core/characters/backup.service';
import { CharacterStore } from '../core/characters/character-store.service';
import { SyncService } from '../core/characters/sync.service';
import { CustomBackground } from '../core/homebrew/custom-background';
import { HomebrewStore } from '../core/homebrew/homebrew-store.service';
import {
  I18nService,
  LocalDatePipe,
  TranslatePipe,
  TranslationKey,
} from '../core/i18n/i18n.service';

/**
 * Backup buttons (character list and Settings): all the characters to a file, and import from
 * files, asking what to do with the characters that are already on this device.
 */
@Component({
  selector: 'app-backup-panel',
  imports: [TranslatePipe, LocalDatePipe],
  template: `
    <div class="buttons">
      <button type="button" class="btn" (click)="exportAll(false)">
        {{ (backup.native ? 'backup.exportAllNative' : 'backup.exportAll') | t }}
      </button>
      @if (backup.canShareFiles) {
        <button type="button" class="btn" (click)="exportAll(true)">
          {{ 'backup.share' | t }}
        </button>
      }
      <button type="button" class="btn" (click)="fileInput.click()">
        {{ 'backup.import' | t }}
      </button>
      <input
        #fileInput
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        (change)="read($event)"
        data-testid="backup-file"
      />
    </div>

    @if (review(); as items) {
      <section class="review" aria-labelledby="backup-review-title">
        <h3 id="backup-review-title">{{ 'backup.review.title' | t }}</h3>
        <ul>
          @for (item of items; track item.incoming.id) {
            <li [attr.data-kind]="item.kind">
              <strong>{{ item.incoming.name }}</strong>
              <span>{{ 'backup.kind.' + item.kind | t }}</span>
              @if (item.kind === 'conflict' && item.existing) {
                <small [class.newer]="item.newer === 'file'">
                  {{
                    'backup.inFile'
                      | t
                        : {
                            date: (item.incoming.updatedAt | localDate),
                            device: item.incoming.updatedBy,
                          }
                  }}
                  @if (item.newer === 'file') {
                    · {{ 'backup.newer' | t }}
                  }
                </small>
                <small [class.newer]="item.newer === 'device'">
                  {{
                    'backup.onDevice'
                      | t
                        : {
                            date: (item.existing.updatedAt | localDate),
                            device: item.existing.updatedBy,
                          }
                  }}
                  @if (item.newer === 'device') {
                    · {{ 'backup.newer' | t }}
                  }
                </small>
                <fieldset>
                  <legend class="visually-hidden">{{ item.incoming.name }}</legend>
                  @for (choice of choiceList; track choice) {
                    <label>
                      <input
                        type="radio"
                        [name]="'backup-choice-' + item.incoming.id"
                        [value]="choice"
                        [checked]="choiceOf(item) === choice"
                        (change)="choose(item, choice)"
                      />
                      {{ 'backup.choice.' + choice | t }}
                    </label>
                  }
                </fieldset>
              }
            </li>
          }
        </ul>
        <div class="buttons">
          <button type="button" class="btn btn-primary" (click)="apply()">
            {{ 'backup.confirm' | t }}
          </button>
          <button type="button" class="btn" (click)="cancel()">{{ 'backup.cancel' | t }}</button>
        </div>
      </section>
    }

    @for (line of messages(); track $index) {
      <p role="status">{{ line }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .review {
      padding: var(--space-3) var(--space-4);
      background-color: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
    }
    .review h3 {
      margin-top: 0;
    }
    .review ul {
      display: grid;
      gap: var(--space-3);
      padding: 0;
      list-style: none;
    }
    .review li {
      display: grid;
      gap: 0.2rem;
    }
    .review li[data-kind='conflict'] > span {
      color: var(--danger);
      font-weight: 700;
    }
    .review .newer {
      font-weight: 700;
    }
    .review fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
      margin: 0.3rem 0 0;
      padding: 0;
      border: 0;
    }
    .review label {
      display: inline-flex;
      gap: 0.35rem;
      align-items: center;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    [role='status'] {
      margin: 0;
      font-family: var(--font-note);
      font-weight: 700;
    }
  `,
})
export class BackupPanel {
  protected readonly backup = inject(BackupService);
  private readonly store = inject(CharacterStore);
  private readonly sync = inject(SyncService);
  private readonly homebrew = inject(HomebrewStore);
  private readonly i18n = inject(I18nService);

  protected readonly choiceList: ConflictChoice[] = ['replace', 'both', 'skip'];
  /** What the selected files would do, waiting for confirmation (null: nothing to review). */
  protected readonly review = signal<ImportItem[] | null>(null);
  private readonly choices = signal<Record<string, ConflictChoice>>({});
  /** Problems with the files read, shown with the summary. */
  private fileProblems: string[] = [];
  private invalid = 0;
  /** Custom backgrounds imported from the files read (shown with the summary). */
  private backgroundsLine = '';
  protected readonly messages = signal<string[]>([]);

  protected async exportAll(share: boolean): Promise<void> {
    this.messages.set([]);
    try {
      const outcome = await this.backup.exportAll(share);
      if (outcome === null) this.messages.set([this.i18n.t('backup.nothingToExport')]);
      else if (outcome !== 'cancelled') this.messages.set([this.i18n.t('backup.exported')]);
    } catch (e) {
      this.messages.set([this.i18n.t('common.error', { message: (e as Error).message })]);
    }
  }

  protected async read(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = ''; // the same file can be chosen again
    if (!files.length) return;
    this.messages.set([]);
    const read = await this.backup.readFiles(files);
    const errorKey: Record<string, TranslationKey> = {
      'not-json': 'backup.error.notJson',
      'unknown-format': 'backup.error.unknownFormat',
      'newer-version': 'backup.error.newerVersion',
    };
    this.fileProblems = read
      .filter((f) => f.error)
      .map((f) => this.i18n.t(errorKey[f.error!], { file: f.fileName }));
    this.invalid = read.reduce((n, f) => n + f.invalid, 0);
    await this.importBackgrounds(read.flatMap((f) => f.backgrounds));
    await this.store.load();
    const items = planImport(
      read.flatMap((f) => f.characters),
      this.store.all().map((r) => r.character),
    );
    this.choices.set({});
    if (items.some((i) => i.kind === 'conflict')) {
      this.review.set(items);
      // the review is below the list: bring it into view
      setTimeout(() =>
        document.getElementById('backup-review-title')?.scrollIntoView({ block: 'start' }),
      );
    } else {
      await this.finish(items);
    }
  }

  protected choiceOf(item: ImportItem): ConflictChoice {
    return this.choices()[item.incoming.id] ?? defaultChoice(item);
  }

  protected choose(item: ImportItem, choice: ConflictChoice): void {
    this.choices.update((c) => ({ ...c, [item.incoming.id]: choice }));
  }

  protected async apply(): Promise<void> {
    const items = this.review();
    if (!items) return;
    this.review.set(null);
    await this.finish(items);
  }

  protected cancel(): void {
    this.review.set(null);
    this.messages.set([this.i18n.t('backup.cancelled')]);
  }

  private async finish(items: ImportItem[]): Promise<void> {
    const result = resolveImport(items, this.choices(), this.i18n.t('conflict.copySuffix'));
    if (result.toWrite.length) {
      await this.store.importCharacters(result.toWrite);
      void this.sync.sync();
    }
    const imported = result.imported + result.replaced + result.copies;
    const parts = [
      this.count('imported', imported),
      result.skipped ? this.count('skipped', result.skipped) : '',
      this.invalid ? this.count('invalid', this.invalid) : '',
    ].filter(Boolean);
    this.messages.set(
      [
        ...this.fileProblems,
        items.length || this.invalid
          ? parts.join(', ') + '.'
          : this.backgroundsLine
            ? ''
            : this.i18n.t('backup.nothing'),
        this.backgroundsLine,
      ].filter(Boolean),
    );
  }

  private async importBackgrounds(list: CustomBackground[]): Promise<void> {
    this.backgroundsLine = '';
    if (!list.length) return;
    const plan = await this.homebrew.importBackgrounds(list);
    const n = plan.added + plan.updated;
    if (n) void this.sync.sync();
    this.backgroundsLine = this.i18n.t('homebrew.backup.imported', {
      count: n,
      skipped: plan.skipped,
    });
  }

  private count(what: 'imported' | 'skipped' | 'invalid', n: number): string {
    const key = `backup.count.${what}.${n === 1 ? 'one' : 'other'}` as TranslationKey;
    return this.i18n.t(key, { count: n });
  }
}
