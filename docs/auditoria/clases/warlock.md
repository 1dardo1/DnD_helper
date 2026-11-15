# Auditoría de la clase Brujo (Warlock)

Auditoría de solo lectura de la ficha frente al texto real de `data/classes.json` (id `warlock`), `data/subclasses.json` (19 patrones: 9 de 2024 y 10 de 2014/UA; el Vestige Patron no tiene lista de conjuros) y `data/options.json` (30 Eldritch Invocations). Fuente del cálculo de hoy: `docs/auditoria/_volcado/clase-warlock.json`. Las invocaciones se juzgaron leyendo el motor (el volcado no las elige).

## Resumen

Total de elementos revisados: **145** — ✅ 64 · ⚠️ 28 · ❌ 26 · — 27

| Bloque | ✅ | ⚠️ | ❌ | — |
|---|---|---|---|---|
| Clase base (data/classes.json, id `warlock`) | 6 | 3 | 1 | 1 |
| Eldritch Invocations (data/options.json, grupo `eldritch-invocation`, 30 opciones) | 15 | 7 | 2 | 6 |
| Archfey Patron (2024, PHB) | 2 | 1 | 0 | 2 |
| Celestial Patron (2024, PHB) | 5 | 0 | 0 | 0 |
| Fiend Patron (2024, PHB) | 4 | 0 | 1 | 0 |
| Great Old One Patron (2024, PHB) | 3 | 0 | 1 | 2 |
| Hexblade Patron (2024, UA6 26.06.2025) | 2 | 2 | 0 | 2 |
| Primordial Patron (2024, UA13 23.04.2026) | 0 | 3 | 2 | 0 |
| Sorcerer-King Patron (2024, UA7 21.08.2025) | 3 | 1 | 0 | 1 |
| Undead Patron (2024, Ravenloft: The Horrors Within) | 1 | 3 | 0 | 1 |
| Vestige Patron (2024, Arcana Unleashed) | 2 | 0 | 3 | 0 |
| Ghost in the Machine (UA 2014, Modern Magic) | 3 | 0 | 1 | 1 |
| Lurker in the Deep (UA 2014, UA61) | 4 | 0 | 1 | 2 |
| The Fathomless (2014, Tasha) | 4 | 0 | 2 | 1 |
| The Genie (2014, Tasha) | 0 | 3 | 1 | 1 |
| The Hexblade (2014, Xanathar) | 1 | 1 | 2 | 2 |
| The Noble Genie (UA 2014, UA67) | 3 | 0 | 2 | 1 |
| The Raven Queen (UA 2014, UA29) | 0 | 2 | 2 | 1 |
| The Seeker (UA 2014, UA16) | 3 | 1 | 1 | 1 |
| The Undying (2014, Sword Coast Adventurer’s Guide) | 2 | 0 | 2 | 1 |
| The Undying Light (UA 2014, UA10) | 1 | 1 | 2 | 1 |

Lo más importante, por gravedad:

1. **Mystic Arcanum no se puede elegir** (niveles 11/13/15/17): el selector corta en nivel 5 y no hay campo en el personaje; solo existe un contador agrupado.
2. **Las "Expanded Spell List" de los 10 patrones de 2014/UA se tratan como conjuros siempre preparados desde nivel 3** (todos los niveles 1-5 de golpe). La regla es una ampliación de la lista de elección; hay que sacarlas de `featSpells.always` y añadirlas al selector. Además los datos del Genie (4 genios) y del Primordial (por elemento) están concatenados y los de Ghost in the Machine son conjuros inexistentes.
3. **Invocaciones con elección interna sin soporte**: Pact of the Tome (3 trucos + 2 rituales), Lessons of the First Ones (dote de Origen), Agonizing Blast/Eldritch Spear/Repelling Blast (truco), Elemental Overflow/Transmutation (tipo de daño), repetibles.
4. **Resistencias de patrón que no salen en la ficha**: Thought Shield (psíquico), Raven’s Shield (necrótico), Radiant Soul 2014 (radiante). Y al revés, Superior Dread (2024 Undead) aplica resistencias/vuelo siempre.
5. **Elecciones de patrón sin selector**: tipo de genio (Genie), elemento (Primordial), tipo de vestigio y dominio (Vestige), Fiendish Resilience, Elemental Resistance (Noble Genie).
6. **Rasgos 2014 que dan conjuros no leídos**: Spare the Dying (Undying), Light/Sacred Flame (Undying Light), Evard’s Black Tentacles (Fathomless), Finger of Death (Raven Queen), Augury (Seeker); el lector exige "You" mayúscula y un solo nombre.
7. Hex Warrior (2014): no da competencias ni CAR en el arma.

