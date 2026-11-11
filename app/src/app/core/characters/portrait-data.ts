/**
 * The part of the portrait logic the character model needs at load time (kept apart from
 * portrait.ts, the crop maths and canvas code, so that stays out of the app's first load).
 */

/** A stored portrait bigger than this (as text) is dropped when loading a character. */
export const PORTRAIT_MAX_DATA_URL_CHARS = 200_000;

const DATA_URL = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Anything that is not a small, well-formed image data URL becomes null ("no portrait"). */
export function normalizePortrait(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= PORTRAIT_MAX_DATA_URL_CHARS && DATA_URL.test(raw)
    ? raw
    : null;
}
