import { Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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

  constructor() {
    effect(() => (document.documentElement.lang = this.language()));
  }

  protected setLanguage(language: string): void {
    this.settings.update({ language: language as Language });
  }
}
