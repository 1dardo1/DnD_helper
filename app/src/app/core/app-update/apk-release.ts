/**
 * What the Android app needs to know about the "android-latest" GitHub release: which build it
 * holds and where to download it. apk.yml writes a line `build: <run number>` in the release
 * notes and uploads the APK as `dnd-helper.apk`.
 */
export interface ApkRelease {
  build: number;
  url: string;
}

/** The part of GitHub's release JSON that is read. */
export interface GithubRelease {
  body?: string | null;
  assets?: { name?: string; browser_download_url?: string }[];
}

export const APK_NAME = 'dnd-helper.apk';
export const RELEASE_API =
  'https://api.github.com/repos/1dardo1/DnD_helper/releases/tags/android-latest';
/** How long a check is trusted before asking GitHub again. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The release's build and APK link, or null when the release doesn't say them. */
export function parseRelease(release: GithubRelease | null | undefined): ApkRelease | null {
  if (!release || typeof release !== 'object') return null;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const body = typeof release.body === 'string' ? release.body : '';
  const fromBody = /^\s*build:\s*(\d+)\s*$/im.exec(body)?.[1];
  // fallback: an asset named dnd-helper-<build>.apk
  const fromAsset = assets
    .map((a) => /^dnd-helper-(\d+)\.apk$/i.exec(a?.name ?? '')?.[1])
    .find((n) => n !== undefined);
  const build = Number(fromBody ?? fromAsset);
  const apk =
    assets.find((a) => a?.name === APK_NAME) ?? assets.find((a) => /\.apk$/i.test(a?.name ?? ''));
  const url = apk?.browser_download_url;
  if (!Number.isSafeInteger(build) || build <= 0) return null;
  if (typeof url !== 'string' || !url.startsWith('https://')) return null;
  return { build, url };
}

/** True when `latest` is a later build than the one running. */
export function isNewer(current: number, latest: ApkRelease | null | undefined): boolean {
  return !!latest && latest.build > current;
}

/** True when the last successful check is old enough (or in the future: the clock changed). */
export function checkDue(checkedAt: number | undefined, now: number): boolean {
  if (!checkedAt || !Number.isFinite(checkedAt)) return true;
  return now - checkedAt >= CHECK_INTERVAL_MS || now < checkedAt;
}

/** The build number given at build time (`--define APP_BUILD=<n>`), or null. */
export function parseBuild(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}
