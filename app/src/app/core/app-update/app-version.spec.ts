import { compareVersions, parsePublished, runningBuild, shortCommit } from './app-version';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'fedcba9876543210fedcba9876543210fedcba98';

describe('app version', () => {
  it('a test build has no commit, date nor build number', () => {
    expect(runningBuild()).toEqual({ build: null, commit: null, builtAt: null });
  });

  it('reads the published version.json, ignoring junk', () => {
    expect(parsePublished({ commit: SHA, builtAt: '2026-11-10T12:00:00Z' })).toEqual({
      commit: SHA,
      builtAt: '2026-11-10T12:00:00Z',
    });
    expect(parsePublished({ commit: null, builtAt: '2026-11-10T12:00:00Z' })?.commit).toBeNull();
    expect(parsePublished({ commit: '<script>', builtAt: 'yesterday' })).toBeNull();
    expect(parsePublished('nope')).toBeNull();
    expect(parsePublished(null)).toBeNull();
  });

  it('compares the running commit with the published one', () => {
    const running = { build: null, commit: SHA, builtAt: null };
    expect(compareVersions(running, { commit: SHA, builtAt: null })).toBe('same');
    expect(compareVersions(running, { commit: OTHER, builtAt: null })).toBe('newer');
    expect(compareVersions(running, null)).toBe('unknown');
    expect(compareVersions({ ...running, commit: null }, { commit: SHA, builtAt: null })).toBe(
      'unknown',
    );
  });

  it('shows commits as GitHub does', () => {
    expect(shortCommit(SHA)).toBe('0123456');
    expect(shortCommit(null)).toBe('—');
  });
});
