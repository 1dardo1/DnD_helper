# Resumen de la auditoría (Fase 1)

16 auditores Sonnet revisaron dotes, especies y las 14 clases con sus 205 subclases contra el
texto real de `data/*.json` y contra lo que el motor calcula hoy (`docs/auditoria/_volcado/`).
El detalle, con ficheros implicados, está en `dotes.md`, `especies.md` y `clases/<clase>.md`.

## Recuento

| Bloque | ✅ completo | ⚠️ parcial | ❌ falta | — texto basta |
| --- | ---: | ---: | ---: | ---: |
| Dotes (313) | 192 | 79 | 25 | 17 |
| Especies (89 + variantes) | 133 | 20 | 23 | 54 |
| Clases y subclases (14 + 205) | 490 | 169 | 236 | 507 |

Por clase (✅/⚠️/❌): Artificiero 22/11/12 · Bárbaro 23/15/15 · Bardo 18/8/8 · Cazador de sangre
8/12/10 · Clérigo 60/19/27 · Druida 34/10/10 · Guerrero 43/9/33 · Monje 26/14/17 · Paladín 47/5/4
· Explorador 35/10/8 · Pícaro 25/9/9 · Hechicero 49/9/22 · Brujo 64/28/26 · Mago 36/10/35.

Lo de 2024 está bastante completo. Casi todo lo que falta es de subclases 2014/UA, de elecciones
dentro de rasgos de clase y de efectos que dependen de un estado.

## Tus tres casos

- **Soulknife**: no falta. La ficha calcula los Dados de Energía Psiónica (4/6/8/10/12, uno por
  descanso corto) y las dos filas de ataque, también con tu personaje real Kriug. Llegó el 7-9 de
  noviembre: lo más probable es una versión vieja en tu dispositivo (ver CLAUDE.md, riesgo 2).
  Además, en la app se llama "Espadas psíquicas" (rasgo) / "Hoja psíquica" (ataque), en la sección
  "Sin armas, naturales y especiales", no "Cuchillas Psíquicas".
- **Druida de la Luna**: el motor añade los conjuros del círculo, pero la interfaz falla: en la hoja
  los conjuros de druida solo se eligen tras un descanso largo, los trucos no se pueden cambiar
  nunca, y los del círculo salen en otra columna rotulados "Dote: Circle of the Moon". El asistente
  no avisa de que ya están concedidos.
- **Artificiero**: los 55 planos coinciden con el texto y crear objetos funciona, pero el panel está
  en la pestaña Conjuros y, sin planos elegidos, dice "elígelos al subir de nivel" sin botón (aunque
  "Cambiar planos" sí deja elegirlos). No hay "infusiones" en 2024: son los planos. Fallos reales:
  el bono +1/+2 del plano no se fija (se puede poner +3), los planos +1/+2 no se pueden Drenar,
  y Armor Replication no cuenta.

## Lo que falta, por sistema común

Ordenado por cuántos elementos arregla cada sistema. Entre paréntesis, ejemplos.

### S1. Elecciones dentro de rasgos de clase y subclase (≈ 90 elementos) — el mayor hueco

Hoy el selector de "elige una opción / una habilidad / un truco / un tipo de daño" solo existe
para especies (`trait-choices.ts`, `species-picks.ts`) y dotes (`FEAT_PICKS`). Ningún rasgo de
clase o subclase lo tiene, y `missing` no avisa.
- Opciones de clase 2024: Divine Order (Clérigo), Primal Order y Elemental Fury (Druida), Blessed
  Strikes, Primal Knowledge (Bárbaro), Deft Explorer (pericia + 2 idiomas), Scholar (Mago),
  Hunter's Prey / Defensive Tactics, Fighting Style alternativo (Blessed/Druidic Warrior).
- Elecciones de subclase: tipo de dragón (Hechicero), genio y elemento (Brujo), tierra del Círculo
  de la Tierra (hoy se activan las 4 listas a la vez), Rage of the Wilds / Aspect of the Wilds,
  Giant Soul, Lunar, Divine Soul, tatuajes, Kensei, Armor Model, modificaciones del Reanimator…
