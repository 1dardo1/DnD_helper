# Auditoría: Artificiero (clase base y subclases)

Fuente: `data/classes.json` (id `artificer`, edición 2024, UA3 Eberron 27.02.2025), `data/subclasses.json` (7 subclases), `data/options.json` (55 opciones `magic-item-plan`), volcado `docs/auditoria/_volcado/clase-artificer.json`. Auditoría de solo lectura (código leído, no ejecutado).

## Resumen

Recuento aproximado de elementos auditados: ✅ 22 · ⚠️ 11 · ❌ 12 · — 30.

Conclusión sobre el fallo reportado ("no puede crear objetos con infusiones/planos"):
- Los datos están completos y bien enlazados: las 4 tablas de planos del texto (16 + 21 + 11 + 7 = 55) coinciden con las 55 opciones, y todos sus `itemId` existen en `items.json`. La tabla "Plans Known" (4/4/4/4/5/5/5/5/6/6/6/6/7/7/7/8/8/8 …) y "Magic Items" (2…6) se leen bien de la tabla de clase (`planCounts`).
- El panel `replicate-panel` solo existe dentro de la pestaña **Conjuros** (`character-sheet.html` ~l.612, columna lateral), solo con nivel de Artificiero >= 2, y con la lista "Planos conocidos" vacía no hay ningún botón "Crear objeto". Texto actual: "Aún no conoces ningún plano: elígelos al subir de nivel." (`plans.noPlans`). Causas probables del síntoma, de más a menos probable:
  1. Personaje que nunca eligió planos (creado antes de la función, o con el grupo omitido en el asistente): ve "ninguno" y el botón "Cambiar planos" queda abajo del todo; el mensaje remite a "subir de nivel", engañoso porque se pueden elegir desde la propia hoja.
  2. Descubrimiento: el panel no aparece en Equipo ni en Resumen; hay que saber que está en Conjuros.
  3. "Infusiones": los datos son el Artificiero UA 2024 (planos). No existe el grupo `artificer-infusion` (la columna `OPTION_COUNT_COLUMN` lo prevé pero no hay datos ni rasgo "Infuse Item" 2014). Quien espere infusiones 2014 no las tiene; el Archivista (2014) las nombra en su texto.
  4. No he encontrado un fallo de lógica que impida crear: `createReplicated` valida duplicado, respeta el máximo (el más antiguo desaparece) y añade el objeto al inventario con `source: 'replicate'`. No he podido ejecutar la app ni los tests, así que no descarto un fallo en ejecución.
- Defectos reales detectados en el flujo de planos (ver Observaciones): no se puede Drenar ningún objeto "+1/+2" (rareza "very rare" en datos), el bono +1/+2 de la planilla no se aplica (queda en +1 por defecto), Armor Replication no suma plan/objeto.

## Clase base

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 1 · Spellcasting | INT, 2 trucos, preparados por tabla (2…15), espacios mitad, cambio tras descanso largo (`spell-swap`: any), lista de 115 conjuros de clase | ✅ | Nada | `core/rules/engine.ts`, `core/play/spell-swap.ts` |
| 1 · Tinker's Magic | Mending siempre disponible; contador = mod INT (mín. 1), recarga larga: OK | ⚠️ | No crea el objeto de la lista en el inventario (solo contador); aceptable como texto | `play-state.ts` (featUses) |
| 2 · Replicate Magical Item | Panel de planos (crear, quitar, cambiar planos, pregunta tras descanso largo), elección en creación/subida (`plan-chooser`), "common/uncommon/rare" con buscador | ✅ | Ver fallo reportado arriba | `core/artificer/plans.ts`, `replicated-state.ts`, `features/characters/replicate-panel.*`, `shared/plan-chooser.ts`, `core/creation/level-up.ts` |
| 2 · Plans Known / Magic Items | 4→8 planos, 2→6 objetos, leídos de tabla | ✅ | Nada | `plans.ts` (`planCounts`) |
| 2 · Plantillas +1/+2 (Weapon, Armor, Shield, Wand War Mage, Wraps) | Crea el objeto genérico "+1,+2 o +3" | ⚠️ | El bono del plan no se fija (queda +1; +2 hay que cambiarlo a mano y se permite +3) | `replicated-state.ts`, `core/characters/magic-base.ts` |
| 3 · Artificer Subclass | Elección en creación/subida | ✅ | Nada | creation/level-up |
| 4/8/12/16 · ASI, 19 · Epic Boon | Ranuras de dote | ✅ | Nada | `featSlots` |
| 6 · Magic Item Tinker: Charge | Gasta espacio, recarga cargas según el texto de cada objeto | ✅ | Parseo de cargas por regex del texto | `tinker.ts` |
| 6 · Drain Magic Item | Objeto desaparece, espacio temporal nivel 1/2, una vez por descanso largo (`DRAIN_KEY`) | ⚠️ | Objetos "+1/+2" (very rare) no pueden drenarse (debería ser nivel 2 por ser Uncommon/Rare); además contador duplicado (ver Observaciones) | `tinker.ts` (`drainSlotLevel`) |
| 6 · Transmute Magic Item | Cambia a otro plan conocido, 1/descanso largo (`TRANSMUTE_KEY`) | ✅ | Contador duplicado en play-panel | `replicated-state.ts` |
| 7 · Flash of Genius | Contador = mod INT, recarga larga: OK | ✅ | Nada | `play-state.ts` FEATURE_USES |
| 10/14/18 · Magic Item Adept/Savant/Master | Límite de sintonías 4/5/6 | — | No hay control de sintonías en la app | texto |
| 11 · Spell-Storing Item | Texto | ❌ | Sin contador (2×mod INT, mín. 2) ni registro del conjuro guardado | feat-effects no lo lee |
| 20 · Soul of Artifice | Cheat Death (20 × objetos) y Magical Guidance | — | Situacional, texto basta | — |

