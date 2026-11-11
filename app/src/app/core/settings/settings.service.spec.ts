import { DEFAULT_SETTINGS, readStoredSettings } from './settings.service';

const KEY = 'dnd-helper.settings';

describe('stored settings', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('settings saved by an older version get the new appearance defaults', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ language: 'es', githubToken: 't', dataSource: 'x' }),
    );
    const s = readStoredSettings();
    expect(s.language).toBe('es');
    expect(s.githubToken).toBe('t');
    expect(s.theme).toBe('auto');
    expect(s.textSize).toBe('normal');
    expect(s.reduceMotion).toBe(false);
    expect('dataSource' in s).toBe(false);
  });

  it('invalid values fall back to the defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ language: 'fr', theme: 'neon', textSize: 'huge' }));
    const s = readStoredSettings();
    expect(s.language).toBe(DEFAULT_SETTINGS.language);
    expect(s.theme).toBe('auto');
    expect(s.textSize).toBe('normal');
  });

  it('unreadable storage gives the defaults', () => {
    localStorage.setItem(KEY, '{broken');
    expect(readStoredSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
