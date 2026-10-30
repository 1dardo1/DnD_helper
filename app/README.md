# D&D Helper — app

Aplicación web (Angular 21) para consultar el compendio de `data/` y crear y gestionar personajes.
Interfaz en español e inglés; el contenido de juego está en inglés, tal como sale de las wikis.

## Arrancarla en el PC

Requiere Node.js 22.12 o superior (recomendado 24) y npm 11.

```bash
cd app
npm install
npm start
```

Abre <http://localhost:4200>. `npm start` copia antes `../data` y `../characters` a `.dev-data/`, que la
app lee mientras no haya un token de GitHub configurado (solo en desarrollo).

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

Toda la interfaz está en español e inglés (`core/i18n/es.ts`, `en.ts`). Los términos de juego que
vienen de los datos (escuelas, tipos de daño, rarezas, categorías, herramientas, idiomas, tamaños,
columnas de las tablas…) se traducen con `core/i18n/glossary.es.json`; los nombres propios (clases,
conjuros, dotes, objetos) y los textos largos se quedan como en las wikis.

`npm run check-glossary` compara el glosario con `data/` y falla si un término nuevo (por ejemplo, tras
volver a extraer) no tiene traducción; se ejecuta en la integración continua. Para arreglarlo basta con
añadir la línea que falta en `glossary.es.json`.

## Pendiente

1. Compendio completo (fichas específicas de cada tipo, buscador global).
2. Estado de partida (PG, espacios gastados, descansos) y subir de nivel guiado.
3. Despliegue: GitHub Pages (PWA) y APK Android con Capacitor y actualización automática.
4. Diseño visual.
