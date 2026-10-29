import { DataSource, DataSourceError, FileContent, RepoFile } from './data-source';

/**
 * Reads data/*.json as served by `npm start` (the development build copies the repo's data/ folder).
 * Read-only and without characters: a static server can't list folders or accept commits.
 */
export class LocalDataSource implements DataSource {
  readonly kind = 'local';
  readonly canWrite = false;

  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  async readJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(path, { cache: 'no-store' }).catch((e: Error) => {
      throw new DataSourceError(`network error (${e.message})`);
    });
    if (!res.ok) throw new DataSourceError(`${path}: HTTP ${res.status}`, res.status);
    return res.json();
  }

  async listJson(): Promise<RepoFile[]> {
    return [];
  }

  async readJsonWithSha<T>(): Promise<FileContent<T> | null> {
    return null;
  }

  writeJson(): Promise<RepoFile> {
    return Promise.reject(new DataSourceError('the local data source is read-only'));
  }

  deleteFile(): Promise<void> {
    return Promise.reject(new DataSourceError('the local data source is read-only'));
  }
}
