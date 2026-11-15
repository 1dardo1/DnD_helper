# Auditoría de clase: Druida

Fuentes: `data/classes.json` (`druid`, 2024), `data/subclasses.json` (12 círculos con `classId` = `druid`),
volcado `docs/auditoria/_volcado/clase-druid.json` y código en `app/src/app`. Solo lectura: no se ha
ejecutado ningún test ni build.

## Resumen

Total 73 elementos: **✅ 34 · ⚠️ 10 · ❌ 10 · — 19**.

| Bloque | ✅ | ⚠️ | ❌ | — |
| --- | --- | --- | --- | --- |
| Clase base | 9 | 1 | 3 | 0 |
| Land (2024) | 2 | 0 | 2 | 1 |
| Moon (2024) | 4 | 1 | 0 | 0 |
| Sea (2024) | 2 | 2 | 0 | 1 |
| Stars (2024) | 2 | 2 | 0 | 1 |
| Titan (UA14) | 1 | 0 | 1 | 3 |
| Preservation (UA7) | 1 | 1 | 1 | 3 |
| Spores (UA16) | 2 | 1 | 0 | 3 |
| Dreams (2014) | 2 | 0 | 1 | 1 |
| Primeval (UA83, 2014) | 1 | 1 | 0 | 3 |
| Shepherd (2014) | 2 | 1 | 0 | 2 |
| Twilight (UA23, 2014) | 2 | 0 | 2 | 0 |
| Wildfire (2014) | 4 | 0 | 0 | 1 |

Lo grave: **Primal Order**, **Elemental Fury** y **la tierra del Círculo de la Tierra** son elecciones
del jugador que no tienen selector. Sin selector el motor aplica todas las opciones o ninguna.

## Fallo reportado por el usuario

> "Druida del Círculo de la Luna: no permite seleccionar los conjuros de druida ni añade los conjuros del círculo."

No he encontrado un fallo duro en el código: la lógica de selección existe y es correcta para el druida.
Lo que encuentro son tres causas que, juntas, explican lo que ve el usuario. Si el usuario lo ve así en
un personaje recién creado, el candidato más probable es la 1 (y la 2 para los conjuros del círculo).

**Qué funciona (comprobado leyendo el código)**

- Asistente (`features/creation/character-create.ts`): `casters()` (l. 323) llama a `spellCasters()`
  (`core/creation/spell-choices.ts`, l. 30-49). Esta función incluye cualquier clase con
  `castingOf(cls, sub)` no nulo; en el druida `cls.spellcasting` existe. `wizardSteps(hasCasters)`
  (l. 586) añade el paso "Conjuros". En él, `spellsFor()` (`core/creation/creation-rules.ts` l. 175)
  ofrece 13 trucos y los conjuros de druida hasta el nivel de espacio más alto
  (`maxSpellLevel`). Se pinta en `character-create.html` l. 783-840. Se puede crear directamente
  a nivel 3 con la subclase y el paso aparece igual.
- Subida de nivel (`features/level-up/level-up.ts`): `levelGains()` (`core/creation/level-up.ts`
  l. 113) devuelve `spells` para el druida y `spellsGrow()` es verdadero en 2→3 (preparados 5→6 y
  conjuros de nivel 2). Por eso `hasChoices()` (l. 311) añade el paso "Elecciones" con los selectores
  (`level-up.html` l. 392-455). La subclase se elige en el mismo nivel y no cambia nada: `gains()`
  lee la subclase del borrador. Subir de 2 a 3 o crear a 3 da el mismo resultado.
- Datos: `data/spells.json` y `data/es/spells.json` traen `classes: ['druid', ...]` para
  Cure Wounds, Moonbeam, Starry Wisp, Conjure Animals, Fount of Moonlight y Mass Cure Wounds.
- El motor añade los 4 conjuros del círculo como siempre preparados (volcado, "Moon nivel 3/5/7/10")
  y no cuentan contra el límite de preparados (6 a nivel 3).

**Dónde falla para el usuario**

