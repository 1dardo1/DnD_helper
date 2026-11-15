# Auditoría de la clase Pícaro (Rogue)

Fuentes: `data/classes.json` (id `rogue`) y las 13 subclases de `data/subclasses.json` con `classId = rogue`. Estado según `docs/auditoria/_volcado/clase-rogue.json` y lectura del código en `app/src/app`. No se ha ejecutado nada del motor: lo marcado "(inferido)" sale de leer el lector de texto, no del volcado.

## Resumen

| | ✅ completo | ⚠️ parcial | ❌ falta | — texto basta | filas |
| --- | --- | --- | --- | --- | --- |
| Clase base | 9 | 0 | 1 | 8 | 18 |
| Arcane Trickster (2024) | 1 | 1 | 0 | 3 | 5 |
| Assassin (2024) | 3 | 0 | 0 | 2 | 5 |
| House Agent (UA 2024) | 0 | 1 | 1 | 4 | 6 |
| Inquisitive (2014) | 1 | 0 | 0 | 5 | 6 |
| Magic Stealer (UA 2024) | 2 | 0 | 0 | 4 | 6 |
| Mastermind (2014) | 0 | 0 | 1 | 4 | 5 |
| Phantom (2024) | 1 | 2 | 2 | 1 | 6 |
| Revived (UA 2014) | 1 | 1 | 2 | 2 | 6 |
| Scion of the Three (2024) | 1 | 1 | 1 | 2 | 5 |
| Scout (2014) | 0 | 1 | 1 | 3 | 5 |
| Soulknife (2024) | 3 | 2 | 0 | 0 | 5 |
| Swashbuckler (2014) | 2 | 0 | 0 | 3 | 5 |
| Thief (2024) | 1 | 0 | 0 | 4 | 5 |
| **Total** | **25** | **9** | **9** | **45** | **88** |

## Fallo reportado por el usuario: "Soulknife no tiene Cuchillas Psíquicas ni contador de Dados de Energía Psiónica"

**Conclusión: no he encontrado ningún fallo de código.** Con los datos y el motor actuales la ficha SÍ muestra ambas cosas, también para el personaje real del repo (Kriug, Pícaro 4, `rogue/soulknife`, `characters/kriug-1793958485566.json`). Las causas más probables, por orden:

1. **Versión vieja en el dispositivo (la más probable).** Las hojas psíquicas llegaron el 2026-11-07 (commit `8d8fcfa`, "Soulknife Rogue's Psychic Blades to the attacks table") y el contador por pools el 2026-11-09 (`eed0a5c`, `core/rules/pools.ts`). Kriug se guardó desde dos PCs entre el 7 y el 11 de noviembre. Una PWA/APK anterior a esas fechas no tiene ni filas ni contador. Es el riesgo conocido nº 2 de CLAUDE.md: comprobar primero que recarga/actualiza.
2. **Nombre distinto al esperado.** El usuario escribe "Cuchillas Psíquicas", pero la app usa tres nombres: la subclase "Cuchillo del alma", el rasgo del compendio "Espadas psíquicas" (`data/es/subclasses.json`) y la fila de ataque "Hoja psíquica" / "Hoja psíquica (acción adicional)" (`core/i18n/es.ts:854-855`). Además, en la pestaña Combate la fila del rasgo "Psychic Blades" se omite a propósito (`STRUCTURED` en `core/combat/combat-actions.ts:128`) y las hojas salen como filas de ataque en la sección "Sin armas, naturales y especiales" (`attackRows`, `combat-actions.ts:185-215`, `section: a.entryId ? 'weapons' : 'natural'`). Quien busque "Cuchillas" o "Espadas" en el Combate no las encuentra por ese nombre. Acción sugerida: unificar el término (una sola traducción para Psychic Blade/Blades) en glosario, `sheet.psychicBlade*` y datos.
3. **Subclase sin elegir.** Sin `subclassId` el motor no activa nada (`engine.ts:1288`, `1306`; `pools.ts poolsOf`). La subclase se pide en el asistente (ver b) y el aviso `sheet.warn.noSubclass` sale en la hoja.

