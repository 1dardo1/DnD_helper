# Auditoría: Hechicero (Sorcerer)

Solo lectura. Contra `data/classes.json` (`sorcerer`, 2024 PHB), `data/subclasses.json` (21 subclases con `classId` sorcerer: 10 de 2024 y 11 de 2014/UA, ver nota), `data/options.json` (Metamagia) y el volcado `docs/auditoria/_volcado/clase-sorcerer.json`.

Nota: en `data/` hay 21 subclases de Hechicero: 2024 = aberrant, ancestral-ua, clockwork, defiled-ua, demonic-ua14, draconic, faerzress-ua, shadow, spellfire, wild-magic (10); 2014/UA = divine-soul, favored-soul-revisited-ua, favored-soul-ua, giant-soul, lunar, phoenix, psionic-soul, pyromancy, sea, stone, storm (11). Las de 2014 se ofrecen al nivel 3 aunque su texto dice "1st level".

## Resumen

Recuento sobre 100 rasgos auditados (clase base + 21 subclases):

| Estado | Total |
| --- | --- |
| ✅ completo | 49 |
| ⚠️ parcial | 9 |
| ❌ falta | 22 |
| — texto basta | 45 |

Por bloque (✅/⚠️/❌/—): Base 6/3/1/1 · Aberrant 3/1/0/2 · Ancestral 1/0/2/4 · Clockwork 4/0/0/1 · Defiled 2/0/1/2 · Demonic 3/0/0/2 · Divine Soul 2/0/1/2 · Draconic 3/0/2/0 · Faerzress 4/0/0/3 · Favored Soul Revisited 3/0/3/0 · Favored Soul UA 0/0/2/3 · Giant Soul 2/0/2/1 · Lunar 3/1/1/1 · Phoenix 2/1/0/2 · Psionic Soul 0/0/2/4 · Pyromancy 1/1/0/2 · Sea 3/0/0/2 · Shadow 3/0/1/1 · Spellfire 2/0/1/2 · Stone 0/1/2/3 · Storm 1/1/0/4 · Wild Magic 1/0/1/3.

Lo más grave: no hay selector para las elecciones de subclase (afinidad elemental del Dracónico, afinidad de Alma Divina, tipo de gigante, dominio del Alma Favorecida, fase lunar), la ampliación de la lista de conjuros (Divine Magic/Metal Magic) no existe y `subclass.spells` mal leído concede conjuros que no son "siempre preparados" (Piedra, Lunar). Tampoco hay conversión espacios de conjuro y Puntos de Hechicería.

## Clase base

