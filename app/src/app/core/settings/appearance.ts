/**
 * How the app looks on this device (Settings → Appearance): theme, text size, motion. Applied to
 * <html> before Angular starts (main.ts, so there's no flash of the other theme) and again on
 * every change (app.ts). styles.scss reads the attributes and the --text-scale variable.
 */
export type Theme = 'auto' | 'light' | 'dark';
export type TextSize = 'small' | 'normal' | 'large' | 'xlarge';

export const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
export const TEXT_SIZES: readonly TextSize[] = ['small', 'normal', 'large', 'xlarge'];

/** Root font size factor: every size in the app is in rem, so all of it follows. */
export const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.9,
  normal: 1,
  large: 1.12,
  xlarge: 1.25,
};

/** The colour of the browser bar / status bar (the leather cover) in each theme. */
const BAR_COLOUR = { light: '#3b2416', dark: '#1a110b' } as const;

export interface Appearance {
  theme: Theme;
  textSize: TextSize;
  reduceMotion: boolean;
  language: string;
}

/** Valid values only (a hand-edited or older localStorage could hold anything). */
export function normalizeAppearance(
  s: Partial<Record<keyof Appearance, unknown>>,
): Omit<Appearance, 'language'> {
  return {
    theme: THEMES.includes(s.theme as Theme) ? (s.theme as Theme) : 'auto',
    textSize: TEXT_SIZES.includes(s.textSize as TextSize) ? (s.textSize as TextSize) : 'normal',
    reduceMotion: s.reduceMotion === true,
  };
}

/** Writes the appearance on the document's root element. */
export function applyAppearance(a: Appearance, doc: Document): void {
  const root = doc.documentElement;
  root.lang = a.language;
  if (a.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', a.theme);
  if (a.textSize === 'normal') root.style.removeProperty('--text-scale');
  else root.style.setProperty('--text-scale', String(TEXT_SCALE[a.textSize]));
  if (a.reduceMotion) root.setAttribute('data-motion', 'reduce');
  else root.removeAttribute('data-motion');
  // two <meta name="theme-color"> in index.html, one per colour scheme: a chosen theme wins on both
  doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = BAR_COLOUR[a.theme === 'auto' ? scheme : a.theme];
  });
}

/** The theme on screen now: the chosen one, or the device's when it's 'auto'. */
export function effectiveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  return theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme;
}
