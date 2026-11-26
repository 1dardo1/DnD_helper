# 0003. Offline-first compendium cache

Status: Accepted (retrospective, documented 2026-11-26)

## Context

The compendium (`data/*.json`, plus Spanish `data/es/*.json`) is large; `data/items.json` is over
1 MB (comment in `github-data-source.ts`). It changes only when the scraper or the translation
job commits (ADR 0008), but it is used at the gaming table, often with a weak or no connection.

## Decision

Cache every compendium file in IndexedDB and download it again only when `data/meta.json` says a
new version exists (`app/src/app/core/compendium/compendium.service.ts`).

- A file's cache key is `file:<folder><type>`; its version is
  `meta.generatedAt|meta.translatedAt`. If the cached version equals the current one, the cached
  entries are used; otherwise the file is fetched and stored (`loadFile`).
- `data/meta.json` itself is requested each session. When a cached copy exists, the network gets
  `metaTimeoutMs = 4000` to answer; after that the cached meta is used, and a late answer is still
  saved for next time (`loadMeta`). If the network fails and a cache exists, the app serves it
  and sets the `offline` signal.
- Cache storage is the `compendium` store of `LocalDb` (`core/storage/local-db.ts`); `refresh()`
  clears it.
- The invalidation contract is enforced for contributors: `verify.sh` fails if `data/` changed
  without `data/meta.json` changing, noting that devices re-download only when
  `translatedAt`/`generatedAt` changes (`.claude/skills/verificar/verify.sh`).
- The GitHub Pages and APK builds also bundle `data/` (`BUNDLED_DATA` in
  `repository.service.ts`; `scripts/bundle-data.mjs` in `.github/workflows/pages.yml`), so the
  compendium works without a token.

## Consequences

Positive:
- Works offline after the first load; a weak connection delays pages by at most 4 s once data is
  cached (the code comment gives that motivation).
- Unchanged data costs one small request (`meta.json`), not megabytes.

Negative:
- Correctness rests on a convention: any data change must bump `meta.json`. It is guarded by the
  local `verify.sh`; I found no equivalent step in `.github/workflows/app.yml`.
- Stale data is possible until reload (`CLAUDE.md`, risk 2: PWA and APK show old versions).
- A whole file is re-downloaded for any change; there is no per-entry diffing.
- With neither cache nor network the app shows a load error (`CLAUDE.md` lists a friendlier
  retry message as pending).

## Alternatives considered

- Rely on the service worker HTTP cache only. Inferred rationale: it cannot express the
  `meta.json` version rule or the explicit 4 s fallback, nor drive the in-app `offline` signal.
- Bundle the compendium only. Partly done for Pages and APK, but reading the repo lets data
  updates reach the app without a new release (inferred).

## References

- `app/src/app/core/compendium/compendium.service.ts`
- `app/src/app/core/storage/local-db.ts`, `app/src/app/core/data/repository.service.ts`
- `.claude/skills/verificar/verify.sh`, `.github/workflows/pages.yml`, `app/scripts/bundle-data.mjs`
- `data/meta.json`
