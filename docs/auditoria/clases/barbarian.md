# Auditoría de la clase Bárbaro

Fuentes: `data/classes.json` (`barbarian`, 2024), `data/subclasses.json` (12 subclases con `classId` = barbarian), volcado `docs/auditoria/_volcado/clase-barbarian.json` y lectura del código en `app/src/app/core/{rules,play,creation}` y `features/`. Solo lectura: no se ejecutó ningún test ni build.

## Resumen

| Ámbito | ✅ | ⚠️ | ❌ | — | Total |
| --- | --- | --- | --- | --- | --- |
| Clase base (niveles 1-20) | 10 | 2 | 3 | 5 | 20 |
| Berserker (2024) | 1 | 1 | 0 | 2 | 4 |
| Corazón salvaje (2024) | 0 | 1 | 4 | 0 | 5 |
| Árbol del mundo (2024) | 1 | 1 | 0 | 2 | 4 |
| Fanático (2024) | 3 | 2 | 0 | 0 | 5 |
| Guardián ancestral (UA) | 0 | 2 | 0 | 2 | 4 |
| Heraldo de la tormenta (UA) | 0 | 1 | 1 | 2 | 4 |
| Lamento (UA) | 1 | 2 | 2 | 0 | 5 |
| Sin luz / Unlight (UA) | 1 | 2 | 0 | 2 | 5 |
| Bestia (2014) | 2 | 0 | 2 | 0 | 4 |
| Gigante (2014) | 2 | 1 | 1 | 1 | 5 |
| Magia salvaje (2014) | 2 | 0 | 0 | 3 | 5 |
| Furia de batalla / Battlerager (2014) | 0 | 0 | 2 | 3 | 5 |
| **Total** | **23** | **15** | **15** | **22** | **75** |

(Subclases solas: 13 ✅, 13 ⚠️, 12 ❌, 17 —.)

Lo que sí funciona bien en toda la clase: contador de Furias (columna `Rages`, +1 en descanso corto, todas en largo), estado "Furia" activable (gasta un uso, resistencias a contundente/perforante/cortante, daño de Furia sumado a ataques de FUE, se apaga con armadura pesada / incapacitado, y con Furia Persistente solo con inconsciente), CA de Defensa sin armadura (10 + DES + CON, con escudo), velocidad +10 de Movimiento rápido (no con armadura pesada), maestría con armas (selector en creación y panel de equipo, nº por la columna `Weapon Mastery`), huecos de dote en 4/8/12/16/19, y CD de salvación de cualquier rasgo que escriba "DC 8 plus your X modifier and Proficiency Bonus" (`writtenDc` en `feature-stats.ts`).

El hueco estructural más grande: **no existe ningún selector de elecciones dentro de rasgos de clase/subclase** (`traitChoice`/`traitPicks` solo se aplican a rasgos de especie; ver "Patrones comunes").

## Clase base

