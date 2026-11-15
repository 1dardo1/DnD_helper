# Auditoría de la clase Bardo

Fuentes: `data/classes.json` (id `bard`), `data/subclasses.json` (10 colegios), volcado `docs/auditoria/_volcado/clase-bard.json`, y el código de `app/src/app/core/{rules,play,creation}` y `features/{creation,level-up}`. Solo lectura; no se han ejecutado tests.

## Resumen

Recuento por fila de rasgo (58 filas: clase base 12 + 10 subclases):

| Ámbito | ✅ | ⚠️ | ❌ | — |
| --- | --- | --- | --- | --- |
| Clase base | 8 | 2 | 1 | 1 |
| Creation (2014) | 2 | 0 | 0 | 2 |
| Dance (2024) | 0 | 1 | 0 | 3 |
| Eloquence (2014) | 2 | 0 | 0 | 3 |
| Glamour (2024) | 2 | 1 | 0 | 1 |
| Lore (2024) | 0 | 0 | 2 | 2 |
| Satire UA (2014) | 0 | 1 | 1 | 2 |
| Spirits (2024) | 1 | 1 | 0 | 2 |
| Swords (2014) | 0 | 0 | 2 | 3 |
| Moon (2024) | 1 | 0 | 1 | 2 |
| Valor (2024) | 0 | 0 | 1 | 3 |
| Whispers (2014) | 2 | 2 | 0 | 0 |
| **Total** | **18** | **8** | **8** | **24** |

Lo que funciona bien: contador de Inspiración bárdica (CHA, mín. 1, dado D6/D8/D10/D12 leído de la columna "Bardic Die", recarga larga y corta solo desde nivel 5), Expertise (nivel 2 y 9, selector en creación y subida), Jack of All Trades (medio bonus en habilidades sin competencia), conjuros siempre preparados (Words of Creation y los de subclase), contadores de usos de subclase con su recarga, y cambio de un conjuro por nivel.

Faltantes de fondo: (1) **Magical Secrets** y **Magical Discoveries** no existen (el selector de conjuros solo ofrece la lista de Bardo); (2) **las competencias que concede una subclase no se aplican** (habilidades a elegir, armas, armadura, herramientas); (3) **Fighting Style de Swords** no tiene selector; (4) **Bardic Damage de Dance** no se calcula.