### (a) ¿La hoja muestra los contadores y los ataques?
- **Contador**: `pools.ts:54-60` (`rogue/soulknife`, feature `Psionic Power`, `from: 3`, lee la tabla "| 3 | D6 | 4 |" con `energyDiceTable`) → `playResources` (`play-state.ts:270-272`) → fieldset "Recursos" de `play-panel.html:337-415` (pestaña Hoja, `character-sheet.html:360-365` con `part="resources"`) y de `combat-tab.html:337`. Volcado: `Psionic Energy Dice max=4 short=1` (nivel 3), 6 (5), 8 (9), 10 (13), 12 (17): coincide con la tabla del texto. Etiqueta "Dados de energía psiónica" (`es.ts:511`), con el tamaño del dado.
- **Ataques**: `attacks.ts:290-333` (`psychicBladesFor`): "Psychic Blade" 1d6+mod psíquico, Finesse/Thrown 60/120, Vex; y la de acción adicional 1d4+mod (se oculta si hay arma a dos manos equipada). Se activa con `combat.psychicBlades` (`engine.ts:1306`, nivel de Soulknife ≥ 3). Se pinta en `equipment-panel.html` (tabla de ataques, `part="attacks"`) y en el Combate (`attackRows`). Sin condición de edición ni de filtro que las oculte.
- Hay tests con datos reales: `play-state.spec.ts:235-241` (dados por nivel y descanso corto) y `combat-actions.spec.ts` ("Kriug (Soulknife): blades, Cunning Action, Psionic Power with its counter").

### (b) Asistente de creación y subida de nivel
- Creación: `character-create.html:161` muestra el selector de subclase cuando `r.entry.level >= k.subclassLevel` (3 para el Pícaro), con todas las subclases de la clase (`subclassesFor`, `creation-rules.ts:157`). `setLevel` (`character-create.ts:1082-1100`) solo borra la subclase si el nivel baja de 3. Elegir Soulknife a nivel 3+ al crear funciona.
- Subida 2→3: `levelGains` (`core/creation/level-up.ts:109`) pone `needsSubclass = level >= subclassLevel && !entryBefore?.subclassId`; `level-up.ts` añade el paso `'subclass'` (línea 305) y `setSubclass` (línea 516) guarda `k.subclassId`. Correcto.

### (c) ¿Condición de id o de edición?
Los ids son `rogue/soulknife` en el JSON del personaje real y en `pools.ts:55`, `engine.ts:1288`, `class-theme.ts:268`. Solo existe una variante de Soulknife (2024, PHB) en `data/subclasses.json`; no hay id 2014 que pueda fallar. Que la especie de Kriug sea de 2014 (Goblin, Plane Shift: Zendikar) no interviene.

### (d) Usos de Psionic Power: ¿gastan del contador?
Las filas de Combate se leen del texto (`featureRows`, `combat-actions.ts:477-550`; `usesOf`/`blocksOf` en `action-text.ts`) y su coste apunta al contador cuando el texto dice "expend/roll ... Psionic Energy Die" (`resourceFor`, `combat-actions.ts:440-466`):

