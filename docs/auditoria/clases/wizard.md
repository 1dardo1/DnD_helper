# Auditoría de clase: Mago (Wizard)

Solo lectura: se contrasta el texto de `data/classes.json` (id `wizard`, una sola edición: 2024, que
reemplaza a la 2014) y `data/subclasses.json` (21 subclases con `classId` = `wizard`: 10 de 2024/UA
2024 y 11 de 2014/UA) con el volcado `docs/auditoria/_volcado/clase-wizard.json` y con el código de
`app/src/app`. Nada se ha ejecutado (ni tests ni build); todo es lectura de datos y fuentes.

Siglas de archivos: `engine` = `core/rules/engine.ts`; `fx` = `core/rules/feat-effects.ts`;
`fstats` = `core/rules/feature-stats.ts`; `pstate` = `core/play/play-state.ts`;
`rest` = `core/play/rest-rules.ts`; `swap` = `core/play/spell-swap.ts`;
`crules` = `core/creation/creation-rules.ts`; `lvl` = `core/creation/level-up.ts` +
`features/level-up/*`; `sbook` = `features/characters/spell-book.*`;
`schoices` = `core/creation/spell-choices.ts`; `active` = `core/rules/active-states.ts`.

## Resumen

Recuento de filas (una fila = un rasgo o grupo de rasgos de la tabla de cada clase/subclase):

| Ámbito | ✅ | ⚠️ | ❌ | — |
| --- | --- | --- | --- | --- |
| Clase base | 4 | 4 | 4 | 1 |
| Abjurer | 1 | 1 | 1 | 2 |
| Bladesinger | 0 | 1 | 1 | 3 |
| Conjurer | 2 | 0 | 1 | 3 |
| Diviner | 0 | 1 | 3 | 1 |
| Enchanter | 3 | 0 | 2 | 1 |
| Evoker | 0 | 0 | 1 | 4 |
| Illusionist | 3 | 0 | 1 | 1 |
| Transmuter | 3 | 0 | 3 | 1 |
| Necromancer | 1 | 1 | 2 | 2 |
| Imaskar Arcanist (UA 2024) | 2 | 0 | 0 | 3 |
| Artificer (UA 2014) | 0 | 0 | 0 | 5 |
| Chronurgy Magic | 4 | 0 | 0 | 1 |
| Graviturgy Magic | 2 | 0 | 0 | 2 |
| Lore Mastery (UA) | 3 | 0 | 1 | 2 |
| Onomancy (UA) | 1 | 1 | 3 | 1 |
| Order of Scribes | 3 | 0 | 0 | 2 |
| Psionics (UA) | 1 | 1 | 2 | 3 |
| School of Invention (UA) | 1 | 0 | 2 | 2 |
| Technomancy (UA) | 2 | 0 | 0 | 3 |
| Theurgy (UA) | 0 | 0 | 6 | 1 |
| War Magic | 1 | 0 | 2 | 2 |

Conclusiones gordas:

1. **No existe el concepto de libro de conjuros.** La app guarda una única lista por clase
   (`choices.spellsByClass`) con tope = columna "Prepared Spells". No hay "6 conjuros al nivel 1 + 2
   por nivel" distintos de los preparados, de modo que no se pueden modelar Ritual Adept, Memorize
   Spell, Spell Mastery, Signature Spells (elección), ni los 8 "Savant" de escuela, ni los conjuros
   "que aparecen en tu libro" (Necromancer, Onomancy, Theurgy, Psionics).
2. **Scholar (nivel 2) no ofrece selector de Expertise** (`expertiseCount` solo cuenta rasgos que se
   llamen exactamente "Expertise").
3. **Bladesong no es un estado activable** (la lista de `active` está cerrada: rage, wildShape, hex,
   huntersMark, innateSorcery): ni CA +INT, ni +10 de velocidad, ni INT a ataque/daño.
4. **Portent (Diviner) no tiene contador ni dados** guardados; tampoco Greater Portent.
5. **Arcane Ward** solo muestra el número máximo (2×nivel + INT) y un contador de "1 uso" por
   descanso largo; no hay reserva de PG de la protección que se gaste/recupere.
