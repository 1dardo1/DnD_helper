import { InjectionToken, isDevMode } from '@angular/core';

/**
 * The published web app (GitHub Pages, .github/workflows/pages.yml). The monster pictures are only
 * published there, in <PAGES_URL>monsters/ (media/monsters/README.md): they are not inside the app
 * build, so the Android app doesn't grow with them. Change it here if the site moves.
 */
export const PAGES_URL = 'https://1dardo1.github.io/DnD_helper/';

/** The entry types that can have a picture. */
export type PictureKind = 'species' | 'monster';

/** Where each kind's pictures are: a folder URL ending in '/', with <id>.webp and index.json. */
export type PictureBases = Readonly<Record<PictureKind, string>>;

/**
 * The folder of each kind's pictures, relative to the app's base href unless absolute:
 * - species: inside the app (public/species/), always relative.
 * - monster: relative where the app has them next to it: on GitHub Pages (also a fork's own site)
 *   and in development (`npm start` serves media/monsters/ as monsters/, scripts/sync-dev-data.mjs).
 *   Anywhere else (the Android app, a local production build) from the published site, PAGES_URL.
 */
export function pictureBases(where: { dev: boolean; hostname: string }): PictureBases {
  const local = where.dev || where.hostname.endsWith('.github.io');
  return {
    species: 'species/',
    monster: local ? 'monsters/' : `${PAGES_URL}monsters/`,
  };
}

export const PICTURE_BASES = new InjectionToken<PictureBases>('PICTURE_BASES', {
  providedIn: 'root',
  factory: () => pictureBases({ dev: isDevMode(), hostname: globalThis.location?.hostname ?? '' }),
});
