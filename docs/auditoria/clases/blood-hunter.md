# Auditoría: Cazador de sangre (Blood Hunter, 2014)

Fuentes: `data/classes.json` (`blood-hunter`), `data/subclasses.json` (4 órdenes), `data/options.json` (12 Blood Curses, 20 mutágenos), `docs/auditoria/_volcado/clase-blood-hunter.json` y el código en `app/src/app`.

## Resumen

| Alcance | ✅ | ⚠️ | ❌ | — |
| --- | --- | --- | --- | --- |
| Clase base | 4 | 4 | 2 | 6 |
| Ghostslayer | 0 | 3 | 1 | 2 |
| Lycan | 0 | 2 | 2 | 2 |
| Mutant | 1 | 2 | 2 | 2 |
| Profane Soul | 3 | 1 | 3 | 3 |
| **Total** | **8** | **12** | **10** | **15** |

Lo grave: **Crimson Rite no existe como elección ni como daño** (ni selector, ni coste en PG, ni dado de Hemocraft sumado al arma); **el Hemocraft modifier (INT/WIS) no es una elección ni un número en la ficha** salvo como característica de lanzamiento de Profane Soul; las **transformaciones y mutágenos no tienen estados activos ni efectos**; Profane Soul vuelca como "conjuros siempre preparados" **filas de tabla sin sentido**; y los **Otherworldly Patron no se eligen**, así que Revealed/Unsealed Arcana no concede nada.