6. Los contadores de rasgos con "INT veces por descanso largo", "una vez hasta descanso" y
   conjuros gratis con recarga sí funcionan bien (lectura de texto en `fx`): es lo más sólido de la
   clase.

## Clase base: Mago

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Spellcasting (tabla: trucos, preparados, espacios, INT, foco) | Trucos 3/3/3/4.., preparados 4,5,6,7,9,10,11,12,14,15,16,16,17,18,19,21,22,23,24,25 y espacios coinciden con la tabla en los 20 niveles; INT como característica; selección de trucos y conjuros nivel 1+ en creación y subida (`create.missing.*`, ganancias en `levelUp.gainCantrips/gainPrepared`) | ✅ | Nada para la tabla en sí | `engine`, `crules` (`review`), `schoices`, `lvl` |
| 1 · Spellcasting: Spellbook ("seis conjuros nivel 1; +2 por nivel; los preparados salen del libro") | Nada específico: la lista elegida es a la vez libro y preparados; en creación se exige exactamente el nº de la columna Prepared (4 al nivel 1, no 6) y `create.issue.tooManySpells` impide pasarse | ❌ | Modelo de libro: lista `spellbook` (6 + 2/nivel, solo conjuros de nivel con espacios), preparados como subconjunto con tope de la tabla, copiar conjuros de pergaminos/otros libros, libro-foco. No aparece ni la palabra "libro de conjuros" en `i18n` | `character.ts` (`choices`), `schoices`, `crules`, `lvl`, `sbook` |
| 1 · Spellcasting: preparar desde el libro y cambiar tras descanso largo | Tras descanso largo, `state.spellSwap` = `any` permite cambiar la lista de conjuros nivel 1+ (`swap`: wizard longRest `any`) | ⚠️ | Se cambia dentro de toda la lista de Mago (`spellsFor` sobre `spell.classes`), no entre los del libro; sin libro no se puede restringir | `swap`, `sbook` (`casters().available`) |
| 1 · Spellcasting: cambiar un truco tras descanso largo | — | ⚠️ | El panel de cambio solo ofrece conjuros nivel 1+ (`available` = `leveled`); los trucos no se pueden sustituir tras la creación salvo reeditando el personaje | `sbook`, `swap` |
| 1 · Ritual Adept | Texto; el selector de conjuros marca "R" (ritual) en la etiqueta | — | Texto basta; sin libro no puede filtrarse "rituales de tu libro" (ver Spellbook) | `shared/picker/entry-labels.service.ts` |
| 1 · Arcane Recovery | Contador "Recuperación arcana" 1 uso/descanso largo (`pstate` FEATURE_USES, `rest` por defecto largo); la ficha de combate calcula el nº de niveles: ceil(nivel/2) (`fstats` `arcaneRecovery`, prueba en `feature-stats.spec.ts`) | ⚠️ | No hay acción que recupere espacios gastados al gastar el uso (elegir espacios con suma ≤ nivel/2 y ninguno de nivel 6+); el contador solo se tacha. Tampoco se enlaza con Bladesong ("recuperas un uso") ni Necromancer (Grave Power, exhaustion −1) | `pstate`, `fstats`, `rest`, `features/characters/play-panel.ts` |
| 2 · Scholar | Solo el texto del rasgo | ❌ | Selector de 1 habilidad con competencia (Arcana, History, Investigation, Medicine, Nature, Religion) y guardado en `choices.expertise` (el motor ya aplica `expertise` en `engine`). `expertiseCount` no cuenta "Scholar" (regex `/^expertise$/`), por lo que creación/subida de nivel/edición no preguntan | `crules` (`expertiseCount`), `lvl` (`expertise`), `features/creation/character-create.ts`, `engine` (l. 268) |
| 3 · Arcane Tradition (subclase) | Selector de subclase a nivel 3; aviso `sheet.warn.noSubclass` hasta elegir | ✅ | — | `engine` (l. 132), `lvl` (`needsSubclass`) |
| 4/8/12/16 · Ability Score Improvement | Ranura de dote por nivel desde la tabla (`featSlots`) | ✅ | — | `crules` (`featSlots`) |
| 5 · Memorize Spell | Solo el texto; `swap` solo conoce el cambio tras descanso largo | ❌ | Cambio de 1 conjuro preparado nivel 1+ tras descanso corto (`spellSwap` con origen corto, y debería salir tras `shortRest`) | `swap`, `play-panel.ts`, `rest`, `sbook` |
| 18 · Spell Mastery | Solo el texto | ❌ | Elegir un conjuro de nivel 1 y otro de nivel 2 del libro con tiempo de lanzamiento de acción; quedan siempre preparados y se lanzan a nivel mínimo sin espacio (`featSpells` con `atWill`/`always`); cambiarlos tras descanso largo. No hay selector ni conjuro concedido (volcado: `grantedSpells` vacío al 18-20) | `engine` (`featSpells`), `fx` (`FEAT_PICKS`), `trait-choices.ts`, `spell-choices` |
| 19 · Epic Boon | Ranura de dote (nivel 19) | ✅ | (Boon of Spell Recall recomendada: ver informe de dotes) | `crules` |
| 20 · Signature Spells | Contador "Signature Spells" 2 usos, recupera corto o largo (`pstate`, `rest`: `short: 'all'`) | ⚠️ | No se eligen los dos conjuros de nivel 3 del libro ni se conceden como siempre preparados con "gratis 1×/descanso corto o largo" cada uno (no sale en `featSpells`/`grantedSpells`); el contador es genérico (2 usos), no por conjuro | `pstate` (`FEATURE_USES`), `rest`, `engine`, `fx` |

