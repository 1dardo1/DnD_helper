import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApkUpdateService } from '../../core/app-update/apk-update.service';
import { shortCommit } from '../../core/app-update/app-version';
import { VersionService } from '../../core/app-update/version.service';
import { CompendiumService } from '../../core/compendium/compendium.service';
import { GitHubDataSource } from '../../core/data/github-data-source';
import { RepositoryService } from '../../core/data/repository.service';
import { I18nService, LocalDatePipe, TranslatePipe } from '../../core/i18n/i18n.service';
import { settingsEn } from '../../core/i18n/settings.en';
import { settingsEs } from '../../core/i18n/settings.es';
import { DataMeta } from '../../core/models/compendium';
import { AppUpdateService } from '../../core/pwa/app-update.service';
import { TEXT_SIZES, THEMES } from '../../core/settings/appearance';
import { Language, Settings, SettingsService } from '../../core/settings/settings.service';
import {
  ENCRYPTED_TOKEN_PATH,
  EncryptedToken,
  MIN_PASSWORD_LENGTH,
  decryptToken,
  encryptToken,
  fetchEncryptedToken,
} from '../../core/settings/token-vault';
import { BackupPanel } from '../../shared/backup-panel';

const SETTINGS_TEXTS = { en: settingsEn, es: settingsEs };

/** The GitHub part of the settings, edited in the form and applied on "Save". */
type GithubForm = Pick<Settings, 'deviceName' | 'githubToken' | 'owner' | 'repo' | 'branch'>;

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, TranslatePipe, LocalDatePipe, BackupPanel],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly settings = inject(SettingsService);
  private readonly compendium = inject(CompendiumService);
  private readonly i18n = inject(I18nService);
  private readonly repo = inject(RepositoryService);
  protected readonly version = inject(VersionService);
  protected readonly apk = inject(ApkUpdateService);
  protected readonly appUpdate = inject(AppUpdateService);

  protected readonly current = this.settings.settings;
  protected readonly themes = THEMES;
  protected readonly textSizes = TEXT_SIZES;
  protected readonly shortCommit = shortCommit;

  /** Edited copy of the GitHub settings; applied on save. */
  protected readonly form: GithubForm = (({ deviceName, githubToken, owner, repo, branch }) => ({
    deviceName,
    githubToken,
    owner,
    repo,
    branch,
  }))(this.settings.settings());
  protected readonly message = signal('');
  protected readonly versionMessage = signal('');

  /** The encrypted token served with the app (null: none yet), to unlock it on this device. */
  protected readonly encrypted = signal<EncryptedToken | null>(null);
  protected password = '';
  protected passwordAgain = '';
  protected readonly minPassword = MIN_PASSWORD_LENGTH;

  protected readonly meta = signal<DataMeta | null>(null);
  protected readonly storage = signal<{ used: number; quota: number } | null>(null);
  protected readonly dataSource = computed(() => {
    const kind = this.repo.source()?.kind;
    return kind ? `version.source.${kind}` : 'version.source.none';
  });
  protected readonly dataOffline = this.compendium.offline;
  protected readonly apkCheckedAt = computed(() => {
    const t = this.apk.checkedAt();
    return t ? new Date(t).toISOString() : null;
  });

  constructor() {
    this.i18n.extend(SETTINGS_TEXTS);
    void fetchEncryptedToken().then((enc) => this.encrypted.set(enc));
    void this.version.checkPublished();
    void this.apk.start();
    void this.compendium
      .getMeta()
      .then((m) => this.meta.set(m))
      .catch(() => undefined);
    void navigator.storage
      ?.estimate?.()
      .then((e) => this.storage.set({ used: toMb(e.usage ?? 0), quota: toMb(e.quota ?? 0) }))
      .catch(() => undefined);
  }

  protected setLanguage(language: string): void {
    this.settings.update({ language: language as Language });
  }

  protected setAppearance(patch: Partial<Pick<Settings, 'theme' | 'textSize' | 'reduceMotion'>>) {
    this.settings.update(patch);
  }

  protected save(): void {
    this.settings.update({
      deviceName: this.form.deviceName,
      githubToken: this.form.githubToken,
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
    this.versionMessage.set(this.i18n.t('settings.saved'));
  }

  /** Everything this section shows, as plain text, to paste in a message when something is off. */
  protected async copyDiagnostics(): Promise<void> {
    const v = this.version;
    const meta = this.meta();
    const lines = [
      `D&D Helper`,
      `app: commit ${shortCommit(v.running.commit)} · build ${v.running.build ?? '-'} · ${v.running.builtAt ?? '-'}`,
      `publicada: commit ${shortCommit(v.published()?.commit ?? null)} · ${v.published()?.builtAt ?? '-'} · ${v.comparison()}`,
      `service worker: ${v.swEnabled ? (this.appUpdate.ready() ? 'nueva lista' : 'activo') : 'no'}`,
      `apk: ${v.native ? `última ${this.apk.latestRelease()?.build ?? '-'}` : 'no'}`,
      `datos: ${meta?.generatedAt ?? '-'} · traducción ${meta?.translatedAt ?? '-'} · ${this.repo.source()?.kind ?? 'none'}${this.dataOffline() ? ' (offline)' : ''}`,
      `idioma: ${this.current().language} · tema ${this.current().theme} · texto ${this.current().textSize}`,
      `navegador: ${navigator.userAgent}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.versionMessage.set(this.i18n.t('version.copied' as never));
    } catch {
      this.versionMessage.set(lines.join(' | '));
    }
  }
}

function toMb(bytes: number): number {
  return Math.round(bytes / 1e5) / 10;
}