## Clase base

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Bardic Inspiration | Usos = mod CHA (mín. 1), dado d6/d8/d10/d12, recarga larga | ✅ completo | Nada. Volcado: `Bardic Inspiration max=2` (CHA 14) en todos los niveles; `short=0` a nivel 1-4 y `"all"` desde 5 | `core/play/play-state.ts` (`FEATURE_USES`, `mod = max(1, CHA)`), `core/play/rest-rules.ts` (`shortFromLevel: 5`) |
| 1 · Spellcasting (selección de conjuros) | Trucos 2→4, preparados 4→22, espacios; elige trucos y conjuros de la lista de Bardo en creación y en subida de nivel; un cambio de conjuro por nivel | ✅ completo | Nada que reprochar a la lista de clase. El selector solo ofrece conjuros con `classes.includes('bard')` (ver Magical Secrets) | `core/creation/creation-rules.ts` (`spellsFor`), `core/creation/level-up.ts`, `core/play/spell-swap.ts` (`bard: levelUp 'one'`), `features/level-up/level-up.ts`, `features/creation/character-create.ts` |
| 2 · Expertise (y 9) | 2 habilidades con Expertise en nivel 2 y otras 2 en nivel 9 | ✅ completo | Nada. `expertiseCount` cuenta las filas "Expertise" de la tabla (2 y 9); guarda en `choices.expertise`; el motor lo aplica (x2) | `core/creation/creation-rules.ts` (`expertiseCount`), `features/level-up/level-up.ts` (`setExpertise`), `core/rules/engine.ts` (l. 268-295) |
| 2 · Jack of All Trades | Medio bonus de competencia en pruebas sin competencia | ✅ completo | Nada en habilidades. (No se aplica a la iniciativa, que el texto sí permite como prueba de característica; menor, ver Observaciones) | `core/rules/engine.ts` (`has('Jack of All Trades')`) |
| 3 · Bard Subclass | Elección de colegio | ✅ completo | Nada. Aviso `noSubclass` mientras no se elige | `core/creation/level-up.ts` (`needsSubclass`), `core/rules/engine.ts` l. 132 |
| 4/8/12/16 · Ability Score Improvement | Ranura de dote por nivel | ✅ completo | Nada | `featSlots` (`creation-rules.ts`) |
| 5 · Font of Inspiration | Recupera todos los usos en descanso corto; gastar un espacio de conjuro (sin acción) recupera un uso | ⚠️ parcial | La recarga corta está bien. **Falta la acción "gastar un espacio para recuperar 1 uso"** (no hay botón en el contador ni se descuenta el espacio). Se puede hacer a mano quitando el uso gastado y marcando el espacio | `core/play/rest-rules.ts`, `core/play/play-state.ts`, `features/characters/play-panel` |
| 7 · Countercharm | Reacción: repetir salvación con ventaja | — texto basta | Sin usos limitados | — |
| 10 · Magical Secrets | Los conjuros preparados nuevos desde nivel 10 (y el cambio por nivel) pueden salir de las listas de Bardo, Clérigo, Druida y Mago | ❌ falta | **No hay selector de otras listas.** `spellsFor(listId, …)` filtra por `classes.includes(listId)` y `countsFor` solo cuenta conjuros de la lista del lanzador; un conjuro de Mago metido a mano quedaría fuera del cómputo de preparados (cae en `UNASSIGNED` o en otra clase). Hace falta: lista ampliada (bard+cleric+druid+wizard) a partir del nivel 10 para los preparados nuevos y para el cambio, y que `countsFor` los cuente para Bardo | `core/creation/creation-rules.ts` (`spellsFor`, l. 175), `core/creation/spell-choices.ts` (`countsFor` l. 124, `spellsByClassOf`), `core/creation/level-up.ts`, `features/level-up/level-up.ts` (l. 260) |
| 18 · Superior Inspiration | Al tirar iniciativa recupera usos hasta tener 2 | ⚠️ parcial | Sin automatismo ni botón (la app no tiene gancho de iniciativa para recursos). Se resuelve a mano | `core/play/play-state.ts` |
| 19 · Epic Boon | Ranura de dote (Epic Boon) | ✅ completo | Nada | `featSlots` |
| 20 · Words of Creation | Power Word Heal y Kill siempre preparados | ✅ completo | Nada. Volcado nivel 20: ambos como `always` (`[class:Words of Creation]`). La regla del segundo objetivo es texto | `core/rules/feat-effects.ts` / `engine.ts` (`grantedSpells`) |

## Colegio de la Creación (2014, Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Mote of Potential | Efecto extra al usar el dado | — texto basta | — | — |
| 3 · Performance of Creation | 1 uso por descanso largo (o gastando espacio 2º+) | ✅ completo | Contador `max=1 short=0` correcto. La opción "gastar espacio" no tiene botón (como en Font) | `core/rules/feat-effects.ts` (`featUses`) |
| 6 · Animating Performance | 1 uso por descanso largo (o espacio 3º+) | ✅ completo | Contador correcto. El bloque Dancing Item es texto (sin criatura invocada en Combate; desarrollo ya anotado en CLAUDE.md) | ídem |
| 14 · Creative Crescendo | Mejora de Performance of Creation | — texto basta | — | — |

## Colegio de la Danza (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Dazzling Footwork | Sin armadura ni escudo: CA = 10 + DES + CAR; Strike sin armas con DES; daño = dado de inspiración + DES | ⚠️ parcial | **CA correcta** (volcado: CA 14 = 10+2+2). **Falta Bardic Damage**: el golpe sin armas sigue con `ability STR` y daño `1+FUE` (volcado `damage "4"`); no usa DES si es mayor ni ofrece dado bárdico + DES. Efectos Advantage en Performance y Agile Strikes: texto | `core/rules/attacks.ts` (l. 183-204, solo Martial Arts / Unarmed Fighting), `core/rules/trait-effects.ts` (`unarmored`) |
| 6 · Inspiring Movement | Reacción gastando un uso | — texto basta | — | — |
| 6 · Tandem Footwork | Al tirar iniciativa gasta un uso | — texto basta | — | — |
| 14 · Leading Evasion | Evasión | — texto basta | No hay indicador de evasión; situacional | — |

