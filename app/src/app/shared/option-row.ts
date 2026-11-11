import { Component, computed, inject, input, output, signal } from '@angular/core';

import { DataNamePipe, DataTextPipe, DataTextService } from '../core/i18n/data-text.service';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { ClassOption } from '../core/models/compendium';
import { MarkdownPipe } from './markdown.pipe';

/** First sentence of a markdown text, without the markup, cut to `max` characters. */
export function optionSummary(markdown: string, max = 110): string {
  const plain = markdown
    .replace(/^#+\s.*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const first = /^.*?[.!?](?=\s|$)/.exec(plain)?.[0] ?? plain;
  return first.length <= max ? first : first.slice(0, max - 1).trimEnd() + '…';
}

/**
 * A class option (invocation, maneuver, plan...) as a row: checkbox, name, a one-line summary and
 * a "Ver más" toggle that unfolds the whole description. Shared by the wizard and the level-up.
 */
@Component({
  selector: 'app-option-row',
  imports: [DataNamePipe, DataTextPipe, MarkdownPipe, TranslatePipe],
  template: `
    <div class="row" [class.issue]="issue()" [class.open]="open()">
      <label class="pick">
        <input
          type="checkbox"
          [checked]="checked()"
          [disabled]="disabled()"
          (change)="toggled.emit($any($event.target).checked)"
        />
        <span class="txt">
          <span class="nm">
            {{ option().name | dataName }}
            @for (b of badges(); track b) {
              <em class="badge">{{ b }}</em>
            }
          </span>
          @if (warning()) {
            <small class="warn">⚠ {{ warning() | dataText }}</small>
          } @else if (note()) {
            <small class="note">{{ note() | dataText }}</small>
          }
          @if (summary(); as s) {
            <small class="sum">{{ s }}</small>
          }
        </span>
      </label>
      <button type="button" class="more" [attr.aria-expanded]="open()" (click)="open.set(!open())">
        {{ (open() ? 'optdesc.less' : 'optdesc.more') | t }}
      </button>
      @if (open()) {
        <div class="md full" [innerHTML]="option().description | dataText | markdown"></div>
        <ng-content />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 1 1 100%;
      min-width: 0;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: start;
      gap: 0 var(--space-2);
      padding: var(--space-1) 0;
      border-bottom: 1px dashed var(--line);
    }
    .pick {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
      min-height: var(--tap, 44px);
      padding-block: 0.35rem;
      min-width: 0;
      cursor: pointer;
    }
    .pick input {
      flex: none;
      margin-top: 0.2rem;
    }
    /* the group is full: this one can't be picked until another is dropped */
    .pick:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .txt {
      display: grid;
      gap: 0.1rem;
      min-width: 0;
    }
    .nm {
      font-weight: 700;
      font-family: var(--font-note);
    }
    .badge {
      margin-left: 0.4rem;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 0.6rem;
      font-size: var(--fs-sm);
      font-style: normal;
      font-weight: 400;
      color: var(--ink-soft);
    }
    small {
      font-size: var(--fs-sm);
      color: var(--ink-soft);
      overflow-wrap: anywhere;
    }
    .warn {
      color: var(--danger, #8a2a1d);
    }
    .sum {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .open .sum {
      display: none;
    }
    .more {
      min-height: var(--tap, 44px);
      padding: 0 var(--space-2);
      background: none;
      border: 0;
      color: var(--accent);
      font: inherit;
      font-size: var(--fs-sm);
      text-decoration: underline;
      cursor: pointer;
      white-space: nowrap;
    }
    .full {
      grid-column: 1 / -1;
      padding: 0 0 var(--space-2) 1.6rem;
      font-size: var(--fs-sm);
      overflow-wrap: anywhere;
    }
  `,
})
export class OptionRow {
  readonly option = input.required<ClassOption>();
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly issue = input(false);
  /** Prerequisite not met ("⚠ ..."), in English as in the data. */
  readonly warning = input('');
  /** Part of the prerequisite the data can't check. */
  readonly note = input('');
  readonly badges = input<string[]>([]);
  readonly toggled = output<boolean>();

  protected readonly open = signal(false);
  private readonly text = inject(DataTextService);

  protected readonly summary = computed(() =>
    optionSummary(this.text.text(this.option().description)),
  );
}
