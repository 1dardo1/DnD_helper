# Auditoría de dotes (`data/feats.json`)

Auditor de solo lectura. Se revisaron las **313 dotes** una a una (197 de 2024 y 116 de 2014) contra su `description`, el volcado `docs/auditoria/_volcado/dotes.json` (`parsed` y `sheet` del guerrero 8 sin elecciones) y el código (`feat-effects.ts`, `trait-effects.ts`, `engine.ts`, `feat-choices.ts`, `level-up.ts`, `character-create.ts`).

Leyenda de archivos (todos bajo `app/src/app/` salvo DATA): **FE** `core/rules/feat-effects.ts` (`parseText`, `FEAT_PICKS`), **TE** `core/rules/trait-effects.ts`, **ENG** `core/rules/engine.ts` (`featGrants`, `proficiencies`, `combatOf`), **FC** `shared/feat-choices.ts`, **DATA** `data/feats.json` (scraper en `tools/scraper/`), `attacks.ts` = `core/rules/attacks.ts`.

Criterios: ✅ completo (elecciones + contadores con recarga correcta + efectos en la ficha); ⚠️ parcial; ❌ falta (sin mecánica útil); — texto basta (beneficio situacional o de mesa, no cuenta como faltante). El aumento de característica a elegir se considera ✅ siempre que `abilityIncrease` esté en los datos: `slotPicks` (`core/creation/level-up.ts`, usado por `features/creation/character-create.ts` y `features/level-up`) ofrece `amount` picks entre `from`, lo guarda en `choices.abilityIncreases` (con `slot`) y `engine.ts` aplica el tope `max` (30 para las épicas). ASI y Resilient (competencia en la salvación) están cubiertos.

## Resumen

| Edición | Total | ✅ | ⚠️ | ❌ | — texto basta |
|---|---|---|---|---|---|
| 2024 | 197 | 154 | 31 | 1 | 11 |
| 2014 | 116 | 38 | 48 | 24 | 6 |
| **Total** | 313 | 192 | 79 | 25 | 17 |

Lectura rápida:
- **2024 está en muy buen estado**: 154 de 197 completas y solo 1 en ❌ (`boon-of-skill`). Lo ⚠️ se concentra en 8 dotes "Adept" (tabla de conjuros por casilla), 6 dotes UA de talento psiónico (conjuro de nivel 3 sin uso gratis), 3 con la reserva de Psionic Energy Dice mal tratada, inmunidades sin modelo y unas pocas elecciones (Magic Connoisseur, Ritual Caster, Skill Expert, Weapon Master...).
- **2014 es donde falta lo grande**: 24 en ❌ y 48 en ⚠️. De esos 48, **18 solo fallan por no duplicar la competencia** (las dotes UA "…-ua" que dan una habilidad/herramienta y "si ya la tienes, doble"): es de baja gravedad. Lo serio son las dotes que eligen conjuros/trucos/maniobras/invocaciones/metamagia sin selector (Initiate of High Sorcery y sus tres "Adept of the … Robes", Strixhaven Initiate, Artificer Initiate, Divinely Favored, Martial Adept, Eldritch Adept, Metamagic Adept, Fighting Initiate...).
- Las 193 dotes con `abilityIncrease` en los datos funcionan en la parte de característica; **5 dotes de 2014 tienen el +1 en el texto pero `abilityIncrease: null`** en los datos (ver "Patrones comunes").

## Tabla 2024 (197 dotes)

