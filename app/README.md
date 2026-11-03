# D&D Helper — app

Aplicación web (Angular 21) para consultar el compendio de `data/` y crear y gestionar personajes.
Interfaz en español e inglés; el contenido de juego está en inglés, tal como sale de las wikis (y los
monstruos, del SRD 5.2), con su traducción al español.

## Arrancarla en el PC

Requiere Node.js 22.12 o superior (recomendado 24) y npm 11.

```bash
cd app
npm install
npm start
```

Abre <http://localhost:4200>. `npm start` copia antes `../data` y `../characters` a `.dev-data/`, que la
app lee mientras no haya un token de GitHub configurado (solo en desarrollo).

Con `npm start`, el botón **Actualizar** de la barra superior trae los commits nuevos (`git pull --ff-only`)
y recarga la app. Si cambian las dependencias o los datos, además ejecuta `npm ci` o vuelve a copiar
`.dev-data/` y reinicia el servidor. Lo hace `scripts/dev.mjs`, un pequeño ayudante que solo escucha en este
PC (puerto 4201) y solo atiende a la propia app. Nunca pisa cambios sin guardar: si el pull choca con ellos,
falla y la app muestra el motivo. El botón no aparece en la app publicada.

```bash
npm test         # tests unitarios (Vitest)
npm run build    # compilación de producción en dist/ (no incluye los datos de D&D)
```

## Origen de los datos

No se elige: la app lee `data/*.json` y `characters/*.json` del repo con la API de GitHub, y cada guardado
de un personaje es un commit. Sin conexión usa lo que ya está guardado en el dispositivo: el compendio
(IndexedDB, que solo se vuelve a descargar cuando cambia `data/meta.json`) y los personajes. En desarrollo,
sin token, lee los ficheros locales de `npm start` (solo lectura).

## Token de GitHub

Necesita un *fine-grained personal access token* con acceso solo a este repositorio y el permiso
**Contents: read and write**. Se guarda en el navegador de cada dispositivo.

Para no tener que pegarlo en cada dispositivo, en Ajustes → **Token en otros dispositivos** se guarda cifrado
con una contraseña (mínimo 12 caracteres) en `app/public/token.enc.json`, con un commit. Ese fichero se
publica con la app; en un dispositivo nuevo basta con escribir la contraseña. El cifrado es AES-GCM con una
clave sacada de la contraseña con PBKDF2-SHA256 (600 000 iteraciones): sin la contraseña no sirve de nada,
pero conviene que sea larga porque quien tenga la app tiene el fichero. Si olvidas la contraseña o el token
caduca, vuelve a guardarlo.

## Estructura

```
src/app/
  core/
    models/        tipos de data/*.json y del fichero de personaje
    data/          DataSource: GitHub (API, commits) y local
    compendium/    carga y caché del compendio
    characters/    personajes guardados en el dispositivo y descarga desde el repo
    rules/         motor de reglas: calcula la ficha a partir de las decisiones del personaje
    storage/       IndexedDB
    settings/      ajustes (localStorage)
    i18n/          textos de la interfaz (es.ts, en.ts) y glosario de términos de juego
  features/
    compendium/    consulta: secciones, listas con buscador, fichas
    characters/    lista de personajes con su estado en la nube y ficha calculada
    creation/      asistente de creación y edición
    settings/      ajustes
  shared/          pipe de Markdown
```

## Monstruos

El compendio tiene una sección **Monstruos** con las 331 criaturas del SRD 5.2 (la parte gratuita
del Manual de Monstruos de 2024; ver `tools/scraper/README.md`). Pensada para que el DM prepare
encuentros:

- **Orden:** por valor de desafío (VD) de menor a mayor y, dentro de cada VD, por nombre. El
  selector «Ordenar» también deja ver primero los más difíciles o por nombre.
- **Filtros** (con O/Y y exclusión, como el resto): valor de desafío por tramos (0–1/4, 1/2–1, 2–4,
  5–10, 11–16, 17+: los de cada nivel de juego), tipo de criatura, tamaño, movimiento (volando,
  flotando, nadando, trepando, excavando o solo a pie) y, en «Más filtros», legendario, lanza
  conjuros, categoría (monstruo o animal), inmunidad y resistencia al daño, inmunidad a estados,
  sentidos, alineamiento y VD exacto. Pinchar el VD en una ficha lista los monstruos de ese VD.
- **Ficha:** bloque de estadísticas como el del manual de 2024 (`features/compendium/monster-stat-block.ts`):
  tipo, CA, iniciativa, PG, velocidad, las seis características con modificador y salvación (en
  color la que tiene competencia), habilidades, defensas, sentidos, idiomas, VD con PX y bonificador,
  y rasgos, acciones, acciones adicionales, reacciones y acciones legendarias.
- Tamaños, tipos, alineamientos, daños y estados pasan por el glosario (`glossary.es.json`).

**Créditos:** contiene material del System Reference Document 5.2 de Wizards of the Coast LLC,
disponible bajo licencia [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode). La app
lo indica en el pie de la portada del compendio y en cada ficha de monstruo.

