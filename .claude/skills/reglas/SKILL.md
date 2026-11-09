---
name: reglas
description: Cómo añadir o arreglar mecánicas de D&D 2024 en el motor de reglas de D&D Helper (hoja de personaje calculada) - dotes, rasgos de clase/especie/subclase, elecciones del jugador (X o Y, sub-opciones dentro de un rasgo, maestría de armas), ataques, recursos por descanso y avisos. Úsala cuando el usuario diga que algo "no se aplica", "se aplican las dos opciones", "no sale el selector" o pida una mecánica nueva.
---

# Motor de reglas

`computeSheet(character, data)` (`app/src/app/core/rules/engine.ts`) calcula **toda** la hoja a
partir del personaje guardado (elecciones) y el compendio (`data/*.json`). La UI solo pinta `Sheet`.

## Antes de tocar nada

1. Lee el **texto real** en `data/*.json` (clase/subclase/dote/especie/objeto). Cópialo a los tests.
   Si el usuario recuerda una regla distinta al texto, dile lo que dice el texto; no inventes.
2. Reprodúcelo con un test que use datos reales (patrón: `rules/feat-grants.spec.ts`,
   `rules/species-trait-choice.spec.ts`: un `DATA: RulesData` con los JSON y un `build()` del
   personaje). Primero rojo, luego arreglo.

## Dónde va cada cosa

| Mecánica | Lugar |
| --- | --- |
| Efectos leídos del texto de **dotes** (conjuros concedidos, usos, velocidad, PG, CA, competencias) | `rules/feat-effects.ts` (`featRules`) |
| Elecciones que pide una dote (habilidad A o B, característica, lista de conjuros, resistencia) | `FEAT_PICKS` en `feat-effects.ts` + UI genérica `shared/feat-choices.ts` + `character.choices.featChoices` |
| Efectos incondicionales de **rasgos** (sentidos, resistencias, velocidades, iniciativa, CA sin armadura, estilos de combate) | `rules/trait-effects.ts` |
| Rasgo de especie con "elige una de estas opciones" en el texto | `rules/trait-choices.ts` (`TRAIT_CHOICE_KEYS`) + `shared/trait-choice.ts` + `choices.traitChoices` |
| Variante de especie (sub-raza real vs. reimpresión) | `chosenVariant()` en `engine.ts`; dato `reprint` (skill `datos`) |
| Filas de ataque (armas, golpe sin armas, armas sintéticas como Psychic Blade), notas de combate | `rules/attacks.ts`; flags en `combatOf()` de `engine.ts` y `CombatInfo` en `rules/sheet.ts` |
| Maestría de armas | `weaponMasterySlots()` / `masteryChosen` en `engine.ts`; `choices.weaponMasteries` |
| Recursos gastables y recuperación en descanso | `core/play/play-state.ts`, `core/play/rest-rules.ts` |
| Objetos mágicos con base / mejoras / con conjuro | `core/characters/magic-base.ts`, `enhancement.ts`, `core/spell-items/` |
| Avisos "falta elegir" | `warnings.push({ key: 'sheet.warn.…' })` en `engine.ts` + tipo en `sheet.ts` + textos es/en; en el asistente, `review()` de `core/creation/creation-rules.ts` |

## Principios (errores que ya pasaron)

- **"X o Y" es una elección**, nunca "aplica las dos". Sin elegir: no aplica **ninguna** y avisa.
- Elecciones **reales** frente a texto que solo menciona opciones: si el texto se re-elige en cada
  uso (Fey Gift, Aura of Unlight...), no es una elección de ficha; déjalo como texto.
- Un rasgo con efecto mecánico que no se puede calcular (reacción, situacional) debe al menos
  **verse** en la hoja con su texto ("Ver más").
- Campos nuevos en `Character.choices` u otros: **opcionales** y normalizados en
  `normalizeCharacter` (`core/models/character.ts`): hay personajes viejos guardados.
- Una regla nueva que añade un aviso puede romper tests de otras áreas cuyos *fixtures* no
  eligen lo nuevo: ajusta el fixture, no quites el aviso.
- `rules/effects-audit.spec.ts` recorre los datos y falla si una frase mecánica incondicional de
  2024 deja de aplicarse: si lo rompes, o lo aplicas o lo justificas en su lista `TEXT_ONLY`.

## Comprobar

Tests (`bash .claude/skills/verificar/verify.sh`) y, si cambia lo que se ve, la skill `probar-ui`
con un personaje que tenga esa mecánica (hay personajes reales en `characters/*.json`).
