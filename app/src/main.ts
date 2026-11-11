import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyAppearance } from './app/core/settings/appearance';
import { readStoredSettings } from './app/core/settings/settings.service';

// theme, text size and language before the first paint: no flash of the other theme
applyAppearance(readStoredSettings(), document);

bootstrapApplication(App, appConfig).catch((err) => {
  console.error(err);
  // keep the loading screen from spinning forever: say what happened
  document.getElementById('boot')?.setAttribute('data-failed', '');
});