## Subclases de 2024 y UA 2024

### Abjurer (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Abjuration Savant | Texto | ❌ | Dos conjuros de Abjuración (≤ nivel 2) añadidos al libro y 1 por nuevo nivel de espacios (depende del libro) | `schoices`, `lvl` |
| 3 · Arcane Ward | Contador 1 uso/largo; en la pestaña de combate sale el máximo 2×nivel + INT (`fstats` `arcaneWard`, `to: 'stats'`, pasivo) | ⚠️ | No hay reserva de PG de la protección (daño absorbido, recuperarla 2×nivel de espacio al lanzar Abjuración o por acción adicional); no se resta del daño ni aparece junto a PG | `fstats`, `play-state`, `engine`, ficha de PG |
| 6 · Projected Ward | Texto | — | Reacción; depende de la reserva de la protección | — |
| 10 · Spell Breaker | Counterspell y Dispel Magic siempre preparados (`grantedSpells ... always`) | ✅ | Acción adicional y bonificador de competencia: texto | `engine` (`featSpells`) |
| 14 · Spell Resistance | Texto | — | Ventaja/resistencia condicional contra conjuros | — |

### Bladesinger (2024, Heroes of Faerûn)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bladesong | Contador "Bladesong" por descanso largo, tamaño leído de "veces igual a tu mod. de INT (mín. 1)" (`fx` l. 231) | ⚠️ | No es estado activable (`ActiveStateId` cerrado): al activarlo no suma CA +INT (mín. +1; volcado: `ac` 12 sin cambio), ni velocidad +10, ni INT en ataque/daño con armas, ni bono a concentración; no se apaga al llevar armadura/escudo; no recupera un uso al usar Arcane Recovery | `active`, `engine` (CA/velocidad), `attacks.ts`, `pstate` |
| 3 · Training in War and Song | Texto | ❌ | Elegir 1 habilidad (Acrobatics, Athletics, Performance, Persuasion) sin selector (`missing` vacío); competencia con armas marciales cuerpo a cuerpo sin Dos manos/Pesada no se refleja | `trait-choices.ts`, `engine` |
| 6 · Extra Attack | Texto (el motor no calcula Ataque Extra para ninguna clase) | — | Truco en lugar de ataque: texto | — |
| 10 · Song of Defense | Texto | — | Reacción, reducción 5×nivel de espacio | — |
| 14 · Song of Victory | Texto | — | — | — |

