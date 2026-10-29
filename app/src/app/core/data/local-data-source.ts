import { DataSource, DataSourceError, FileContent, RepoFile } from './data-source';
import { gitBlobSha } from './git-sha';

/**
 * Reads data/*.json and characters/*.json as served by `npm start` (the development build copies
 * the repo's folders; scripts/sync-dev-data.mjs also writes characters/index.json, the file list a
 * static server can't provide). Read-only: saving needs the GitHub data source.
 */
export class LocalDataSource implements DataSource {
  readonly kind = 'local';
  readonly canWrite = false;

  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  async readJson<T>(path: string): Promise<T> {
    return JSON.parse(await this.readText(path));
  }

  async listJson(dir: string): Promise<RepoFile[]> {
    let paths: string[];
    try {
      paths = await this.readJson<string[]>(`${dir}/index.json`);
    } catch (e) {
      if (e instanceof DataSourceError && e.status === 404) return [];
      throw e;
    }
    return Promise.all(
      paths.map(async (path) => ({ path, sha: await gitBlobSha(await this.readText(path)) })),
    );
  }

  async readJsonWithSha<T>(path: string): Promise<FileContent<T> | null> {
    try {
      const text = await this.readText(path);
      return { path, sha: await gitBlobSha(text), content: JSON.parse(text) };
    } catch (e) {
      if (e instanceof DataSourceError && e.status === 404) return null;
      throw e;
    }
  }

  writeJson(): Promise<RepoFile> {
    return Promise.reject(new DataSourceError('the local data source is read-only'));
  }

  deleteFile(): Promise<void> {
    return Promise.reject(new DataSourceError('the local data source is read-only'));
  }

  private async readText(path: string): Promise<string> {
    const res = await this.fetchFn(path, { cache: 'no-store' }).catch((e: Error) => {
      throw new DataSourceError(`network error (${e.message})`);
    });
    if (!res.ok) throw new DataSourceError(`${path}: HTTP ${res.status}`, res.status);
    return res.text();
  }
}