| Uso | Fila | Coste del contador | Nota |
| --- | --- | --- | --- |
| Psi-Bolstered Knack | libre (spec confirma `free`) | dado de energía | el dado solo se gasta si la tirada sale; hay que marcarlo a mano |
| Psychic Whispers | Acción (Magia), sección "con recurso" | dado de energía (spec: `max: 4`) | ok |
| Homing Strikes (nv. 9) | nota en la fila de la hoja (`soulBladesHoming`) | texto, no fila propia | gasto manual en el contador |
| Psychic Teleportation (nv. 9) | Acción adicional | dado de energía | ok (inferido del texto) |
| Psychic Veil (nv. 13) | Acción (spec) | **probable fallo**: `resourceFor` no ve el contador propio "Psychic Veil" (tiene `feat` y se excluye) y cae al regex del texto "expend a Psionic Energy Die" → la fila cobra un dado en vez de la única vez por descanso largo | no verificado ejecutando |
| Rend Mind (nv. 17) | puede no tener fila (el disparador "al hacer Sneak Attack con las hojas" no encaja con ningún patrón de `action-text.ts`) | el coste serían 3 dados, la ficha cobraría 1 | el contador "Rend Mind 1/LR" existe; restaurar con 3 dados es manual |

Recarga de los dados: `rest-rules.ts:37` `'psionic energy dice': { short: 1 }` = un dado en descanso corto y todos en largo, igual que el texto.

**Duda sobre el encargo**: "Psychic Whispers: recuperar un dado con acción adicional" no está en el texto de `data/subclasses.json` (Psychic Whispers es telepatía con acción Magia). El texto real solo dice: un dado en descanso corto, todos en largo. No hay recuperación con acción adicional que implementar.

## Clase base

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Expertise (y nv. 6) | 2 pericias con Expertise en nv. 1 y otras 2 en nv. 6 | ✅ | — | `creation-rules.ts:151` (`expertiseCount`), `level-up.ts:112`, `character.choices.expertise`, `engine.ts:268` |
| 1 · Sneak Attack | Dados 1d6…10d6 de la columna de la tabla; nota "Ataque furtivo: {n}" en Combate | ✅ | Condiciones (ventaja o aliado) y suma a la fila de ataque son manuales | `engine.ts:1332-1335`, `es.ts` `combat.note.sneak` |
| 1 · Thieves' Cant | Idioma añadido automáticamente + el idioma a elegir | ✅ | — | `engine.ts:605` (`FEATURE_LANGUAGES`), `feat-effects.ts:385` |
| 1 · Weapon Mastery | 2 ranuras, selector en el panel de equipo, cambio libre | ✅ | — | `engine.ts:1255`, `equipment-panel.*`, `choices.weaponMasteries` |
| 2 · Cunning Action | Fila de Acción adicional en Combate | — | Texto basta | `combat-actions.spec.ts` |
| 3 · Rogue Subclass | Selector en creación y subida de nivel | ✅ | — | ver (b) |
| 3 · Steady Aim | Fila de Acción adicional por texto | — | Texto basta | — |
| 4, 8, 10, 12, 16 · Ability Score Improvement | Ranuras `rogue:N` de dote/ASI | ✅ | — | `featSlots` |
| 5 · Cunning Strike | CD 8 + DES + competencia calculada y visible (lector genérico de CD) | ✅ | Opciones Poison/Trip/Withdraw y su coste en d6 son texto; no descuentan dados del furtivo | `feature-stats.ts:721` (`writtenDc`), `combat-actions.ts` (`featureDcs`) |
| 5 · Uncanny Dodge | Fila de Reacción | — | Texto basta | — |
| 7 · Evasion | — | — | Texto basta | — |
| 7 · Reliable Talent | Mínimo 10 en d20 de pericias | — | Situacional (la app no tira) | — |
| 11 · Improved Cunning Strike | Dos efectos a la vez | — | Texto basta | — |
| 14 · Devious Strikes | Daze/Knock Out/Obscure con CD | — | Texto basta (CD ya sale) | — |
| 15 · Slippery Mind | Competencia en salvaciones de SAB y CAR | ❌ | La hoja solo suma salvaciones de la clase y Resilient (`saveProf` en `engine.ts:250-255`); ningún lector toma "proficiency in X saving throws" de un rasgo. No hay ni una mención de Slippery Mind en el código | `engine.ts:250-258` |
| 18 · Elusive | Nadie tiene ventaja contra ti | — | Texto basta | — |
| 19 · Epic Boon | Ranura de dote de Gracia | ✅ | — | `featSlots` |
| 20 · Stroke of Luck | Contador 1 con recarga corta y larga | ✅ | — | `play-state.ts:150-156`, `rest-rules.ts:35` |

