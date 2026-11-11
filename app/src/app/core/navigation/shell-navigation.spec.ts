import { routes } from '../../app.routes';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { worthPreloading } from './idle-preloading';
import { pageTitle } from './title-strategy';

describe('page titles', () => {
  it('"Page · App", or just the app when the page has no title', () => {
    expect(pageTitle('Conjuros', 'D&D Helper')).toBe('Conjuros · D&D Helper');
    expect(pageTitle(undefined, 'D&D Helper')).toBe('D&D Helper');
    expect(pageTitle('D&D Helper', 'D&D Helper')).toBe('D&D Helper');
    // an untranslated key (type.<unknown> from a bad URL) is not shown
    expect(pageTitle('type.nonsense', 'D&D Helper')).toBe('D&D Helper');
  });

  it('every fixed route title is a key with a text in both languages', () => {
    const keys = routes.map((r) => r.title).filter((t): t is string => typeof t === 'string');
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      expect((en as Record<string, string>)[key], key).toBeTruthy();
      expect((es as Record<string, string>)[key], key).toBeTruthy();
    }
  });

  it('the compendium sections are titled by their type', () => {
    const list = routes.find((r) => r.path === 'compendium/:type')!;
    const title = list.title as unknown as (r: { paramMap: Map<string, string> }) => string;
    expect(title({ paramMap: new Map([['type', 'spell']]) })).toBe('type.spell');
  });
});

describe('preloading', () => {
  it('not with the data saver or on 2G', () => {
    expect(worthPreloading(undefined)).toBe(true);
    expect(worthPreloading({ effectiveType: '4g' })).toBe(true);
    expect(worthPreloading({ effectiveType: '3g' })).toBe(true);
    expect(worthPreloading({ effectiveType: '2g' })).toBe(false);
    expect(worthPreloading({ effectiveType: 'slow-2g' })).toBe(false);
    expect(worthPreloading({ saveData: true, effectiveType: '4g' })).toBe(false);
  });

  it('only the most visited pages are preloaded', () => {
    const preloaded = routes.filter((r) => r.data?.['preload']).map((r) => r.path);
    expect(preloaded).toEqual([
      'compendium/:type',
      'compendium/:type/:id',
      'characters',
      'characters/:id',
    ]);
  });
});