### Conjurer (2024, Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Benign Transposition | Contador (mod. INT, largo) | ✅ | — | `fx` |
| 3 · Conjuration Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 6 · Distant Transposition | Texto (alcance 60 pies; restaurar usos gastando espacio nivel 3+) | — | Restauración por espacio: texto | — |
| 6 · Durable Summons | Texto | — | PG temporales de la invocación (2×nivel): el panel de invocaciones no los lee | `core/summons/*` (opcional) |
| 10 · Focused Conjuration | Texto | — | — | — |
| 14 · Splintered Summons | Contador 1 uso/largo | ✅ | Restauración con espacio nivel 5+: texto | `fx` |

### Diviner (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Divination Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 3 · Portent | Solo texto (volcado: sin contador ni `featUses`) | ❌ | Tirar 2d20 al terminar descanso largo y guardarlos (valores), marcarlos como gastados, usar 1 por turno; perderlos en el siguiente descanso largo. No hay estado `state.portent` ni dados | `character.ts` (`state`), `play-state`, `pools.ts`, `rest` |
| 6 · Expert Divination | Texto | — | Recuperar un espacio al lanzar Adivinación (nivel ≥2): texto | — |
| 10 · The Third Eye | Contador 1 uso/corto-o-largo (`rest: short-or-long`); See Invisibility como "a voluntad" | ⚠️ | See Invisibility se muestra `atWill` (ilimitado) cuando el texto lo limita a una de las tres opciones y al único uso; las tres opciones (Darkvision 120, leer idiomas, See Invisibility) no se eligen ni afectan a Darkvision (volcado: `darkvision` null) | `engine` (`featSpells`), `fx`, `trait-choices.ts` |
| 14 · Greater Portent | Texto | ❌ | Dependiente de Portent: 3d20 | igual que Portent |

### Enchanter (2024, Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Enchanting Conversationalist | Texto | ❌ | Elegir 1 habilidad (Deception, Intimidation, Persuasion), añadir competencia y +INT (mín. +1) a esas pruebas; sin selector (`missing` vacío) | `trait-choices.ts`, `engine` (`skills`) |
| 3 · Enchantment Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 3 · Hypnotic Presence | Contador (INT, largo) | ✅ | CD en la ficha (`fstats`): no definida, texto basta | `fx` |
| 6 · Split Enchantment | Contador (INT, largo) | ✅ | — | `fx` |
| 10 · Instinctive Charm | Contador 1/largo | ✅ | Restaurar con conjuro de Encantamiento: texto | `fx` |
| 14 · Alter Memories | Texto | — | — | — |

### Evoker (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Evocation Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 3 · Potent Cantrip | Texto | — | Mitad de daño: texto | — |
| 6 · Sculpt Spells | Texto | — | — | — |
| 10 · Empowered Evocation | Texto | — | +INT a un daño: texto (no se refleja en ataques de conjuro) | — |
| 14 · Overchannel | Texto (en `TEXT_OK` de `feature-coverage.spec.ts`) | — | El daño creciente por reuso (2d12 + 1d12 por nivel) no se lleva por contador; aceptado como texto | — |

### Illusionist (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Illusion Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 3 · Improved Illusions | Minor Illusion concedido (`grantedSpells`) | ✅ | Si el mago ya lo conoce se debería elegir otro truco gratis (selector no existe); alcance/verbal: texto | `engine`, `fx` |
| 6 · Phantasmal Creatures | Summon Beast y Summon Fey concedidos con casting gratis 1×/largo (contadores propios) | ✅ | Marcarlos "siempre preparados" (no sale el distintivo `always` como en Spell Breaker; el volcado muestra solo `free=`) | `engine`, `fx` |
| 10 · Illusory Self | Contador 1 uso, recarga corto o largo | ✅ | — | `fx`, `rest` |
| 14 · Illusory Reality | Texto | — | — | — |

### Transmuter (2024, Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Transmutation Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 3 · Transmuter's Stone | Texto | ❌ | Elegir beneficio (Darkvision / Resistencia con tipo / Velocidad +10) al terminar descanso largo; no hay selector ni estado (la piedra es de quien la lleva, también el propio mago: resistencia y velocidad no suben nada en el volcado) | `trait-choices.ts`, `engine`, `character.ts` (`state`) |
| 3 · Wondrous Alteration | Alter Self concedido con 1 lanzamiento gratis/largo | ✅ | Bonos mientras dura: texto | `engine`, `fx` |
| 6 · Empowered Transmutation | Contador (INT, largo) | ✅ | — | `fx` |
| 10 · Potent Stone | Texto | ❌ | Dos beneficios de la piedra + Mighty Build y Tremorsense; igual que Transmuter's Stone | igual |
| 10 · Shape-Shifter | Polymorph concedido (1 gratis/largo) + contador de la modificación | ✅ | — | `engine`, `fx` |
| 14 · Master Transmuter | Texto | — | Consumible que se desvanece (piedra); sin contador | — |

