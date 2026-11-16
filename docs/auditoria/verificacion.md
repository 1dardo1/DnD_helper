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

## Pendiente (no arreglado aún)

- **Selectores de subclase**: elemento Primordial, Vestige Spells, Theurgy (Divine Inspiration, Arcane Acolyte), Psionics, Giant Soul,
  Scion of the Three, Favored Soul (dominio y armaduras), Armor Model (Armorer), Student of
  Preservation, patrón del Profane Soul, Deft Explorer (pericia y 2
  idiomas), arcano de Mystic Arcanum, los dos tatuajes de Beast Tattoo, Magical Discoveries (2 conjuros).
- **Contadores**: Psi Replenishment, Healing Hands, Protection from Evil and Good (Monster Hunter),
  Spell-Storing Item, Mantle of Whispers, Experimental Elixir, Channel Arcana, Resonant Utterance,
  Power Surge, Grasping Tentacles gratis, House Insignia, Voice of Death (recarga corta y DES),
  Curse Specialist (+1 Blood Maledict), Balm of the Summer Court, Harvest's Scythe, Lunar Embodiment.
- **Crimson Rite**: sin selector de ritos ni daño del dado de hemocracia.
- **Furia**: resistencias de Otherworldly Anguish (Lament) mientras la Furia está activa.
- **Competencias y bonos**: armas marciales cuerpo a cuerpo sin Two-Handed/Heavy (Bladesinger),
  armadura ligera (Arcanomechanical Armor), pericia en Intimidación (Sorcerer-King), Lore Mastery,
  Bladework y Arcane Empowerment (INT en ataque), +2 CON de Giant Soul, Blessed Countenance,
  inmunidad al cansancio de Timeless, CA natural de Locathah, Guidance de Star Map, conjuros de
  Consult the Spirits y Fool's Insight en la lista de conjuros concedidos.
- **Números por nivel sin calcular** (situacionales): Psychic Blades de Whispers, Banshee's Wail,
  Spirit Shield, Storm Aura, Reckless Abandon, Mantle of Inspiration, Balm of Peace, Pull of Death.

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