1. **El libro de conjuros de la ficha es de solo lectura salvo tras un descanso largo.**
   `features/characters/spell-book.html` solo muestra los selectores cuando `c.swap` vale `'any'` o
   `'one'` (l. 85-185). `swap` sale de `ch.state.spellSwap` (`spell-book.ts` l. 118), que
   únicamente se rellena en `play-panel.ts` l. 214 al hacer un descanso largo
   (`core/play/spell-swap.ts`, `swapsAfterLongRest`). Un druida que llega a la ficha sin conjuros
   elegidos (paso del asistente saltado, personaje importado, creado antes de que existiera el paso,
   o recién subido de nivel con preparados nuevos sin elegir) ve "Preparados: —" y **no tiene botón
   para elegir** hasta su próximo descanso largo. Para el druida (swap 'any' en el descanso largo)
   esto es coherente con la regla, pero no con "primera vez" ni con corregir un olvido. Tampoco hay
   forma de ir a "Elecciones" desde la ficha (ver edición en `core/creation/edit-draft.ts`).
   El texto del botón ("Cambiar conjuros") solo aparece dentro de ese bloque.
2. **Los conjuros del círculo no se ven en la lista de Preparados.** El libro (`spell-book.ts`
   l. 85-117) solo lista los elegidos (`spellsOf(by, cls.id)`). Los conjuros del círculo viven en
   `sheet.featSpells` y se pintan en otra columna (`character-sheet.html` l. 554-612) con el
   título "Conjuros de dotes y rasgos" y la etiqueta **"Dote: Circle of the Moon"**
   (`character-sheet.html` l. 575-578 usa `sheet.featSource` = "Dote: {name}" para todo origen que
   no sea `species`; los de origen `subclass` o `class` también salen como "Dote"). Para el usuario
   es fácil leer eso como "no se añaden". En la pestaña Conjuros móvil la columna lateral queda
   debajo de toda la lista.
3. **El asistente no avisa de los conjuros del círculo.** El paso "Conjuros" (`character-create.html`
   l. 783-840) no lista los siempre preparados de clase/subclase ni los marca en el selector
   (`spellMarks` solo marca conjuros de otras clases). El druida puede gastar preparados en Moonbeam
   o Cure Wounds, que ya tiene gratis. Solo aparecen en el resumen final
   (`shared/wizard/wizard-summary.html` l. 213-254).

**Defectos relacionados**

- En el libro, los trucos nunca se pueden cambiar: la lista `available` del modo de cambio es
  `spellsFor(...).leveled` (`spell-book.ts` l. 112). La regla de Spellcasting del druida permite
  cambiar un truco en cada nivel (texto de Spellcasting) y `swapRule('druid').levelUp` es `null`
  (`core/play/spell-swap.ts` l. 17), así que ni en la subida de nivel se ofrece.
- Siempre hay que tener cuidado: no he podido reproducir en navegador (sin build). Si el usuario
  ve el paso "Conjuros" ausente en el asistente, sería otro problema distinto y haría falta su captura.