## Colegio de la Elocuencia (2014, Theros/Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Silver Tongue | d20 9 o menos = 10 | — texto basta | — | — |
| 3 · Unsettling Words | Gasta un uso | — texto basta | — | — |
| 6 · Unfailing Inspiration | Conserva el dado | — texto basta | — | — |
| 6 · Universal Speech | 1 uso por descanso largo (o espacio) | ✅ completo | Contador `max=1 short=0` | `featUses` |
| 14 · Infectious Inspiration | mod CAR (mín. 1) usos, descanso largo | ✅ completo | Volcado `max=2` (CAR 14), `short=0` | `featUses` |

## Colegio del Glamour (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Beguiling Magic | Charm Person y Mirror Image siempre preparados; 1 uso/descanso largo, restaurable gastando un uso de Inspiración | ⚠️ parcial | Conjuros y contador ✅. Falta la acción "restaurar gastando 1 Bardic Inspiration" (sin botón) | `featUses`, `grantedSpells` |
| 3 · Mantle of Inspiration | Gasta un uso, PG temporales | — texto basta | — | — |
| 6 · Mantle of Majesty | Command siempre preparado; lanzarlo sin espacio 1/descanso largo (o espacio 3º+) | ✅ completo | Conjuro `always` y contador `max=1 short=0`. Ver Observaciones: aparece también "Command as a Bonus Action" como `atWill` | `featUses`, `grantedSpells` |
| 14 · Unbreakable Majesty | 1 uso por descanso corto o largo | ✅ completo | Contador `max=1 short="all"` correcto | `featUses` |

## Colegio del Saber (Lore, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | 3 habilidades a elegir | ❌ falta | **No hay selector ni se guardan**: `traitPicks` solo sirve a rasgos de especie (`species-picks.ts`); la subida de nivel solo ofrece habilidades al multiclasear. El volcado no muestra ni aviso ni `missing`. Hace falta: pedir 3 habilidades al elegir subclase (creación y subida) y sumarlas a competencias | `core/rules/species-picks.ts`, `core/rules/engine.ts` (l. 140-153, 268-295), `features/level-up/level-up.ts`, `core/creation/level-up.ts` |
| 3 · Cutting Words | Gasta un uso, reacción | — texto basta | — | — |
| 6 · Magical Discoveries | 2 conjuros de Clérigo/Druida/Mago (truco o con espacio), siempre preparados, cambiables al subir nivel | ❌ falta | Sin selector, sin conjuros concedidos (volcado: sin `grantedSpells`). Hace falta un selector de 2 conjuros de las 3 listas, guardados aparte (no cuentan contra preparados), con filtro por nivel máximo y sustitución por nivel | `core/rules/feat-effects.ts` (`FEAT_PICKS` solo tiene dotes), `shared/feat-choices.ts`, `features/level-up` |
| 14 · Peerless Skill | Gasta uso para sumar dado | — texto basta | — | — |

## Colegio de la Sátira (UA, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Herramientas de ladrón, Juego de Manos y 1 habilidad a elegir (cambia si ya se tiene) | ❌ falta | Ni competencias fijas ni la habilidad a elegir se aplican (`proficiencies()` solo mira clase, trasfondo, dotes y `toolChoices`) | `core/rules/engine.ts` (`proficiencies`, l. 614-660) |
| 3 · Tumbling Fool | Acción adicional: Dash+Disengage, trepar = Velocidad | — texto basta | No se refleja velocidad de trepar (situacional, solo en el turno) | — |
| 6 · Fool's Insight | Detect Thoughts CAR veces por descanso largo | ⚠️ parcial | Contador `max=2 short=0` ✅, pero **Detect Thoughts no aparece en `grantedSpells`/conjuros gratuitos** (volcado nivel 6 sin él) | `featUses`, `core/rules/feat-effects.ts` (lector de conjuros) |
| 14 · Fool's Luck | Gasta un uso | — texto basta | — | — |

