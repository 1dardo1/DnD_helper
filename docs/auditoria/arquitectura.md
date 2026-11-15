# Cómo modela D&D Helper las reglas (guía para la auditoría)

App Angular 21 en `app/`. Los datos del juego son JSON generados por el scraper (`data/*.json`; en
español en `data/es/`). El motor es **puro y lee el texto real**: no hay una tabla escrita a mano
por rasgo, sino lectores de patrones de redacción sobre `description`.

1. **Personaje** (`app/src/app/core/models/character.ts`, `Character`): solo guarda lo que el
   jugador decide. `classes[]` (id, nivel, `subclassId`, PG por nivel), `species {id, variant}`,
   `background`, `abilityScores`, y `choices`: habilidades, pericias, `feats` + `featSlots`
   (dote por ranura "clase:nivel"), `featChoices` (lo que pide cada dote: característica, lista,
   trucos, conjuro, escuela, habilidades, herramientas, resistencias), `traitChoices`/`traitPicks`
   (opciones dentro de rasgos de especie), `options` (invocaciones, maniobras, maldiciones),
   `spellsByClass` (conjuros elegidos por clase), `weaponMasteries`, `wildShapeForms`,
   `toolChoices`. Todo campo nuevo es opcional y se normaliza en `normalizeCharacter`.
2. **Estado de juego** (`character.state`): PG, espacios gastados, `resources` (usos gastados
   por clave `"<clase>:<nombre>"`, y `feat:...` para dotes), dados de golpe, condiciones,
   `active` (Furia, Maleficio...), `wildShape`, `summons`, `replicated` (objetos del
   Artificiero), `cannon`, `concentration`, `restChoices`.
3. **Ficha calculada**: `computeSheet(character, data)` en `core/rules/engine.ts` devuelve un
   `Sheet` (`core/rules/sheet.ts`): características, CA, PG, `features` (rasgos por nivel),
   `resources` (columnas de la tabla de clase: Furias, Puntos de concentración...),
   `featSpells` (conjuros concedidos por dote/especie/clase/subclase, con `always`, `atWill`,
   `freeKey`), `featUses` (usos de dotes), `resistances`, `featMissing` (elecciones pendientes),
   `restPicks`, `combat` (estados activables, Cuchillas Psíquicas, crítico...), `warnings`.
4. **Contadores**: `playResources(sheet)` en `core/play/play-state.ts` es lo que la hoja muestra
   como contador con su recarga (`short`: qué recupera un descanso corto; el largo recupera
   todo). Fuentes: columnas de la tabla de clase, la lista `FEATURE_USES` (rasgos de clase con
   fórmula: Bardic Inspiration, Channel Divinity...), `pools.ts` (dados de subclase: Psionic
   Energy Dice...), `featUses` (usos leídos del texto de dotes y rasgos por
   `feat-effects.ts`) y `core/play/rest-rules.ts` (qué recupera cada descanso).
5. **Lectores de texto**: `core/rules/feat-effects.ts` (`featRules`: conjuros, usos por
   descanso, característica de lanzamiento, resistencias, y `FEAT_PICKS` para lo que el
   jugador elige), `trait-effects.ts` (velocidades, sentidos, resistencias de especie),
   `trait-choices.ts` y `species-picks.ts` (elecciones dentro de rasgos), `feature-stats.ts`
   (acción, coste y CD de cada rasgo), `attacks.ts` (tabla de ataques; Cuchillas Psíquicas),
   `active-states.ts`, `wild-shape.ts`, `natural-weapons.ts`, `core/artificer/*` (planos,
   Replicate Magic Item, Cañón), `core/summons/*` (invocaciones).
6. **Interfaz**: hoja en `app/src/app/features/characters/` (pestañas, `play-panel`,
   `combat-tab`, `spell-book`, `replicate-panel`, `trait-rest-dialog`), asistente de creación
   en `features/creation/`, subida de nivel en `features/level-up/`, selector de elecciones de
   dote en `shared/feat-choices.ts`.

## Volcado de la ficha real

`docs/auditoria/_volcado/` contiene lo que el motor calcula HOY con los datos reales
(personaje de prueba: humano, soldado, características 16/14/14/12/14/14):

- `clase-<id>.json`: la clase sin subclase a niveles 1-20 y cada subclase a niveles 3-20.
  Por entrada: `features`, `classTable`, `counters` (lo que la hoja muestra como contador),
  `grantedSpells` (siempre preparados / a voluntad / gratis), `spellcasting`, `attacks`,
  `activeStates`, `resistances`, `speed`, `missing`, `restPicks`, `warnings`.
- `dotes.json`: por dote, `parsed` (lo que `featRules` entiende del texto) y `sheet` (guerrero
  de nivel 8 con esa dote, sin elecciones hechas: `missing` = lo que pediría elegir).
- `especies.json`: por especie y variante, sus rasgos, contadores, conjuros, resistencias,
  velocidades y avisos.

Úsalo con Python o `jq`; los ficheros son grandes, no los leas enteros.
