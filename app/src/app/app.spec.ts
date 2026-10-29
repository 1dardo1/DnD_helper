import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { SettingsService } from './core/settings/settings.service';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows the navigation in the selected language', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(SettingsService).update({ language: 'es' });
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav')!.textContent!;
    expect(nav).toContain('Compendio');
    expect(nav).toContain('Ajustes');

    TestBed.inject(SettingsService).update({ language: 'en' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')!.textContent).toContain(
      'Settings',
    );
  });
});
