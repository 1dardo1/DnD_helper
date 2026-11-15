# Auditoría de la clase Monje (Monk)

Fuentes: `data/classes.json` (id `monk`, 2024), `data/subclasses.json` (`classId` = `monk`, 15 subclases), volcado `docs/auditoria/_volcado/clase-monk.json` y código de `app/src/app/core/`. No se ejecutó ningún test ni build. Los estados que no se ven en el volcado (habilidades, herramientas, filas de la pestaña Combate) salen de leer el código y se marcan "(código)".

## Resumen

| Estado | Recuento |
| --- | --- |
| ✅ completo | 26 |
| ⚠️ parcial | 14 |
| ❌ falta | 17 |
| — texto basta | 46 |

Por bloque (✅/⚠️/❌/—): base 11/2/3/9 · Mercy 5/0/0/1 · Shadow 1/2/0/3 · Elements 2/0/3/0 · Open Hand 1/0/0/3 · Mystic Arts 0/1/1/3 · Tattooed (UA) 0/3/2/0 · Intoxication (UA) 0/1/1/4 · Venom (UA) 1/0/1/4 · Ascendant Dragon 3/3/0/3 · Astral Self 0/0/2/2 · Drunken Master 1/0/0/4 · Kensei 0/0/1/3 · Long Death 0/0/0/4 · Sun Soul 0/0/2/2 · Tranquility (UA) 1/2/1/1.

Fallos más graves, en orden:
1. **Velocidad del Monje con +10 pies de más** en todos los niveles y subclases (Unarmored Movement se cuenta dos veces).
2. **Body and Mind (nv. 20)** no aplica el +4 a DES y SAB (máx. 25), así que CA, ataque y CD quedan mal en el nivel 20.
3. **Disciplined Survivor (nv. 14)** no da competencia en todas las salvaciones.
4. **Tattooed Warrior**: no hay selector de tatuajes y la hoja concede los 5 trucos de Beast Tattoo a la vez.
5. **Warrior of Intoxication**: Heavenly Spirit (bebida temporal de 1 h) concede Resistencia a Psíquico y Radiante de forma permanente desde el nivel 6.
6. Sin estados activables para Elemental Attunement, Astral Self, Kensei, Radiant Sun Bolt, Healing Hands (reserva), etc.