## Clase base

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Hemocraft Die (columna) | d4/d6/d8/d10 en niveles 1/5/11/17 | ✅ | El dado se muestra (`classTable`, y `dieColumn` en el contador de Blood Maledict). Pero no se usa en ningún cálculo (ver Crimson Rite y amplificar). | `core/play/play-state.ts` |
| 1 · Hunter's Bane | Ventaja en rastrear/recordar fey/fiends/undead; define CD Hemocraft = 8+PB+mod Hemocraft (INT o WIS a elegir) | ⚠️ | La ventaja es texto (basta). Falta la **elección INT/WIS de Hemocraft** para toda la clase (variante: "con permiso del DM") y mostrar la **CD Hemocraft** y el modificador. Solo existe selector INT/WIS dentro de Profane Soul (`spellAbility`). | `engine.ts` (`spellClasses`), `character.ts` (`spellAbility`) |
| 1 · Blood Maledict: usos | 1 uso; 2 (nv 6), 3 (nv 13), 4 (nv 17); recarga corta o larga | ✅ | Contador correcto con `short: all` (`FEATURE_USES`, `rest-rules.ts`). | `play-state.ts:62`, `rest-rules.ts:34` |
| 1 · Blood Maledict: maldiciones conocidas | 1 maldición; +1 en 6/10/14/18; se puede reemplazar al aprender | ⚠️ | Selector existe (grupo `blood-curse`, recuento leído de la columna "Blood Curses Known", `choices.options`) y se puede cambiar marcando/desmarcando, pero: (a) las 4 maldiciones de orden (Exorcist, Corrosion, Howl, Soul Eater, "no cuentan contra las conocidas") **aparecen como opciones normales que gastan una elección** y su requisito de orden solo sale como nota sin comprobar; no se conceden solas al llegar al nivel del rasgo de subclase; (b) no se ofrece "reemplazar una" explícitamente al subir de nivel (el grupo solo se abre cuando crece el recuento). | `creation-rules.ts:199,233-290`, `level-up.ts:123`, `data/options.json` |
| 1 · Blood Maledict: amplificar | Daño necrótico = 1 dado Hemocraft (sin reducción) | — | Narrativo/manual: texto basta. | |
| 2 · Fighting Style | Archery, Dueling, GWF, TWF (texto 2014 con "non-rite damage die") | ⚠️ | Hay ranura de dote `blood-hunter:2` tipo `fighting-style` (`featSlots`), pero ofrece las **dotes de estilo 2024**, no las 4 opciones del texto 2014 (GWF 2014 tiene otra redacción; Dueling/Archery equivalen). No hay lógica "dado que no es de rito". | `creation-rules.ts:55-72`, `features/creation`, `features/level-up` |
| 2 · Crimson Rite | Elegir 1 rito (Flame/Frozen/Storm; Dead/Oracle/Roar desde nv 14), +1 en nv 7 y 14; bonus action para activar en un arma; coste = 1 dado Hemocraft en necrótico; daño extra = dado Hemocraft del tipo del rito; arma mágica | ❌ | Nada de nada: no hay grupo de opciones `crimson-rite` (los ritos solo están como texto inline en el rasgo, no en `data/options.json`), ni selector, ni estado activo (`activeStates` vacío), ni coste en PG, ni daño extra en la tabla de ataques, ni "arma mágica". Número de ritos: 1 (nv 2), 2 (nv 7), 3 (nv 14). | `data/classes.json` (texto), falta en `scraper`/`options`; `attacks.ts`, `active-states.ts` |
| 3 · Blood Hunter Order | Elección de subclase | ✅ | Selector de subclase estándar (`subclassLevel` 3). | `creation-rules.ts` |
| 4/8/12/16/19 · ASI | Mejora o dote | ✅ | Reconocido incluso con la errata "Improvemnt" del wiki. | `creation-rules.ts:60` |
| 5 · Extra Attack | 2 ataques | — | Texto basta (no hay lógica específica en el motor para ningún Extra Attack). | |
| 6 · Brand of Castigation | Marca; 1 uso, recarga corta/larga; psíquico = mod Hemocraft al marcado | ⚠️ | Contador ✅ (`featUses`, `short-or-long`). Falta el **valor** del daño (mod Hemocraft, mín. 1; ×2 en nv 13) como número en el rasgo. | `feat-effects.ts`, `feature-stats.ts` |
| 9 · Grim Psychometry | Ventaja Historia sobre objetos/lugares | — | Texto basta. | |
| 10 · Dark Augmentation | +5 pies de velocidad; bonus a salvaciones FUE/DES/CON = mod Hemocraft (mín. +1) | ❌ | Volcado nv 10: `speed {walk:30}` sin +5; no hay bonus a salvaciones (depende de la elección Hemocraft inexistente). | `engine.ts`, `trait-effects.ts` (`speeds`) |
| 13 · Brand of Tethering | Psíquico ×2; sin Dash; teletransporte 4d6 | — | Texto basta (aparte del número de Brand, ver nv 6). | |
| 14 · Hardened Soul | Ventaja vs encantado/asustado | — | Texto basta. | |
| 20 · Sanguine Mastery | Repetir dado Hemocraft una vez por turno; crítico con rito recupera 1 uso de Maledict | — | Texto basta (depende de Crimson Rite; el recobro de uso se haría a mano desde el contador). | |

## Orden del Ghostslayer

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Rite of the Dawn | Rito extra gratis (radiante); con él activo: luz 20 pies, resistencia necrótica, dado extra contra no-muertos | ❌ | No existe el rito. Además el volcado muestra **resistencia necrótica permanente** desde el nv 3: el lector toma como incondicional una frase que solo vale con el rito activo (error de sobre-aplicación). | `trait-effects.ts` (resistencias), `engine.ts` |
| 3 · Curse Specialist | +1 uso de Blood Maledict; maldiciones sobre cualquier criatura | ⚠️ | El contador **no suma el uso**: 1 en nv 3 (debe 2), 2 en nv 7 (3), 3 en nv 13 (4), 4 en nv 17 (5). `FEATURE_USES` no mira la subclase. Lo de "cualquier criatura" es texto. | `play-state.ts:62-70` |
| 7 · Aether Walk | Pasar por criaturas/objetos Hmod rondas; 1 uso (2 desde nv 15); recarga corta/larga | ⚠️ | Sin contador: `feat-effects.ts` deja a propósito como texto los usos que crecen con el nivel ("twice ... starting at 15th"). Debería ser 1 (nv 7) / 2 (nv 15), `short-or-long`. | `feat-effects.ts:327-360`, `play-state.ts` |
| 11 · Brand of Sundering | Dado de rito adicional al impactar | — | Texto basta (depende de Crimson Rite). | |
| 15 · Blood Curse of the Exorcist | Maldición gratis, no cuenta contra conocidas | ⚠️ | Existe como opción con requisito (nv 15 + orden Ghostslayer) que **consume una elección** en lugar de concederse sola. Ver "Patrones comunes". | `data/options.json`, `creation-rules.ts` |
| 18 · Rite Revival | Termina ritos para quedar a 1 PG en lugar de 0 | — | Texto basta. | |