## Clase base

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Spellcasting | Selector de trucos y preparados en asistente y subida de nivel; espacios; CD; cambio completo tras descanso largo (`spellSwap` 'any') | ⚠️ | Sin selector en la ficha fuera del descanso largo (ver fallo); no se pueden cambiar trucos (ni en descanso ni en subida de nivel, el texto lo permite en cada nivel); el selector no muestra los siempre preparados | `core/creation/spell-choices.ts`, `core/play/spell-swap.ts`, `features/characters/spell-book.*`, `features/creation/character-create.html`, `features/level-up/level-up.html` |
| 1 · Druidic | Idioma Druidic (`FEATURE_LANGUAGES`) y Speak with Animals siempre preparado ("base nivel 1") | ✅ | — (mensajes ocultos: texto) | `core/rules/engine.ts` l. 605 |
| 1 · Primal Order | Solo el texto del rasgo | ❌ | Sin elección Magician/Warden (no hay campo en `choices` ni selector). Magician: 1 truco extra de druida (`cantripsByLevel`+1) y bono = mod SAB (mín. +1) a Arcana/Naturaleza. Warden: competencia con armas marciales y armadura media (no se añade a `sheet.proficiencies`) | — (grep "Primal Order/Magician/Warden" sin resultados); `core/models/character.ts`, `core/rules/engine.ts`, `core/rules/trait-choices.ts` |
| 2 · Wild Shape | Contador (2/3/4 por nivel, corto +1, largo todo); formas conocidas con selector (4/5/6/8 según tabla, límite de CR y vuelo); PG temporales = nivel; duración horas = nivel/2; ficha de la bestia (AC, velocidades, ataques, salvaciones y habilidades con el máx.); consume uso | ✅ | — | `core/rules/wild-shape.ts`, `features/states/wild-shape-panel.ts`, `core/play/active-play.ts`, `core/play/rest-rules.ts` |
| 2 · Wild Companion | Fila de invocación: Find Familiar como Fey (catálogo) | ✅ | Gastar el espacio o el uso de Wild Shape es manual | `core/summons/catalog.ts` l. 345 |
| 3 · Druid Subclass | Selector de círculo; aviso si falta | ✅ | — | `core/creation/level-up.ts`, `features/creation/` |
| 4/8/12/16 · ASI | Ranuras de dote por nivel | ✅ | — | `core/creation/creation-rules.ts` (`featSlots`) |
| 5 · Wild Resurgence | Contador 1/largo (la mitad de espacio→uso de Wild Shape) | ✅ | Las dos conversiones (espacio↔uso) se hacen a mano, texto basta | `core/play/play-state.ts` l. 86 |
| 7 · Elemental Fury | Texto + nota de combate "Primal Strike +1d8" para todos | ❌ | Sin elección Potent Spellcasting / Primal Strike. Primal Strike se muestra siempre (también en formas de Wild Shape) aunque el jugador elija Potent. Potent Spellcasting (+SAB al daño de trucos de druida) no se aplica en ningún sitio | `core/rules/feature-stats.ts` l. 261, `core/rules/wild-shape.ts` l. 105/116, `core/rules/attacks.ts` |
| 15 · Improved Elemental Fury | Primal Strike pasa a 2d8 | ❌ | Mismo problema; el alcance +300 ft de Potent no se refleja | ídem |
| 18 · Beast Spells | `spells: 'all'` en las reglas de forma | ✅ | — | `core/rules/wild-shape.ts` |
| 19 · Epic Boon | Ranura de dote | ✅ | — | `core/creation/creation-rules.ts` |
| 20 · Archdruid | Contador "Archdruid" 1/largo (Nature Magician) | ✅ | Evergreen Wild Shape (al tirar iniciativa) y conversión: texto | `core/rules/feat-effects.ts` (uso detectado) |

## Circle of the Land (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle of the Land Spells | `grantedSpells` mete las **cuatro** listas (arid, polar, temperate, tropical) siempre preparadas: 12 conjuros a nivel 3, 20 a nivel 7, 24 a nivel 10 | ❌ | Falta la elección del tipo de tierra, que se cambia tras cada descanso largo (texto: "Whenever you finish a Long Rest, choose one type of land"). Solo debe estar activa una tabla. Hay que guardar la tierra en el estado (no en `choices`) y ofrecerla en el diálogo de descanso | `core/rules/feat-effects.ts`, `core/rules/engine.ts` (`featSpells`), `core/play/rest-rules.ts`, `data/subclasses.json` (`spells` con cuatro tablas sin etiqueta de tierra) |
| 3 · Land's Aid | Nota de estadísticas (2d6/3d6/4d6, CD) | ✅ | Gasto del uso de Wild Shape manual | `core/rules/feature-stats.ts` l. 296 |
| 6 · Natural Recovery | Contador 1/largo (conjuro gratis) | ✅ | Recuperar espacios en descanso corto: texto | `core/rules/feat-effects.ts` |
| 10 · Nature's Ward | Solo texto | ❌ | Inmunidad a Poisoned y resistencia según la tierra (fuego/frío/rayo/veneno): no aparece en `resistances` ni en inmunidades | `core/rules/trait-effects.ts`, `core/rules/engine.ts` |
| 14 · Nature's Sanctuary | Texto | — | — | — |

