import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { GitHubDataSource } from '../../core/data/github-data-source';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Settings, SettingsService } from '../../core/settings/settings.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './settings-page.html',
  styles: `
    form {
      display: grid;
      gap: 1rem;
      max-width: 32rem;
    }
    label {
      display: grid;
      gap: 0.25rem;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class SettingsPage {
  private readonly settings = inject(SettingsService);
  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);

  /** Edited copy; applied on save. */
  protected readonly form: Settings = { ...this.settings.settings() };
  protected readonly message = signal('');

  protected save(): void {
    this.settings.update({
      ...this.form,
      owner: this.form.owner.trim(),
      repo: this.form.repo.trim(),
      branch: this.form.branch.trim(),
    });
    this.compendium.reset();
    this.message.set(this.i18n.t('settings.saved'));
  }

  protected async test(): Promise<void> {
    const { githubToken: token, owner, repo, branch } = this.form;
    this.message.set(this.i18n.t('common.loading'));
    try {
      const name = await new GitHubDataSource({ token, owner, repo, branch }).ping();
      this.message.set(this.i18n.t('settings.testOk', { repo: name }));
    } catch (e) {
      this.message.set(this.i18n.t('settings.testFail', { message: (e as Error).message }));
    }
  }

  protected async refreshData(): Promise<void> {
    await this.compendium.refresh();
    this.message.set(this.i18n.t('settings.saved'));
  }
}
