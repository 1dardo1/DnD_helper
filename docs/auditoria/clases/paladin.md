# Auditoría: Paladín (clase base y 13 juramentos)

Fuente: `data/classes.json` (`paladin`), `data/subclasses.json` (`classId` = `paladin`), volcado `docs/auditoria/_volcado/clase-paladin.json`, código en `app/src/app`. Solo lectura.

## Resumen

| Bloque | ✅ | ⚠️ | ❌ | — |
| --- | --- | --- | --- | --- |
| Clase base | 12 | 4 | 1 | 3 |
| Conquest (2014) | 2 | 0 | 0 | 3 |
| Devotion (2024) | 3 | 0 | 0 | 2 |
| Glory (2024) | 4 | 0 | 1 | 1 |
| Heroism UA (2014) | 2 | 0 | 0 | 3 |
| Redemption (2014) | 1 | 0 | 0 | 4 |
| Ancients (2024) | 3 | 1 | 0 | 1 |
| Crown (2014) | 2 | 0 | 0 | 3 |
| Noble Genies (2024) | 4 | 0 | 2 | 1 |
| Spellguard UA (2024) | 2 | 0 | 0 | 4 |
| Watchers (2014) | 2 | 0 | 0 | 3 |
| Treachery UA (2014) | 4 | 0 | 0 | 2 |
| Vengeance (2024) | 3 | 0 | 0 | 3 |
| Oathbreaker UA (2024) | 3 | 0 | 0 | 2 |
| **Total** | **47** | **5** | **4** | **35** |

Los recuentos son de las tablas de abajo; las "Tenets" son texto y no se cuentan.

Lo grave, por orden de impacto:
1. **Blessed Warrior** (Estilo de combate) no pide los 2 trucos de Clérigo y el Paladín no tiene hueco de trucos (`cantripsByLevel: null`).
2. **Aura de protección** solo sale como nota ("+N a salvaciones"); no se suma a la fila de salvaciones de la ficha.
3. **Paladin's Smite**: Divine Smite siempre preparado, pero sin contador del lanzamiento gratuito (1 por descanso largo).
4. **Aura of Alacrity** (Glory): +10 pies de velocidad no aplicados (la velocidad sigue en 30).
5. **Noble Genies**: sin selector de la habilidad de Genie's Splendor ni del tipo de daño de Aura of Elemental Shielding (ni resistencia aplicada).