## Arcane Trickster (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Spellcasting | Lanzador INT, lista de Mago (`spellList: wizard`), hechizos preparados 3→13, ranuras 2…4/3/3/1 igual que la tabla del texto, cambio de un hechizo por nivel | ⚠️ | `cantripsByLevel` es `null` en `data/subclasses.json`: el volcado marca `cantrips=null`, así que no se limitan los trucos (3 a nivel 3 y 4 a nivel 10 según el texto) ni se concede Mage Hand automáticamente | `subclasses.json` (regla del scraper), `creation-rules.ts:172-198`, `spell-choices.ts` |
| 3 · Mage Hand Legerdemain | — | — | Texto basta | — |
| 9 · Magical Ambush | — | — | Texto basta | — |
| 13 · Versatile Trickster | — | — | Texto basta | — |
| 17 · Spell Thief | Contador 1 por descanso largo | ✅ | — | volcado: `Spell Thief max=1 short=0` |

## Assassin (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Assassinate | Nota de daño extra = nivel de Pícaro | ✅ | La ventaja en Iniciativa y en la primera ronda es solo texto | `feature-stats.ts:608-616` |
| 3 · Assassin's Tools | Competencia con Kit de disfraz y Kit de envenenador | ✅ (inferido) | No está en el volcado; el lector de `trait-effects.ts:238-253` debería capturar ambas herramientas porque están en `KNOWN_TOOLS` | `trait-effects.ts:83-90`, `engine.ts:483` |
| 9 · Infiltration Expertise | — | — | Texto basta | — |
| 13 · Envenom Weapons | 2d6 veneno con Poison | — | Texto basta | — |
| 17 · Death Strike | CD 8 + DES + competencia calculada | ✅ | — | `writtenDc` |

## House Agent (UA15 · 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · House Insignia | Friends + Charm Person (3), Suggestion (5), Hypnotic Pattern (9) como hechizos concedidos "siempre preparados" | ⚠️ | El texto dice "una vez por descanso largo" cada hechizo del emblema, con CAR; el volcado no da contador (`free=`) y los trata como hechizos de ranura (el Pícaro no tiene). Falta Find Familiar (solo ritual, forma Araña) | `engine.ts:1215-1235` (hechizos de subclase siempre preparados), `feat-effects.ts` |
| 3 · Charming Presence | Competencia en 1 de 4 habilidades a elegir | ❌ | No hay selector (`missing: []`); la competencia no se aplica | `trait-choices.ts` / `species-picks.ts` (no cubren subclases) |
| 9 · Backstab | Opción Stunning Betrayal | — | Texto basta | — |
| 13 · Infiltration Partner | Familiar mejorado | — | Texto basta | — |
| 13 · Silver Tongue | — | — | Texto basta | — |
| 17 · Subtle Manipulator | Opción Confound (CD de conjuro), Friends | — | Texto basta | — |

## Inquisitive (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Ear for Deceit | — | — | Texto basta | — |
| 3 · Eye for Detail | — | — | Texto basta | — |
| 3 · Insightful Fighting | Activa Sneak Attack sin ventaja 1 minuto | — | Texto basta | — |
| 9 · Steady Eye | — | — | Texto basta | — |
| 13 · Unerring Eye | Contador = mod. SAB (mín. 1), descanso largo | ✅ | — | volcado `Unerring Eye max=2 short=0` |
| 17 · Eye for Weakness | +3d6 al furtivo | — | Texto basta | — |

