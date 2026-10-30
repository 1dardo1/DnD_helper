import { Component, computed, inject, input } from '@angular/core';

import { DataNamePipe } from '../../core/i18n/data-text.service';
import { Entry } from '../../core/models/compendium';
import { EntryLabels } from './entry-labels.service';

/**
 * The summary card of an entry of any type (name, a kicker line and a few facts). Only inline
 * content, so it can go inside a <button> (wizard pickers) or a link (compendium lists).
 */
@Component({
  selector: 'app-entry-card',
  imports: [DataNamePipe],
  template: `
    @let s = summary();
    <span class="head">
      <span class="name">{{ entry().name | dataName }}</span>
      @for (m of s.marks; track m.text) {
        <abbr class="mark" [title]="m.title">{{ m.text }}</abbr>
      }
      @if (entry().edition === '2014') {
        <span class="mark edition">2014</span>
      }
    </span>
    @if (s.kicker) {
      <span class="kicker">{{ s.kicker }}</span>
    }
    @for (f of s.facts; track f.label) {
      <span class="fact"
        ><span class="label">{{ f.label }}</span
        >{{ f.value }}</span
      >
    }
  `,
  styles: `
    @use './cards';

    :host {
      @include cards.text;
    }

    abbr {
      text-decoration: none;
    }
  `,
})
export class EntryCard {
  readonly entry = input.required<Entry>();
  private readonly labels = inject(EntryLabels);

  protected readonly summary = computed(() => this.labels.summary(this.entry()));
}
