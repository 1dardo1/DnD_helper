import { ConflictError, DataSourceError } from './data-source';
import { GitHubDataSource } from './github-data-source';

const cfg = { token: 'tok', owner: 'me', repo: 'DnD_helper', branch: 'main' };

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function b64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

describe('GitHubDataSource', () => {
  it('reads raw JSON from the branch with the token', async () => {
    const calls: [string, RequestInit][] = [];
    const ds = new GitHubDataSource(cfg, async (url, init) => {
      calls.push([String(url), init!]);
      return reply(200, { generatedAt: 'x' });
    });
    expect(await ds.readJson('data/meta.json')).toEqual({ generatedAt: 'x' });
    expect(calls[0][0]).toBe(
      'https://api.github.com/repos/me/DnD_helper/contents/data/meta.json?ref=main',
    );
    const headers = calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(headers['Accept']).toBe('application/vnd.github.raw+json');
  });

  it('decodes UTF-8 content and returns the sha', async () => {
    const ds = new GitHubDataSource(cfg, async () =>
      reply(200, { sha: 'abc', content: b64('{"name":"José"}'), encoding: 'base64' }),
    );
    expect(await ds.readJsonWithSha('characters/jose.json')).toEqual({
      path: 'characters/jose.json',
      sha: 'abc',
      content: { name: 'José' },
    });
  });

  it('returns null / [] for missing files and folders', async () => {
    const ds = new GitHubDataSource(cfg, async () => reply(404, { message: 'Not Found' }));
    expect(await ds.readJsonWithSha('characters/x.json')).toBeNull();
    expect(await ds.listJson('characters')).toEqual([]);
  });

  it('commits with the previous sha and reports conflicts', async () => {
    const bodies: Record<string, string>[] = [];
    let status = 200;
    const ds = new GitHubDataSource(cfg, async (_url, init) => {
      bodies.push(JSON.parse(String(init!.body)));
      return status === 200
        ? reply(200, { content: { sha: 'new' } })
        : reply(status, { message: 'sha mismatch' });
    });
    expect(await ds.writeJson('characters/a.json', { a: 1 }, 'old', 'Save a')).toEqual({
      path: 'characters/a.json',
      sha: 'new',
    });
    expect(bodies[0]['sha']).toBe('old');
    expect(bodies[0]['branch']).toBe('main');
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(bodies[0]['content']), (c) => c.charCodeAt(0))),
    ).toBe('{\n  "a": 1\n}\n');

    status = 409;
    await expect(
      ds.writeJson('characters/a.json', { a: 2 }, 'old', 'Save a'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('turns HTTP errors into DataSourceError with the GitHub message', async () => {
    const ds = new GitHubDataSource(cfg, async () => reply(401, { message: 'Bad credentials' }));
    const err = await ds.ping().catch((e) => e);
    expect(err).toBeInstanceOf(DataSourceError);
    expect(err.status).toBe(401);
    expect(err.message).toContain('Bad credentials');
  });
});
