# Auditoría de especies (89: 30 de 2024 y 59 de 2014)

Auditoría de solo lectura de `data/species.json` contra lo que calcula el motor: volcado `docs/auditoria/_volcado/especies.json` (personaje guerrero 5, sin elecciones) y una sonda propia que ejecuta `computeSheet` con las elecciones hechas (primera opción de cada selector, característica CAR) para ver el efecto real de cada linaje, opción y selector.

## Resumen

Se cuentan **filas de la tabla** (cada fila es un rasgo o un grupo de rasgos con el mismo estado; las filas "texto basta" agrupan los rasgos narrativos o situacionales de la especie).

| Estado | 2024 | 2014 | Total |
|---|---|---|---|
| ✅ completo | 56 | 77 | 133 |
| ⚠️ parcial | 7 | 13 | 20 |
| ❌ falta | 9 | 14 | 23 |
| — texto basta | 14 | 40 | 54 |
| **Filas** | 86 | 144 | 230 |

Especies con algún ⚠️/❌: 2024 = 11 de 30; 2014 = 22 de 59. Especies sin ningún hueco: 2024 = 19; 2014 = 37.

Las variantes copia de otro libro (`reprint: true`, p. ej. "Goblin (Volo's Guide to Monsters)") no se pueden elegir (`chosenVariant` las descarta) y no se auditan: el volcado las trae idénticas a la especie base. Las variantes reales auditadas son: Aven (Hawk-Headed), Dragonborn (10), Elf (5), Goblin (Zendikar), Half-Elf (Mark of Storm) y Tiefling (3), más las opciones internas de rasgo (Gnome, Goliath, Shifter, Kobold, Half-Elf Versatility, Custom Lineage, Eladrin/Duskling/Simic).

Leyenda de archivos (rutas desde la raíz del repo): `trait-effects.ts` (TE), `feat-effects.ts` (FE), `species-picks.ts` (SP), `trait-choices.ts` (TC), `natural-weapons.ts` (NW), `engine.ts` (EN), todos en `app/src/app/core/rules/`.

## Tabla por especie