Contador de Innate Sorcery: `core/play/play-state.ts` (FEATURE_USES, 2 usos, largo). Estado activable `innateSorcery`: `core/rules/active-states.ts` (CD +1 en `engine.ts` ~l.529). Puntos de Hechicería: columna de la tabla, `rest-rules.ts` (`'sorcery points': { short: 0 }`). Metamagia: `core/creation/creation-rules.ts` (`OPTION_COUNT_BY_LEVEL.metamagic` = 2/4/6 a niveles 2/10/17), opciones en `data/options.json` (10, todas 2024).

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Spellcasting | CHA, trucos 4/5/6, preparados 2→22, espacios completos; el volcado coincide con la tabla en todos los niveles | ✅ | Nada. Cambio de 1 conjuro al subir de nivel: `spell-swap.ts` (`levelUp: 'one'`) | `core/rules/engine.ts`, `core/creation/spell-choices.ts`, `core/play/spell-swap.ts` |
| 1/2/… · Selección de conjuros en creación y subida | Límite de trucos/preparados por nivel, solo lista de hechicero | ✅ | Solo lista `sorcerer` (ver Divine Soul/Favored Soul/Stone, que la amplían: ❌ en sus tablas) | `core/creation/spell-choices.ts`, `core/creation/level-up.ts` |
| 1 · Innate Sorcery | Contador 2/descanso largo, estado activable que gasta un uso, CD +1 (`sc.saveDc`), se apaga en descanso corto/largo | ⚠️ | "Ventaja en tiradas de ataque de conjuros de hechicero" no sale en ninguna parte (solo la CD en `combat.stat.innateSorcery`). Duración de 1 minuto no se cuenta | `core/rules/active-states.ts`, `core/rules/feature-stats.ts`, `engine.ts` |
| 2 · Font of Magic: Puntos de Hechicería | Contador con máximo de la tabla (2…20), recarga solo en largo | ✅ | — | `core/play/play-state.ts`, `rest-rules.ts` |
| 2 · Font of Magic: convertir espacios ↔ PS | Texto con tabla de coste (1:2, 2:3, 3:5, 4:6, 5:7; nivel mínimo 2/3/5/7/9) | ❌ | No hay acción de "gastar espacio → ganar PS" ni "PS → crear espacio" (grep de `sorcery` en `app/src` no muestra lógica; se haría a mano restando contadores). Los espacios creados que desaparecen en descanso largo tampoco | (ninguno; falta) |
| 2/10/17 · Metamagic | Selector de opciones (2→4→6) en creación y subida, guardadas en `choices.options`; 10 opciones de `options.json` | ✅ | Sustituir 1 opción por nivel se hace desmarcando y marcando otra; no hay aviso. Efectos de cada opción: texto | `core/creation/creation-rules.ts`, `features/creation`, `features/level-up` |
| 3 · Sorcerer Subclass | Selector al nivel 3 (21 subclases) | ✅ | — | creación / subida de nivel |
| 4/8/12/16 · ASI; 19 · Epic Boon | Ranuras de dote `sorcerer:N` | ✅ | (No verificado en pantalla; el volcado lista "Epic Boon" y "Ability Score Improvement") | `core/creation/level-up.ts` |
| 5 · Sorcerous Restoration | Contador 1/largo (clave `trait:class:sorcerous-restoration`), nota "en descanso corto: recuperas hasta {n} PS" (n = nivel/2) | ⚠️ | El descanso corto no recupera los PS: `'sorcery points': { short: 0 }` es fijo y el diálogo de descanso no ofrece "recuperar hasta nivel/2" ni consume el uso | `core/play/rest-rules.ts`, `rest-choices.ts`, `feature-stats.ts` |
| 7 · Sorcery Incarnate | Texto | ⚠️ | "Sin usos de Innate Sorcery, actívalo gastando 2 PS": `switchState` no hace nada con 0 usos (`spendOne` devuelve null). "Hasta 2 Metamagias por conjuro" es texto | `core/play/active-play.ts` |
| 20 · Arcane Apotheosis | Texto | — | Metamagia gratis una vez por turno con Innate Sorcery activa: situacional | — |

## Subclases 2024

### Aberrant Sorcery (PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psionic Spells | 11 conjuros siempre preparados por nivel 3/5/7/9 (volcado correcto) | ✅ | — | `subclass.spells`, `engine.ts` (`featSpells`) |
| 3 · Telepathic Speech | Texto | — | — | — |
| 6 · Psionic Sorcery | Lanzar con PS sin componentes | — | Texto | — |
| 6 · Psychic Defenses | Resistencia a Psíquico (volcado) | ✅ | Ventaja contra Hechizado/Asustado: texto | `trait-effects.ts` |
| 14 · Revelation in Flesh | Elige 1 beneficio por cada PS (nadar, volar, ver invisible, forma de gusano) | ⚠️ | Error: el motor da `fly 30` permanente desde nivel 14 (lee "Fly Speed equal to your Speed" sin ver que es una opción temporal de 10 min, 1 PS). Sobra | `core/rules/trait-effects.ts` (~l.222) |
| 18 · Warping Implosion | Contador 1/largo (restaurar con 5 PS: texto) | ✅ | — | `feat-effects.ts` |

### Ancestral Sorcery (UA6 2025)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Ancestor's Lore | Texto; no hay selector | ❌ | Elige 1 competencia entre Arcana/History/Investigation/Nature/Religion (sin selector, no sale en habilidades). Bonus CHA a pruebas de INT: texto | `trait-effects.ts`, `trait-picks.ts` (solo especie) |
| 3 · Ancestral Spells | 12 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 3 · Visage of the Ancestor | Texto | — | — | — |
| 6 · Superior Spell Disruption | Texto | ❌ | Counterspell y Dispel Magic "siempre preparados" no se conceden (no hay tabla); cast gratis una vez cada uno por descanso largo sin contador | `feat-effects.ts` |
| 14 · Ancestral Majesty | Texto | — | — | — |
| 14 · Steady Spellcaster | Texto | — | Concentración no se rompe por daño en conjuros de hechicero (el motor de concentración no lo lee) | `core/play/concentration.ts` |
| 18 · Ancestor's Ward | Texto | — | — | — |