## Magic Stealer (UA11 · 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Empower Sneak Attack | Contador = mod. INT (mín. 1), descanso largo | ✅ | — | volcado |
| 3 · Drain Magic | Contador 1, recarga corta o larga (`short="all"`) | ✅ | — | volcado |
| 9 · Magical Sabotague | Opciones de Cunning Strike | — | Texto basta | — |
| 13 · Occult Shroud | Nondetection al terminar descanso largo | — | Texto basta (sin fila ni contador) | — |
| 13 · Improved Drain Magic | Mejora de Drain Magic | — | Texto basta | — |
| 17 · Eldritch Implosion | CD 8 + DES + competencia | — | Texto basta (CD ya sale) | — |

## Mastermind (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Master of Intrigue | Kits de disfraz y falsificación, un juego a elegir, 2 idiomas a elegir | ❌ | La frase lleva "of your choice", que bloquea el lector (`trait-effects.ts:239-241`): no se dan ni los dos kits fijos ni hay selector del juego. Selector de idiomas no verificado | `trait-effects.ts:238-253` |
| 3 · Master of Tactics | — | — | Texto basta | — |
| 9 · Insightful Manipulator | — | — | Texto basta | — |
| 13 · Misdirection | — | — | Texto basta | — |
| 17 · Soul of Deceit | — | — | Texto basta | — |

## Phantom (Ravenloft · 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Wails from the Grave | Contador = mod. DES (mín. 1), descanso largo | ✅ | Daño (mitad de los dados de furtivo, redondeado arriba) no calculado | volcado `max=2 short=0` |
| 3 · Whispers of the Dead | Elegir en cada descanso una competencia que no se tenga | ❌ | Ni selector ni diálogo de descanso (`missing: []`, `restPicks: []`) | `trait-rest-dialog`, `rest-choices.ts` |
| 9 · Tokens of the Departed | Reliquias de alma: 2/3/4, ventaja en salvaciones CON/muerte, Augury, usos | ❌ | Sin contador de reliquias (aparte del contador de Ghost Walk) | `feat-effects.ts` / `play-state.ts` |
| 9 · Voice of Death | Speak with Dead gratis (concedido con contador) | ⚠️ | El contador se recarga solo en descanso largo (`short=0`); el texto dice "descanso corto o largo" (`short: 'all'`) | `feat-effects.ts` (lector de usos), `play-state.ts:281-290` |
| 13 · Ghost Walk | Contador 1 por descanso largo | ⚠️ | No se modela restaurarlo destruyendo una reliquia (depende de Tokens). Vuelo 10 pies y demás son estados situacionales | — |
| 17 · Death's Friend | — | — | Texto basta | — |

## Revived (UA 64 · 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Tokens of Past Lives | Una competencia (habilidad o herramienta) a elegir en cada descanso largo | ❌ | Sin selector ni diálogo de descanso | `rest-choices.ts` |
| 3 · Revived Nature | Resistencia a veneno (volcado: `resistances: ["Poison"]`) | ✅ | Ventaja contra enfermedad/veneno y no comer/dormir quedan como texto | `trait-effects.ts:258` |
| 3 · Bolts from the Grave | Ataque de conjuro a distancia 30 pies con DES, daño = Sneak Attack | ❌ | No hay fila en la tabla de ataques (solo existe la fila de Soulknife) | `attacks.ts` |
| 9 · Connect with the Dead | Contador 1 con recarga corta o larga | ⚠️ | Speak with Dead no se concede como hechizo con su fila; el beneficio aleatorio d3 es texto | volcado `short="all"` |
| 13 · Audience with Death | — | — | Texto basta | — |
| 17 · Ethereal Jaunt | — | — | Texto basta | — |