## Personajes y sincronización

Cada personaje se guarda primero en el dispositivo y luego se sube al repo con un commit. Su estado:

| Estado | Significado |
|---|---|
| No guardado en la nube | Solo está en el dispositivo, o ha cambiado desde la última subida |
| Enviado, sin confirmar | El commit se envió; falta comprobar que el repo tiene esa versión |
| Guardado en la nube | El fichero del repo es idéntico al del dispositivo (mismo *sha* de git) |
| Dos versiones distintas | El repo tiene otra versión: la app enseña las dos y eliges cuál conservar (o ambas) |
| Pendiente de borrar | Se borrará del repo en la próxima sincronización |

La sincronización (`core/characters/`) se lanza sola al abrir la app, al recuperar la conexión,
cada 5 minutos y justo después de guardar; también hay un botón «Sincronizar ahora» en la barra
superior, que muestra el estado («Todo guardado en la nube», «N sin guardar en la nube», «Sin conexión»…).

- **Bajada:** trae del repo los personajes nuevos o cambiados; nunca pisa cambios hechos en el dispositivo.
- **Subida:** un commit por personaje cambiado (`Personaje: guardar "Nombre" desde Dispositivo`). Después
  relee el repo y solo lo da por **guardado en la nube** si el fichero tiene exactamente lo enviado.
  Si un envío se quedó sin confirmar (se cerró la app), en la siguiente sincronización se confirma o se reenvía.
- **Conflictos:** si el repo cambió mientras tanto, GitHub rechaza el commit y el personaje queda con
  **dos versiones distintas**. La pantalla de conflicto enseña las dos lado a lado, solo con lo que cambia
  (nivel, puntos de golpe, dotes, notas…), con la fecha y el dispositivo de cada una, y tres botones:
  quedarme con esta, quedarme con la otra, o conservar las dos (la de este dispositivo pasa a ser «(copia)»).
  La versión descartada sigue en el historial de git.
- **Borrar:** se borra del repo con un commit; si mientras tanto se cambió en otro dispositivo, no se borra
  y se conserva esa versión.
- Con «Ficheros locales» no se sube nada (solo lectura).

## Ficha de personaje

El fichero del personaje solo guarda decisiones; `core/rules/engine.ts` calcula el resto: puntuaciones
finales, bonificador de competencia, salvaciones, habilidades (con pericia y *Jack of All Trades*),
puntos de golpe, CA (armadura equipada, escudo, *Unarmored Defense*), velocidad, visión en la oscuridad,
lanzamiento de conjuros (CD, ataque, espacios, multiclase y Magia de pacto; también las subclases que
lanzan conjuros: Eldritch Knight, Arcane Trickster, Warrior of the Mystic Arts y Order of the Profane
Soul), la tabla de la clase y los rasgos que tiene por nivel. Lo que no encuentra en el compendio aparece como aviso en la ficha.

`characters/ejemplo-thorin.json` es un personaje de ejemplo para probarla; se puede borrar.

## Asistente de creación

«Nuevo personaje» (y «Editar» en la ficha) recorre los pasos en el orden de 2024: clase (nivel, subclase,
PG por nivel), trasfondo (+2/+1 o +1/+1/+1 a sus tres características; su dote de origen y habilidades
vienen solas), especie y linaje, características (array estándar, compra de 27 puntos o a mano), elecciones
de clase (habilidades, pericia, una dote o Mejora de característica en cada nivel que la da, estilo de
combate, opciones como invocaciones o maldiciones de sangre, trucos y conjuros), equipo y armadura puesta,
y nombre. Cada paso enseña lo que falta y una vista previa calculada por el motor de reglas; se puede
guardar incompleto. El borrador de un personaje nuevo se queda en el navegador hasta que se guarda.
Las reglas del asistente están en `core/creation/creation-rules.ts`.

- **Multiclase:** en el paso de clase se añaden más clases, cada una con su nivel, subclase y PG; la
  primera es la clase inicial (sus salvaciones, el máximo del dado a nivel 1). Las demás añaden lo que da
  multiclasear (armaduras, armas, herramientas, una habilidad, un instrumento), que el extractor saca del
  texto de 2024 de cada clase, de una tabla escrita a mano (`tools/scraper/multiclass.yaml`, p. ej.
  Blood Hunter) o, si no hay ninguna, de una estimación que avisa en «Por revisar». Los espacios de
  conjuro se combinan con la tabla de multiclase.
