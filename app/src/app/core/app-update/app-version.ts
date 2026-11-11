/**
 * Which version of the app is running and which one is published, for Settings → Version: the
 * answer to "am I seeing the latest change?".
 *
 * The builds of pages.yml and apk.yml say it at build time (`--define`): APP_COMMIT (the commit),
 * APP_BUILT_AT (when) and, in the APK, APP_BUILD (the run number the release notes compare).
 * scripts/bundle-data.mjs writes the same commit to version.json next to the published app, which
 * is always read from the network: if it names another commit, a newer version is published.
 */
declare const APP_BUILD: number | undefined;
declare const APP_COMMIT: string | undefined;
declare const APP_BUILT_AT: string | undefined;

export interface BuildInfo {
  /** APK run number (apk.yml), or null. */
  build: number | null;
  /** Full commit sha, or null in development / local builds. */
  commit: string | null;
  /** ISO date of the build, or null. */
  builtAt: string | null;
}

/** version.json of the published site. */
export interface PublishedVersion {
  commit: string | null;
  builtAt: string | null;
}

export const VERSION_FILE = 'version.json';

export function runningBuild(): BuildInfo {
  return {
    build: typeof APP_BUILD !== 'undefined' && Number.isSafeInteger(APP_BUILD) ? APP_BUILD : null,
    commit: cleanCommit(typeof APP_COMMIT !== 'undefined' ? APP_COMMIT : null),
    builtAt: cleanDate(typeof APP_BUILT_AT !== 'undefined' ? APP_BUILT_AT : null),
  };
}

/** The published version.json, or null when it says nothing usable. */
export function parsePublished(json: unknown): PublishedVersion | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const v = { commit: cleanCommit(o['commit']), builtAt: cleanDate(o['builtAt']) };
  return v.commit || v.builtAt ? v : null;
}

/**
 * 'same': this is the published version; 'newer': another commit is published; 'unknown': one of
 * the two doesn't say (development, a local build, the file couldn't be read).
 */
export function compareVersions(
  running: BuildInfo,
  published: PublishedVersion | null,
): 'same' | 'newer' | 'unknown' {
  if (!running.commit || !published?.commit) return 'unknown';
  return running.commit === published.commit ? 'same' : 'newer';
}

/** The first 7 characters, as GitHub shows commits. */
export function shortCommit(commit: string | null): string {
  return commit ? commit.slice(0, 7) : '—';
}

function cleanCommit(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

function cleanDate(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}