## Clase base

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Lay On Hands | Contador "Lay On Hands" max = 5×nivel (volcado: 5, 10 ... 100), recarga larga (regla por defecto, `short=0`) | ✅ | Gastar 5 PG para quitar Envenenado o (nv 14) condiciones es texto; el contador sirve para gastar puntos | `core/play/play-state.ts` (FEATURE_USES l.123), `core/play/rest-rules.ts` |
| 1 · Spellcasting | Tabla de preparados (2..15), espacios 2..4/3/3/3/2, CAR, selección limitada al nivel de espacio, intercambio de 1 conjuro tras descanso largo (`spell-swap.ts`, paladin `one`), oath/clase "siempre preparados" fuera del cupo | ✅ | — | `core/creation/spell-choices.ts`, `core/creation/creation-rules.ts` (`spellsFor`, `maxSpellLevel`), `core/play/spell-swap.ts` |
| 1 · Weapon Mastery | 2 armas (`weaponMasterySlots` = 2), selector y aviso `sheet.warn.weaponMastery` | ✅ | El cambio tras descanso largo es texto | `core/rules/engine.ts` l.1255 |
| 2 · Fighting Style | Hueco `paladin:2` tipo `fighting-style`; lista de dotes de categoría `fighting-style`; se guarda en `choices.featSlots` y las opciones en `featChoices`. Defense (+1 CA) está leído | ⚠️ | Solo se ofrecen las dotes de la lista; la opción de clase "Blessed Warrior" no existe como opción 2024 (solo la dote 2014 con el mismo nombre). Los demás estilos dependen de la auditoría de dotes | `core/creation/creation-rules.ts` (`featSlots`, `featsForSlot`), `features/creation/character-create.ts`, `features/level-up/level-up.ts` |
| 2 · Fighting Style: Blessed Warrior | Aparece como dote 2014 en la lista; sin selector | ❌ | Faltan: selector de 2 trucos de la lista de Clérigo, que cuenten como conjuros de Paladín con CAR, y sustitución de 1 truco al subir de nivel. `FEAT_PICKS` no tiene `blessed-warrior` ni `druidic-warrior`; `parsed.spells = []`; el Paladín no tiene `cantripsByLevel` (null) donde alojarlos | `core/rules/feat-effects.ts` (FEAT_PICKS l.~480), `core/creation/spell-choices.ts` |
| 2 · Paladin's Smite | Divine Smite siempre preparado (`grantedSpells`: "Divine Smite [class:Paladin's Smite] always"); nota de ataque `divineSmite` (gasta espacio) | ⚠️ | Falta el contador del lanzamiento gratuito (1 por descanso largo): no está en `FEATURE_USES` (no aparece en `counters`) y `engine.ts` l.~1109 pone `freeKey = null` para rasgos de clase | `core/play/play-state.ts`, `core/rules/engine.ts` l.~1109, `core/rules/feature-stats.ts` l.556 |
| 3 · Channel Divinity | Contador 2 (nv 3) → 3 (nv 11) desde la columna de la tabla; descanso corto recupera 1, largo todas (`rest-rules.ts`). Nota con la CD de salvación | ✅ | Divine Sense es texto (gasta un uso) | `core/play/rest-rules.ts` l.24, `core/rules/feature-stats.ts` l.520 |
| 3 · Paladin Subclass | Selector de juramento (13), aviso `noSubclass` mientras falta | ✅ | — | `features/creation`, `features/level-up` |
| 4/8/12/16 · Ability Score Improvement | Huecos `asi` por la tabla de progresión | ✅ | — | `core/creation/creation-rules.ts` |
| 5 · Extra Attack | Sin lógica propia | — | Texto basta (el motor no modela ataques múltiples para ninguna clase) | — |
| 5 · Faithful Steed | Find Steed siempre preparado y contador "Faithful Steed" (1, largo) | ⚠️ | Contador y conjuro van separados: lanzar Find Steed desde el libro no consume el contador (`freeKey` null en clase) | `core/play/play-state.ts` l.130, `core/rules/engine.ts` l.~1109 |
| 6 · Aura of Protection | Nota "+N a salvaciones, aura r pies" (N = mod CAR mín. 1; r = 30 desde nv 18) | ⚠️ | No se suma al modificador de las salvaciones (`savingThrows` en `engine.ts` l.249-259 solo usa característica + competencia). Al ser siempre aplicable a uno mismo, debería sumarse o mostrarse como bono condicional en la fila | `core/rules/engine.ts` l.249, `core/rules/feature-stats.ts` l.496 |
| 9 · Abjure Foes | Nota: acción, gasta Channel Divinity, "afecta a N criaturas", CD de conjuro | ✅ | — | `core/rules/feature-stats.ts` l.510 |
| 10 · Aura of Courage | Texto | — | Inmunidad a Asustado en el aura: el motor no modela inmunidades a condiciones | — |
| 11 · Radiant Strikes | Nota "+1d8 radiante" en cada fila de ataque cuerpo a cuerpo | ✅ | El dado no se suma al daño de la fila, va como nota (convención del proyecto) | `core/rules/attacks.ts` l.252-265 |
| 14 · Restoring Touch | Texto | — | Gasto de 5 PG del pozo por condición: texto basta | — |
| 18 · Aura Expansion | Radio 30 en la nota del aura | ✅ | — | `core/rules/feature-stats.ts` l.500 |
| 19 · Epic Boon | Hueco `epic-boon` | ✅ | — | `core/creation/creation-rules.ts` |
| Elección de conjuros (creación / subida) | Preparados por tabla, limitados por nivel de espacio; cambio de 1 al descanso | ✅ | — | `core/creation/spell-choices.ts`, `features/level-up` |
| Oath spells (común) | Se activan por nivel de Paladín (3/5/9/13/17), siempre preparados, no cuentan en el cupo | ✅ | — | `core/rules/engine.ts` |

## Juramentos

