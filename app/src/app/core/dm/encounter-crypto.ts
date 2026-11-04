import { PASSWORD_ITERATIONS, deriveKey, fromBase64, toBase64 } from '../settings/token-vault';
import { Encounter, normalizeEncounter } from './encounter';

/**
 * Encounters in the repo, which anyone can read: each one is a file encrypted with a password
 * that only the DM knows (AES-GCM 256, key from the password with PBKDF2-SHA-256, the same
 * functions as the GitHub token's vault).
 *
 *   encounters/<id>.json  { app, kind: 'encounter', version: 1, id, updatedAt,
 *                           enc: { iterations, salt, iv, data } }
 *   dm/key.json           { app, kind: 'dm-key', version: 1, iterations, salt, check: { iv, data } }
 *
 * Only the random id and the time of the last change are readable; name, party, monsters and
 * notes are all inside `data`. A key is identified by its salt: every encounter protected with
 * the DM's password uses the salt of dm/key.json, so that password (derived once) opens all of
 * them; an encounter with a password of its own carries a salt of its own. `check` lets a device
 * verify the DM's password before there is any encounter to try it on.
 */

export const ENCOUNTERS_DIR = 'encounters';
export const DM_KEY_PATH = 'dm/key.json';
const APP = 'dnd-helper';

/** Salt and iterations: what's needed, with the password, to derive a key. Not secret. */
export interface KeyParams {
  iterations: number;
  /** base64; also the key's id. */
  salt: string;
}

/** A key derived from a password (not extractable: it can't be read back). */
export interface VaultKey extends KeyParams {
  /** = salt */
  id: string;
  key: CryptoKey;
}

export interface Sealed extends KeyParams {
  /** base64, 12 random bytes, new for every encryption. */
  iv: string;
  /** base64: AES-GCM ciphertext and tag. */
  data: string;
}

export interface EncounterFile {
  app: typeof APP;
  kind: 'encounter';
  version: 1;
  id: string;
  updatedAt: string;
  enc: Sealed;
}

export interface DmKeyFile extends KeyParams {
  app: typeof APP;
  kind: 'dm-key';
  version: 1;
  check: { iv: string; data: string };
}

export function encounterPath(id: string): string {
  return `${ENCOUNTERS_DIR}/${id}.json`;
}

/** The id in "encounters/<id>.json". */
export function encounterIdOf(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '');
}

/** New salt (16 random bytes) for a new password. */
export function newKeyParams(iterations = PASSWORD_ITERATIONS): KeyParams {
  return { iterations, salt: toBase64(crypto.getRandomValues(new Uint8Array(16))) };
}

/** The key of this password and salt. Slow on purpose (PBKDF2, 600,000 iterations). */
export async function keyFromPassword(password: string, params: KeyParams): Promise<VaultKey> {
  const key = await deriveKey(password, fromBase64(params.salt), params.iterations);
  return { id: params.salt, salt: params.salt, iterations: params.iterations, key };
}

// -- encounters -------------------------------------------------------------------------------

/** Binds the ciphertext to its encounter: a file renamed to another id doesn't open. */
const encounterAad = (id: string) => `${APP}/encounter/${id}`;

/** The encounter encrypted with this key, as it's written to the repo. */
export async function sealEncounter(e: Encounter, key: VaultKey): Promise<EncounterFile> {
  return {
    app: APP,
    kind: 'encounter',
    version: 1,
    id: e.id,
    updatedAt: e.updatedAt,
    enc: await encrypt(key, JSON.stringify(e), encounterAad(e.id)),
  };
}

/** The encounter inside the file, or null if the key is not the one it was encrypted with. */
export async function openEncounter(file: EncounterFile, key: VaultKey): Promise<Encounter | null> {
  if (file.enc.salt !== key.salt) return null;
  const text = await decrypt(key, file.enc, encounterAad(file.id));
  if (text === null) return null;
  try {
    const e = JSON.parse(text);
    if (e?.id !== file.id) return null;
    return normalizeEncounter(e);
  } catch {
    return null;
  }
}

/** Tries a password on an encounter file: its key and content, or null if it's wrong. */
export async function unlockEncounter(
  file: EncounterFile,
  password: string,
): Promise<{ key: VaultKey; encounter: Encounter } | null> {
  const key = await keyFromPassword(password, file.enc);
  const encounter = await openEncounter(file, key);
  return encounter ? { key, encounter } : null;
}

export function isEncounterFile(x: unknown): x is EncounterFile {
  const f = x as EncounterFile | null;
  return (
    f?.app === APP &&
    f.kind === 'encounter' &&
    f.version === 1 &&
    typeof f.id === 'string' &&
    typeof f.updatedAt === 'string' &&
    isSealed(f.enc)
  );
}

// -- the DM's password -----------------------------------------------------------------------

const CHECK_TEXT = `${APP}/dm-key`;

export async function makeDmKeyFile(key: VaultKey): Promise<DmKeyFile> {
  const { iv, data } = await encrypt(key, CHECK_TEXT, CHECK_TEXT);
  return {
    app: APP,
    kind: 'dm-key',
    version: 1,
    iterations: key.iterations,
    salt: key.salt,
    check: { iv, data },
  };
}

/** The DM's key for this password, or null if the password is wrong. */
export async function unlockDmKey(file: DmKeyFile, password: string): Promise<VaultKey | null> {
  const key = await keyFromPassword(password, file);
  const text = await decrypt(key, { ...file, ...file.check }, CHECK_TEXT);
  return text === CHECK_TEXT ? key : null;
}

export function isDmKeyFile(x: unknown): x is DmKeyFile {
  const f = x as DmKeyFile | null;
  return (
    f?.app === APP &&
    f.kind === 'dm-key' &&
    f.version === 1 &&
    typeof f.salt === 'string' &&
    typeof f.iterations === 'number' &&
    typeof f.check?.iv === 'string' &&
    typeof f.check?.data === 'string'
  );
}

// -- internals -----------------------------------------------------------------------------------

function isSealed(s: unknown): s is Sealed {
  const x = s as Sealed | null;
  return (
    typeof x?.iterations === 'number' &&
    typeof x.salt === 'string' &&
    typeof x.iv === 'string' &&
    typeof x.data === 'string'
  );
}

async function encrypt(key: VaultKey, text: string, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    key.key,
    new TextEncoder().encode(text),
  );
  return {
    iterations: key.iterations,
    salt: key.salt,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

async function decrypt(key: VaultKey, sealed: Sealed, aad: string): Promise<string | null> {
  try {
    const data = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(sealed.iv),
        additionalData: new TextEncoder().encode(aad),
      },
      key.key,
      fromBase64(sealed.data),
    );
    return new TextDecoder().decode(data);
  } catch {
    return null; // wrong key, or the file was altered
  }
}
