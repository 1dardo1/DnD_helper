import { Injectable, computed, inject, isDevMode } from '@angular/core';

import { SettingsService } from '../settings/settings.service';
import { DataSource } from './data-source';
import { GitHubDataSource } from './github-data-source';
import { LocalDataSource } from './local-data-source';

/** true in the GitHub Pages and Android builds, which carry data/ next to the app. */
declare const BUNDLED_DATA: boolean | undefined;
const bundled = typeof BUNDLED_DATA !== 'undefined' && BUNDLED_DATA;

/**
 * Always the GitHub repo; without a connection the compendium and characters already saved on the
 * device are used instead. While GitHub isn't configured, the data files served with the app are
 * read (development, and the GitHub Pages and Android builds, which bundle data/): the compendium
 * works without a token and characters stay on the device.
 */
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly settings = inject(SettingsService);

  /** null when GitHub isn't configured yet (no token...) outside development. */
  readonly source = computed<DataSource | null>(() => {
    const s = this.settings.settings();
    if (!this.settings.githubReady()) return isDevMode() || bundled ? new LocalDataSource() : null;
    return new GitHubDataSource({
      token: s.githubToken,
      owner: s.owner,
      repo: s.repo,
      branch: s.branch,
    });
  });
}
