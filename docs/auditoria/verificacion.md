# Verificación de la Fase 4

Carpeta **Pruebas** (contraseña `prueba123456`): 216 personajes de prueba, uno por subclase (niveles
3/6/10/14/20 rotando), Soulknife, Druida de la Luna y Artificiero (Alchemist) a niveles 3, 5 y 11, un
Paladín de nivel 19 y un Mago de nivel 1. Todos se descifran con la contraseña (con otra no) y su
hoja se calcula sin errores.

Método: se vuelca la hoja calculada de cada personaje y un agente (Sonnet) por clase la compara con
el texto real de `data/classes.json` y `data/subclasses.json`. Los fallos los corrige Opus en el
motor, con tests sobre datos reales.

## Recuento (antes de los arreglos)

| Clase | Revisados | Correctos | Con fallos |
| --- | --- | --- | --- |
| Artificiero | 10 | 1 | 9 |
| Bárbaro | 12 | 8 | 4 (+1 común a todos) |
| Bardo | 11 | 5 | 6 |
| Brujo | 19 | 9 | 10 |
| Cazador de sangre | 4 | 0 | 4 |
| Clérigo | 24 | 12 | 12 |
| Druida | 15 | 7 | 8 |
| Explorador | 12 | 10 | 2 (+1 común) |
| Guerrero | 21 | 9 | 12 |
| Hechicero | 21 | 12 | 9 |
| Mago | 22 | 14 | 8 |
| Monje | 15 | 8 | 7 |
| Paladín | 14 | 14 | 0 (+1 común) |
| Pícaro | 16 | 10 | 6 |

Los casos que señalaste: **Soulknife 3/5/11** correcto (dados psiónicos 4/6/8 con recuperación de uno
en descanso corto, Sneak Attack, CD, filas de ataque). **Druida de la Luna 3/5** correcto; a 11 solo
el fallo de Elemental Fury (arreglado). **Artificiero Alchemist 3/5/11**: faltaba Alchemist's Supplies
(arreglado); Experimental Elixir sigue sin contador.

## Arreglado tras la verificación

- Daño de una opción solo con esa opción elegida (Divine Strike, Primal Strike con Potent Spellcasting).
- Listas de beneficios en viñetas o negritas que se aplican todas (Saint of Forge and Fire, Battle Ready).
- Herramientas "Supplies" y fijas junto a una elegida (Alchemist, Drunken Master, Mastermind).
- Idiomas que enseña un rasgo (Sylvan, Druidic).
- Pericia: Unlight, Unencumbered Grace, Survivalist (competencia doblada).
- Darkvision que suma 60 si ya la tienes (Gloom Stalker, Shadow Arts, Solemn Gaze, Aspect of the Wilds).
- Selectores nuevos: trucos de una clase o escuela, "another / one additional skill", "choose one of
  these skills", "either X or Y", dos resistencias (Indomitable Defense), habilidad "(your choice)".
- Paladin's Smite: Divine Smite gratis una vez por descanso largo, con contador.
- Rasgos solo en parte situacionales (Hungering Might: + SAB a salvación de CON).
- Thought Shield: resistencia psíquica. Dueling de Swords ("wielding").
- Magical Secrets: el Bardo 10+ prepara de Clérigo, Druida y Mago.
- Beast Tattoo ya no aplica los 5 tatuajes; Metal Magic amplía la lista en vez de prepararla.
- Resistencias a elegir (Fiendish Resilience, Noble Genie, Aura of Elemental Shielding); Divine Soul
  prepara también de la lista de Clérigo; habilidades a elegir de Charming Presence y Ancestor's Lore.

No hay ningún personaje real tuyo de nivel 19 (los tuyos son de nivel 3 a 5): la prueba de nivel
alto se hizo con el Paladín de nivel 19 y los de nivel 20 de la carpeta Pruebas.

## Arreglado en la segunda tanda

- Contadores: Psi Replenishment, Healing Hands, Mantle of Whispers, Channel Arcana, Resonants, Balm
  of the Summer Court, Experimental Elixir, Spell-Storing Item, +1 Blood Maledict (Curse Specialist).
