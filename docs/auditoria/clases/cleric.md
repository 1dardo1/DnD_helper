# Auditoría de la clase Clérigo

Solo lectura. Fuentes: `data/classes.json` (`cleric`), `data/subclasses.json` (24 dominios: 9 de 2024 y 15 de 2014/UA), volcado `docs/auditoria/_volcado/clase-cleric.json` y código de `app/src/app`. Los rasgos de dominio de 2014 aparecen en los niveles 3/6/17 por el reajuste del scraper.

## Resumen

Recuento sobre 160 filas (clase base + 24 dominios): ✅ 60 · ⚠️ 19 · ❌ 27 · — 54.

Lo más grave:
1. **Divine Order** (nv1) no tiene selector ni efecto.
2. **Blessed Strikes** (nv7) no tiene selector; Potent Spellcasting no hace nada.
3. Las **competencias de subclase** (armas marciales, armadura pesada, herramientas, habilidades, TS) no se aplican nunca: afecta a 12 dominios de 2014 y a Freedom/Knowledge/Arcana.
4. Los **trucos/conjuros extra de dominio** (Student of Arcana, Magical Mastery, Reaper, Acolyte of Nature/Strength, On/Off) no tienen selector ni cupo.
5. **Improved Warding Flare** (Luz): recarga incorrecta.
6. Fate: Augury y Foresight gratuitos no se conceden.

## Clase base (Clérigo 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 1 · Spellcasting | Trucos 3/4/5, preparados 4→22, espacios, SAB, cambio de lista tras descanso largo (`spell-swap.ts`). | ✅ | Cambio de truco al subir de nivel: no verificado. | `app/src/app/core/creation/spell-choices.ts, core/play/spell-swap.ts` |
| 1 · Divine Order (Protector / Thaumaturge) | Elección de rol: Protector (armas marciales + armadura pesada) o Taumaturgo (truco extra + bonus SAB a Arcana/Religion). | ❌ | Ni selector ni dónde guardarlo (no hay `choices` ni opciones en `options.json` para cleric). Sin efectos: cantrips=3 en nivel 1 (debería ser 4 con Taumaturgo), sin competencias de Protector, sin bonus de Arcana/Religion. Sin aviso de elección pendiente. | `app/src/app/core/models/character.ts, features/creation, features/level-up, core/rules/engine.ts` |
| 2 · Channel Divinity | Contador 2 (nv2) / 3 (nv6) / 4 (nv18); recupera 1 en corto y todo en largo. | ✅ | — | `app/src/app/core/play/rest-rules.ts, core/play/play-state.ts` |
| 2 · Divine Spark / Turn Undead | Opciones del Channel Divinity. | ⚠️ | Divine Spark (1d8+SAB, +1d8 a 7/13/18) y CD de Turn Undead no se calculan (solo existe `channelDivinityDc` para Paladín). | `app/src/app/core/rules/feature-stats.ts` |
| 3 · Cleric Subclass | Selector de dominio al nivel 3 (24 dominios; aviso `noSubclass` si falta). | ✅ | — | `app/src/app/features/creation, features/level-up` |
| 4/8/12/16 · Ability Score Improvement | Ranuras de dote. | ✅ | — | `app/src/app/core/creation/level-up.ts` |
| 5 · Sear Undead | Nota con SABd8 (mín. 1) y gasto de Channel Divinity. | ✅ | — | `app/src/app/core/rules/feature-stats.ts` |
| 7 · Blessed Strikes (Divine Strike / Potent Spellcasting) | Elegir una de dos opciones. | ❌ | Sin selector. Solo hay la nota "Divine Strike (si elegiste esa opción)" 1d8 siempre visible; Potent Spellcasting (+SAB a trucos) no tiene efecto. | `app/src/app/core/rules/feature-stats.ts, app/src/app/core/i18n/en.ts` |
| 10 · Divine Intervention | Contador 1/largo. | ✅ | El conjuro elegido es texto. | `app/src/app/core/play/play-state.ts` |
| 14 · Improved Blessed Strikes | 2d8 (✅ en la nota) o PT = 2×SAB al lanzar truco. | ⚠️ | Depende de la elección ausente; los PT son texto. | `app/src/app/core/rules/feature-stats.ts` |
| 19 · Epic Boon | Ranura de dote (Boon of Fate recomendado). | ✅ | — | `app/src/app/core/creation/level-up.ts` |
| 20 · Greater Divine Intervention | Wish; espera 2d4 descansos largos. | — | Excluido a propósito en feature-coverage.spec.ts. | — |