Todos comparten: Channel Divinity de clase (contador ✅, 2/3 usos, corto 1 / largo todas), conjuros de juramento ✅ (volcado verificado en niveles 3, 5, 10, 14, 17 y 20 para Devotion, Conquest y Oathbreaker; el resto tiene el mismo mecanismo y su lista a nivel 20 coincide con `spells` de los datos). Las opciones de Channel Divinity de cada juramento son texto; solo gastan un uso del contador común.

### Oath of Conquest (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros siempre preparados por nivel | ✅ | — | `core/rules/engine.ts` |
| 3 · Channel Divinity (Conquering Presence, Guided Strike) | Texto; gasta contador común | — | Texto basta (+10 al ataque es situacional) | — |
| 7 · Aura of Conquest | Texto | — | Texto basta (radio 30 en nv 18) | — |
| 15 · Scornful Rebuke | Texto | — | Texto basta (daño = mod CAR) | — |
| 20 · Invincible Conqueror | Contador 1, descanso largo | ✅ | Críticos 19-20 y resistencia a todo son temporales, texto | `core/rules/feat-effects.ts` (featUses) |

### Oath of Devotion (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Sacred Weapon | Nota: libre, gasta Channel Divinity, "+N al ataque" (mod CAR mín. 1) | ✅ | No suma al bono de ataque (situacional, arma elegida) | `core/rules/feature-stats.ts` l.528 |
| 7 · Aura of Devotion | Texto | — | Inmunidad a Hechizado: no modelada | — |
| 15 · Smite of Protection | Texto | — | Media cobertura, texto | — |
| 20 · Holy Nimbus | Contador 1, largo | ✅ | Restaurar con espacio de nivel 5: texto | — |

### Oath of Glory (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros (incluye Yolande's Regal Presence) | ✅ | — | — |
| 3 · Inspiring Smite | Nota: "2d8+nivel PG temporales", gasta Channel Divinity | ✅ | — | `core/rules/feature-stats.ts` l.538 |
| 3 · Peerless Athlete | Texto | — | Texto basta | — |
| 7 · Aura of Alacrity | Texto | ❌ | "Your Speed increases by 10 feet" es incondicional para el propio Paladín y no se aplica: el volcado da `speed.walk = 30` en nv 7-20. Falta un lector de "Your Speed increases by N feet" (hoy solo `speedTo`, `armorSpeed`, dotes) | `core/rules/trait-effects.ts`, `core/rules/engine.ts` l.~370 |
| 15 · Glorious Defense | Contador = mod CAR (mín. 1), largo (volcado: 2); nota "+N a la CA" | ✅ | — | `core/rules/feature-stats.ts` l.547 |
| 20 · Living Legend | Contador 1, largo | ✅ | — | — |

### Oath of Heroism (UA, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Channel Divinity (Legendary Strike, Peerless Athlete) | Texto | — | Críticos 19-20 temporales: texto | — |
| 7 · Mighty Deed | Texto | — | Reutilizable cada turno; texto basta | — |
| 15 · Glorious Defense | Texto (sin contador, no tiene usos limitados) | — | Texto basta | — |
| 20 · Living Myth | Contador 1, largo | ✅ | — | — |

### Oath of Redemption (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Channel Divinity (Emissary of Peace, Rebuke the Violent) | Texto | — | Texto basta | — |
| 7 · Aura of the Guardian | Texto | — | Reacción sin límite de usos | — |
| 15 · Protective Spirit | Texto | — | Curación 1d6+mitad de nivel al final de turno: texto | — |
| 20 · Emissary of Redemption | Texto | — | Se pierde "hasta un descanso largo" solo por contra una criatura; no es un contador simple | — |

### Oath of the Ancients (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Nature's Wrath | Texto; gasta Channel Divinity | — | Texto basta | — |
| 7 · Aura of Warding | Texto | ⚠️ | Resistencia a Necrótico/Psíquico/Radiante para el propio Paladín (siempre que no esté incapacitado) no se refleja: `resistances = []` en el volcado. Es condicionada al aura, pero para uno mismo es permanente | `core/rules/feat-effects.ts` (lector de resistencias), `core/rules/engine.ts` |
| 15 · Undying Sentinel | Contador 1, largo | ✅ | — | — |
| 20 · Elder Champion | Contador 1, largo | ✅ | Regeneración y conjuros como acción adicional: texto | — |