## Clase base (data/classes.json, id `warlock`)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 1 · Eldritch Invocations | Nº de invocaciones por nivel (1,3,3,3,5,5,6,6,7,7,7,8,8,8,9,9,9,10,10,10) leído de la columna de la tabla; selector en creación y subida de nivel; prerrequisitos de nivel e invocación previa (Pact of the Blade/Tome…) bloquean; se puede cambiar una por nivel (desmarcar/marcar) | ⚠️ | Las opciones se guardan solo como ids planos en `choices.options`: no hay "repetible" (misma invocación con otro truco), ni elección de truco/tipo de daño dentro de la invocación. Prerrequisito "truco de Brujo que hace daño" solo se muestra como nota (`optionUncheckedNote`), no se comprueba. No impide quitar una invocación que es prerrequisito de otra ya elegida a nivel de datos (se marca como inválida) | app/src/app/core/creation/creation-rules.ts, features/level-up, features/creation, core/models/character.ts |
| 1 · Pact Magic (espacios) | `pact` = {slots, nivel}: 1×N1, 2×N1, 2×N2, 2×N2, 2×N3 … 3×N5 (11), 4×N5 (17); columna Slot Level coincide con `slotsByLevel` de los datos; pips propios (`pactSlotsSpent`); recupera en descanso corto y largo; los conjuros de Brujo gastan primero el espacio de pacto | ✅ | Nada. Volcado 1-20 coincide con la tabla (slots 1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4; nivel 1,1,2,2,3,3,4,4,5…) | app/src/app/core/rules/engine.ts, app/src/app/core/combat/spend.ts, app/src/app/core/play/play-state.ts |
| 1 · Pact Magic (trucos y conjuros) | Trucos 2/2/2/3/3/3/3/3/3/4… y conjuros preparados 2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15 (volcado = tabla); selector de conjuros por clase con tope de nivel de espacio; cambio de 1 conjuro al subir de nivel (`spell-swap`: warlock levelUp "one") | ✅ | El selector solo ofrece conjuros hasta el nivel del espacio de pacto (máx. 5): ver Mystic Arcanum. No hay reemplazo de truco en la UI de subida (la regla lo permite) — no verificado | app/src/app/core/creation/creation-rules.ts (spellsFor), app/src/app/features/characters/spell-book.ts, app/src/app/core/play/spell-swap.ts |
| 2 · Magical Cunning | Contador 1 uso, recarga descanso largo (correcto, `FEATURE_USES`) | ⚠️ | No hay acción que devuelva la mitad (redondeo arriba) de los espacios de pacto: el jugador debe quitar los pips a mano. Tampoco se enlazan los rasgos de patrón que reaccionan a Magical Cunning (Celestial Resilience, Hex Restoration, Decisive Edict, Vestige Power) | app/src/app/core/play/play-state.ts, features/characters/play-panel.ts |
| 3 · Warlock Subclass | Selector de patrón a nivel 3 (`subclassLevel`), aviso `sheet.warn.noSubclass` si falta; 19 patrones en datos (la lista del texto de clase menciona 6) | ✅ | Nada en el selector. Ver tablas por patrón | app/src/app/core/rules/engine.ts, app/src/app/core/creation/creation-rules.ts |
| 4/8/12/16 · Ability Score Improvement | `featSlots` crea ranura por nivel (slot `warlock:N`); aumentos de característica y dote | ✅ | Nada | app/src/app/core/creation/creation-rules.ts |
| 9 · Contact Patron | Contador "Contact Patron" 1 uso/descanso largo (`featUses` leído del texto); Contact Other Plane siempre preparado | ✅ | Detalle: el volcado lo etiqueta `atWill` en grantedSpells aunque el texto limita a 1/descanso largo y a "tirada de salvación automática" (texto). El conjuro de clase nunca recibe `freeKey` (regla `free = g.free && kind !== 'class'` en engine), el contador es aparte: no se descuenta al lanzar desde Conjuros | app/src/app/core/rules/engine.ts (traitGrants), app/src/app/core/rules/feat-effects.ts |
| 11 · Mystic Arcanum — elección | Debería elegir 1 conjuro de Brujo de nivel 6 (11), 7 (13), 8 (15), 9 (17), y poder sustituirlo al subir de nivel | ❌ | No existe selector: `spellsFor` corta en el nivel máximo de espacio (5) y la tabla `preparedByLevel` no incluye arcana. No hay campo en `Character.choices` para el arcanum. El jugador no puede registrar ni ver cuál es su arcanum de nivel 6-9 (salvo marcarlo como conjuro normal, imposible por el tope) | app/src/app/core/creation/creation-rules.ts (spellsFor/maxSpellLevel), app/src/app/features/characters/spell-book.ts, app/src/app/core/models/character.ts |
| 11/13/15/17 · Mystic Arcanum — uso | Contador "Arcano místico" max 1/2/3/4 (volcado correcto: 11→1, 13→2, 15→3, 17→4), recarga descanso largo | ⚠️ | Es un contador agrupado, sin vínculo con el conjuro concreto ni con la lista de conjuros (lanzar un conjuro de nivel 6+ no lo gasta). Depende de que exista la elección | app/src/app/core/play/play-state.ts |
| 19 · Epic Boon | Ranura de dote épica (`kind: epic-boon`) en `warlock:19`; tope de característica 30 con dote épica | ✅ | Nada (Boon of Fate es solo recomendación) | app/src/app/core/creation/creation-rules.ts, app/src/app/core/rules/engine.ts |
| 20 · Eldritch Master | Texto del rasgo | — | Regla: Magical Cunning recupera todos los espacios; sin acción de Magical Cunning no hay nada que calcular. Si se añade la acción de Magical Cunning, debe leer este rasgo (≥20: todos) | app/src/app/core/play/play-state.ts |

