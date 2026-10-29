import { Injectable, computed, inject, isDevMode } from '@angular/core';

import { SettingsService } from '../settings/settings.service';
import { DataSource } from './data-source';
import { GitHubDataSource } from './github-data-source';
import { LocalDataSource } from './local-data-source';

/**
 * Always the GitHub repo; without a connection the compendium and characters already saved on the
 * device are used instead. Only in development (`npm start`) and while GitHub isn't configured,
 * the local files are read so the app can be tried without a token.
 */
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly settings = inject(SettingsService);

  /** null when GitHub isn't configured yet (no token...) outside development. */
  readonly source = computed<DataSource | null>(() => {
    const s = this.settings.settings();
    if (!this.settings.githubReady()) return isDevMode() ? new LocalDataSource() : null;
    return new GitHubDataSource({
      token: s.githubToken,
      owner: s.owner,
      repo: s.repo,
      branch: s.branch,
    });
  });
}