- Elecciones cambiables en descanso (mismo `restPicks` que ya usan especies y dotes).
- Habilidades, trucos, conjuros, herramientas e idiomas "a elegir" de subclase (Lore, Moon,
  Knowledge, Arcana, Student of War, Bonus Proficiencies…).
Diseño: un lector genérico de elecciones sobre el texto del rasgo (reutilizando `traitChoice` y
`traitPicks`), guardado en `choices.traitChoices`/`traitPicks` con clave de clase, y el mismo
selector del asistente, la subida de nivel y la hoja.

### S2. Competencias concedidas por rasgos (≈ 45)

`proficiencies()` en `engine.ts` solo suma clase, multiclase, trasfondo y dotes.
- Armas y armaduras de subclase (Valor, Swords, Battle Smith, Armorer, Hexblade 2014, 10
  dominios, Protector de Divine Order…).
- Herramientas y habilidades fijas de subclase.
- Salvaciones: Slippery Mind (Pícaro), Iron Mind, Disciplined Survivor (Monje), Diamond Soul…
- "Si ya eres competente, el doble" (≈ 25 dotes UA, Lore Mastery) → pericia.
- Armas de especie (Elf Weapon Training, Khenra, Giff) y "proficiency in the A, B or C skill" sin
  "of your choice" (Elf 2024, Lupin, Lorwyn Changeling).

### S3. Estados activables y efectos "mientras" (≈ 40)

`ACTIVE_STATES` es una lista cerrada de 5 (Furia, Forma salvaje, Maleficio, Marca del cazador,
Hechicería innata). Faltan: Bladesong, Starry Form, Wrath of the Sea, Symbiotic Entity, Titan
Form, Form of Dread, Hybrid Transformation, Elemental Attunement, Arms of the Astral Self, Wrath of
the Wild, Crimson Rite… y los efectos de subclase "mientras Furia" (resistencias, vuelo).
**Errores actuales** (se aplican siempre efectos temporales u opciones excluyentes a la vez):
vuelo de Aberrant 14 y Phoenix 18, resistencias de Lunar 14, Superior Dread, Stormborn, resistencia
necrótica del Ghostslayer, Mystic Brew, Aspect of the Wilds y Bestial Soul (todas las opciones a la
vez).

### S4. Conjuros concedidos por rasgos (≈ 45)

