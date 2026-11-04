import { Component, computed, inject, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { Encounter } from '../../core/dm/encounter';
import { EncounterStore } from '../../core/dm/encounter-store.service';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { RATING_KEY, encounterStats } from './encounter-stats';

/** The DM's saved encounters: open, create, duplicate, delete. */
@Component({
  selector: 'app-encounter-list',
  imports: [RouterLink, TranslatePipe, LocalDatePipe],
  template: `
    <a class="back-link" routerLink="/dm">← {{ 'dm.title' | t }}</a>
    <h1>{{ 'dm.encounters.title' | t }}</h1>
    <p>{{ 'encounters.intro' | t }}</p>
    <p>
      <button type="button" class="primary" (click)="create()">+ {{ 'encounters.new' | t }}</button>
    </p>

    <ul class="encounters">
      @for (e of store.all(); track e.id) {
        @let s = stats(e);
        <li>
          <a class="name" [routerLink]="['/dm/encounters', e.id]">{{
            e.name || ('encounters.unnamed' | t)
          }}</a>
          @if (s.rating !== 'none') {
            <span class="rating" [attr.data-rating]="s.rating">{{ ratingKey[s.rating] | t }}</span>
          }
          <span class="summary">
            {{ 'encounters.summary' | t: { characters: s.characters, creatures: s.creatures } }}
            @if (xpLoaded()) {
              · {{ 'encounter.xpValue' | t: { xp: num(s.xp) } }}
            }
          </span>
          <small>{{ e.updatedAt | localDate }}</small>
          <span class="actions">
            @if (e.monsters.length) {
              <a
                class="btn btn-primary"
                [routerLink]="['/dm/combat']"
                [queryParams]="{ encounter: e.id }"
                >{{ 'encounter.startCombat' | t }}</a
              >
            }
            <button type="button" class="btn-ghost" (click)="duplicate(e)">
              {{ 'encounters.duplicate' | t }}
            </button>
            <button type="button" class="danger" (click)="remove(e)">
              {{ 'encounters.delete' | t }}
            </button>
          </span>
        </li>
      } @empty {
        <li class="empty">{{ 'encounters.empty' | t }}</li>
      }
    </ul>
  `,
  styles: `
    .encounters {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }
    li {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      margin: 0;
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    li.empty {
      color: var(--ink-soft);
      font-style: italic;
    }
    li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .name {
      flex: 1 1 auto;
      min-width: 0;
      font-family: var(--font-title);
      font-size: var(--fs-xl);
      font-weight: 700;
      line-height: 1.15;
      color: var(--accent);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .name::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .name:focus-visible {
      outline: none;
    }
    .summary,
    small {
      flex: 1 1 100%;
    }
    small {
      color: var(--ink-soft);
    }
    .actions {
      position: relative;
      z-index: 1;
      display: flex;
      gap: var(--space-2);
      margin-left: auto;
    }
    .rating {
      position: relative;
      z-index: 1;
      padding: 0 0.6em;
      font-family: var(--font-title);
      font-size: var(--fs-sm);
      color: var(--rating, var(--ink-soft));
      border: 1px solid currentColor;
      border-radius: 0.8em;
    }
    [data-rating='low'] {
      --rating: var(--ok);
    }
    [data-rating='moderate'] {
      --rating: var(--warn);
    }
    [data-rating='high'],
    [data-rating='aboveHigh'] {
      --rating: var(--danger);
    }
    [data-rating='aboveHigh'] {
      font-weight: 700;
    }
  `,
})
export class EncounterList {
  protected readonly store = inject(EncounterStore);
  private readonly compendium = inject(CompendiumService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly ratingKey = RATING_KEY;

  private readonly monsters = resource({ loader: () => this.compendium.all('monster') });
  private readonly xpById = computed(
    () => new Map((this.monsters.value() ?? []).map((m) => [m.id, m.xp])),
  );
  protected readonly xpLoaded = computed(() => !!this.monsters.value());

  constructor() {
    void this.store.load();
  }

  protected stats(e: Encounter) {
    return encounterStats(e, this.xpById());
  }

  protected num(n: number): string {
    return n.toLocaleString(this.i18n.language());
  }

  protected async create(): Promise<void> {
    const e = await this.store.create(this.i18n.t('encounters.defaultName'));
    await this.router.navigate(['/dm/encounters', e.id]);
  }

  protected async duplicate(e: Encounter): Promise<void> {
    await this.store.duplicate(e.id, this.i18n.t('encounters.copyName', { name: e.name }));
  }

  protected async remove(e: Encounter): Promise<void> {
    if (!confirm(this.i18n.t('encounters.confirmDelete', { name: e.name }))) return;
    await this.store.remove(e.id);
  }
}