## Alchemist (2024 UA)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3 · Tool Proficiency | Texto | ❌ | No concede Alchemist's Supplies (ni elección de otra herramienta); `KNOWN_TOOLS` no la incluye y la frase "of your choice" se descarta | `trait-effects.ts`, `engine.ts` (proficiencies) |
| 3-17 · Alchemist Spells | 10 conjuros siempre preparados por nivel 3/5/9/13/17, coinciden con la tabla | ✅ | Nada | datos + engine |
| 3 · Experimental Elixir | Texto y tabla d6 | ⚠️ | Sin contador de elixires (2/3/4/5) ni creación extra con espacio | — |
| 5 · Alchemical Savant | Bono a una tirada | — | Texto basta | — |
| 9 · Restorative Reagents | Lesser Restoration gratis, contador mod INT, larga | ✅ | Fortify (PG temp) texto | feat-effects |
| 15 · Chemical Mastery | Resistencia Ácido/Veneno aplicada; Tasha's Bubbling Cauldron 1/larga | ✅ | Eruption 2d8 texto | engine |

## Archivist (2014, UA 58)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3 · Tools of the Trade | Texto | ❌ | Sin competencia en suministros de caligrafía/kit de falsificación | engine |
| 3-17 · Archivist Spells | 10 siempre preparados | ✅ | Nada | |
| 3 · Artificial Mind | Contador mod INT, larga (clave `manifest-mind`) | ⚠️ | Sin selector de 2 habilidades según material; Information Overload texto | |
| 5 · Mind Network | Bono psíquico | — | Texto | |
| 15 · Pure Information | 1/larga | ✅ | Texto dice "14th level" pero está en 15 (dato fuente) | |

## Armorer (2024 UA)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3 · Tools of the Trade | Texto | ❌ | No concede Heavy armor ni Smith's Tools (regex solo lee dotes) | `engine.ts` l.637-645 |
| 3-17 · Armorer Spells | 10 siempre preparados | ✅ | | |
| 3 · Arcane Armor | Texto | — | Texto basta | |
| 3 · Armor Model | Texto + contador "Armor Model" 1/larga | ❌ | Sin selector Dreadnaught/Guardian/Infiltrator; sin ataques (Armor Flail 1d10, Thunder Gauntlets 1d8, Lightning Launcher 1d6 con INT); sin Giant Stature (mod INT) solo si Dreadnaught; sin +5 velocidad Infiltrator; el contador sale a todos los modelos | `attacks.ts`, `feat-effects.ts` |
| 5 · Extra Attack | Texto | — | Texto | |
| 9 · Armor Replication | Texto | ❌ | No suma +1 plano ni +1 objeto, ni limita a categoría Armor | `plans.ts` (`planCounts`) |
| 15 · Perfected Armor | Contador "Perfected Armor" 1/larga (Guardian) | ⚠️ | Sale a todos los modelos; mejoras de daño no aplicadas | |

## Artillerist (2024 UA)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3 · Tool Proficiency | Texto | ❌ | Woodcarver's Tools no concedida | |
| 3-17 · Artillerist Spells | 10 siempre preparados | ✅ | | |
| 3 · Eldritch Cannon | Tarjeta en Invocaciones: crear (gratis 1/larga o con espacio), tamaño/aspecto, PG 5×nivel, opciones Flamethrower/Force Ballista/Protector con CD, Mending cura, descartar | ✅ | Contador duplicado en play-panel (`trait:subclass:eldritch-cannon…`) separado de `CANNON_CREATE_KEY` | `core/artificer/cannon.ts`, `features/summons/summons-page.ts` |
| 5 · Arcane Firearm | Texto | — | Texto (1d8 situacional) | |
| 9 · Explosive Cannon | +1d8 en dados y Detonate (3d10) | ✅ | | `cannon.ts` |
| 15 · Fortified Position | Texto | ❌ | Dos cañones a la vez (state.cannon es único); media cobertura texto | `cannon.ts`, `character.ts` |

