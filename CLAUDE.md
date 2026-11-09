# D&D Helper — guía para Claude

App personal de D&D 5e (2024, con contenido 2014 adaptado) para un usuario hispanohablante.
**Habla siempre en español con el usuario.** La UI es bilingüe es/en con estética de diario de
aventurero medieval. Offline-first: personajes en JSON (repo GitHub + IndexedDB).

## Estructura

| Ruta | Qué es |
| --- | --- |
| `app/` | Angular 21 (standalone, signals, Vitest). Web (GitHub Pages + PWA) y APK (Capacitor) |
| `app/src/app/core/rules/` | Motor de reglas: `engine.ts` (`computeSheet`), `attacks.ts`, `feat-effects.ts`, `trait-effects.ts`, `trait-choices.ts` |
| `app/src/app/core/i18n/` | `es.ts` / `en.ts` (claves UI) y glosario de términos de juego |
| `data/*.json`, `data/es/*.json` | Compendio extraído (inglés y español). **Generado por el scraper** |
| `tools/scraper/` | Extractor Python de dnd5e.wikidot.com / dnd2024.wikidot.com + traducción |
| `tools/portraits/` | Retratos con IA (Cloudflare Workers AI) — bloqueado hasta que existan los secretos |
| `characters/`, `encounters/`, `homebrew/`, `dm/` | Datos de usuario que la app escribe vía API de GitHub. **No tocar a mano** |
| `PENDIENTE.md` | Tareas que solo puede hacer el usuario (secretos, cuentas) |

Rama de producción = rama por defecto = `claude/practical-ride-qnr51a`. **No la renombres**: está
fijada en `.github/workflows/{pages,apk}.yml` y en `app/src/app/core/settings/settings.service.ts`
(y guardada en el localStorage de cada dispositivo del usuario).

## Reglas duras

- **Nunca** lances la extracción online completa del scraper. Solo `python3 -m dndscraper.validate`,
  `python3 -m dndscraper.translate --offline` y módulos offline (p. ej. `python3 -m dndscraper.plans`).
- **No edites `data/*.json` a mano sin la regla equivalente en el scraper** (`tools/scraper/`): la
  próxima extracción lo borraría. Ver skill `datos`.
- Toda mecánica nueva sale del **texto real** de `data/*.json`, con tests Vitest que usen datos reales.
  Nunca inventes reglas: si no está en los datos, dilo.
- Cada texto de UI nuevo va en `es.ts` **y** `en.ts`; términos de juego nuevos, en el glosario
  (`npm run check-glossary` lo exige).
- Nombres en español ya decididos por el usuario (no "corregir"): "Tiflin", "Caballero
  sobrenatural", "Cuchillo del alma".
- Antes de empujar: skill `verificar` (tests, prettier, glosario, build de producción).

## Skills del proyecto (`.claude/skills/`)

| Skill | Cuándo |
| --- | --- |
| `verificar` | Antes de cualquier commit/push |
| `fusionar-agente` | Al recibir el informe de un subagente en worktree |
| `desplegar` | Publicar, comprobar CI, APK, Pages, revertir |
| `datos` | Tocar el compendio, el scraper, traducciones o nombres |
| `reglas` | Añadir/arreglar mecánicas en la hoja (dotes, rasgos, elecciones, ataques) |
| `probar-ui` | Ver la app en Playwright (móvil/tablet/escritorio, modo oscuro, scroll) |
| `retratos` | Generar imágenes con IA cuando existan los secretos de Cloudflare |

## Forma de trabajar con el usuario

El usuario pide funciones y arreglos en lenguaje natural y suele querer que se deleguen a
subagentes ("pon un agente..."). Patrón: subagente en worktree (`isolation: "worktree"`, en segundo
plano, con `model` y `effort` elegidos según la tabla de abajo) con un encargo autocontenido → al
terminar, skill `fusionar-agente` → informe breve en
español (qué hace, qué no, qué falta) con capturas si hay UI.

## Subagentes: modelo y esfuerzo (instrucción permanente del usuario)

Al lanzar un subagente **elige siempre `model` y `effort` según la tarea**; no los dejes por
defecto. El usuario lo pidió expresamente, así que aquí sí se puede fijar `effort`.