| Especie (variante) | Rasgo | Qué ofrece | Estado | Qué falta exactamente | Archivos |
|---|---|---|---|---|---|
| Aasimar (2024) | Celestial Resistance / Darkvision | Resist. Necrótico y Radiante; visión 60 (dato) | ✅ |  |  |
| Aasimar (2024) | Light Bearer | Truco Luz, CAR fijo por el texto | ✅ |  |  |
| Aasimar (2024) | Healing Hands | Contador 1/descanso largo (la sheet no tira los d4) | ✅ |  |  |
| Aasimar (2024) | Celestial Revelation | Contador 1/largo, a partir de nivel 3; la opción (alas/radiante/sombra) se re-elige en cada uso | ✅ | Elección por uso: texto adrede (riesgo conocido 7) | trait-choices.ts |
| Boggart (2024) | Darkvision, Fury of the Small | Visión 60; contador PB/largo (daño extra en texto) | ✅ |  |  |
| Boggart (2024) | Fey Ancestry, Nimble Escape | Ventaja / acción adicional | — texto basta |  |  |
| Changeling (2024) | Changeling Instincts | Selector de 2 habilidades entre 5 (aviso si falta) | ✅ |  | trait-choices.ts |
| Changeling (2024) | Shape-Shifter | Cambio de apariencia/tamaño | — texto basta |  |  |
| Deep Imaskari (UA) (2024) | Photoresistant | Resistencia Radiante | ✅ |  |  |
| Deep Imaskari (UA) (2024) | Resourceful | Inspiración heroica tras descanso largo | ⚠️ | Existe la casilla manual de Inspiración heroica, pero el descanso largo no la concede; no hay nada en el motor que lea "Heroic Inspiration whenever you finish a Long Rest" | play/rest-rules.ts, play-state.ts |
| Deep Imaskari (UA) (2024) | Aura of Unlight | Contador 1/largo (nivel 3); la opción se elige por uso | ✅ | Elección por uso: texto adrede |  |
| Deep Imaskari (UA) (2024) | Unluminescent | Luz de 5 pies | — texto basta |  |  |
| Dhampir (2024) | Darkvision, Spider Climb, Trace of Undeath | Visión 60; trepar 35 (dato; el texto "Climb Speed equal to your Speed"); resist. Necrótico | ✅ |  |  |
| Dhampir (2024) | Vampiric Bite | Fila de ataque 1d4+CON perforante; contador PB/largo (clave interna "strengthen") | ✅ |  |  |
| Dragonborn (2024) | Draconic Ancestry (10 variantes: Black…White) | Selector de variante OK, pero cada variante solo dice "Damage Type: X" | ⚠️ | El selector no produce ningún efecto: ni resistencia ni tipo de aliento (ver filas siguientes) | data/species.json |
| Dragonborn (2024) | Breath Weapon | — | ❌ | El dato no contiene el rasgo (solo hay 1 rasgo en la especie). Falta en data/species.json (scraper): contador PB/largo, daño por nivel (tabla de ataques) y tipo según linaje | data/species.json, tools/scraper |
| Dragonborn (2024) | Damage Resistance | — | ❌ | Falta en el dato: resistencia al tipo del linaje elegido | data/species.json |
| Dragonborn (2024) | Darkvision / Draconic Flight | — | ❌ | Faltan en el dato (darkvision: null; sin rasgo de vuelo de nivel 5) | data/species.json |
| Drider (UA) (2024) | Spells of the Spider Queen | Dancing Lights; Faerie Fire (3) y Web (5) gratis 1/largo; selector INT/SAB/CAR | ✅ |  | feat-effects.ts, species-picks.ts |
| Drider (UA) (2024) | Darkvision 120, Spider Climb | Visión 120; trepar 30 (dato) | ✅ |  |  |
| Drider (UA) (2024) | Arachnid Build, Web Walker | Carga / telarañas | — texto basta |  |  |
| Duskling (2024) | Inner Magic (+ Ardor / Mobility / Vigor) | Selector de 1 beneficio (descanso largo) con "rest"; contador de cambios PB/largo; Mobility suma +10 de velocidad solo si es el elegido | ✅ |  | species-picks.ts |
| Duskling (2024) | Vigor | PG temporales = PB (no se aplican a los PG temporales de la hoja) | — texto basta |  |  |
| Duskling (2024) | Darkvision, Enhanced Jump | Visión 60; salto | ✅ |  |  |
| Dwarf (2024) | Darkvision 120, Dwarven Resilience, Dwarven Toughness | Visión 120; resist. Veneno; +1 PG máx. y +1 por nivel (PG 49 en el volcado) | ✅ |  |  |
| Dwarf (2024) | Stonecunning | Contador PB/largo (Sentido de la vibración 60 solo en texto) | ✅ |  |  |
| Elf (2024) | Keen Senses | "Insight, Perception, or Survival skill": una a elegir | ❌ | No hay selector: la regex de elecciones (TC traitPicks) exige "one … skill of your choice"; el texto "proficiency in the A, B, or C skill" no se reconoce y el aviso de elección pendiente no sale | trait-choices.ts |
| Elf (2024) | Elven Lineage — Drow | Visión 120; Dancing Lights; Faerie Fire (3) y Darkness (5) 1/largo gratis; selector de característica | ✅ |  | engine.ts (traitGrants) |
| Elf (2024) | Elven Lineage — High Elf | Prestidigitation; Detect Magic (3) y Misty Step (5) gratis | ⚠️ | El truco puede cambiarse tras cada descanso largo ("replace that cantrip with a different cantrip from the Wizard spell list"): no hay selector ni restPick (la frase está en la variante, no en el rasgo) | species-picks.ts, trait-choices.ts |
| Elf (2024) | Elven Lineage — Wood Elf | Velocidad 35; Druidcraft; Longstrider (3) y Pass without Trace (5) gratis | ✅ |  |  |
| Elf (2024) | Elven Lineage — Lorwyn Elf | Thorn Whip; Command (3) y Silence (5) gratis | ⚠️ | Igual que High Elf: cambio de truco por descanso largo (lista de Druida) sin selector | species-picks.ts, trait-choices.ts |
| Elf (2024) | Elven Lineage — Shadowmoor Elf | Visión 120; Starry Wisp; Heroism (3) y Gentle Repose (5) gratis | ✅ |  |  |
| Elf (2024) | Darkvision, Fey Ancestry, Trance | Visión 60 / ventaja / descanso corto de 4 h | ✅ |  |  |
| Faerie (2024) | Fairy Magic | Druidcraft; Faerie Fire (3) y Enlarge/Reduce (5) 1/largo; selector de característica | ✅ |  |  |
| Faerie (2024) | Flight | Vuelo 30 (dato); la restricción de armadura media/pesada solo es texto | ✅ | Darkvision 120: el texto dice solo "Shadowmoor faeries" pero el dato da 120 a todos (ver Dudas) |  |
| Flamekin (2024) | Darkvision, Fire Resistance, Reach to the Blaze | Visión 60; resist. Fuego; Produce Flame; Burning Hands (3) y Flame Blade (5) gratis | ✅ |  |  |
| Gnome (2024) | Darkvision 60, Gnomish Cunning | Visión 60 / ventaja | ✅ |  |  |
| Gnome (2024) | Gnomish Lineage — Forest Gnome | Minor Illusion; Speak with Animals gratis PB/largo; selector de linaje y de característica | ✅ |  | trait-choices.ts, species-picks.ts |
| Gnome (2024) | Gnomish Lineage — Rock Gnome | "You know the Mending and Prestidigitation cantrips" | ❌ | No concede ningún truco: la regex de FE (featRules) solo lee "the X cantrip" en singular; "cantrips" con dos nombres no coincide. Faltan Mending y Prestidigitation (y su característica de lanzamiento) | feat-effects.ts |
| Gnome (2024) | Gnomish Lineage — dispositivo | Dispositivo de relojería (10 min, 3 a la vez) | — texto basta |  |  |
| Goliath (2024) | Giant Ancestry | Selector de 6 beneficios; contador PB/largo; velocidad 35 (dato) | ✅ |  | trait-choices.ts |
| Goliath (2024) | Large Form | Contador 1/largo (nivel 5); +10 velocidad y tamaño Grande solo en texto | ✅ |  |  |
| Goliath (2024) | Powerful Build | Carga / ventaja al escapar de presa | — texto basta |  |  |
| Halfling (2024) | Brave, Halfling Nimbleness, Luck, Naturally Stealthy | Ventajas, repetir 1 | — texto basta |  |  |
| Hexblood (2024) | Eerie Token | Contador 1/largo | ✅ |  |  |
| Hexblood (2024) | Hex Magic | Disguise Self y Hex 1/largo gratis (nivel 1); selector de característica | ✅ |  |  |
| Human (2024) | Skillful | Selector de 1 habilidad | ✅ |  |  |
| Human (2024) | Versatile | Ranura de dote de origen de especie (SPECIES_SLOT) | ✅ |  | creation/character-create.ts |
| Human (2024) | Resourceful | Inspiración heroica tras descanso largo | ⚠️ | Igual que Deep Imaskari: la casilla es manual; el descanso largo no la activa | play/rest-rules.ts |
| Illithidkin (UA) (2024) | Darkvision 120, Sharpened Mind | Visión 120; resist. Psíquico | ✅ |  |  |
| Illithidkin (UA) (2024) | Psionic Aptitude | Mage Hand; Command (3) y Levitate (5) gratis 1/largo; selector de característica | ✅ |  |  |
| Illithidkin (UA) (2024) | Telepathy | 30 pies | — texto basta |  |  |
| Kalashtar (2024) | Mental Discipline | Resist. Psíquico | ✅ |  |  |
| Kalashtar (2024) | Severed from Dreams | Selector de 1 habilidad, re-elegible en cada descanso largo (diálogo de descanso) | ✅ |  | species-picks.ts, play/rest-choices.ts |
| Kalashtar (2024) | Dual Mind, Mind Link | Ventaja / telepatía | — texto basta |  |  |
| Khoravar (2024) | Fey Gift | Friends; sustitución por truco de Clérigo/Druida/Mago tras descanso largo; selector de característica | ✅ |  |  |
| Khoravar (2024) | Skill Versatility | Habilidad o herramienta, re-elegible tras descanso largo | ✅ |  |  |
| Khoravar (2024) | Lethargy Resilience | "Una vez… hasta terminar 1d4 descansos largos" | ⚠️ | Sin contador: la recarga (1d4 descansos largos) no encaja en las recargas corto/largo; queda como texto sin ayuda de uso | feat-effects.ts |
| Khoravar (2024) | Darkvision, Fey Ancestry | Visión 60 | ✅ |  |  |
| Kuo-toa (UA) (2024) | Amphibious | Nado 30 (dato) | ✅ |  |  |
| Kuo-toa (UA) (2024) | Deific Manifestation | Find Familiar gratis 1/largo (el aviso de característica no sale: el texto no la nombra, ver Dudas); forma por lanzamiento en texto | ✅ | Elección por lanzamiento: texto adrede |  |
| Kuo-toa (UA) (2024) | Slippery | Ventaja vs presa | — texto basta |  |  |
| Lorwyn Changeling (2024) | Delightful Imitator | "Deception or Performance skill": una a elegir | ❌ | Sin selector (mismo patrón sin "of your choice" que Elf/Keen Senses) | trait-choices.ts |
| Lorwyn Changeling (2024) | Darkvision 120, Shape Self, Unpredictable Movement | Visión 120 | ✅ |  |  |
| Lupin (2024) | Feral Pounce | Los Golpes sin armas hacen daño cortante (unarmedType) | ✅ |  | natural-weapons.ts |
| Lupin (2024) | Howl | Contador PB/largo | ✅ |  |  |
| Lupin (2024) | Werewolf Instincts | "Perception, Stealth, or Survival skill": una a elegir | ❌ | Sin selector (mismo patrón) | trait-choices.ts |
| Myconid (UA) (2024) | Darkvision 120, Rapport Spores | Visión 120; contador 1/largo | ✅ |  |  |
| Myconid (UA) (2024) | Telepathy, Skill Meld | Texto; Skill Meld es por ritual | — texto basta |  |  |
| Orc (2024) | Adrenaline Rush | Contador PB con recarga corto o largo (short=all) | ✅ |  |  |
| Orc (2024) | Relentless Endurance, Darkvision 120 | Contador 1/largo; visión 120 | ✅ |  |  |
| Reborn (2024) | Knowledge from a Past Life | Selector de habilidad; contador PB/largo | ✅ |  |  |
| Reborn (2024) | Strange Endurance | Selector de resistencia (Frío/Necrótico/Veneno) | ✅ |  |  |
| Reborn (2024) | Everlasting | Texto | — texto basta |  |  |
| Rimekin (2024) | Cold Resistance, Darkvision, Ray of Frost | Resist. Frío; visión 60; truco | ✅ |  |  |
| Rimekin (2024) | Cold Fire Magic (Ice Knife 3, Flame Blade 5) | "you learn the Ice Knife spell and the Flame Blade spell, respectively" | ❌ | Faltan los dos conjuros y sus usos gratis 1/largo: ningún patrón de FE lee "you learn the X spell … respectively". El selector de característica sí aparece (aviso speciesAbilityMissing) pero sin conjuros que lo usen | feat-effects.ts |
| Shifter (2024) | Bestial Instincts | Selector de 1 habilidad entre 4 | ✅ |  |  |
| Shifter (2024) | Shifting | Selector de opción (Beasthide/Longtooth/Swiftstride/Wildhunt) y contador PB/largo; efectos "mientras estás transformado" en texto | ✅ |  |  |
| Shifter (2024) | Shifting — Longtooth | Golpe sin armas 1d6+FUE perforante | ⚠️ | La opción elegida no añade la fila de ataque: naturalWeaponOf descarta el texto porque el preámbulo contiene "(choose when you select this species)" | natural-weapons.ts |
| Shifter (2024) | Darkvision | Visión 60 | ✅ |  |  |
| Tiefling (2024) | Fiendish Legacy — Abyssal / Chthonic / Infernal | Resist. (Veneno/Necrótico/Fuego); truco; conjuros de nivel 3 y 5 gratis 1/largo; selector de característica | ✅ |  |  |
| Tiefling (2024) | Otherworldly Presence, Darkvision | Thaumaturgy; visión 60 | ✅ |  |  |
| Warforged (2024) | Construct Resilience | Resist. Veneno | ✅ |  |  |
| Warforged (2024) | Specialized Design | Selector 1 habilidad + 1 herramienta | ✅ |  |  |
| Warforged (2024) | Integrated Protection | +1 a la CA | ❌ | No se aplica: la CA sale 10+DES. El motor solo suma bonos de CA de dotes con "+1 … while wearing" (Defense); no hay lector de bono plano de CA para especies | engine.ts, feat-effects.ts |
| Warforged (2024) | Sentry's Rest, Tireless | Texto | — texto basta |  |  |
| Aarakocra (2014) | Flight, Talons, Wind Caller | Vuelo 30 (dato); fila Talons 1d6+FUE cortante; Gust of Wind (3) gratis 1/largo; selector de característica | ✅ |  |  |
| Aetherborn (2014) | Born of Aether, Menacing | Resist. Necrótico; Intimidación | ✅ |  |  |
| Aetherborn (2014) | Darkvision | Visión 60 | ❌ | El dato tiene darkvision: null; el texto "60 feet" no lo lee TE (sin "range of") | data/species.json, trait-effects.ts |
| Air Genasi (2014) | Darkvision, Lightning Resistance, Mingle with the Wind | Visión 60; resist. Rayo; Shocking Grasp; Feather Fall (3) y Levitate (5) gratis; velocidad 35 (dato) | ✅ |  |  |
| Air Genasi (2014) | Unending Breath | Texto | — texto basta |  |  |
| Astral Elf (2014) | Astral Fire | Selector de 1 truco entre 3 + característica | ✅ |  |  |
| Astral Elf (2014) | Starlight Step | Contador PB/largo | ✅ |  |  |
| Astral Elf (2014) | Astral Trance | Selector de habilidad y arma/herramienta, re-elegibles en descanso largo | ✅ |  |  |
| Autognome (2014) | Armored Casing | CA 13+DES sin armadura | ✅ |  |  |
| Autognome (2014) | Built for Success, Specialized Design | Contador PB/largo; selector de 2 herramientas | ✅ |  |  |
| Autognome (2014) | Mechanical Nature | Resist. Veneno ✅ | ⚠️ | Inmunidad a enfermedad: el motor no modela inmunidades (ni a daño ni a condición) | engine.ts, trait-effects.ts |
| Autognome (2014) | Healing Machine, Sentry's Rest | Texto | — texto basta |  |  |
| Aven (2014) | Hawkeyed (variante Hawk-Headed Aven) | Pericia Percepción | ✅ |  |  |
| Aven (2014) | Kefnet's Blessing | Bono INT medio PB, situacional | — texto basta |  |  |
| Bugbear (2014) | Darkvision, Sneaky | Visión 60; Sigilo | ✅ |  |  |
| Bugbear (2014) | Long-Limbed, Surprise Attack, Powerful Build, Fey Ancestry | Alcance +5, 2d6 primer golpe | — texto basta |  |  |
| Centaur (2014) | Hooves | Fila de ataque 1d6+FUE contundente; velocidad 40 (dato) | ✅ |  |  |
| Centaur (2014) | Natural Affinity | Selector de 1 habilidad entre 4 | ✅ |  |  |
| Centaur (2014) | Charge, Equine Build | Texto | — texto basta |  |  |
| Custom Lineage (2014) | Feat | Ranura de dote de especie | ✅ |  |  |
| Custom Lineage (2014) | Variable Trait | Selector: Darkvision o habilidad (y tamaño Small/Medium) | ⚠️ | Visión 60 se aplica siempre (dato darkvision: 60) aunque se elija la habilidad; la opción "Darkvision" y la otra no se distinguen | data/species.json, engine.ts |
| Deep Gnome (2014) | Darkvision 120, Gift of the Svirfneblin, Svirfneblin Camouflage | Visión 120; Disguise Self (3) y Nondetection (5) gratis; contador PB/largo | ✅ |  |  |
| Deep Gnome (2014) | Gnomish Magic Resistance | Texto | — texto basta |  |  |
| Duergar (2014) | Darkvision 120, Dwarven Resilience, Duergar Magic | Visión 120; resist. Veneno; Enlarge/Reduce (3) e Invisibility (5) gratis | ✅ |  |  |
| Duergar (2014) | Psionic Fortitude | Texto | — texto basta |  |  |
| Earth Genasi (2014) | Merge with Stone | Blade Ward + contador PB/largo (acción adicional); Pass Without Trace (5) gratis | ✅ |  |  |
| Earth Genasi (2014) | Darkvision, Earth Walk | Visión 60 / texto | ✅ |  |  |
| Eladrin (2014) | Fey Step | Contador PB/largo + selector de estación (re-elegible en trance) + selector de característica | ✅ |  |  |
| Eladrin (2014) | Trance | Selector de 2 armas/herramientas "que no tienes", re-elegible en descanso largo | ✅ |  |  |
| Eladrin (2014) | Keen Senses, Darkvision | Percepción; visión 60 | ✅ |  |  |
| Fairy (2014) | Fairy Magic, Flight | Druidcraft; Faerie Fire (3) y Enlarge/Reduce (5) gratis; vuelo 30 (dato) | ✅ |  |  |
| Firbolg (2014) | Firbolg Magic, Hidden Step | Detect Magic y Disguise Self gratis (nivel 1); contador PB/largo | ✅ |  |  |
| Firbolg (2014) | Powerful Build, Speech of Beast and Leaf | Texto | — texto basta |  |  |
| Fire Genasi (2014) | Darkvision, Fire Resistance, Reach to the Blaze | Visión 60; resist. Fuego; Produce Flame; Burning Hands (3) y Flame Blade (5) gratis | ✅ |  |  |
| Giff (2014) | Astral Spark | Contador PB/largo (daño extra en texto) | ✅ |  |  |
| Giff (2014) | Firearms Mastery | Competencia con todas las armas de fuego | ⚠️ | La competencia no se añade (el motor solo lee armas elegidas con "weapon or tool"); items.json no tiene categoría "firearm" (la Pistola es "martial") | engine.ts (proficiencies), data/items.json |
| Giff (2014) | Hippo Build | Texto | — texto basta |  |  |
| Githyanki (2014) | Astral Knowledge | Selector de habilidad + arma/herramienta, re-elegible en largo | ✅ |  |  |
| Githyanki (2014) | Githyanki Psionics, Psychic Resilience | Mage Hand; Jump (3) y Misty Step (5) gratis; resist. Psíquico | ✅ |  |  |
| Githzerai (2014) | Githzerai Psionics, Psychic Resilience | Mage Hand; Shield (3) y Detect Thoughts (5) gratis; resist. Psíquico | ✅ |  |  |
| Githzerai (2014) | Mental Discipline | Texto | — texto basta |  |  |
| Glitchling (UA) (2014) | Armored Plating | CA 14+DES sin armadura | ✅ |  |  |
| Glitchling (UA) (2014) | Balance Chaos | Contador PB/largo | ✅ |  |  |
| Glitchling (UA) (2014) | Vestigial Wings | Contador PB/largo | ⚠️ | La velocidad de vuelo 30 sale siempre en la hoja (dato speed.fly): el texto solo la da hasta el final del turno, PB veces | data/species.json |
| Glitchling (UA) (2014) | Living Construct, Ordered Mind | Texto | — texto basta |  |  |
| Goblin (2014) | Darkvision, Fury of the Small | Visión 60; contador PB/largo | ✅ |  |  |
| Goblin (2014) | Nimble Escape, Fey Ancestry | Texto | — texto basta |  |  |
| Goblin (variante Zendikar) (2014) | Grit | Resist. Fuego y Psíquico ✅; CA 11+DES sin armadura | ⚠️ | La CA no se aplica ("your AC is equal to 11 + your Dexterity modifier"; el lector de TE exige "base Armor Class equals/is") | trait-effects.ts |
| Goblin (variante Zendikar) (2014) | Tribe | Selector de tribu (Grotag/Lavastep/Tuktuk) con sus competencias | ✅ |  |  |
| Goblin (variante Zendikar) (2014) | Darkvision | Visión 60 | ✅ |  |  |
| Grung (Oga) (2014) | Arboreal Alertness | Percepción; velocidad 25 y trepar 25 (dato) | ✅ |  |  |
| Grung (Oga) (2014) | Poison Immunity | Inmune a daño de veneno y condición envenenado | ⚠️ | No hay modelo de inmunidades: no se muestra ni se aplica | engine.ts, trait-effects.ts |
| Grung (Oga) (2014) | Poisonous Skin, Standing Leap, Water Dependency, Amphibious | CD 12 fija en texto | — texto basta |  |  |
| Hadozee (2014) | Hadozee Dodge | Contador PB/largo; trepar 30 (dato) | ✅ |  |  |
| Hadozee (2014) | Dexterous Feet, Glide | Texto | — texto basta |  |  |
| Half-Elf (2014) | Half-Elf Versatility — Skill Versatility / Cantrip / Fleet of Foot / Drow Magic / Swim Speed | Selector de opción; 2 habilidades; truco de Mago (INT); velocidad 35; Dancing Lights + Faerie Fire/Darkness gratis; nado | ✅ |  | trait-choices.ts, species-picks.ts |
| Half-Elf (2014) | Half-Elf Versatility — Elf Weapon Training | Competencia con espada larga/corta, arco corto/largo | ❌ | No se añade ninguna competencia con armas (el motor no lee "proficiency with the X, Y") | engine.ts (proficiencies) |
| Half-Elf (2014) | Half-Elf Versatility — Mask of the Wild | Texto | — texto basta |  |  |
| Half-Elf (2014) | Darkvision | Visión 60 | ❌ | El dato tiene darkvision: null (el texto sí dice 60); sin ese campo la hoja no muestra visión | data/species.json |
| Half-Elf (Mark of Storm) (2014) | Storm's Boon, Headwinds | Resist. Rayo; Gust; Gust of Wind (3) gratis 1/largo (CAR) | ✅ |  |  |
| Half-Elf (Mark of Storm) (2014) | Spells of the Mark | Conjuros de la marca añadidos a la lista de la clase lanzadora | ⚠️ | No se añaden a la lista de conjuros de la clase (solo texto) | engine.ts |
| Half-Elf (Mark of Storm) (2014) | Windwright's Intuition | +d4 en Acrobacias/Herramientas de navegante | — texto basta |  |  |
| Half-Orc (2014) | Relentless Endurance | Contador 1/largo | ✅ |  |  |
| Half-Orc (2014) | Menacing | Intimidación | ✅ |  |  |
| Half-Orc (2014) | Darkvision | Visión 60 | ❌ | El dato tiene darkvision: null (el texto dice 60) | data/species.json |
| Half-Orc (2014) | Savage Attacks | Dado extra en crítico | — texto basta |  |  |
| Harengon (2014) | Hare-Trigger, Leporine Senses, Rabbit Hop | Iniciativa +PB; Percepción; contador PB/largo | ✅ |  |  |
| Harengon (2014) | Lucky Footwork | Texto | — texto basta |  |  |
| Hobgoblin (2014) | Fey Gift | Contador PB/largo; la opción (nivel 3) se elige en cada uso | ✅ | Re-elección por uso: texto adrede (riesgo conocido 7) |  |
| Hobgoblin (2014) | Fortune from the Many, Darkvision | Contador PB/largo; visión 60 | ✅ |  |  |
| Kender (2014) | Kender Aptitude | Selector de 1 habilidad entre 5 | ✅ |  |  |
| Kender (2014) | Fearless, Taunt | Contador 1/largo; contador PB/largo + selector de característica | ✅ |  |  |
| Kenku (2014) | Kenku Recall | Selector de 2 habilidades; contador PB/largo | ✅ |  |  |
| Kenku (2014) | Expert Duplication, Mimicry | Texto | — texto basta |  |  |
| Khenra (2014) | Khenra Weapon Training | Competencia con khopesh, lanza y jabalina | ❌ | No se añade (mismo hueco que Elf Weapon Training); velocidad 35 sí viene del dato | engine.ts (proficiencies) |
| Khenra (2014) | Khenra Twins | Texto | — texto basta |  |  |
| Kobold (2014) | Kobold Legacy | Selector Craftiness (habilidad) / Defiance / Draconic Sorcery (truco de Hechicero + característica) | ✅ |  |  |
| Kobold (2014) | Draconic Cry, Darkvision | Contador PB/largo; visión 60 | ✅ |  |  |
| Kor (2014) | Kor Climbing | Atletismo y Acrobacias; trepar 30 (dato) | ✅ |  |  |
| Kor (2014) | Lucky, Brave | Texto | — texto basta |  |  |
| Leonin (2014) | Claws | Fila 1d4+FUE cortante | ✅ |  |  |
| Leonin (2014) | Hunter's Instincts | Selector de 1 habilidad entre 4 | ✅ |  |  |
| Leonin (2014) | Daunting Roar | Contador 1 con recarga corto o largo (short=all) | ✅ |  |  |
| Lizardfolk (2014) | Bite, Hungry Jaws, Nature's Intuition | Fila 1d6+FUE cortante; contador PB/largo; selector de 2 habilidades | ✅ |  |  |
| Lizardfolk (2014) | Natural Armor | CA 13+DES sin armadura | ❌ | La CA sale 10+DES: el texto dice "your base AC is 13 + your Dexterity modifier" y el lector de TE exige "base Armor Class" | trait-effects.ts |
| Lizardfolk (2014) | Hold Breath | Texto | — texto basta |  |  |
| Locathah (LR) (2014) | Observant and Athletic | Atletismo y Percepción; nado 30 (dato) | ✅ |  |  |
| Locathah (LR) (2014) | Natural Armor | CA 12+DES sin armadura | ❌ | No se aplica ("your AC is 12 + …") | trait-effects.ts |
| Locathah (LR) (2014) | Leviathan Will, Limited Amphibiousness | Texto | — texto basta |  |  |
| Loxodon (2014) | Natural Armour | CA 12+CON sin armadura | ❌ | No se aplica | trait-effects.ts |
| Loxodon (2014) | Powerful Build, Serenity, Trunk, Keen Smell | Texto | — texto basta |  |  |
| Merfolk (2014) | Amphibious | Texto | — texto basta |  |  |
| Minotaur (2014) | Horns | Fila 1d6+FUE perforante | ✅ |  |  |
| Minotaur (2014) | Goring Rush, Hammering Horns, Labyrinthine Recall | Texto (acciones adicionales sin límite) | — texto basta |  |  |
| Naga (2014) | Poison Affinity | Competencia con el kit de venenos | ✅ |  |  |
| Naga (2014) | Natural Weapons | Mordisco 1d4+FUE perforante (+1d4 veneno con TS) y Constreñir 1d6+FUE contundente | ⚠️ | Solo sale la fila del mordisco (1d4); falta la fila de Constrict (1d6 contundente) y el daño de veneno | natural-weapons.ts |
| Naga (2014) | Poison Immunity | Inmune a veneno | ⚠️ | Sin modelo de inmunidades | engine.ts |
| Naga (2014) | Speed Burst | +5 pies un turno | — texto basta |  |  |
| Owlfolk (UA) (2014) | Darkvision 90, Nimble Flight, Silent Feathers | Visión 90; vuelo 30 (dato); Sigilo | ✅ |  |  |
| Owlfolk (UA) (2014) | Magic Sight | Detect Magic como ritual (característica a elegir) | ❌ | El conjuro no aparece en la hoja: FE no reconoce "You gain the ability to cast the Detect Magic spell, but only as a ritual" (aparece el aviso de característica pendiente sin conjuro que lo use) | feat-effects.ts |
| Owlin (SCC) (2014) | Darkvision 120, Flight, Silent Feathers | Visión 120; vuelo 30; Sigilo | ✅ |  |  |
| Plasmoid (2014) | Natural Resilience, Darkvision | Resist. Ácido y Veneno; visión 60 | ✅ |  |  |
| Plasmoid (2014) | Amorphous, Hold Breath, Shape Self | Texto | — texto basta |  |  |
| Rabbitfolk (UA) (2014) | Hare-Trigger, Leporine Senses | Iniciativa +PB; Percepción | ✅ |  |  |
| Rabbitfolk (UA) (2014) | Type, Lucky Footwork, Rabbit Hop | Texto (salto d12 sin límite de usos) | — texto basta |  |  |
| Revenant (UA) (2014) | Human/Dragonborn Revenant, Relentless Nature | Narrativos (el bono de característica ya no aplica) | — texto basta |  |  |
| Satyr (2014) | Ram | Fila 1d6+FUE contundente; velocidad 35 (dato) | ✅ |  |  |
| Satyr (2014) | Reveler | Pericias Interpretación y Persuasión + 1 instrumento | ⚠️ | El selector del instrumento sí sale, pero no se dan Interpretación ni Persuasión: TE ignora las frases de competencia que contienen "of your choice" en la misma oración | trait-effects.ts |
| Satyr (2014) | Magic Resistance, Mirthful Leaps | Texto | — texto basta |  |  |
| Sea Elf (2014) | Child of the Sea, Keen Senses, Darkvision | Resist. Frío; Percepción; visión 60 | ✅ |  |  |
| Sea Elf (2014) | Trance | Selector de 2 armas/herramientas, re-elegible | ✅ |  |  |
| Sea Elf (2014) | Friend of the Sea | Texto | — texto basta |  |  |
| Shadar-Kai (2014) | Blessing of the Raven Queen | Contador PB/largo (resistencia a todo el daño del nivel 3 solo en texto) | ✅ |  |  |
| Shadar-Kai (2014) | Necrotic Resistance, Keen Senses, Darkvision, Trance | Resist. Necrótico; Percepción; visión 60; selector de 2 armas/herramientas | ✅ |  |  |
| Simic Hybrid (2014) | Animal Enhancements (selector) | 2 mejoras (la 2.ª a nivel 5) con selector; Nimble Climber → trepar; Underwater Adaptation → nado | ✅ |  | species-picks.ts |
| Simic Hybrid (2014) | Grappling Appendages | Selector garras/tentáculos; 1d6+FUE contundente | ⚠️ | No añade la fila de ataque natural (el texto dice "they do 1D6", y naturalWeaponOf lee "deals") | natural-weapons.ts |
| Simic Hybrid (2014) | Carapace | +1 CA sin armadura pesada | ❌ | No se aplica a la CA | engine.ts |
| Simic Hybrid (2014) | Acid Spit | Usos = mod. CON por descanso largo; 2d10 ácido (3d10 a 11, 4d10 a 17) | ❌ | Sin contador: la frase "up to your Constitution modifier's worth of times per long rest" no se lee | feat-effects.ts |
| Simic Hybrid (2014) | Manta Glide, Darkvision | Texto / visión 60 | — texto basta |  |  |
| Siren (2014) | Flight, Siren's Song | Vuelo 30 con velocidad 25 (dato); Friends | ✅ | Característica de lanzamiento de Friends: ver Dudas |  |
| Tabaxi (2014) | Cat's Claws, Cat's Talent, Darkvision | Fila 1d6+FUE cortante; Percepción y Sigilo; trepar 30 (dato) | ✅ |  |  |
| Tabaxi (2014) | Feline Agility | Duplica velocidad hasta moverte 0 pies | ⚠️ | Sin contador manual: se recarga "al moverte 0 pies", no con descanso; queda en texto | feat-effects.ts |
| Thri-kreen (2014) | Chameleon Carapace | CA 13+DES sin armadura | ❌ | No se aplica ("a base Armor Class of 13 + …": TE exige "equals/is") | trait-effects.ts |
| Thri-kreen (2014) | Darkvision, Secondary Arms, Sleepless, Telepathy | Visión 60 / texto | ✅ |  |  |
| Tortle (2014) | Claws, Nature's Intuition | Fila 1d6+FUE cortante; selector de 1 habilidad | ✅ |  |  |
| Tortle (2014) | Natural Armor | CA base 17 (sin DES), no puede llevar armadura | ❌ | No se aplica; además la CA fija sin DES (17) no es el patrón "N + DES" de TE | trait-effects.ts |
| Tortle (2014) | Shell Defense, Hold Breath | +4 CA mientras estás en el caparazón | — texto basta |  |  |
| Triton (2014) | Control Air and Water | Fog Cloud (1), Gust of Wind (3) y Water Walk (5) gratis 1/largo | ✅ |  |  |
| Triton (2014) | Guardian of the Depths, Darkvision | Resist. Frío; visión 60 | ✅ |  |  |
| Triton (2014) | Amphibious, Emissary of the Sea | Texto | — texto basta |  |  |
| Vampire (2014) | Vampiric Resistance | Resist. Necrótico | ✅ |  |  |
| Vampire (2014) | Darkvision | Visión 60 | ❌ | El dato tiene darkvision: null | data/species.json |
| Vampire (2014) | Bloodthirst, Feast of Blood | Ataque de drenaje / velocidad +10 temporal | — texto basta |  |  |
| Vedalken (2014) | Tireless Precision | Selector de habilidad (6) + herramienta | ✅ |  |  |
| Vedalken (2014) | Partially Amphibious | Contador 1/largo | ✅ |  |  |
| Vedalken (2014) | Vedalken Dispassion | Texto | — texto basta |  |  |
| Verdan (AI) (2014) | Persuasive | Persuasión | ✅ |  |  |
| Verdan (AI) (2014) | Black Blood Healing, Limited Telepathy, Telepathic Insight | Texto | — texto basta |  |  |
| Viashino (UA) (2014) | Bite, Lashing Tail, Wiry Frame | Dos filas de ataque (1d4 perforante, 1d4 cortante); selector Acrobacias/Sigilo | ✅ |  |  |
| Water Genasi (2014) | Darkvision, Acid Resistance, Call to the Wave | Visión 60; resist. Ácido; Acid Splash; Create or Destroy Water (3) y Water Walk (5) gratis | ✅ |  |  |
| Water Genasi (2014) | Amphibious | Texto | — texto basta |  |  |
| Yuan-ti (2014) | Poison Resilience, Darkvision | Resist. Veneno; visión 60 | ✅ |  |  |
| Yuan-ti (2014) | Serpentine Spellcasting | Poison Spray; Suggestion (3) gratis 1/largo | ⚠️ | Falta Animal Friendship "ilimitado" (solo serpientes): no aparece como conjuro a voluntad | feat-effects.ts |
| Yuan-ti (2014) | Magic Resistance | Texto | — texto basta |  |  |

