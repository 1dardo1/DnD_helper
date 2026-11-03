import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (#/compendium/spell) work on any static host (GitHub Pages) and inside the Android app.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withHashLocation(),
      // positions are remembered for back/forward; app.ts decides when to scroll
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }),
    ),
    // Offline use and "install" of the published web app (ngsw-config.json). Not in development,
    // nor in the Android app, which already carries its files and updates with each APK.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
