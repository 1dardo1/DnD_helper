# 0002. The GitHub repository is the backend

Status: Accepted (retrospective, documented 2026-11-26)

## Context

Characters (and later the DM's encounters and custom backgrounds) must survive across the
owner's devices, phone APK and web PWA, and must be usable without a connection (`CLAUDE.md`:
"Offline-first: personajes en JSON (repo GitHub + IndexedDB)"). The app is personal and the code
contains no server component of its own. Characters live in `characters/<id>.json` inside the
same repository as the code and the compendium (`CLAUDE.md`, structure table).

## Decision

Use the GitHub repository as the only persistent backend, through the REST "contents" API, and
keep a full local copy on every device.

- **Data source abstraction.** `DataSource` (`app/src/app/core/data/data-source.ts`) has two
  implementations: `GitHubDataSource` (every write is a commit, `github-data-source.ts`) and a
  read-only `LocalDataSource`. `RepositoryService` picks one; without a token it falls back to
  the bundled or dev-served files (`repository.service.ts`).
- **Optimistic concurrency with the git blob sha.** `writeJson(path, content, sha, message)`
  creates (sha `null`) or updates a file; GitHub answers 409/422 when the sha is stale, mapped to
  `ConflictError`. JSON is serialised deterministically (`toJsonText`) so identical content gives
  an identical sha, and `gitBlobSha` (`git-sha.ts`) computes locally the id GitHub would report.
- **Confirm after write.** Each record moves `local -> sent -> synced`. After a commit the store
  re-lists `characters/` and marks `synced` only if the repo sha equals the sha returned by the
  write (`verify`/`confirm` in `character-store.service.ts`). An unconfirmed `sent` record is
  confirmed or re-sent on the next sync.
- **Conflict resolution UI.** If the repo moved, the record becomes `conflict` and keeps both
  versions; the user keeps this one, the other, or both (methods on `CharacterStore`; behaviour
  described in `app/README.md`, "Personajes y sincronización"). Pull never overwrites local
  changes, and deleting a character that changed elsewhere restores the other version.
- **Offline-first local store.** `LocalDb` (`core/storage/local-db.ts`) is a small IndexedDB
  key-value store (stores `compendium`, `characters`, `encounters`, `keys`, `homebrew`), with an
  in-memory fallback when IndexedDB is unavailable.
- **Sync triggers.** `SyncService` (`core/characters/sync.service.ts`) syncs on app start, on the
  `online` event, every 5 minutes, right after a save, and 5 s after in-game edits settle
  (`saveSoon`). Concurrent calls coalesce into one extra round. Each round is pull then push.

## Consequences

Positive:
- No hosting, database or auth server to run or pay for (inferred from the absence of server
  code; deployment is GitHub Pages plus an APK, `.github/workflows/pages.yml`, `apk.yml`).
- Version history, and the discarded side of a conflict, come for free as git commits
  (`app/README.md`: "La versión descartada sigue en el historial de git").
- Conflict detection needs no server logic: the sha is the version token.

Negative:
- The user must create and renew a fine-grained PAT; expiry stops sync with 401 errors
  (`CLAUDE.md`, risk 3). Storage of the token: ADR 0006.
- One commit per character change makes noisy history, and GitHub API rate limits apply. The code
  batches taps (`SOON_MS`) but has no explicit rate-limit handling; a `DataSourceError` simply
  retries on the next round.
- Confirmation uses a directory listing of `characters/`. GitHub documents a 1,000-file cap on
  that listing (external knowledge, not stated in the repo): fine for a personal app, a ceiling
  otherwise.
- Files in `characters/` are readable by anyone with repo access, which forced client-side
  encryption for protected folders and encounters (ADR 0006).
- The sync state machine (five states plus conflicts) is non-trivial client code.

## Alternatives considered

- A hosted backend or database (Firebase, Supabase, own API). Inferred rationale: adds an
  account, cost and an auth system for a single-user app.
- Device-only storage with file export. Partly adopted as a safety net: `backup.ts` and
  `backup.service.ts` export and import JSON (`app/README.md`).
- Last-write-wins instead of a conflict UI. Rejected by the code's own stated invariant:
  "Nothing is ever overwritten silently" (header of `character-store.service.ts`).

## References

- `app/src/app/core/data/{data-source,github-data-source,git-sha,repository.service}.ts`
- `app/src/app/core/characters/{character-store.service,sync.service,backup}.ts`
- `app/src/app/core/storage/local-db.ts`
- `app/README.md` ("Personajes y sincronización"), `CLAUDE.md` (risks 3 and 4)