## Patrones comunes (lo que falta, agrupado por mecanismo)

Orden aproximado de impacto. Todos son huecos del lector de texto o del dato, no de la interfaz.

1. **CA natural sin armadura con otra redacción** (6 especies, ❌/⚠️): Lizardfolk (13+DES), Locathah (12+DES), Loxodon (12+CON), Thri-kreen (13+DES), Tortle (17 fijo, sin DES) y Goblin variante Zendikar (Grit, 11+DES). `trait-effects.ts` (`unarmored`) solo acepta "base Armor Class equals/is N plus your X modifier"; estas especies escriben "base AC is…", "your AC is…", "base Armor Class of…" o "base AC of 17 (… doesn't affect)". Funcionan solo Autognome y Glitchling (UA), que usan la frase canónica.
2. **Bonos planos de CA de especie** (❌): Warforged (Integrated Protection, +1) y Simic Hybrid (Carapace, +1 sin armadura pesada). `engine.ts` solo suma bonos de CA procedentes de dotes (`featRules(f).ac`, patrón "+1 … wearing"); no hay lector equivalente para rasgos de especie. Shifter/Beasthide y Tortle/Shell Defense son condicionales (texto basta).
3. **Elección de habilidad sin "of your choice"** (3 ❌, más 1 resuelto): Elf 2024 (Keen Senses), Lupin (Werewolf Instincts) y Lorwyn Changeling (Delightful Imitator) dicen "proficiency in the A, B, or C skill". `traitPicks` exige "one … skill … of your choice" o el patrón de Viashino "(your choice)", así que no hay selector ni aviso de elección pendiente. Una sola regla nueva en `trait-choices.ts` los arregla.
4. **Competencia con armas fijas de la especie** (3 ❌/⚠️): Half-Elf (Elf Weapon Training), Khenra (khopesh, lanza, jabalina) y Giff (armas de fuego; `items.json` no tiene categoría "firearm"). `proficiencies()` en `engine.ts` solo suma las armas elegidas con un selector "weapon or tool".
5. **Conjuros innatos con redacción no reconocida** (3 ❌ + 1 ⚠️): Gnome/Rock Gnome ("You know the Mending and Prestidigitation cantrips", plural), Rimekin ("you learn the Ice Knife spell and the Flame Blade spell, respectively", más sus usos gratis 1/largo), Owlfolk UA (Magic Sight: "You gain the ability to cast the Detect Magic spell, but only as a ritual") y Yuan-ti (Animal Friendship ilimitado sobre serpientes). Todos en `feat-effects.ts`.
6. **Campo `darkvision` vacío en el dato** (4 ❌): Aetherborn, Half-Elf, Half-Orc y Vampire (2014) tienen el rasgo "Darkvision … 60 feet" pero `darkvision: null`; el lector de sentidos exige "range of N feet", así que la hoja no muestra visión en la oscuridad. Se arregla en el scraper (campo) o ampliando `trait-effects.ts`. Contrario: Custom Lineage trae `darkvision: 60` siempre aunque se elija la opción de habilidad.
7. **Dato incompleto: Dragonborn 2024** (❌): `data/species.json` solo contiene "Draconic Ancestry". Faltan Breath Weapon (contador PB/largo, daño por nivel, tipo según linaje), Damage Resistance (resistencia al tipo del linaje), Darkvision 60 y Draconic Flight (nivel 5). Las 10 variantes (Black… White) son solo "Damage Type: X" y por tanto el selector de linaje no tiene efecto alguno. Hay que arreglarlo en `tools/scraper/` (skill `datos`), no a mano.
8. **Inmunidades no modeladas** (⚠️ ×3): Grung (veneno), Naga (veneno) y Autognome (enfermedad). `Sheet` solo tiene `resistances`; no hay `immunities` ni de daño ni de condición. Las resistencias sí funcionan en las ~35 especies que las tienen.
9. **Cambio de truco en cada descanso largo de un linaje** (⚠️ ×2): High Elf y Lorwyn Elf (2024). La frase "Whenever you finish a Long Rest, you can replace that cantrip…" está en la descripción de la variante, no en el rasgo; el selector `cantrip` con `replaces` solo se activa para rasgos (Khoravar). Falta selector + restPick para el truco del linaje.
10. **Ataques naturales que el lector descarta** (⚠️ ×3): Shifter/Longtooth (el preámbulo del rasgo contiene "(choose when you select this species)" y `naturalWeaponOf` descarta todo el texto), Simic/Grappling Appendages ("they do 1D6…" en vez de "deals") y Naga (solo sale el mordisco; falta Constrict 1d6 contundente).
11. **Usos con recarga no representable** (⚠️ ×2, sin contador): Khoravar/Lethargy Resilience (1d4 descansos largos) y Tabaxi/Feline Agility (se recarga al moverte 0 pies). Además Simic/Acid Spit (❌): "up to your Constitution modifier's worth of times per long rest" no lo lee `feat-effects.ts`.
12. **Inspiración heroica por descanso largo** (⚠️ ×2): Human 2024 y Deep Imaskari (Resourceful). La casilla existe (`state.heroicInspiration`) pero el descanso largo no la activa.
13. **Bonos de "Spells of the Mark"** (⚠️ ×1): Half-Elf/Mark of Storm; los conjuros de la marca no se añaden a la lista de la clase.
14. **Velocidad de vuelo permanente por dato** (⚠️ ×1): Glitchling (UA), cuyo vuelo solo dura un turno, PB veces; y las especies con vuelo "no si llevas armadura media o pesada" (Aarakocra, Fairy/Faerie, Owlin, Siren) muestran la velocidad siempre (la restricción de armadura es solo texto).

