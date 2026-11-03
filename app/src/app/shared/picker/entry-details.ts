import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataNamePipe, DataTextPipe } from '../../core/i18n/data-text.service';
import { PhrasePipe } from '../../core/i18n/glossary';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { Background, Entry, Spell, Species } from '../../core/models/compendium';
import { MarkdownPipe } from '../markdown.pipe';
import { SpeciesPortrait } from './species-portrait';

/** The full text of an entry, shown when a picker card is expanded ("Ver más"). */
@Component({
  selector: 'app-entry-details',
  imports: [
    RouterLink,
    TranslatePipe,
    DataNamePipe,
    DataTextPipe,
    PhrasePipe,
    MarkdownPipe,
    SpeciesPortrait,
  ],
  template: `
    @let e = entry();
    @if (spell(); as s) {
      <p class="facts">
        <span
          ><em>{{ 'spell.castingTime' | t }}:</em> {{ s.castingTime.raw | phrase }}</span
        >
        <span
          ><em>{{ 'spell.range' | t }}:</em> {{ s.range | phrase }}</span
        >
        <span
          ><em>{{ 'spell.components' | t }}:</em> {{ components(s) }}</span
        >
        @if (s.components.material) {
          <small>({{ s.components.material | dataText }})</small>
        }
        <span
          ><em>{{ 'spell.duration' | t }}:</em> {{ s.duration | phrase }}</span
        >
      </p>
    }
    @if (species()) {
      <app-species-portrait class="full" [speciesId]="e.id" [alt]="e.name | dataName" />
    }
    <div class="md" [innerHTML]="e.description | dataText | markdown"></div>
    @if (spell()?.higherLevels; as h) {
      <h4>{{ 'spell.higherLevels' | t }}</h4>
      <div class="md" [innerHTML]="h | dataText | markdown"></div>
    }
    @if (species(); as sp) {
      @for (t of sp.traits; track t.name) {
        <h4>{{ t.name | dataName }}</h4>
        <div class="md" [innerHTML]="t.description | dataText | markdown"></div>
      }
    }
    @if (background()?.equipment; as eq) {
      <h4>{{ 'compendium.equipment' | t }}</h4>
      <p>{{ eq | dataText }}</p>
    }
    <p class="open">
      <a [routerLink]="['/compendium', e.type, e.id]">{{ 'picker.open' | t }}</a>
    </p>
  `,
  styles: `
    :host {
      display: block;
      font-size: var(--fs-sm);
    }

    .facts {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;

      em {
        color: var(--ink-soft);
      }
    }

    h4 {
      margin: var(--space-3) 0 var(--space-1);
      color: var(--accent);
    }

    .open {
      margin: var(--space-3) 0 0;
    }
  `,
})
export class EntryDetails {
  readonly entry = input.required<Entry>();

  protected readonly spell = computed(() =>
    this.entry().type === 'spell' ? (this.entry() as Spell) : null,
  );
  protected readonly species = computed(() =>
    this.entry().type === 'species' ? (this.entry() as Species) : null,
  );
  protected readonly background = computed(() =>
    this.entry().type === 'background' ? (this.entry() as Background) : null,
  );

  protected components(s: Spell): string {
    const c = s.components;
    return [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', ');
  }
}
