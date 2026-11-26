# 0005. The character model stores decisions, not results

Status: Accepted (retrospective, documented 2026-11-26)

## Context

A character file is committed to GitHub and cached on several devices (ADR 0002). Files written by
older app versions stay in the repo and on devices indefinitely (`CLAUDE.md`, risk 8). The rules
engine (ADR 0004) can derive almost everything about a sheet from the character's choices and the
compendium.

## Decision

`Character` (`app/src/app/core/models/character.ts`) stores only what the player decided plus play
state; everything derivable is computed by `computeSheet` into a `Sheet`
(`app/src/app/core/rules/sheet.ts`).

- The file header says it: "It stores choices only; everything derivable (modifiers, proficiency
  bonus, slots...) is computed by the rules engine when loaded."
- Decisions: `classes[]` (id, level, subclass, HP per level), species, background, ability scores
  and `choices` (skills, feats and feat slots, feat choices, trait picks, spells by class, weapon
  masteries...). Play state: `state` (HP, spent slots, resource uses, conditions, active states,
  concentration...). Both lists are in `docs/auditoria/arquitectura.md`, items 1 and 2.
- **Schema versioning.** `schemaVersion` is the literal `1`. No migration chain exists:
  instead, every new field must be optional and defaulted in `normalizeCharacter`, which spreads
  `newCharacter(...)` defaults under the stored data and normalises nested parts
  (`choices`, `equipped`, `inventory`, `state`, `classes`, `folder`, `portrait`).
  The rule is written in `CLAUDE.md` (risk 8).
- Every read path goes through the normaliser: `CharacterStore` decodes repo files with it, and
  the folder-lock code calls it on opened characters (`core/organize/folder-lock.ts`).
- Records pair a character with sync metadata (`CharacterRecord`: status, `baseSha`, `sentSha`,
  `remote`), kept outside the character file.

## Consequences

Positive:
- Rule fixes and re-scraped data change existing characters' sheets with no data migration;
  the files stay small and diff-friendly in git.
- Old files keep loading: missing fields take defaults.
- Concurrent edits conflict on decisions, not on derived numbers (conflict screen shows only what
  differs, `app/README.md`).

Negative:
- A sheet's numbers can change when rules code or compendium data changes (nothing freezes a
  historical result). `Character.dataVersion` exists, but I did not trace how it is used.
- Every sheet render needs the compendium and a computation; there is no cheap list view with HP
  and AC (`CLAUDE.md`, pending: "Lista de personajes con PG y CA... exige calcular cada hoja").
- With a single schema version, a *breaking* change (renaming or reinterpreting a field) has no
  migration path; only additive change is supported. A reader of old files by newer code relies
  on defaults being right.
- Newer files read by older app versions (stale PWA/APK) are not guarded by the version field,
  since it never changes (inferred from the code).

## Alternatives considered

- Store computed values (AC, HP max, slots) in the file. Inferred rationale: rejected because it
  would go stale when rules change and add conflicts.
- Versioned migrations (v1 -> v2 functions). Inferred rationale: not needed while all changes
  are additive; the code has none.

## References

- `app/src/app/core/models/character.ts` (`Character`, `CharacterRecord`, `normalizeCharacter`)
- `app/src/app/core/rules/{engine,sheet}.ts`
- `app/src/app/core/characters/character-store.service.ts`, `core/organize/folder-lock.ts`
- `docs/auditoria/arquitectura.md`, `CLAUDE.md` (risk 8)
