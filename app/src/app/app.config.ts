import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
} from '@angular/router';

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
  ],
};