### Clockwork Sorcery (PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Clockwork Spells | 10 conjuros siempre preparados | ✅ | Tabla "Manifestations of Order": texto | `subclass.spells` |
| 3 · Restore Balance | Contador CHA (mín. 1)/largo (volcado: 2) | ✅ | — | `feat-effects.ts` |
| 6 · Bastion of Law | Texto | — | 1-5 PS, d8s de protección | — |
| 14 · Trance of Order | Contador 1/largo | ✅ | Restaurar con 5 PS: texto | idem |
| 18 · Clockwork Cavalcade | Contador 1/largo | ✅ | Restaurar con 7 PS: texto | idem |

### Defiled Sorcery (UA7 2025)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Defile and Empower | Contador 1/largo (llamado "Defile and Empower", clave `life-steal`) | ✅ | Etiqueta de contador confusa (ver Observaciones) | `feat-effects.ts` |
| 3 · Defiler Spells | 10 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 6 · Corrupted Caster | Texto | — | PT por d6 al crear espacio | — |
| 14 · Withering Aura | Texto | — | — | — |
| 18 · Superior Defiler | Texto | ❌ | Inmunidad a Envenenado y Agotamiento: `Sheet` no tiene modelo de inmunidades | `core/rules/sheet.ts`, `trait-effects.ts` |

### Demonic Sorcery (UA14, 18-06-2026)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Abyssal Rupture | Texto | — | Ataque de conjuro Demonic Lash 1d8 no sale en Ataques | — |
| 3 · Demonic Spells | 10 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 6 · Abyssal Realm | Texto | — | — | — |
| 14 · Abyssal Conduit | Summon Fiend siempre preparado (volcado: `[subclass:Abyssal Conduit] always`) | ✅ | — | `feat-effects.ts` |
| 18 · Abyssal Explosion | Contador 1/largo | ✅ | Restaurar con 7 PS: texto | idem |

### Draconic Sorcery (PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Draconic Resilience | PG +3 al nivel 3 y +1 por nivel (volcado: 23, 44, 100 en niveles 3, 6, 14: correcto). CA 10+DES+CAR sin armadura (volcado: 14 con DES 14, CAR 14: correcto) | ✅ | — | `engine.ts` ~l.316 y ~l.346 |
| 3 · Draconic Spells | 10 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 6 · Elemental Affinity | Solo una nota "+CAR a una tirada de daño" (`feature-stats.ts`) | ❌ | Sin selector de tipo (Ácido/Frío/Fuego/Relámpago/Veneno), sin resistencia aplicada (`resistances` vacío en todos los niveles), la nota no sabe de qué tipo. Hace falta una elección de subclase guardada en el personaje y leída por el motor | `feature-stats.ts` l.636-642; falta selector en `features/creation` y `level-up`; `Character.choices` no tiene campo para elecciones de rasgos de clase |
| 14 · Dragon Wings | Contador 1/largo | ✅ | Fly 60 y restaurar con 3 PS: texto | `feat-effects.ts` |
| 18 · Dragon Companion | Summon Dragon queda "siempre preparado" | ❌ | Falta el lanzamiento gratis 1/largo (no hay contador ni `freeKey`) y quitar el componente material | `feat-effects.ts` |

### Faerzress Sorcery (UA16, 10-09-2026)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Faerzress Spells | 10 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 3 · Faerzress Zone | Texto | — | 3 PS | — |
| 3 · Immunity to Faerzress | Texto | — | — | — |
| 6 · Faerzress Affinity | Resistencia a Relámpago + Visión en la oscuridad 60 (volcado) | ✅ | Texto de "+30 si ya tiene Darkvision" no verificado | `trait-effects.ts` |
| 14 · Faerzress Spell | Texto | — | — | — |
| 14 · Faerzress Step | Teleport siempre preparado + lanzamiento gratis 1/largo (contador "Teleport") | ✅ | — | `feat-effects.ts` |
| 18 · Faerzress Form | Contador 1/largo | ✅ | Resistencias/vuelo de la forma: texto; restaurar con 7 PS: texto | idem |

