# 0001. Record architecture decisions

Status: Accepted (retrospective, documented 2026-11-26)

## Context

The project is a personal D&D 5e companion built mostly through delegated work (see the
"Forma de trabajar con el usuario" section of `CLAUDE.md`). Its design choices are scattered:
some are explained in code comments (`app/src/app/core/characters/character-store.service.ts`,
`app/src/app/core/settings/token-vault.ts`), some in READMEs (`app/README.md`,
`tools/scraper/README.md`), some in the audit (`docs/auditoria/arquitectura.md`) and some only in
the "Riesgos conocidos" list of `CLAUDE.md`. A reader who wants to know *why* the app has no
server, or *why* the engine has no per-feature tables, has to reconstruct it from several places.
There was no `docs/adr/` before 2026-11-26.

## Decision

Keep Architecture Decision Records in `docs/adr/`, one Markdown file per decision, numbered
`NNNN-short-title.md`, in English. Each has Title, Status, Context, Decision, Consequences,
Alternatives considered and References. Decisions already embodied in the code are documented
retrospectively (0001-0008) and flagged as such; reasoning that cannot be sourced is labelled
"Inferred rationale". A superseded ADR is not edited away: its status changes and a new ADR
links to it.

## Consequences

Positive:
- A reviewer can read the reasoning and the trade-offs without reading the code first.
- The explicit labelling (recorded vs inferred) keeps the log trustworthy.

Negative:
- One more place to keep in sync with `CLAUDE.md` and the READMEs (they are not generated from
  each other).
- Retrospective ADRs lack the real discussion of alternatives; only those the code supports are
  listed.

## Alternatives considered

- Keep the rationale only in `CLAUDE.md` and code comments (status quo). Inferred rationale:
  cheap, but mixes instructions for the assistant with design history, and is in Spanish.
- A wiki or an external doc tool. Inferred rationale: the repo is already the app's storage and
  documentation home (ADR 0002); docs next to the code are versioned with it.

## References

- `CLAUDE.md`, `app/README.md`, `tools/scraper/README.md`
- `docs/auditoria/arquitectura.md`
- `docs/adr/README.md`
