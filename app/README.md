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

Abre <http://localhost:4200>. `npm start` copia antes `../data` y `../characters` a `.dev-data/` para
poder usar el origen de datos **«Ficheros locales»** sin conexión a GitHub.

```bash
npm test         # tests unitarios (Vitest)
npm run build    # compilación de producción en dist/ (no incluye los datos de D&D)
```

## Origen de los datos (Ajustes)

- **Repositorio de GitHub** (por defecto): lee `data/*.json` y `characters/*.json` del repo con la API de
  GitHub, y cada guardado de un personaje será un commit. Necesita un *fine-grained personal access token*
  con acceso solo a este repositorio y el permiso **Contents: read and write**. El token solo se guarda en
  el navegador de cada dispositivo.
- **Ficheros locales**: los que sirve `npm start`. Solo lectura y sin personajes; útil para desarrollar.

El compendio se guarda en el dispositivo (IndexedDB) y solo se vuelve a descargar cuando cambia
`data/meta.json`, así que también funciona sin conexión.

## Estructura

```
src/app/
  core/
    models/        tipos de data/*.json y del fichero de personaje
    data/          DataSource: GitHub (API, commits) y local
    compendium/    carga y caché del compendio
    characters/    personajes guardados en el dispositivo
    storage/       IndexedDB
    settings/      ajustes (localStorage)
    i18n/          textos de la interfaz (es.ts, en.ts)
  features/
    compendium/    consulta: secciones, listas con buscador, fichas
    characters/    lista de personajes con su estado en la nube
    creation/      asistente de creación (pendiente)
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

El modelo de datos y la escritura con detección de conflictos ya están; el motor de sincronización
y la pantalla de conflictos llegan con la fase de gestión de personajes.

## Pendiente

1. Compendio completo (fichas específicas de cada tipo, buscador global).
2. Ficha de personaje calculada (motor de reglas) y sincronización con el repo.
3. Asistente de creación.
4. Estado de partida, subir de nivel, multiclase.
5. Despliegue: GitHub Pages (PWA) y APK Android con Capacitor y actualización automática.
6. Diseño visual.