### Necromancer (2024, Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Necromancy Savant | Texto | ❌ | Savant (libro) | `schoices` |
| 3 · Necromancy Spellbook | Resistencia a Necrotic aplicada (volcado `resistances: [Necrotic]`) | ⚠️ | Find Familiar "aparece en tu libro" (formas Skeleton/Zombie) y Undead Vitality: texto, sin libro no se refleja | `trait-effects.ts`, `engine` |
| 6 · Grave Power | Texto | — | Exhaustion −1 al usar Arcane Recovery: depende de la acción de Arcane Recovery | — |
| 6 · Undead Thralls | Texto (volcado: sin `grantedSpells` ni contador a nivel 6) | ❌ | "Siempre tienes preparado Animate Dead y puedes lanzarlo sin espacio 1×/descanso largo": debería conceder el conjuro y un contador (igual que Shape-Shifter o Wondrous Alteration); el lector de texto no lo reconoce (redacción "but you must finish a Long Rest before you can cast it in this way again") | `fx` (lectura de conjuros concedidos), `engine` |
| 10 · Harvest Undead | Texto | — | — | — |
| 14 · Death's Master | Contador 1/largo (Bolster Undead) | ✅ | Extinguish Undead: texto | `fx` |

### Imaskar Arcanist (UA15 Underdark, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Unlight Adept | Texto | — | Cambio de tipo de daño: texto | — |
| 3 · Unlight Invigoration | Texto | — | Gasta dados de golpe: el panel de dados de golpe no se conecta (texto) | — |
| 6 · Unlight Restoration | Texto | — | Ídem | — |
| 10 · Secrets of Deep Imaskar | Resistencia a Radiant aplicada; Glyph of Warding concedido con 1 lanzamiento gratis/largo; contador de Imaskarcana Lore (1/largo) | ✅ | — | `engine`, `fx`, `trait-effects.ts` |
| 14 · Doom of Unlight | Contador 1/largo | ✅ | Restaurar con espacio nivel 6+: texto | `fx` |

## Subclases de 2014 y UA

### Artificer (UA Eberron, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Infuse Potions | Texto | — | Seguimiento de pociones/espacios bloqueados: texto | — |
| 3 · Infuse Scrolls | Texto | — | Descuento sobre Arcane Recovery: texto | — |
| 6 · Infuse Weapons and Armor | Texto | — | — | — |
| 10 · Superior Artificer | Texto | — | — | — |
| 10 (debería ser 14) · Master Artificer | Texto | — | Texto basta (ver Observaciones: nivel mal indicado en el dato) | — |

### Chronurgy Magic (Wildemount, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Chronal Shift | Contador 2 usos/largo | ✅ | — | `fx` |
| 3 · Temporal Awareness | +INT a la iniciativa (regex "add your Intelligence modifiers to your initiative rolls" en `trait-effects.ts` l. 158; confirmado por lectura de código, el volcado no muestra la iniciativa) | ✅ | — | `trait-effects.ts`, `engine` (l. 299-305) |
| 6 · Momentary Stasis | Contador (INT mín. 1, largo) | ✅ | — | `fx` |
| 10 · Arcane Abeyance | Contador 1, recarga corto o largo | ✅ | — | `fx`, `rest` |
| 14 · Convergent Future | Texto | — | Exhaustion al usarlo: texto | — |

### Graviturgy Magic (Wildemount, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Adjust Density | Texto | — | — | — |
| 6 · Gravity Well | Texto | — | — | — |
| 10 · Violent Attraction | Contador 1 (INT, largo) | ✅ | — | `fx` |
| 14 · Event Horizon | Contador 1/largo | ✅ | Restaurar con espacio nivel 3+: texto | `fx` |