## Colegio de los Espíritus (2024, Ravenloft)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Channeler | Truco Guidance; Juego de naipes con competencia; focos | ⚠️ parcial | Guidance concedido (`[subclass:Channeler]`, sin `always`: es truco, correcto). **No se concede la competencia con el juego de naipes** ni el objeto | `core/rules/engine.ts` (`proficiencies`) |
| 3 · Spirits from Beyond | Tabla de espíritus (d6...d12) | — texto basta | — | — |
| 6 · Empowered Channeling | Spirit Guardians siempre preparado + 1 lanzamiento gratis/largo; Half Cover 1/corto o largo | ✅ completo | Contadores `Spirit Guardians` (largo) y `Empowered Channeling` (`short-or-long`) y conjuro `free` correctos | `featUses`, `grantedSpells` |
| 14 · Mystical Connection | Tirar dos dados | — texto basta | — | — |

## Colegio de las Espadas (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Armadura media y cimitarra; arma cuerpo a cuerpo como foco | ❌ falta | Competencias de armadura/arma no se aplican (volcado CA y competencias sin cambios) | `core/rules/engine.ts` (`proficiencies`) |
| 3 · Fighting Style | Elegir Dueling (+2 daño) o Two-Weapon Fighting (mod al daño de la segunda) | ❌ falta | **Sin selector**: el texto del rasgo es una lista "Choose one of the following options" pero la subclase no pasa por `trait-choices` (solo especies); no hay ranura de dote en subclase. No se guarda ni se aplica al ataque | `core/rules/trait-choices.ts`, `core/rules/attacks.ts` (`styleAttack`), `core/rules/engine.ts` |
| 3 · Blade Flourish | Velocidad +10 en Attack, opciones gastando un uso | — texto basta | — | — |
| 6 · Extra Attack | 2 ataques | — texto basta | Ninguna clase modela Extra Attack en la tabla de ataques | — |
| 14 · Master's Flourish | d6 en lugar de gastar dado | — texto basta | — | — |

## Colegio de la Luna (2024, Heroes of Faerûn)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Moon's Inspiration | Invisibilidad/teletransporte, curación extra | — texto basta | — | — |
| 3 · Primal Lore | Druidic, 1 truco de Druida (no cuenta contra trucos conocidos, cambiable por nivel), 1 habilidad de 6 | ❌ falta | Sin selector de truco ni de habilidad; el truco no se guarda ni cuenta como de Bardo. Ni aviso ni `missing` en el volcado | `core/rules/feat-effects.ts`, `core/creation/spell-choices.ts`, `features/level-up` |
| 6 · Blessing of Moonlight | Moonbeam siempre preparado; 1 uso/descanso largo | ✅ completo | Conjuro `always` y contador `max=1 short=0` | `featUses`, `grantedSpells` |
| 14 · Eventide's Splendor | Mejora de Moon's Inspiration | — texto basta | — | — |

## Colegio del Valor (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Combat Inspiration | Defensa/ataque con el dado | — texto basta | — | — |
| 3 · Martial Training | Armas marciales, armadura media y escudos; foco con arma | ❌ falta | `proficiencies()` no lee competencias de subclase (volcado: CA 12 igual con cota; sin armas marciales ni armadura media) | `core/rules/engine.ts` (l. 614-660) |
| 6 · Extra Attack (+truco) | 2 ataques; truco por ataque | — texto basta | — | — |
| 14 · Battle Magic | Ataque como acción adicional | — texto basta | — | — |

## Colegio de los Susurros (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psychic Blades | 2d6 -> 8d6 psíquico gastando un uso | ⚠️ parcial | Sin fila de ataque ni daño escalado en la ficha (solo texto; el dado y la progresión 2d6/3d6/5d6/8d6 son aplicables a mano) | `core/rules/attacks.ts` |
| 3 · Words of Terror | 1 uso por descanso corto o largo | ✅ completo | Contador `max=1 short="all"` correcto | `featUses` |
| 6 · Mantle of Whispers | Captura de sombra: 1 vez por descanso corto o largo | ⚠️ parcial | Sin contador de la captura (volcado nivel 6/14: no aparece). Se anota a mano | `featUses` |
| 14 · Shadow Lore | 1 uso por descanso largo | ✅ completo | Contador `max=1 short=0` | `featUses` |