## Eldritch Invocations (data/options.json, grupo `eldritch-invocation`, 30 opciones)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Pact of the Blade | Bandera `combat.pactBlade`; en cada arma cuerpo a cuerpo sin munición una nota con la tirada/daño usando CAR ("si es el arma vinculada") | ⚠️ | No hay fila del arma de pacto conjurada (arma Simple/Marcial cuerpo a cuerpo elegida), ni elección del tipo de daño Necrótico/Psíquico/Radiante, ni marca de arma vinculada. Solo nota informativa | attacks.ts, engine.ts (combat) |
| Pact of the Chain | Find Familiar como conjuro a voluntad (spec trait-effects); aparece en conjuros siempre disponibles | ✅ | Las formas especiales (Imp, Pseudodragon…) y renunciar a un ataque: texto | feat-effects.ts, engine.ts |
| Pact of the Tome | Solo el texto | ❌ | Debería pedir 3 trucos y 2 conjuros de nivel 1 con etiqueta Ritual de cualquier lista, que "funcionan como conjuros de Brujo" y se cambian al reconjurar el libro. No hay selector ni almacén; los conjuros no aparecen en la ficha | — |
| Agonizing Blast (2+) | Nota de combate `agonizing` con "+CAR" y el número ya calculado | ⚠️ | No se elige el truco; no es repetible (id único); el bonus no se suma a ninguna fila de conjuros | engine.ts:1341, i18n combat |
| Armor of Shadows | Mage Armor a voluntad → CA base 13+DES sin armadura (spec: 13+2); no si hay armadura | ✅ | — | engine.ts:346 |
| Ascendant Step (5+) | Levitate a voluntad en lista de conjuros | ✅ | — | feat-effects.ts |
| Devil’s Sight (2+) | Sentido `devils-sight` 120 pies | ✅ | — | trait-effects.ts |
| Devouring Blade (12+, req. Thirsting Blade) | Texto; prerrequisito de invocación comprobado | — | La app no calcula ataques por acción (ningún Extra Attack) en ninguna clase: texto basta | — |
| Eldritch Mind | Texto | — | Ventaja en TS de concentración: situacional | — |
| Eldritch Smite (5+, req. Pact of the Blade) | Texto | — | Daño extra 1d8/nivel de espacio + derribo: situacional | — |
| Eldritch Spear (2+) | Texto | ⚠️ | Habría que elegir el truco y mostrar alcance +30 pies × nivel; no hay elección ni cálculo (la elección no se guarda) | — |
| Elemental Overflow (5+, sin libro: 2024) | Texto | ⚠️ | Elige tipo de daño (Ácido/Frío/Fuego/Rayo/Trueno) y es repetible; la elección no se guarda. Efecto situacional | — |
| Elemental Transmutation (2+) | Texto | ⚠️ | Igual: tipo de daño elegido no se guarda | — |
| Fiendish Vigor (2+) | False Life a voluntad | ✅ | Los PG temporales máximos automáticos son texto | feat-effects.ts |
| Gaze of Two Minds (5+) | Texto | — | Percepción por los sentidos de otro: narrativo | — |
| Gift of the Depths (5+) | Velocidad nadando = velocidad (spec); Water Breathing con contador 1/descanso largo | ✅ | Respirar bajo el agua: texto | trait-effects.ts, engine.ts |
| Gift of the Protectors (9+, req. Pact of the Tome) | Texto | ⚠️ | Una vez por descanso largo no tiene contador (no verificado: ningún lector específico; el texto "can't benefit until Long Rest" no es el patrón "once you use"); nombres en la página: texto | — |
| Investment of the Chain Master (5+, req. Pact of the Chain) | Texto | — | Mejoras del familiar: narrativo | — |
| Lessons of the First Ones (2+) | Texto | ❌ | Debería dar una dote de Origen elegida (repetible, con otra distinta cada vez). No hay ranura de dote ni selector; los efectos de la dote (conjuros, contadores) no se aplican | creation-rules.ts (featSlots solo ASI/estilo/épica) |
| Lifedrinker (9+, req. Pact of the Blade) | Nota `lifedrinker` (1d6 + gastar dado de golpe) | ✅ | Es un recordatorio; no gasta dados de golpe automáticamente | engine.ts:1338 |
| Mask of Many Faces (2+) | Disguise Self a voluntad | ✅ | — | feat-effects.ts |
| Master of Myriad Forms (5+) | Alter Self a voluntad | ✅ | — | feat-effects.ts |
| Misty Visions (2+) | Silent Image a voluntad | ✅ | — | feat-effects.ts |
| One with Shadows (5+) | Invisibility a voluntad (la condición de penumbra no se comprueba) | ✅ | — | feat-effects.ts |
| Otherworldly Leap (2+) | Jump a voluntad | ✅ | — | feat-effects.ts |
| Repelling Blast (2+) | Texto | ⚠️ | Truco elegido no guardado; empujón 10 pies: situacional. Repetible no soportado | — |
| Thirsting Blade (5+, req. Pact of the Blade) | Texto | — | Extra Attack con el arma de pacto: la app no modela nº de ataques | — |
| Visions of Distant Realms (9+) | Arcane Eye a voluntad | ✅ | — | feat-effects.ts |
| Whispers of the Grave (7+) | Speak with Dead a voluntad | ✅ | — | feat-effects.ts |
| Witch Sight (15+) | Sentido visión verdadera 30 pies | ✅ | — | trait-effects.ts |