## Ambition Domain (Amonkhet) (2014 Plane Shift)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Warding Flare | Contador WIS mod (2 con WIS 14), recarga largo. Acción reacción. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Invoke Duplicity | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Channel Divinity: Cloak of Shadows | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 17 · Potent Spellcasting (texto: nivel 8) | +WIS al daño de trucos de clérigo. | — | El motor no calcula daño de conjuros en ningún Potent Spellcasting. | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Improved Duplicity | Hasta 4 duplicados. | — | — | — |

## Arcana Domain (2024 Arcana Unleashed)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Modify Magic | Gasta Channel Divinity al lanzar (THP 2d8+nivel; -1d6 al TS). | — | — | `app/src/app/core/play/play-state.ts` |
| 3 · Student of Arcana | Competencia en Arcana (o habilidad de clérigo de nivel 1) y 2 trucos de Mago, cambiables por nivel. | ❌ | Sin selector: la lista de habilidades de la creación se filtra a la clase (Arcana no está) y los trucos de Mago no tienen cupo propio ni selector (cupo de trucos = columna de clase). | `app/src/app/features/creation/character-create.ts, core/creation/spell-choices.ts` |
| 6 · Dispelling Recovery | Contador 1, recarga corto o largo. Correcto ("short-or-long"); la restauración gastando Channel Divinity queda en texto. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 17 · Magical Mastery | 4 conjuros de Mago (niveles 6,7,8,9) siempre preparados, cambiables por nivel. | ❌ | Sin selector ni efecto: no se guardan ni salen como preparados. | `app/src/app/core/rules/engine.ts` |

## City Domain (UA) (2014 UA Modern Magic)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Cantrip | Truco On/Off (id `on-off-ua`) extra. | ❌ | No se concede: el texto lo nombra "On/Off*" y el lector de conjuros no lo reconoce. | `app/src/app/core/rules/feat-effects.ts` |
| 3 · Bonus Proficiencies | Competencia con sidearms y vehículos (tierra). | ❌ | No se aplica. | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Heart of the City | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Spirits of the City | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Block Watch | Situacional (entorno urbano). | — | — | — |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Express Transit | Contador 1, recarga corto o largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Death Domain (2014 DMG)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Competencia con armas marciales. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Reaper | Un truco de nigromancia de cualquier lista; los de un objetivo pueden afectar a dos. | ❌ | Sin selector del truco (los trucos de otra lista no se pueden elegir como extra). | `app/src/app/core/creation/spell-choices.ts` |
| 3 · Channel Divinity: Touch of Death | Necrótico extra 5 + 2×nivel (número en texto, no precalculado). | — | — | `app/src/app/core/rules/feature-stats.ts` |
| 6 · Inescapable Destruction | Ignora resistencia necrótica. | — | — | — |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Improved Reaper |  | — | — | — |

## Fate Domain (UA) (2014 UA Wonders of the Multiverse)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Omens and Portents | Augury sin espacio ni componentes, 1 vez por descanso largo. | ❌ | No se concede ni hay contador: el lector exige "You can cast <Nombre>" y el texto dice "You can cast the Augury spell". | `app/src/app/core/rules/feat-effects.ts` |
| 3 · Ties That Bind | Contador PB (2→6 con el nivel), recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Strands of Fate | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Insightful Striking | Contador PB, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 17 · Potent Spellcasting (texto: nivel 8) |  | — | — | — |
| 17 · Visions of the Future | Foresight 1 vez por descanso largo, sin espacio. | ❌ | Ni conjuro concedido ni contador (mismo fallo del lector que Omens and Portents: "cast the Foresight spell once"). | `app/src/app/core/rules/feat-effects.ts` |

## Forge Domain (2014 Xanathar)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Competencia con armadura pesada y herramientas de herrero. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Blessing of the Forge | Contador 1, recarga largo. El +1 al objeto es manual. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Artisan's Blessing | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Soul of the Forge | Resistencia al fuego ✅ (sale en la ficha). | ⚠️ | Falta +1 CA con armadura pesada. | `app/src/app/core/rules/trait-effects.ts, app/src/app/core/rules/engine.ts (proficiencies)` |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Saint of Forge and Fire | Inmunidad al fuego; con armadura pesada resistencia a daño no mágico C/P/S. | ⚠️ | El motor solo modela resistencias, no inmunidades, y descarta las condicionales ("nonmagical", "while wearing"). | `app/src/app/core/rules/trait-effects.ts` |