## Patrones comunes

1. **Competencias de subclase no leídas.** `proficiencies()` (engine.ts) solo suma clase inicial, multiclase, trasfondo, `toolChoices` y dotes; nada de subclase. Afecta a Valor (armas marciales/armadura media/escudos), Swords (armadura media/cimitarra), Satire (herramientas de ladrón/Juego de Manos), Spirits (juego de naipes). Un mismo lector por regex ("proficiency with X", "training with X armor") sobre el texto de subclase arreglaría 4 colegios.
2. **Elecciones dentro de rasgos de clase/subclase sin selector.** Lore (3 habilidades), Moon (1 habilidad + 1 truco), Satire (1 habilidad), Swords (Fighting Style). La maquinaria de elecciones (`traitPicks`, `trait-choices`) está pensada solo para especies. Sin aviso en `missing`/`warnings`.
3. **Conjuros extra elegibles de otras listas** (Magical Secrets, Magical Discoveries, Primal Lore): `spellsFor`/`countsFor` solo conocen la lista propia; no existe el concepto de "conjuro concedido elegido que no cuenta contra el límite".
4. **Acciones "restaurar usos gastando algo"** (Font of Inspiration, Beguiling Magic con Inspiración, "o gastar espacio" en Performance of Creation, Animating Performance, Universal Speech, Mantle of Majesty) no tienen botón: la recarga se hace a mano. Los contadores y descansos sí son correctos.
5. **Ataques**: nada específico de subclase en `attacks.ts` (Bardic Damage, Psychic Blades, Extra Attack).

## Dudas

- **Magical Discoveries / Primal Lore**: "You always have the chosen spells prepared" y "doesn't count against the number of cantrips you know" (Moon). No queda claro si los de Magical Discoveries cuentan contra los preparados del Bardo; el texto dice solo "always prepared". Se asumió que no cuentan (conjuros concedidos).
- **Beguiling Magic / Mantle of Majesty**: "restore ... by expending one use of Bardic Inspiration (no action)" y "level 3+ spell slot": texto claro, pero requiere interacción manual; se dejó como mejora.
- **Channeler (Spirits)**: no dice si Guidance cuenta contra trucos conocidos ("You know the Guidance cantrip" sin la salvedad de Moon). Se asumió que sí es adicional, como lo concede el volcado.
- **Sátira**: "choose another skill proficiency for each proficiency you already have" depende de las competencias previas; sin implementar.

## Observaciones (volcado)

- El volcado usa un personaje de prueba fijo (CAR 14); los máximos `2` de Bardic Inspiration e Infectious Inspiration son el mod CAR, no un valor fijo.
- `bard/college-of-glamour` nivel 6+ lista **"Command as a Bonus Action" como `atWill`** en `grantedSpells`: el rasgo está limitado a 1/descanso largo; marcarlo "a voluntad" es engañoso (parece un artefacto del lector de texto sobre "you can cast Command as a Bonus Action without expending a spell slot").
- `bard/college-of-spirits` nivel 6 muestra dos contadores de un solo rasgo: `Spirit Guardians` (largo) y `Empowered Channeling` (corto o largo, Half Cover). Es correcto, pero el segundo nombre es el del rasgo, no el de lo que recupera; el usuario puede confundirlos.
- Volcado: el aviso `traitPickMissing: Skillful` aparece en todas las entradas por la especie del personaje de prueba (humano); no es del Bardo.
- Jack of All Trades no se aplica a la Iniciativa (el texto de 2024 lo permite: cualquier prueba de característica sin competencia); fuera del alcance de las habilidades listadas.
- Ningún subclase ni la clase base genera `missing` ni avisos cuando faltan las elecciones de los puntos ❌, así que el usuario no es avisado.
- Extra Attack (Swords, Valor) no se refleja en la tabla de ataques para ninguna clase.