## Archfey Patron (2024, PHB)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Archfey Spells | Calm Emotions, Faerie Fire, Misty Step, Phantasmal Force, Sleep (3); Blink, Plant Growth (5); Dominate Beast, Greater Invisibility (7); Dominate Person, Seeming (9): siempre preparados por nivel de clase (volcado correcto) | ✅ | — | engine.ts (~1213) |
| 3 · Steps of the Fey | Misty Step gratis × mod. CAR (mín. 1), descanso largo: contador y conjuro (volcado 2 con CAR 14) | ⚠️ | Opciones Refreshing/Taunting Step y (nivel 6) Disappearing/Dreadful Step: texto; sin selector (se eligen al lanzar: texto basta) | feat-effects.ts |
| 6 · Misty Escape | Texto | — | Misty Step como reacción; narrativo | — |
| 10 · Beguiling Defenses | Contador 1/descanso largo | ✅ | Recuperar el uso gastando un espacio de pacto: manual (sin botón) | feat-effects.ts |
| 14 · Bewitching Magic | Texto + fila fantasma de conjuro | — | El volcado muestra un conjuro `"Misty Step as part of the same action and"` (a voluntad) generado por el lector de texto: nombre erróneo (ver Observaciones) | feat-effects.ts |

## Celestial Patron (2024, PHB)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Celestial Spells | Aid, Cure Wounds, Guiding Bolt, Lesser Restoration, Light, Sacred Flame (3); Daylight, Revivify (5); Guardian of Faith, Wall of Fire (7); Greater Restoration, Summon Celestial (9) | ✅ | — | engine.ts |
| 3 · Healing Light | Reserva de d6: 1 + nivel de Brujo (4 en 3.º … 21 en 20.º), recarga descanso largo; máx. dados por uso = mod CAR en el texto | ✅ | — | pools.ts |
| 6 · Radiant Soul | Resistencia a radiante desde nivel 6 (volcado); +CAR a daño radiante/fuego una vez por turno: texto | ✅ | — | trait-effects.ts |
| 10 · Celestial Resilience | PG temporales = nivel + CAR y mitad a 5 aliados (feature-stats: nota con el número) | ✅ | No se enlaza al uso de Magical Cunning ni al descanso (automatismo) | feature-stats.ts:669 |
| 14 · Searing Vengeance | Contador 1/descanso largo | ✅ | — | feat-effects.ts |

## Fiend Patron (2024, PHB)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Fiend Spells | Burning Hands, Command, Scorching Ray, Suggestion (3); Fireball, Stinking Cloud (5); Fire Shield, Wall of Fire (7); Geas, Insect Plague (9) | ✅ | — | engine.ts |
| 3 · Dark One’s Blessing | Nota con PG temporales = CAR + nivel (feature-stats) | ✅ | — | feature-stats.ts:660 |
| 6 · Dark One’s Own Luck | Contador mod CAR (mín. 1), descanso largo (2 en volcado) | ✅ | — | feat-effects.ts |
| 10 · Fiendish Resilience | Texto | ❌ | Elegir un tipo de daño (no Fuerza) tras cada descanso corto/largo y mantener la resistencia: no hay selector ni diálogo de descanso (`restPicks` solo existe para dotes/especies); la resistencia no aparece. Es la categoría "elección que se cambia en descanso" que CLAUDE.md deja como texto en otros rasgos; aquí sí cambia una estadística persistente | engine.ts (restPicks ~905), trait-rest-dialog |
| 14 · Hurl Through Hell | Contador 1/descanso largo | ✅ | Recuperar gastando espacio de pacto: manual | feat-effects.ts |

## Great Old One Patron (2024, PHB)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Great Old One Spells / Psychic Spells | Detect Thoughts, Dissonant Whispers, Phantasmal Force, Tasha’s Hideous Laughter (3); Clairvoyance, Hunger of Hadar (5); Confusion, Summon Aberration (7); Modify Memory, Telekinesis (9) | ✅ | — | engine.ts |
| 3 · Awakened Mind | Texto | — | Telepatía con alcance CAR millas: narrativo | — |
| 6 · Clairvoyant Combatant | Contador 1, corto o largo (correcto) | ✅ | Recuperar con espacio de pacto: manual | feat-effects.ts |
| 10 · Eldritch Hex | Hex siempre preparado + estado activable `hex` | ✅ | La desventaja en TS de la característica elegida: texto | engine.ts, active-states.ts |
| 10 · Thought Shield | Texto | ❌ | Resistencia a daño Psíquico (y reflejo) no aparece en `resistances` (volcado vacío en 10-20): el lector no reconoce "You also have Resistance to Psychic damage" tras "Your thoughts can't be read…" | trait-effects.ts |
| 14 · Create Thrall | Texto | — | Narrativo; efecto sobre Summon Aberration | — |

