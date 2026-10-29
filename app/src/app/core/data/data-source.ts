/**
 * Where the app reads data/*.json and reads/writes characters/*.json.
 * GitHubDataSource talks to the repo through the GitHub API (every write is a commit);
 * LocalDataSource reads the files served by `npm start` (read-only, used in development until GitHub is configured).
 */
export interface RepoFile {
  path: string;
  /** Git blob sha: identifies this exact version of the file. */
  sha: string;
}

export interface FileContent<T> extends RepoFile {
  content: T;
}

export interface DataSource {
  readonly kind: 'github' | 'local';
  readonly canWrite: boolean;
  readJson<T>(path: string): Promise<T>;
  /** JSON files directly inside a folder (empty if the folder doesn't exist). */
  listJson(dir: string): Promise<RepoFile[]>;
  readJsonWithSha<T>(path: string): Promise<FileContent<T> | null>;
  /**
   * Creates (sha = null) or updates (sha = the version being replaced) a file with one commit.
   * Fails with ConflictError if the file in the repo is not at that version anymore.
   */
  writeJson(path: string, content: unknown, sha: string | null, message: string): Promise<RepoFile>;
  deleteFile(path: string, sha: string, message: string): Promise<void>;
}

export class DataSourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}

/** The repo has a different version of the file than the one we based our change on. */
export class ConflictError extends DataSourceError {
  constructor(path: string) {
    super(`${path} changed in the repository`, 409);
    this.name = 'ConflictError';
  }
}

/** Serialises JSON the same way everywhere, so the same content always gives the same sha. */
export function toJsonText(content: unknown): string {
  return JSON.stringify(content, null, 2) + '\n';
}
