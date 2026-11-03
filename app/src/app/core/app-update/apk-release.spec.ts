import { CHECK_INTERVAL_MS, checkDue, isNewer, parseBuild, parseRelease } from './apk-release';

const URL = 'https://github.com/1dardo1/DnD_helper/releases/download/android-latest/dnd-helper.apk';
const apk = { name: 'dnd-helper.apk', browser_download_url: URL };

describe('parseRelease', () => {
  it('reads the build from the "build: N" line of the notes and the dnd-helper.apk link', () => {
    const body = 'APK generada automáticamente desde abc1234 (ejecución 42).\n\nbuild: 42';
    expect(parseRelease({ body, assets: [apk] })).toEqual({ build: 42, url: URL });
  });

  it('accepts other spacing and CRLF line ends', () => {
    expect(parseRelease({ body: 'Notas\r\n  Build:17  \r\n', assets: [apk] })?.build).toBe(17);
  });

  it('falls back to an asset named dnd-helper-<N>.apk', () => {
    const numbered = {
      name: 'dnd-helper-9.apk',
      browser_download_url: URL.replace('.apk', '-9.apk'),
    };
    expect(parseRelease({ body: '', assets: [numbered, apk] })).toEqual({ build: 9, url: URL });
    expect(parseRelease({ body: null, assets: [numbered] })).toEqual({
      build: 9,
      url: numbered.browser_download_url,
    });
  });

  it('ignores "build" in the middle of a sentence', () => {
    expect(parseRelease({ body: 'the build: 5 is broken', assets: [apk] })).toBeNull();
  });

  it('gives nothing without a build, an APK or an https link', () => {
    expect(parseRelease({ body: 'APK (ejecución 3).', assets: [apk] })).toBeNull();
    expect(parseRelease({ body: 'build: 3', assets: [] })).toBeNull();
    expect(parseRelease({ body: 'build: 3' })).toBeNull();
    expect(
      parseRelease({
        body: 'build: 3',
        assets: [{ name: 'dnd-helper.apk', browser_download_url: 'http://x' }],
      }),
    ).toBeNull();
    expect(parseRelease({ body: 'build: 0', assets: [apk] })).toBeNull();
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ message: 'Not Found' } as never)).toBeNull();
  });
});

describe('isNewer', () => {
  it('compares build numbers as numbers', () => {
    expect(isNewer(9, { build: 10, url: URL })).toBe(true);
    expect(isNewer(10, { build: 10, url: URL })).toBe(false);
    expect(isNewer(11, { build: 10, url: URL })).toBe(false);
    expect(isNewer(1, null)).toBe(false);
  });
});

describe('checkDue', () => {
  const now = 1_800_000_000_000;

  it('asks the first time and then once a day', () => {
    expect(checkDue(undefined, now)).toBe(true);
    expect(checkDue(now - 1000, now)).toBe(false);
    expect(checkDue(now - CHECK_INTERVAL_MS + 1, now)).toBe(false);
    expect(checkDue(now - CHECK_INTERVAL_MS, now)).toBe(true);
  });

  it('asks again when the last check is in the future (the clock changed)', () => {
    expect(checkDue(now + 60_000, now)).toBe(true);
  });
});

describe('parseBuild', () => {
  it('takes positive whole numbers, as numbers or text', () => {
    expect(parseBuild(42)).toBe(42);
    expect(parseBuild('42')).toBe(42);
    for (const bad of [null, undefined, '', ' ', 'abc', 0, -1, 1.5, NaN]) {
      expect(parseBuild(bad)).toBeNull();
    }
  });
});
