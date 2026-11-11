/**
 * The character portrait: a small square image kept inside the character JSON as a data URL
 * (`Character.portrait`), so it travels with the character everywhere (IndexedDB, GitHub, backups)
 * with no extra plumbing. The original photo is cropped to a centered/framed square and shrunk in
 * the browser, so the stored image is a few tens of kB. This file is the pure logic (limits,
 * crop maths, validation, data URL handling); the canvas work lives in `renderPortrait`.
 */

/** Largest side of the stored portrait, in px. */
export const PORTRAIT_SIZE = 320;
/** Encoder quality (WebP, or JPEG where the browser cannot write WebP). */
export const PORTRAIT_QUALITY = 0.8;
/** The original file is refused above this size. */
export const PORTRAIT_MAX_FILE_BYTES = 15 * 1024 * 1024;
/** A stored portrait bigger than this (as text) is dropped when loading a character. */
export const PORTRAIT_MAX_DATA_URL_CHARS = 200_000;
/** Zoom range of the framing control (1 = the whole short side of the image). */
export const PORTRAIT_MAX_ZOOM = 4;

const DATA_URL = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

export type PortraitFileProblem = 'format' | 'tooLarge';

/** Whether a picked file can be used: must be an image and at most 15 MB. */
export function checkPortraitFile(file: {
  type: string;
  size: number;
}): PortraitFileProblem | null {
  if (!file.type.startsWith('image/')) return 'format';
  if (file.size > PORTRAIT_MAX_FILE_BYTES) return 'tooLarge';
  return null;
}

/** Anything that is not a small, well-formed image data URL becomes null ("no portrait"). */
export function normalizePortrait(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= PORTRAIT_MAX_DATA_URL_CHARS && DATA_URL.test(raw)
    ? raw
    : null;
}

/** Approximate size in bytes of the image a data URL carries. */
export function portraitBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** The raw bytes and MIME type of a portrait data URL (for the PDF). */
export function portraitToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes };
}

/** The framing of the square crop: zoom >= 1 and the crop centre as a fraction of the image. */
export interface Framing {
  zoom: number;
  /** 0..1 across the image width. */
  cx: number;
  /** 0..1 down the image height. */
  cy: number;
}

export const CENTERED: Framing = { zoom: 1, cx: 0.5, cy: 0.5 };

export interface CropRect {
  sx: number;
  sy: number;
  side: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The square of the source image to keep (always inside the image). */
export function cropRect(width: number, height: number, f: Framing = CENTERED): CropRect {
  const zoom = clamp(Number.isFinite(f.zoom) ? f.zoom : 1, 1, PORTRAIT_MAX_ZOOM);
  const side = Math.min(width, height) / zoom;
  const sx = clamp((Number.isFinite(f.cx) ? f.cx : 0.5) * width - side / 2, 0, width - side);
  const sy = clamp((Number.isFinite(f.cy) ? f.cy : 0.5) * height - side / 2, 0, height - side);
  return { sx, sy, side };
}

/** Moves the framing by a drag of (dx, dy) screen px over a square view of `view` px. */
export function dragFraming(
  width: number,
  height: number,
  f: Framing,
  dx: number,
  dy: number,
  view: number,
): Framing {
  const { side } = cropRect(width, height, f);
  const k = side / view; // source px per screen px
  const r = cropRect(width, height, {
    ...f,
    cx: f.cx - (dx * k) / width,
    cy: f.cy - (dy * k) / height,
  });
  return { zoom: f.zoom, cx: (r.sx + r.side / 2) / width, cy: (r.sy + r.side / 2) / height };
}

/** Changes the zoom keeping the crop centre (and the crop inside the image). */
export function zoomFraming(width: number, height: number, f: Framing, zoom: number): Framing {
  const z = clamp(zoom, 1, PORTRAIT_MAX_ZOOM);
  const r = cropRect(width, height, { ...f, zoom: z });
  return { zoom: z, cx: (r.sx + r.side / 2) / width, cy: (r.sy + r.side / 2) / height };
}

/** Side in px of the stored image for a crop of `side` source px (never upscaled). */
export function outputSize(side: number): number {
  return Math.max(1, Math.min(PORTRAIT_SIZE, Math.round(side)));
}

/**
 * Crops and shrinks an image to the portrait data URL: WebP, or JPEG when the browser cannot
 * encode WebP. Needs a browser (canvas).
 */
export function renderPortrait(
  source: CanvasImageSource,
  width: number,
  height: number,
  framing: Framing = CENTERED,
): string {
  const { sx, sy, side } = cropRect(width, height, framing);
  const size = outputSize(side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  const webp = canvas.toDataURL('image/webp', PORTRAIT_QUALITY);
  return webp.startsWith('data:image/webp')
    ? webp
    : canvas.toDataURL('image/jpeg', PORTRAIT_QUALITY);
}
