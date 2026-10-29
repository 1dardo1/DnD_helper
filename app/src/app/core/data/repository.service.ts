import { Injectable, computed, inject } from '@angular/core';

import { SettingsService } from '../settings/settings.service';
import { DataSource } from './data-source';
import { GitHubDataSource } from './github-data-source';
import { LocalDataSource } from './local-data-source';

/** The DataSource chosen in Settings (GitHub repo or local files). */
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly settings = inject(SettingsService);

  /** null when GitHub is selected but not configured yet (no token...). */
  readonly source = computed<DataSource | null>(() => {
    const s = this.settings.settings();
    if (s.dataSource === 'local') return new LocalDataSource();
    if (!this.settings.githubReady()) return null;
    return new GitHubDataSource({
      token: s.githubToken,
      owner: s.owner,
      repo: s.repo,
      branch: s.branch,
    });
  });
}
