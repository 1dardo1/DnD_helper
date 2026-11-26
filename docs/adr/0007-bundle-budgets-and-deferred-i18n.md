# 0007. Bundle budgets and deferred i18n

Status: Accepted (retrospective, documented 2026-11-26)

## Context

The app is used on phones, in a WebView (APK) and as a PWA, often on weak networks (see ADR 0003).
The UI is bilingual and its Spanish dictionary is large: `core/i18n/es.ts` is about 100 kB of
source and `en.ts` about 94 kB. `CLAUDE.md` (risk 1) records that the initial bundle is about
455 kB and that almost all of it is Angular plus `es.ts`.

## Decision

Treat the initial bundle as a budgeted resource and keep everything not needed for the first
screen out of it.

- **Budgets** in `app/angular.json` (production configuration): `initial` warns at 600 kB and
  errors at 1 MB; `anyComponentStyle` warns at 12 kB and errors at 20 kB. `CLAUDE.md` notes that
  `character-create.scss` (12.2 kB) already exceeds the style warning, and says to split or defer
  rather than raise limits "a ciegas".
- **Per-route lazy chunks.** Every page uses `loadComponent` with a dynamic import
  (`app/src/app/app.routes.ts`; header comment: "Every page is its own chunk"). Even the route
  guard for locked folders is imported on demand so the character store stays out of the first
  load (`folderUnlocked` in `app.routes.ts`). Likely-next pages carry `data: { preload: true }` and
  are downloaded when idle, not on 2G or with data saver (`core/navigation/idle-preloading.ts`).
- **Language split.** Spanish ships in the first load; English is a separate chunk loaded when
  chosen, awaited before first render (`core/i18n/i18n.service.ts`). The comment records a
  measurement: making Spanish lazy too delayed first render by about 350 ms on a slow mobile
  network, so it was not done.
- **Deferred i18n files.** Texts of areas with their own chunk live in
  `core/i18n/{combat,sheet,settings,browse,wizard,folders,states}.{es,en}.ts` and are registered
  with `I18nService.extend()` when the component is created (for example
  `features/characters/combat-tab.ts`). `CLAUDE.md` makes this a rule and warns that any key read
  by an always-loaded screen (nav bar, route titles) must stay in `es.ts`/`en.ts`.
- **`@defer`.** The shell's sync status (`shell/shell-status.ts`) and the APK update notice are
  `@defer (on idle)` blocks in `app/src/app/app.html`, so the character store and sync services
  are not in the initial bundle. `CLAUDE.md`: do not import character or encounter services from
  `app.ts`.
- **Heavy dependencies on demand.** `hash-wasm` (argon2) is `import()`ed only when a folder
  password is used (`core/organize/folder-lock.ts`); `CLAUDE.md` also mentions the PDF export as
  loaded lazily.

## Consequences

Positive:
- Fast first load; the budget is checked by the production build, and `verify.sh` runs it
  (`.claude/skills/verificar/verify.sh`).
- A clear discipline for contributors, including automated delegates.

Negative:
- Subtle failure mode: a key moved to a deferred file but still read by the shell renders as the
  raw key. Guarded only by rule and review, plus `check-glossary` for game terms
  (`app/scripts/check-glossary.mjs`).
- Sync status appears slightly after first render, and synchronisation starts only after the
  first page is on screen (stated in the `shell-status.ts` comment).
- More files and conventions; two dictionaries to keep key-aligned (`TranslationKey` is typed on
  `en.ts`).
- The app waits for the English chunk before first render when English is selected.

## Alternatives considered

- Raise the budgets. Rejected in the project's own words: "no subir límites a ciegas"
  (`CLAUDE.md`).
- Lazy-load Spanish too. Measured and rejected (comment in `i18n.service.ts`).
- Runtime-fetched translation JSON. Inferred rationale: would add requests and a loading state;
  typed TS dictionaries keep key checking at compile time.

## References

- `app/angular.json`, `app/src/app/app.routes.ts`, `app/src/app/app.html`
- `app/src/app/shell/shell-status.ts`, `app/src/app/core/navigation/idle-preloading.ts`
- `app/src/app/core/i18n/{i18n.service,es,en,combat.es,sheet.es,settings.es,browse.es,wizard.es}.ts`
- `CLAUDE.md` (hard rules, risk 1)
