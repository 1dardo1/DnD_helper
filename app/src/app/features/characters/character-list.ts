import { Component, OnInit, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CharacterStore } from '../../core/characters/character-store.service';
import { SyncService } from '../../core/characters/sync.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { DataTextService } from '../../core/i18n/data-text.service';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { Character } from '../../core/models/character';
import { BackupPanel } from '../../shared/backup-panel';
import { ClassThemeDirective } from '../../shared/theme/class-theme.directive';

/** Characters on this device (plus any new ones in the repo), with their cloud status. */
@Component({
  selector: 'app-character-list',
  imports: [RouterLink, TranslatePipe, LocalDatePipe, ClassThemeDirective, BackupPanel],
  template: `
    <h1>{{ 'characters.title' | t }}</h1>
    <p>
      <a class="btn btn-primary new" routerLink="/characters/new">+ {{ 'nav.create' | t }}</a>
    </p>

    @if (sync.lastError()) {
      <p role="alert">{{ 'common.error' | t: { message: sync.lastError() ?? '' } }}</p>
    }

    <ul class="characters">
      @for (r of store.all(); track r.character.id) {
        <li
          [appClassTheme]="{
            classId: r.character.classes[0]?.id,
            subclassId: r.character.classes[0]?.subclassId,
          }"
        >
          <a [routerLink]="['/characters', r.character.id]"
            ><strong>{{ r.character.name }}</strong></a
          >
          @if (summary(r.character); as line) {
            <span class="summary">{{ line }}</span>
          }
          <span class="status" [attr.data-status]="r.status">{{
            'characters.status.' + r.status | t
          }}</span>
          @if (r.status === 'conflict') {
            <a [routerLink]="['/characters', r.character.id, 'conflict']">{{
              'conflict.resolve' | t
            }}</a>
          }
          <small>{{ r.character.updatedAt | localDate }} · {{ r.character.updatedBy }}</small>
        </li>
      } @empty {
        <li>{{ 'characters.empty' | t }}</li>
      }
    </ul>

    <section class="backup" aria-labelledby="backup-title">
      <h2 id="backup-title">{{ 'backup.title' | t }}</h2>
      <app-backup-panel />
    </section>
  `,
  styles: `
    .characters {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
      gap: var(--space-4);
      padding: 0;
      list-style: none;
    }
    .characters li {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-3);
      align-items: center;
      margin: 0;
      padding: 2.6rem var(--space-4) var(--space-3);
      background-color: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-1);
    }
    .characters li.class-theme::after {
      top: 1.5rem;
      width: 4.5rem;
    }
    .characters li > a:first-child {
      flex: 1 1 100%;
      font-family: var(--font-hand);
      font-size: var(--fs-2xl);
      line-height: 1.1;
      color: var(--accent);
      text-decoration: none;
    }
    .characters li > a:first-child::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .characters li > a:first-child strong {
      font-weight: 700;
    }
    .characters li:focus-within {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }
    .characters li > a:first-child:focus-visible {
      outline: none;
    }
    .characters li > a:not(:first-child) {
      position: relative;
      z-index: 1;
      padding-block: 0.5rem;
      margin-block: -0.5rem;
      font-weight: 700;
      color: var(--danger);
    }
    .characters small,
    .characters .summary {
      flex: 1 1 100%;
    }
    .characters .summary {
      margin-top: calc(-1 * var(--space-1));
      font-family: var(--font-note);
      font-size: var(--fs-lg);
    }
    .backup {
      margin-top: var(--space-5);
    }
    .new {
      font-family: var(--font-note);
      font-weight: 700;
    }
  `,
})
export class CharacterList implements OnInit {
  protected readonly store = inject(CharacterStore);
  protected readonly sync = inject(SyncService);
  private readonly data = inject(DataTextService);
  private readonly compendium = inject(CompendiumService);

  /** English names of classes and species by id, for the "Fighter 3 · Human" line. */
  private readonly names = resource({
    loader: async () => {
      const [classes, species] = await Promise.all([
        this.compendium.all('class'),
        this.compendium.all('species'),
      ]);
      return new Map([...classes, ...species].map((e) => [e.type + ':' + e.id, e.name]));
    },
  });

  /** "Guerrero 3 / Mago 1 · Humano", in the reader's language (empty while loading). */
  protected summary(c: Character): string {
    const names = this.names.value();
    if (!names) return '';
    const name = (key: string) => this.data.shortName(names.get(key) ?? '');
    const classes = c.classes.map((k) => `${name('class:' + k.id) || k.id} ${k.level}`).join(' / ');
    const species = c.species ? name('species:' + c.species.id) : '';
    return [classes, species].filter(Boolean).join(' · ');
  }

  async ngOnInit(): Promise<void> {
    await this.store.load();
    void this.sync.sync();
  }
}
