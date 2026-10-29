import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (#/compendium/spell) work on any static host (GitHub Pages) and inside the Android app.
    provideRouter(routes, withComponentInputBinding(), withHashLocation()),
  ],
};