## Hexblade Patron (2024, UA6 26.06.2025)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Hexblade Spells | Arcane Vigor, Hex, Shield, Wrathful Smite (3); Bestow Curse, Conjure Barrage (5); Freedom of Movement, Staggering Smite (7); Animate Objects, Steel Wind Strike (9) | ✅ | — | engine.ts |
| 3 · Hexblade’s Curse | Contador mod CAR (mín. 1), descanso largo (volcado 2); Hex preparado y estado `hex` | ⚠️ | Hex Restoration (14: recupera 1 uso en descanso corto o con Magical Cunning) no se aplica: el contador solo se restaura en largo; Hungering Hex y los beneficios de la maldición: texto | feat-effects.ts |
| 3 · Unyielding Will | Contador 1/descanso largo | ✅ | — | feat-effects.ts |
| 6 · Malign Brutality | Texto | — | Situacional | — |
| 10 · Armor of Hexes | Texto | — | Reacción | — |
| 14 · Masterful Hex | Contador 1/largo (clave explosive-hex); crítico 19-20 sobre el objetivo maldito: texto | ⚠️ | El crítico 19-20 no entra en `critRange`; Explosive Hex recuperable con espacio de pacto: manual | engine.ts (critRangeOf) |

## Primordial Patron (2024, UA13 23.04.2026)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Elemental Spells | Lista por elemento escrita como tabla de varios elementos | ❌ | El texto de datos concatena los nombres de las columnas (`"Darkvision Feather Fall"`, `"Shatter Entangle"`, `"Knock Burning Hands"`, `"Heat Metal Alter Self"`, y de nivel 5, 7 y 9 todo en una cadena): ningún id existe en el compendio; los conjuros siempre preparados salen rotos. Además dependen del elemento elegido (no hay selector) | data/subclasses.json (scraper), engine.ts |
| 3 · Elemental Node | Contador 1, corto o largo (correcto) | ⚠️ | No hay selector de elemento (Ácido/Frío/Fuego/Rayo/Trueno…) que se usa en Primeval Protection; recuperar con espacio de pacto: manual | — |
| 6 · Elemental Haven | Contador mod CAR (mín. 1), largo | ⚠️ | AC +CAR dentro del nodo: situacional | feat-effects.ts |
| 10 · Primeval Protection | Texto | ❌ | Resistencia al elemento elegido: sin selector, no aparece en resistencias | — |
| 14 · Elemental Harbinger | Texto | ⚠️ | Planar Ally sin espacio, "2d4 descansos largos": sin contador (texto basta por ser variable) | — |

## Sorcerer-King Patron (2024, UA7 21.08.2025)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Sorcerer-King Spells | Command, Compelled Duel, Hold Person, Mind Spike, Wrathful Smite (3); Fear, Sending (5); Compulsion, Staggering Smite (7); Dominate Person, Synaptic Static (9) | ✅ | — | engine.ts |
| 3 · Tyrants Herald | Contador Voice of Tyranny mod CAR (mín. 1), largo | ⚠️ | Aparecen DOS contadores iguales ("Command as a Bonus Action" y "Tyrants Herald", max 2) y una fila de conjuro con nombre "Command as a Bonus Action". Intimidation: competencia + pericia no se aplican (no hay lector de "proficiency in the Intimidation skill" para subclase; no verificable en volcado) | feat-effects.ts |
| 6 · Decisive Edict | Contador 1, corto o largo | ✅ | Recuperar con Magical Cunning: manual | feat-effects.ts |
| 10 · Vindictive Rebuke | Contador mod CAR (mín. 1), largo | ✅ | — | feat-effects.ts |
| 14 · Absolute Tyranny | Texto | — | Situacional | — |

## Undead Patron (2024, Ravenloft: The Horrors Within)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Undead Spells | Bane, Blindness/Deafness, Phantasmal Force, Ray of Sickness (3); Speak with Dead, Summon Undead (5); Greater Invisibility, Phantasmal Killer (7); Antilife Shell, Cloudkill (9) | ✅ | — | engine.ts |
| 3 · Form of Dread | Contador mod CAR (mín. 1), largo | ⚠️ | Sin estado activo "forma" que active efectos condicionados (inmunidad a asustado, PG temporales 1d10+nivel) | feat-effects.ts |
| 6 · Grave Touched | Texto | — | — | — |
| 10 · Necrotic Husk | Resistencia Necrótico (volcado) + contador 1 corto/largo | ⚠️ | Inmunidad a necrótico "mientras uses Form of Dread": no modelada | trait-effects.ts |
| 14 · Superior Dread | Texto + resistencias a contundente/perforante/cortante y Vuelo 30 en la ficha | ⚠️ | Error: son beneficios de "mientras usas Form of Dread" y el volcado los aplica siempre (resistencias B/P/S permanentes y velocidad de vuelo) | trait-effects.ts |