### Lore Mastery (UA 29, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Lore Mastery | Texto | ❌ | Competencia doble en pruebas de Arcana/History/Nature/Religion si hay competencia (no hay efecto en `skills`; sería Expertise condicional) y Iniciativa con INT o DES a elección | `engine` (`skills`, `initiative`), `trait-effects.ts` |
| 3 · Spell Secrets | Contador 1, recarga corto o largo | ✅ | Cambio de tipo de daño (sin límite): texto | `fx` |
| 3 · Altering Spells | Texto (consejo narrativo) | — | — | — |
| 6 · Alchemical Casting | Texto | — | Gasta un espacio extra: texto | — |
| 10 · Prodigious Memory | Contador 1, corto o largo | ✅ | El cambio en sí (libro): no existe | `fx` |
| 14 · Master of Magic | Contador 1/largo | ✅ | — | `fx` |

### Onomancy (UA 63, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Texto | ❌ | Un idioma a elegir (sin selector) y competencia con herramientas de calígrafo (no añadida como competencia) | `trait-choices.ts`, `engine` |
| 3 · Extract Name | Contador "1 uso/largo" | ⚠️ | El texto dice INT mod (mín. 1) usos; el volcado muestra `max=1` con INT 12, correcto solo por casualidad del personaje de prueba: no se ha podido verificar que la fórmula lea el modificador (el patrón de `fx` l. 231 sí lo cubre); revisar con INT alta | `fx` |
| 3 · Fateful Naming | Contador (INT, largo) | ❌ | Bane y Bless como conjuros de Mago siempre preparados que no cuentan al límite (volcado: `grantedSpells` vacío) | `fx`, `engine` |
| 6 · Resonant Utterance | Texto | ❌ | Elegir 2 Resonants (Dissolution, Nullification, Puppetry, Sympathy…), cambiar uno por nivel | `trait-choices.ts`, `character.ts` |
| 10 · Inexorable Pronouncement | Texto | ❌ | Otros 2 Resonants (mismo grupo de opciones) | igual |
| 14 · Relentless Naming | Texto | — | — | — |

### Order of Scribes (Tasha, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Wizardly Quill | Texto | — | — | — |
| 3 · Awakened Spellbook | Contador 1/largo (ritual sin +10 min) | ✅ | El libro como foco y sustitución de tipo de daño: texto | `fx` |
| 6 · Manifest Mind | Contador = bonificador de competencia/día (3 a nivel 6 … 6 a nivel 20) | ✅ | La condición "manifestar 1 vez por descanso largo, o más gastando espacio" no se rastrea (solo cuenta los lanzamientos desde la mente) | `fx` |
| 10 · Master Scriviner | Texto | — | Pergamino por descanso largo | — |
| 14 · One with the Word | Contador 1/largo | ✅ | Pérdida de conjuros del libro (3d6): texto | `fx` |

### Psionics (UA 66, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psionic Focus | Texto | — | — | — |
| 3 · Psionic Devotion | Texto | ❌ | Elegir 1 truco entre Friends, Mage Hand, Message (no cuenta contra trucos conocidos): sin selector ni truco concedido | `trait-choices.ts`, `engine` (`featSpells`) |
| 6 · Thought Form | Contador (INT, largo) | ⚠️ | Resistencia a psíquico y a B/P/S no mágico y vuelo/velocidad (nivel 14, Thought Travel) no se aplican (volcado: `resistances` vacío), ni hay estado activable | `trait-effects.ts`, `active` |
| 10 · Empowered Psionics | Texto | — | — | — |
| 10 · Mental Discipline | Texto | ❌ | Elegir 1 conjuro (Dominate Person, Scrying, Telekinesis) con 1 lanzamiento gratis/largo; sin selector ni contador | `trait-choices.ts`, `fx` |
| 14 · Thought Travel | Texto | — | — | — |

