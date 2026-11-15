# Auditoría de la clase Explorador (Ranger)

Fuentes: `data/classes.json` (`ranger`, 2024 PHB), `data/subclasses.json` (12 subclases con `classId` = `ranger`), volcado `docs/auditoria/_volcado/clase-ranger.json` y lectura del código en `app/src/app`. Auditoría de solo lectura: no se ha ejecutado nada de Angular.

## Resumen

| | ✅ completo | ⚠️ parcial | ❌ falta | — texto basta | Total |
| --- | --- | --- | --- | --- | --- |
| Clase base | 11 | 2 | 1 | 3 | 17 |
| 12 subclases | 24 | 8 | 7 | 26 | 65 |
| **Total** | **35** | **10** | **8** | **29** | **82** |

Faltantes principales (por impacto):
1. **Deft Explorer** (nivel 2): ni la Pericia extra ni los 2 idiomas extra se pueden elegir (`expertiseCount` solo cuenta rasgos llamados exactamente "Expertise"; el asistente exige exactamente 2 idiomas y marca "demasiados" si hay más).
2. **Hunter**: Hunter's Prey y Defensive Tactics no tienen selector (ni cambio en descanso); solo hay una nota de Colossus Slayer.
3. **Iron Mind** (Gloom Stalker 2024 y Deep Stalker 2014): la competencia en salvaciones de SAB no se aplica (`engine.ts` solo suma la de la clase y `choices.saves`, que ninguna pantalla rellena).
4. **Hollow Warden**: Wrath of the Wild no es un estado activable (no gasta el uso de Favored Enemy, no da +1/+2 CA); Hungering Might (bonif. SAB a salvaciones de CON, pasivo) no se aplica.
5. **Fey Wanderer**: Fey Reinforcements (Summon Fey gratis 1/descanso largo) sin contador; Otherworldly Glamour sin selector de la competencia (Engaño/Interpretación/Persuasión).
6. **Fighting Style → Druidic Warrior** (2 trucos de druida) no existe como opción.
7. **Tireless**: el descenso de Agotamiento en descanso corto no se aplica (solo el largo lo baja).