## Orden del Lycan

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Heightened Senses | Ventaja Percepción (oído/olfato) | — | Texto basta. | |
| 3 · Hybrid Transformation | Bonus action, 1 h; recarga corta/larga; en forma híbrida: ventaja FUE (pruebas/salv.), +1/+2/+3 al daño cuerpo a cuerpo, resistencia a daño no mágico/no plateado, +1 CA sin armadura pesada, golpe sin armas 1d6 (1d8 nv 11) con DES opcional y Crimson Rite, Bloodlust | ⚠️ | Contador existe pero **duplicado** (aparece dos veces: `FEATURE_USES` + `featUses`). No hay estado activo "forma híbrida": ni CA +1, ni resistencias, ni daño +N, ni ataque sin armas mejorado (el volcado muestra solo el Unarmed Strike genérico d1/4 fijo), ni DES opcional. | `play-state.ts:71-78`, `active-states.ts`, `attacks.ts`, `natural-weapons.ts` |
| 7 · Stalker's Prowess | +10 pies de velocidad; saltos; +1/+2/+3 al ataque sin armas en forma híbrida; arma mágica | ❌ | Volcado nv 7: `speed {walk:30}`, no suma 10 (la velocidad es permanente, no depende de la forma). Faltan bonus al ataque y mágico. | `trait-effects.ts` (`speeds`), `engine.ts` |
| 11 · Advanced Transformation | 2 usos de Hybrid Transformation; Lycan Regeneration | ⚠️ | Crea un contador **aparte** "Advanced Transformation max 2" y deja el "Hybrid Transformation max 1" (hay 3 contadores). Debería ser un único contador de 2 usos. Regeneración es texto. | `play-state.ts`, `feat-effects.ts` |
| 15 · Brand of the Voracious | Ventaja en salvación de Bloodlust y en ataques contra marcado | — | Texto basta. | |
| 18 · Hybrid Transformation Mastery | Usos ilimitados, dura hasta revertir; Blood Curse of the Howl gratis | ❌ | El contador sigue en 1 (+ el de Advanced en 2): debería quedar ilimitado/oculto. La maldición del Howl, como las demás, consume una elección (ver patrones). | `play-state.ts`, `creation-rules.ts` |

