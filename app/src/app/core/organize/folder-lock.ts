import { fromBase64, toBase64 } from '../settings/token-vault';
import { Character, normalizeCharacter } from '../models/character';

/**
 * Password-protected folders of characters.
 *
 * The repo is the app's only "backend" and anyone with access to it can read its files, so the
 * protection can't be a check on a server: the characters of a protected folder are written to the
 * repo **encrypted** (AES-GCM 256) with a key derived from the folder's password with **argon2id**.
 * Without the password nobody can read them, in the app or on GitHub. The password itself is never
 * stored anywhere: only the salt, the argon2id parameters and an encrypted check value, so a
 * device can verify a password before there is any character to try it on.
 *
 *   folders/locks.json   { app, kind: 'folder-locks', version: 1, locks: FolderLock[] }
 *   characters/<id>.json { app, kind: 'character', version: 1, id, updatedAt, lock, enc }
 *
 * A sealed character only shows its random id, the time of its last change and which lock opens
 * it (the salt); its name, folder and everything else are inside `enc`.
 */

export const FOLDER_LOCKS_PATH = 'folders/locks.json';
const APP = 'dnd-helper';

/** argon2id parameters (OWASP: 19 MiB, 2 passes, 1 lane). Kept per lock so they can grow. */
export interface Argon2Params {
  memoryKiB: number;
  passes: number;
  parallelism: number;
}

export const ARGON2_DEFAULTS: Argon2Params = { memoryKiB: 19_456, passes: 2, parallelism: 1 };

/** Same minimum as the GitHub token's password. */
export const MIN_FOLDER_PASSWORD = 12;

export interface FolderLock {
  /** Folder name (as in Character.folder). */
  folder: string;
  /** base64, 16 random bytes; also the lock's id. */
  salt: string;
  argon2: Argon2Params;
  /** A known text encrypted with the key: a password is right if it decrypts it. */
  check: { iv: string; data: string };
}

export interface FolderLocksFile {
  app: typeof APP;
  kind: 'folder-locks';
  version: 1;
  locks: FolderLock[];
}

export interface SealedCharacterFile {
  app: typeof APP;
  kind: 'character';
  version: 1;
  id: string;
  updatedAt: string;
  /** Salt of the lock whose key opens it. */
  lock: string;
  enc: { iv: string; data: string };
}

/** A key derived from a folder's password (not extractable). */
export interface FolderKey {
  /** = the lock's salt */
  id: string;
  key: CryptoKey;
}

// -- keys ------------------------------------------------------------------------------------------

/** The key of this password for this lock. Slow on purpose (argon2id, ~19 MiB). */
export async function deriveFolderKey(
  password: string,
  salt: string,
  params: Argon2Params,
): Promise<FolderKey> {
  // loaded only when a folder password is used: keeps argon2's WebAssembly out of the main bundle
  const { argon2id } = await import('hash-wasm');
  const raw = await argon2id({
    password,
    salt: fromBase64(salt),
    iterations: params.passes,
    memorySize: params.memoryKiB,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
  const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  return { id: salt, key };
}

const CHECK_TEXT = `${APP}/folder-lock`;

/** A new lock for `folder` with this password, and its key (to use it right away). */
export async function createLock(
  folder: string,
  password: string,
  params: Argon2Params = ARGON2_DEFAULTS,
): Promise<{ lock: FolderLock; key: FolderKey }> {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveFolderKey(password, salt, params);
  const check = await encrypt(key, CHECK_TEXT, checkAad(salt));
  return { lock: { folder, salt, argon2: params, check }, key };
}

/** The lock's key for this password, or null if the password is wrong. */
export async function unlockLock(lock: FolderLock, password: string): Promise<FolderKey | null> {
  const key = await deriveFolderKey(password, lock.salt, lock.argon2);
  const text = await decrypt(key, lock.check, checkAad(lock.salt));
  return text === CHECK_TEXT ? key : null;
}

const checkAad = (salt: string) => `${APP}/folder-lock/${salt}`;

// -- characters ------------------------------------------------------------------------------------

/** Binds the ciphertext to its character: a file renamed to another id doesn't open. */
const characterAad = (id: string, lock: string) => `${APP}/character/${id}/${lock}`;

/** The character encrypted with the folder's key, as it's written to the repo. */
export async function sealCharacter(c: Character, key: FolderKey): Promise<SealedCharacterFile> {
  return {
    app: APP,
    kind: 'character',
    version: 1,
    id: c.id,
    updatedAt: c.updatedAt,
    lock: key.id,
    enc: await encrypt(key, JSON.stringify(c), characterAad(c.id, key.id)),
  };
}

/** The character inside the file, or null if the key is not its lock's or the file is damaged. */
export async function openCharacter(
  file: SealedCharacterFile,
  key: FolderKey,
): Promise<Character | null> {
  if (file.lock !== key.id) return null;
  const text = await decrypt(key, file.enc, characterAad(file.id, file.lock));
  if (text === null) return null;
  try {
    const c = normalizeCharacter(JSON.parse(text));
    return c && c.id === file.id ? c : null;
  } catch {
    return null;
  }
}

export function isSealedCharacterFile(x: unknown): x is SealedCharacterFile {
  const f = x as SealedCharacterFile | null;
  return (
    f?.app === APP &&
    f.kind === 'character' &&
    f.version === 1 &&
    typeof f.id === 'string' &&
    typeof f.updatedAt === 'string' &&
    typeof f.lock === 'string' &&
    typeof f.enc?.iv === 'string' &&
    typeof f.enc?.data === 'string'
  );
}

// -- the locks file --------------------------------------------------------------------------------

export function locksFile(locks: FolderLock[]): FolderLocksFile {
  return { app: APP, kind: 'folder-locks', version: 1, locks };
}

/** The locks in a file read from the repo (anything malformed is dropped). */
export function readLocks(x: unknown): FolderLock[] {
  const f = x as FolderLocksFile | null;
  if (f?.app !== APP || f.kind !== 'folder-locks' || !Array.isArray(f.locks)) return [];
  return f.locks.filter(
    (l): l is FolderLock =>
      typeof l?.folder === 'string' &&
      l.folder.trim() !== '' &&
      typeof l.salt === 'string' &&
      typeof l.argon2?.memoryKiB === 'number' &&
      typeof l.argon2?.passes === 'number' &&
      typeof l.argon2?.parallelism === 'number' &&
      typeof l.check?.iv === 'string' &&
      typeof l.check?.data === 'string',
  );
}

// -- internals -------------------------------------------------------------------------------------

async function encrypt(
  key: FolderKey,
  text: string,
  aad: string,
): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    key.key,
    new TextEncoder().encode(text),
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

async function decrypt(
  key: FolderKey,
  sealed: { iv: string; data: string },
  aad: string,
): Promise<string | null> {
  try {
    const data = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(sealed.iv) as BufferSource,
        additionalData: new TextEncoder().encode(aad),
      },
      key.key,
      fromBase64(sealed.data) as BufferSource,
    );
    return new TextDecoder().decode(data);
  } catch {
    return null;
  }
}