## Circle of the Moon (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle Forms | En el panel de forma: CR máx. = nivel/3, CA = 13+SAB si supera la de la bestia, PG temporales = 3×nivel (se aplican al asumir la forma) | ✅ | La CA de la ficha base queda en 12 a propósito (solo cuenta dentro de la forma) | `core/rules/wild-shape.ts`, `core/play/active-play.ts` |
| 3 · Circle of the Moon Spells | Cure Wounds, Moonbeam, Starry Wisp (nv 3), Conjure Animals (5), Fount of Moonlight (7), Mass Cure Wounds (9) siempre preparados; se pueden lanzar en forma | ⚠️ | El motor es correcto. En la UI salen en otra columna con la etiqueta "Dote: Circle of the Moon" y no en Preparados; el selector de preparados no los marca como ya conocidos | `features/characters/character-sheet.html` l. 554-612, `core/i18n/es.ts` l. 458, `features/characters/spell-book.*` |
| 6 · Improved Circle Forms | Nota Lunar Radiance en ataques de forma; +SAB a salvaciones de CON en forma | ✅ | — | `core/rules/wild-shape.ts` |
| 10 · Moonlight Step | Contador = mod SAB (mín. 1), recarga larga | ✅ | Recuperar usos con espacio de nivel 2+: manual | `core/rules/feat-effects.ts` |
| 14 · Lunar Form | Nota de +2d10 radiante una vez por turno en ataques de forma | ✅ | — | `core/rules/feature-stats.ts` l. 326 |

## Circle of the Sea (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle of the Sea Spells | 4/6/8/10 conjuros siempre preparados por nivel | ✅ | — | `core/rules/feat-effects.ts` |
| 3 · Wrath of the Sea | Nota de estadísticas (dados d6 = SAB, CD) | ⚠️ | No hay estado activable (dura 10 min, cuesta un uso de Wild Shape); el uso se gasta a mano | `core/rules/feature-stats.ts` l. 309, `core/rules/active-states.ts` |
| 6 · Aquatic Affinity | Velocidad nadando = velocidad (volcado: swim 30) | ✅ | — | `core/rules/trait-effects.ts` |
| 10 · Stormborn | Vuelo 30 y resistencias a frío/rayo/trueno | ⚠️ | Se aplican siempre, pero el texto dice "mientras Wrath of the Sea está activo": falta condicionarlo a un estado | `core/rules/trait-effects.ts`, `core/rules/active-states.ts` |
| 14 · Oceanic Gift | Texto | — | — | — |

## Circle of the Stars (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Star Map | Guiding Bolt siempre preparado + contador (mod SAB, largo) | ⚠️ | El volcado no trae Guidance (el texto da "Guidance and Guiding Bolt prepared"; Guidance es truco); la mesa (1d6) es texto | `core/rules/feat-effects.ts` |
| 3 · Starry Form | Nota de dados del Archer (1d8+SAB, 2d8 a nv 10) | ⚠️ | No hay estado activable (10 min, cuesta un uso de Wild Shape) ni selector de constelación; la regla de Dragon (mínimo 10) no se refleja | `core/rules/feature-stats.ts` l. 319, `core/rules/engine.ts` l. 963 |
| 6 · Cosmic Omen | Contador = mod SAB, largo | ✅ | Tirada par/impar: texto | `core/rules/feat-effects.ts` |
| 10 · Twinkling Constellations | 2d8 en Archer/Chalice | ✅ | Vuelo del Dragon: texto | `core/rules/feature-stats.ts` |
| 14 · Full of Stars | Resistencia física en forma estelar | — | Texto | — |

## Circle of the Titan (UA14, 2024)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle of the Titan Spells | 3/4/5/6 conjuros siempre preparados | ✅ | "Se pueden lanzar en Titan Form": no hay Titan Form | `core/rules/feat-effects.ts` |
| 3 · Titan Form | Solo texto. Los tres bloques (Behemoth, Leviathan, Insectoid) están en el texto de **Monstrous Appetite** (error del scraper: aparece como fuente de invocación en vez de forma de Wild Shape) | ❌ | Titan Form no aparece como forma en el panel de Wild Shape (10 min, PG temporales 4×nivel, CA 13+SAB, FUE/DES = SAB, ataque Rend con bono de conjuro). Habría que leerlas como formas del druida | `core/summons/catalog.ts`, `features/states/wild-shape-panel.ts`, `data/subclasses.json` (Monstrous Appetite) |
| 6 · Dire Impact | Texto | — | — | — |
| 10 · Primal Havoc | Texto | — | — | — |
| 14 · Monstrous Appetite | Texto | — | — | — |