### Shadow Sorcery (Ravenloft)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Shadow Spells | 10 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 3 · Power of Shadow | Darkvision 120 (volcado) + contador Strength of the Grave 1/largo | ✅ | Blindsight 10 no aparece en el volcado (que solo muestra `darkvision`; no verificado en la hoja) | `trait-effects.ts` |
| 6 · Beasts of Ill Omen | Texto | ❌ | Summon Beast gratis por 3 PS (sin preparar): no se concede como conjuro gratis | `feat-effects.ts` |
| 14 · Shadow Walk | Texto | — | — | — |
| 18 · Umbral Form | Contador 1/largo | ✅ | Restaurar con 6 PS: texto | idem |

### Spellfire Sorcery (Heroes of Faerûn)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Spellfire Burst | Texto | — | — | — |
| 3 · Spellfire Spells | 10 conjuros siempre preparados | ✅ | — | `subclass.spells` |
| 6 · Absorb Spells | Texto | ❌ | Counterspell siempre preparado no se concede (el volcado a nivel 6 no lo lista) | `feat-effects.ts` |
| 14 · Honed Spellfire | Texto | — | — | — |
| 18 · Crown of Spellfire | Contador 1/largo | ✅ | Fly 60 y restaurar con 5 PS: texto | idem |

### Wild Magic Sorcery (PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Wild Magic Surge | Texto (tabla d100) | — | `feature-coverage.spec.ts` ya lo declara "roll on a table" | — |
| 3 · Tides of Chaos | Texto | ❌ | Sin contador: 1 uso que se recarga en descanso largo O al lanzar un conjuro de hechicero con espacio (con tirada obligatoria en la tabla) | `feat-effects.ts`, `play-state.ts` |
| 6 · Bend Luck | Texto | — | 1 PS + 1d4 | declarado en `feature-coverage.spec.ts` |
| 14 · Controlled Chaos | Texto | — | — | — |
| 18 · Tamed Surge | Contador 1/largo | ✅ | — | `effects-audit.spec.ts` |

### Ancestral/Defiled/Demonic/Faerzress son UA; las demás de 2024 son oficiales.

## Subclases 2014 / UA

### Divine Soul (Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Divine Magic | `grantedSpells` vacío; `missing` vacío | ❌ | (a) sin selector de afinidad (Bueno/Maligno/Ley/Caos/Neutral) y sin conceder su conjuro (Cure Wounds, Inflict Wounds, Bless, Bane, Protection from Evil and Good) como conjunto conocido extra; (b) al elegir trucos/conjuros de hechicero no se ofrece la lista de clérigo (`spellListOf` y `spell-choices.ts` usan solo `sorcerer`; `casterSpellLists` solo mira `sc.spellList`) | `core/creation/spell-choices.ts`, `creation-rules.ts` (`spellListOf`), `engine.ts` l.683 |
| 3 · Favored by the Gods | Contador 1/corto o largo | ✅ | — | `feat-effects.ts` |
| 6 · Empowered Healing | Texto | — | — | — |
| 14 · Angelic Form | Texto | — | Vuelo 30 con las alas (activable): texto | — |
| 18 · Unearthly Recovery | Contador 1/largo | ✅ | — | `feat-effects.ts` |

### Favored Soul, Revisited (UA28)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Divine Magic | Texto | ❌ | Lista de clérigo no disponible al elegir conjuros (como Divine Soul) | idem |
| 3 · Supernatural Resilience | PG +1 y +1 por nivel (volcado: bonus 4 en nivel 6) | ✅ | Ojo: la tabla da +1 al "nivel 1" y el motor lo cuenta desde el 3 (ver Dudas) | `engine.ts` ~l.316 |
| 3 · Favored by the Gods | Contador 1/corto o largo | ✅ | — | `feat-effects.ts` |
| 6 · Blessed Countenance | Texto | ❌ | Elige una cualidad y duplica la competencia en pruebas de CAR: sin elección ni efecto en las habilidades de CAR | `engine.ts`, `trait-effects.ts` |
| 14 · Divine Purity | Texto | ❌ | Inmune a enfermedad, daño de veneno y estado Envenenado: no hay modelo de inmunidades (`resistances` vacío) | `core/rules/sheet.ts` |
| 18 · Unearthly Recovery | Contador 1/largo | ✅ | — | `feat-effects.ts` |