| Elemento (nivel · rasgo) | Qué ofrece | Estado | Qué falta exactamente | Archivos |
| --- | --- | --- | --- | --- |
| 1 · Rage | Contador `Rages` con recarga corta (+1) y larga (todas); estado activable que gasta un uso; resistencias B/P/S; daño de Furia en ataques de FUE; se acaba con armadura pesada/incapacitado; fila de conjuros atenuada mientras furia; aviso de duración 10 min | ✅ | Nada obligatorio. (Ventaja en pruebas/salvaciones de FUE: texto; "sin concentración" solo atenúa los conjuros, no avisa de la concentración activa) | `core/rules/active-states.ts`, `core/rules/engine.ts` (~L526), `core/rules/attacks.ts` L253, `core/play/active-play.ts`, `core/play/rest-rules.ts` L23, `features/states/active-states-bar.ts` |
| 1 · Unarmored Defense | CA 10 + DES + CON sin armadura, con escudo (volcado: CA 14 con DES 14/CON 14) | ✅ | — | `core/rules/engine.ts` L344-362 |
| 1 · Weapon Mastery | 2 tipos de arma (hasta 4 según tabla), selector y aviso si faltan; propiedad de maestría solo de las elegidas | ✅ | El cambio tras descanso largo es manual (volver a editar el selector) | `core/creation/creation-rules.ts` L687, `features/characters/equipment-panel.ts` L141, `core/rules/engine.ts` L1250, `core/rules/attacks.ts` L171 |
| 2 · Danger Sense | Aparece como recordatorio de ventaja ("You have Advantage on...") | — texto basta | — | `core/combat/combat-actions.ts` `advantagesOf` |
| 2 · Reckless Attack | Texto | — texto basta | No hay interruptor "ataque temerario" (Frenzy y Reckless Abandon lo suponen) | — |
| 3 · Barbarian Subclass | Selector de subclase (12 opciones) y aviso `noSubclass` | ✅ | — | `core/creation/creation-rules.ts`, `features/level-up/` |
| 3 · Primal Knowledge | Solo texto | ❌ | Falta elegir **una habilidad más** de la lista de bárbaro (Atletismo, Intimidación, Naturaleza, Percepción, Supervivencia, Trato con animales): `skillCount` solo cuenta `choose: 2`; el subir de nivel 3 no ofrece selector (`levelGains` no tiene "habilidad extra"; `multiclass.ts` sí tiene `gains.skill` pero solo para multiclase). Además la opción de usar FUE en esas pruebas con Furia es texto (aceptable) | `core/creation/creation-rules.ts` L496-510, `core/creation/level-up.ts`, `core/rules/multiclass.ts` L55 |
| 4/8/12/16 · Ability Score Improvement | Hueco de dote por nivel | ✅ | — | `core/creation/creation-rules.ts` L46-66 |
| 5 · Extra Attack | Texto (no hay nº de ataques) | — texto basta | — | — |
| 5 · Fast Movement | +10 pies sin armadura pesada (volcado: 40) | ✅ | — | `core/rules/engine.ts` L365 |
| 7 · Feral Instinct | Recordatorio de ventaja en iniciativa | — texto basta | La iniciativa calculada no marca la ventaja | — |
| 7 · Instinctive Pounce | Texto | — texto basta | — | — |
| 9 · Brutal Strike | Nota "+1d10" al golpear (sube a 2d10 en 17 con Improved Brutal Strike) | ✅ | Los efectos (Forceful/Hamstring) se eligen en mesa | `core/rules/feature-stats.ts` L155-162 |
| 11 · Relentless Rage | Dato "PG = 2 × nivel" mientras Furia | ⚠️ | No hay contador de la CD creciente (10, 15, 20...) ni su reinicio en descanso corto/largo; el volcado no muestra contador | `core/rules/feature-stats.ts` L82, L201-207 |
| 13 · Improved Brutal Strike | Efectos Staggering/Sundering (texto) | ✅ | — | `core/rules/feature-stats.ts` |
| 15 · Persistent Rage | Contador 1 uso/descanso largo; Furia de 10 min; se apaga solo si inconsciente o armadura pesada | ⚠️ | Gastar el contador **no devuelve** los usos de Furia (se tiene que subir a mano el contador `Rages`) | `core/play/play-state.ts`, `core/rules/active-states.ts` L117-125 |
| 17 · Improved Brutal Strike (2d10) | Nota sube a 2d10 y 2 efectos | ✅ | — | `core/rules/feature-stats.ts` L161 |
| 18 · Indomitable Might | Solo texto | ❌ | Pruebas/salvaciones de FUE con mínimo = puntuación de FUE (modificador de la prueba de FUE y salvación FUE; debería ser un aviso/mínimo en la fila de FUE) | `core/rules/engine.ts` |
| 19 · Epic Boon | Hueco de dote "epic-boon" (tope de característica 30) | ✅ | — | `core/creation/creation-rules.ts` L65, `core/rules/engine.ts` L233-247 |
| 20 · Primal Champion | Solo texto | ❌ | FUE y CON +4 (máximo 25) **no se aplican**: no hay lógica; el volcado a nivel 20 sigue con CON +2 y PG 185 (con CON 18 serían +1 más/nivel retroactivo). Debe sumar a `abilities`, tope 25, y a PG/CA/ataques | `core/rules/engine.ts` L229-248 (cálculo de características) |