## Vestige Patron (2024, Arcana Unleashed)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Vestige Companion | Texto + stat block en la descripción | ❌ | No hay elección del tipo de vestigio (Celestial/Fiend/Undead) ni criatura en el módulo de invocaciones (`core/summons`); no se guarda | — |
| 3 · Vestige Spells | `subclass.spells` = null: no hay lista | ❌ | Debe elegir un dominio de Clérigo (Life, Light, Trickery, War) y recibir sus conjuros de dominio por nivel de Brujo como siempre preparados; ni los datos ni el motor tienen selector ni tabla | data/subclasses.json (scraper), engine.ts |
| 6 · Vestige Power | Texto | ❌ | Resistencias iguales a las del vestigio (según tipo): sin tipo elegido no se calculan | — |
| 10 · Vestige Recovery | Contador 1/descanso largo | ✅ | Coste de un espacio de pacto: manual | — |
| 14 · Semblance of Life | Contador 1/descanso largo | ✅ | Los stats del espíritu: Summon Celestial/Fiend/Undead existen en el compendio, sin enlace | — |

## Ghost in the Machine (UA 2014, Modern Magic)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Conjuros inventados ("Infallible Relay", "Remote Access", "Arcane Hacking"…): ninguno existe en `data/spells.json`; salen como siempre preparados sin ficha. Además aplica el fallo de Expanded Spell List (clase 3/4/5 mal interpretados) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Information Surge | Contador 1, corto o largo | ✅ | — | feat-effects.ts |
| 6 · Wire Walk | Contador 1, corto o largo | ✅ | — | feat-effects.ts |
| 10 · Personal Encryption | Texto | — | — | — |
| 14 · Technovirus | Contador 1/descanso largo | ✅ | — | feat-effects.ts |

## Lurker in the Deep (UA 2014, UA61)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Grasp of the Deep | Contador mod CAR (mín. 1), largo | ✅ | Daño del tentáculo 1d8→2d8: texto | feat-effects.ts |
| 3 · Scion of the Deep | Texto | — | — | — |
| 6 · Fathomless Soul | Velocidad nadando 30 y resistencia al frío (volcado) | ✅ | Respirar aire y agua: texto | trait-effects.ts |
| 6 · Guardian Grasp | Texto | — | — | — |
| 10 · Devouring Maw | Contador 1, corto o largo | ✅ | — | feat-effects.ts |
| 14 · Unleash the Depths | Contador 1/largo | ✅ | — | feat-effects.ts |

## The Fathomless (2014, Tasha)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Tentacle of the Deep | Contador = Bonificador de competencia (2→6), largo (volcado 2,3,4,5,6 en 3/5/10/14/17) | ✅ | — | feat-effects.ts |
| 3 · Gift of the Sea | Velocidad nadando 40 (volcado) | ✅ | Respirar bajo el agua: texto | trait-effects.ts |
| 6 · Oceanic Soul | Resistencia al frío (volcado) | ✅ | — | trait-effects.ts |
| 6 · Guardian Coil | Texto | — | — | — |
| 10 · Grasping Tentacles | Texto | ❌ | Evard’s Black Tentacles como conjuro de Brujo que no cuenta, 1 uso gratis por descanso largo: no está en grantedSpells ni hay contador (el lector exige "learn the … spell" con mayúscula "You" y orden distinto: "you learn the spell Evard’s…") | feat-effects.ts (regex "You learn the … spell") |
| 14 · Fathomless Plunge | Contador 1, corto o largo | ✅ | — | feat-effects.ts |

## The Genie (2014, Tasha)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| 3 · Expanded Spell List | Cuatro genios en una tabla: la columna "Genie" + Dao/Djinni/Efreeti/Marid | ❌ | Los datos concatenan las filas ("Detect Evil and Good Sanctuary Thunderwave Burning Hands Fog Cloud"…): ningún id válido, salen conjuros rotos como siempre preparados. No hay selector del tipo de genio (dao/djinni/efreeti/marid) ni se separa la columna del genio elegido. Además fallo general de lista ampliada | data/subclasses.json (scraper), engine.ts |
| 3 · Genie’s Vessel | Contador 1/descanso largo (Bottled Respite) | ⚠️ | Genie’s Wrath: daño extra = PB con tipo según genio (sin tipo elegido, texto); CA/PG del recipiente: texto. Falta la elección del genio (dao/djinni/efreeti/marid) y dónde guardarla | feat-effects.ts |
| 6 · Elemental Gift | Contador PB (3→6), largo | ⚠️ | Resistencia (contundente/trueno/fuego/frío según genio) y velocidad de vuelo 30: no aplicadas (dependen del genio y el lector no distingue); no hay selector | trait-effects.ts |
| 10 · Sanctuary Vessel | Texto | — | — | — |
| 14 · Limited Wish | Texto | ⚠️ | "1d4 descansos largos": sin contador (variable, texto basta); mejor un recordatorio | — |

