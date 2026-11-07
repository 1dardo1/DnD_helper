import { Component, input, output } from '@angular/core';

import { MarkdownPipe } from './markdown.pipe';

/**
 * One of a trait's named options, as shown to the player (core/rules/trait-choices.ts). `value`
 * is what gets stored (the option's English name); `label`/`text` are what's shown for it.
 */
export interface TraitChoiceItem {
  value: string;
  label: string;
  text: string;
}

/**
 * A trait whose text embeds its own choice (a species lineage, a reprint's internal tribe/
 * creed...): one option per radio button, its own text unfolding when picked. Generic — any
 * trait with 2+ named options can use it, not only species ones.
 */
@Component({
  selector: 'app-trait-choice',
  imports: [MarkdownPipe],
  template: `
    <fieldset class="trait-choice" [attr.data-testid]="'trait-choice-' + key()">
      <legend>{{ legend() }}</legend>
      @for (o of options(); track o.value) {
        <label class="opt">
          <input
            type="radio"
            [name]="key()"
            [value]="o.value"
            [checked]="selected() === o.value"
            (change)="changed.emit(o.value)"
          />
          <span class="txt">
            <span class="nm">{{ o.label }}</span>
            @if (selected() === o.value) {
              <span class="md" [innerHTML]="o.text | markdown"></span>
            }
          </span>
        </label>
      }
    </fieldset>
  `,
  styles: `
    .trait-choice {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0.5rem 0;
    }
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .opt input {
      margin-top: 0.3rem;
    }
    .txt {
      display: flex;
      flex-direction: column;
    }
    .nm {
      font-weight: 600;
    }
  `,
})
export class TraitChoice {
  readonly key = input.required<string>();
  readonly legend = input.required<string>();
  readonly options = input.required<TraitChoiceItem[]>();
  readonly selected = input<string | null>(null);
  readonly changed = output<string>();
}