## Freedom Domain (UA) (2024 UA16)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Invoke Liberty | Channel Divinity. | — | — | `app/src/app/core/play/play-state.ts` |
| 3 · Unencumbered Grace | CA sin armadura 10+DES+SAB ✅ (CA 14 en volcado, escudo permitido). | ⚠️ | Falta competencia en Acrobacias / pericia si ya la tiene (el lector de habilidades exige la palabra "skill" y no la ve). | `app/src/app/core/rules/trait-effects.ts` |
| 6 · Unstoppable | Competencia en TS de Destreza, o en otra a elegir si ya la tiene. | ❌ | `choices.saves` existe pero ninguna pantalla lo escribe; nada concede esta competencia. | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 17 · Avatar of Freedom | Contador 1, recarga corto o largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Grave Domain (2024 Ravenloft)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Circle of Mortality | Pull of Death 1d4/1d6 (nivel 11), Spare the Dying como acción adicional, curación máxima. | — | Dados no precalculados. | `app/src/app/core/rules/feature-stats.ts` |
| 3 · Path to the Grave | Channel Divinity; daño extra = nivel. | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Sentinel at Death's Door | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 17 · Divine Reaper | Contador 1 (Keeper of Souls), recarga corto o largo. Enhanced Necromancy gasta Channel Divinity (texto). | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Knowledge Domain (2024 Heroes of Faerûn)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Blessings of Knowledge | Herramienta de artesano y 2 habilidades de Arcana/History/Nature/Religion con pericia. | ❌ | Sin selector ni efecto (creación solo ofrece habilidades de la clase; la pericia exige ser competente). | `app/src/app/features/creation/character-create.ts` |
| 3 · Mind Magic | Gasta Channel Divinity. | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Unfettered Mind | Telepatía 60 pies; competencia en TS de Inteligencia (o en otra si ya la tiene). | ❌ | Ni TS (ver Unstoppable) ni telepatía (el lector de sentidos no la reconoce). | `app/src/app/core/rules/trait-effects.ts` |
| 17 · Divine Foreknowledge | Contador 1, recarga largo. Restaurar con espacio 6+ queda en texto. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Life Domain (2024 PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Disciple of Life | Nota con 2 + nivel del espacio. | ✅ | — | `app/src/app/core/rules/feature-stats.ts` |
| 3 · Preserve Life | 5×nivel PG calculado, gasta Channel Divinity. | ✅ | — | `app/src/app/core/rules/feature-stats.ts` |
| 6 · Blessed Healer | 2 + nivel del espacio. | — | — | — |
| 17 · Supreme Healing | Excluido a propósito en feature-coverage.spec.ts. | — | — | — |

## Light Domain (2024 PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Radiance of the Dawn | 2d10+nivel y CD calculados, gasta Channel Divinity. | ✅ | — | `app/src/app/core/rules/feature-stats.ts` |
| 3 · Warding Flare | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 6 · Improved Warding Flare | Recupera todos los usos de Warding Flare en descanso corto o largo; PT 2d6+SAB (✅ en stats). | ❌ | Recarga errónea: el contador sigue `short=0` (solo largo) en los niveles 6-20; el texto dice corto o largo. | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/rest-rules.ts` |
| 17 · Corona of Light | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Nature Domain (2014 PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Acolyte of Nature | Un truco de Druida (cuenta como de clérigo, fuera del cupo) y una habilidad entre Animal Handling/Nature/Survival. | ❌ | Sin selector del truco ni de la habilidad. | `app/src/app/core/creation/spell-choices.ts` |
| 3 · Bonus Proficiency(ies) | Competencia con armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Channel Divinity: Charm Animals and Plants | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Dampen Elements | Reacción. | — | — | — |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Master of Nature |  | — | — | — |

## Order Domain (2014 GGR/Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Armadura pesada y Intimidation o Persuasion (a elegir). | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Voice of Authority |  | — | — | — |
| 3 · Channel Divinity: Order's Demand | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Embodiment of the Law | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Order's Wrath |  | — | — | — |

## Peace Domain (2014 Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Implement of Peace | Competencia en Insight, Performance o Persuasion (a elegir). | ❌ | Sin selector. | `app/src/app/features/creation/character-create.ts` |
| 3 · Emboldening Bond | Contador PB (2→6), recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Balm of Peace | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Protective Bond |  | — | — | — |
| 17 · Potent Spellcasting / Expansive Bond |  | — | — | — |

## Pestilence Domain (UA) (2024 UA12)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Blight Weaver | Resistencia necrótico y veneno ✅ en la ficha; el resto (ignorar resistencias, cambiar tipo) es texto. | ✅ | — | `app/src/app/core/rules/trait-effects.ts` |
| 3 · Plague Blessing | Channel Divinity. | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Virulent Burst | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 17 · Vermin Form | Contador 1, recarga largo. Restaurar con espacio 5+ queda en texto; resistencias de la forma, texto. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Protection Domain (UA) (2014 UA22)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Competencia con armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Shield of the Faithful |  | — | — | — |
| 3 · Channel Divinity: Radiant Defense | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Blessed Healer |  | — | — | — |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Indomitable Defense | Resistencia a 2 tipos a elegir (contundente, necrótico, perforante, radiante, cortante), cambiable en descanso corto/largo. | ❌ | Sin selector ni resistencias (hay diálogo de descanso `restPicks`, pero no lo usa este rasgo). | `app/src/app/core/rules/engine.ts, features/characters/trait-rest-dialog` |

## Solidarity Domain (Amonkhet) (2014 Plane Shift)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Competencia con armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Solidarity's Action | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Preserve Life | 5×nivel PG (la nota calculada solo existe para Life Domain). | — | — | `app/src/app/core/rules/feature-stats.ts` |
| 6 · Channel Divinity: Oketra's Blessing | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Supreme Healing |  | — | — | — |

## Strength Domain (Amonkhet) (2014 Plane Shift)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Competencia con armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Acolyte of Strength | Un truco de Druida y una habilidad entre Animal Handling/Athletics/Nature/Survival. | ❌ | Sin selector. | `app/src/app/core/creation/spell-choices.ts` |
| 3 · Channel Divinity: Feat of Strength | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Channel Divinity: Rhonas' Blessing | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Avatar of Battle | Resistencia C/P/S de ataques no mágicos. | ⚠️ | El lector descarta resistencias con "nonmagical" (la de War Domain 2024, sin esa coletilla, sí sale). | `app/src/app/core/rules/trait-effects.ts` |

## Tempest Domain (2014 PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Armas marciales y armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Wrath of the Storm | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Destructive Wrath | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Thunderous Strike |  | — | — | — |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Stormborn | Velocidad de vuelo = andar (fuera de subsuelo/interiores). | ⚠️ | No se añade vuelo (frase condicional descartada). | `app/src/app/core/rules/trait-effects.ts` |

## Trickery Domain (2024 PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Blessing of the Trickster |  | — | — | — |
| 3 · Invoke Duplicity | Gasta Channel Divinity. | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Trickster's Transposition |  | — | — | — |
| 17 · Improved Duplicity | Excluido a propósito en feature-coverage.spec.ts. | — | — | — |

## Twilight Domain (2014 Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Bonus Proficiency(ies) | Armas marciales y armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Eyes of Night | Visión en la oscuridad 300 pies ✅ y contador 1/largo. | ✅ | — | `app/src/app/core/rules/trait-effects.ts, app/src/app/core/rules/feat-effects.ts` |
| 3 · Vigilant Blessing |  | — | — | — |
| 3 · Channel Divinity: Twilight Sanctuary | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Steps of Night | Contador PB (3→6), recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Twilight Shroud |  | — | — | — |

## Unity Domain (UA) (2014 UA68)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Emboldening Bond | Contador 1, recarga largo. Usar de nuevo con espacio: texto. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Shared Burden | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Protective Bond |  | — | — | — |
| 17 · Potent Spellcasting / Enduring Unity |  | — | — | — |

## War Domain (2024 PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen todos como "always" a su nivel (verificado contra `data/subclasses.json`). | ✅ | — | `app/src/app/core/rules/engine.ts (traitGrants)` |
| 3 · Guided Strike | Gasta Channel Divinity. | — | — | `app/src/app/core/play/play-state.ts` |
| 3 · War Priest | Contador WIS mod, recarga corto o largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 6 · War God's Blessing |  | — | — | — |
| 17 · Avatar of Battle | Resistencia C/P/S ✅ en la ficha. | ✅ | — | `app/src/app/core/rules/trait-effects.ts` |

## Zeal Domain (Amonkhet) (2014 Plane Shift)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
|---|---|---|---|---|
| 3-9 · Conjuros de dominio | Salen siempre preparados, pero el de nivel 7 se llama "Fire Shield (warm shield only)". | ⚠️ | El id generado (`fire-shield-warm-shield-only`) no existe en `spells.json` (`fire-shield`): no se resuelve. Limpiar el paréntesis (scraper, regla en `tools/scraper`). | `app/src/app/core/rules/engine.ts (slug), data/subclasses.json` |
| 3 · Bonus Proficiency(ies) | Armas marciales y armadura pesada. | ❌ | `proficiencies()` solo lee clase base, multiclase y dotes: nunca los rasgos de subclase. Falta añadir al listado de armaduras/armas/herramientas (y habilidades elegidas). | `app/src/app/core/rules/engine.ts (proficiencies)` |
| 3 · Priest of Zeal | Contador WIS mod, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |
| 3 · Channel Divinity: Consuming Fervor | Opción de Channel Divinity: gasta el contador compartido de Channel Divinity (2/3/4, 1 en descanso corto, todo en largo). | — | — | `app/src/app/core/play/play-state.ts` |
| 6 · Resounding Strike |  | — | — | — |
| 17 · Divine Strike (2014; el texto dice nivel 8) | El texto se muestra, con dados 1d8/2d8. | ⚠️ | Sin nota de ataque con los dados (la definición `divineStrike` de feature-stats.ts solo ancla al Blessed Strikes de la clase). Además el scraper lo mueve de nivel 8 a 17 (subclassFeatureLevels [3,6,17]). | `app/src/app/core/rules/feature-stats.ts` |
| 17 · Blaze of Glory | Contador 1, recarga largo. | ✅ | — | `app/src/app/core/rules/feat-effects.ts, app/src/app/core/play/play-state.ts` |

## Patrones comunes

- **Competencias de subclase no leídas.** `proficiencies()` (engine.ts) solo suma clase base, multiclase y dotes; `traitRules` solo da habilidades fijas con la palabra "skill" y herramientas de una lista corta. Nada de armas, armaduras, TS ni elecciones de habilidad (también la ausente `choices.saves`, que no escribe ninguna pantalla).
- **Elecciones de rasgos de subclase sin selector**: habilidad, truco de otra lista, conjuros de otra lista, resistencias a elegir. Los selectores existentes cubren especie (`trait-choices.ts`, `species-picks.ts`) y dotes, no subclase ni Divine Order.
- **Lector de conjuros** (`feat-effects.ts`): exige "You can cast <Nombre> ..." con mayúscula inmediata; falla con "cast the X spell" (Fate) y con nombres con `*` o paréntesis (City, Zeal).
- **Recarga** de rasgos ampliados por un rasgo posterior (Improved Warding Flare) no se reevalúa.
- **Resistencias/velocidades condicionales** ("nonmagical", "whenever you are not underground", inmunidades) se descartan.
- **Números por nivel** en rasgos de Channel Divinity (Touch of Death, Radiant Defense, Preserve Life de Solidarity, Path to the Grave, Pull of Death) no se precalculan: solo Life y Light lo tienen en `feature-stats.ts`. Se tratan como texto suficiente.
- **Divine Strike 2014** sin nota de ataque, y subida de nivel 8 a 17 por el scraper.
- Bien resuelto: conjuros de dominio por nivel (24/24 coinciden con los datos), contadores de usos (SAB, PB, 1) con su recarga, Channel Divinity compartido.

## Dudas

- **Divine Strike 2014 a nivel 17** (data/subclasses.json): el scraper movió los rasgos de nivel 8 a 17 ([3,6,17]); el Blessed Strikes de 2024 dice que si una subclase antigua da una opción, se usa solo la elegida. No está claro si debe mostrarse el Divine Strike de dominio, a qué nivel, y si sustituye a Blessed Strikes (cambia el tipo de daño).
- **Potent Spellcasting de dominio 2014** (nivel 8 en el texto, 17 en datos): duplica la opción de Blessed Strikes.
- **Cambio de truco al subir nivel** (Spellcasting): el texto lo permite; no he verificado que la subida de nivel deje sustituir uno.
- **Cálculo de daño de conjuros**: no encontré ninguno en el motor; por eso Potent Spellcasting se marca "texto basta" en los dominios y ❌ solo en la clase base por faltar el selector.

## Observaciones (errores del volcado y datos)

- El volcado solo tiene los niveles 3,5,6,7,10,11,14,15,17,18,20 para dominios; las claves no cubren todos los niveles.
- Todos los niveles muestran el aviso `traitPickMissing: Skillful` (personaje de prueba), ajeno al clérigo.
- Zeal: el conjuro de nivel 7 se vuelca como "Fire Shield (warm shield only)" y su id no resuelve.
- City: faltan "On/Off" y competencias; el nombre del conjuro en los datos lleva `*`.
- Nivel 1 del volcado: `cantrips=3`, sin Divine Order, coherente con el fallo ❌.
- `grantedSpells` de Fate a nivel 17 no contiene Foresight ni Augury, y `featUses` solo trae Ties That Bind e Insightful Striking.