### Favored Soul (UA3)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Chosen of the Gods | Texto | ❌ | Sin selector de dominio de clérigo ni sus conjuros (nivel 1/3/5/7/9 de dominio) como conocidos extra | `engine.ts`, `spell-choices.ts` |
| 3 · Bonus Proficiencies | Texto | ❌ | Armadura ligera/media/escudos/armas sencillas: no se suma a las competencias (la lista sale solo de `first?.proficiencies` de la clase) | `engine.ts` l.623 |
| 6 · Extra Attack | Texto | — | No hay lector de Extra Attack para ninguna clase; es solo texto | — |
| 14 · Divine Wings | Texto | — | Vuelo = velocidad, activable | — |
| 18 · Power of the Chosen | Texto | — | — | — |

### Giant Soul (UA51)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Jotun Resilience | PG +1 y +1 por nivel (volcado: 21 en 3, 140 en 20) | ✅ | — | `engine.ts` |
| 3 · Mark of the Ordning | Texto con tabla de 6 tipos de gigante | ❌ | Sin selector del tipo ni concesión de 2 conjuros (nivel 1) + 1 (nivel 3) que cuentan como de hechicero sin gastar conocidos (`grantedSpells` vacío) | `feat-effects.ts`, falta selector |
| 6 · Soul of Lost Ostoria | Texto | — | Depende del tipo elegido; texto | — |
| 14 · Rage of Fallen Ostoria | Contador 1/corto o largo | ✅ | — | `feat-effects.ts` |
| 18 · Blessing of the All Father | Texto | ❌ | CON +2 (máx. 22) no se aplica (no hay lector de "score increases by"); el contador de Rage queda en 1 cuando debería ser 2 desde el nivel 18 (`feat-effects.ts` descarta recuentos que crecen con el nivel) | `engine.ts`, `feat-effects.ts` l.327-360 |

### Lunar Sorcery (Dragonlance)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Lunar Embodiment | `subclass.spells` mal leído: "Shield Ray of Sickness Color Spray" etc. como **un** conjuro "siempre preparado" (id inexistente) | ❌ | La tabla tiene 3 columnas (Full/New/Crescent) y se fusionó. Falta: la fase elegida tras cada descanso largo (restPick), 1 conjuro gratis de nivel 1 por fase una vez por descanso, y conceder los conjuros de la columna de la fase. Falta también el conjuro de nivel 1 de la fila "1st" | datos `data/subclasses.json` (regla del scraper), `feat-effects.ts`, `rest-choices.ts` |
| 3 · Moon Fire | Sacred Flame concedido (volcado) | ✅ | Objetivo extra: texto | `subclass.spells`/`featSpells` |
| 6 · Lunar Boons | Contador = bonificador de competencia (3→6)/largo | ✅ | Reducir el coste de Metamagia: manual | `feat-effects.ts` |
| 6 · Waxing and Waning | Texto | — | — | — |
| 14 · Lunar Empowerment | Resistencia a Necrótico y Radiante (volcado desde nivel 14) | ⚠️ | Error: solo vale con la fase Crescent Moon; se aplica siempre | `trait-effects.ts` |
| 18 · Lunar Phenomenon | Contador 1/largo | ✅ | El texto da un uso por beneficio (3 fases) y el contador solo tiene 1; restaurar con 5 PS: texto | `feat-effects.ts` |

### Phoenix Sorcery (UA28)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Ignite | Texto | — | — | — |
| 3 · Mantle of Flame | Contador 1/largo | ✅ | — | `feat-effects.ts` |
| 6 · Phoenix Spark | Contador 1/largo | ✅ | — | idem |
| 14 · Nourishing Fire | Texto | — | — | — |
| 18 · Form of the Phoenix | Texto | ⚠️ | Error: velocidad de vuelo 40 permanente (solo con Mantle of Flame activo) | `trait-effects.ts` |