Lo que **sí está bien resuelto** de forma general (útil para no re-auditar): conjuros innatos con nivel y uso gratuito 1/largo (≈50 especies/linajes, con aviso si falta la característica de lanzamiento), contadores "PB veces por descanso largo" (≈45 rasgos), selector de opción interna (Gnome, Goliath, Shifter, Kobold, Half-Elf, Custom Lineage, Goblin Zendikar), selectores de habilidad/herramienta/arma/truco/resistencia, elecciones re-elegibles por descanso (Kalashtar, Khoravar, Githyanki, Eladrin, Duskling, Astral/Sea/Shadar Trance), resistencias incondicionales, velocidades de nado/trepa/vuelo (tomadas del dato), +PG por nivel (Dwarf), filas de ataque natural (Tabaxi, Lizardfolk, Minotaur, Leonin, Tortle, Viashino, Aarakocra, Centaur, Satyr, Dhampir) y selector de tamaño cuando la especie admite Small o Medium.

## Dudas

- **Faerie (2024), Darkvision**: el dato da `darkvision: 120` a toda la especie, pero el texto de Flight dice "In addition, Shadowmoor faeries have Darkvision with a range of 120 feet" (solo ese linaje). No hay variante en el dato. ¿Visión 120 para todos o ninguna?
- **Kuo-toa (UA) / Siren / Illithidkin**: el texto de Deific Manifestation (Find Familiar) y de Siren's Song (Friends) no dice qué característica lanza el conjuro. El motor usa la mejor de INT/SAB/CAR; no se puede juzgar.
- **Dragonborn 2024**: puedo afirmar que el dato carece de Breath Weapon, etc., pero no invento su texto; hay que volver a extraerlo de la fuente.
- **Khoravar, Lethargy Resilience**: "1d4 Long Rests" – ¿contador manual de 1 uso con recarga "a mano"? Depende de si se quiere un contador sin recarga automática.
- **Tabaxi, Feline Agility**: igual (recarga al moverse 0 pies).
- **Sea Elf (2014)**: el texto del dato dice "you can breathe air and water, and you have resistance to cold damage" y no da velocidad de nado; no sé si la fuente original la daba. Se audita contra el texto.
- **Half-Elf Versatility, "Elf Weapon Training (High or Wood Elf Heritage)"**: competencia con armas concretas; ¿se espera que `Sheet.proficiencies.weapons` las liste (hoy no existe lector)?