| Tipo de tarea | `model` | `effort` |
| --- | --- | --- |
| Mecánica y acotada: textos es/en, renombrar, limpiar worktrees/ramas, retocar CSS, docs, borrar código muerto, una sola función con especificación exacta | `haiku` | `low` |
| Función o arreglo normal con especificación clara: un selector, un panel, una fila de ataque, un contador, un bug reproducible en un área | `sonnet` | `medium` |
| Trabajo que cruza varias zonas o exige criterio: auditoría de datos contra el motor (clases, subclases, especies, dotes), mecanismos generales (navegación, elecciones anidadas), fusiones con conflictos de lógica, bugs que ya fallaron un arreglo | `opus` | `high` |
| Diseño o depuración muy difíciles: arquitectura nueva con migración de datos, un fallo que sigue sin explicarse tras dos intentos, cambios de modelo de personaje | `opus` (o `fable` si es lo más difícil) | `xhigh` |

- `max` solo si el usuario lo pide. `fable` es lo más caro: no lo uses para trabajo rutinario.
- Si una tarea mezcla piezas de dificultad distinta, **pártela en varios agentes** (lo fácil en
  `sonnet`/`haiku`, lo difícil en `opus`) en vez de poner todo en el nivel más alto.
- Verificación y fusión (`fusionar-agente`) las hago yo en la sesión principal, no en un agente.
- Un agente que se quedó corto en un nivel se reanuda o se relanza **un nivel por encima**
  (indícalo en el informe al usuario).
- En el informe al usuario di qué modelo y esfuerzo usó cada agente y por qué, en una línea.

## Riesgos conocidos (revisar de vez en cuando)

1. **Presupuestos de build** (`app/angular.json`): bundle inicial ~574 kB (aviso 600 kB, error
   1 MB) y creciendo ~10 kB por función grande; `character-create.scss` (12,1 kB) y
   `character-sheet.scss` (12,4 kB) superan el aviso de 12 kB (error a 20 kB). Si crecen: carga
   diferida (como el PDF) o partir componentes, no subir límites a ciegas.
2. **Caché del cliente**: la PWA y la APK muestran versiones viejas hasta recargar/actualizar.
   Ante "sigue igual", comprueba primero que el usuario tiene la última versión.
3. **Token de GitHub del usuario**: caduca (PAT); la sincronización deja de funcionar. Síntoma:
   errores 401 al guardar personajes.
4. **APK sin clave de firma** (`PENDIENTE.md` §1): cada APK se firma distinto y hay que desinstalar
   la anterior (se pierden personajes no subidos).
5. **Wikis de origen**: si cambian su HTML, el scraper fallará en la próxima extracción manual;
   `validate` lo detecta. Los datos actuales siguen valiendo.
6. **Cuota de Cloudflare** (~170 imágenes/día): los 331 monstruos tardan 2 días; la ejecución
   diaria programada lo continúa sola.
7. **Elecciones dentro de rasgos sin resolver** (texto que pide elegir pero sin selector): Half-Elf
   Versatility, Kobold Legacy, Merfolk Creeds (sub-elecciones anidadas), Boon of Energy Resistance
   y Planar Wanderer (varias resistencias cambiables en descanso). Ver `trait-choices.ts`.
8. **Cambios de modelo de personaje**: `schemaVersion: 1`; todo campo nuevo debe ser opcional y
   normalizarse en `normalizeCharacter` (personajes viejos en GitHub y en dispositivos).
9. **Extracción completa del scraper**: si alguien lanza `scrape.yml`, regenera `data/`. Todo lo
   que solo esté en el JSON se perdería (ver skill `datos`); revisa el `git diff` del commit de la
   acción antes de dar nada por bueno.

## Desarrollos que el usuario ha pedido o quedaron a medias

- Retratos IA (bloqueado por los secretos de Cloudflare; skill `retratos`).
- Sub-elecciones anidadas en rasgos de especie (Half-Elf, Kobold, Merfolk) y resistencias
  múltiples cambiables (Boon of Energy Resistance, Planar Wanderer).
- Cañón sobrenatural y criaturas invocadas en el combate rastreado de la Mesa del DM (hoy solo
  viven en la hoja del personaje).
- Crafteo: lista de qué fabrica cada herramienta de artesano (no está en los datos del scraper).
- Carpetas sincronizadas entre dispositivos (hoy la lista de carpetas es local; la carpeta de cada
  personaje/encuentro sí se sincroniza).
- Dotes con recursos propios sin contador (Death Points, Psionic Energy Dice de dotes) y épicas
  que deberían pedir conjuro (Boon of Magic School Mastery, Boon of Siberys).
