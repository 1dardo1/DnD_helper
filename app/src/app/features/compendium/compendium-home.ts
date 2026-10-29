import { Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { ENTRY_TYPES } from '../../core/models/compendium';
import { LoadError } from './load-error';

@Component({
  selector: 'app-compendium-home',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, LoadError],
  template: `
    <h1>{{ 'compendium.title' | t }}</h1>
    <p>{{ 'compendium.intro' | t }}</p>

    @if (meta.isLoading()) {
      <p>{{ 'common.loading' | t }}</p>
    } @else if (meta.error()) {
      <app-load-error [error]="meta.error()" />
    } @else if (meta.value(); as m) {
      <ul class="sections">
        @for (type of types; track type) {
          <li>
            <a [routerLink]="['/compendium', type]">{{ 'type.' + type | t }}</a>
            <small>{{ 'compendium.entries' | t: { count: m.counts[type] ?? 0 } }}</small>
          </li>
        }
      </ul>
      <p>
        <small>{{ 'compendium.dataVersion' | t: { date: m.generatedAt | localDate } }}</small>
        @if (compendium.offline()) {
          <small> · offline</small>
        }
      </p>
    }
  `,
  styles: `
    .sections {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 0.5rem;
    }
    .sections li {
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      border: 1px solid #ccc;
    }
  `,
})
export class CompendiumHome {
  protected readonly compendium = inject(CompendiumService);
  protected readonly types = ENTRY_TYPES;
  protected readonly meta = resource({ loader: () => this.compendium.getMeta() });
}
