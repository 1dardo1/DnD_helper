import { applyAppearance, effectiveTheme, normalizeAppearance } from './appearance';

describe('appearance', () => {
  afterEach(() => {
    applyAppearance(
      { theme: 'auto', textSize: 'normal', reduceMotion: false, language: 'en' },
      document,
    );
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  it('keeps only valid values (old or hand-edited settings)', () => {
    expect(normalizeAppearance({})).toEqual({
      theme: 'auto',
      textSize: 'normal',
      reduceMotion: false,
    });
    expect(normalizeAppearance({ theme: 'sepia', textSize: 3, reduceMotion: 'yes' })).toEqual({
      theme: 'auto',
      textSize: 'normal',
      reduceMotion: false,
    });
    expect(normalizeAppearance({ theme: 'dark', textSize: 'large', reduceMotion: true })).toEqual({
      theme: 'dark',
      textSize: 'large',
      reduceMotion: true,
    });
  });

  it('writes theme, text scale, motion and language on <html>', () => {
    const root = document.documentElement;
    applyAppearance(
      { theme: 'dark', textSize: 'xlarge', reduceMotion: true, language: 'es' },
      document,
    );
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.25');
    expect(root.getAttribute('data-motion')).toBe('reduce');
    expect(root.lang).toBe('es');

    applyAppearance(
      { theme: 'auto', textSize: 'normal', reduceMotion: false, language: 'en' },
      document,
    );
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.style.getPropertyValue('--text-scale')).toBe('');
    expect(root.hasAttribute('data-motion')).toBe(false);
    expect(root.lang).toBe('en');
  });

  it('a chosen theme colours the browser bar for both colour schemes', () => {
    for (const media of ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.media = media;
      document.head.append(meta);
    }
    const colours = () =>
      [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (m) => m.content,
      );
    applyAppearance(
      { theme: 'auto', textSize: 'normal', reduceMotion: false, language: 'es' },
      document,
    );
    expect(colours()).toEqual(['#3b2416', '#1a110b']);
    applyAppearance(
      { theme: 'dark', textSize: 'normal', reduceMotion: false, language: 'es' },
      document,
    );
    expect(colours()).toEqual(['#1a110b', '#1a110b']);
  });

  it('auto follows the device', () => {
    expect(effectiveTheme('auto', true)).toBe('dark');
    expect(effectiveTheme('auto', false)).toBe('light');
    expect(effectiveTheme('light', true)).toBe('light');
  });
});