- Redacciones que el lector no entiende: minúscula ("you learn the X cantrip"), plural ("the
  Mending and Prestidigitation cantrips"), "as a ritual", "cast the X spell", pronombre ("cast it
  once"), cursivas. Afecta sobre todo a 2014: Undying, Fathomless, Fate, Sun Soul, Monster Hunter,
  Rock Gnome, Rimekin, Owlfolk…
- `subclass.spells` se toma siempre como "siempre preparados": mal para las listas ampliadas del
  Brujo 2014 (deberían ampliar la lista elegible), Metal Magic, Lunar (nombres fusionados) y
  Profane Soul (18 filas de su tabla de lanzamiento tomadas como conjuros).
- Tablas "Spell Slot Level | Spell" de las 8 dotes Adept.
- Conjuros que gastan otro recurso marcados "a voluntad": Psionic Energy Die (Full Ceremorphosis,
  Illithid Thrallmaker, Tadpole's Safeguard), Glamour, See Invisibility del Diviner.
- Lanzamiento gratis de conjuros de clase sin contador (`freeKey` nulo para conjuros de clase):
  Divine Smite, Find Steed, Contact Patron.

### S5. Selección de conjuros y libro de conjuros (≈ 30)

- Libro de conjuros del Mago (6 + 2 por nivel, distinto de preparados): de él dependen Spell
  Mastery, Signature Spells, Memorize Spell, los 8 "Savant", Ritual Adept… Requiere un campo nuevo
  `choices.spellbook`.
- Listas ampliadas: Magical Secrets (Bardo), Divine Soul / Favored Soul (Clérigo), Magical
  Discoveries, Primal Lore, Pact of the Tome, Mystic Arcanum (hoy no se puede elegir).
- Hoja: elegir conjuros fuera del descanso largo, cambiar trucos, y conjuros de subclase en la lista
  de preparados (no como "Dote").
- `cantripsByLevel` nulo en Eldritch Knight, Arcane Trickster y Mystic Arts (scraper).

### S6. Contadores, reservas y recargas (≈ 40)

- Reservas sin contador: Portent, Arcane Ward (PG), Balm of the Summer Court, Harvest's Scythe,
  Superiority Dice del Monster Hunter y del Scout, mutágenos.
- Recargas mal leídas: Improved Warding Flare, Voice of Death, Fey Teleportation, Sorcerous
  Restoration (corto), Tireless (agotamiento en corto), Inspiración heroica en descanso largo.
- Contadores duplicados: Drain / Transmute / Eldritch Cannon del Artificiero, Hybrid
  Transformation, Curse Specialist no suma su uso extra.
- Monje 2014: el coste en "ki" no enlaza con los Focus Points.
- Acciones de recuperar un uso pagando algo (espacio, Furia, Puntos de hechicería, Inspiración) y
  conversiones (Font of Magic, Arcane Recovery, Magical Cunning): hoy todo a mano.

### S7. Bonos numéricos que no se aplican (≈ 25)

- **Error**: velocidad del Monje con 10 pies de más desde nivel 2 (Unarmored Movement contado dos
  veces).
- Salvaciones: Aura of Protection. Velocidad: Aura of Alacrity, Scout, Stalker's Prowess.
- CA: armadura natural con otra redacción (Lizardfolk, Locathah, Loxodon, Thri-kreen, Tortle),
  +1 de Warforged, Simic y Soul of the Forge; Battle Ready (INT en ataque y daño).
- Capstones: Primal Champion (+4 FUE/CON), Body and Mind (+4 DES/SAB).
- Visión: Umbral Sight y Shadow suman 60 si ya tienes visión en la oscuridad (hoy toman el máximo).

### S8. Inmunidades (≈ 25)

La ficha solo tiene `resistances`. Faltan inmunidades a daño y a estados (Aura of Courage, Fungal
Body, Nature's Ward, Mindless Rage, Toxic Refiner, Strange Metabolism, especies Grung, Naga,
Autognome, 4 épicas…).

### S9. Opciones de clase (`choices.options`) (≈ 20)

- No están en los datos (hay que extraerlas en el scraper): Crimson Rite, Arcane Shots, runas del
  Rune Knight, maniobras 2014 en viñetas.
- Dotes que dan opciones de otra clase: Martial Adept, Superior Technique, Metamagic Adept, Eldritch
  Adept, Fighting Initiate.
- Invocaciones con elección interna o repetibles (Agonizing Blast, Lessons of the First Ones) y
  maldiciones de orden del Cazador que deberían concederse solas.

### S10. Ataques y CD (≈ 20)

CD de maniobras, Arcane Shot y rasgos de subclase; fila del arma de pacto; ataques naturales que no
salen (Shifter Longtooth, Simic, Naga Constrict, Form of the Beast); armas Kensei; Bardic Damage;
Radiant Sun Bolt; bonos de ataque por arma de dotes 2014.

### S11. Datos del scraper (≈ 20; se arreglan en `tools/scraper/`, nunca a mano)

Dragonborn 2024 casi vacío; `darkvision: null` en 4 especies; `abilityIncrease: null` en 5 dotes;
`cantripsByLevel` nulo; bloques de Titan Form dentro de otro rasgo; nombres de conjuro concatenados
(Genie, Primordial, Lunar); conjuros inexistentes (Ghost in the Machine, "Fire Shield (warm shield
only)"); textos cortados (Scion of Elemental Fire/Water, Wonder Maker, Magic Initiate); niveles
desplazados (Divine Strike 2014 a 17, Master Artificer).

## Plan propuesto para la Fase 3

1. Sistemas comunes, en este orden: **S7** (errores y bonos, rápido), **S2**, **S1**, **S3**, **S4**,
   **S6**, **S8**, **S5** (libro de conjuros: cambio de modelo) y **S9/S10**.
2. Después, los elementos concretos por bloques (dotes → clases → especies), actualizando cada
   informe.
3. Lo del scraper (S11) necesita una extracción online que CLAUDE.md prohíbe lanzar: solo puedo
   preparar las reglas, y la extracción la tendrías que lanzar tú.

## Decisiones que necesito de ti

Ver `dudas.md`. Las que bloquean la Fase 2 y 3 están marcadas como **[bloquea]**.