## The Hexblade (2014, Xanathar)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Hexblade’s Curse | Contador 1, corto o largo (volcado correcto) | ⚠️ | Bonus de daño = PB y crítico 19-20 sobre el objetivo: no se aplican a ataques (texto); curar al morir: texto | feat-effects.ts |
| 3 · Hex Warrior | Texto | ❌ | No concede competencia con armadura media, escudos y armas marciales (el lector exige "proficiency with Martial weapons"); no hay elección de arma ni CAR para ataque/daño del arma (tampoco ampliado a Pact of the Blade) | engine.ts (proficiencies ~640), attacks.ts |
| 6 · Accursed Specter | Contador 1/descanso largo | ✅ | Estadísticas del espectro (Monster Manual): sin enlace en invocaciones | feat-effects.ts |
| 10 · Armor of Hexes | Texto | — | — | — |
| 14 · Master of Hexes | Texto | — | — | — |

## The Noble Genie (UA 2014, UA67)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Collector’s Vessel | Contador mod CAR (mín. 1), largo | ✅ | — | feat-effects.ts |
| 6 · Elemental Resistance | Texto | ❌ | Elegir tras cada descanso largo resistencia a ácido/frío/fuego/rayo: sin selector ni diálogo de descanso; no aparece resistencia | engine.ts (restPicks), trait-rest-dialog |
| 10 · Protective Wish | Texto | — | — | — |
| 10 · Genie’s Entertainment | Contador 1/descanso largo | ✅ | — | feat-effects.ts |
| 14 · Collector’s Call | Contador 1/descanso largo | ✅ | — | feat-effects.ts |

## The Raven Queen (UA 2014, UA29)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Sentinel Raven | Texto | ⚠️ | Visión en la oscuridad 30 pies y bono CAR a Percepción (con el cuervo posado): no hay sentido ni bono (situacional); el cuervo no está en invocaciones | — |
| 6 · Soul of the Raven | Texto | — | — | — |
| 10 · Raven’s Shield | Texto | ❌ | Resistencia a daño Necrótico (y ventaja en TS contra muerte, inmunidad a asustado): ninguna resistencia aparece en el volcado | trait-effects.ts |
| 14 · Queen’s Right Hand | Contador 1/descanso largo | ⚠️ | Finger of Death "puedes lanzar" sin espacio: no figura en conjuros concedidos | feat-effects.ts |

## The Seeker (UA 2014, UA16)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Shielding Aurora | Contador 1, corto o largo | ✅ | Resistencia a todo el daño hasta el siguiente turno: texto | feat-effects.ts |
| 3 · Pact Boon: Pact of the Star Chain | Contador 1, corto o largo | ⚠️ | Augury como ritual no se concede (el texto dice "you know the augury spell": minúscula "you"); la ventaja en INT: texto | feat-effects.ts |
| 6 · Astral Refuge | Texto | — | — | — |
| 10 · Far Wanderer | Resistencia a frío y fuego en la ficha | ✅ | — | trait-effects.ts |
| 14 · Astral Sequestration | Contador 1/descanso largo | ✅ | — | feat-effects.ts |

## The Undying (2014, Sword Coast Adventurer’s Guide)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Among the Dead | Texto | ❌ | Spare the Dying como truco de Brujo que no cuenta: no está en conjuros concedidos (el lector exige "You learn…" con "You" capital; el texto dice "you learn the Spare the Dying cantrip"); ventaja contra enfermedad y salvación de no-muertos: texto | feat-effects.ts |
| 6 · Defy Death | Contador 1/descanso largo | ✅ | — | feat-effects.ts |
| 10 · Undying Nature | Texto | — | — | — |
| 14 · Indestructible Life | Contador 1, corto o largo | ✅ | — | feat-effects.ts |

## The Undying Light (UA 2014, UA10)

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos implicados |
|---|---|---|---|---|
| Expanded Spell List | Los conjuros se listan como "siempre preparados" desde nivel 3 (todos los niveles 1-5 de golpe, aunque el Brujo aún no tenga espacios de nivel 4-5) | ❌ | Regla real: "puedes elegir de una lista ampliada al aprender un conjuro de Brujo" (se añaden a la lista, NO se preparan siempre ni son gratis). El motor trata `subclass.spells` como dominio/juramento (`always: true`, engine ~1215) y el selector de conjuros (`spellsFor`) no incluye la lista ampliada: no se pueden elegir y además cuentan como extra. Además los datos 2014 usan `classLevel` 3/4/5 con el **nivel de conjuro** (1.º-3.º → 3, 4.º → 4, 5.º → 5) | engine.ts (~1213), creation-rules.ts (spellsFor), data/subclasses.json |
| 3 · Radiant Soul | Texto | ❌ | Resistencia a radiante no aparece (volcado vacío); Light y Sacred Flame como trucos a voluntad que no cuentan: "you know the Light and Sacred Flame cantrips" no coincide con el lector (dos nombres, "you" minúscula) | feat-effects.ts, trait-effects.ts |
| 6 · Searing Vengeance | Contador 1/descanso largo | ✅ | — | feat-effects.ts |
| 10 · Radiant Resistance | Texto | — | PG temporales al descansar: sin nota (2024 Celestial sí tiene nota en feature-stats) | feature-stats.ts |
| 14 · Healing Light | Texto | ⚠️ | Reserva de 15d6 hasta descanso largo: sin contador (solo el Healing Light de 2024 está en `pools.ts`) | pools.ts |