## Subclases

### Path of the Berserker (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Frenzy | Nota "Nd6" (N = daño de Furia) mientras Furia activa | ✅ | — | `feature-stats.ts` L164-170 |
| 6 · Mindless Rage | Texto | — texto basta | No hay campo de inmunidad a condiciones en la ficha (se ve solo en el rasgo) | — |
| 10 · Retaliation | Texto (reacción) | — texto basta | — | — |
| 14 · Intimidating Presence | Contador 1/largo, CD (8+FUE+PB) calculada | ⚠️ | "Gastar un uso de Furia para recuperarlo" no está automatizado | `core/play/play-state.ts`, `feature-stats.ts` `writtenDc` |

### Path of the Wild Heart (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Animal Speaker | Texto | ❌ | Conjuros Beast Sense y Speak with Animals como **ritual** (WIS) no se conceden (`grantedSpells` vacío): el lector de conjuros no entiende "can cast X but only as a Ritual" | `core/rules/feat-effects.ts` |
| 3 · Rage of the Wilds | Texto, sin selector | ❌ | Falta elegir Oso/Águila/Lobo en cada Furia y aplicar Oso (resistencia a todo salvo fuerza/necrótico/psíquico/radiante) mientras Furia; no hay selector de clase/subclase en el estado de Furia | `core/play/active-play.ts`, `core/rules/active-states.ts`, `core/rules/engine.ts` |
| 6 · Aspect of the Wilds | Lector de velocidades | ❌ | **Error**: el volcado muestra a la vez Trepar 40 + Nadar 40 + Visión en la oscuridad 60 (Búho+Pantera+Salmón sumados). Es una elección única, cambiable en descanso largo: falta selector (`restPicks`) | `core/rules/trait-effects.ts` L225-235, `core/play/rest-choices.ts`, `core/rules/engine.ts` L1036 |
| 10 · Nature Speaker | Texto | ❌ | Commune with Nature como ritual no concedido (igual que Animal Speaker) | `core/rules/feat-effects.ts` |
| 14 · Power of the Wilds | Texto | ⚠️ | Elección por Furia (Halcón/León/Carnero): al ser por activación puede quedar como texto, pero Fly = Speed del Halcón (sin armadura) no se aplica | `core/rules/trait-effects.ts` |

### Path of the World Tree (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Vitality of the Tree | Al activar Furia, PG temporales = nivel (automático); dato "Nd6 PGT" no | ⚠️ | Life-Giving Force: PGT = d6 × daño de Furia, sin dato calculado | `core/play/active-play.ts` L45-75, `feature-stats.ts` L192-198 |
| 6 · Branches of the Tree | CD 8+FUE+PB calculada | ✅ | — | `feature-stats.ts` |
| 10 · Battering Roots | Texto | — texto basta | — | — |
| 14 · Travel along the Tree | Texto ("una vez por Furia") | — texto basta | — | — |

### Path of the Zealot (2024, PHB)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Divine Fury | Nota "1d6 + mitad del nivel" mientras Furia | ✅ | — | `feature-stats.ts` L172-179 |
| 3 · Warrior of the Gods | Reserva de d12 (4→7 según nivel), recarga larga | ✅ | — | `core/rules/pools.ts` L71, `play-state.ts` L270 |
| 6 · Fanatical Focus | Dato "+daño de Furia" a la repetición de salvación | ✅ | "Una vez por Furia" sin contador (texto) | `feature-stats.ts` L181-189 |
| 10 · Zealous Presence | Contador 1/largo | ⚠️ | Restauración gastando un uso de Furia no automática | `play-state.ts` |
| 14 · Rage of the Gods | Contador 1/largo | ⚠️ | La forma (1 min) no es un estado: no se aplican Vuelo = Velocidad ni resistencias necrótico/psíquico/radiante; Revivification gasta Furia a mano | `core/rules/active-states.ts`, `engine.ts` |