## Orden del Mutant

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Mutagencraft (elección y número) | Fórmulas conocidas 4/5/6/7/8 (nv 3/7/11/15/18) | ✅ | Grupo `mutagen` (20 opciones, `subclassId` Mutant) con recuento por nivel `OPTION_COUNT_BY_LEVEL.mutagen` = 4/5/6/7/8; se guardan en `choices.options`. | `creation-rules.ts:211`, `data/options.json` |
| 3 · Mutagencraft (mutágenos creados) | Crear 1/2/2/3/3 mutágenos al terminar un descanso; consumir como bonus action; efectos y efectos secundarios hasta el siguiente descanso | ❌ | Sin contador de mutágenos creados ni "activo", sin efectos en estadísticas (CA, velocidad, características, ataques), sin marcar cuáles se han tomado. Los 20 textos de mutágenos son solo texto. | `play-state.ts`, `active-states.ts`, `data/options.json` |
| 3 · Formulas | Reemplazar una fórmula al aprender nueva | — | Texto basta (se puede desmarcar/marcar en el grupo). | |
| 7 · Strange Metabolism | Inmunidad al daño de veneno y a envenenado; ignorar efecto secundario 1 min, 1/descanso largo | ⚠️ | Contador ✅ (`long`). **Falta la inmunidad**: el modelo de ficha solo tiene `resistances`, no inmunidades (volcado nv 7: resistances vacío). | `sheet.ts`, `trait-effects.ts`, `feat-effects.ts` |
| 11 · Brand of Axiom | Ilusión/invisibilidad terminan en el marcado | — | Texto basta. | |
| 15 · Blood Curse of Corrosion | Maldición gratis | ⚠️ | Igual que el resto de maldiciones de orden (consume una elección). | `creation-rules.ts` |
| 18 · Exalted Mutation | Cambiar un mutágeno activo; usos = mod Hemocraft (mín. 1), recarga larga | ❌ | Sin contador: depende de mod Hemocraft (no definido). Volcado nv 18: sin contador. | `play-state.ts` (`FEATURE_USES`) |

## Orden del Profane Soul

| Elemento | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Pact Magic (tabla) | Cantrips 2 (3 en nv 10), conocidos 2→11, espacios 1→2 de nivel 1→4, recarga corta/larga | ✅ | `spellcasting` de subclase (`kind: pact`, `preparation: known`, lista `warlock`) correcto. Pacto: 1×1 (nv 3), 2×2 (nv 7), 2×3 (nv 13), 2×4 (nv 19) verificado en el volcado. | `engine.ts:403-449`, `data/subclasses.json` |
| 3 · Característica de lanzamiento | INT o WIS (Hemocraft) | ✅ | Selector `abilityChoices` ['INT','WIS'] en creación y subida de nivel, guardado en `classes[].spellAbility`; CD y ataque usan esa característica. | `character-create.html:176`, `level-up.html:158`, `engine.ts:408` |
| 3 · Selección de conjuros / cantrips | Conocidos de la lista de brujo, de nivel ≤ nivel de espacio | ✅ | `spellsFor` usa `spellList: warlock`; un cambio por nivel (`swapRule` por defecto). Ver observación de "conjuros fantasma" abajo. | `creation-rules.ts:178-215`, `spell-swap.ts` |
| 3 · Otherworldly Patron | Elegir pacto (9 opciones) | ❌ | No hay selector ni campo en el personaje; los textos de Rite Focus/Revealed Arcana/Unsealed Arcana se leen sin pacto. | `character.ts`, `trait-choices.ts` |
| 3 · Rite Focus | Arma con rito = foco; beneficio según pacto | — / ❌ | Foco: texto basta. Los beneficios por pacto (respirar bajo el agua, curación, vuelo, etc.) dependen del patrón no elegido; en su mayoría texto/situacionales. | |
| 7 · Mystic Frenzy | Ataque de arma como bonus tras lanzar truco | — | Texto basta. | |
| 7 · Revealed Arcana | 1 conjuro fijo según pacto, 1/descanso largo | ❌ | Sin patrón no se concede el conjuro (Blur, Lesser Restoration, Gust of Wind, Scorching Ray, Phantasmal Force, Detect Thoughts, Branding Smite, Blindness/Deafness, Silence) ni hay contador. | `feat-effects.ts`, `engine.ts` |
| 11 · Brand of the Sapping Scar | Desventaja en salvaciones contra tus conjuros de brujo | — | Texto basta. | |
| 15 · Unsealed Arcana | 1 conjuro extra sin espacio, 1/descanso largo | ❌ | Mismo problema (Slow, Revivify, Lightning Bolt, Fireball, Protection from Energy, Haste, Blink, Speak with Dead, Bestow Curse). | |
| 18 · Blood Curse of the Soul Eater | Maldición gratis | ⚠️ | Igual que el resto de maldiciones de orden. | `creation-rules.ts` |

