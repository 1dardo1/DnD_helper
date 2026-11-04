import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CompendiumService } from '../../core/compendium/compendium.service';
import { GitHubDataSource } from '../../core/data/github-data-source';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { Settings, SettingsService } from '../../core/settings/settings.service';
import {
  ENCRYPTED_TOKEN_PATH,
  EncryptedToken,
  MIN_PASSWORD_LENGTH,
  decryptToken,
  encryptToken,
  fetchEncryptedToken,
} from '../../core/settings/token-vault';
import { BackupPanel } from '../../shared/backup-panel';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, TranslatePipe, BackupPanel],
  templateUrl: './settings-page.html',
  styles: `
    .backup {
      max-width: 34rem;
      margin-top: var(--space-5);
    }
    .backup > p {
      margin-top: 0;
    }
    form {
      display: grid;
      gap: var(--space-4);
      max-width: 34rem;
    }
    label {
      display: grid;
      gap: 0.3rem;
      font-family: var(--font-note);
      font-weight: 700;
    }
    label > :is(input, select) {
      width: 100%;
      font-family: var(--font-body);
      font-weight: 400;
    }
    label > small {
      font-family: var(--font-body);
      font-weight: 400;
    }
    fieldset {
      display: grid;
      gap: var(--space-3);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .row button[type='submit'] {
      color: var(--on-accent);
      background: var(--accent);
      border-color: var(--accent);
    }
    [role='status'] {
      font-family: var(--font-note);
      font-weight: 700;
      color: var(--ok);
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

  /** The encrypted token served with the app (null: none yet), to unlock it on this device. */
  protected readonly encrypted = signal<EncryptedToken | null>(null);
  protected password = '';
  protected passwordAgain = '';
  protected readonly minPassword = MIN_PASSWORD_LENGTH;

  constructor() {
    void fetchEncryptedToken().then((enc) => this.encrypted.set(enc));
  }

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

  /** Decrypts the token served with the app and keeps it on this device. */
  protected async unlock(): Promise<void> {
    const enc = this.encrypted();
    if (!enc) return;
    this.message.set(this.i18n.t('common.loading'));
    const token = await decryptToken(enc, this.password);
    if (!token) {
      this.message.set(this.i18n.t('settings.vault.wrongPassword'));
      return;
    }
    this.form.githubToken = token;
    this.password = '';
    this.save();
    this.message.set(this.i18n.t('settings.vault.unlocked'));
  }

  /** Encrypts the token with the password and commits it, for the other devices. */
  protected async storeEncrypted(): Promise<void> {
    if (this.password.length < MIN_PASSWORD_LENGTH) {
      this.message.set(this.i18n.t('settings.vault.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (this.password !== this.passwordAgain) {
      this.message.set(this.i18n.t('settings.vault.mismatch'));
      return;
    }
    const { githubToken: token, owner, repo, branch } = this.form;
    this.message.set(this.i18n.t('common.loading'));
    try {
      const enc = await encryptToken(token, this.password);
      const source = new GitHubDataSource({ token, owner, repo, branch });
      const current = await source.readJsonWithSha(ENCRYPTED_TOKEN_PATH);
      await source.writeJson(
        ENCRYPTED_TOKEN_PATH,
        enc,
        current?.sha ?? null,
        'Guardar el token de GitHub cifrado',
      );
      this.password = this.passwordAgain = '';
      this.message.set(this.i18n.t('settings.vault.stored'));
    } catch (e) {
      this.message.set(this.i18n.t('common.error', { message: (e as Error).message }));
    }
  }

  protected async refreshData(): Promise<void> {
    await this.compendium.refresh();
    this.message.set(this.i18n.t('settings.saved'));
  }
}
