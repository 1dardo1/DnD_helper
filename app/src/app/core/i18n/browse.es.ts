import { BrowseKey, browseEn } from './browse.en';

/** Textos de las ayudas de navegación del compendio y la Mesa del DM (mismas claves que browse.en.ts). */
export const browseEs: Record<BrowseKey, string> = {
  'browse.backToTop': 'Volver arriba',
  'browse.quickBy': 'Filtro rápido: {facet}',
  'browse.quickAll': 'Todos',
  'browse.onThisPage': 'En esta página',
  'browse.share': 'Compartir',
  'browse.copyLink': 'Copiar enlace',
  'browse.linkCopied': 'Enlace copiado',
  'browse.recent': 'Vistos hace poco',
  'browse.clearRecent': 'Borrar la lista de vistos hace poco',
  'browse.challenge': 'Desafío',
  'browse.noConnection.title': 'No hay conexión',
  'browse.noConnection.text':
    'El compendio se descarga la primera vez que lo abres y después funciona sin conexión. Revisa la conexión y vuelve a intentarlo.',
  'browse.retry': 'Reintentar',
};

/** Both languages, for I18nService.extend (once per page that shows them). */
export const BROWSE_TEXTS = { en: browseEn, es: browseEs };
