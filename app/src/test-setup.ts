// Vitest (npm test): both languages' texts are available synchronously, as if already loaded. In
// the app each one is a lazy chunk loaded before the first render (I18nService).
import { en } from './app/core/i18n/en';
import { es } from './app/core/i18n/es';
import { registerDictionary } from './app/core/i18n/i18n.service';

registerDictionary('en', en);
registerDictionary('es', es);