## Clase base

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Martial Arts | Dado de la tabla (1d6 a 1d12) en `combat.martialArts`. Golpe sin armas con DES si DES > FUE. Armas de monje: simples cuerpo a cuerpo y Shortsword. Los valores del volcado son correctos (1d6/1d8/1d10/1d12 en los niveles 1/5/11/17). | ⚠️ | (a) El dado y la DES se aplican aunque lleve armadura o escudo: el texto lo exige "sin armadura ni escudo". (b) La detección de arma de monje es incorrecta: usa `item.name === 'Shortsword'` y excluye `two-handed`/`heavy`. Falta la **Scimitar** (marcial con Light) y sobra excluir la **Greatclub** (simple, Two-Handed), que sí es arma de monje en 2024. Debería usar "simple cuerpo a cuerpo o marcial cuerpo a cuerpo con Light". (c) El Golpe adicional como Acción adicional y la CD de Agarrar/Empujar con DES son solo texto. | `core/rules/engine.ts` (1286-1302), `core/rules/attacks.ts` (117-190) |
| 1 · Unarmored Defense | CA 10 + DES + SAB (CA 14 con 14/14 en el volcado; se usa si es mejor que 10 + DES). | ✅ | Nada. | `core/rules/engine.ts` (345-361), `trait-effects.ts` |
| 2 · Monk's Focus / Focus Points | Contador "Focus Points" con máx. = tabla (2-20), recarga corta = todo. La CD 8 + SAB + competencia sale del texto y se muestra bajo "Monk's Focus". | ✅ | Nada. | `core/play/rest-rules.ts` (27), `core/rules/feature-stats.ts` (`writtenDc`) |
| 2 · Flurry of Blows | Fila de Combate (código): coste 1 Focus Point enlazado al contador por el texto "expend 1 Focus Point". | ✅ | Nada. Las 2 o 3 pegadas (nv. 10) son texto. | `core/combat/combat-actions.ts` (`resourceFor`) |
| 2 · Patient Defense | Fila de Combate con coste 1 FP; nota `patientDefense` en `USE`. | ✅ | Nada. | `feature-stats.ts` (84) |
| 2 · Step of the Wind | Fila de Combate con coste 1 FP. | ✅ | Nada. La velocidad de salto doblada es texto. | igual |
| 2 · Unarmored Movement | Bonus de la columna de tabla (+10 a +30 pies) sin armadura ni escudo. | ❌ | **Bug de doble conteo**: el lector de `trait-effects.ts` (170) interpreta "Your speed increases by 10 feet while you aren't wearing armor" como `armorSpeed` (+10) y además `engine.ts` (375-381) suma la columna de la tabla. Resultado: base 30 → 50 en nv. 2 (debe ser 40); 55 en nv. 6 (45); 60 en nv. 10 (50); 70 en nv. 18-20 (60). Afecta a todas las subclases y a Stride of the Elements. Arreglo: ignorar el +10 del texto para Monk, o quitar la columna. | `core/rules/engine.ts` (375-381), `core/rules/trait-effects.ts` (166-172) |
| 2 · Uncanny Metabolism | Contador de 1 uso con recarga larga (`short=0`); nota con "dado + nivel" de curación. | ✅ | Nada. No restaura los Focus Points sola: se hace a mano con el contador. | `core/play/play-state.ts` (115), `feature-stats.ts` (397) |
| 3 · Deflect Attacks | Reacción, nota 1d10 + DES + nivel de Monje. | ✅ | Nada. Redirigir (1 FP, daño 2 dados + DES) es texto. | `feature-stats.ts` (389) |
| 3 · Monk Subclass | Elección de subclase al nivel 3; aviso `noSubclass` si falta. | ✅ | Nada. | `engine.ts` (132) |
| 4/8/12/16 · Ability Score Improvement | Ranuras de dote por nivel. | ✅ | Nada. | `engine.ts`, `features/level-up` |
| 4 · Slow Fall | Reacción, reduce 5 × nivel. | ✅ | Nada. | `feature-stats.ts` (413) |
| 5 · Extra Attack | — | — | Narrativo. | — |
| 5 · Stunning Strike | Fila de Combate con coste 1 FP por el texto. La CD (Monk's Focus) aparece, pero no atada a este rasgo. | ⚠️ | Mostrar la CD junto a Stunning Strike (ni `USE` ni `DEFS` lo tienen, a diferencia de `elementalBurst` con `dc: 'focus'`). | `feature-stats.ts`, `combat-actions.ts` (`featureDcs`) |
| 6 · Empowered Strikes | — | — | Opción de daño Fuerza: texto basta. | — |
| 7 · Evasion | — | — | Texto basta. | — |
| 9 · Acrobatic Movement | — | — | Texto basta. | — |
| 10 · Heightened Focus | Nota de PG temporales de Patient Defense (2 dados). | ✅ | Nada. | `feature-stats.ts` (405) |
| 10 · Self-Restoration | — | — | Texto basta. | — |
| 13 · Deflect Energy | — | — | Texto basta. | — |
| 14 · Disciplined Survivor | Solo texto. | ❌ | **No da competencia en todas las salvaciones** (`engine.ts` 250 solo lee `cls.savingThrows` + `choices.saves`). Falta leer "proficiency in all saving throws" y marcar las 6. El reroll de 1 FP es texto. | `core/rules/engine.ts` (249-256) |
| 15 · Perfect Focus | — | — | Texto basta. | — |
| 18 · Superior Defense | Fila de Combate con coste 3 FP (código). | — | Resistencia a todo menos Fuerza durante 1 min: texto basta, sin estado activable. | — |
| 19 · Epic Boon | Ranura de dote. | — | Genérico. | — |
| 20 · Body and Mind | Solo texto. | ❌ | **No aplica +4 a DES y SAB (máx. 25).** Volcado nv. 20: CA 14 y ataque +9 con DES/SAB 14; deberían ser 18/18 (CA 18). No hay ningún lector de "scores increase by N" (ídem Primal Champion del Bárbaro). | `core/rules/engine.ts` (abilities) |

## Warrior of Mercy (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Hand of Harm | Nota `onHit` con coste 1 FP y daño "dado + SAB". | ✅ | Nada. | `feature-stats.ts` (421) |
| 3 · Hand of Healing | Acción, coste 1 FP, curación "dado + SAB". | ✅ | Nada. | `feature-stats.ts` (431) |
| 3 · Implements of Mercy | Competencia en Insight y Medicine y con Herbalism Kit leída del texto (código). | ✅ | Nada. | `trait-effects.ts` (238-255) |
| 6 · Physician's Touch | — | — | Texto basta. | — |
| 11 · Flurry of Healing and Harm | Contador máx. = mod. SAB (mín. 1; 2 en el volcado), recarga larga. | ✅ | Nada. | `core/rules/engine.ts` (`featUses`) |
| 17 · Hand of Ultimate Mercy | Contador 1 uso, recarga larga; coste 5 FP por texto. | ✅ | Nada. | idem |

## Warrior of Shadow (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Shadow Arts: Darkness | Fila de Combate con coste 1 FP (texto). | ⚠️ | El conjuro **Darkness no aparece** en `grantedSpells` (solo Minor Illusion). La frase "expend 1 Focus Point to cast the Darkness spell" no está cubierta por `featRules`; no hay ficha del conjuro enlazada. | `core/rules/feat-effects.ts` (`featRules`) |
| 3 · Shadow Arts: Darkvision | Darkvision 60 (volcado). | ⚠️ | "Si ya tienes Visión en la oscuridad, su alcance aumenta en 60": el motor toma el **máximo** (`engine.ts` 384-396), no suma. Una especie con 60 pies queda en 60 y debería ser 120. | `core/rules/engine.ts` (380-396), `trait-effects.ts` (207-216) |
| 3 · Shadow Arts: Shadowy Figments | Minor Illusion con SAB (`subclass:Shadow Arts`). | ✅ | Nada. | — |
| 6 · Shadow Step | — | — | Texto basta; sin contador (no tiene límite). | — |
| 11 · Improved Shadow Step | — | — | Coste 1 FP por texto. | — |
| 17 · Cloak of Shadows | — | — | Coste 3 FP por texto; condición Invisible manual. | — |

## Warrior of the Elements (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Elemental Attunement | Solo texto, coste 1 FP. | ❌ | No hay estado activable (`active-states.ts` solo tiene rage, wildShape, hex, huntersMark, innateSorcery). Falta el interruptor de 10 min (reach +10 pies en el ataque sin armas, daño elemental a elegir, salvación de Fuerza sin CD mostrada). La fila de Golpe sin armas dice `reach: 5` fijo. | `core/rules/active-states.ts`, `attacks.ts` |
| 3 · Manipulate Elements | Elementalism con SAB (volcado). | ✅ | Nada. | — |
| 6 · Elemental Burst | Acción, coste 2 FP, daño "3 dados" y CD 8 + SAB + comp. | ✅ | Nada. | `feature-stats.ts` (449, 89) |
| 11 · Stride of the Elements | Solo texto. | ❌ | Vuelo y Natación = Velocidad "mientras Elemental Attunement esté activo": al no haber estado, **no se refleja en `speed`** (nv. 11+ solo `walk`). | `engine.ts` (speed) |
| 17 · Elemental Epitome | Solo texto. | ❌ | Depende del mismo estado: resistencia a elegir y cambiable cada turno, Destructive Stride (+20 pies) y daño extra con Empowered Strikes. Resistencias en volcado: vacío. | `engine.ts`, `active-states.ts` |

## Warrior of the Open Hand (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Open Hand Technique | — | — | Texto basta (Addle, Push, Topple). Las CD (Fuerza y Destreza) no se muestran por rasgo, pero Monk's Focus las da. | — |
| 6 · Wholeness of Body | Contador máx. = mod. SAB (mín. 1; 2 en el volcado), recarga larga; acción adicional y nota de curación. | ✅ | Nada. | `feature-stats.ts` (441) |
| 11 · Fleet Step | — | — | Texto basta. | — |
| 17 · Quivering Palm | — | — | Coste 4 FP por texto; 10d12 y CD de Constitución sin número propio. | — |

## Warrior of the Mystic Arts (2024, Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Spellcasting | Lanzador "third" SAB con lista de Hechicero, preparados y espacios de la tabla (nv. 10: 7 preparados, 4/3; nv. 20: 13, 4/3/3/1). Multiclase 1/3. | ⚠️ | `cantripsByLevel: null` en `data/subclasses.json`: **no se conoce el número de trucos** (2, luego 3 en el nv. 10; el volcado muestra `cantrips=null`). Hay que añadirlo al scraper (skill `datos`) o a la regla. | `data/subclasses.json`, `engine.ts` (409-420) |
| 6 · Mystic Fighting Style | — | — | Texto basta. | — |
| 6 · Mystic Focus | Solo texto. | ❌ | Sin conversión espacio de conjuro ↔ Focus Points (gastar espacio → recuperar FP igual al nivel; en descanso corto o Uncanny Metabolism → recuperar espacio por 2/3/5/6 FP). Hoy solo a mano con los dos contadores. | `core/play/*`, `play-panel.ts` |
| 11 · Focused Strike | — | — | Texto basta. | — |
| 17 · Improved Mystic Fighting Style | — | — | Texto basta. | — |

## Tattooed Warrior (UA8, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Magic Tattoos | La CD 8 + SAB + competencia se lee del texto. | ⚠️ | Cambiar un tatuaje en cada descanso largo no tiene selector ni almacén. | — |
| 3 · Beast Tattoo | Concede **los 5 trucos a la vez** (Dancing Lights, Light, Guidance, Message, Spare the Dying) como `subclass:Beast Tattoo`. | ❌ | Falta selector de **2 de 5** (`traitChoice` solo funciona para especies, no para rasgos de subclase) y su almacén. Efectos de cada tatuaje (Blindsight 10, +10 pies de Horse, +1 CA de Tortoise, ventaja de Crane) son texto/sin estado. Los trucos deberían ser solo los 2 elegidos. | `core/rules/trait-choices.ts`, `engine.ts` (`speciesView`), `features/creation`, `features/level-up` |
| 6 · Celestial Tattoo | Solo texto, coste 1 FP. | ⚠️ | Falta elegir 1 de 3 (Comet, Eclipse, Sunburst); hoy se muestran las tres. | idem |
| 11 · Nature Tattoo | Solo texto. | ❌ | Falta elegir Sea Storm o Volcano y la **resistencia** (3 tipos, cambiable en descanso o Uncanny Metabolism). Volcado `resistances: []`. Encaja con `restPicks`/`trait-rest-dialog`. | `rest-choices.ts`, `species-picks.ts` |
| 17 · Monster Tattoo | Solo texto. | ⚠️ | Falta elegir 1 de 4 (Beholder, Chromatic Dragon, Displacer Beast, Troll); Fly Speed de Beholder y regeneración del Troll son texto. | idem |

## Warrior of Intoxication (UA10, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Brewer's Supplies leída del texto (código). | ⚠️ | "Performance o, si ya la tienes, una habilidad a elegir": la frase con "or" queda fuera del lector, así que **no se concede Performance ni hay selector** (código; el volcado no muestra habilidades). | `trait-effects.ts` (239-254) |
| 3 · Drunken Technique | — | — | Texto basta. | — |
| 6 · Tipsy Sway | — | — | Coste 1 FP por texto. | — |
| 6 · Mystic Brew | Concede **Resistencia a Psíquico y Radiante de forma permanente** (volcado nv. 6+). | ❌ | Error: es la bebida "Heavenly Spirit" (1 h u 8 h, una sola bebida por descanso a elegir entre tres). Falta el selector de bebida/estado, y el lector de resistencias no debería aplicar esa frase. Cinnamon Dragon (4 dados, CD 8 + SAB + comp.) y Refreshing Dip son texto. | `trait-effects.ts` (resistencias), `engine.ts` |
| 11 · Master Brewer | — | — | Texto basta (Heroic Inspiration manual). | — |
| 17 · Intoxicated Frenzy | — | — | Texto basta. | — |

## Warrior of Venom (UA13, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Envenom Weapon | — | — | Coste 1 FP por texto. | — |
| 3 · Potent Arsenal | Competencia con Poisoner's Kit leída del texto (código). | ✅ | Nada (Veneno→Ácido es texto). | `trait-effects.ts` |
| 6 · Toxic Touch | — | — | Coste 1 FP por texto. | — |
| 11 · Toxic Refiner | Solo texto. | ❌ | **Inmunidad al daño de Veneno**: el modelo de hoja solo tiene `resistances`, sin inmunidades. | `core/rules/sheet.ts`, `engine.ts` |
| 11 · Toxic Blood | — | — | Texto basta. | — |
| 17 · Hallucinogenic Breath | — | — | Coste 2 FP por texto; CD de Constitución sin número propio. | — |

## Way of the Ascendant Dragon (2014, Fizban)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Draconic Disciple: Draconic Presence | Contador 1 uso, recarga larga. | ✅ | Nada. | — |
| 3 · Draconic Strike | — | — | Texto basta. | — |
| 3 · Tongue of Dragons | — | ⚠️ | Idioma a elegir: no se encontró selector (código). | — |
| 3 · Breath of the Dragon | Contador = competencia (6 en nv. 20), recarga larga. | ⚠️ | No hay coste "2 ki" para usarlo de nuevo (el texto dice "ki points", los contadores se llaman "Focus Points" y el lector no los enlaza) y la "ki save DC" no se muestra (la DC de ki no está escrita en el texto; el Monje 2024 usa la CD de Focus). | `combat-actions.ts` (`resourceFor`), `feature-stats.ts` |
| 6 · Wings Unfurled | Contador = competencia, recarga larga. | ✅ | Nada (el vuelo es texto, sin estado). | — |
| 11 · Aspect of the Wyrm | Contador 1 uso, recarga larga. | ✅ | Nada (coste 3 ki alternativo es texto). | — |
| 17 · Augment Breath | — | — | Texto basta. | — |
| 17 · Blindsight | — | ⚠️ | El lector de sentidos solo reconoce "range/radius of N feet", no "out to 10 feet": **no se añade Blindsight 10**. | `trait-effects.ts` (207-213) |
| 17 · Explosive Fury | — | — | Texto basta. | — |

## Way of the Astral Self (2014, Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Arms of the Astral Self | Solo texto. | ❌ | Sin estado activable de 10 min (1 ki): SAB en pruebas/salvaciones de FUE, ataque con brazos (SAB, daño Fuerza, alcance +5). | `active-states.ts`, `attacks.ts` |
| 6 · Visage of the Astral Self | — | — | Texto basta (Visión en la oscuridad 120 temporal). | — |
| 11 · Body of the Astral Self | — | — | Texto basta. | — |
| 17 · Awakened Astral Self | Solo texto. | ❌ | Sin estado: +2 CA y tercer ataque con brazos. | `active-states.ts`, `engine.ts` (CA) |

## Way of the Drunken Master (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Performance y Brewer's Supplies del texto (código). | ✅ | Nada. | — |
| 3 · Drunken Technique | — | — | Texto basta. | — |
| 6 · Tipsy Sway | — | — | Coste 1 ki: no enlazado (texto "ki"). | — |
| 11 · Drunkard's Luck | — | — | Coste 2 ki: no enlazado. | — |
| 17 · Intoxicated Frenzy | — | — | Texto basta. | — |

## Way of the Kensei (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Path of the Kensei | Solo texto. | ❌ | Falta elegir **2 tipos de arma** (1 cuerpo a cuerpo + 1 a distancia) que cuenten como armas de monje, y 1 más en los niveles 6, 11 y 17; competencia con ellas; calígrafo o pintor. `attacks.ts` solo considera arma de monje la regla fija. Agile Parry (+2 CA) y Kensei's Shot (1d4) son texto/sin estado. | `attacks.ts` (117), `features/creation`, `level-up` |
| 6 · One with the Blade | — | — | Texto basta (Deft Strike con ki sin enlazar). | — |
| 11 · Sharpen the Blade | — | — | Texto basta. | — |
| 17 · Unerring Accuracy | — | — | Texto basta. | — |

## Way of the Long Death (2014, SCAG)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Touch of Death | — | — | Texto basta (PG temporales = SAB + nivel). | — |
| 6 · Hour of Reaping | — | — | Texto basta (CD de SAB sin número). | — |
| 11 · Mastery of Death | — | — | Coste 1 ki sin enlazar. | — |
| 17 · Touch of the Long Death | — | — | 1 a 10 ki sin enlazar. | — |

## Way of the Sun Soul (2014, SCAG/Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Radiant Sun Bolt | Solo texto. | ❌ | **Falta la fila de ataque** en la tabla de ataques (volcado: solo Unarmed Strike): ataque de conjuro a distancia, 30 pies, competente, DES al ataque y al daño, radiante, d4 que escala con la columna Martial Arts. | `attacks.ts`, `engine.ts` (`combat`) |
| 6 · Searing Arc Strike | Solo texto. | ❌ | **Burning Hands** no figura entre los conjuros (volcado: `grantedSpells: []`). El coste de ki (2 + extra hasta la mitad del nivel) es texto. | `feat-effects.ts` |
| 11 · Searing Sunburst | — | — | Texto basta (ki sin enlazar). | — |
| 17 · Sun Shield | — | — | Texto basta (daño 5 + SAB). | — |

## Way of Tranquility (UA 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Path of Tranquility | CD 8 + competencia + SAB leída del texto. | ⚠️ | **Sanctuary no está en la lista de conjuros** (frase "you can cast the sanctuary spell on yourself" no leída). | `feat-effects.ts` |
| 3 · Healing Hands | Solo texto. | ❌ | Falta la **reserva** de PG = nivel de Monje × 10 (recarga larga; 5 PG por enfermedad o veneno). Los generadores de contador no la reconocen (`pools.ts` es solo de dados). | `core/rules/pools.ts`, `play-state.ts` |
| 6 · Emissary of Peace | — | ⚠️ | "Performance o Persuasion (elige una)": sin selector. | `species-picks.ts` |
| 11 · Douse the Flames of War | — | — | Texto basta (CD escrita, se muestra). | — |
| 17 · Anger of a Gentle Soul | Contador 1 uso, recarga corta o larga. | ✅ | Nada. | — |

## Patrones comunes

1. **Elecciones dentro de rasgos de subclase sin selector.** `traitChoice`/`traitPicks` solo cubren especies (`speciesView` en `engine.ts`). Afecta a Tattooed Warrior (4 elecciones), Kensei (armas), Mystic Brew, Emissary of Peace (habilidad) y Tongue of Dragons (idioma).
2. **Sin estados activables para rasgos de monje.** `ACTIVE_STATES` es una lista cerrada de 5. Elemental Attunement, Arms/Awakened Astral Self, Cinnamon Dragon, Wings Unfurled o Aspect of the Wyrm cambian velocidad, alcance o CA y no tienen interruptor.
3. **Ki vs. Focus Points.** Las subclases 2014 gastan "ki points", pero el contador se llama "Focus Points" (la clase es 2024). `resourceFor` solo enlaza el coste si el texto dice "Focus Point", así que **ningún rasgo 2014 enlaza su coste de ki**, y no hay "ki save DC".
4. **Sin inmunidades ni aumentos de característica de clase.** Faltan Toxic Refiner (inmunidad a Veneno) y Body and Mind (+4 con tope 25).
5. **Solo existe la fila de Combate si el texto dice "expend N Focus Points"** (coste enlazado correcto en 2024) y la CD aparece solo bajo Monk's Focus, no por rasgo.

## Dudas

- 2014 vs 2024: la clase base es 2024 y 8 de las 15 subclases son 2014 (Ascendant Dragon, Astral Self, Drunken Master, Kensei, Long Death, Sun Soul, Tranquility). Hace falta decidir si "ki" se mapea a "Focus Points" (los conteos coinciden con la tabla 2024).
- Tattooed Warrior: Celestial y Monster Tattoo, ¿selector o basta el texto? Se han marcado ⚠️ por consistencia con Beast/Nature (elección única según el texto).
- Mystic Arts: `cantripsByLevel` en null no se puede corregir sin el scraper; el texto dice 2 trucos y uno más en el nivel 10.
- Heavenly Spirit/Mystic Brew: ¿se prefiere eliminar la resistencia automática hasta tener selector, o dejarla?
- No he podido verificar en el volcado las habilidades, herramientas, idiomas y sentidos concedidos por los rasgos (el volcado no los incluye); lo anotado "(código)" se basa en las expresiones regulares de `trait-effects.ts`.

## Observaciones (errores del volcado, aunque no sean faltantes)

- `speed`: +10 pies de más en todas las entradas con Monje nivel ≥ 2 (30 → 50 en nv. 2; 70 en nv. 18-20 en vez de 60). Causa en `trait-effects.ts` 166-172 + `engine.ts` 375-381.
- `ac` 14 constante en nv. 20: Body and Mind no aplicado.
- Tattooed: `grantedSpells` con los 5 trucos de Beast Tattoo desde el nivel 3.
- Intoxication: `resistances: ['Psychic','Radiant']` desde el nivel 6 (Heavenly Spirit, bebida temporal).
- Mystic Arts: `spellcasting` con `cantrips=null`.
- Elements: sin `Fly`/`Swim` en `speed` aunque el nivel 11 los pide (depende del estado de Attunement).
- La advertencia `traitPickMissing: Skillful` es de la especie de prueba (humano), no del Monje.