- **Idiomas:** Común + 2 (tabla estándar; las lenguas raras avisan). Los que da un rasgo (Druidic,
  Thieves' Cant) se añaden solos.
- **Tamaño** cuando la especie deja elegir, y **herramientas** cuando el trasfondo o la clase dicen
  «elige un tipo de…» (juegos, instrumentos, herramientas de artesano).
- **Requisitos:** dotes (nivel, características, especie, lanzamiento de conjuros, competencias),
  multiclase (13 en la característica principal de cada clase), y número de trucos, conjuros, opciones,
  idiomas o herramientas. Lo que no se cumple **se puede elegir igualmente** (por si tu DM lo permite),
  pero se marca en rojo con el motivo y aparece en «Por revisar».

## Idiomas

Al cambiar el idioma en Ajustes cambia todo. La interfaz está en `core/i18n/es.ts` y `en.ts`; los
términos de juego (escuelas, rarezas, herramientas, idiomas, tamaños, columnas…) en
`core/i18n/glossary.es.json`, y `npm run check-glossary` (en la integración continua) falla si aparece uno
nuevo sin traducir.

El contenido de las wikis en español viene de `data/es/*.json`, que el extractor genera al traducir.
Las reglas siempre calculan con los datos en inglés; `core/i18n/data-text.service.ts` empareja cada texto
inglés con su traducción para mostrarlo. Los nombres salen como «Bola de fuego (Fireball)», el buscador
encuentra por cualquiera de los dos y lo que todavía no esté traducido sale en inglés.

## Web y Android

La web y la APK llevan dentro los datos (`data/`, copiados con `scripts/bundle-data.mjs`; la
build `-c production,bundled` los usa). Sin token de GitHub enseñan el compendio y guardan los
personajes solo en el dispositivo; con el token (Ajustes) sincronizan con el repo.

- **GitHub Pages** (`.github/workflows/pages.yml`): se publica en cada push a `app/` o `data/`.
  Hay que activarlo una vez en Settings → Pages → Source: *GitHub Actions* (en un repo privado
  Pages pide GitHub Pro; la web publicada es pública, pero no lleva personajes ni tokens).
- **Instalar la web en el móvil**: ábrela en Chrome (Android) o Safari (iPhone) y usa *Añadir a
  pantalla de inicio* (en Chrome puede salir como *Instalar aplicación*). Se abre a pantalla
  completa con su icono (`public/icons/`, dibujados en `icon.svg`; `icon-512.png` sirve también
  para la APK) y `public/manifest.webmanifest`.
- **Sin conexión**: el service worker de Angular (`ngsw-config.json`, solo en la web publicada:
  ni en desarrollo ni en la APK) guarda la aplicación; el compendio queda en IndexedDB al
  consultarlo. Tras la primera visita con conexión, la web abre y enseña el compendio sin red
  (lo que no se haya abierto aún no está). Los datos (`data/`) y la API de GitHub no pasan por su
  caché. Cuando se publica una versión nueva, se descarga en segundo plano y la barra superior
  ofrece *Recargar*.
- **APK** (`.github/workflows/apk.yml`): Capacitor genera el proyecto Android en cada ejecución
  (la carpeta `android/` no se guarda). La APK queda como artefacto y en la release
  `android-latest`. Para poder instalar cada versión encima de la anterior, crea una clave una
  vez y guárdala en los secretos del repo:

  ```bash
  keytool -genkeypair -keystore dnd-helper.keystore -alias dndhelper -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 dnd-helper.keystore   # → secreto ANDROID_KEYSTORE_BASE64
  ```

  más `ANDROID_KEYSTORE_PASSWORD` (la contraseña) y `ANDROID_KEY_ALIAS` (`dndhelper`). Sin ellos
  la APK se firma con una clave nueva cada vez y hay que desinstalar la anterior para instalarla.

  - **Icono y pantalla de carga**: `npx @capacitor/assets generate --android` los crea en cada
    ejecución a partir de `android-assets/` (PNG sacados de `public/icons/icon-maskable.svg` e
    `icon.svg`: `icon-only.png` para los iconos antiguos, `icon-background.png` (el cuero) e
    `icon-foreground.png` (el sello, transparente) para el icono adaptativo, y `splash.png` /
    `splash-dark.png`, el icono sobre cuero `#3b2416`). Si cambia el icono, hay que volver a
    exportarlos con los mismos tamaños (1024 px los iconos, 2732 px la pantalla de carga).
  - **Aviso de versión nueva**: la APK se compila con `--define APP_BUILD=<nº de ejecución>`
    (es también su `versionName` 1.0.N) y la release lleva en sus notas una línea `build: N`.
    Dentro de la app Android, al abrirla y como mucho una vez al día, se pregunta a la API
    pública de GitHub por esa release (`core/app-update/`); si tiene un número mayor, arriba de la
    página sale «Hay una versión nueva de la app — Descargar», que abre la descarga de
    `dnd-helper.apk` en el navegador. «Ahora no» lo oculta hasta que salga otra. Sin conexión o si
    GitHub falla no dice nada y lo vuelve a intentar la próxima vez. En la web no aparece; para
    probarlo con `npm start`, guarda en localStorage `dnd-helper.apkUpdate.fake` = `{"build": 1}`.

## Pendiente

1. Instalar la versión nueva desde la propia app: hoy el aviso abre la descarga en el navegador
   y Android pide confirmar la instalación de la APK.
