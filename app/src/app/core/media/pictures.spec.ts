import { PAGES_URL, pictureBases } from './pictures';

describe('pictureBases', () => {
  it('species always come with the app', () => {
    for (const where of [
      { dev: true, hostname: 'localhost' },
      { dev: false, hostname: '1dardo1.github.io' },
      { dev: false, hostname: 'localhost' },
    ]) {
      expect(pictureBases(where).species).toBe('species/');
    }
  });

  it('monsters: next to the app on GitHub Pages (also a fork) and in development', () => {
    expect(pictureBases({ dev: false, hostname: '1dardo1.github.io' }).monster).toBe('monsters/');
    expect(pictureBases({ dev: false, hostname: 'someone.github.io' }).monster).toBe('monsters/');
    expect(pictureBases({ dev: true, hostname: 'localhost' }).monster).toBe('monsters/');
  });

  it('monsters: from the published site anywhere else (Android app, local production build)', () => {
    const remote = 'https://1dardo1.github.io/DnD_helper/monsters/';
    // Capacitor serves the APK's app from https://localhost
    expect(pictureBases({ dev: false, hostname: 'localhost' }).monster).toBe(remote);
    expect(pictureBases({ dev: false, hostname: '' }).monster).toBe(remote);
    expect(pictureBases({ dev: false, hostname: 'github.io.example.com' }).monster).toBe(remote);
    expect(remote.startsWith(PAGES_URL)).toBe(true);
  });
});
