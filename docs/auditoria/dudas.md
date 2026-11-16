# Dudas de reglas y de producto

Recogidas de las secciones "Dudas" de cada informe (ahí están con más contexto). Formato:
**elemento** — qué dice el texto — por qué es ambiguo — opciones.

## Bloquean la Fase 2 o la Fase 3

1. **[bloquea] Contraseña de carpetas: "comprobar en el backend"** — la app no tiene servidor
   propio: los personajes son JSON en tu repo de GitHub, legibles por quien tenga acceso al repo.
   Opciones: (a) **cifrar** los personajes de la carpeta con una clave derivada de la contraseña
   (argon2id/PBKDF2 + AES-GCM), como ya hacen los encuentros del DM (`encounter-crypto.ts`): sin la
   contraseña nadie puede leerlos, ni en la app ni en GitHub; (b) solo un hash de la contraseña y
   ocultarlos en la interfaz (cualquiera podría leerlos en GitHub). Recomiendo (a).
2. **[bloquea] Libro de conjuros del Mago** — 6 conjuros a nivel 1 + 2 por nivel, distinto de los
   preparados. Exige un campo nuevo `choices.spellbook`. ¿Lo hago, con migración de los magos
   actuales (sus conjuros elegidos pasan a ser el libro)?
3. **[bloquea] Datos del scraper (S11)** — Dragonborn 2024, Crimson Rite, Arcane Shots, runas…
   exigen una extracción online que no puedo lanzar. ¿Preparo las reglas del scraper para que tú
   lances la extracción, o lo dejo para más adelante?

## Reglas

4. **Signature Arcanum y Aberrant Magic** — "level 7 (8) or lower spell": hoy incluye trucos.
   ¿Solo nivel 1+?
5. **Harbinger of Doom** — se incluyó entre los conjuros que gastan Death Points (misma frase).
   ¿Lo dejo?
6. **Monje 2014: "ki" = Focus Points** — 8 subclases 2014 gastan ki. ¿Enlazo su coste con el
   contador de Focus Points?
7. **Divine Strike / Potent Spellcasting de dominios 2014** — el scraper los movió de nivel 8 a 17
   y chocan con Blessed Strikes de 2024. ¿Se muestran, a qué nivel, y sustituyen a Blessed Strikes?
8. **Blessed Warrior / Druidic Warrior 2024** — solo existe la dote de 2014. ¿Ofrezco esa dote
   como Fighting Style del Paladín/Explorador 2024?
9. **Hemocraft (Cazador de sangre)** — INT o SAB a elegir "con permiso del DM". ¿Selector para toda
   la clase o solo Profane Soul (como hoy)?
10. **Maldiciones de orden (Cazador de sangre)** — el texto dice que las "ganas". ¿Concederlas
    solas en vez de gastar una elección?
11. **Usos con recarga rara** — Lethargy Resilience (1d4 descansos largos), Feline Agility (al
    moverse 0 pies), Tides of Chaos (al lanzar con espacio). ¿Contador manual de 1 uso sin recarga
    automática?
12. **Elecciones que se re-eligen en cada uso** (Storm Aura, Rage of the Wilds, Hobgoblin Fey Gift):
    ¿selector "última elección" o texto?
13. **Dotes encadenadas** (Adept of the * Robes ← Initiate of High Sorcery; Knight of * ← Squire of
    Solamnia; Divine Communications ← Divinely Favored…) — heredan la característica de la dote
    previa. ¿Enlazar o dejar como texto?
14. **Faerie 2024** — el dato da visión 120 a toda la especie y el texto solo a Shadowmoor.
15. **Característica no indicada** (Kuo-toa, Siren, Illithidkin, Cartomancer, Boon of Revelry) —
    hoy se usa la mejor de INT/SAB/CAR. ¿Preguntar al jugador?
16. **Nombre de Psychic Blade(s)** — hoy "Espadas psíquicas" (rasgo) y "Hoja psíquica" (ataque).
    Tú dices "Cuchillas Psíquicas". ¿Cuál fijo?
17. **Aura of Protection** — "you and your allies": ¿suma a tus salvaciones siempre (salvo
    incapacitado)? Se asume que sí.
18. **Mariner (2014)** — ¿el +1 de CA también sin armadura? (literalmente sí).
19. **Cálculos situacionales** (Healer, Heavy Armor Master, Inspiring Leader, Channel Divinity con
    números por nivel) — hoy texto; ¿los quieres calculados?
20. **Battlerager "solo enanos"** — ¿bloquear o solo avisar?
21. **Textos incompletos en los datos** — Scion of Elemental Fire/Water (falta "Elemental Magic"),
    Wonder Maker (opciones cortadas), Magic Initiate (falta el párrafo de los trucos). Arreglo de
    scraper.

## Respuestas del usuario y estado

| # | Respuesta | Estado |
| --- | --- | --- |
| 1 | Cifrar (a) | ✅ argon2id + AES-GCM (`core/organize/folder-lock*.ts`) |
| 2 | Sí, con migración | Pendiente (Fase 3, S5) |
| 3 | Lanzar el scraper | ✅ extracción local hecha; datos regenerados |
| 4 | Incluir trucos (como hoy) | ✅ sin cambios |
| 5 | Dejar Harbinger of Doom | ✅ sin cambios |
| 6 | Enlazar ki con Focus Points | ✅ `combat-actions.ts` |
| 7 | Divine Strike no sustituye a Blessed Strikes | ✅ se muestran los dos |
| 8 | Ofrecer Blessed/Druidic Warrior | ✅ solo en el estilo de combate de Paladín/Explorador (leído del texto de la clase), con sus 2 trucos |
| 9 | Selector para toda la clase | ✅ Hemocracia INT/SAB (la más alta por defecto): CD, Dark Augmentation, Brand of Castigation, Profane Soul (`class-ability.ts`) |
| 10 | Selección | ✅ sin cambios |
| 11 | Recarga automática + aclaración | ✅ contador con nota "cómo se recupera de verdad" en Recursos |
| 12 | Elección en cada uso | ✅ texto |
| 13 | Enlazar | ✅ heredan la característica de la dote previa (aviso si no cuadra) |
| 14 | Correcto | ✅ sin cambios |
| 15 | Preguntar en empate; si no, la más alta | ✅ |
| 16 | Como está | ✅ sin cambios |
| 17 | Bien asumido | ✅ sin cambios |
| 18 | Sí | ✅ +1 CA y nado/trepa sin armadura pesada ni escudo |
| 19 | Calculados | ✅ Healer, Heavy Armor Master, Inspiring Leader; Divine Spark, CD de Turn Undead, Touch of Death, Path to the Grave, Radiant Defense, Preserve Life (Solidarity), Fortifying Spell |
| 20 | Avisar | ✅ aviso en la hoja si la especie no es la del texto ("Only dwarves can...") |
| 21 | Arreglar el scraper | ✅ cabecera de dotes y listas anidadas |
