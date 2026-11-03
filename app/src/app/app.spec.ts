import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';
import { SettingsService } from './core/settings/settings.service';

@Component({ template: '' })
class Blank {}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'compendium', component: Blank },
          { path: 'compendium/:type', component: Blank },
          { path: 'settings', component: Blank },
        ]),
      ],
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

  it('the title leads to the compendium home, at the top, with its tab marked', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const el = fixture.nativeElement as HTMLElement;
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    for (const from of ['/settings', '/compendium/feat?category=general', '/compendium']) {
      await router.navigateByUrl(from);
      await fixture.whenStable();
      scroll.mockClear();
      const brand = el.querySelector<HTMLAnchorElement>('a.brand')!;
      expect(brand.getAttribute('aria-label')).toBeTruthy();
      brand.click();
      await fixture.whenStable();
      expect(router.url).toBe('/compendium');
      expect(scroll).toHaveBeenCalledWith(0, 0);
      expect(el.querySelector('nav a.active')!.getAttribute('data-icon')).toBe('/compendium');
    }
    scroll.mockRestore();
  });
});
