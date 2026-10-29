/**
 * The GitHub token, encrypted with a password chosen by the user, so a new device only needs that
 * password. It's committed as app/public/token.enc.json and served with the app; without the
 * password it's useless (PBKDF2 with many iterations makes guessing a long password impractical).
 */
export interface EncryptedToken {
  version: 1;
  iterations: number;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
  /** base64: AES-GCM ciphertext of the token. */
  data: string;
}

/** Where the encrypted token lives in the repo, and the URL the app serves it from. */
export const ENCRYPTED_TOKEN_PATH = 'app/public/token.enc.json';
export const ENCRYPTED_TOKEN_URL = 'token.enc.json';

export const MIN_PASSWORD_LENGTH = 12;
const ITERATIONS = 600_000;

export async function encryptToken(
  token: string,
  password: string,
  iterations = ITERATIONS,
): Promise<EncryptedToken> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  );
  return {
    version: 1,
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

/** The token, or null if the password is wrong. */
export async function decryptToken(enc: EncryptedToken, password: string): Promise<string | null> {
  const key = await deriveKey(password, fromBase64(enc.salt), enc.iterations);
  try {
    const data = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(enc.iv) },
      key,
      fromBase64(enc.data),
    );
    return new TextDecoder().decode(data);
  } catch {
    return null; // AES-GCM refuses to decrypt with the wrong key
  }
}

/** The encrypted token served with the app, or null if there isn't one yet. */
export async function fetchEncryptedToken(
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<EncryptedToken | null> {
  try {
    const res = await fetchFn(ENCRYPTED_TOKEN_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const enc = await res.json();
    return enc?.version === 1 ? enc : null;
  } catch {
    return null;
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
