import { Component, input, output } from '@angular/core';

import { DataTextPipe } from '../../core/i18n/data-text.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Spell } from '../../core/models/compendium';
import { SheetFeatureChoice } from '../../core/rules/sheet';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { TraitPicks } from '../../shared/trait-picks';

/**
 * What a class or subclass feature lets the player choose, under the feature on the sheet: one of
 * its options (Divine Order: Protector or Thaumaturge; Hunter's Prey...) and the picks inside it
 * (a skill, a damage type, a cantrip). It only reports the change; the sheet stores it in
 * `choices.traitChoices` / `choices.traitPicks` and computes the sheet again.
 */
@Component({
  selector: 'app-feature-choice',
  imports: [TranslatePipe, MarkdownPipe, DataTextPipe, TraitPicks],
  template: `
    @let c = choice();
    @if (c.options?.length) {
      <fieldset class="options" [attr.data-testid]="'feature-choice-' + c.key">
        <legend>
          {{ 'sheetx.featureChoice.pick' | t }}
          @if (!c.chosen) {
            <strong class="missing">{{ 'sheetx.featureChoice.missing' | t }}</strong>
          }
        </legend>
        @if (c.optionRest) {
          <p class="hint">{{ 'sheetx.featureChoice.rest.' + c.optionRest | t }}</p>
        }
        @for (o of c.options; track o.name) {
          <label class="opt">
            <input
              type="radio"
              [name]="c.key"
              [checked]="c.chosen === o.name"
              (change)="chose.emit({ key: c.key, option: o.name })"
            />
            <span>
              <strong>{{ o.name | dataText }}</strong>
              <span class="md" [innerHTML]="o.text | dataText | markdown"></span>
            </span>
          </label>
        }
      </fieldset>
    }
    @for (p of c.picks; track p.key) {
      <app-trait-picks
        [pick]="p"
        [spells]="spells()"
        [level]="level()"
        [compact]="true"
        (changed)="picked.emit({ key: p.key, values: $event })"
      />
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .options {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border: 1px dashed var(--line);
      border-radius: var(--radius-md);
    }
    legend {
      font-weight: 700;
    }
    .missing {
      margin-left: var(--space-2);
      color: var(--danger);
    }
    .hint {
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--ink-soft);
    }
    .opt {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-2);
      align-items: start;
    }
    .opt .md {
      display: block;
      font-size: var(--fs-sm);
    }
  `,
})
export class FeatureChoice {
  readonly choice = input.required<SheetFeatureChoice>();
  readonly spells = input<readonly Spell[]>([]);
  readonly level = input(1);
  readonly chose = output<{ key: string; option: string }>();
  readonly picked = output<{ key: string; values: string[] }>();
}
