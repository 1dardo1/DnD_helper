import { Component, DestroyRef, computed, inject, input, output, resource } from '@angular/core';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataTextService } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { concentrationDc, dropConcentration } from '../../core/play/concentration';
import { PlayState } from '../../core/play/play-state';
import { ConcentrationNotices } from './concentration-notice';

/**
 * The spell the character is concentrating on, with a button to drop it, and (in the sticky bar)
 * the line that reminds of the Constitution save after damage or says why it ended.
 */
@Component({
  selector: 'app-concentration-chip',
  imports: [TranslatePipe],
  template: `
    @if (notices() && notice(); as n) {
      <div class="notice" role="status" [attr.data-kind]="n.kind" data-testid="conc-notice">
        <p>
          @switch (n.kind) {
            @case ('check') {
              {{
                'sheetx.conc.check'
                  | t: { spell: nameOf(n.spellId), dc: dc(n.damage), damage: n.damage }
              }}
            }
            @case ('lost') {
              {{ 'sheetx.conc.lost.' + n.reason | t: { spell: nameOf(n.spellId) } }}
            }
            @case ('replaced') {
              {{ 'sheetx.conc.replaced' | t: { old: nameOf(n.oldId), new: nameOf(n.newId) } }}
            }
          }
        </p>
        <span class="acts">
          @if (n.kind === 'check') {
            <button type="button" class="ok" (click)="passed()">
              {{ 'sheetx.conc.passed' | t }}
            </button>
            <button type="button" class="bad" (click)="failed()">
              {{ 'sheetx.conc.failed' | t }}
            </button>
          } @else {
            <button type="button" class="btn-ghost" (click)="close()">
              {{ 'sheetx.conc.close' | t }}
            </button>
          }
        </span>
      </div>
    }
    @if (conc(); as c) {
      <div class="chip" role="group" [attr.aria-label]="'sheetx.conc.title' | t">
        <span class="lbl">{{ 'sheetx.conc.title' | t }}</span>
        <strong class="nm">{{ nameOf(c.spellId) }}</strong>
        <button type="button" class="drop" (click)="drop()">{{ 'sheetx.conc.drop' | t }}</button>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .chip {
      display: flex;
      margin-top: 0.3rem;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
      padding: 0.1rem 0.2rem 0.1rem 0.6rem;
      font-size: var(--fs-sm);
      color: var(--ink);
      background: var(--card);
      border: 1px solid var(--accent);
      border-radius: 999px;
    }

    .lbl {
      flex: none;
      color: var(--ink-soft);
      font-size: var(--fs-xs);
    }

    .nm {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .drop {
      flex: none;
      margin-left: auto;
      min-height: 1.75rem;
      padding: 0.05rem 0.6rem;
      font-size: var(--fs-xs);
      border-radius: 999px;
    }

    .notice {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.5rem;
      margin-bottom: 0.3rem;
      padding: 0.3rem 0.5rem;
      font-size: var(--fs-sm);
      background: var(--card);
      border: 1px solid var(--accent);
      border-left-width: 4px;
      border-radius: var(--radius-sm);

      &[data-kind='check'],
      &[data-kind='lost'] {
        border-color: var(--danger);
      }

      p {
        flex: 1 1 14rem;
        margin: 0;
      }
    }

    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;

      button {
        min-height: 2.25rem;
        padding: 0.1rem 0.7rem;
        font-size: var(--fs-sm);
      }
    }
  `,
})
export class ConcentrationChip {
  readonly state = input.required<PlayState>();
  /** The sticky bar shows the notices; the combat strip only the chip. */
  readonly notices = input(false);
  readonly changed = output<PlayState>();

  private readonly service = inject(ConcentrationNotices);
  private readonly dataText = inject(DataTextService);
  private readonly compendium = inject(CompendiumService);
  private readonly spells = resource({
    loader: async () => new Map((await this.compendium.all('spell')).map((s) => [s.id, s])),
  });

  protected readonly conc = computed(() => this.state().concentration ?? null);
  /** A save reminder only makes sense while still concentrating. */
  protected readonly notice = computed(() => {
    const n = this.service.notice();
    return n?.kind === 'check' && !this.conc() ? null : n;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.notices()) this.service.clear();
    });
  }

  protected nameOf(id: string): string {
    const s = this.spells.value()?.get(id);
    return s ? this.dataText.shortName(s.name) : id;
  }

  protected dc = concentrationDc;

  protected drop(): void {
    this.changed.emit(dropConcentration(this.state()));
  }

  protected passed(): void {
    this.service.clear();
  }

  protected failed(): void {
    this.service.clear();
    this.changed.emit(dropConcentration(this.state()));
  }

  protected close(): void {
    this.service.clear();
  }
}
