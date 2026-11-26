# 0008. The compendium is generated, not hand-written

Status: Accepted (retrospective, documented 2026-11-26)

## Context

The app needs a unified compendium (classes, subclasses, species, feats, spells, items,
monsters...) in English and Spanish. The sources are two wikis with different layouts, 2014 and
2024 rules (`dnd5e.wikidot.com`, `dnd2024.wikidot.com`) and, for the 331 monsters, the SRD 5.2 via
public APIs (`tools/scraper/README.md`). The app targets 2024 rules, so 2014 content must be
adapted. Extraction takes about 4,300 pages (about an hour at one request per 0.5 s, same README),
and the free translator rate-limits.

## Decision

`data/*.json` and `data/es/*.json` are **build artefacts of the Python scraper** in
`tools/scraper/` and are never the source of truth.

- **One schema from two wikis.** Per-type converters in `tools/scraper/dndscraper/` produce the
  same JSON schema, then adapt 2014 to 2024 (species, subclasses, feats, fighting styles), merge
  duplicates keeping 2024 and recording the 2014 version in `replaced`, and note every change in
  an `adjustments` field (`tools/scraper/README.md`, "Qué hace").
- **Rule of gold.** Any data change needs a scraper rule plus the regenerated JSON in the same
  commit, since the next extraction overwrites hand edits (`.claude/skills/datos/SKILL.md`;
  `CLAUDE.md`, hard rules and risk 9). Name overrides and fixes live in YAML next to the scraper
  (`names.es.yaml`, `fixes.es.yaml`, `terms.es.yaml`, `successors.yaml`, `multiclass.yaml`).
- **Validator as a gate.** `python -m dndscraper.validate` (`dndscraper/validate.py`) checks the
  output (for example, excluded content must not reappear, also in the translated copy); the
  extraction workflow runs it and does not commit if it fails
  (`.github/workflows/scrape.yml`, `tools/scraper/README.md`, "Mantenimiento").
- **Translation with a budget, resumable.** `dndscraper.translate` only sends new or changed
  texts, caches them in `translations.es.json`, and stops at `--translate-budget` (90 minutes in
  the extraction run). A scheduled workflow (`translate.yml`, cron every 3 hours) resumes until
  `meta.json` says the translation is complete, then does nothing. It shares a concurrency group
  with the extraction so they never write data at once.
- **Offline regeneration of Spanish.** `translate --offline` rebuilds `data/es/` from the cache
  after editing names/fixes. `CLAUDE.md` forbids running the full online extraction from an
  agent session.
- **Glossary enforced by CI.** `app/scripts/check-glossary.mjs` fails when a game term found in
  `data/` lacks an entry in `app/src/app/core/i18n/glossary.es.json` (closed domains fail, open
  ones warn). It runs in `.github/workflows/app.yml` and in `verify.sh`.
- **Cache coupling.** Data changes must bump `data/meta.json` (ADR 0003), checked by `verify.sh`.

## Consequences

Positive:
- Re-extractable, consistent data; fixes are encoded as rules, not lost edits.
- Translation survives rate limits and partial runs; progress is visible in the job summary.
- Provenance of 2014 adaptations is recorded per entry (`adjustments`, `replaced`).

Negative:
- Dependence on third-party wiki HTML: a layout change breaks the scraper (`CLAUDE.md`, risk 5);
  the validator detects it, and current data stays valid.
- Using a free public translator and community wikis limits quality, and some Spanish names
  needed manual decisions (`CLAUDE.md`: fixed names like "Tiflin"). I did not verify the licensing
  of the wiki content; only the SRD 5.2 CC-BY attribution is documented
  (`tools/scraper/README.md`).
- The "no hand edits" rule is awkward: some fixes (for example species `reprint` variants) are
  described in the README as hand-correctable in both JSON files plus the scraper heuristic.
- A full extraction rewrites all data, so every run needs `git diff` review (`CLAUDE.md`, risk 9).

## Alternatives considered

- Maintain the JSON by hand. Inferred rationale: thousands of entries in two languages and two
  editions are impractical to keep consistent.
- A runtime scrape or API in the app. Inferred rationale: contradicts offline-first (ADRs 0002,
  0003) and exposes the app to wiki outages.
- Paid/LLM translation. Not evidenced in the repository for compendium translation; the code uses
  the free Google translator (`tools/scraper/README.md`).

## References

- `tools/scraper/README.md`, `tools/scraper/dndscraper/{validate,translate}.py`
- `tools/scraper/{names,fixes,terms}.es.yaml`, `successors.yaml`, `multiclass.yaml`
- `.github/workflows/{scrape,translate,app}.yml`
- `app/scripts/check-glossary.mjs`, `app/src/app/core/i18n/glossary.es.json`
- `.claude/skills/datos/SKILL.md`, `.claude/skills/verificar/verify.sh`, `CLAUDE.md`
