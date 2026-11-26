# 0004. The rules engine reads the rules text

Status: Accepted (retrospective, documented 2026-11-26)

## Context

The app computes a full D&D 2024 character sheet (ability scores, AC, HP, features by level,
spell grants, per-rest resources, attacks) for 14 classes, 205 subclasses, 313 feats and 89 species
(counts from `docs/auditoria/resumen.md`). Content comes from scraped wiki text (ADR 0008), also
for 2014 material adapted to 2024, and is re-extracted from time to time. A hand-written table per
feature would have to be extended for every class, subclass and feat and would drift from the data.
`CLAUDE.md` states the working rule: "Toda mecánica nueva sale del texto real de `data/*.json`,
con tests Vitest que usen datos reales. Nunca inventes reglas."

## Decision

Make the engine a **pure function over data** that interprets wording patterns in each entry's
`description`, instead of keeping per-feature tables.

- `computeSheet(character, data)` in `app/src/app/core/rules/engine.ts` is documented as pure
  ("same character + same data -> same sheet") and does no edition logic, because the scraper
  already adapts 2014 content to 2024.
- Text readers extract effects from descriptions: `feat-effects.ts` (spells, uses per rest,
  spellcasting ability, resistances, picks), `trait-effects.ts` (speeds, senses, resistances),
  `trait-choices.ts`, `feature-stats.ts` (action, cost, DC), `attacks.ts`
  (`docs/auditoria/arquitectura.md`: "no hay una tabla escrita a mano por rasgo, sino lectores de
  patrones de redacción sobre `description`").
- Some rules remain explicit tables where the text does not carry them, e.g. `FEATURE_USES`
  (class features with a formula) and `pools.ts` (same document, item 4).
- Tests run against the real compendium: `app/src/app/core/rules/real-data.testing.ts` imports
  `data/*.json` ("the specs read the same texts the app shows") and the `*.spec.ts` files in
  `core/rules/` use it.
- The audit compares the engine's computed output with the real text and records gaps
  (`docs/auditoria/`); fixes are made in the engine with tests on real data
  (`docs/auditoria/verificacion.md`).

## Consequences

Positive:
- New or re-scraped content is picked up without code changes when its wording matches an
  existing pattern (inferred from the design).
- The engine is easy to test: pure input and output, with real data as fixtures.
- Honest by construction: what is not in the data is reported (`warnings`, `featMissing` in
  `Sheet`, `docs/auditoria/arquitectura.md`), not invented.

Negative:
- Coverage gaps, measured by the Phase 1 audit (`docs/auditoria/resumen.md`): of 313 feats, 192
  complete, 79 partial, 25 missing; of 89 species (plus variants), 133/20/23 (complete/partial/
  missing); classes and subclasses 490/169/236 (the table counts items, not entries, so totals
  exceed the entry counts). The summary notes that most gaps are 2014/UA subclasses, choices
  inside class features and state-dependent effects. `CLAUDE.md` cites later figures (83 and 135
  untreated numeric traits); this ADR does not claim they are current.
- Brittleness to wording: a wiki edit can silently change what a pattern matches. The only
  guard is the real-data test suite, not a schema.
- The readers are many and heuristic; patterns can interact in non-obvious ways.

## Alternatives considered

- Hand-written per-feature tables. Inferred rationale: rejected for maintenance cost against
  hundreds of subclasses and feats, and drift from re-extracted data.
- Storing structured effects in the scraped JSON. Inferred rationale: would move the pattern
  reading into the Python scraper; not what the code does, and the app would still need to
  interpret it.

## References

- `app/src/app/core/rules/{engine,feat-effects,trait-effects,trait-choices,feature-stats,attacks,pools,sheet}.ts`
- `app/src/app/core/rules/real-data.testing.ts`, `app/src/app/core/rules/engine.spec.ts`
- `docs/auditoria/arquitectura.md`, `docs/auditoria/resumen.md`, `docs/auditoria/verificacion.md`
- `CLAUDE.md` (hard rules), `.claude/skills/reglas/SKILL.md`