## Circle of Preservation (UA7, 2024)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle of Preservation Spells | 4/6/8/10 conjuros siempre preparados | ✅ | — | `core/rules/feat-effects.ts` |
| 3 · Preserved Land | Texto (cuesta un uso de Wild Shape) | — | — | — |
| 3 · Student of Preservation | Texto | ❌ | Competencia con una herramienta de artesano a elegir: sin selector (`missing` vacío) | `core/rules/feat-effects.ts` (`FEAT_PICKS` solo por dote), `core/rules/engine.ts` |
| 6 · Improved Preservation | Texto | — | — | — |
| 10 · Facilitated Restoration | Contador = mod SAB, largo | ⚠️ | El conjuro sale como una sola fila "Lesser Restoration or Greater Restoration" (el motor trata la "o" como un conjuro único) | `core/rules/feat-effects.ts` |
| 14 · Sacrosanct Land | Texto | — | — | — |

## Circle of Spores (UA16, 2024)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle Spells | 3/4/5/6 conjuros siempre preparados | ✅ | — | `core/rules/feat-effects.ts` |
| 3 · Halo of Spores | Texto (daño 1d4/1d6/1d8/1d10) | — | Sin nota con el daño por nivel | `core/rules/feature-stats.ts` |
| 3 · Symbiotic Entity | Texto | ⚠️ | Sin estado activable (10 min, cuesta un uso de Wild Shape, PG temporales 4×nivel, +1d6 necrótico) | `core/rules/active-states.ts` |
| 6 · Fungal Infestation | Contador = mod SAB, largo | ✅ | El Zombie del PHB sale como criatura del compendio | `core/rules/feat-effects.ts` |
| 10 · Explosive Burst | Texto | — | — | — |
| 14 · Fungal Body | Texto | — | Ver "Dudas" (inmunidades a condiciones) | — |

## Circle of Dreams (2014, XGE)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Balm of the Summer Court | Texto | ❌ | Reserva de d6 = nivel de druida, se gastan hasta nivel/2 por uso, recarga larga: sin contador (`counters` vacío en "nivel 3") | `core/rules/pools.ts`, `core/play/play-state.ts` |
| 6 · Hearth of Moonlight and Shadow | Texto | — | — | — |
| 10 · Hidden Paths | Contador = mod SAB, largo | ✅ | — | `core/rules/feat-effects.ts` |
| 14 · Walker in Dreams | Contador 1, largo | ✅ | — | ídem |

## Circle of the Primeval (UA83, 2014)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Keeper of Old | Texto | ⚠️ | Competencia en Historia y d4 a las pruebas de Historia: no se ha encontrado lógica (sin verificar, ver Dudas) | `core/rules/engine.ts` |
| 3 · Primeval Companion | Bloque de estadísticas del texto → fila de invocación | ✅ | Coste del uso de Wild Shape manual; no hay test con datos reales (`summons.spec.ts` no cita Primeval) | `core/summons/catalog.ts` |
| 6 · Prehistoric Conduit | Texto | — | — | — |
| 10 · Titanic Bond | Texto | — | — | — |
| 14 · Scourge of the Ancients | Texto | — | — | — |

## Circle of the Shepherd (2014, XGE)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Speech of the Woods | Texto | ⚠️ | Sylvan no entra en el idioma de la ficha (`FEATURE_LANGUAGES` solo Druidic y Thieves' Cant); si otro lector lo capta, no está verificado | `core/rules/engine.ts` l. 605 |
| 3 · Spirit Totem | Contador 1, recuperación corto y largo | ✅ | — | `core/rules/feat-effects.ts` |
| 6 · Mighty Summoner | Texto | — | — | — |
| 10 · Guardian Spirit | Texto | — | — | — |
| 14 · Faithful Summons | Contador 1, largo | ✅ | — | ídem |

## Circle of Twilight (UA23, 2014)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Harvest's Scythe | Texto | ❌ | Reserva de d10 = nivel de druida, se gastan hasta nivel/2 por conjuro, recarga larga: sin contador | `core/rules/pools.ts` |
| 6 · Speech Beyond the Grave | Contador 1, corto y largo | ✅ | — | `core/rules/feat-effects.ts` |
| 10 · Watcher at the Threshold | Resistencia necrótico/radiante | ✅ | — | `core/rules/trait-effects.ts` |
| 14 · Paths of the Dead | Texto | ❌ | Falta contador (1 uso, recarga corto/largo: "can't cast it with this feature again until you finish a short or long rest") | `core/rules/feat-effects.ts` |

