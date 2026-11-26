# Architecture Decision Records

This folder records the architecturally significant decisions of D&D Helper (Angular 21 PWA +
Capacitor APK, Python scraper, GitHub as storage). Each ADR follows the same shape: Context,
Decision, Consequences, Alternatives considered, References.

The rest of the repository documentation is in Spanish; the ADRs are in English on purpose.

## Retrospective ADRs (0001-0008)

ADRs 0001-0008 were written on 2026-11-26, **after** the decisions were implemented. They are
reconstructed from the code and from the existing docs (`CLAUDE.md`, `app/README.md`,
`tools/scraper/README.md`, `docs/auditoria/`). Rules used while writing them:

- Every claim cites a file that exists in the repository.
- Where the reason for a decision is written down somewhere (a code comment, a README), the ADR
  quotes or paraphrases it as the rationale.
- Where it is not, the ADR says **"Inferred rationale"**: a plausible reading of the code, not
  recorded history. No dates, numbers or history are invented.

Later ADRs (0009 onward) are meant to be written before or while the decision is made.

## Index

| Number | Title | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted (retrospective, documented 2026-11-26) |
| [0002](0002-github-repository-as-the-backend.md) | The GitHub repository is the backend | Accepted (retrospective, documented 2026-11-26) |
| [0003](0003-offline-first-compendium-cache.md) | Offline-first compendium cache | Accepted (retrospective, documented 2026-11-26) |
| [0004](0004-rules-engine-reads-the-rules-text.md) | The rules engine reads the rules text | Accepted (retrospective, documented 2026-11-26) |
| [0005](0005-character-model-stores-decisions-not-results.md) | The character model stores decisions, not results | Accepted (retrospective, documented 2026-11-26) |
| [0006](0006-secrets-on-the-device-encrypted.md) | Secrets live on the device, encrypted | Accepted (retrospective, documented 2026-11-26) |
| [0007](0007-bundle-budgets-and-deferred-i18n.md) | Bundle budgets and deferred i18n | Accepted (retrospective, documented 2026-11-26) |
| [0008](0008-generated-compendium-pipeline.md) | The compendium is generated, not hand-written | Accepted (retrospective, documented 2026-11-26) |
| 0009 | Rules assistant: retrieval in the browser, generation behind a proxy | Proposed |
| 0010 | The assistant proxy runs as a Cloudflare Worker | Proposed |