## Scion of the Three (Heroes of Faerûn · 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bloodthirst | Contador = mod. INT (mín. 1), descanso largo | ✅ | — | volcado |
| 3 · Dread Allegiance | Elegir Bane/Bhaal/Myrkul: resistencia (psíquico/veneno/necrótico) y truco (Minor Illusion/Blade Ward/Chill Touch), cambiable tras descanso largo | ❌ | Sin selector; el volcado no da resistencia ni truco concedido (`resistances: []`, `grantedSpells: []`, `missing: []`) | `species-picks.ts`/`feat-effects.ts` solo cubren especie y dotes |
| 9 · Strike Fear | Opción Terrify | — | Texto basta | — |
| 13 · Aura of Malevolence | Daño = mod. INT del tipo elegido | — | Texto basta (depende de Dread Allegiance) | — |
| 17 · Dread Incarnate | Cutthroat: recupera un uso de Bloodthirst en descanso corto; Murderous Intent | ⚠️ | El contador de Bloodthirst no se recarga con descanso corto (`short=0`) | `rest-rules.ts`, `play-state.ts` |

## Scout (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Skirmisher | — | — | Texto basta | — |
| 3 · Survivalist | Competencia en Naturaleza y Supervivencia, doble competencia | ⚠️ | La competencia se aplica (lector de habilidades, `trait-effects.ts:242`); el doble (Expertise) no (`engine.ts:268` solo usa `choices.expertise`) | `trait-effects.ts`, `engine.ts:268-296` |
| 9 · Superior Mobility | +10 pies de velocidad | ❌ | El volcado deja `walk: 30` del 9 al 20; el lector de velocidad (`trait-effects.ts:166-235`, `feat-effects.ts:371`) no reconoce "walking speed increases by 10 feet" | `trait-effects.ts` |
| 13 · Ambush Master | — | — | Texto basta | — |
| 17 · Sudden Strike | — | — | Texto basta | — |

## Soulknife (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psionic Power | Contador de Dados de Energía Psiónica con tamaño y cantidad por nivel (4d6 … 12d12 según tabla), recarga 1 en corto y todos en largo; filas de Psi-Bolstered Knack y Psychic Whispers que cobran un dado | ✅ | Gasto del Knack (solo si la tirada sale) manual | `pools.ts:54`, `play-state.ts:270`, `rest-rules.ts:37`, `combat-actions.ts` |
| 3 · Psychic Blades | Dos filas de ataque (1d6 y 1d4 de acción adicional, + mod., psíquico, Finesse/Thrown/Vex) | ✅ | La comprobación de la otra mano libre con escudo/arma ligera es una nota, no se calcula | `attacks.ts:290-333`, `engine.ts:1306` |
| 9 · Soul Blades | Nota de Homing Strikes en la hoja; Psychic Teleportation con su fila y coste | ✅ | Homing Strikes no tiene fila propia, el gasto del dado es manual | `attacks.ts:299`, `feature-coverage.spec.ts:42` |
| 13 · Psychic Veil | Contador 1 por descanso largo + fila de Acción | ⚠️ | Restaurarlo gastando un dado es manual; la fila apunta (probable) al contador de dados en vez de al uso propio (ver (d)) | `combat-actions.ts:440-466` |
| 17 · Rend Mind | Contador 1 por descanso largo y CD 8 + DES + competencia | ⚠️ | Restaurar con 3 dados es manual; puede no tener fila de combate (ver (d)) | `combat-actions.ts`, `action-text.ts` |

## Swashbuckler (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Fancy Footwork | — | — | Texto basta | — |
| 3 · Rakish Audacity | Bonificador de Iniciativa = mod. CAR (inferido; no está en el volcado) | ✅ (inferido) | La condición alternativa del furtivo es texto | `trait-effects.ts:155-165`, `engine.ts:300-304` |
| 9 · Panache | — | — | Texto basta | — |
| 13 · Elegant Maneuver | — | — | Texto basta | — |
| 17 · Master Duelist | Contador 1, recarga corta o larga | ✅ | — | volcado `short="all"` |