### Path of the Ancestral Guardian (UA10, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Spiritual Protectors | Texto | — texto basta | Efecto por golpe (Distract/Protect/Strike 1d6) se elige en mesa | — |
| 6 · Spirit Shield | Texto | ⚠️ | No se calcula la reducción (d6 × daño de Furia) | `feature-stats.ts` |
| 10 · Consult the Spirits | Contador 1/descanso corto o largo (`short="all"`) | ⚠️ | Augury / Clairvoyance no se conceden (ni elección entre ambos); WIS como característica | `core/rules/feat-effects.ts` |
| 14 · Vengeful Spirits | Texto | — texto basta | — | — |

### Path of the Storm Herald (UA10, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Storm Aura | CD 8+PB+CON calculada | ⚠️ | Falta elegir Desierto/Mar/Tundra en cada Furia y dado (d4/d6 × daño de Furia) | `feature-stats.ts` |
| 6 · Storm Soul | Texto | ❌ | Resistencia (fuego/rayo/frío), respirar bajo el agua y Nadar = Velocidad (Mar) según el entorno de la última Furia: no se aplican (el rasgo menciona Rage y se trata como situacional) | `engine.ts` L963 `SITUATIONAL`, `trait-effects.ts` |
| 10 · Shielding Storm | Texto | — texto basta | — | — |
| 14 · Raging Storm | Texto | — texto basta | — | — |

### Path of Lament (UA13, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Banshee's Wail | Contador = mod. CON (mín 1, vol.: 2), 1/largo; CD 8+CON+PB | ⚠️ | Daño d12 × daño de Furia no calculado; recuperar usos gastando una Furia no automático | `play-state.ts`, `feature-stats.ts` |
| 6 · Commune With The Dead | Texto | ❌ | Speak with Dead como ritual (WIS) no concedido | `feat-effects.ts` |
| 6 · Horrifying Strike | CD 8+CON+PB | ✅ | (una vez por turno: texto) | `feature-stats.ts` |
| 10 · Otherworldly Anguish | Texto | ❌ | Resistencia a frío y necrótico **mientras Furia** no se aplica (solo B/P/S); el volcado a nivel 10 no lista resistencias | `engine.ts` L526, `active-states.ts` L166 |
| 14 · Sorrow Form | Contador 1/largo | ⚠️ | Inmunidad a Hechizado/Asustado y tipo Muerto viviente: texto; sin estado propio | `active-states.ts` |

### Path of Unlight (UA15, 2024)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Radiant Rage | Texto | — texto basta | Daño radiante = daño de Furia a los atacantes cuerpo a cuerpo: texto | — |
| 6 · Unlight Revelation | Competencia en Percepción (lector de "proficiency in the X skill") | ⚠️ | Pericia (Expertise) en Percepción no se aplica (verificado solo por lectura de `trait-effects.ts`, que no tiene lector de Expertise); Blindsight = radio de luz: texto | `core/rules/trait-effects.ts` L238-250 |
| 10 · Infectious Unlight | Texto, CD 8+FUE+PB | — texto basta | — | — |
| 10 · Harbinger of Unlight | Resistencia a Radiante (permanente) en la ficha | ✅ | — | volcado nivel 10 |
| 14 · Brilliant Rage | Contador 1/largo, CD | ⚠️ | Restauración gastando Furia no automática | `play-state.ts` |

