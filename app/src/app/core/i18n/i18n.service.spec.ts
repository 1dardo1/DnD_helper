import { TestBed } from '@angular/core/testing';

import { SettingsService } from '../settings/settings.service';
import { combatEn } from './combat.en';
import { combatEs } from './combat.es';
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

  it('texts of a lazily loaded part join the dictionary once added', () => {
    const i18n = TestBed.inject(I18nService);
    TestBed.inject(SettingsService).update({ language: 'es' });
    expect(i18n.t('combat.kind.bonus' as never)).toBe('combat.kind.bonus');
    i18n.extend({ en: combatEn, es: combatEs });
    expect(i18n.t('combat.kind.bonus' as never)).toBe('Adicional');
    expect(i18n.t('compendium.entries', { count: 3 })).toBe('3 entradas');
    expect(Object.keys(combatEs).sort()).toEqual(Object.keys(combatEn).sort());
  });
});