### School of Invention (UA 47, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Tools of the Inventor | Texto | ❌ | Elegir 2 herramientas (sin selector; el sistema `toolChoices` de la clase no lo cubre) | `crules` (`toolChoices`), `trait-choices.ts` |
| 3 · Arcanomechanical Armor | Texto | ❌ | Competencia con armadura ligera, CA 12 + DES de la armadura y resistencia a fuerza al llevarla/sintonizada: no hay armadura natural ni resistencia (volcado `ac` y `resistances` sin cambio) | `engine` (CA), `trait-effects.ts` |
| 3 · Reckless Casting | Texto | — | Tablas aleatorias: texto | — |
| 6 · Alchemical Casting | Texto | — | — | — |
| 10 · Prodigious Inspiration | Contador 1, corto o largo | ✅ | — | `fx` |
| 14 · Controlled Chaos | Texto | — | — | — |

### Technomancy (UA 7, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Texto (armas/herramientas de ciencia ficción) | — | Narrativo | — |
| 3 · Technological Savant | Texto | — | Narrativo | — |
| 6 · Program Spell | Contador 1/largo | ✅ | — | `fx` |
| 10 · Online Casting | Texto | — | — | — |
| 14 · Chained Device | Contador 1/largo | ✅ | — | `fx` |

### Theurgy (UA 33, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Divine Inspiration | Texto | ❌ | Elegir dominio de clérigo (no existe selector de dominio en Mago; los rasgos de dominio de Acolyte/Priest/High Priest dependen de él) | `trait-choices.ts`, `character.ts` |
| 3 · Arcane Initiate | Texto | ❌ | Sustituir conjuros añadidos por conjuros de dominio / lista de clérigo (depende de libro y dominio) | `schoices`, `engine` |
| 3 · Channel Arcana | Rasgo listado sin contador (volcado nivel 3-20: solo `Arcane Recovery`) | ❌ | Usos 1 por descanso corto o largo (2 a nivel 6, más después) y rasgo de dominio de nivel 2 del dominio; sin contador | `pstate`/`fx`, `rest` |
| 3 · Channel Arcana: Divine Arcana | Texto | — | +2 a ataque/CD del siguiente conjuro: texto | — |
| 6 · Arcane Acolyte | Texto | ❌ | Rasgos de dominio nivel 1 sin elegir dominio | igual |
| 10 · Arcane Priest | Texto | ❌ | Rasgos de dominio nivel 6 | igual |
| 14 · Arcane High Priest | Texto | ❌ | Rasgos de dominio nivel 17 | igual |

(Se cuentan 6 ❌ y 1 — en la tabla resumen; el rasgo hijo Divine Arcana es "—".)

### War Magic (Xanathar, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Arcane Deflection | Texto | — | +2 CA / +4 salvación: reacción, texto | — |
| 3 · Tactical Wit | +INT a la iniciativa (regex "bonus to your initiative rolls equal to your Intelligence modifier") | ✅ | — | `trait-effects.ts`, `engine` |
| 6 · Power Surge | Texto | ❌ | Reserva de "power surges" (máx. INT, mín. 1; se reinicia a 1 en descanso largo; +1 al fallar un conjuro con Dispel/Counterspell; +1 si acabas descanso corto con 0): sin contador ni reglas de recarga propias | `pools.ts`, `rest`, `pstate` |
| 10 · Durable Magic | Texto | ❌ | +2 CA y +2 a todas las salvaciones mientras se concentra (hay `state.concentration`, pero la CA/salvaciones no lo leen) | `engine` (CA, saves), `concentration.ts` |
| 14 · Deflecting Shroud | Texto | — | Daño = mitad del nivel: texto | — |

## Patrones comunes

1. **El libro de conjuros es la pieza que más falta**: 8 "Savant" (Abjurer, Conjurer, Diviner,
   Enchanter, Evoker, Illusionist, Necromancer, Transmuter), Ritual Adept, Memorize Spell, Spell
   Mastery, Signature Spells (elección), Arcane Initiate, Prodigious Memory/Inspiration y los
   conjuros "añadidos al libro" dependen todos del mismo cambio: un campo opcional
   `choices.spellbook` (normalizado en `normalizeCharacter`) y tope de preparados distinto del de
   libro (6 + 2/nivel).
