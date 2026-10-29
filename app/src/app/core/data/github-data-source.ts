import {
  ConflictError,
  DataSource,
  DataSourceError,
  FileContent,
  RepoFile,
  toJsonText,
} from './data-source';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

const API = 'https://api.github.com';

/** Reads and writes repo files through the GitHub REST "contents" API. */
export class GitHubDataSource implements DataSource {
  readonly kind = 'github';
  readonly canWrite = true;

  constructor(
    private readonly cfg: GitHubConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** Checks the token and repository; returns the repository's full name. */
  async ping(): Promise<string> {
    const res = await this.request(`${API}/repos/${this.cfg.owner}/${this.cfg.repo}`);
    return (await res.json()).full_name;
  }

  async readJson<T>(path: string): Promise<T> {
    // "raw" returns the file itself, which also works for files over 1 MB (data/items.json).
    const res = await this.request(this.contentsUrl(path, true), {
      headers: { Accept: 'application/vnd.github.raw+json' },
    });
    return res.json();
  }

  async listJson(dir: string): Promise<RepoFile[]> {
    try {
      const res = await this.request(this.contentsUrl(dir, true));
      const items: { type: string; name: string; path: string; sha: string }[] = await res.json();
      return items
        .filter((i) => i.type === 'file' && i.name.endsWith('.json'))
        .map(({ path, sha }) => ({ path, sha }));
    } catch (e) {
      if (e instanceof DataSourceError && e.status === 404) return [];
      throw e;
    }
  }

  async readJsonWithSha<T>(path: string): Promise<FileContent<T> | null> {
    try {
      const res = await this.request(this.contentsUrl(path, true));
      const meta: { sha: string; content: string; encoding: string } = await res.json();
      return { path, sha: meta.sha, content: JSON.parse(decodeBase64(meta.content)) };
    } catch (e) {
      if (e instanceof DataSourceError && e.status === 404) return null;
      throw e;
    }
  }

  async writeJson(
    path: string,
    content: unknown,
    sha: string | null,
    message: string,
  ): Promise<RepoFile> {
    const body: Record<string, string> = {
      message,
      content: encodeBase64(toJsonText(content)),
      branch: this.cfg.branch,
    };
    if (sha) body['sha'] = sha;
    try {
      const res = await this.request(this.contentsUrl(path, false), {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const out: { content: { sha: string } } = await res.json();
      return { path, sha: out.content.sha };
    } catch (e) {
      // 409: sha doesn't match the repo; 422: creating a file that already exists.
      if (e instanceof DataSourceError && (e.status === 409 || e.status === 422))
        throw new ConflictError(path);
      throw e;
    }
  }

  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    try {
      await this.request(this.contentsUrl(path, false), {
        method: 'DELETE',
        body: JSON.stringify({ message, sha, branch: this.cfg.branch }),
      });
    } catch (e) {
      if (e instanceof DataSourceError && e.status === 409) throw new ConflictError(path);
      if (e instanceof DataSourceError && e.status === 404) return; // already gone
      throw e;
    }
  }

  private contentsUrl(path: string, withRef: boolean): string {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const url = `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${encoded}`;
    return withRef ? `${url}?ref=${encodeURIComponent(this.cfg.branch)}` : url;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.headers ?? {}),
        },
      });
    } catch (e) {
      throw new DataSourceError(`network error (${(e as Error).message})`);
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).message ?? detail;
      } catch {
        // not JSON
      }
      throw new DataSourceError(`GitHub ${res.status}: ${detail}`, res.status);
    }
    return res;
  }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