### Psionic Soul (UA71)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Psionic Origin | Texto (tabla d10) | — | — | — |
| 3 · Psionic Talent | Texto | ❌ | Dado de talento psiónico (d6→d8 nv5→d10 nv11→d12 nv17) que baja/sube según la tirada y se reinicia en largo: no existe en `pools.ts` (solo hay Psionic Energy Dice de Soulknife/Psi Warrior) | `core/rules/pools.ts` |
| 3 · Psi Replenishment | Texto | ❌ | Contador 1/largo (`counters` vacío en todos los niveles) | `feat-effects.ts` |
| 6 · Psychic Strike | Texto | — | Depende del dado | — |
| 14 · Mind Over Body | Texto | — | — | — |
| 18 · Psychic Aura | Texto | — | — | — |

### Pyromancy (Plane Shift: Kaladesh)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Heart of Fire | Texto | — | — | — |
| 6 · Fire in the Veins | Resistencia a Fuego (volcado desde 6) | ✅ | Ignorar resistencia de los conjuros: texto | `trait-effects.ts` |
| 14 · Pyromancer's Fury | Texto | — | — | — |
| 18 · Fiery Soul | Texto | ⚠️ | Inmunidad a fuego: solo queda la resistencia (sin modelo de inmunidades) | `core/rules/sheet.ts` |

### Sea Sorcery (UA28)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Soul of the Sea | Nadar = velocidad (volcado: swim 30) | ✅ | Respirar bajo el agua: texto | `trait-effects.ts` |
| 3 · Curse of the Sea | Texto | — | — | — |
| 6 · Watery Defense | Resistencia a Fuego + contador 1/corto o largo | ✅ | — | `feat-effects.ts` |
| 14 · Shifting Form | Texto | — | — | — |
| 18 · Water Soul | Resistencia a contundente/perforante/cortante (volcado) | ✅ | Crítico→normal, no necesita comer: texto | `trait-effects.ts` |

### Stone Sorcery (UA28)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Bonus Proficiencies | Texto | ❌ | Escudos, armas sencillas y marciales: no se añaden; el bonus de ataque con armas marciales no cuenta competencia | `engine.ts` l.623 |
| 3 · Metal Magic | `subclass.spells` (9 conjuros) concedido como "siempre preparado" | ❌ | Error de interpretación: el texto dice que son conjuros que se **pueden elegir** al aprender conjuros de hechicero (lista ampliada), no preparados gratis. Hoy la ficha regala 9 conjuros de golpe y no permite elegirlos con cupo | `data/subclasses.json` (`spells`), `spell-choices.ts` |
| 3 · Stone's Durability | PG +1 y +1 por nivel (volcado: bonus 1 en nivel 3, 18 en 20) | ⚠️ | CA 13+CON activable (sin armadura, acción): no hay estado; la CA mostrada es 12 | `engine.ts` ~l.346 |
| 6 · Stone Aegis | Texto | — | — | — |
| 14 · Stone's Edge | Texto | — | — | — |
| 18 · Earth Master's Aegis | Texto | — | — | — |

### Storm Sorcery (Xanathar/SCAG)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Wind Speaker | Texto | — | Idioma Primordial: texto | — |
| 3 · Tempestuous Magic | Texto | — | — | — |
| 6 · Heart of the Storm | Resistencia a Relámpago y Trueno (volcado) | ✅ | — | `trait-effects.ts` |
| 6 · Storm Guide | Texto | — | — | — |
| 14 · Storm's Fury | Texto | — | — | — |
| 18 · Wind Soul | Vuelo 60 (volcado) + contador 1/corto o largo | ⚠️ | La inmunidad a relámpago/trueno solo se refleja como resistencia (sin modelo de inmunidades) | `core/rules/sheet.ts` |

## Patrones comunes