- Lanzamientos gratis: Grasping Tentacles, Protection from Evil and Good (Monster Hunter), Voice of
  Death (descanso corto, DES), Fool's Insight (CAR veces, sin contador duplicado).
- Con la Furia activa: resistencias e inmunidades "while your Rage is active" (Lament, Berserker).
- Pericia de Tyrants Herald; armas del Bladesinger; Crimson Rite con su dado de hemocracia.
- Elecciones: Armor Model (por encabezados, cambiable en descanso), Scion of the Three y Giant Soul
  (por tabla), Magical Discoveries y Mental Discipline (conjuros con nivel), Mystic Arcanum (un
  conjuro de Brujo por arcano), Deft Explorer (una pericia y dos idiomas más).
- Star Map (Guidance y Guiding Bolt), Consult the Spirits (Augury y Clairvoyance), CA natural del
  Locathah. Timeless, Arcanomechanical Armor y +2 CON de Giant Soul ya salían bien.

## Arreglado en la tercera tanda (subagentes)

- Selectores: elemento del Primordial, Vestige Spells (dominio), Theurgy (dominio, Channel Arcana,
  Arcane Acolyte/Priest/High Priest), patrón del Profane Soul (9), tatuajes (Beast Tattoo: dos de
  cinco; Celestial, Nature y Monster Tattoo: uno), herramienta de artesano (Student of Preservation,
  Blessings of Knowledge, Student of War).
- Mecánicas: Lore Mastery (pericia en las habilidades en que ya eres competente; iniciativa con la
  mejor de INT o DES), Bladework y Arcane Empowerment (INT en ataque y daño), House Insignia (un
  lanzamiento por conjuro de la tabla), Power Surge (contador aproximado), "Vehicles (Land)" del City Domain.
- Números por nivel: Psychic Blades, Banshee's Wail, Deathly Wail, Spirit Shield, Storm Aura,
  Reckless Abandon, Mantle of Inspiration, Creative Crescendo, Bardic Damage, Balm of Peace, Pull of Death.

## Pendiente (no arreglado aún)

- **Primordial**: el tipo de daño y la resistencia dependen de la tabla "Primordial Patrons", que no
  está en los datos (hay que extraerla en el scraper). Sin elemento elegido no se prepara ningún conjuro.
- **Theurgy**: la lista de deidades no está en los datos (se ofrecen todos los dominios) y falta
  "Arcane Initiate" (meter conjuros del dominio en el libro).
- **Asistente de creación**: no pide las elecciones de rasgos de clase/subclase (solo la hoja y la
  subida de nivel); un tatuaje no se puede rehacer tras un descanso largo.
- **Power Surge**: el contador no reinicia a 1 ni suma +1 tras un descanso corto sin ninguno; el daño
  extra (mitad del nivel de mago) no está calculado. **City Domain**: "sidearms" no es una categoría de
  los datos.

## Clérigo — 24 personajes: 12 correctos, 12 con fallos

| Fallo | Estado |
| --- | --- |
| Blessed Strikes = Potent Spellcasting seguía mostrando el daño de Divine Strike (7 personajes); lo mismo en Elemental Fury del Druida | ✅ los números de una opción solo salen con esa opción elegida |
| Student of Arcana: 2 trucos de Mago sin selector | ✅ |
| Acolyte of Strength: truco de druida sin selector | ✅ |
| Reaper: truco de nigromancia de cualquier lista sin selector | ✅ (filtro por escuela) |
| Order / Peace: habilidad "(your choice)" sin selector | ✅ |
| Indomitable Defense: 2 resistencias a elegir | ✅ selector y resistencias aplicadas |
| Saint of Forge and Fire: inmunidad al fuego | ✅ las viñetas de una lista de beneficios (sin "elige") se aplican todas |
| Unencumbered Grace: Acrobacias (pericia si ya la tienes) | Pendiente |
| City Domain: competencia con "sidearms" y vehículos terrestres | Pendiente (armas de fuego de homebrew/UA) |

Dudosos (sin cambio): Divine Strike / Potent Spellcasting de 2014 en nivel 17 (decisión de
`dudas.md` #7), herramienta de Blessings of Knowledge, telepatía de Unfettered Mind, Pull of Death y
Balm of Peace sin precalcular.