### Path of the Beast (2014, Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Form of the Beast | Texto | ❌ | Elegir Mordisco / Garras / Cola en cada Furia y fila de ataque (1d8 perf., 1d6 cort. con ataque extra, 1d8 perf. alcance) con FUE; curación PB del mordisco; bonif. de CA de la cola. `natural-weapons.ts` solo lee armas naturales de **especie** | `core/rules/natural-weapons.ts`, `core/rules/attacks.ts`, `engine.ts` L1366 |
| 6 · Bestial Soul | Lector de velocidades | ❌ | **Error**: el volcado da Nadar 40 y Trepar 40 a la vez; es una sola opción por descanso (nadar / trepar / salto): falta `restPick`. Armas naturales mágicas: depende de Form of the Beast | `trait-effects.ts`, `core/play/rest-choices.ts` |
| 10 · Infectious Fury | Contador PB/largo (volcado 4→6), CD 8+CON+PB | ✅ | — | `play-state.ts` |
| 14 · Call the Hunt | Contador PB/largo | ✅ | PGT 5/criatura × mod. CON: texto | `play-state.ts` |

### Path of the Giant (2014, Glory of the Giants)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Giant's Power | Texto | ❌ | Truco a elegir (Druidcraft o Thaumaturgy, WIS) no se concede ni se ofrece; idioma gigante/otro: sin selector. `grantedSpells`/`missing` vacíos | `feat-effects.ts` (`FEAT_PICKS`) |
| 3 · Giant's Havoc | Daño de Furia en ataques de FUE (incluye lanzados) | ✅ | Alcance +5 ft y tamaño Grande: texto | `attacks.ts` L253 |
| 6 · Elemental Cleaver | Texto | ⚠️ | Falta dato "+1d6 (2d6 en 14) del tipo elegido"; tipo por Furia: texto | `feature-stats.ts` |
| 10 · Mighty Impel | CD 8+PB+FUE calculada | ✅ | — | `feature-stats.ts` |
| 14 · Demiurgic Colossus | Texto | — texto basta | — | — |

### Path of Wild Magic (2014, Tasha)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Magic Awareness | Contador PB/largo | ✅ | — | `play-state.ts` |
| 3 · Wild Surge | Tabla d8 en el texto; CD 8+PB+CON | — texto basta | No hay tirada de tabla (aleatoria, se resuelve en mesa) | — |
| 6 · Bolstering Magic | Contador PB/largo | ✅ | — | `play-state.ts` |
| 10 · Unstable Backlash | Texto | — texto basta | — | — |
| 14 · Controlled Surge | Texto | — texto basta | — | — |

### Path of the Battlerager (2014, SCAG)

| Elemento | Qué ofrece | Estado | Qué falta | Archivos |
| --- | --- | --- | --- | --- |
| 3 · Restriction: Dwarves Only | Texto | — texto basta | No se exige ser enano (el DM puede levantarlo) | — |
| 3 · Battlerager Armor | Texto | ❌ | Ataque de acción adicional con púas (1d4 perforante, FUE, solo con armadura de púas y furia) y 3 de daño al agarrar: sin fila de ataque (el objeto `spiked-armor` existe en `data/items.json`, no hay lógica) | `core/rules/attacks.ts`, `data/items.json` |
| 6 · Reckless Abandon | Texto | ❌ | PGT = mod. CON (mín 1) al usar Reckless Attack con furia: sin dato calculado ni interruptor de Reckless Attack | `feature-stats.ts` |
| 10 · Battlerager Charge | Texto | — texto basta | — | — |
| 14 · Spiked Retribution | Texto | — texto basta | — | — |

## Patrones comunes

