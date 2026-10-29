import { TestBed } from '@angular/core/testing';

import { SettingsService } from '../settings/settings.service';
import { en } from './en';
import { es } from './es';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());

  it('translates and fills parameters in the selected language', () => {
    const i18n = TestBed.inject(I18nService);
    TestBed.inject(SettingsService).update({ language: 'es' });
    expect(i18n.t('compendium.entries', { count: 3 })).toBe('3 entradas');
    TestBed.inject(SettingsService).update({ language: 'en' });
    expect(i18n.t('compendium.entries', { count: 3 })).toBe('3 entries');
  });

  it('has the same keys in both languages', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });
});