## Patrones comunes

1. **Crimson Rite y todo lo que depende de él** (Rite of the Dawn, Brand of Sundering, Hybrid/Predatory Strikes, Sanguine Mastery, Rite Focus): no hay elección de rito ni estado activo ni daño. Es la mayor laguna de la clase. Los ritos no están en `data/options.json` (solo texto dentro del rasgo): hace falta una regla en el scraper antes de crear selector.
2. **Hemocraft modifier / dado**: el motor no tiene "mod Hemocraft" (INT/WIS a elegir) fuera de Profane Soul; bloquea Dark Augmentation, Brand (daño), Aether Walk (rondas), Exalted Mutation (usos), CD Hemocraft y bonus a salvaciones.
3. **Maldiciones de orden "gratis"**: son opciones del mismo grupo que gasta una elección y no se conceden solas. Debería excluirse del recuento y concederse al llegar al nivel del rasgo de subclase.
4. **Contadores que crecen con la subclase**: `FEATURE_USES` ignora modificadores de subclase (Curse Specialist +1); los rasgos "una vez / dos veces desde nv X" se dejan como texto a propósito (Aether Walk); duplicados Hybrid/Advanced Transformation.
5. **Formas activas sin estado**: Hybrid Transformation y mutágenos no tienen `activeStates` ni efectos (CA, resistencias, velocidad, daño).
6. **Sin inmunidades** en el modelo (Strange Metabolism).
7. **Elección sin selector**: Otherworldly Patron.

## Dudas

- El Fighting Style de la clase está redactado en 2014 pero la app ofrece dotes de estilo 2024. ¿Aceptable? (GWF 2014 habla de "non-rite damage die".)
- Hemocraft INT/WIS: el texto lo presenta como variante con permiso del DM. ¿Se quiere un selector global (por clase) o solo para Profane Soul como hoy?
- Maldiciones de subclase: ¿conceder automáticamente (según el texto "no cuenta contra las conocidas") o dejar como opción manual? El texto de la subclase dice que las ganas, no que las elijas.
- Regla de multiclase con brujo (sumar un tercio de niveles de cazador al nivel de brujo si es Profane Soul): no se calcula; con dos pactos el motor solo conserva uno y avisa `twoPacts`.

## Observaciones (errores del volcado)

1. **Conjuros fantasma en Profane Soul**: `grantedSpells` lista 18 entradas como `"2 2 1 1st [subclass:Order of the Profane Soul] always"` ("siempre preparados"). Son filas de la tabla de lanzamiento que el scraper guardó en `subclasses.json[].spells` y el motor trata como nombres de conjuro (`engine.ts:1216`). El número crece con el nivel. Habría que filtrarlas en el scraper (`classLevel/spells`) o en `engine.ts`.
2. **Resistencia necrótica permanente** de Ghostslayer desde nv 3: solo debería valer con Rite of the Dawn activo.
3. **Contadores duplicados**: "Hybrid Transformation max=1" aparece dos veces (con y sin `feat=`) en Lycan nv 3-20.
4. **Blood Maledict en Ghostslayer** muestra 1/2/3/4 en lugar de 2/3/4/5.
5. **Aviso `traitPickMissing: Skillful`** del personaje de prueba (humano) aparece en todas las entradas: es del personaje, no de la clase.
6. Brand of Castigation no aparece como contador hasta nv 6 (correcto), pero la entrada nv 6 base lleva el aviso `noSubclass` aunque la subclase se elige a nv 3 (correcto para base sin subclase).
7. Atajo del volcado: no hay entradas para los niveles 13 y 19 de Profane Soul (solo 3,5,6,7,10,11,14,15,17,18,20); el espacio de nivel 3/4 de Pact Magic se comprobó en la tabla y en `slotsByLevel`, no en el volcado.