### Oath of the Crown (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Channel Divinity (Champion Challenge, Turn the Tide) | Texto | — | Texto basta | — |
| 7 · Divine Allegiance | Texto | — | Texto basta | — |
| 15 · Unyielding Saint | Texto | — | Ventaja contra Paralizado/Aturdido: texto | — |
| 20 · Exalted Champion | Contador 1, largo | ✅ | — | — |

### Oath of the Noble Genies (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Genie Spells | 10 conjuros (incluye Elementalism, Contact Other Plane...) | ✅ | — | — |
| 3 · Elemental Smite | Texto; gasta Channel Divinity | — | Elección de efecto en el momento: texto | — |
| 3 · Genie's Splendor (CA) | Sin armadura: 10 + DES + CAR (CA 14 en el volcado; admite escudo) | ✅ | — | `core/rules/engine.ts` l.345-360 |
| 3 · Genie's Splendor (habilidad) | "Proficiency in one of: Acrobatics, Intimidation, Performance, Persuasion" | ❌ | Sin selector: `missing = []`, `restPicks = []` y no se aplica ninguna competencia. Falta una elección de 1 entre 4 habilidades guardada en `traitPicks` | `core/rules/trait-choices.ts` (solo rasgos de especie), `core/rules/engine.ts` |
| 7 · Aura of Elemental Shielding | Texto | ❌ | Elección del tipo (Ácido/Frío/Fuego/Relámpago/Trueno), cambiable cada turno, sin selector; `resistances = []` | `core/rules/trait-choices.ts`, `core/play/trait-rest-dialog`(estado activo) |
| 15 · Elemental Rebuke | Contador = mod CAR (mín. 1), largo (2 en el volcado) | ✅ | — | — |
| 20 · Noble Scion | Contador 1, largo | ✅ | Vuelo 60: temporal, texto | — |

### Oath of the Spellguard (UA, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Guardian Bond | Texto; gasta Channel Divinity | — | Texto basta | — |
| 3 · Spellguard Strike | Texto | — | Reacción sin límite | — |
| 7 · Aura of Concentration | Texto | — | Ventaja a salvaciones de concentración dentro del aura: texto | — |
| 15 · Spell-Breaking Blade | Texto | — | Texto basta | — |
| 20 · Eternal Spellguard | Contador 1, largo | ✅ | — | — |

### Oath of the Watchers (2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Channel Divinity (Watcher's Will, Abjure the Extraplanar) | Texto | — | Texto basta | — |
| 7 · Aura of the Sentinel | Texto | — | Bono de iniciativa = PB para ti y aliados: no se suma a la iniciativa de la ficha (condicional al aura, texto basta) | — |
| 15 · Vigilant Rebuke | Texto | — | Sin límite de usos | — |
| 20 · Mortal Bulwark | Contador 1, largo | ✅ | Restaurar con espacio de nivel 5: texto | — |

### Oath of Treachery (UA, 2014)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros | ✅ | — | — |
| 3 · Channel Divinity (Conjure Duplicate, Poison Strike) | Texto | — | Texto basta | — |
| 7 · Aura of Treachery | Contador 3, recupera todo en descanso corto y largo (volcado `short="all"`) | ✅ | — | `core/rules/feat-effects.ts` |
| 15 · Blackguard's Escape | Contador 1, corto o largo | ✅ | — | — |
| 20 · Icon of Deceit | Contador 1, largo | ✅ | — | — |
| 7 · Cull the Herd (ventaja) | Texto | — | Texto basta | — |