1. **Sin elecciones dentro de rasgos de clase/subclase.** `traitChoice`, `traitPicks` y `resolveTraitChoice` solo se usan en rasgos de especie (`species-picks.ts`). Afecta: Aspect of the Wilds, Bestial Soul (elección en descanso, con `restPicks`), Rage of the Wilds/Power of the Wilds/Storm Aura/Form of the Beast/Elemental Cleaver (elección en cada Furia), Giant's Power (truco/idioma), Consult the Spirits (conjuro).
2. **Efectos "mientras Furia" de subclase no se aplican.** `SITUATIONAL` (`engine.ts` L963) descarta cualquier rasgo que mencione `Rage`; el único efecto aplicado con Furia es la resistencia genérica B/P/S. Quedan fuera: resistencias de Lament (frío/necrótico), Storm Soul, Oso (Wild Heart), Rage of the Gods; Vuelo (Halcón, Rage of the Gods). Falta un mecanismo "efecto de subclase activo mientras Furia".
3. **Conjuros "solo como ritual"/fijos sin lector.** Animal Speaker, Nature Speaker, Commune With The Dead, Consult the Spirits y Giant's Power no producen `grantedSpells`.
4. **Recuperar un rasgo gastando una Furia** ("sin acción") no está automatizado (Banshee's Wail, Intimidating Presence, Zealous Presence, Brilliant Rage, Persistent Rage).
5. **Daño "d× por daño de Furia"** solo está calculado para Frenzy, Divine Fury y Fanatical Focus; faltan Banshee's Wail, Spirit Shield, Life-Giving Force, Storm Aura, Elemental Cleaver.
6. **Aumentos de característica de capstone** (Primal Champion) y **mínimos de característica** (Indomitable Might) no tienen lector.
7. **Inmunidades a condiciones** (Mindless Rage, Sorrow Form) no tienen campo en la ficha: solo texto.

## Dudas

- **Path of Unlight, Unlight Revelation** (`data/subclasses.json`): "Blindsight con alcance igual al de la Luz brillante de Radiant Rage" (20 pies) — a nivel 14 Brilliant Rage amplía la luz a 30 pies: ¿el Blindsight sube también a 30? Ambiguo.
- **Path of the Storm Herald, Storm Soul**: depende del entorno elegido "la última vez que entraste en Furia": habría que guardar esa elección entre Furias y descansos (¿persiste tras descanso largo?). El texto no lo aclara.
- **Path of Lament, Banshee's Wail**: "o como Acción adicional mientras la Furia está activa" más "recuperar todos los usos gastando una Furia": no queda claro si se puede hacer repetidamente.
- **Path of the Battlerager**: la restricción "solo enanos" (el DM puede levantarla) — ¿debe la app bloquearlo o solo avisar?
- **Primal Knowledge**: el texto dice "otra habilidad de la lista disponible para bárbaros en nivel 1"; no aclara si debe ser una que aún no se tenga (se asume que sí).

## Observaciones (errores del volcado y otras notas)

- Aspect of the Wilds (Wild Heart ≥6) muestra Trepar 40 + Nadar 40 + Visión en la oscuridad 60 a la vez, y Bestial Soul (Beast ≥6) muestra Nadar 40 + Trepar 40: son opciones mutuamente excluyentes, el motor las suma todas (error real, no solo faltante).
- El volcado solo incluye el nombre de las filas de `attacks` (cadena truncada), así que no permite ver las notas de Brutal Strike/Frenzy; se verificaron en `feature-stats.ts`.
- Los avisos `traitPickMissing: Skillful` y `Savage Attacker` / `Resourceful`/`Versatile` salen del personaje de prueba (humano/soldado), no del Bárbaro.
- A nivel 20 base: PG 185 y CON +2 (sin Primal Champion), CA 14 (sin armadura): coherente con lo implementado, pero incorrecto respecto a las reglas por falta de Primal Champion.
- Relentless Rage no aparece en `counters` ni `featUses` del volcado (nivel 11+) porque no es un contador de usos, sino una CD creciente.
- Lament nivel 10: el volcado no muestra resistencias (frío/necrótico) porque el texto se trata como situacional ("while your Rage is active") y no se aplica ni con la Furia encendida.
- Barbarian Subclass (nivel 3) en el volcado de la clase base sigue marcando `noSubclass` en todos los niveles 3-20 (esperado: la base se evalúa sin subclase).