## Circle of Wildfire (2014, TCE)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Circle Spells | 4/6/8/10 conjuros siempre preparados (niveles movidos a 3/5/7/9 por el scraper) | ✅ | — | `core/rules/feat-effects.ts` |
| 3 · Summon Wildfire Spirit | Bloque de estadísticas → fila de invocación (traducida: `summons.c.wildfire-spirit`) | ✅ | Gasto de Wild Shape manual | `core/summons/catalog.ts` |
| 6 · Enhanced Bond | Texto | — | — | — |
| 10 · Cauterizing Flames | Contador = bono de competencia (4/5/6) | ✅ | — | `core/rules/feat-effects.ts` |
| 14 · Blazing Revival | Contador 1, largo | ✅ | — | ídem |

## Patrones comunes

1. **Elecciones de rasgo de clase sin selector.** Primal Order, Elemental Fury, la tierra de Land,
   la herramienta de Student of Preservation. `trait-choices.ts` y `species-picks.ts` solo cubren
   especies; `FEAT_PICKS` va por id de dote. Falta un mecanismo equivalente para rasgos de clase y
   subclase (y un campo opcional en `choices`/`state` normalizado en `normalizeCharacter`).
2. **Estados que gastan un uso de Wild Shape.** Wrath of the Sea, Starry Form, Symbiotic Entity y
   Titan Form son modos activables como Wild Shape y Rage, pero solo existe el estado `wildShape`
   (`active-states.ts` l. 11). Consecuencia: efectos "mientras está activo" (Stormborn) se aplican
   siempre.
3. **Reservas de dados sin contador.** Balm of the Summer Court, Harvest's Scythe: `pools.ts` no
   las conoce.
4. **Listas de conjuros del círculo.** Siempre preparados se resuelven bien, pero la interfaz los
   rotula como "Dote" y los separa de Preparados.
5. **Selección de conjuros solo en el asistente y la subida de nivel**: la ficha no permite
   elegir fuera del descanso largo (clase de problema general, no solo del druida).

## Dudas

- Fungal Body (Spores): "Immunity to Blinded, Deafened, Frightened, Poisoned". El volcado solo
  expone resistencias a daño; no sé si la ficha tiene inmunidades a condiciones. Si no las tiene,
  este rasgo y Nature's Ward (Land) quedan ⚠️.
- Keeper of Old (Primeval) y Speech of the Woods (Shepherd): no he encontrado lógica que dé la
  competencia en Historia ni el idioma Sylvan, pero no he podido comprobar el resultado (el volcado
  no incluye habilidades ni idiomas).
- Star Map: el texto dice "prepared Guidance and Guiding Bolt"; Guidance es truco, y el volcado solo
  lista Guiding Bolt en `grantedSpells`. No sé si es intencionado (truco) o falta.
- Titan Form: los stat blocks están dentro de Monstrous Appetite en `data/subclasses.json`. Es un
  problema del scraper/estructura; habría que arreglarlo allí (skill `datos`), no en el JSON a mano.
- Fly Speed y Circle Forms (Moon): el motor deja el límite de vuelo de la tabla Beast Shapes
  (nivel 8) mientras que el CR sube con nivel/3. Es la lectura literal; no está contradicho.
- Land: la regla "cambia de tierra tras cada descanso largo" apunta a guardarlo en estado, no en
  el personaje; no lo he comprobado contra el diálogo de descanso (`restChoices`).

## Observaciones

- Wild Shape es la parte mejor resuelta: contadores, formas conocidas, CR, vuelo, PG temporales,
  duración y ficha de la bestia están leídos del texto real y consistentes con la tabla.
- No he ejecutado tests ni la app; todo se ha juzgado con lectura de código y del volcado.
  Cualquier ⚠️/❌ conviene reproducirlo con `real-data.testing.ts` antes de implementar.
- El nombre de la etiqueta "Dote:" en los conjuros del círculo se arregla con una clave nueva en
  `es.ts`/`en.ts` (por origen `class`/`subclass`) y un test; no toca datos.