## Clase base (Ranger 2024)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Spellcasting | Medio lanzador SAB; espacios de la tabla; preparados 2→15 (`preparedByLevel`); selector de conjuros de la lista del Explorador; los conjuros siempre preparados (Hunter's Mark, subclase) no cuentan en el cupo (solo se cuentan los elegidos en `spellsByClass`) | ✅ | — (cambio de 1 conjuro en descanso largo: texto) | `core/creation/creation-rules.ts` (~734), `core/creation/spell-choices.ts`, `core/rules/engine.ts` |
| 1 · Favored Enemy | Hunter's Mark siempre preparado (`grantedSpells`, origen `class:Favored Enemy`); contador "Favored Enemy" 2/3/4/5/6 desde la columna de la tabla, recarga solo larga (`short=0`); estado activable `huntersMark` con nota 1d6 (1d10 a nivel 20) | ✅ | Activar el estado no gasta un uso del contador (es manual; el conjuro también se puede lanzar con espacio, así que es aceptable) | `core/play/rest-rules.ts` (29), `core/rules/active-states.ts`, `core/rules/feature-stats.ts` (562) |
| 1 · Weapon Mastery | 2 casillas (`combat.masterySlots`); elección en el asistente y editable en cualquier momento en el panel de equipo (cubre el cambio en descanso largo); aviso si faltan | ✅ | — | `core/rules/engine.ts` (1289), `features/characters/equipment-panel.ts`, `features/creation/character-create.ts` |
| 2 · Deft Explorer | Texto: 1 Pericia (Expertise) en una competencia + 2 idiomas a elegir | ❌ | (a) `expertiseCount` (`/^expertise$/`) no cuenta "Deft Explorer": ni el asistente ni la subida de nivel piden la Pericia; (b) los idiomas: el asistente exige exactamente 2 (`create.missing.languages`) y marca `create.issue.tooManyLanguages` si se eligen 4; la subida de nivel no tiene selector de idiomas. Hace falta: +1 pick de Expertise a nivel ≥2 y +2 idiomas libres | `core/creation/creation-rules.ts` (150, 658), `core/creation/level-up.ts` (112), `features/level-up/level-up.ts`, `features/creation/character-create.ts` (1299) |
| 2 · Fighting Style | Ranura de dote de Fighting Style a nivel 2 (`featSlots` lee el rasgo de la tabla); el selector ofrece las dotes de estilo | ⚠️ | La alternativa **Druidic Warrior** (2 trucos de druida que cuentan como de Explorador, SAB, sustituibles al subir de nivel) no existe: `cantripsByLevel` es null y no hay ninguna lógica "druidic warrior" (grep vacío) | `core/creation/creation-rules.ts` (50-70), `features/creation/character-create.ts` (220), `core/creation/spell-choices.ts` |
| 3 · Ranger Subclass | Selector de subclase; aviso `noSubclass` mientras falta | ✅ | — | `features/creation`, `features/level-up` |
| 4/8/12/16 · Ability Score Improvement | Ranuras de dote ASI | ✅ | — | `core/creation/creation-rules.ts` (featSlots) |
| 5 · Extra Attack | Texto | — texto basta | (la tabla de ataques no multiplica ataques; no hay contador que calcular) | — |
| 6 · Roving | +10 pies de velocidad si no hay armadura pesada (`armorSpeed.unless='heavy'`); Trepar y Nadar = velocidad. Volcado: `{walk:40, climb:40, swim:40}` | ✅ | — | `core/rules/trait-effects.ts` (168), `core/rules/engine.ts` (365) |
| 9 · Expertise | 2 picks de Pericia (asistente y subida de nivel) | ✅ | — | `core/creation/creation-rules.ts` (151) |
| 10 · Tireless | Contador "Incansable" = mod. SAB (mín. 1), recarga larga; nota de estadística "Magic action: 1d8+SAB PG temporales" | ⚠️ | "Decrease Exhaustion": al terminar un descanso corto el Agotamiento baja 1. `shortRest` no toca `exhaustion` (solo `longRest`, que lo baja siempre, también sin ser Explorador) | `core/play/play-state.ts` (138, 400-425), `core/rules/feature-stats.ts` (573) |
| 13 · Relentless Hunter | Texto (concentración en Hunter's Mark) | — texto basta | — | — |
| 14 · Nature's Veil | Contador = mod. SAB (mín. 1), larga | ✅ | (la condición Invisible se aplica a mano) | `core/play/play-state.ts` (145) |
| 17 · Precise Hunter | Texto (ventaja contra la marcada) | — texto basta | — | — |
| 18 · Feral Senses | `traitRules` lee "Blindsight with a range of 30 feet" y lo añade a `sheet.senses` | ✅ | El volcado no incluye `senses`, así que se infiere por la regex; conviene un test con datos reales | `core/rules/trait-effects.ts` (210), `core/rules/engine.ts` (390) |
| 19 · Epic Boon | Ranura de dote épica | ✅ | — | `core/creation/creation-rules.ts` |
| 20 · Foe Slayer | La nota de Hunter's Mark pasa a d10 | ✅ | — | `core/rules/feature-stats.ts` (562-569) |

## Beast Master (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Primal Companion | `featureSource` extrae los 3 bloques (Tierra, Mar, Cielo) y se ven en la pestaña Criaturas invocadas con CA, PG y ataque calculados con nivel, SAB y PB; hay test que comprueba PG 30, CA 16 y "Beast's Strike" | ⚠️ | No hay fila de acciones del compañero en la pestaña Combate (pendiente declarado en CLAUDE.md); el tipo de daño de Beast's Strike (Tierra) no se elige; revivir con espacio y sustituir en descanso largo son texto; ningún contador | `core/summons/catalog.ts` (300-340), `core/summons/summons.spec.ts` (115, 549), `core/rules/feature-coverage.spec.ts` (37) |
| 7 · Exceptional Training | Texto | — texto basta | — | — |
| 11 · Bestial Fury | Texto (daño extra = el de Hunter's Mark) | — texto basta | — | — |
| 15 · Share Spells | Texto | — texto basta | — | — |

## Deep Stalker (2014, UA 10)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Underdark Scout | Texto (primer turno +10 de velocidad y ataque extra) | — texto basta | — | — |
| 3 · Deep Stalker Magic | Visión en la oscuridad 90 (volcado `dv=90`); Disguise Self, Rope Trick, Glyph of Warding, Greater Invisibility, Seeming siempre preparados a niveles 3/5/9/13/17 | ✅ | — | `data/subclasses.json`, `core/rules/engine.ts` (1214) |
| 7 · Iron Mind | Competencia en salvaciones de SAB | ❌ | No se aplica: `saveProf` = salvaciones de la clase + `choices.saves` (nadie lo escribe). Falta un lector de "proficiency in X saving throws" para rasgos de clase/subclase | `core/rules/engine.ts` (250-258), `core/models/character.ts` (70) |
| 11 · Stalker's Flurry | Texto | — texto basta | — | — |
| 15 · Stalker's Dodge | Texto (reacción) | — texto basta | — | — |

## Drakewarden (2014, Fizban)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Draconic Gift | Thaumaturgy como conjuro de Explorador (volcado `grantedSpells`) | ⚠️ | "Tongue of Dragons": hablar/leer/escribir Draconic u otro idioma a elegir. Sin selector (y el asistente marca "demasiados idiomas" si se añade). No hay lista de idiomas de subclase | `core/creation/creation-rules.ts` (658), `core/rules/engine.ts` (584-605) |
| 3 · Drake Companion | Bloque "Drake Companion" extraído en la pestaña Invocaciones; contador 1 uso/larga (`featUses`; el texto permite recuperarlo gastando un espacio ≥1, que es manual) | ⚠️ | No hay test de que el bloque resuelve (CA `14 + PB`, PG `5 + 5·nivel`, "Dex +1 plus PB"); el tipo de daño de Draconic Essence (acid/cold/fire/lightning/poison) no se elige al invocar; no aparece en Combate | `core/summons/catalog.ts`, `core/summons/resolve.ts` |
| 7 · Bond of Fang and Scale | Texto | ⚠️ | "Resistance": resistencia al tipo elegido en Draconic Essence mientras el draco esté invocado; no se aplica (volcado `resistances: []`). Depende de que se guarde el tipo elegido; sin ese dato, no hay qué aplicar | `core/rules/engine.ts` (resistances), `core/summons/*` |
| 11 · Drake's Breath | Contador 1/larga (`featUses`) | ⚠️ | No hay nota/línea de ataque con 8d6 (10d6 a nivel 15), CD de conjuro ni elección de tipo; recuperación gastando espacio ≥3: manual | `core/rules/feature-stats.ts` (DEFS sin entrada), `core/rules/feat-effects.ts` |
| 15 · Perfected Bond | Contador "Perfected Bond" = PB (5 a nivel 15, 6 a 17), larga (reacción Reflexive Resistance) | ✅ | — | `core/rules/feat-effects.ts` (usos) |

## Fey Wanderer (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Dreadful Strikes | Nota de combate "+1d4 psíquico, una vez por turno" (1d6 a nivel 11) | ✅ | — | `core/rules/feature-stats.ts` (578-585) |
| 3 · Fey Wanderer Spells (+ Feywild Gifts) | Charm Person, Misty Step, Summon Fey, Dimension Door, Mislead siempre preparados a niveles 3/5/9/13/17; Feywild Gifts es adorno | ✅ | — | `data/subclasses.json`, `core/rules/engine.ts` (1214) |
| 3 · Otherworldly Glamour | Nota de estadística "+SAB a pruebas de Carisma" (`otherworldlyGlamour`) | ⚠️ | (a) Falta el selector de la competencia en Engaño/Interpretación/Persuasión (`choices.skills` solo se rellena con las del asistente/clase); (b) el bonus no se suma a los modificadores de Engaño, Interpretación, Persuasión ni Intimidación de la hoja (solo nota) | `core/rules/feature-stats.ts` (456-465), `core/rules/engine.ts` (264) |
| 7 · Beguiling Twist | Texto (ventaja y reacción; CD en texto) | — texto basta | — | `core/rules/feature-coverage.spec.ts` (39) |
| 11 · Fey Reinforcements | Texto | ❌ | Summon Fey sin espacio 1/descanso largo: no hay contador (`featUses` vacío a nivel 11, el lector no entiende "cast it once without a spell slot" porque el hechizo va como pronombre) ni conjuro gratis en `grantedSpells`. La opción "sin Concentración" es texto | `core/rules/feat-effects.ts` (lector de usos/conjuros gratis) |
| 15 · Misty Wanderer | Contador Misty Step = SAB, larga; conjuro gratis (`free=trait:subclass:misty-wanderer:misty-step`) | ✅ | (llevar a una criatura: texto) | `core/rules/feat-effects.ts` |

## Gloom Stalker (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Dread Ambusher | Contador "Dread Ambusher" = SAB, larga; nota "+2d6 psíquico" (2d8 a 11); bonus de iniciativa: `traitRules` lee "add your Wisdom modifier to the roll" | ✅ | La iniciativa se deduce de la regex (el volcado no incluye iniciativa) y el +10 pies del primer turno es texto | `core/rules/feature-stats.ts` (588-598), `core/rules/trait-effects.ts` (155-163), `core/rules/engine.ts` (299) |
| 3 · Gloom Stalker Spells | Disguise Self, Rope Trick, Fear, Greater Invisibility, Seeming siempre preparados | ✅ | — | `data/subclasses.json` |
| 3 · Umbral Sight | Visión en la oscuridad 60 (volcado `dv=60`) | ⚠️ | "Si ya tienes Darkvision, su alcance aumenta en 60 pies": `engine.ts` toma el máximo de rangos, no suma; un elfo/tiflin sale con 60 en vez de 120. Texto de invisibilidad ante visión en la oscuridad: texto | `core/rules/trait-effects.ts` (210-216), `core/rules/engine.ts` (390-400) |
| 7 · Iron Mind | Competencia en SAB (o INT/CHA si ya la tienes) | ❌ | Igual que Deep Stalker: no se aplica ni hay selector de la alternativa | `core/rules/engine.ts` (250) |
| 11 · Stalker's Flurry | Nota Dreadful Strike pasa a 2d8; Sudden Strike y Mass Fear en texto | ✅ | — | `core/rules/feature-stats.ts` (596) |
| 15 · Shadowy Dodge | Texto (reacción) | — texto basta | — | — |

## Hollow Warden (2024, Ravenloft)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Hollow Warden Spells | Wrathful Smite, Alter Self, Phantom Steed, Dominate Beast, Steel Wind Strike siempre preparados | ✅ | — | `data/subclasses.json` |
| 3 · Wrath of the Wild | Texto (Bonus Action, gasta un uso de Favored Enemy, 1 min) | ❌ | No hay estado activable (como Furia): no consume el contador "Favored Enemy", no da +1 CA (+2 desde 11), no hay duración ni fin por Incapacitated. Los ataques de oportunidad e Unnerving Aura son texto | `core/rules/active-states.ts` (ACTIVE_STATES sin entrada), `core/rules/engine.ts` (CA) |
| 7 · Hungering Might | Texto | ❌ | Bonus a salvaciones de CON = SAB (mín. +1), pasivo: no se suma en `savingThrows` (grep del rasgo vacío). La curación de 1d10+SAB es situacional (texto) | `core/rules/engine.ts` (250-260), `core/rules/trait-effects.ts` |
| 11 · Rot and Violence | Texto (solo transformado) | — texto basta | — | — |
| 15 · Ancient Might | Contador "Ancient Might" 1/larga (Persistent Wrath; recuperar con espacio ≥4: manual) | ✅ | Ominous Strikes (+SAB al golpear asustados) y Timeless (inmune a Agotamiento) son condicionales a la transformación: texto | `core/rules/feat-effects.ts` |

## Horizon Walker Conclave (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Horizon Walker Magic | Protection from Evil and Good, Misty Step, Haste, Banishment, Teleportation Circle siempre preparados (volcado correcto) | ✅ | — | `data/subclasses.json` |
| 3 · Detect Portal | Contador 1 uso, recarga corta o larga | ✅ | — | `core/play/rest-rules.ts` |
| 3 · Planar Warrior | Texto (1d8 → 2d8 fuerza) | — texto basta | — | — |
| 7 · Ethereal Step | Contador 1 uso, corta o larga | ✅ | — | `core/play/rest-rules.ts` |
| 11 · Distant Strike | Texto | — texto basta | — | — |
| 15 · Spectral Defense | Texto (reacción) | — texto basta | — | — |

## Hunter (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Hunter's Lore | Texto | — texto basta | — | — |
| 3 · Hunter's Prey | Solo una nota de combate "Colossus Slayer (si lo elegiste): +1d8" siempre visible | ❌ | No hay selector Colossus Slayer / Horde Breaker, ni dónde guardarlo (`traitPicks` es solo de especie, `species-picks.ts`/`trait-choices.ts`), ni cambio en descanso corto/largo (`restPicks` vacío). La nota sale aunque se eligiera Horde Breaker | `core/rules/feature-stats.ts` (601-607), `core/rules/trait-choices.ts`, `core/play/rest-choices.ts`, `core/rules/engine.ts` (restPicks) |
| 7 · Defensive Tactics | Texto | ❌ | Escape the Horde / Multiattack Defense: mismo mecanismo ausente | los mismos |
| 11 · Superior Hunter's Prey | Texto | — texto basta | — | — |
| 15 · Superior Hunter's Defense | Texto (reacción) | — texto basta | — | — |

## Monster Slayer Conclave (2014, Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Monster Slayer Magic | Protection from Evil and Good, Zone of Truth, Magic Circle, Banishment, Hold Monster siempre preparados | ✅ | — | `data/subclasses.json` |
| 3 · Hunter's Sense | Contador = SAB (mín. 1), larga | ✅ | — | `core/rules/feat-effects.ts` |
| 3 · Slayer's Prey | Texto (+1d6 al designado) | — texto basta | — | — |
| 7 · Supernatural Defense | Texto (+1d6 situacional) | — texto basta | — | — |
| 11 · Magic-User's Nemesis | Contador 1 uso, corta o larga | ✅ | — | `core/play/rest-rules.ts` |
| 15 · Slayer's Counter | Texto (reacción) | — texto basta | — | — |

## Primeval Guardian (2014, UA 27)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Guardian Magic | Entangle, Enhance Ability, Conjure Animals, Giant Insect, Insect Plague siempre preparados | ✅ | — | `data/subclasses.json` |
| 3 · Guardian Soul | Texto (forma Large, velocidad 5, alcance +5, PG temporales por turno = mitad de nivel) | — texto basta | Forma situacional sin estado activable | — |
| 3 · Piercing Thorns | Texto (+1d6, una vez por turno) | — texto basta | — | — |
| 7 · Ancient Fortitude | Texto (PG máx y actuales +2 por nivel al adoptar la forma) | — texto basta | — | — |
| 11 · Rooted Defense | Texto | — texto basta | — | — |
| 15 · Guardian Aura | Texto | — texto basta | — | — |

## Swarmkeeper (2014, Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Gathered Swarm | Texto (1d6 → 1d8 en 11; Fuerza CD) | — texto basta | — | — |
| 3 · Swarmkeeper Magic | Mage Hand y Faerie Fire siempre preparados a 3; Web 5; Gaseous Form 9; Arcane Eye 13; Insect Plague 17 | ✅ | — | `data/subclasses.json` |
| 7 · Writhing Tide | Contador = PB (3 a nivel 7, 4 a 10, 5 a 14, 6 a 17), larga | ✅ | — | `core/rules/feat-effects.ts` |
| 11 · Mighty Swarm | Texto | — texto basta | — | — |
| 15 · Swarming Dispersal | Contador = PB, larga | ✅ | — | `core/rules/feat-effects.ts` |

## Winter Walker (2024, Heroes of Faerûn)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Frigid Explorer | Resistencia al frío aplicada (volcado `resistances: ["Cold"]`) | ⚠️ | Polar Strikes (+1d4 frío, 1d6 a nivel 11, una vez por turno) sin nota de combate (a diferencia del Dreadful Strikes de Fey Wanderer, que sí la tiene). Biting Cold: texto | `core/rules/feature-stats.ts` (DEFS sin entrada), `core/i18n/es.ts` (`combat.note.*`) |
| 3 · Hunter's Rime | Texto (PG temporales 1d10 + nivel al lanzar Hunter's Mark; no Disengage) | — texto basta | — | — |
| 3 · Winter Walker Spells | Ice Knife, Hold Person, Remove Curse, Ice Storm, Cone of Cold siempre preparados | ✅ | — | `data/subclasses.json` |
| 7 · Fortifying Soul | Contador 1/larga | ✅ | — | `core/rules/feat-effects.ts` |
| 11 · Chilling Retribution | Contador = SAB (mín. 1), larga | ✅ | — | `core/rules/feat-effects.ts` |
| 15 · Frozen Haunt | Contador 1/larga (recuperar con espacio ≥4: manual) | ✅ | Inmunidades e incorporeidad condicionales: texto | `core/rules/feat-effects.ts` |

## Patrones comunes

- **Competencias de rasgos de clase/subclase no se aplican**: no hay lector para "proficiency in X saving throws" (Iron Mind, ×2 en Explorador) ni selector para "una de estas habilidades" en rasgos de subclase (Otherworldly Glamour). Es un hueco general del motor (`saveProf` y `choices.skills` solo vienen de la clase, el fondo y el asistente).
- **Opciones intercambiables de clase/subclase sin selector** (Hunter's Prey, Defensive Tactics; mismo patrón que Fighting Style alternativo "Druidic Warrior" y Blessed Warrior del Paladín): `traitPicks` y `restPicks` solo existen para especie y dotes.
- **Lector de "usos gratis" no entiende pronombres** (Fey Reinforcements: "cast it once without a spell slot"): sí funcionan los que repiten el nombre del conjuro (Misty Wanderer).
- **Transformaciones/estados sin interruptor**: solo existen Furia, Forma salvaje, Hex, Hunter's Mark e Innate Sorcery como `ACTIVE_STATES`. Wrath of the Wild (Hollow Warden, +CA) y Guardian Soul (2014) quedan como texto.
- **Rasgos de varias subclases y de 2014/UA no están en `feature-coverage.spec.ts`** (solo audita las subclases PHB 2024); por eso Hollow Warden, Winter Walker y las 2014 quedan sin vigilancia automática.
- **Contadores "uso + gastar espacio para recuperar"** (Drake Companion, Drake's Breath, Persistent Wrath, Frozen Haunt): el contador modela solo el uso de descanso, la recuperación con espacio es manual.
- **Compañeros**: aparecen en la pestaña de invocaciones; la pestaña Combate no los lista (pendiente ya anotado en CLAUDE.md).

## Dudas

1. **Fey Wanderer · Otherworldly Glamour**: "bonus a la prueba de Carisma = SAB". No dice si el bonus es a cualquier prueba de característica de CARISMA (incluye Intimidación) o solo a las habilidades; asumido: toda prueba de Carisma.
2. **Gloom Stalker · Iron Mind**: "si ya tienes competencia en SAB, escoge INT o CAR": si se implementa, hay que decidir cómo almacenar la elección (¿`choices.saves`?).
3. **Tireless · Decrease Exhaustion**: aplica en cada descanso corto; no está claro si debe aplicarse automáticamente o pedir confirmación (el agotamiento es un valor del estado del juego).
4. **Drakewarden · Bond of Fang and Scale**: la resistencia depende del tipo elegido al invocar al draco; el modelo de invocaciones no guarda ese tipo.

## Observaciones (errores del volcado, aunque no sean faltantes)

- **El volcado no incluye todos los niveles**: solo hay entradas en 3, 5, 6, 7, 10, 11, 14, 15, 17, 18 y 20. Los conjuros de subclase de niveles 9 y 13 aparecen en 10 y 14. No es un error del motor (los entradas siguen los niveles de la tabla de la subclase), pero no hay filas para 9 y 13.
- **El volcado no incluye `senses`** (Feral Senses) ni iniciativa (Dread Ambusher), por lo que esas dos comprobaciones salen de leer las regexes, no del volcado.
- **`warnings` de las filas incluye siempre `traitPickMissing: Skillful`** (species del personaje de prueba) y `weaponMastery`, que son ruido para la clase.
- **Drakewarden · Draconic Gift** en `grantedSpells` aparece sin marca `always` (`Thaumaturgy [subclass:Draconic Gift]`) porque es un truco (correcto), pero el volcado no distingue "truco conocido" de "siempre preparado".
- Contador "Misty Step" de Misty Wanderer se llama "Misty Step" en el volcado (`feat=Misty Wanderer`); en la hoja el contador sale con el nombre del conjuro, no del rasgo.
- Horizon Walker 2014: `counters` con `short="all"` (comillas incluidas); es la representación del volcado de "recupera en corto", no un fallo de datos.
