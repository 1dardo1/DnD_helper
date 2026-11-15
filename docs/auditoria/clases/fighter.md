# Auditoría: Guerrero (clase base y 21 subclases)

Fuente: `data/classes.json` (`fighter`), `data/subclasses.json` (`classId` = `fighter`: 11 de 2024 incluidas las UA, 10 de 2014/UA), `data/options.json` (20 maniobras), volcado `docs/auditoria/_volcado/clase-fighter.json` y código en `app/src/app`. Solo lectura.

## Resumen

| Bloque | ✅ | ⚠️ | ❌ | — |
| --- | --- | --- | --- | --- |
| Guerrero (2024) | 9 | 0 | 0 | 6 |
| Battle Master (2024, PHB) | 5 | 0 | 2 | 1 |
| Arcane Archer (2024, Arcana Unleashed) | 2 | 0 | 3 | 4 |
| Banneret (2024, Heroes of Faerûn) | 1 | 1 | 1 | 3 |
| Champion (2024, PHB) | 3 | 0 | 1 | 2 |
| Eldritch Knight (2024, PHB) | 1 | 1 | 0 | 5 |
| Psi Warrior (2024, PHB) | 5 | 1 | 1 | 0 |
| Sorrow Knight (2024, D&D Beyond Drops) | 3 | 1 | 0 | 2 |
| Cavalier (UA 2024, Subclasses Update) | 1 | 0 | 1 | 5 |
| Gladiator (UA 2024, Apocalyptic Subclasses) | 1 | 1 | 1 | 3 |
| Hell Knight (UA 2024, UA14 18-06-2026) | 1 | 0 | 2 | 5 |
| Purple Dragon Knight (UA 2024, Forgotten Realms) | 0 | 0 | 3 | 3 |
| Brute (UA 2014, UA46) | 0 | 0 | 2 | 3 |
| Echo Knight (2014, Wildemount) | 3 | 0 | 0 | 3 |
| Knight (UA 2014, UA23) | 1 | 0 | 2 | 3 |
| Monster Hunter (UA 2014, UA13) | 0 | 0 | 3 | 3 |
| Psi Knight (UA 2014, UA71) | 1 | 1 | 3 | 1 |
| Psychic Warrior (UA 2014, UA66) | 4 | 0 | 2 | 0 |
| Rune Knight (2014, Tasha's) | 1 | 1 | 1 | 4 |
| Samurai (2014, Xanathar) | 1 | 1 | 2 | 2 |
| Scout (UA 2014, UA12) | 0 | 0 | 2 | 3 |
| Sharpshooter (UA 2014, UA23) | 0 | 1 | 1 | 3 |
| **Total** | **43** | **9** | **33** | **64** |

Lo grave, por orden de impacto:
1. **"Estilo de combate adicional" de subclase no da hueco de dote** (Champion nivel 7, Brute nivel 10): `featSlots()` solo lee la tabla de la clase, no los rasgos de subclase.
2. **Elecciones dentro de rasgos de subclase sin selector** (Student of War, Arcane Archer Lore, Knightly Envoy, Bonus Proficiency, Combat Theatrics, Careful Eyes, Diabolical Gift, Rune Carver...): el motor solo resuelve elecciones de especie (`species-picks.ts`); ninguna de subclase.
3. **Arcane Shot (Arcane Archer) y Runas (Rune Knight)**: sin lista de opciones en `data/options.json` ni selector; el jugador solo ve el texto. Tampoco se muestra la CD de maniobras (Battle Master), de Arcane Shot ni de las Despairing Strikes.
4. **2014 con Superiority Dice (Monster Hunter, Scout) y Psionic Talent (Psi Knight)** sin contador ni dado: `FEATURE_USES` solo cubre `fighter/battle-master` (2024) y `pools.ts` solo Psi Warrior/Soulknife/Sorrow Knight.
5. **Hechizos no concedidos por redacción**: Telekinetic Master del Psi Warrior (nombre en minúscula "telekinesis" descartado por `splitNames`), Mage Hand del Psychic Warrior ("At 3rd level, you learn..." con "you" en minúscula), Comprehend Languages (solo ritual) de Banneret/Purple Dragon Knight, Detect Magic/Protection from Evil and Good del Monster Hunter.
6. **Resistencias/inmunidades no leídas**: Enduring Commander (Purple Dragon Knight: "You and your purple dragon have Resistance..."), Infernal Resilience (Hell Knight, elección en descanso), inmunidad a Charmed/Frightened (Banneret 18, Sorrow Knight 18), Poisoned (Psi Knight 10).

Criterio: "✅" = funciona en la ficha (selector, contador con recarga correcta, número en estadísticas). "—" = texto basta (situacional o narrativo, no cuenta como faltante). Un rasgo con varias partes se parte en filas cuando el estado difiere.

## Clase base: Guerrero (2024)

Volcado niveles 1-20: Second Wind 2/3/4 (niveles 1/4/10), Weapon Mastery 3/4/5/6 (1/4/10/16), Action Surge 1 (2 desde 17), Indomitable 1/2/3 (9/13/17): todo coincide con la tabla de datos.

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Fighting Style | Dote de estilo de combate de la lista `fighting-style` | ✅ completo | Hueco (`fighter:1`) con selector en creación y subida de nivel. El texto "puedes cambiarla al subir de nivel" no tiene aviso; se edita a mano. El efecto de cada dote de estilo depende de la auditoría de dotes | `core/creation/creation-rules.ts` (`featSlots`), `features/creation/character-create.ts`, `features/level-up/level-up.ts` |
| 1 · Second Wind | 2/3/4 usos, 1d10 + nivel, recarga 1 en corto y todo en largo | ✅ completo | Contador `Second Wind` (`short=1`) y estadística "1d10+nivel" (`feature-stats`). Nada | `core/rules/feature-stats.ts`, `core/play/rest-rules.ts` (`'second wind': {short: 1}`) |
| 1 · Weapon Mastery | 3/4/5/6 armas con propiedad de maestría; cambio de una tras descanso largo | ✅ completo | Selector en creación y en el panel de equipo (editable en cualquier momento); cantidad leída de la columna "Weapon Mastery"; aviso `sheet.warn.weaponMastery` si faltan. La subida de nivel no pide las armas nuevas (solo el aviso de la hoja) | `core/rules/engine.ts` (`weaponMasterySlots`), `features/characters/equipment-panel.ts`, `features/creation/character-create.ts` |
| 2 · Action Surge | 1 uso, 2 desde nivel 17, recarga corta o larga | ✅ completo | Contador (`short="all"`), 1 → 2 en 17 | `core/play/play-state.ts` (`FEATURE_USES`), `core/play/rest-rules.ts` |
| 2 · Tactical Mind | Gastar Second Wind para sumar 1d10 a una prueba fallida | ✅ completo | Nota de estadística con coste "Second Wind" (`tacticalMind`). La regla "si falla no se gasta" es texto | `core/rules/feature-stats.ts` |
| 3 · Fighter Subclass | Elegir subclase | ✅ completo | Selector en creación y subida; aviso `noSubclass` si falta | `features/creation`, `features/level-up` |
| 4/6/8/12/14/16 · Ability Score Improvement | 6 huecos de dote/ASI | ✅ completo | Huecos `fighter:N` leídos de la tabla (el Guerrero tiene los extra de 6 y 14) | `core/creation/creation-rules.ts` |
| 5 · Extra Attack | 2 ataques por acción Atacar | — texto basta | La tabla de ataques no muestra el número de ataques por acción (ni aquí ni en 11/20); solo el texto | — |
| 5 · Tactical Shift | Mover medio Speed sin provocar al usar Second Wind | — texto basta | Situacional | — |
| 9 · Indomitable | 1/2/3 usos, repetir salvación con bonificador = nivel | ✅ completo | Contador `short=0` (solo largo), 1/2/3 en 9/13/17; estadística con el nivel | `core/play/play-state.ts`, `core/rules/feature-stats.ts` |
| 9 · Tactical Master | Cambiar maestría por Push, Sap o Slow | — texto basta | Situacional | — |
| 11 · Two Extra Attacks | 3 ataques | — texto basta | Ver Extra Attack | — |
| 13 · Studied Attacks | Ventaja tras fallar contra una criatura | — texto basta | Situacional | — |
| 19 · Epic Boon | Dote de gran don | ✅ completo | Hueco `fighter:19` tipo `epic-boon` | `core/creation/creation-rules.ts` |
| 20 · Three Extra Attacks | 4 ataques | — texto basta | Ver Extra Attack | — |

## Battle Master (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Combat Superiority: maniobras | 3 maniobras, +2 en 7, 10 y 15 (3/5/7/9) de 20 | ✅ completo | Selector por grupo `maneuver` con tope 3/5/7/9 (`OPTION_COUNT_BY_LEVEL`), en creación y subida; se guardan en `choices.options`. El texto de la maniobra se lista como rasgo. La regla de reemplazar una al subir es edición manual | `core/creation/creation-rules.ts`, `data/options.json`, `core/rules/engine.ts` (líneas 199-216) |
| 3 · Combat Superiority: dados | 4 dados d8 (5 en 7, 6 en 15), recarga corta y larga | ✅ completo | Contador `Superiority Dice` 4/5/6 (`FEATURE_USES` fijo para `fighter/battle-master`), `short="all"`; tamaño leído del texto | `core/play/play-state.ts` (`superiorityDie`) |
| 3 · Combat Superiority: CD | CD = 8 + FUE o DES + competencia | ❌ falta | No hay estadística de CD de maniobra (`feature-stats.ts` no tiene entrada de Battle Master) | `core/rules/feature-stats.ts` |
| 3 · Student of War | Competencia con una herramienta de artesano y una habilidad | ❌ falta | Sin selector ni aviso (volcado `missing` y `warnings` vacíos) | `core/rules/species-picks.ts` (solo especie) |
| 7 · Know Your Enemy | 1 uso por descanso largo (o gastando un dado) | ✅ completo | Contador `short=0`; "restaurar gastando un dado" es manual | `core/rules/feat-effects.ts` |
| 10 · Improved Combat Superiority | Dado d10 | ✅ completo | Se refleja en `Superiority Dice` | `core/play/play-state.ts` |
| 15 · Relentless | 1d8 sin gastar dado, una vez por turno | — texto basta | Situacional (`TEXT_OK` del spec de cobertura) | `core/rules/feature-coverage.spec.ts` |
| 18 · Ultimate Combat Superiority | Dado d12 | ✅ completo | Se refleja en el contador | `core/play/play-state.ts` |

## Arcane Archer (2024, Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Arcane Archer Lore | Truco Druidcraft o Prestidigitation (INT) + Arcana y Nature (o sustitutas) | ❌ falta | Sin selector de truco ni de habilidades; sin conjuros concedidos (volcado `grantedSpells` vacío) | `core/rules/species-picks.ts` |
| 3 · Arcane Shot: opciones | 2 opciones de una lista, +1 en 7, 10, 15 y 18 | ❌ falta | Las opciones solo están en el texto del rasgo; `data/options.json` no tiene opciones del Guerrero salvo las maniobras. Habría que añadirlas en el scraper (grupo `arcane-shot`) y subir el conteo en `OPTION_COUNT_BY_LEVEL` | `tools/scraper`, `core/creation/creation-rules.ts` |
| 3 · Arcane Shot: usos | INT mod (mínimo 1) usos, recarga corta o larga | ✅ completo | Contador `Arcane Shot` vía `featUses` (`max` = INT, `short-or-long`) | `core/rules/feat-effects.ts`, `core/rules/engine.ts` (`traitGrants`) |
| 3 · Arcane Shot: dado y CD | Dado d6/d8/d10/d12 (10, 15, 18) y CD 8 + INT + competencia | ❌ falta | No se muestran ni el dado ni la CD (sin `pools.ts` ni `feature-stats`) | `core/rules/pools.ts`, `core/rules/feature-stats.ts` |
| 7 · Curving Shot | Rebote de un fallo | — texto basta | Situacional | — |
| 7 · Magical Ammunition | 1 uso por descanso corto o largo (o gastando Second Wind) | ✅ completo | Contador `short="all"` | `core/rules/feat-effects.ts` |
| 10 · Ever-Ready Shot | Recupera un uso de Arcane Shot al tirar iniciativa | — texto basta | Manual | — |
| 15 · Indomitable Teleport | Teletransporte al superar con Indomitable | — texto basta | Situacional | — |
| 18 · Masterful Shots | Reacción de movimiento y ataque | — texto basta | Situacional | — |

## Banneret (2024, Heroes of Faerûn)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Knightly Envoy | Comprehend Languages solo ritual (CAR), un idioma, una habilidad (Insight/Intimidation/Persuasion/Performance) | ❌ falta | Sin conjuro concedido (el lector solo entiende "cast X without a spell slot" o "always have X prepared"), sin selector de idioma ni habilidad | `core/rules/feat-effects.ts` (`TRAIT_CAST`), `core/rules/species-picks.ts` |
| 3 · Group Recovery | Cura a aliados 1d4 + nivel, 1 uso por descanso corto o largo | ✅ completo | Contador `Group Recovery` `short="all"` | `core/rules/feat-effects.ts` |
| 7 · Team Tactics | Ventaja a los aliados | — texto basta | Situacional | — |
| 10 · Rallying Surge | Aliados reaccionan al usar Action Surge | — texto basta | Situacional | — |
| 15 · Shared Resilience | Gastar Indomitable por un aliado | — texto basta | Manual | — |
| 18 · Inspiring Commander | Emanación de 60 pies; inmunidad a Charmed y Frightened | ⚠️ parcial | La inmunidad a estados no se refleja (la ficha solo modela resistencias a daño) | `core/rules/trait-effects.ts`, `core/rules/sheet.ts` |

## Champion (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Improved Critical | Crítico con 19-20 | ✅ completo | `critRangeOf` lo lee; nota "crítico" en la fila de ataque | `core/rules/engine.ts` (`critRangeOf`), `core/rules/attacks.ts` |
| 3 · Remarkable Athlete | Ventaja en iniciativa y Atletismo, mover tras crítico | — texto basta | La ventaja no se marca en la ficha | — |
| 7 · Additional Fighting Style | Otra dote de estilo de combate | ❌ falta | No hay hueco: `featSlots(cls, level)` solo mira `cls.progression` y este rasgo es de subclase. Ni creación ni subida de nivel ofrecen el segundo selector | `core/creation/creation-rules.ts` (línea 56), `core/creation/level-up.ts` (línea 110), `features/creation/character-create.ts` |
| 10 · Heroic Warrior | Inspiración heroica en combate | — texto basta | Narrativo | — |
| 15 · Superior Critical | Crítico con 18-20 | ✅ completo | `critRangeOf` toma el mínimo | `core/rules/engine.ts` |
| 18 · Survivor | Ventaja en salvaciones de muerte; cura 5 + CON al empezar el turno Bloodied | ✅ completo | Estadística `heroicRally` (5 + mod CON); la ventaja es texto | `core/rules/feature-stats.ts` |

## Eldritch Knight (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Spellcasting: espacios, preparados, lista | Lanzador de tercio (INT), lista de Mago, preparados 3→13, espacios hasta nivel 4 | ✅ completo | Volcado: `fighter INT prepared=3..13`, espacios `2,0,0,0` → `4,3,3,1`. Lista de Mago vía `spellList: "wizard"` | `core/creation/creation-rules.ts` (`spellListOf`), `core/rules/engine.ts` |
| 3 · Spellcasting: trucos | 2 trucos de Mago, 3 desde nivel 10 | ⚠️ parcial | `cantripsByLevel` es `null` en los datos (la tabla del EK no tiene columna de trucos): no hay tope ni aviso de trucos pendientes (volcado `cantrips=null`). Regla de datos: 2 en 3, 3 en 10 | `data/subclasses.json`, `tools/scraper`, `core/creation/spell-choices.ts` |
| 3 · War Bond | Hasta 2 armas vinculadas, invocar con acción adicional | — texto basta | No se registra el arma vinculada | — |
| 7 · War Magic | Sustituir un ataque por un truco | — texto basta | Situacional | — |
| 10 · Eldritch Strike | Desventaja a la siguiente salvación | — texto basta | Situacional | — |
| 15 · Arcane Charge | Teletransporte 30 pies con Action Surge | — texto basta | Situacional | — |
| 18 · Improved War Magic | Sustituir dos ataques por conjuro de nivel 1-2 | — texto basta | Situacional | — |

## Psi Warrior (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psionic Power: dados | Tabla 4d6 → 12d12; recupera 1 en corto, todos en largo | ✅ completo | `pools.ts` lee la tabla; volcado 4/6/8/8/10/12 con `short=1` | `core/rules/pools.ts`, `core/play/rest-rules.ts` |
| 3 · Psionic Power: Protective Field y Psionic Strike | Reducción o daño Force = dado + INT | ✅ completo | Estadística y nota con el dado de la tabla | `core/rules/feature-stats.ts` |
| 3 · Psionic Power: Telekinetic Movement | 1 uso por descanso corto o largo (o gastando un dado) | ❌ falta | `traitGrants` salta el rasgo porque es una `pool` (`poolFor`) y el uso por descanso del subapartado no se crea; el volcado solo muestra el contador de dados | `core/rules/engine.ts` (línea 1151), `core/rules/pools.ts` |
| 7 · Telekinetic Adept | Psi-Powered Leap (1 uso, corto o largo) y Telekinetic Thrust | ✅ completo | Contador `Telekinetic Adept` `short="all"` | `core/rules/feat-effects.ts` |
| 10 · Guarded Mind | Resistencia Psychic | ✅ completo | Volcado `resistances: ["Psychic"]` | `core/rules/trait-effects.ts` |
| 15 · Bulwark of Force | INT criaturas con media cobertura, 1 uso por descanso largo | ✅ completo | Contador `short=0` | `core/rules/feat-effects.ts` |
| 18 · Telekinetic Master | Telekinesis siempre preparada, gratis 1 vez por descanso largo | ⚠️ parcial | Existe el contador (`max=1`, largo) pero el conjuro no se concede (`grantedSpells` vacío): `splitNames` exige mayúscula inicial y el texto dice "the telekinesis spell" | `core/rules/feat-effects.ts` (`splitNames`, línea 126) |

## Sorrow Knight (2024, D&D Beyond Drops)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Despairing Strikes | Dados d8 (3), d10 (4 en 10), d12 (5 en 15); recarga corta y larga; CD 8 + SAB + competencia | ⚠️ parcial | Dados correctos (`pools.ts`, `short="all"`). No se muestra la CD de los efectos | `core/rules/pools.ts`, `core/rules/feature-stats.ts` |
| 3 · Solemn Gaze | Visión en la oscuridad 60 pies; Empathetic Inquiry SAB mod usos (largo) | ✅ completo | Visión 60 en volcado (`darkvision 60`); contador `max=2`, `short=0` | `core/rules/trait-effects.ts`, `core/rules/feat-effects.ts` |
| 7 · Dreaded Appearance | 1 uso por descanso corto o largo | ✅ completo | Contador `short="all"` | `core/rules/feat-effects.ts` |
| 10 · Unsettled Strikes | Opciones nuevas de Despairing Strike | — texto basta | Es texto de opciones | — |
| 15 · Grim Constitution | Resistencia Necrotic y Psychic; CD 15 por PG máximo | ✅ completo | Resistencias en volcado; la salvación es texto | `core/rules/trait-effects.ts` |
| 18 · Grieving Mantle | Con Action Surge, 1 minuto: forma de sombra e inmunidad a Charmed y Frightened | — texto basta | Estado temporal; sin estado activable | — |

## Cavalier (UA 2024, Subclasses Update)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiency | Una habilidad de 5 o un idioma | ❌ falta | Sin selector | `core/rules/species-picks.ts` |
| 3 · Born to the Saddle | Montura | — texto basta | Situacional | — |
| 3 · Unwavering Mark | Marca; ventaja | — texto basta | Situacional | — |
| 7 · Warding Maneuver | CON mod usos (mín. 1), 1d8 a la CA, recarga larga | ✅ completo | Contador `max=2` (CON +2), `short=0` | `core/rules/feat-effects.ts` |
| 10 · Hold the Line | Ataque de oportunidad ampliado | — texto basta | Situacional | — |
| 15 · Ferocious Charger | Primera ronda: +10 pies y salvación FUE | — texto basta | Se podría añadir la CD (8 + FUE + competencia) | — |
| 18 · Vigilant Defender | Reacción extra para ataques de oportunidad | — texto basta | Situacional | — |

## Gladiator (UA 2024, Apocalyptic Subclasses)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Brutality | CAR mod usos, efectos a elegir, recarga corta o larga | ✅ completo | Contador `Brutality` `max=2`, `short="all"`. Los efectos (Bleed, Bluff, Stumble) son texto | `core/rules/feat-effects.ts` |
| 3 · Combat Theatrics | +CAR (mín. 1) a Acrobacias y Atletismo; una habilidad a elegir | ❌ falta | El bonus a las pruebas no se aplica (no hay lector para "bonus to the check equal to your Charisma modifier" salvo el de Sabiduría de otro rasgo, `feature-stats.ts` línea 463); sin selector de habilidad | `core/rules/feature-stats.ts`, `core/rules/engine.ts` |
| 7 · Flourish Parry | +CAR a la CA como reacción | — texto basta | Situacional | — |
| 10 · Bolder Brutalities | Efectos nuevos de Brutality | — texto basta | Texto | — |
| 15 · Brutal Resurgence | Recupera un uso con Second Wind o Action Surge | — texto basta | Manual | — |
| 18 · Mutilate | Salvación CON; efectos hasta curarse | ⚠️ parcial | Se genera un contador de 1 uso por descanso largo, pero el límite real es por objetivo que falla la salvación; la CD (8 + CAR + competencia) no se muestra | `core/rules/feat-effects.ts` |

## Hell Knight (UA 2024, UA14 18-06-2026)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Diabolical Gift | Devil's Sight 120 pies, idioma Infernal, una habilidad | ❌ falta | Devil's Sight no se modela (el lector de sentidos solo conoce Darkvision/Blindsight/Tremorsense/Truesight; volcado `darkvision: null`); sin selector de habilidad/idioma | `core/rules/trait-effects.ts` (línea 207) |
| 3 · Hell-Forged Weapon | Arma con daño Cold/Fire/Necrotic a elegir | — texto basta | Elección por ataque | — |
| 3 · Infernal Wound | Dado d6; CON mod usos, recarga corta o larga | ✅ completo | Contador `Infernal Wound` `max=2`, `short="all"` | `core/rules/feat-effects.ts` |
| 7 · Advanced Wounds | Efectos con el dado | — texto basta | Texto | — |
| 7 · Infernal Equipment | Infernal Resilience (resistencia Cold/Fire/Necrotic elegida al descansar) y Unholy Power | ❌ falta | La resistencia elegida no se aplica ni hay selector en el diálogo de descanso (`restPicks` vacío) | `core/play/rest-choices.ts`, `core/rules/trait-effects.ts` |
| 10 · Hellfire Surge | Emanación con Action Surge | — texto basta | Situacional | — |
| 15 · Devil's Misfortune | Reacción: reduce daño con el dado | — texto basta | Situacional | — |
| 18 · Infernal Bargain | Inspiración heroica especial | — texto basta | Situacional | — |

## Purple Dragon Knight (UA 2024, Forgotten Realms)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Knightly Envoy | Un idioma; Comprehend Languages solo ritual (INT) | ❌ falta | Sin selector de idioma; sin conjuro concedido | `core/rules/feat-effects.ts`, `core/rules/species-picks.ts` |
| 3 · Purple Dragon Companion | Dragón amatista con su bloque de estadísticas (CA 13 + INT, PG 4 + 4×nivel, Rend, Gravity Breath 2/día) | ❌ falta | No hay criatura invocable ni contador de Gravity Breath; el bloque está en el texto del rasgo y no en el catálogo de invocaciones | `core/summons/catalog.ts` |
| 7 · Dragon Rider | Montura, Improved Gravity Breath, Shared Second Wind | — texto basta | Depende de la criatura | — |
| 10 · Rallying Surge | Aliados reaccionan | — texto basta | Situacional | — |
| 15 · Amethyst Pinnacle | Dragón Large, Tandem Attack | — texto basta | Depende de la criatura | — |
| 18 · Enduring Commander | Resistencia Force y Psychic (tú y el dragón) | ❌ falta | No se aplica: volcado `resistances: []` a nivel 18; el lector no entiende "You and your purple dragon have Resistance to X and Y" | `core/rules/trait-effects.ts` |

## Brute (UA 2014, UA46)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Brute Force | Daño extra por nivel: 1d4 (3), 1d6 (10), 1d8 (16), 1d10 (20) | ❌ falta | La tabla de la subclase no se lee; la fila de ataque no suma el dado | `core/rules/attacks.ts`, `core/rules/feature-stats.ts` |
| 7 · Brutish Durability | +1d6 a las salvaciones | — texto basta | No se muestra en las salvaciones | — |
| 10 · Additional Fighting Style | Segunda dote de estilo | ❌ falta | Sin hueco de dote (igual que Champion 7) | `core/creation/creation-rules.ts` |
| 15 · Devastating Critical | + nivel de Guerrero al daño en crítico | — texto basta | Situacional | — |
| 18 · Survivor | Cura 5 + CON al inicio del turno con menos de la mitad de PG | — texto basta | Solo la versión Champion tiene estadística | `core/rules/feature-stats.ts` |

## Echo Knight (2014, Wildemount)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Manifest Echo | Eco con CA 14 + competencia, 1 PG | — texto basta | No hay seguimiento del eco | — |
| 3 · Unleash Incarnation | CON mod usos, recarga larga | ✅ completo | Contador `max=2`, `short=0` | `core/rules/feat-effects.ts` |
| 7 · Echo Avatar | Ver por el eco | — texto basta | Narrativo | — |
| 10 · Shadow Martyr | 1 uso por descanso corto o largo | ✅ completo | Contador `short="all"` | `core/rules/feat-effects.ts` |
| 15 · Reclaim Potential | PG temporales 2d6 + CON, CON mod usos (largo) | ✅ completo | Contador `max=2`, `short=0`; el número es texto | `core/rules/feat-effects.ts` |
| 18 · Legion of One | Dos ecos; recupera Unleash Incarnation en iniciativa | — texto basta | Manual | — |

## Knight (UA 2014, UA23)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Born to the Saddle | Montura | — texto basta | Situacional | — |
| 3 · Implacable Mark | Marca; ataque con reacción 3 veces, recarga corta o larga | ✅ completo | Contador `max=3`, `short="all"`; daño extra = nivel es texto | `core/rules/feat-effects.ts` |
| 7 · Noble Cavalry | Dos habilidades de 5 o un idioma | ❌ falta | Sin selector | `core/rules/species-picks.ts` |
| 10 · Hold the Line | Ataque con reacción, +½ nivel al daño | — texto basta | Situacional | — |
| 15 · Rapid Strike | Ataque extra al renunciar a la ventaja | — texto basta | Situacional | — |
| 18 · Defender's Blade | +1 a la CA con armadura pesada | ❌ falta | No hay lector de ese bonificador condicional (no encontrado en `engine.ts` ni `trait-effects.ts`; el volcado no lleva armadura, no verificado en ejecución) | `core/rules/engine.ts`, `core/rules/trait-effects.ts` |

## Monster Hunter (UA 2014, UA13)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Dos habilidades de 6 (o una herramienta) | ❌ falta | Sin selector | `core/rules/species-picks.ts` |
| 3 · Combat Superiority | 4 dados d8 (5 en 7, 6 en 15), recarga corta y larga; beneficios en lista | ❌ falta | Sin contador: `FEATURE_USES` solo para `fighter/battle-master`; las opciones son viñetas del texto, no `options.json` | `core/play/play-state.ts` |
| 3 · Hunter's Mysticism | Detect Magic ritual; Protection from Evil and Good 1/descanso largo (SAB); un idioma | ❌ falta | Sin conjuros concedidos ni contador ni selector de idioma | `core/rules/feat-effects.ts` |
| 7 · Monster Slayer | Gastar dos dados al daño | — texto basta | Situacional | — |
| 10 · Improved Combat Superiority | d10 y d12 | — texto basta | Depende del contador que falta | — |
| 15 · Relentless | Recupera un dado al tirar iniciativa | — texto basta | Manual | — |

## Psi Knight (UA 2014, UA71)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psionic Talent | Un dado que cambia de tamaño al tirar (d6, d8 en 5, d10 en 11, d12 en 17) y se restablece en descanso largo | ❌ falta | Sin dado ni contador; `pools.ts` no lo cubre (mecánica de tamaño variable, distinta a las reservas). Sin números de Protective Field ni Telekinetic Strike | `core/rules/pools.ts` |
| 3 · Psi Replenishment | Restablece el dado, 1 uso por descanso largo | ❌ falta | Sin contador (volcado no lo lista) | `core/rules/feat-effects.ts` |
| 7 · Telekinetic Adept | Psionic Thrust (CD 8 + competencia + INT) y Psi-Powered Step | — texto basta | Situacional | — |
| 10 · Psi-Enhanced Metabolism | Resistencia a veneno y psíquico; inmunidad a Poisoned | ⚠️ parcial | Las dos resistencias sí; la inmunidad a Poisoned no se refleja | `core/rules/trait-effects.ts` |
| 15 · Bulwark of Force | INT criaturas con media cobertura, 1 uso largo (o bajando el dado) | ✅ completo | Contador `short=0` | `core/rules/feat-effects.ts` |
| 18 · Telekinetic Master | Telekinesis sin componentes si el dado está disponible | ❌ falta | Sin conjuro concedido (volcado `grantedSpells` vacío) ni dado | `core/rules/feat-effects.ts` |

## Psychic Warrior (UA 2014, UA66)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Telekinetic Hand | Truco Mage Hand (INT) | ❌ falta | No concedido: el lector exige "You learn the X cantrip" con mayúscula, el texto 2014 dice "At 3rd level, you learn the Mage Hand cantrip" | `core/rules/feat-effects.ts` (línea 215) |
| 3 · Psionic Armament | Al descansar, elegir Defensas (d10 → d12 en 10) o Golpes (1d4 → 1d6) | ❌ falta | Sin selector de descanso ni números en la ficha | `core/play/rest-choices.ts` |
| 7 · Strength of Mind | INT mod usos, 2d6 + INT de daño Force | ✅ completo | Contador `max=1` (INT +1), `short=0` | `core/rules/feat-effects.ts` |
| 10 · Telekinetic Bulwark | 1 uso largo (o tras Second Wind) | ✅ completo | Contador `short=0` | `core/rules/feat-effects.ts` |
| 15 · Agonizing Strikes | INT mod usos, 2d10 psíquico | ✅ completo | Contador `short=0` | `core/rules/feat-effects.ts` |
| 18 · Psychic Dreadnought | 1 uso largo, 1 minuto | ✅ completo | Contador `short=0` | `core/rules/feat-effects.ts` |

## Rune Knight (2014, Tasha's)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Herramientas de herrero e idioma Giant | — texto basta | Fijas; no verificado si la ficha las suma | — |
| 3 · Rune Carver | 2 runas (3/4/5 en 7/10/15) de 6; CD 8 + competencia + CON | ❌ falta | Las runas son viñetas del rasgo, no hay opciones en `options.json` ni selector, ni contador por runa; sin CD de runa | `tools/scraper`, `core/creation/creation-rules.ts` (`OPTION_COUNT_BY_LEVEL`) |
| 3 · Giant's Might | Bonus action 1 minuto, daño extra 1d6/1d8/1d10, usos = competencia | ⚠️ parcial | Contador `max=2/3/4/5/6` largo correcto. Sin estado activable (volcado `activeStates` vacío) ni daño extra en el ataque | `core/rules/active-states.ts`, `core/rules/attacks.ts` |
| 7 · Runic Shield | Usos = competencia, largo | ✅ completo | Contador `max=3..6` | `core/rules/feat-effects.ts` |
| 10 · Great Stature | Altura; daño de Giant's Might 1d8 | — texto basta | Narrativo | — |
| 15 · Master of Runes | Cada runa dos veces, recarga corta o larga | — texto basta | Depende de las runas | — |
| 18 · Runic Juggernaut | Giant's Might 1d10, Huge | — texto basta | Depende del estado | — |

## Samurai (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiency | Una habilidad de 4 o un idioma | ❌ falta | Sin selector | `core/rules/species-picks.ts` |
| 3 · Fighting Spirit | 3 usos largo; ventaja; 5/10/15 PG temporales | ⚠️ parcial | Contador `max=3`, `short=0` correcto; los PG temporales por nivel no salen como estadística | `core/rules/feat-effects.ts` (línea 341), `core/rules/feature-stats.ts` |
| 7 · Elegant Courtier | +SAB a Persuasión; competencia en salvaciones de SAB | ❌ falta | No se aplica: `choices.saves` existe pero ninguna pantalla lo rellena y no se lee de rasgos; sin bono a Persuasión | `core/rules/engine.ts` (línea 250) |
| 10 · Tireless Spirit | Recupera un uso en iniciativa | — texto basta | Manual | — |
| 15 · Rapid Strike | Ataque extra al renunciar a la ventaja | — texto basta | Situacional | — |
| 18 · Strength Before Death | Turno extra, 1 uso (descanso largo) | ✅ completo | Contador `short=0` | `core/rules/feat-effects.ts` |

## Scout (UA 2014, UA12)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Tres habilidades de 8 (o ladrón en lugar de una) | ❌ falta | Sin selector | `core/rules/species-picks.ts` |
| 3 · Combat Superiority | 4 dados d8, +1 en 7 y 15; recarga corta y larga | ❌ falta | Sin contador (mismo hueco que Monster Hunter) | `core/play/play-state.ts` |
| 3 · Natural Explorer | Terreno favorito | — texto basta | Elección narrativa | — |
| 10 · Improved Combat Superiority | d10 y d12 | — texto basta | Depende del contador | — |
| 15 · Relentless | Recupera un dado en iniciativa | — texto basta | Manual | — |

## Sharpshooter (UA 2014, UA23)

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Steady Aim | 3 usos, corto o largo; +2 + ½ nivel al daño | ⚠️ parcial | Contador `max=3`, `short="all"` correcto; el daño extra no sale como estadística | `core/rules/feat-effects.ts`, `core/rules/feature-stats.ts` |
| 7 · Careful Eyes | Search como acción adicional; competencia en Percepción, Investigación o Supervivencia | ❌ falta | Sin selector de habilidad | `core/rules/species-picks.ts` |
| 10 · Close-Quarters Shooting | Sin desventaja a corta distancia | — texto basta | Situacional | — |
| 15 · Rapid Strike | Ataque extra | — texto basta | Situacional | — |
| 18 · Snap Shot | Ataque a distancia extra en el primer turno | — texto basta | Situacional | — |

## Patrones comunes

- **Elecciones de rasgos de subclase** (habilidad, idioma, herramienta, truco, "elige X de Y"): no hay equivalente a `species-picks.ts` para subclase. Afecta a Student of War, Arcane Archer Lore, Knightly Envoy (x2), Bonus Proficiency(ies) de Cavalier, Samurai, Knight, Monster Hunter, Scout, Gladiator, Sharpshooter, Hell Knight. Un mecanismo general resolvería ~15 filas.
- **Huecos de dote concedidos por subclase** ("Additional Fighting Style"): `featSlots` solo lee `cls.progression`. Champion nivel 7 y Brute nivel 10.
- **Listas de opciones fuera de `options.json`**: Arcane Shot, Runas, Superiority (2014, maniobras en viñetas), Psionic Armament. El selector genérico de `choices.options` ya existe y bastaría con extraer las opciones en el scraper.
- **Redacción 2014 distinta de la 2024**: "At 3rd level, you learn..." / "you can cast X as a ritual" / "can cast Detect Magic as a ritual" no los entiende `featRules`; los conjuros de subclases 2014 no se conceden.
- **Reservas con `FEATURE_USES` atadas a un `subclassId`**: solo `fighter/battle-master`; Monster Hunter y Scout copian el rasgo con otra redacción y quedan sin contador.
- **Inmunidades a estados** (Charmed, Frightened, Poisoned): la ficha no tiene campo; afecta a Banneret 18, Sorrow Knight 18, Psi Knight 10.
- **CD de rasgos propios**: Battle Master, Arcane Archer, Sorrow Knight, Rune Knight y Cavalier 15 no calculan su CD (solo Psionic Power y Survivor del Champion tienen entradas en `feature-stats.ts`).
- **Bonos a pruebas** (Athletic Flair, Elegant Courtier, Remarkable Athlete): ninguna ficha los suma a habilidades.

## Dudas

- **Fighting Style, nivel 1** (`classes.json`): "Whenever you gain a Fighter level, you can replace the feat" — la app no ofrece una pantalla de reemplazo en cada subida; se cuenta como completo porque la dote es editable. Si el usuario quiere el aviso, es mejora de UX, no de regla.
- **Eldritch Knight, trucos**: el texto da 2 trucos y "another" en nivel 10; la tabla de datos no tiene columna de trucos, así que 2/3 sale del texto. Confirmar que el usuario quiere que se fije ese tope.
- **Defender's Blade (Knight 2014)**: "+1 bonus to AC while wearing heavy armor" — no verificado en ejecución con armadura equipada; la búsqueda en `engine.ts` y `trait-effects.ts` no encontró lector.
- **Rune Knight, Bonus Proficiencies**: competencia fija con herramientas de herrero; no he comprobado si la ficha la suma (no aparece en el volcado).
- **Alcance de la lista**: la tarea menciona Cavalier y Banneret; Cavalier existe solo como UA 2024 (`cavalier-ua`) y el de Xanathar no está en los datos.

## Observaciones (errores del volcado)

- `missing` y `warnings` vacíos con subclase y sin elecciones hechas: el volcado no refleja que Battle Master tiene 3 maniobras pendientes, que el Eldritch Knight tiene conjuros por elegir ni que los rasgos con selección (Student of War...) no avisan. El único aviso de elección pendiente es `weaponMastery` y las pendientes de especie (`traitPickMissing: Skillful`).
- Eldritch Knight: `spellcasting` muestra `cantrips=null` (dato ausente, ver fila de trucos).
- `Mutilate max=1 short=0` (Gladiator): contador espurio del lector "can't use it again until...".
- `Arcane Shot max=1`, `Strength of Mind max=1`, `Agonizing Strikes max=1`: correctos solo porque el personaje de prueba tiene INT 12 (+1); el contador usa el modificador (`max` = mod, mínimo 1), pero el volcado no lo demuestra para otras puntuaciones.
- `Know Your Enemy`, `Telekinetic Master`, `Bulwark of Force`: la recarga alternativa "gastando un dado / Second Wind" no está modelada (aceptable como manual).
- `Psionic Energy Dice short=1`: coincide con el texto (recupera 1 en descanso corto).
- Battle Master: el número de maniobras se calcula con una tabla fija en código (`OPTION_COUNT_BY_LEVEL.maneuver`) y no del texto; coincide con los datos (3/5/7/9).
