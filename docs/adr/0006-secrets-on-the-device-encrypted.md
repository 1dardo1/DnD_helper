# 0006. Secrets live on the device, encrypted

Status: Accepted (retrospective, documented 2026-11-26)

## Context

With the repository as the backend (ADR 0002) the app needs a GitHub credential on every device,
and there is no server to hold it. Separately, the repository's files can be read by anyone with
access to it, so private content (some characters, DM encounters) cannot rely on server-side
access control. Both points are stated in the code comments of `token-vault.ts`,
`folder-lock.ts` and `encounter-crypto.ts`.

## Decision

**GitHub token.** The user supplies a fine-grained personal access token scoped to this
repository with "Contents: read and write" (`app/README.md`; UI text in
`core/i18n/es.ts`/`en.ts`). It is stored per device in `localStorage` under `dnd-helper.settings`
(`core/settings/settings.service.ts`): in plain text, only in that browser or app.

**Optional encrypted copy for new devices.** `token-vault.ts` encrypts the token with a
user-chosen password (AES-GCM 256, key from PBKDF2-SHA-256, 600,000 iterations, random 16-byte
salt, 12-byte IV, minimum password length 12) and the settings page commits the result to
`app/public/token.enc.json` (`ENCRYPTED_TOKEN_PATH`). The file is served with the app, so a new
device needs only the password. Stated reason in the code: "PBKDF2 with many iterations makes
guessing a long password impractical".

**Folder locks.** Characters in a password-protected folder are written to the repo encrypted:
AES-GCM 256 with a key from **argon2id** (19,456 KiB, 2 passes, 1 lane, OWASP figures per the
comment; parameters stored per lock so they can grow), loaded lazily from `hash-wasm`. The
password is never stored: only salt, parameters and an encrypted check value
(`folders/locks.json`). Ciphertext is bound to the character id and lock through AAD. Minimum
password length 12 (`core/organize/folder-lock.ts`).

**DM key.** Encounters are sealed with a DM password via PBKDF2-SHA-256 at the same 600,000
iterations (`core/dm/encounter-crypto.ts`, `dm/key.json`). Derived keys are non-extractable
`CryptoKey`s and can be kept in IndexedDB (`keys` store, `encounter-vault.service.ts`).

## Consequences

What is protected:
- Content of locked folders and encounters on GitHub, against anyone without the password. Only
  a random id, update time and lock id remain readable.
- The token against a thief who has only the repo or the deployed site and not the password.

What is not:
- `token.enc.json` is **public** (served with the app, committed in the repo). Anyone can download
  it and guess passwords offline. Protection equals password strength; the 12-character minimum
  and 600k iterations only slow guessing. A weak password makes the token recoverable.
- The token on each device is plaintext in `localStorage`; anyone with the unlocked
  device/browser profile, or an XSS in the app, can read it.
- Metadata leaks: file existence, count, sizes, commit times and commit messages. Messages
  avoid names for protected folders (`character-store.service.ts` uses a generic message), but
  folder-lock locations and salts are public.
- Argon2/PBKDF2 do not protect against a password the user forgets: there is no recovery
  (inferred: the password is never stored).
- A fine-grained PAT limits the blast radius to one repository, but with "Contents: read and
  write" it can still rewrite every file in that repository.

Other:
- Extra code and a WASM dependency (kept lazy to protect the bundle, ADR 0007).
- The token expires; the user must renew it (`CLAUDE.md`, risk 3).

## Alternatives considered

- OAuth app or GitHub App with a token-exchange backend. Inferred rationale: requires a server,
  which the architecture avoids (ADR 0002).
- Plain-text token typed on each device. Inferred rationale: the encrypted copy exists to make
  new-device setup a one-password step.
- Different KDFs: the codebase uses PBKDF2 (native WebCrypto, no dependency) for the token and DM
  key and argon2id (WASM) for folders. The reason for the split is not documented; inferred as
  "native where possible, memory-hard where a wasm dependency is acceptable".

## References

- `app/src/app/core/settings/{token-vault,settings.service}.ts`, `app/public/token.enc.json`
- `app/src/app/core/organize/{folder-lock,folder-lock.service}.ts`
- `app/src/app/core/dm/{encounter-crypto,encounter-vault.service}.ts`
- `app/src/app/features/settings/settings-page.ts`, `app/README.md`