## Patrones comunes

- **Contadores de patrón correctos**: casi todos los "usos = CAR / PB / 1 por descanso" se leen bien del texto (`feat-effects.ts`) con la recarga adecuada (corto-o-largo cuando el texto lo dice). Sirven los 2024 y los 2014/UA.
- **"Recuperar gastando un espacio de pacto"** (Beguiling Defenses, Hurl Through Hell, Clairvoyant Combatant, Elemental Node, Explosive Hex, Vestige Recovery) y **"recuperar con Magical Cunning"** (Decisive Edict, Hex Restoration, Vestige Power, Celestial Resilience): no hay botón ni enlace; todo manual. Un único mecanismo (acción de Magical Cunning + "restaurar uso pagando espacio") cubriría ~10 rasgos.
- **Listas ampliadas 2014/UA** (`Expanded Spell List`): mal modeladas como siempre preparadas (ver resumen). Es un problema de motor (`engine.ts` ~1213) más de datos (columnas por genio/elemento concatenadas, conjuros inventados de Ghost in the Machine).
- **Elecciones persistentes de patrón sin selector**: genio, elemento, vestigio+dominio, Fiendish Resilience, Elemental Resistance. No hay almacén en `Character.choices` (solo `options`, `traitChoices`, `traitPicks`); `restPicks` solo existe para dotes/especies.
- **Efectos que dependen de una "forma" o estado** (Form of Dread, nodo, vestigio, maldición): se aplican siempre o nunca; no hay `activeStates` para ellos (solo `hex`).
- **Conjuros que da un rasgo con texto en minúscula** ("you learn the X cantrip", "you know the A and B cantrips", "learn the spell X"): el lector exige "You" con mayúscula y un solo nombre; afecta a los rasgos 2014.

## Dudas

- Contact Patron: no está claro si la intención del proyecto es que el conjuro de clase use el contador al lanzarse (hoy el contador y el conjuro van separados y el volcado lo marca `atWill`).
- Gift of the Protectors: no pude comprobar sin ejecutar el motor si el lector detecta "no creature can benefit until you finish a Long Rest" como contador; asumí que no. Igual con el tope de invocaciones "repetible".
- Reemplazo de trucos de Brujo al subir de nivel (el texto lo permite): no verifiqué la UI.
- Intimidation (Tyrants Herald) y las competencias de subclase: el volcado no muestra habilidades, no se pudo comprobar.
- Datos: el texto de clase lista 6 patrones (incluye Undead y Vestige); los datos tienen 18. El enunciado hablaba de 9 + 10; hay 9 de 2024 (Archfey, Celestial, Fiend, Great Old One, Hexblade UA6, Primordial, Sorcerer-King, Undead, Vestige) y 9 de 2014/UA (Ghost, Lurker, Fathomless, Genie, Hexblade, Noble Genie, Raven Queen, Seeker, Undying, Undying Light = 10, contando Ghost). En total 19.
- Hexblade UA6 y Hexblade 2014 comparten rasgos; no se verificó que el estado `hex` sea correcto en 2014 (su Hex no se concede).

## Observaciones (errores del volcado)

- `Archfey Bewitching Magic` (14): conjuro fantasma `"Misty Step as part of the same action and"` (regex "cast X … without a spell slot" captura de más).
- `Sorcerer-King Tyrants Herald` (3): conjuro y contador duplicados `"Command as a Bonus Action"` + `"Tyrants Herald"` (max 2 ambos).
- `Primordial` y `Genie` 2014: nombres de conjuro concatenados; `Fathomless`: `"Summon Elemental (Water only)"`, `"Bigby's Hand (appears as a tentacle)"` no resuelven.
- `Ghost in the Machine`: conjuros inexistentes en el compendio.
- `Undead Patron` 14: resistencias B/P/S y vuelo 30 permanentes (solo "mientras usas Form of Dread").
- `Contact Patron`: etiquetado `atWill`, sin `freeKey`.
- El volcado de subclase muestra el contador `Contact Patron` solo desde nivel 10 en mi diff, pero es solo artefacto de comparación (en base aparece desde 9).
- Subclases 2014: `classLevel` 3/4/5 es nivel de conjuro (1.º-3.º agrupados), no nivel de clase; el motor lo usa como nivel de clase.
- El volcado no incluye invocaciones elegidas: no hay datos calculados para ellas; todo lo dicho de invocaciones sale de leer `engine.ts`, `feat-effects.ts`, `trait-effects.ts` y su spec.
