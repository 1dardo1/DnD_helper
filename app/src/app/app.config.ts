import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';

import { routes } from './app.routes';
import { I18nService } from './core/i18n/i18n.service';
import { IdlePreloading } from './core/navigation/idle-preloading';
import { I18nTitleStrategy } from './core/navigation/title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // the texts of the chosen language (a chunk of their own) before the first render
    provideAppInitializer(() => inject(I18nService).ready()),
    // Hash URLs (#/compendium/spell) work on any static host (GitHub Pages) and inside the Android app.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withHashLocation(),
      // positions are remembered for back/forward; app.ts decides when to scroll
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }),
      // the most visited pages (data.preload in app.routes.ts) download once the app is idle
      withPreloading(IdlePreloading),
    ),
    // "Compendio · D&D Helper": the tab / task switcher says where you are
    { provide: TitleStrategy, useClass: I18nTitleStrategy },
    // Offline use and "install" of the published web app (ngsw-config.json). Not in development,
    // nor in the Android app, which already carries its files and updates with each APK.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
