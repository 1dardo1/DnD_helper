import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CharacterStore } from './core/characters/character-store.service';
import { SyncService } from './core/characters/sync.service';
import { RepositoryService } from './core/data/repository.service';
import { DevUpdateService } from './core/dev/dev-update.service';
import { I18nService, TranslatePipe } from './core/i18n/i18n.service';
import { Language, SettingsService } from './core/settings/settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly settings = inject(SettingsService);
  protected readonly language = inject(I18nService).language;

  protected readonly nav = [
    { path: '/compendium', label: 'nav.compendium' },
    { path: '/characters', label: 'nav.characters' },
    { path: '/characters/new', label: 'nav.create' },
    { path: '/settings', label: 'nav.settings' },
  ] as const;

  protected readonly sync = inject(SyncService);
  protected readonly store = inject(CharacterStore);
  protected readonly update = inject(DevUpdateService);
  private readonly repo = inject(RepositoryService);
  /** Local files can't be written: say so instead of "not saved to the cloud". */
  protected readonly readOnly = computed(() => this.repo.source()?.canWrite === false);

  constructor() {
    effect(() => (document.documentElement.lang = this.language()));
    void this.store.load();
    this.sync.start(inject(DestroyRef));
  }

  protected setLanguage(language: string): void {
    this.settings.update({ language: language as Language });
  }
}