1. **Elecciones de rasgos de clase/subclase sin selector**: `choices.traitChoices/traitPicks` solo sirven a especies (`trait-choices.ts`, `species-picks.ts`). Afecta a Dracónico (tipo de daño), Divine Soul (afinidad), Favored Soul (dominio, cualidad), Giant Soul (tipo de gigante), Lunar (fase), Ancestral (habilidad). Una mecánica general arregla las seis.
2. **Ampliar la lista de conjuros que se pueden elegir** (Divine Magic, Chosen of the Gods, Metal Magic): `spellListOf`/`casterSpellLists` solo conocen la lista propia de la clase. Y la lectura de `subclass.spells` trata toda tabla como "siempre preparados" (Metal Magic mal; Lunar fusionó columnas).
3. **Conjuros "siempre preparados" sueltos en rasgos** (no tabla): Counterspell (Spellfire nv6), Counterspell + Dispel Magic (Ancestral nv6), Summon Beast (Shadow). Lo mismo con los lanzamientos gratis de Draconic nv18 y Ancestral nv6.
4. **Sin modelo de inmunidades** (condición ni daño): Defiled, Favored Soul Revisited, Pyromancy, Storm, Faerzress.
5. **Sin lector de efectos condicionales/temporales de velocidad y resistencia**: Aberrant, Phoenix y Lunar aplican siempre cosas que son de un estado temporal.
6. **Competencias de subclase** (armadura, armas): `engine.ts` solo mira la clase.
7. **Restaurar usos con Puntos de Hechicería**: todos los rasgos "restaura con N PS" son texto; no hay contador de PS que se gaste desde el contador del rasgo.
8. **Contadores 1/largo correctos y bien leídos**: Warping Implosion, Restore Balance, Trance of Order, Clockwork Cavalcade, Abyssal Explosion, Dragon Wings, Umbral Form, Crown of Spellfire, Mantle of Flame y similares.

## Dudas

- **Tides of Chaos**: se recupera en descanso largo o al lanzar un conjuro con espacio (y entonces se tira en la tabla de oleadas). ¿Un contador manual de 1 uso basta, o se espera automatizar la recarga al gastar un espacio?
- **Subclases de 2014 al nivel 3**: el texto dice "1st level" y la app las da en el nivel 3 (como en 2024). Puede ser decisión de adaptación; los PG de "+1 y +1 al subir" empiezan en 3, no en 1 (Giant Soul, Stone, Favored Soul Revisited).
- **Sorcery Incarnate**: "gastar 2 PS para activar Innate Sorcery sin usos": ¿se quiere un botón de activación extra con coste en PS?
- **Lunar Phenomenon**: un uso por cada uno de los tres beneficios; ¿un solo contador de 1 o tres?
- **Defile and Empower**: los dados de golpe gastados y el "Life Steal 1/largo": la clave del contador es `life-steal`; ¿se prefiere mostrarlo con ese nombre?

## Observaciones (errores del volcado/datos aunque no sean faltantes)

- `subclass.spells` de **Lunar**: ids como "Shield Ray of Sickness Color Spray", "Lesser Restoration Blindness/Deafness Alter Self" aparecen en `grantedSpells` con `always`. Son nombres fusionados que no existen como conjuro; el scraper partió mal la tabla de 3 columnas. Regla de scraper, no edición a mano (skill `datos`). Faltan además los conjuros de nivel 1 de la fila "1st".
- **Stone Sorcery**: `grantedSpells` concede 8 conjuros a nivel 3 y Staggering Smite a nivel 4 como "always": error de lectura (ver Metal Magic).
- **Aberrant**: `speed.fly = 30` desde nivel 14; **Phoenix**: `speed.fly = 40` desde 18; **Lunar**: resistencias Necrótico/Radiante desde 14: aplicadas sin condición (ver tablas).
- El volcado no incluye competencias, inmunidades, características ni sentidos distintos de `darkvision`; por eso no se pudo comprobar Blindsight de Shadow ni el aumento de CON de Giant Soul (la inspección es del código: no hay lector).
- Etiqueta de contador de Defiled: `trait:subclass:defile-and-empower:life-steal` se muestra como "Defile and Empower" y el contador `Sorcerous Restoration` en `counters` aparece con `feat=Sorcerous Restoration` (consistente con los demás).
- El aviso `sheet.warn.traitPickMissing` "Skillful" en todas las entradas es del personaje de prueba (especie Humano), no de Hechicero.
- Contadores de Innate Sorcery y Sorcerous Restoration: coherentes entre sí (Innate Sorcery 2/largo en el nivel 1, tabla `FEATURE_USES`, no por columna); si el texto cambiara de usos, la lista está escrita a mano (`play-state.ts` l.157-163: `uses: () => 2`).