| Dote | Qué ofrece | Estado | Qué falta exactamente | Archivos |
|---|---|---|---|---|
| `ability-score-improvement` | +2 a una o +1 a dos características (máx. 20); repetible | ✅ | `slotPicks` lo trata aparte (2 picks de las 6 características) | level-up.ts, character-create.ts |
| `abjuration-adept` | +1 INT/SAB/CAR; conjuros siempre preparados según tabla de casillas (Shield, Lesser Restoration, Protection from Energy, Banishment, Mass Cure Wounds); PG temp = 2x nivel de casilla | ⚠️ | ASI OK. Los conjuros de la tabla "Spell Slot Level \| Spell" no se leen (`parsed` vacío): faltan Siempre preparados por nivel de casilla. PG temp: texto | FE parseText (tablas) |
| `actor` | +1 CAR; ventajas y mímica | ✅ | ASI OK; resto texto | — |
| `alert` | Competencia en Iniciativa (+PB); intercambiar iniciativa | ✅ | `engine` suma PB a la iniciativa al leer "Initiative Proficiency". Intercambio: texto | ENG |
| `arcane-artist` | Truco Minor Illusion (INT/SAB/CAR a elegir); Inspiring Magic 1/larga | ✅ | Truco, selector de característica (`missing: ability`) y contador 1/larga OK | — |
| `arcane-eloquence` | Truco Vicious Mockery (INT/SAB/CAR); 1d4 a Engaño/Intimidación/Persuasión | ✅ | Truco y selector de característica OK; d4: texto | — |
| `arcane-infiltrator` | Truco Friends (INT/SAB/CAR); Cunning Diversion PB/larga | ✅ | Truco, selector y contador PB/larga OK | — |
| `arcane-omens` | Truco Guidance (INT/SAB/CAR); Helpful Premonition PB/larga | ✅ | Truco, selector y contador OK | — |
| `arcane-overload` | Truco Fire Bolt (INT/SAB/CAR); Power Surge 1/larga | ✅ | Truco, selector y contador OK | — |
| `arcane-restoration-ua` | +1 INT/SAB/CAR; Essence Rejuvenation 1/corto o largo | ✅ | ASI y contador (corto o largo) OK | — |
| `arcane-safeguard` | Truco Resistance (INT/SAB/CAR) lanzable como acción adicional PB/larga; PG temp al Ayudar | ✅ | Truco, selector y contador PB/larga OK | — |
| `arcane-undertaker` | Un truco de Clérigo/Mago de Nigromancia (INT/SAB/CAR); Understanding of Death 1/larga | ✅ | `FEAT_PICKS` (truco por escuela) + selector de característica + contador OK | — |
| `arcane-warrior` | Estilo: 2 trucos de Mago (INT/SAB/CAR); cambiables al subir nivel | ✅ | `FEAT_PICKS` (2 trucos de mago) + selector de característica OK | — |
| `archery` | +2 ataque con armas a distancia | ✅ | Lo lee `trait-effects` (`rangedAttack`) | — |
| `athlete` | +1 FUE/DES; velocidad de trepar = velocidad; levantarse con 5 pies | ✅ | ASI y trepar OK (volcado climb 30); el resto texto | — |
| `atmokinesis-ua` | Truco Shocking Grasp; Fog Cloud 1/larga; Gust of Wind (nv3) igual; INT/SAB/CAR; cambia daño a rayo | ⚠️ | Trucos, Fog Cloud 1/larga y selector de característica OK. Falta el uso gratis 1/larga de Gust of Wind (nv3): "can cast it the same way" no se lee, sale siempre preparado sin contador ni casillas | FE parseText |
| `atoners-grace-ua` | Ventajas de Persuasión/Ayuda ajena | — texto basta | Todo situacional | — |
| `biokinesis-ua` | Truco Spare the Dying; Healing Word 1/larga; Arcane Vigor (nv3) igual; Bend Life Energy PB/larga | ⚠️ | Contadores, Healing Word y selector OK. Falta uso gratis 1/larga de Arcane Vigor (nv3, "the same way") | FE parseText |
| `blind-fighting` | Estilo: Blindsight 10 pies | ✅ | Lo lee `trait-effects` (sentido incondicional) | — |
| `bloodlust` | +1 FUE/DES/CON; DG 1-2 cuentan 3; Sanguine Feast PB/larga | ✅ | ASI y contador PB/larga OK | — |
| `bomber` | +1 DES; lanzar frascos a 40 pies | ✅ | ASI OK; resto texto | — |
| `boon-of-blazing-dawn` | +1 a elegir (máx. 30); inmunidad a radiante; daño radiante en armas | ⚠️ | ASI (tope 30) OK. La ficha no modela inmunidades a daño (solo `resistances`): falta mostrar Inmunidad radiante | ENG, sheet.ts |
| `boon-of-bloodshed` | +1 a elegir (30); ventaja tras matar; daño extra PB | ✅ | ASI OK; resto situacional | — |
| `boon-of-bountiful-health` | +1 a elegir (30); +5 PG temp; DG al máximo | ✅ | ASI OK; resto texto | — |
| `boon-of-combat-prowess` | +1 a elegir (30); Peerless Aim (convertir fallo en acierto) | ✅ | ASI OK; sin recurso (hasta inicio de siguiente turno): texto | — |
| `boon-of-communication` | +1 INT/SAB/CAR (30); telepatía 120 pies; idiomas | ✅ | ASI OK; telepatía no es un sentido de la ficha: texto | — |
| `boon-of-desperate-resilience` | +1 FUE/CON (30); resistencia a todo salvo fuerza si Ensangrentado | ✅ | ASI OK; resistencia condicionada: texto | — |
| `boon-of-dimensional-travel` | +1 a elegir (30); teletransporte 30 pies | ✅ | ASI OK | — |
| `boon-of-energy-resistance` | +1 a elegir (30); resistencia a 2 tipos a elegir (cambiables en descanso largo); redirección | ✅ | Selector de 2 tipos en el diálogo de descanso (`restPicks`, count 2, 9 tipos) OK. Reacción de redirección: texto | — |
| `boon-of-erupting-spellpower` | +1 INT/SAB/CAR (30); Spell Overload 1/(iniciativa, corto o largo) | ✅ | ASI y contador 1 (corto o largo) OK | — |
| `boon-of-exquisite-radiance` | +1 a elegir (30); Powerful Radiance 1/larga | ✅ | ASI y contador OK | — |
| `boon-of-fate` | +1 a elegir (30); Improve Fate 1/(iniciativa, corto o largo) | ✅ | ASI y contador OK | — |
| `boon-of-fluid-forms` | +1 INT/SAB/CAR (30); Shapechanger 1/larga (hasta CR 10); +20 PG temp | ✅ | ASI y contador 1/larga OK (la frase de recarga está en un párrafo aparte; se lee bien). Transformación: texto | — |
| `boon-of-fortitude` | +1 a elegir (30); PG máx +40 | ✅ | PG 108 = 68 + 40 en el volcado | — |
| `boon-of-fortunes-favor` | +1 a elegir (30); repetir salvación (hasta inicio de siguiente turno) | ✅ | ASI OK; sin recurso: texto | — |
| `boon-of-irresistible-offense` | +1 FUE/DES (30); ignora resistencias físicas; daño extra en 20 | ✅ | ASI OK; resto texto | — |
| `boon-of-looming-shadows` | +1 a elegir (30); alcance +10; Esquivar adicional | ✅ | ASI OK | — |
| `boon-of-magic-school-mastery` | +1 INT/SAB/CAR (30); escuela; conjuro nv1 de la escuela a voluntad; conjuro nv≤7 1/larga | ✅ | `FEAT_PICKS` completo: escuela, conjuro, signature y característica de la clase | — |
| `boon-of-misty-escape` | +1 INT/SAB/CAR (30); Gaseous Form 1/larga; característica = la aumentada | ✅ | ASI, contador 1/larga y modo "increased" OK. (Gaseous Form no aparece como conjuro concedido: el contador basta) | — |
| `boon-of-poison-mastery` | +1 a elegir (30); inmunidad a veneno y a Envenenado; dados máximos | ⚠️ | ASI OK. No se modelan inmunidades (daño veneno ni condición Envenenado) | ENG, sheet.ts |
| `boon-of-recovery` | +1 a elegir (30); Last Stand 1/larga; reserva de 10d10 (recupera en larga) | ⚠️ | Last Stand 1/larga OK. Falta el contador de la reserva de 10d10 de Recover Vitality (larga): "You have a pool of ten d10s" no se lee | FE parseText (pool) |
| `boon-of-revelry` | +1 INT/SAB/CAR (30); Otto's Irresistible Dance siempre preparado, gratis 1/larga | ✅ | Conjuro, contador 1/larga y casillas OK. Obs: no dice característica; se usa la "mejor" de INT/SAB/CAR | ENG |
| `boon-of-siberys` | +1 a elegir (30); conjuro nv≤8 de hechicero o tabla Siberys, gratis 1/(corto o largo); INT/SAB/CAR | ✅ | `FEAT_PICKS` con tabla leída del texto, `slotless: short-or-long` y selector de característica OK | — |
| `boon-of-skill` | +1 a elegir (30); competencia en todas las habilidades; Pericia en una | ❌ | Sin mecánica. "You gain proficiency in all skills" no se lee (la regex pide nombres de habilidad) y falta un selector de pericia (habilidad sin pericia) | TE (skills), FE FEAT_PICKS |
| `boon-of-speed` | +1 a elegir (30); velocidad +30; Disengage adicional | ✅ | Velocidad 60 en el volcado | — |
| `boon-of-spell-recall` | +1 INT/SAB/CAR (30); casilla no gastada con 1d4 | ✅ | ASI OK; tirada: texto | — |
| `boon-of-terror` | +1 CAR (30); inmunidad a Asustado; Flee Fools 1/(corto o largo); Intimidación competencia y pericia | ⚠️ | ASI y contador OK. Falta Intimidación competencia+pericia ("Proficiency" con mayúscula: la regex de `trait-effects` es sensible a mayúsculas y la frase tiene "if") e inmunidad a Asustado (no modelada) | TE (skills regex), ENG |
| `boon-of-the-bandit-king-ua` | +1 a elegir (30); Dastardly Charm 1/(corto o largo) | ✅ | ASI y contador OK | — |
| `boon-of-the-bright-sun` | +1 CON/SAB/CAR (30); emanación de luz; 10 PG temp | ✅ | ASI OK; resto texto/acción | — |
| `boon-of-the-cleansed-heart-ua` | +1 a elegir (30); Dispel Evil and Good sin casilla; inmunidad a necrótico | ⚠️ | ASI y conjuro a voluntad OK. Falta modelar la inmunidad a necrótico | ENG, sheet.ts |
| `boon-of-the-furious-storm` | +1 INT/SAB/CAR (30); resistencia rayo y trueno | ✅ | Resistencias OK (volcado). Inmunidad solo Ensangrentado: texto | — |
| `boon-of-the-hunters-eye-ua` | +1 a elegir (30); captura rápida; Studied Hunter | ✅ | ASI OK; resto texto | — |
| `boon-of-the-iron-mind` | +1 a elegir (30); concentración | ✅ | ASI OK | — |
| `boon-of-the-night-spirit` | +1 a elegir (30); invisible en penumbra; resistencia en penumbra | ✅ | ASI OK; condicionado: texto | — |
| `boon-of-the-soul-drinker` | +1 a elegir (30); resistencia frío y necrótico; Siphon Life 1/(corto o largo) | ✅ | Resistencias (Cold, Necrotic) y contador OK. Obs: `featRules.resistances` solo trae Cold; la ficha acaba bien porque `trait-effects` lee ambas | — |
| `boon-of-truesight` | +1 a elegir (30); Truesight 60 | ✅ | Sentido leído por `trait-effects` | — |
| `boon-of-unwavering-devotion-ua` | +1 a elegir (30); Undeniable Confidence 1/(iniciativa, corto o largo) | ✅ | ASI y contador OK | — |
| `charger` | +1 FUE/DES; Dash +10; Charge Attack | ✅ | ASI OK; resto condicional | — |
| `chef` | +1 CON/SAB; utensilios de cocina; comida y golosinas | ✅ | ASI y utensilios OK; comida y golosinas con PB: texto | — |
| `child-of-the-sun` | Faerie Fire gratis 1/larga (INT/SAB/CAR); ventaja vs cegado | ✅ | Conjuro, contador y selector de característica OK | — |
| `clairsentience-ua` | Truco Guidance; Detect Evil and Good 1/larga; See Invisibility (nv3) igual; INT/SAB/CAR; Minor Foreknowledge PB/larga | ⚠️ | Contadores y selector OK. Falta el uso gratis 1/larga de See Invisibility (nv3, "the same way") | FE parseText |
| `cloying-mists` | +1 INT/SAB/CAR; Fog Cloud gratis 1/larga (característica aumentada); niebla | ✅ | ASI, conjuro, contador 1/larga y modo "increased" OK | — |
| `cold-caster` | +1 INT/SAB/CAR; truco Ray of Frost (alternativo de mago si ya lo tiene); Frostbite | ✅ | ASI y truco OK; la alternativa si ya lo conoce es texto | — |
| `conjuration-adept` | +1 INT/SAB/CAR; conjuros siempre preparados por nivel de casilla (Entangle, Misty Step, Conjure Animals, Dimension Door, Conjure Elemental) | ⚠️ | ASI OK. La tabla "Spell Slot Level \| Spell" no se lee: faltan los 5 conjuros siempre preparados (se activan al tener casilla de ese nivel) | FE parseText (tablas) |
| `crafter` | 3 herramientas de artesano a elegir; descuento; fabricación rápida | ✅ | `FEAT_PICKS` (tools 3 de Artisan's Tools) OK. La tabla de fabricación es texto (pendiente en CLAUDE.md) | — |
| `crossbow-expert` | +1 DES; ignora Recarga; sin desventaja a corta distancia | ✅ | ASI OK; resto texto | — |
| `crusher` | +1 FUE/CON; empuje y crítico | ✅ | ASI OK; resto condicional | — |
| `cryokinesis-ua` | Truco Ray of Frost; Armor of Agathys e Ice Knife gratis 1/larga cada uno; INT/SAB/CAR; cambia daño a frío | ✅ | Truco, 2 contadores y selector de característica OK | — |
| `cult-of-the-dragon-initiate` | Draconic (o idioma a elegir si ya lo sabe); Dragon's Terror; Inspired by Fear 1/(corto o largo) | ✅ | Idioma (`FEAT_PICKS.language`) y contador OK | — |
| `death-knight-ascension-ua` | +1 FUE/CAR; resistencia necrótico y veneno; tipo Muerto viviente; Hellfire Orb con Puntos de Muerte | ✅ | ASI, resistencias y reserva de Death Points (compartida con Initiate) OK. Tipo de criatura y orbe: texto | — |
| `death-knight-initiate-ua` | +1 FUE/CAR; Death Points = PB/larga; Wrathful Smite por 1 punto; CAR | ✅ | Reserva `death-points` y conjuro que gasta 1 punto OK | — |
| `deathly-presence-ua` | +1 FUE/CON/CAR; Fear por 1 Death Point | ✅ | Conjuro que gasta la reserva OK | — |
| `defense` | Estilo: +1 CA con armadura | ✅ | `ac:+1` aplicado solo con armadura puesta | — |
| `defensive-duelist` | +1 DES; reacción Parry (+PB a la CA) | ✅ | ASI OK; reacción sin recurso: texto | — |
| `delicious-pain` | +1 a elegir; Toughened Flesh 1/(corto o largo) | ✅ | ASI y contador OK | — |
| `divination-adept` | +1 INT/SAB/CAR; conjuros por nivel de casilla (Detect Evil and Good, Mind Spike, Clairvoyance, Divination, Scrying); Prescient Intervention 1/larga | ⚠️ | ASI y contador OK. Falta la tabla de conjuros siempre preparados por nivel de casilla. (Recuperar el uso al lanzar adivinación: texto) | FE parseText (tablas) |
| `dragonscarred` | +1 CON/CAR; resistencia a 1 de 5 tipos (al elegir la dote) | ✅ | `FEAT_PICKS.resistance` OK (selector en la dote, no cambia en descanso) | — |
| `dread-authority-ua` | +1 CON/CAR; Command por 1 Death Point | ✅ | Conjuro con la reserva OK | — |
| `dual-wielder` | +1 FUE/DES; ataque extra con arma ligera | ✅ | ASI OK; resto texto | — |
| `dueling` | Estilo: +2 daño con arma cuerpo a cuerpo a una mano | ✅ | Lo lee `trait-effects` (`duelingDamage`) | — |
| `durable` | +1 CON; ventaja salvaciones de muerte; gastar DG como acción adicional | ✅ | ASI OK; resto texto | — |
| `elemental-adept` | +1 INT/SAB/CAR; tipo de daño elegido (ignora resistencia, 1→2); repetible con tipos distintos | ⚠️ | ASI OK. No hay selector para guardar el tipo de daño (Ácido/Frío/Fuego/Rayo/Trueno); su efecto es de mesa | FE FEAT_PICKS, FC |
| `elemental-familiar` | +1 a elegir; el familiar recibe un tipo de energía y Energy Pulse | ✅ | ASI OK; el tipo se elige al invocar: texto | — |
| `emerald-enclave-fledgling` | Speak with Animals siempre preparado (INT/SAB/CAR); Tag Team | ✅ | Conjuro y selector de característica OK | — |
| `empath-ua` | Charm Person gratis 1/larga; Calm Emotions (nv3) igual; Emotional Sense PB/larga; INT/SAB/CAR | ⚠️ | Contadores, Charm Person y selector OK. Falta el uso gratis 1/larga de Calm Emotions (nv3, "the same way") | FE parseText |
| `enchantment-adept` | +1 INT/SAB/CAR; conjuros por nivel de casilla (Dissonant Whispers, Enthrall, Hold Person, Dominate Beast, Modify Memory) | ⚠️ | ASI OK. Falta la tabla de conjuros siempre preparados por nivel de casilla | FE parseText (tablas) |
| `enclave-magic` | +1 INT/SAB/CAR; Beast Sense gratis 1/larga (característica aumentada) | ✅ | ASI, conjuro y contador OK | — |
| `evocation-adept` | +1 INT/SAB/CAR; conjuros por nivel de casilla (Chromatic Orb, Shatter, Fireball, Vitriolic Sphere, Wall of Force) | ⚠️ | ASI OK. Falta la tabla de conjuros siempre preparados por nivel de casilla | FE parseText (tablas) |
| `fairy-trickster` | +1 DES/CAR; Flustering Strike PB/larga | ✅ | ASI y contador OK | — |
| `familiar-friend` | Find Familiar gratis 1/larga (INT/SAB/CAR); Helpful Friend PB/larga | ✅ | Conjuro, contador de conjuro, contador PB/larga y selector OK | — |
| `fey-touched` | +1 INT/SAB/CAR; Misty Step + 1 conjuro nv1 de adivinación/encantamiento, gratis 1/larga cada uno | ✅ | Misty Step con contador y `FEAT_PICKS` (escuelas) OK; el conjuro elegido crea su contador al elegirlo (`SLOTLESS_FREE`) | — |
| `flesh-morpher-ua` | Longstrider gratis 1/larga; Alter Self (nv3) igual; Flexible Flesh PB/larga; INT/SAB/CAR | ⚠️ | Contadores y selector OK. Falta el uso gratis 1/larga de Alter Self (nv3, "the same way") | FE parseText |
| `full-ceremorphosis-ua` | +1 INT; dados de energía psiónica d10/d12; tipo Aberración; elegir especialización (tentáculos o conjuros de Mind Flayer, repetible) | ⚠️ | ASI OK. ERROR: Detect Thoughts, Levitate y Mind Blast salen "a voluntad" siendo que cuestan 1 Psionic Energy Die (hace falta el modo `psionic-energy-dice` como `deathPoints`). Falta selector de la especialización (siempre da los 3 conjuros) | FE parseText (atWill), FC |
| `genie-magic` | +1 INT/SAB/CAR; Wish Magic 1/larga (conjuro nv1 de hechicero, sube a nv2/nv3) | ✅ | ASI, contador 1/larga y modo "increased" OK; el conjuro se elige en cada uso: texto | — |
| `grappler` | +1 FUE/DES; agarrar y golpear | ✅ | ASI OK; resto texto | — |
| `great-weapon-fighting` | Estilo: 1-2 cuentan como 3 a dos manos | ✅ | Nota de combate `gwf` | — |
| `great-weapon-master` | +1 FUE; daño extra +PB con arma Pesada; Hew | ✅ | ASI OK y nota `gwm` | — |
| `harbinger-of-doom-ua` | +1 FUE/CON/CAR; Bane por 1 Death Point | ✅ | Conjuro con la reserva OK | — |
| `harper-agent` | Thieves' Cant; 1 instrumento musical a elegir | ✅ | Idioma e instrumento (`FEAT_PICKS`) OK | — |
| `harper-teamwork` | +1 DES/CAR; ayuda y salvaciones | ✅ | ASI OK; resto texto | — |
| `healer` | Battle Medic; reroll de curación | — texto basta | Usa un Healer's Kit: situacional | — |
| `heavily-armored` | +1 CON/FUE; formación con armadura pesada | ✅ | ASI y competencia (engine `proficiencies`) OK | — |
| `heavy-armor-master` | +1 CON/FUE; reducción de daño B/P/C = PB con armadura pesada | ✅ | ASI OK; reducción condicionada a armadura: texto | — |
| `illithid-thrallmaker-ua` | +1 INT/CAR; Psionic Energy Dice d8; telepatía 10; Charm Person gastando 1 dado | ⚠️ | ASI OK. ERROR: Charm Person sale "a voluntad" cuando cuesta 1 Psionic Energy Die (la reserva viene de Tadpole Host). Telepatía: texto | FE parseText (atWill) |
| `illusion-adept` | +1 INT/SAB/CAR; conjuros por nivel de casilla (Silent Image, Phantasmal Force, Major Image, Hallucinatory Terrain, Seeming) | ⚠️ | ASI OK. Falta la tabla de conjuros siempre preparados por nivel de casilla | FE parseText (tablas) |
| `inspiring-leader` | +1 SAB/CAR; PG temporales al descansar (nivel + modificador) | ✅ | ASI OK; el reparto es texto | — |
| `interception` | Estilo: reacción reduce daño 1d10+PB | ✅ | Nota de combate `interception` | — |
| `keen-mind` | +1 INT; 1 habilidad de 5 (competencia o pericia); Study adicional | ✅ | `FEAT_PICKS.skills` con `upgrade` (pericia si ya competente) OK | — |
| `lich-ascension-ua` | +1 INT/SAB/CAR; resistencia necrótico/veneno; Fear gratis (mod, mín. 1)/larga; tipo Muerto viviente | ✅ | ASI, resistencias, selector, y contador (`freeUses 'mod'`) OK | — |
| `lich-initiate-ua` | +1 INT/SAB/CAR; filacteria; Soul Siphon | ✅ | ASI OK; resto texto (sin recurso) | — |
| `light-bringer` | +1 INT/SAB/CAR; truco Light; Solar Luminance 1/larga; Sun's Healing 1/(corto o largo) | ✅ | Truco y los 2 contadores OK. (Truco alternativo si ya lo conoce: texto) | — |
| `lightly-armored` | +1 FUE/DES; armadura ligera y escudos | ✅ | ASI y competencias OK | — |
| `lordly-resolve` | +1 FUE/CAR; Standard Bearer 1/larga | ✅ | ASI y contador OK | — |
| `lords-alliance-agent` | Inspiración heroica en críticos; ventaja | — texto basta | Situacional | — |
| `love-bites` | +1 a elegir; Endearing Pain 1/(corto o largo) | ✅ | ASI y contador OK | — |
| `lucky` | Luck Points = PB/larga; ventaja/desventaja | ✅ | Contador Luck Points OK (etiqueta propia) | — |
| `mage-slayer` | +1 FUE/DES; Guarded Mind 1/(corto o largo) | ✅ | ASI y contador OK | — |
| `magic-connoisseur` | +1 INT/SAB/CAR; 1 conjuro nv1 y 1 nv2 de la lista de Magic Initiate, gratis 1/larga cada uno; misma característica | ⚠️ | ASI OK. `parsed` vacío: faltan los 2 selectores de conjuro (nv1 y nv2 de la lista y característica de Magic Initiate) y sus contadores 1/larga | FE FEAT_PICKS, FC |
| `magic-initiate` | Lista (clérigo/druida/mago), 2 trucos, 1 conjuro nv1 (gratis 1/larga), INT/SAB/CAR; repetible | ✅ | `FEAT_PICKS`: lista, 2 trucos, conjuro y característica; también con lista fija por trasfondo | — |
| `martial-weapon-training` | +1 FUE/DES; competencia con armas marciales | ✅ | ASI y competencia OK | — |
| `medium-armor-master` | +1 FUE/DES; con armadura media sumar 3 (no 2) de DES si DES ≥ 16 | ⚠️ | ASI OK. No se aplica el tope de DES +3 en armadura media (el motor usa siempre `armor.dexCap`; `parsed.ac` = 0) | ENG armorClass |
| `mind-whisperer-ua` | Mind Sliver; Dissonant Whispers gratis 1/larga; Limited Telepathy 1/(corto o largo); INT/SAB/CAR | ✅ | Truco, contadores y selector OK | — |
| `moderately-armored` | +1 FUE/DES; armadura media | ✅ | ASI y competencia OK | — |
| `mounted-combatant` | +1 FUE/DES/SAB; ventajas a lomos | ✅ | ASI OK; resto texto | — |
| `musician` | 3 instrumentos a elegir; canción | ✅ | `FEAT_PICKS` (tools 3, Musical Instrument) OK | — |
| `mythal-touched` | +1 INT/SAB/CAR; Mythal Ward PB/larga; tabla d20 | ✅ | ASI y contador OK; tabla: texto | — |
| `necromancy-adept` | +1 INT/SAB/CAR; conjuros por nivel de casilla (Inflict Wounds, Ray of Enfeeblement, Vampiric Touch, Blight, Raise Dead) | ⚠️ | ASI OK. Falta la tabla de conjuros siempre preparados por nivel de casilla | FE parseText (tablas) |
| `observant` | +1 INT/SAB; 1 habilidad de 3 (competencia o pericia); Search adicional | ✅ | `FEAT_PICKS.skills` con `upgrade` OK | — |
| `orders-resilience` | +1 FUE/SAB/CAR; levantarse; ventaja FUE | ✅ | ASI OK | — |
| `otherworldly-familiar` | +1 a elegir; el familiar recibe resistencia | ✅ | ASI OK; resto texto del familiar | — |
| `pack-fighting` | Estilo: +1/+2 de daño con aliado adyacente | — texto basta | Bono condicionado a aliados | — |
| `piercer` | +1 FUE/DES; repetir dado y crítico | ✅ | ASI OK | — |
| `poisoner` | +1 DES/INT; ignora resistencia a veneno; Poisoner's Kit; venenos | ✅ | ASI y herramienta (`trait-effects`) OK; venenos: texto | — |
| `polearm-master` | +1 DES/FUE; ataque con extremo opuesto; Reactive Strike | ✅ | ASI OK | — |
| `portal-jumper` | Resistencia a necrótico/psíquico/radiante (a elegir); Portal Step PB/larga | ✅ | Selector de resistencia y contador OK. Obs: sale como elección "de descanso" (cambiable en cada Descanso Largo) aunque el texto dice "choose when you select this feat": `resistanceChangesOnRest` lee "when you finish a Long Rest" de la frase del contador | ENG, FE resistanceChangesOnRest |
| `prone-fighting` | Estilo: sin desventaja por Tumbado | — texto basta | Situacional | — |
| `protection` | Estilo: reacción con escudo | ✅ | Nota de combate `protection` | — |
| `psi-trickster-ua` | Minor Illusion; Disguise Self gratis 1/larga; Cunning Mind PB/larga; INT/SAB/CAR | ✅ | Truco, contadores y selector OK | — |
| `psykineticist-ua` | Telekinetic Fling; Thunderwave gratis 1/larga; Psi Boost PB/larga; INT/SAB/CAR | ✅ | Truco, contadores y selector OK | — |
| `purple-dragon-commandant` | +1 FUE/DES; Encourage Ally PB/larga; ventaja Ensangrentado | ✅ | ASI y contador OK | — |
| `purple-dragon-rook` | 1 habilidad de 3 (Insight/Performance/Persuasion); Rallying Cry 1/larga | ✅ | `FEAT_PICKS.skills` y contador OK | — |
| `putrefy` | +1 a elegir; Necrosis 1/(corto o largo) | ✅ | ASI y contador OK | — |
| `pyrokinesis-ua` | Produce Flame; Burning Hands gratis 1/larga; Scorching Ray (nv3) igual; INT/SAB/CAR | ⚠️ | Truco, Burning Hands y selector OK. Falta el uso gratis 1/larga de Scorching Ray (nv3, "the same way") | FE parseText |
| `raised-by-cultists-ua` | Inspiración heroica y ventaja a aliado | — texto basta | Reacciones sin recurso | — |
| `rebuke` | +1 a elegir; Radiant Strike 1/(corto o largo) | ✅ | ASI y contador OK | — |
| `resilient` | +1 a una característica sin competencia en salvación + competencia en esa salvación | ✅ | La ficha suma competencia en la salvación elegida (`engine`, `source === 'resilient'`). Obs: el selector ofrece las 6 aunque ya tenga competencia en alguna | level-up.ts |
| `ritual-caster` | +1 INT/SAB/CAR; PB conjuros ritual nv1 siempre preparados; Quick Ritual 1/larga | ⚠️ | ASI y contador Quick Ritual OK. Faltan los PB conjuros ritual de nivel 1 a elegir (crece con el PB) | FE FEAT_PICKS, FC |
| `savage-attacker` | Tirar dados de arma dos veces 1/turno | — texto basta | Sin recurso por descanso | — |
| `sentinel` | +1 FUE/DES; ataque de oportunidad | ✅ | ASI OK | — |
| `shadow-touched` | +1 INT/SAB/CAR; Invisibility + 1 conjuro nv1 de ilusión/nigromancia, gratis 1/larga | ✅ | Igual que Fey Touched: OK | — |
| `shadowmoor-hexer` | Hex gratis 1/larga (INT/SAB/CAR); daño psíquico | ✅ | Conjuro, contador y selector OK | — |
| `sharp-eye` | Ventaja en Search/Study PB/larga | ✅ | Contador PB/larga OK | — |
| `sharpshooter` | +1 DES; ignora cobertura/larga distancia | ✅ | ASI OK | — |
| `shield-master` | +1 FUE; Shield Bash; Interpose Shield | ✅ | ASI OK; resto texto | — |
| `shifting-combatant` | +1 FUE/DES; Domino Strike | ✅ | ASI OK | — |
| `skill-expert` | +1 a elegir; 1 habilidad de competencia + 1 de pericia | ⚠️ | ASI OK. Sin `FEAT_PICKS`: faltan el selector de la habilidad nueva y el de la habilidad con Pericia | FE FEAT_PICKS, FC, ENG |
| `skilled` | 3 habilidades o herramientas a elegir | ✅ | `FEAT_PICKS.skillsOrTools: 3` OK | — |
| `skulker` | +1 DES; Blindsight 10 pies; ventaja Sigilo | ✅ | ASI y sentido (volcado) OK | — |
| `slasher` | +1 FUE/DES; Hamstring; crítico | ✅ | ASI OK | — |
| `soothing-familiar` | +1 a elegir; emanación del familiar | ✅ | ASI OK | — |
| `speedy` | +1 DES/CON; velocidad +10 | ✅ | Velocidad 40 en el volcado | — |
| `spell-resistant` | +1 DES/CON; resistencia a 1 de 4 tipos; Magic Resistant PB/larga | ✅ | Selector de resistencia y contador OK. Obs: el selector sale como elección de descanso por el mismo motivo que Portal Jumper | ENG |
| `spell-sniper` | +1 INT/SAB/CAR; ignora cobertura; +60 de alcance | ✅ | ASI OK | — |
| `spell-subterfuge` | +1 INT/SAB/CAR; Shrouding Spells = modificador de la característica aumentada/larga | ⚠️ | ASI OK. Falta contador: "a number of times equal to the ability modifier of the score increased by this feat" no lo lee `parseText` (la regex pide la característica por nombre) | FE parseText |
| `spellfire-adept` | +1 INT/SAB/CAR; dados de golpe a daño radiante | ✅ | ASI OK | — |
| `spellfire-spark` | Sacred Flame (INT/SAB/CAR) como acción adicional PB/larga; Magic Absorption | ✅ | Truco, contador PB/larga y selector OK | — |
| `street-justice` | +1 FUE/DES; ventajas | ✅ | ASI OK | — |
| `survivor` | Reroll iniciativa; Steel Yourself 1/larga | ✅ | Contador 1/larga OK | — |
| `tactical-combatant` | +1 FUE/DES; Buffering Strike y Honed Instincts 1/(iniciativa, corto o largo) cada uno | ✅ | ASI y 2 contadores OK | — |
| `tadpole-host-ua` | +1 INT; Mind Sliver; Psionic Energy Dice = PB/larga (d6) | ✅ | ASI, truco y reserva `psionic-energy-dice` OK | — |
| `tadpoles-safeguard-ua` | +1 CON/INT; PED d8; telepatía 10; Shield gastando 1 dado | ⚠️ | ASI OK. ERROR: Shield sale "a voluntad" (cuesta 1 Psionic Energy Die de la reserva de Tadpole Host) | FE parseText (atWill) |
| `tavern-brawler` | Daño desarmado 1d4+FUE; rerolls; armas improvisadas; empujar | ⚠️ | Competencia con armas improvisadas OK. Falta el golpe desarmado 1d4+FUE (con repetición de 1) en la tabla de ataques (solo existe para Unarmed Fighting) | attacks.ts, ENG combat |
| `telekinetic` | +1 INT/SAB/CAR; truco Mage Hand; empujón | ✅ | ASI, truco (modo "increased") OK | — |
| `telepathic` | +1 INT/SAB/CAR; Detect Thoughts gratis 1/larga | ✅ | ASI, conjuro y contador OK | — |
| `thrown-weapon-fighting` | Estilo: +2 daño con arma arrojadiza a distancia | ✅ | Lo lee `trait-effects` (`thrownDamage`) | — |
| `tireless-reveler` | Inspiración heroica PB/(corto o largo) | ✅ | Contador OK | — |
| `tough` | PG máx +2 por nivel | ✅ | PG 84 = 68 + 2x8 en el volcado | — |
| `transfer-life-ua` | +1 INT/SAB/CAR; PG temporales con Soul Siphon | ✅ | ASI OK | — |
| `transmutation-adept` | +1 INT/SAB/CAR; conjuros por nivel de casilla (Jump, Spider Climb, Slow, Polymorph, Animate Objects) | ⚠️ | ASI OK. Falta la tabla de conjuros siempre preparados por nivel de casilla | FE parseText (tablas) |
| `transmuted-anatomy` | Velocidad +5; Resilient Anatomy PB/larga | ✅ | Velocidad 35 y contador OK | — |
| `trapper-ua` | Ventajas de Study y rastreo; trampa con acción adicional | — texto basta | Situacional | — |
| `treacherous-allure` | +1 INT/SAB/CAR; Charm Person gratis 1/larga | ✅ | ASI, conjuro y contador OK | — |
| `two-weapon-fighting` | Estilo: añadir modificador al ataque extra ligero | ✅ | Nota de combate `twf` | — |
| `tyro-of-the-gauntlet` | Reacción impedir empuje; Ready | — texto basta | Situacional | — |
| `ulitharids-might-ua` | +1 FUE/DES/CON; PED d8; telepatía 10; tentáculos | ✅ | ASI OK; resto texto | — |
| `unarmed-fighting` | Estilo: golpe desarmado 1d6/1d8 + FUE; 1d4 al agarrado | ✅ | Bandera `unarmedFighting` en el combate | — |
| `undead-grasp-ua` | +1 INT/SAB/CAR; Chill Touch (alternativo si ya lo conoce); Paralyzing Touch | ✅ | ASI, truco y selector OK | — |
| `underhanded-ua` | Mover 10 pies tras iniciativa; derribar | — texto basta | Situacional | — |
| `unholy-steed-ua` | +1 FUE/CON; Find Steed por 1 Death Point | ✅ | Conjuro con la reserva OK | — |
| `vampire-hunter` | Ventaja; Vitality Ward 1/(corto o largo) | ✅ | Contador OK | — |
| `vampire-touched` | +1 INT/SAB/CAR; Spider Climb + 1 conjuro nv1 de encantamiento/ilusión, gratis 1/larga | ✅ | Igual que Fey Touched: OK | — |
| `vampires-plaything` | Poción de curación/antitoxina al descansar; Timely Retreat PB/larga; vínculo | ✅ | Contador PB/larga OK; resto texto | — |
| `war-caster` | +1 INT/SAB/CAR; ventajas de concentración | ✅ | ASI OK | — |
| `warlike-familiar` | +1 a elegir; Battle Familiar gratis 1/larga (característica de Familiar Friend) | ✅ | Conjuro y contador OK; la característica sale de la elegida en Familiar Friend | — |
| `weapon-master` | +1 FUE/DES; maestría de 1 arma (cambiable en descanso largo) | ⚠️ | ASI OK. No suma una casilla de Weapon Mastery (`weaponMasterySlots` solo cuenta clases): no se puede elegir la maestría que da | ENG weaponMasterySlots/combatOf, FC |
| `zhentarim-ruffian` | Dos tiradas de daño en AdO; ventaja de iniciativa | — texto basta | Situacional | — |
| `zhentarim-tactics` | +1 DES/CAR; Retaliate; Versatile Merc (pericia temporal en descanso largo) | ⚠️ | ASI OK. Falta elegir en cada Descanso Largo una habilidad competente con Pericia temporal (elección de descanso) | FE, restPicks |

## Tabla 2014 (116 dotes)

| Dote | Qué ofrece | Estado | Qué falta exactamente | Archivos |
|---|---|---|---|---|
| `acrobat-ua` | +1 DES (fijo); Acrobacias (doble si ya la tiene); CD15 acción adicional | ⚠️ | ASI y competencia en Acrobacias OK (texto fijo leído por `trait-effects`). Falta duplicar competencia (pericia) si ya es competente (nadie la sube a `expertise`). Acción adicional: texto basta | TE, ENG (skills) |
| `adept-of-the-black-robes` | Conjuro nivel 2 a elegir (Encantamiento/Nigromancia), gratis 1/descanso largo, característica = la de Initiate of High Sorcery; Life Channel (gasta DG) | ❌ | `parsed` vacío, sin `missing`. Falta selector de conjuro nivel 2 por escuelas, contador 1/larga del conjuro y heredar la característica de Initiate of High Sorcery. Life Channel: texto basta | FE (FEAT_PICKS), FC, ENG featGrants |
| `adept-of-the-red-robes` | Conjuro nivel 2 a elegir (Ilusión/Transmutación) gratis 1/larga; Magical Balance PB/larga | ⚠️ | Contador Magical Balance = PB, larga: OK. Falta selector del conjuro nivel 2 (escuelas ilusión/transmutación), su uso gratis 1/larga y la característica heredada de Initiate of High Sorcery | FE, FC, ENG |
| `adept-of-the-white-robes` | Conjuro nivel 2 a elegir (Abjuración/Adivinación) gratis 1/larga; Protective Ward (reacción gasta casilla) | ❌ | Falta selector del conjuro nivel 2 por escuelas, contador 1/larga y característica heredada. Protective Ward: texto basta | FE, FC, ENG |
| `aerenia-halflife` | +1 INT/SAB a elegir; resistencia necrótico y radiante; ventaja salvaciones de muerte; cambio necrótico→radiante | ✅ | ASI (INT/SAB) y resistencias OK (el volcado las muestra). El resto es texto. Obs: prerrequisito truncado "Elf (Aereni" en datos | DATA |
| `agent-of-order` | +1 a elegir (cualquiera); Stasis Strike PB/larga | ✅ | Contador PB/larga OK; ASI OK. CD usa la característica de Scion of the Outer Planes: texto basta | — |
| `alchemist-ua` | +1 INT; competencia suministros de alquimista (doble si ya); identificar poción; mejorar poción | ⚠️ | ASI OK. Falta la competencia con "alchemist's supplies": no está en `KNOWN_TOOLS` de `trait-effects.ts` (y tampoco se duplica). Resto texto | TE (KNOWN_TOOLS), ENG proficiencies |
| `animal-handler-ua` | +1 SAB; Trato con animales (doble si ya); ordenar bestias | ⚠️ | ASI y competencia OK. Falta duplicar competencia si ya la tiene. Resto texto | TE, ENG |
| `arcanist-ua` | +1 INT; Arcanos (doble); trucos Prestidigitation + conjuro Detect Magic 1/larga | ⚠️ | ASI OK, Detect Magic 1/larga OK. Falta Prestidigitation (la frase "learn the Prestidigitation and Detect Magic spells" no la lee `parseText`: solo toma lo de "can cast X without a spell slot"); falta duplicar Arcanos | FE parseText |
| `artificer-initiate` | 1 truco de Artificiero + 1 conjuro nv1 de Artificiero (gratis 1/larga), INT; herramienta de artesano a elegir | ❌ | `parsed` solo trae INT fijo; sin `FEAT_PICKS`. Falta: selector de truco (lista artificer), conjuro nv1 (artificer) con contador 1/larga, y 1 herramienta de artesano (`tools: {count 1, group Artisan's Tools}`) | FE FEAT_PICKS, FC |
| `baleful-scion` | +1 a elegir; Grasp of Avarice PB/larga | ✅ | Contador y ASI OK. Texto (necrótico, CD de Scion) basta | — |
| `barbed-hide-ua` | +1 CON/CAR; Intimidación (doble); barbas bonus | ⚠️ | `abilityIncrease: null` en datos aunque el texto da "+1 CON o CAR": no sale selector. Competencia Intimidación OK (sin duplicar) | DATA (scraper), TE |
| `blade-mastery-ua` | +1 ataque con 5 armas (espada corta/larga, cimitarra, estoque, mandoble); reacción +1 CA; ventaja AdO | ❌ | Falta el +1 al ataque con esas armas en la tabla de ataques (no hay bonos de ataque por dote salvo Archery). Reacción/ventaja AdO: texto basta | attacks.ts, TE attack |
| `blessed-warrior` | 2 trucos de Clérigo (cuentan como de Paladín), CAR; cambiar al subir nivel | ❌ | Solo se lee CAR fijo. Falta selector de 2 trucos de la lista de clérigo (`cantrips: {count 2, lists:['cleric']}`) | FE FEAT_PICKS, FC |
| `bountiful-luck` | Reacción: otorga repetir 1 a un aliado | — texto basta | Reacción sin recurso (impide Lucky racial hasta fin de siguiente turno) | — |
| `brawny-ua` | +1 FUE; Atletismo (doble); capacidad de carga | ⚠️ | ASI y competencia OK; falta duplicar competencia si ya la tiene. Carga: texto | TE, ENG |
| `burglar-ua` | +1 DES; competencia herramientas de ladrón (doble) | ⚠️ | ASI y herramientas (`KNOWN_TOOLS`) OK; falta duplicar competencia | TE |
| `cartomancer` | Truco Prestidigitation; Hidden Ace (conjuro imbuido tras descanso largo) | ✅ | Prestidigitation concedido OK. Hidden Ace es elección de descanso con consumo: texto basta. Obs: sin característica indicada, la CD usa la "mejor" de INT/SAB/CAR en vez de la de la clase | ENG |
| `close-quarters-shooter` | Sin desventaja a distancia pegado; ignora cobertura; +1 ataque a distancia | ✅ | El +1 a ataques a distancia lo lee `trait-effects` (patrón "bonus to attack rolls on ranged"). Resto texto | TE |
| `cohort-of-chaos` | +1 a elegir; tabla d4 de Chaotic Flare | ✅ | ASI OK; tabla aleatoria: texto basta | — |
| `critter-friend-ua` | Animal Handling; Speak with Animals A VOLUNTAD; Animal Friendship 1/larga; SAB | ⚠️ | Animal Friendship 1/larga OK. ERROR: Speak with Animals se marca como "gratis 1/larga" (sale contador) cuando es a voluntad: el párrafo contiene "long rest" de la frase siguiente. Falta duplicar competencia | FE parseText (casts/free/atWill) |
| `diplomat-ua` | +1 CAR; Persuasión (doble); encantar tras 1 min | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `divine-communications-ua` | +1 a la característica de Divinely Favored; Celestial + 2 idiomas a elegir; Augury y Commune gratis (1d4 descansos largos) | ⚠️ | ASI (a elegir entre 6) OK. Falta: idiomas (Celestial fijo + 2 a elegir), conjuros Augury/Commune sin casilla con recarga "1d4 descansos largos" (no hay contador) | FE, FC, ENG |
| `divinely-favored` | Truco de clérigo + conjuro nv1 según alineación (brujo/clérigo/druida) + Augury; los dos nv1 gratis 1/larga; INT/SAB/CAR | ⚠️ | Solo aparece Augury (siempre disponible, sin contador gratis). Falta: selector de truco (clérigo), conjuro nv1 (lista según alineación), característica (el texto "for this feat's spells is INT, WIS, or CHA" no lo reconoce la regex `choice`), contadores 1/larga | FE, FC |
| `dragon-fear` | +1 FUE/CON/CAR; rugido en vez de aliento | ✅ | ASI OK; el rugido gasta Breath Weapon: texto basta | — |
| `dragon-hide` | +1 FUE/CON/CAR; CA sin armadura 13+DES; garras 1d4+FUE cortante | ❌ | `abilityIncrease: null` en datos (texto da +1). CA 13+DES no se aplica (sheet ac=12): la regex de CA base exige "base Armor Class equals 13 plus"; el texto dice "calculate your AC as 13 + your Dexterity modifier". Garras no son arma natural (`natural-weapons.ts` solo especies) | DATA, TE unarmored, natural-weapons.ts |
| `dragon-wings-ua` | Vuelo 20 pies si no lleva armadura pesada | ❌ | Velocidad de vuelo no se aplica (frase condicional "if you aren't wearing heavy armor" descartada por `trait-effects`) | TE speeds/armorSpeed |
| `drow-high-magic` | Detect Magic a voluntad; Levitate y Dispel Magic 1/larga cada uno; CAR | ⚠️ | Solo Detect Magic, y mal: lo marca 1/larga siendo a voluntad. Faltan Levitate y Dispel Magic con contador 1/larga (lista "X. You also learn Y and Z, each of which..." no se lee) | FE parseText |
| `druidic-warrior` | 2 trucos de Druida (cuentan como de Explorador), SAB | ❌ | Solo SAB fijo. Falta selector de 2 trucos de la lista de druida | FE FEAT_PICKS, FC |
| `dungeon-delver` | Ventajas explorar/trampas; resistencia a daño de trampas | — texto basta | Todo situacional | — |
| `dwarven-fortitude` | +1 CON; Dodge: gasta un DG para curar | ✅ | ASI OK; gasto de DG en acción Dodge sin límite: texto basta | — |
| `eldritch-adept` | 1 invocación de brujo a elegir (cambiable al subir); característica INT/SAB/CAR | ❌ | Sin mecánica: no hay selector de invocación fuera de la clase brujo ni de característica de lanzamiento | FE, FC, `choices.options` |
| `elemental-touched-ua` | Truco Druidcraft o Thaumaturgy (INT/SAB/CAR); elemento tras descanso; efectos PB/larga | ⚠️ | Contador PB/larga OK. Falta selector de truco (Druidcraft o Thaumaturgy) y de la característica; elemento al descanso: texto | FE FEAT_PICKS, FC |
| `elven-accuracy` | +1 DES/INT/SAB/CAR; repetir dado con ventaja | ✅ | ASI OK; repetición: texto basta | — |
| `ember-of-the-fire-giant` | +1 FUE/CON/SAB; resistencia al fuego; Searing Ignition PB/larga | ✅ | ASI, resistencia (volcado "Fire") y contador PB/larga OK | — |
| `empathic-ua` | +1 SAB; Perspicacia (doble); acción | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `everybodys-friend-ua` | +1 CAR; Engaño y Persuasión (doble) | ⚠️ | `abilityIncrease: null` en datos (texto: +1 CAR). Competencias OK sin duplicar | DATA, TE |
| `fade-away` | +1 DES/INT; reacción invisible 1/descanso corto o largo | ✅ | ASI y contador 1 (corto o largo) OK | — |
| `fell-handed` | +1 ataque con hacha de mano/de batalla/gran hacha/martillo de guerra/maza; derribo | ❌ | Falta el +1 al ataque con esas armas (no hay bonos de ataque por arma). Resto texto | attacks.ts |
| `fey-teleportation` | +1 INT/CAR; idioma Sylvan; Misty Step 1 (corto o largo); INT | ⚠️ | ASI OK, Misty Step OK pero su contador se recarga solo en descanso largo (el texto dice corto o largo: `addSpell` usa `rest: 'long'` para conjuros del texto). Falta aprender el idioma Silvano (idioma fijo no se lee) | FE, ENG addSpell |
| `fighting-initiate` | Aprende 1 estilo de lucha de guerrero (distinto de los que ya tenga); reemplazable en cada ASI | ❌ | Sin mecánica: no hay selector de estilo de lucha dentro de una dote. El estilo no se aplica | FC, ENG |
| `flail-mastery-ua` | +1 ataque con mayal; +2 contra escudo; derribo en AdO | ❌ | Falta +1 al ataque con mayal. Resto texto | attacks.ts |
| `flames-of-phlegethos` | +1 INT/CAR; repetir 1 en daño de fuego; llamas | ✅ | ASI OK; el resto es texto | — |
| `fury-of-the-frost-giant` | +1 FUE/CON/SAB; resistencia al frío; Frigid Retaliation PB/larga | ✅ | ASI, resistencia "Cold" y contador PB/larga OK | — |
| `gift-of-the-chromatic-dragon` | Chromatic Infusion 1/larga; Reactive Resistance PB/larga | ✅ | Dos contadores correctos (etiquetas "…: Chromatic Infusion" y "…: Reactive Resistance"). El tipo de daño se elige en cada uso: texto | — |
| `gift-of-the-gem-dragon` | +1 INT/SAB/CAR; Telekinetic Reprisal PB/larga | ✅ | ASI y contador OK | — |
| `gift-of-the-metallic-dragon` | Cure Wounds gratis 1/larga + con casillas; característica INT/SAB/CAR a elegir; Protective Wings PB/larga | ⚠️ | Contadores y Cure Wounds OK. Falta selector de la característica de lanzamiento: el texto "…is Intelligence, Wisdom, or Charisma when you cast it with this feat (choose…)" no lo reconoce la regex `mode:'choice'`, así que se usa la "mejor" de INT/SAB/CAR sin preguntar | FE parseText (ability) |
| `gourmand-ua` | +1 CON; utensilios de cocina (doble); inspeccionar comida; comida DG extra | ⚠️ | ASI y utensilios (engine `proficiencies`) OK; falta duplicar competencia. Comida: texto | ENG |
| `grudge-bearer-ua` | +1 FUE/CON/SAB; tipo de enemigo elegido; ventajas | ✅ | ASI OK. El tipo de enemigo es solo situacional: texto basta | — |
| `guile-of-the-cloud-giant` | +1 FUE/CON/CAR; Cloudy Escape PB/larga | ✅ | ASI y contador OK | — |
| `gunner` | +1 DES; competencia con armas de fuego; ignora Recarga | ⚠️ | ASI OK. Falta la competencia con armas de fuego (`weapons` solo reconoce "improvised weapons") | FE (weapons), ENG proficiencies |
| `historian-ua` | +1 INT; Historia (doble); ayuda con Historia | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `human-determination-ua` | +1 a elegir; ventaja 1/descanso corto o largo | ✅ | ASI y contador OK | — |
| `infernal-constitution` | +1 CON; resistencia frío y veneno; ventaja salv. veneno | ⚠️ | `abilityIncrease: null` en datos (el texto da +1 CON). Resistencias OK (volcado Cold, Poison) | DATA |
| `initiate-of-high-sorcery` | Elige luna (Nuitari/Lunitari/Solinari); truco de mago; 2 conjuros nv1 según luna (cada uno gratis 1/larga); INT/SAB/CAR | ❌ | `parsed` vacío y sin selectores. Falta: elegir luna, truco (mago), 2 conjuros de la tabla de la luna, contador 1/larga por conjuro, característica de lanzamiento. Las 3 dotes "Adept of the … Robes" dependen de esta elección | FE, FC, ENG |
| `investigator-ua` | +1 INT; Investigación (doble); Buscar como acción adicional | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `keenness-of-the-stone-giant` | +1 FUE/CON/SAB; visión en la oscuridad 60 (+60 si ya la tiene); Stone Throw PB/larga | ⚠️ | ASI y contador OK; darkvision 60 aplicada pero no se suma +60 si ya tiene (se toma el máximo: `addSense`) | TE addSense |
| `knight-of-the-crown` | +1 FUE/DES/CON; Commanding Rally PB/larga | ✅ | ASI y contador OK | — |
| `knight-of-the-rose` | +1 CON/SAB/CAR; Bolstering Rally PB/larga (PT) | ✅ | ASI y contador OK | — |
| `knight-of-the-sword` | +1 INT/SAB/CAR; Demoralizing Strike PB/larga | ✅ | ASI y contador OK (CD con la característica elegida: texto) | — |
| `linguist` | +1 INT; 3 idiomas a elegir; cifrados | ⚠️ | ASI OK. Falta selector de 3 idiomas (`FEAT_PICKS.language` solo sirve para un idioma fijo) | FE, FC |
| `mariner` | Estilo de lucha: nado y trepar = velocidad; +1 CA sin armadura pesada ni escudo | ⚠️ | Parseado `ac:+1` pero `engine` solo lo aplica con armadura puesta (y aunque sea pesada: no mira la condición), sin armadura la CA sigue 12; faltan velocidades de nado y trepa (frase "as long as…" descartada) | FE ac, ENG armorClass, TE speeds |
| `martial-adept` | 2 maniobras de Battle Master (CD FUE o DES), 1 dado de superioridad d6 (descanso corto o largo) | ❌ | Sin mecánica: ni selector de maniobras fuera de la subclase, ni contador de 1 dado d6 | FE, FC, play-state.ts |
| `master-of-disguise-ua` | +1 CAR; kit de disfraz (doble) | ⚠️ | ASI y kit OK; falta duplicar competencia | TE |
| `medic-ua` | +1 SAB; Medicina (doble); curar en descanso corto | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `menacing-ua` | +1 CAR; Intimidación (doble); desmoralizar | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `metabolic-control-ua` | +1 FUE/DES/CON; meditar 1/larga (Psionic Talent die) | ✅ | ASI y contador 1/larga OK; el dado de Talento Psiónico es de la clase | — |
| `metamagic-adept` | 2 opciones de Metamagia + 2 puntos de hechicería (recuperan larga) | ❌ | Sin mecánica: no hay selector de Metamagia fuera de hechicero ni contador de 2 puntos | FE, FC, `choices.options` |
| `mobile` | Velocidad +10; Dash/AdO | ✅ | Velocidad 40 en el volcado | — |
| `naturalist-ua` | +1 INT; Naturaleza (doble); truco Druidcraft; Detect Poison and Disease 1/larga | ⚠️ | ASI y Naturaleza OK. `parsed` vacío: faltan Druidcraft y Detect Poison and Disease (1/larga): la frase "learn the A and B spells" y la mención en minúsculas no se leen | FE parseText |
| `orcish-aggression-ua` | Acción adicional: mover hacia un enemigo | — texto basta | Acción adicional sin recurso | — |
| `orcish-fury` | +1 FUE/CON; daño extra 1/corto o largo; reacción tras Relentless Endurance | ⚠️ | `abilityIncrease: null` en datos (texto: +1 FUE o CON). Contador 1 (corto o largo) OK | DATA |
| `outlands-envoy` | +1 a elegir; Misty Step y Tongues 1/larga cada uno (característica de Scion of the Outer Planes) | ⚠️ | ASI OK. Los conjuros no se leen (nombres en cursiva minúscula "*misty step*"): faltan los dos conjuros y sus contadores 1/larga | FE parseText |
| `outsized-might-ua` | Atletismo o Acrobacias (a elegir); carga; ventaja vs empujón | ✅ | Selector (`FEAT_PICKS`) y `missing: proficiencies` OK | FE FEAT_PICKS |
| `perceptive-ua` | +1 SAB; Percepción (doble) | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `performer-ua` | +1 CAR; Interpretación (doble) | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `planar-wanderer` | Resistencia acid/cold/fire a elegir cada descanso largo; Portal Sense 1/larga; Portal Cracker | ✅ | Selector en diálogo de descanso (`restPicks`) y contador 1/larga OK | — |
| `practiced-expert-ua` | +1 a elegir; 1 habilidad o herramienta; duplicar una competencia | ⚠️ | ASI OK. Falta selector de 1 habilidad/herramienta (`skillsOrTools: 1`) y de la competencia que duplica (pericia) | FE FEAT_PICKS, FC, ENG |
| `prodigy` | 1 habilidad + 1 herramienta + 1 idioma a elegir; pericia en una habilidad | ❌ | Sin `FEAT_PICKS`: faltan los 3 selectores y la pericia | FE, FC, ENG |
| `quick-fingered-ua` | +1 DES; Juego de manos (doble) | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `quicksmithing` | INT; dos conjuros nv1 con etiqueta ritual de cualquier lista; herramientas de herrero rápido | ❌ | Solo se lee INT fijo. Falta selector de 2 conjuros ritual nv1 (cualquier lista) y la herramienta "Quicksmith's Tools". Dispositivos: texto | FE FEAT_PICKS, FC |
| `revenant-blade` | +1 DES/FUE; arma de doble hoja: sutil y +1 CA a dos manos; 2d4 | ✅ | ASI OK. El +1 CA y la propiedad sutil dependen de empuñar un arma concreta: texto basta | — |
| `righteous-heritor` | +1 a elegir; Soothe Pain PB/larga | ✅ | ASI y contador OK | — |
| `rune-carver-adept-revised-ua` | +1 a la característica de Rune Carver Apprentice; invocar poder rúnico PB/larga | ✅ | ASI (a elegir entre 6) y contador PB/larga OK; los beneficios son texto | — |
| `rune-carver-apprentice-revised-ua` | Comprehend Languages 1/larga; conoce 2 runas de la tabla y marca un objeto tras descanso largo (conjuro nv1 temporal, gratis 1 vez); INT/SAB/CAR | ⚠️ | Comprehend Languages OK. Faltan: elegir 2 runas (tabla "Rune Spells", reeligibles al subir nivel), el conjuro de la runa marcada con su uso gratis, y la característica de lanzamiento (no hay selector) | FE FEAT_PICKS, FC, ENG |
| `rune-shaper` | Comprehend Languages 1/larga; runas = mitad de PB (tabla de 13); conjuros gratis 1/larga; INT/SAB/CAR | ⚠️ | Comprehend Languages OK. Faltan: elegir runas (nº = PB/2 redondeado hacia abajo), conjuros de runa y su uso gratis, característica de lanzamiento | FE, FC, ENG |
| `scion-of-elemental-air-ua` | Wind's Glide PB/larga (vuelo hasta fin de turno) | ✅ | Contador PB/larga OK; el vuelo es temporal: texto | — |
| `scion-of-elemental-earth-ua` | Earthen Shield PB/larga | ✅ | Contador OK | — |
| `scion-of-elemental-fire-ua` | Truco Produce Flame; Fervent Blaze PB/larga | ✅ | Truco concedido y contador OK. Duda: el texto remite a la característica elegida "for this feat's Elemental Magic benefit", que no existe en el texto de datos | — |
| `scion-of-elemental-water-ua` | Wave Surge PB/larga; CD con "la característica elegida para esta dote" | ✅ | Contador OK. Duda: no hay beneficio donde elegir la característica (texto incompleto) | — |
| `scion-of-the-outer-planes` | Elige tipo de plano (5): resistencia (Veneno/Necrótico/Radiante/Fuerza/Psíquico) y truco; INT/SAB/CAR | ❌ | `parsed` vacío, sin selectores. Faltan: elegir plano, aplicar resistencia y truco de la tabla, característica de lanzamiento (de la que dependen Agent of Order, Baleful Scion, Cohort of Chaos, Outlands Envoy…) | FE, FC, ENG |
| `second-chance` | +1 DES/CON/CAR; reacción: repetir ataque, recarga al tirar iniciativa o descanso corto/largo | ⚠️ | ASI OK. Falta contador de 1 uso (recarga: iniciativa o descanso corto/largo): la frase "until you roll initiative at the start of combat or until you finish…" no la lee `parseText` | FE parseText |
| `servo-crafting` | Find Familiar como ritual con ficha Servo | ❌ | No concede Find Familiar ni hay ficha de Servo (criatura/compañero) | summons, FE |
| `shield-training-ua` | +1 FUE/DES/CON; competencia con escudos | ⚠️ | ASI OK. Falta competencia con escudos: `proficiencies` solo lee "training with … armor and Shields", no "proficiency with shields" | ENG proficiencies |
| `silver-tongued-ua` | +1 CAR; Engaño (doble); desafío de Engaño | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `soul-of-the-storm-giant` | +1 FUE/SAB/CAR; Maelstrom Aura PB/larga (resistencia rayo/trueno mientras activa) | ✅ | ASI y contador OK; la resistencia es solo durante el aura: texto | — |
| `spear-mastery-ua` | +1 ataque con lanza; dado de daño d6→d8 (d10 a dos manos); carga | ❌ | Falta +1 al ataque y mejora del dado con la lanza en la tabla de ataques | attacks.ts |
| `squat-nimbleness` | +1 FUE/DES; +5 pies de velocidad; Acrobacias o Atletismo a elegir | ⚠️ | ASI y selector de habilidad OK. Falta +5 pies: "Increase your walking speed by 5 feet" no encaja en la regex de velocidad (`Your Speed increases by`); la ficha sigue en 30 | FE speed regex |
| `squire-of-solamnia` | Precise Strike PB/larga | ✅ | Contador OK | — |
| `stealthy-ua` | +1 DES; Sigilo (doble) | ⚠️ | ASI y competencia OK; falta duplicar competencia | TE |
| `strike-of-the-giants` | Elegir 1 de 6 beneficios (Cloud/Fire/Frost/Hill/Stone/Storm Strike); PB/larga | ⚠️ | Contador PB/larga OK. No se guarda cuál de los 6 golpes se eligió (las dotes de 4.º nivel "…of the … Giant" exigen una concreta) | FE, FC |
| `strixhaven-initiate` | Elige colegio (5); 2 trucos de su lista; 1 conjuro nv1 según colegio (gratis 1/larga); INT/SAB/CAR | ❌ | `parsed` vacío, sin selectores. Faltan: colegio, trucos, conjuro nv1, contador 1/larga y característica | FE, FC, ENG |
| `strixhaven-mascot` | Find Familiar ritual; teletransporte 1/larga (o gastando casilla nv2+) | ✅ | Contador 1/larga OK; el familiar y su ficha son texto | — |
| `superior-technique` | 1 maniobra de Battle Master (CD FUE o DES) | ❌ | Sin selector de maniobra fuera de la subclase | FE, FC, `choices.options` |
| `survivalist-ua` | +1 SAB; Supervivencia (doble); conjuro Alarm 1/larga | ⚠️ | ASI, Alarm 1/larga y competencia OK; falta duplicar competencia | TE |
| `svirfneblin-magic` | Nondetection a voluntad; Blindness/Deafness, Blur, Disguise Self 1/larga cada uno; INT | ❌ | Solo INT fijo; no se leen los conjuros ("cast Nondetection on yourself at will"; "cast each of the following spells once: A, B, and C") | FE parseText |
| `tandem-tactician-ua` | Ayudar como acción adicional; rango +10 pies | — texto basta | Todo acción/situacional | — |
| `theologian-ua` | +1 INT; Religión (doble); Thaumaturgy + Detect Evil and Good 1/larga | ⚠️ | ASI, Detect Evil and Good 1/larga OK. Falta el truco Thaumaturgy (frase "learn the A and B spells") y duplicar competencia | FE parseText, TE |
| `tower-of-iron-will-ua` | Reacción: suma dado de Talento Psiónico a una salvación | — texto basta | Reacción; el dado es de Wild Talent/clase | — |
| `tracker-ua` | +1 SAB; Hunter's Mark 1/larga (SAB); ventaja Supervivencia | ✅ | ASI, conjuro gratis 1/larga con casillas y SAB OK | — |
| `tunnel-fighter` | Estilo: postura defensiva (acción adicional) | — texto basta | Todo acción adicional/reacción | — |
| `vampiric-exultation` | Forma de vapor: vuelo 30 pies, 1/corto o largo | ✅ | Contador 1 (corto o largo) OK; vuelo transitorio: texto | — |
| `vigor-of-the-hill-giant` | +1 FUE/CON/SAB; Bulwark; Iron Stomach | ✅ | ASI OK; resto texto | — |
| `wild-talent-ua` | +1 a elegir; dado de Talento Psiónico (d6/d8/d10/d12 según nivel; recupera en larga); Psi Replenishment 1/larga | ⚠️ | ASI OK. Falta contador del dado de Talento Psiónico (tamaño por nivel, recarga larga) y Psi Replenishment 1/larga (frase "You then can't use … again until you finish a long rest" no se lee) | FE, play-state.ts, pools.ts |
| `wonder-maker-ua` | +1 DES/INT; doble competencia con herramientas de manitas; opciones de Tinker | ⚠️ | ASI OK. No hay pericia con herramientas de manitas. Texto cortado en los datos ("…additional options for what you make:" sin lista) | DATA (scraper) |
| `wood-elf-magic` | 1 truco de Druida; Longstrider y Pass Without Trace 1/larga cada uno; SAB | ❌ | Solo SAB fijo. Falta selector de truco (druida) y los dos conjuros con contador 1/larga ("learn the A and B spells, each of which…" no se lee) | FE FEAT_PICKS, parseText |

## Patrones comunes

Agrupados por mecanismo (los nombres de dote son ids; entre paréntesis, nº de dotes).

1. **`abilityIncrease: null` en los datos aunque el texto da +1 (5, todas 2014)**: `barbed-hide-ua` (CON/CAR), `dragon-hide` (FUE/CON/CAR), `everybodys-friend-ua` (CAR), `infernal-constitution` (CON), `orcish-fury` (FUE/CON). El selector de característica no aparece. Arreglo en el scraper (`tools/scraper/`, no a mano en `data/`). Las demás 193 dotes con aumento lo ofrecen y lo aplican (tope 20, o 30 en las 36 épicas).
2. **Elección de conjuros/trucos/herramientas/idiomas sin selector (no hay entrada en `FEAT_PICKS`)** (≈ 22): 2014: `adept-of-the-black-robes`, `adept-of-the-red-robes`, `adept-of-the-white-robes`, `initiate-of-high-sorcery`, `strixhaven-initiate`, `artificer-initiate`, `divinely-favored`, `blessed-warrior`, `druidic-warrior`, `wood-elf-magic`, `elemental-touched-ua` (Druidcraft/Thaumaturgy y característica), `quicksmithing` (2 rituales nv1 de cualquier lista), `rune-carver-apprentice-revised-ua`, `rune-shaper` (runas), `scion-of-the-outer-planes` (plano → resistencia + truco), `practiced-expert-ua`, `prodigy`, `linguist` (3 idiomas), `divine-communications-ua` (idiomas). 2024: `magic-connoisseur` (nv1 y nv2 de la lista de Magic Initiate), `ritual-caster` (PB rituales nv1), `skill-expert` (habilidad + pericia). La infraestructura ya existe (`FeatPicks.cantrips/spell/skills/tools/language`, `pickable`, `FeatChoices`), faltan las entradas y, para escuelas/listas por alineación, nuevas variantes de `PickRule` (listas elegidas por una elección previa: luna, colegio, plano, alineación).
3. **Opciones de otra clase dentro de una dote (5, 2014)**: maniobras de Battle Master (`martial-adept` con su dado d6, `superior-technique`), Metamagia (`metamagic-adept` con 2 puntos de hechicería), invocación (`eldritch-adept`), estilo de lucha (`fighting-initiate`). `choices.options` y los selectores de maniobras/invocaciones existen solo para la clase dueña; falta dejarlos disponibles para dotes y, en `martial-adept`/`metamagic-adept`, añadir el contador (dado d6 / puntos).
4. **Tabla "Spell Slot Level | Spell" de conjuros siempre preparados (8, 2024)**: `abjuration-adept`, `conjuration-adept`, `divination-adept`, `enchantment-adept`, `evocation-adept`, `illusion-adept`, `necromancy-adept`, `transmutation-adept`. `parseText` ignora las líneas de tabla; ya existe `tableSpellNames` (lo usa Boon of Siberys) para leerlas, falta convertir cada fila en un conjuro "siempre preparado desde que se tiene casilla de ese nivel".
5. **Segundo conjuro "del mismo modo" a nivel 3 (6, 2024 UA "Wild Talent")**: `atmokinesis-ua` (Gust of Wind), `biokinesis-ua` (Arcane Vigor), `clairsentience-ua` (See Invisibility), `empath-ua` (Calm Emotions), `flesh-morpher-ua` (Alter Self), `pyrokinesis-ua` (Scorching Ray). Salen siempre preparados a nivel 3 pero **sin el uso gratis 1/larga** ("can cast it the same way" no se interpreta): falta contador y/o casillas.
6. **Conjuros que gastan un Psionic Energy Die marcados "a voluntad" por error (3, 2024)**: `full-ceremorphosis-ua` (Detect Thoughts, Levitate, Mind Blast), `illithid-thrallmaker-ua` (Charm Person), `tadpoles-safeguard-ua` (Shield). La mecánica es análoga a `deathPoints` (Death Knight) pero con la reserva `psionic-energy-dice`; hoy la regla "sin límite de recarga ⇒ `atWill`" los deja gratis sin coste. Además `full-ceremorphosis-ua` da siempre los 3 conjuros aunque el jugador elige una de las dos especializaciones.
7. **Lectura de conjuros en frases de lista o con redacción distinta (≈ 9, mayoría 2014)**: "You learn the A and B spells" (`arcanist-ua` pierde Prestidigitation; `naturalist-ua` pierde Druidcraft y Detect Poison and Disease; `theologian-ua` pierde Thaumaturgy), "each of which you can cast once" (`wood-elf-magic`, `drow-high-magic` pierde Levitate y Dispel Magic), cursivas/minúsculas (`outlands-envoy`: *misty step*, *tongues*), "at will" sin lista (`svirfneblin-magic`: Nondetection a voluntad + 3 conjuros 1/larga), "cast Augury and Commune ... 1d4 long rests" (`divine-communications-ua`), "services ... Find Familiar as a ritual" (`servo-crafting`).
8. **Característica de lanzamiento "INT, WIS o CHA" que la regex no reconoce (2)**: `gift-of-the-metallic-dragon` ("…is Intelligence, Wisdom, or Charisma when you cast it with this feat") y `divinely-favored` ("…for this feat's spells is Intelligence, Wisdom, or Charisma"). No salta `missing: ability`; se usa la "mejor" de INT/SAB/CAR sin preguntar. Lo mismo ocurre sin aviso cuando el texto no dice la característica (`cartomancer`, `boon-of-revelry`).
9. **Duplicar competencia ("si ya eres competente, el doble") no se aplica (≈ 25, 2014 UA)**: `acrobat-ua`, `alchemist-ua`, `animal-handler-ua`, `arcanist-ua`, `barbed-hide-ua`, `brawny-ua`, `burglar-ua`, `critter-friend-ua`, `diplomat-ua`, `empathic-ua`, `everybodys-friend-ua`, `gourmand-ua`, `historian-ua`, `investigator-ua`, `master-of-disguise-ua`, `medic-ua`, `menacing-ua`, `naturalist-ua`, `perceptive-ua`, `performer-ua`, `quick-fingered-ua`, `silver-tongued-ua`, `stealthy-ua`, `survivalist-ua`, `theologian-ua`, `wonder-maker-ua` (herramientas de manitas). La competencia fija sí entra (la leen `trait-effects`/`proficiencies`), pero solo `keen-mind`/`observant` suben a `expertise`. Habría que añadir a `trait-effects`/`engine` la regla "double your proficiency bonus … already proficient" → `expertise`.
10. **Competencias que el lector no reconoce (6)**: herramientas fuera de `KNOWN_TOOLS` (`alchemist-ua`: suministros de alquimista; `quicksmithing`: herramientas de herrero rápido), armas de fuego (`gunner`, `weapons` solo conoce "improvised weapons"), escudos (`shield-training-ua`: "proficiency with shields"), "proficiency in all skills" (`boon-of-skill`) y la mayúscula de "Proficiency" (`boon-of-terror`: Intimidación + pericia).
11. **Bonos de ataque/daño por arma concreta (5)**: `blade-mastery-ua`, `fell-handed`, `flail-mastery-ua`, `spear-mastery-ua` (+1 al ataque con armas listadas; lanza con dado mayor) y `tavern-brawler` (golpe desarmado 1d4+FUE). `attacks.ts` solo aplica estilos de lucha, no bonos por lista de armas; `unarmedFighting` solo existe para Unarmed Fighting.
12. **CA/velocidad/vuelo con condiciones que el lector descarta (5)**: `mariner` (la CA +1 se aplica solo con armadura puesta, incluso pesada, y no sin armadura; nado/trepa ausentes), `dragon-hide` (CA 13+DES sin armadura: "calculate your AC as 13 + your Dexterity modifier" no es el patrón "base Armor Class equals"; garras 1d4 sin soporte), `dragon-wings-ua` (vuelo 20 pies si no lleva armadura pesada: frase con "if"), `squat-nimbleness` (+5 pies: "Increase your walking speed by 5 feet" ≠ "Your Speed increases by"), `medium-armor-master` (tope de DES 3 en armadura media: `dexCap` fijo).
13. **Inmunidades sin modelo (4, 2024)**: `boon-of-blazing-dawn` (radiante), `boon-of-poison-mastery` (veneno + condición Envenenado), `boon-of-the-cleansed-heart-ua` (necrótico), `boon-of-terror` (condición Asustado). `Sheet` solo tiene `resistances` y las condiciones no tienen inmunidad; no se grita nada, simplemente no sale. (Furious Storm solo la tiene Ensangrentado: texto.)
14. **Contadores que `parseText` no detecta por la redacción (4)**: `second-chance` (reacción; recarga con iniciativa o descanso corto/largo), `spell-subterfuge` (usos = modificador de la característica aumentada), `wild-talent-ua` (dado de Talento Psiónico d6→d12 por nivel y Psi Replenishment 1/larga: "You then can't use … again"), `boon-of-recovery` (reserva de 10d10, "You have a pool of ten d10s"). Casos relacionados: `strike-of-the-giants` (no se guarda cuál de los 6 golpes) y `zhentarim-tactics` (habilidad con pericia temporal cada descanso largo): faltan como elección de descanso.
15. **Reacciones/acciones con recurso fijo sí se leen bien**: el patrón "PB veces / larga", "1 vez hasta descanso corto o largo / iniciativa", "Luck Points" y las reservas compartidas (Death Points, Psionic Energy Dice) funcionan en todas las dotes donde aparecen (≈ 90 contadores correctos).
16. **Efectos de selección única sin selector pero con efecto de mesa (2)**: `elemental-adept` (tipo de daño), `weapon-master` (arma con maestría: `weaponMasterySlots` solo suma las casillas de clase, la dote no añade una).

## Dudas

Textos ambiguos o datos incompletos (no se resolvieron; no se tocó nada fuera de este informe):

- **`scion-of-elemental-fire-ua` / `scion-of-elemental-water-ua`**: el texto remite a "la característica elegida para el beneficio *Elemental Magic* de esta dote", pero el texto de los datos no contiene ese beneficio (parece faltar un párrafo del original, con el truco y la elección de INT/SAB/CAR). Sin él no se sabe qué característica usar.
- **`wonder-maker-ua`**: la lista de opciones de Tinker termina en "…additional options for what you make:" sin contenido; texto cortado en el scraper.
- **`magic-initiate` (2024)**: la `description` de los datos solo trae "Level 1 Spell / Spell Change / Repeatable"; falta el párrafo de los dos trucos y la elección de lista/característica. El motor funciona por `FEAT_PICKS`, pero el texto mostrado al jugador está incompleto.
- **`divine-communications-ua`**: el +1 es "a la característica de lanzamiento que elegiste con Divinely Favored", pero los datos ofrecen las 6 características; no se sabe si debe forzarse a la elegida (hay que enlazar dotes).
- **`rune-carver-adept-revised-ua`**: igual (+1 a la característica elegida en Rune Carver Apprentice); los datos ofrecen las 6.
- **Dotes encadenadas** (`adept-of-the-*-robes` ← `initiate-of-high-sorcery`; `agent-of-order`, `baleful-scion`, `cohort-of-chaos`, `righteous-heritor`, `outlands-envoy` ← `scion-of-the-outer-planes`; `fury-of-…`, `keenness-of-…`, `vigor-of-…` ← `strike-of-the-giants`; `knight-of-…` ← `squire-of-solamnia`; `warlike-familiar`, `elemental-familiar`… ← `familiar-friend`): el texto hereda la característica o la elección de la dote previa. No está claro si se quiere enlazar esas elecciones o dejarlas como texto; hoy no hay enlace (y los prerrequisitos de dote no se validan).
- **`cold-caster`, `light-bringer`, `undead-grasp-ua`**: "si ya conoces el truco, aprende otro de la lista": ¿hace falta un selector condicional o basta el texto?
- **`mariner` (2014)**: el texto dice "swimming speed and climbing speed equal to your normal speed, and +1 AC" mientras no lleve armadura pesada **ni escudo**; ¿el +1 se aplica también sin armadura? (literalmente sí).
- **`boon-of-misty-escape`**: lanza Gaseous Form "sin acción y sin casilla"; hoy basta el contador 1/larga, pero el conjuro no aparece en la lista de conjuros concedidos.
- **`healer`, `heavy-armor-master`, `inspiring-leader`**: situacionales con números calculables (PG temporales = nivel + mod; reducción = PB). Los he dado por "texto basta"; si el usuario quiere el cálculo automático son candidatos fáciles.
- **Dotes de 2014 de los libros de Dragonlance/Eberron/Strixhaven/Planescape/UA**: el listado de 116 son las que no coinciden con el PHB 2024; no incluye Alert, Lucky, GWM... de 2014 (están solo en su versión 2024). No es un error, pero conviene saberlo al buscar "Lucky 2014".

## Observaciones (errores del volcado aunque no sean faltantes)

1. **Recarga incorrecta**: `fey-teleportation` (2014): el texto dice "short or long rest" y el contador de Misty Step se recarga solo en descanso largo; `addSpell` usa `rest: 'long'` por defecto para los conjuros leídos del texto (solo `pickSpell` conoce `short-or-long`).
2. **Conjuro a voluntad marcado como "gratis 1/larga"** (sale contador que no debería existir): `critter-friend-ua` (Speak with Animals) y `drow-high-magic` (Detect Magic). Causa: `parseText` decide `free` con "Long Rest" en **todo el párrafo**, y el párrafo mezcla la frase "at will" con la de "regain … when you finish a long rest" del otro conjuro. En `drow-high-magic` además faltan Levitate y Dispel Magic.
3. **Conjuros "a voluntad" por error** (deberían gastar Psionic Energy Die): `full-ceremorphosis-ua`, `illithid-thrallmaker-ua`, `tadpoles-safeguard-ua` (Patrón 6). El único a voluntad correcto es `boon-of-the-cleansed-heart-ua`.
4. **Elección "de descanso" falsa**: `portal-jumper` y `spell-resistant` (2024) muestran su resistencia como cambiable en cada Descanso Largo (`restPicks`) aunque el texto dice "choose when you select/gain this feat". `resistanceChangesOnRest` busca "when you finish a long rest" en **todo** el texto, y lo encuentra en la frase del contador ("you regain all expended uses when you finish a Long Rest"). `dragonscarred` (sin contador) se comporta bien. Los casos legítimos son `boon-of-energy-resistance` y `planar-wanderer`.
5. **`featRules(...).resistances` incompleto, la ficha correcta**: `boon-of-the-soul-drinker` parsea solo `Cold` ("Cold damage and Necrotic damage" corta la lista), pero la ficha muestra Cold y Necrotic porque `trait-effects` lo lee por su cuenta. Mismo patrón que `death-knight-ascension-ua` (que sí sale bien). Es una duplicación de lectores, no un fallo visible.
6. **Contadores que no corresponden a una dote entera**: `adept-of-the-red-robes` muestra su contador como "Adept of the Red Robes" (PB/larga) sin la etiqueta "Magical Balance"; y los contadores se etiquetan con el nombre de la dote cuando solo hay uno (p. ej. `agent-of-order` → "Agent of Order" en lugar de "Stasis Strike"). Es cosmético; `gift-of-the-chromatic-dragon` y `light-bringer` sí usan "Dote: Beneficio".
7. **Característica de lanzamiento por defecto**: si el texto no la dice (`cartomancer`, `boon-of-revelry`) o el selector falta (Patrón 8), `featGrants` usa la "mejor" de INT/SAB/CAR; el jugador no lo ve y la CD puede no coincidir con la de su clase.
8. **`darkvision` aditiva**: `keenness-of-the-stone-giant` ("darkvision 60; si ya la tienes, +60") y `illithid-thrallmaker-ua`/`tadpoles-safeguard-ua` (telepatía +10) usan el máximo, no la suma (`addSense`); telepatía no es un sentido del modelo.
9. **`resilient` (2024)**: el selector ofrece las 6 características aunque el texto pide "una en la que carezcas de competencia en salvación".
10. **`CLAUDE.md` desactualizado**: el riesgo 7 ("Boon of Energy Resistance y Planar Wanderer sin resolver") y el listado de desarrollos pendientes ("épicas que deberían pedir conjuro: Boon of Magic School Mastery, Boon of Siberys") ya están resueltos (selector en el diálogo de descanso y `FEAT_PICKS` con escuela/conjuro/signature/tabla). Siguen sin contador solo las "Death Points / Psionic Energy Dice" por dote suelta (están compartidas por `pool`, funcionan).
11. **Prerrequisitos truncados en los datos** (scraper): `aerenia-halflife` ("Elf (Aereni"), `critter-friend-ua` ("Gnome (forest"), `drow-high-magic` ("Elf (drow"), `fey-teleportation` ("Elf (High"), `wood-elf-magic` ("Elf (Wood"), `wonder-maker-ua` ("Gnome (rock"), `svirfneblin-magic` ("Gnome (Deep Gnome"), `vampiric-exultation` ("Vampire (Ixalan"): falta el paréntesis de cierre; si algún día se valida el prerrequisito, fallará.
12. **Resumen de lo que SÍ está sólido**: aumentos de característica (193 dotes), PG (`tough`, `boon-of-fortitude`), velocidad (`mobile`, `speedy`, `boon-of-speed`, `transmuted-anatomy`), trepar (`athlete`), iniciativa (`alert`), CA (`defense`), estilos de lucha de 2024 (los 13 con nota o bono), resistencias (incluidas las elegibles: `dragonscarred`, `boon-of-energy-resistance`, `planar-wanderer`), Magic Initiate / Fey-Shadow-Vampire Touched / Boon of Magic School Mastery / Boon of Siberys, Skilled/Crafter/Musician/Keen Mind/Observant/Purple Dragon Rook, pools de Death Points y Psionic Energy Dice, y unos 90 contadores PB/1 con recarga larga o corta+larga.