## Battle Smith (2024 UA)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3 · Tool Proficiency | Texto | ❌ | Smith's Tools no concedida | |
| 3-17 · Battle Smith spells | 10 siempre preparados | ✅ | | |
| 3 · Battle Ready | Texto | ❌ | Martial weapons no se añade a competencias (ataques con marciales sin PB); Arcane Empowerment (INT en ataque/daño de arma mágica) no está en `attacks.ts` | `engine.ts`, `attacks.ts` |
| 3 · Steel Defender | Stat block en Invocaciones (PG 5+5×nivel, CA 15, Repair 3/día, Rend) | ✅ | Restaurar con espacio / recrear tras descanso texto | `core/summons/*` |
| 5 · Extra Attack | Texto | — | | |
| 9 · Arcane Jolt | Contador mod INT, larga | ✅ | | |
| 15 · Improved Defender | Texto | ⚠️ | +2 CA del defensor, Deflect con daño, 4d6 no aplicados | `summons/resolve.ts` |

## Cartographer (2024 UA)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3 · Tool Proficiencies | Texto | ❌ | Calligrapher's/Cartographer's no concedidas | |
| 3-17 · Cartographer Spells | 12 siempre preparados (3 en nivel 3) | ✅ | | |
| 3 · Adventurers Atlas | Texto | — | Texto (nº mapas = 1+INT) | |
| 3 · Scouting Gadgets | Faerie Fire gratis, contador mod INT, larga | ✅ | Boost texto | |
| 5 · Portal Jump | Contador mod INT, larga | ✅ | Uso gratis con mapa texto | |
| 9 · Ingenious Movement | Texto | — | | |
| 15 · Superior Atlas | Find the Path gratis 1/larga | ✅ | Safe Haven, Unshakeable Mind texto | |

## Reanimator (2024 UA4)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-17 · Reanimator Spells | 11 siempre preparados | ✅ | | |
| 3 · Jolt to Life | Contador mod INT, larga | ✅ | Daño texto | |
| 3 · Reanimated Companion | Contador 1/larga; posible fuente de invocación (stat block con tabla "Armor Class") | ⚠️ | No verificado que la tabla (CA 10+INT, PG 4+4×nivel) se resuelva; sin test | `core/summons/catalog.ts` |
| 5 · Strange Modifications | Texto | ❌ | Sin selector Arcane Conduit / Ferocity | |
| 9 · Improved Reanimation | Texto | ❌ | Sin selector Bloated/Gaunt/Moist ni sus efectos | |
| 15 · Promethean Reanimation | Texto | — | Death Burst 4d6 no aplicado | |

## Patrones comunes

- Competencias que otorgan las subclases (Heavy armor, Martial weapons, herramientas) no se aplican: `proficiencies()` solo lee el texto de dotes.
- Elecciones dentro de rasgos de subclase (modelo de armadura, modificaciones del compañero) no tienen selector.
- Contadores duplicados: los de Drain/Transmute/Eldritch Cannon creados por texto (`trait:…`) no están ligados a las claves de los paneles propios (`artificer:…`).
- Conjuros siempre preparados: coinciden con las tablas y todos existen en `spells.json`.

## Dudas

- El Archivista dice "At 14th level" en Pure Information pero la fuente lo coloca en 15.
- No hay datos de infusiones 2014 ni rasgo "Infuse Item"; se asume que el usuario habla de los planos.
- Si la pregunta de descanso largo de Replicate debería cubrir también el "Spell-Storing Item".
- Reanimated Companion: sin prueba de que se resuelva como invocación.

## Observaciones (errores del volcado)

- Drain/Transmute: contadores "Magic Item Tinker: Drain Magic Item" y "…Transmute…" (clave `trait:class:magic-item-tinker:*`) duplican el estado real de `DRAIN_KEY`/`TRANSMUTE_KEY`; usarlos no actualiza el panel y viceversa.
- Eldritch Cannon: contador del volcado (`trait:subclass:eldritch-cannon:eldritch-cannon`) duplicado respecto a `CANNON_CREATE_KEY`.
- Armor Model y Perfected Armor: contadores "max=1" (mod INT mín. 1) aparecen sin elegir modelo.
- `drainSlotLevel`: los 10 planos "+N" tienen rareza "very rare" en `items.json`; el Drenar queda oculto.
- Con INT 12 todos los contadores de volcado valen 1; no verifica la fórmula con INT alto (se asume mod INT mín. 1).
- Texto de `plans.noPlans` sugiere subir de nivel cuando también se pueden elegir desde "Cambiar planos".