2. **Elecciones dentro de rasgos de subclase sin selector**: habilidad (Training in War and Song,
   Enchanting Conversationalist, Scholar), truco (Psionic Devotion), conjuro (Mental Discipline),
   herramientas (Tools of the Inventor), idioma (Onomancy), dominio (Theurgy), Resonants
   (Onomancy), beneficio de la piedra (Transmuter). El sistema `trait-choices.ts`/`species-picks.ts`
   cubre especie/opciones, no rasgos de subclase del Mago (`missing` vacío en todo el volcado).
3. **Estados activables y reservas con dados/PG**: Bladesong, Thought Form, Arcane Ward, Portent y
   Power Surge necesitan estado en `character.state` (hoy `ActiveStateId` es una lista cerrada de 5).
4. **Lo que sí funciona**: contadores por descanso (INT veces, 1 uso, PB/día, corto o largo),
   conjuros concedidos con lanzamiento gratis y recarga (Alter Self, Polymorph, Summon Beast/Fey,
   Glyph of Warding), resistencias (Necrotic, Radiant) e iniciativa (+INT).
5. **Recuperaciones "restaura con un espacio de nivel X+"** (Splintered Summons, Instinctive
   Charm, Illusory Self, Distant Transposition, Event Horizon, Doom of Unlight, Manifest Mind) no se
   modelan; se aceptan como texto, pero ninguna ofrece botón "restaurar gastando un espacio".

## Dudas

1. **Spell Mastery y Signature Spells**: "en tu libro". Sin libro, ¿basta con elegir entre los
   preparados? Habrá que decidirlo al diseñar el libro (ver pregunta de producto).
2. **Arcane Recovery**: el contador es de "1 uso por descanso largo", correcto con el texto; el
   volcado muestra `short=0` (no se recupera en corto), correcto. Dudo si hace falta una acción que
   devuelva espacios (es lo "implementado" según los criterios de esta auditoría).
3. **Extract Name (Onomancy)**: `max=1` en el volcado coincide con INT 12; no he comprobado con INT
   alta que el contador crezca (el lector de texto lo hace en otros rasgos con la misma frase).
4. **Master Artificer** y rasgos 2014 de "nivel 2/6/10/14": el dato los coloca en 3/6/10(/10) por la
   adaptación a 2024; no sé si ese desfase del nivel 14 es intencionado (ver Observaciones).
5. **Lore Mastery** "doble competencia": ¿se prefiere modelarlo como Expertise condicional o
   dejarlo como texto (es una UA descontinuada)?

## Observaciones (errores del volcado y datos)

1. **Volcado de Diviner nivel 10**: `See Invisibility ... atWill` es incorrecto: el texto lo
   limita a "puedes lanzar See Invisibility sin gastar espacio" como una de las tres opciones y
   con un único uso por descanso corto o largo. La ficha lo trata como a voluntad.
2. **Volcado de Necromancer nivel 6**: Undead Thralls no genera `grantedSpells` ni contador para
   Animate Dead, aunque el texto lo pide; es una omisión del lector de texto (Alter Self/Polymorph
   sí se leen).
3. **Illusionist 6**: Summon Beast/Fey aparecen con `free=` pero sin la marca `always` (siempre
   preparados) que sí tienen Counterspell/Dispel Magic de Abjurer; incoherencia menor.
4. **Datos**: `wizard/artificer-ua` coloca "Master Artificer" (el texto dice "14th level") en el
   nivel 10 junto a Superior Artificer; debería ser 14. (El scraper no tiene regla local; ver skill
   `datos` si se corrige.)
5. **Aviso de prueba**: `sheet.warn.traitPickMissing { trait: 'Skillful' }` aparece en todos los
   niveles por la especie del personaje de prueba (humano); no es del Mago.
6. **Los textos de 2014 dicen "2nd level"** (subclase a nivel 2 en la edición vieja) pero se
   conceden a nivel 3; es adaptación a 2024, correcto, pero el texto de la ficha dice "At 2nd
   level".
7. **Prepared Spells y Spellbook**: `review()` en `crules` marca "faltan N conjuros" comparando con
   la columna de preparados; para un mago esto exige el nº de preparados, no 6 + 2/nivel, así que un
   libro real mayor que el preparado se reportaría como `tooManySpells` (`create.issue.tooManySpells`).