## Thief (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Fast Hands | — | — | Texto basta | — |
| 3 · Second Story Work | Velocidad de trepar = velocidad (volcado `climb: 30`) | ✅ | Salto con DES es texto | `trait-effects.ts:221-232` |
| 9 · Supreme Sneak | Opción Stealth Attack | — | Texto basta | — |
| 13 · Use Magic Device | Sintonía con 4 objetos, cargas, pergaminos | — | Texto basta; la app no cuenta sintonías de ningún tipo | — |
| 17 · Thief's Reflexes | — | — | Texto basta | — |

## Patrones comunes

1. **Elecciones dentro de rasgos de subclase sin selector.** Los selectores existentes (`species-picks.ts`, `trait-choices.ts`, diálogo de descanso) solo cubren especies y dotes. Rasgos de subclase afectados en el Pícaro: Dread Allegiance (Scion), Charming Presence (House Agent), Whispers of the Dead (Phantom), Tokens of Past Lives (Revived), Master of Intrigue (Mastermind). Tres de ellos son además elecciones que se cambian en descanso, así que sirve un mismo mecanismo "elección de subclase con descanso".
2. **Competencia en salvaciones concedida por un rasgo** (Slippery Mind aquí) no tiene lector; solo clase y Resilient.
3. **Recargas por descanso corto que el lector no reconoce.** Voice of Death (corto o largo, sale solo largo) y Cutthroat de Dread Incarnate (recupera 1 uso en corto). Hay que revisar cómo `featRules` detecta "Short or Long Rest" y los usos parciales.
4. **Restauración de un rasgo gastando dados** (Psychic Veil, Rend Mind, Ghost Walk con reliquias): sin mecanismo, todo manual.
5. **Velocidad andando de subclase** ("Your walking speed increases by 10 feet", Scout) no se lee.
6. **Datos del scraper incompletos**: Arcane Trickster tiene `cantripsByLevel: null`. Hay que arreglarlo en la regla del scraper (skill `datos`), no a mano en `data/`.
7. **Hechizos de subclase "una vez por descanso largo"** (House Insignia) se tratan como siempre preparados con ranura.

## Dudas

- El encargo menciona "Psychic Whispers: recuperar un dado con acción adicional". El texto de `data/subclasses.json` no lo dice (Psychic Whispers es telepatía, acción Magia). Confirmar de dónde viene esa idea (posible versión 2014/UA).
- Nombre en español de Psychic Blade(s): la subclase es "Cuchillo del alma" (decidido por el usuario), pero el rasgo es "Espadas psíquicas" y la fila "Hoja psíquica", y el usuario habla de "Cuchillas Psíquicas". ¿Cuál se quiere?
- House Agent: "Una vez que lanzas un hechizo con el emblema, no puedes volver a lanzarlo hasta un descanso largo". Dudoso si el emblema consume ranura (el texto dice que no hay ranuras; parece un lanzamiento por rasgo, una vez por descanso largo).
- Psychic Veil/Rend Mind: no he ejecutado el motor; el coste que muestra la fila de Combate es una deducción de `resourceFor`. Conviene comprobarlo con el personaje de prueba.
- Rakish Audacity y Assassin's Tools se marcan ✅ por lectura del código (no figuran en el volcado, que no incluye iniciativa ni competencias).

## Observaciones

- La clase base está muy bien cubierta; el único hueco claro es Slippery Mind.
- Hay 7 subclases 2014/UA y 6 de 2024 sin selector o sin contador en algún rasgo; todas las de 2024 oficiales del PHB (Arcane Trickster, Assassin, Soulknife, Thief) están completas salvo los trucos del Trickster.
- Los contadores que dependen de un modificador de característica (Wails, Bloodthirst, Empower, Unerring Eye) usan `max(1, mod)` como pide el texto.
- El personaje real Kriug (Soulknife 4) ya tiene un test que verifica las filas de Hoja psíquica, Cunning Action, Psionic Power con su contador y Sneak Attack (`combat-actions.spec.ts`).