### Oath of Vengeance (2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oath Spells | 10 conjuros; Hunter's Mark preparado | ✅ | — | — |
| 3 · Vow of Enmity | Texto; gasta Channel Divinity | — | Ventaja contra un objetivo: texto | — |
| 3 · (estado activo Hunter's Mark) | `activeStates = ['huntersMark']` por Hunter's Mark como conjuro de juramento | ✅ | Ver Observaciones | `core/rules/active-states.ts` l.110 |
| 7 · Relentless Avenger | Texto | — | Texto basta | — |
| 15 · Soul of Vengeance | Texto | — | Texto basta | — |
| 20 · Avenging Angel | Contador 1, largo | ✅ | — | — |

### Oathbreaker (UA, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Oathbreaker Spells | 10 conjuros | ✅ | — | — |
| 3 · Conjure Undead / Dreadful Aspect | Texto; gastan Channel Divinity | — | Texto basta (criaturas invocadas: ver CLAUDE.md) | — |
| 7 · Aura of Hate | Texto | — | Daño necrótico = mod CAR: sin nota numérica (podría añadirse en `feature-stats`) | `core/rules/feature-stats.ts` |
| 15 · Supernatural Resistance | Resistencia a Contundente/Perforante/Cortante en `resistances` | ✅ | — | `core/rules/feat-effects.ts` |
| 20 · Dread Lord | Contador 1, largo | ✅ | — | — |

## Patrones comunes

- Los usos "una vez por descanso largo" de nivel 15/20 de los juramentos se detectan bien por texto (`featUses`) en todos los casos del volcado; el contador y la recarga son correctos. La opción de "restaurar con un espacio de nivel 5" no existe como acción en ningún juramento 2024.
- Auras que dan bonos a uno mismo (Aura of Protection, Aura of Alacrity, Aura of Warding, Elemental Shielding): el motor las trata como notas y no los aplica a salvaciones, velocidad o resistencias, aunque para el propio Paladín sean permanentes mientras no esté incapacitado.
- Las elecciones dentro de rasgos de clase/subclase (habilidad de Genie's Splendor, tipo de Elemental Shielding, trucos de Blessed Warrior) no tienen selector: `trait-choices.ts` y `species-picks.ts` solo cubren rasgos de especie, y `FEAT_PICKS` solo las dotes listadas.
- Los conjuros gratuitos concedidos por clase no enlazan con su contador (`freeKey` null para `kind === 'class'`), así que Find Steed / Divine Smite no consumen su uso gratuito (Faithful Steed tiene contador propio sin enlace; Paladin's Smite no tiene contador).
- Las inmunidades a condiciones (Aura of Courage, Aura of Devotion) no se modelan en `Sheet`.

## Dudas

- 2024 "Blessed Warrior" es opción del propio rasgo "Fighting Style"; en `data/feats.json` solo existe la dote de 2014 (`Blessed Warrior`, `prerequisite: Fighting Style Feature`). No consta si hay que ofrecerla como opción propia del Paladín 2024.
- Texto de Oath of Glory (2024) "Yolande's Regal Presence" figura como conjuro en el volcado: no verifiqué que exista en `data/spells.json` con ese nombre (no se pudo comprobar sin ejecutar el motor).
- Se asumió que "Aura of Protection" debe sumarse a las salvaciones del propio Paladín; el texto dice "You and your allies in the aura", lo que incluye al Paladín.
- No verifiqué niveles 9 y 13 de conjuros de juramento (el volcado solo trae 3, 5, 6, 7, 10, 11, 14, 15, 17, 18, 20); en 10 y 14 ya aparecen los de 9 y 13, así que la puerta por nivel parece correcta.

## Observaciones (errores del volcado)

- El volcado muestra `Extra Attack` en `features` pero no hay ningún campo de ataques múltiples: es normal en todas las clases.
- `Oath of Vengeance` aparece con `activeStates: ['huntersMark']` desde el nivel 3: el estado se activa porque el conjuro Hunter's Mark está siempre preparado por juramento, no por rasgo de Explorador (puede ofrecer un conmutador inesperado; es correcto como conjuro de concentración).
- Todos los niveles muestran `sheet.warn.traitPickMissing: Skillful` y `sheet.warn.weaponMastery(None)`: son del personaje de prueba (humano), no del Paladín.
- `Oath of the Noble Genies` es el único juramento con `ac = 14` por Genie's Splendor; correcto con DES 14 / CAR 14.
- `Oath of Devotion` / `Oath of the Watchers` etc. repiten "Channel Divinity" como rasgo de subclase en los juramentos 2014 y en 2024 cada opción es su propio rasgo: no hay diferencia funcional.
- Oathbreaker: el volcado da la resistencia permanente a B/P/S, que en el texto es incondicional ("You gain Resistance...") - correcto.