## Observaciones (errores del volcado, aunque no sean faltantes)

- El volcado incluye una entrada por cada variante **reprint** (p. ej. `goblin (2014) / Goblin (Volo's Guide to Monsters)`, 42 en total) con el mismo resultado que la especie base: el motor las ignora (`chosenVariant`), no son elegibles y no aportan información.
- Las entradas del volcado no tienen elecciones hechas: por eso no muestran los conjuros de Gnome, los contadores de Goliath/Shifter, la opción de Eladrin, etc. (aparecen con `traitChoiceMissing`/`traitPickMissing`). Para verlos hay que fijar la elección (la sonda de esta auditoría lo hizo).
- Claves de contador poco intuitivas: Dhampir → `trait:species:vampiric-bite:strengthen` y Hexblood/Eerie Token → `…:remote-viewing` (la clave sale del primer encabezado en negrita del texto); funcionan, pero un cambio de redacción en el dato cambiaría la clave y dejaría huérfanos los usos gastados guardados.
- Los conjuros gratuitos "siempre preparados" que salen del propio rasgo (Hexblood, Drider, Faerie, Illithidkin, Kuo-toa…) no llevan la marca `always` ("siempre preparado") en la hoja, a diferencia de los linajes de Elf/Tiefling/Gnome (que la ponen por la ruta de variantes). Es solo etiqueta.
- El volcado muestra `ac=12` para Warforged, Lizardfolk, Locathah, Loxodon, Thri-kreen, Tortle, Goblin Zendikar y Simic (Carapace): coincide con los huecos de CA de arriba (el volcado es correcto; el motor no aplica la regla). En cambio Autognome (15) y Glitchling (16) sí aplican la CA natural.
- `Custom Lineage` (2014) devuelve `darkvision: 60` aunque la opción elegida sea la habilidad.

## Método y límites

- Texto leído: `data/species.json` (89 especies); código: `species-picks.ts`, `trait-choices.ts`, `trait-effects.ts`, `natural-weapons.ts`, `feat-effects.ts`, `engine.ts` (`traitGrants`, `proficiencies`, CA/velocidad/sentidos), `play-state.ts` (contadores) y el asistente (`character-create.ts/.html`: selectores de variante, opción de rasgo, picks, característica y tamaño).
- Además del volcado, se ejecutó `computeSheet` (empaquetado con esbuild fuera del repo, sin tocar el checkout ni lanzar tests) con las elecciones hechas, nivel 5, para cada especie, variante y opción interna; esa salida respalda las afirmaciones de "no se aplica".
- No se comprobó la interfaz en navegador (selectores renderizados); se juzgó por el código del asistente y por que `speciesTraits` devuelve el pick esperado.
