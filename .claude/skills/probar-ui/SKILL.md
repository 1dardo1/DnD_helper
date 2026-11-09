---
name: probar-ui
description: Levanta la app D&D Helper en local y la revisa con Playwright (móvil 390x844, tablet 820x1180, escritorio 1280x800, modo claro/oscuro, con scroll) para comprobar un cambio visual o reproducir un fallo que el usuario ve en su móvil. Úsala antes de afirmar que algo se ve bien o cuando el usuario mande una captura de un problema.
---

# Probar la interfaz

## Servidor de desarrollo (lo normal)

```bash
cd app
node scripts/sync-dev-data.mjs                      # copia data/ y characters/ a .dev-data/
nohup npx ng serve --port 4300 > /tmp/serve.log 2>&1 &
# espera a que /tmp/serve.log diga "Local: http://localhost:4300/" (Monitor o un bucle con until)
```

Rutas con hash: `http://localhost:4300/#/compendium`, `#/compendium/feat`,
`#/characters/<id>` (pestañas: `/resumen`, `/rasgos`, `/conjuros`, `/equipo`, `/invocaciones`,
`/notas`), `#/characters/new`, `#/dm`. Hay personajes reales en `characters/*.json` (el id es el
nombre del fichero sin `.json`): úsalos en vez de crear uno a mano.

## Capturas

```bash
NODE_PATH=$(npm root -g) node .claude/skills/probar-ui/shot.js \
  "http://localhost:4300/#/characters/<id>" "<scratchpad>" --sizes=390x844,1280x800 --scroll=0,600
```

Playwright y Chromium ya están instalados globalmente: **no** ejecutes `playwright install`.
Mira las capturas con la herramienta de leer imágenes antes de decir que algo está bien.

## Navegación "volver"

`nav-e2e.js` (misma carpeta) recorre ida y vuelta asistente/subida de nivel/edición/hoja/crafteo/
invocaciones/DM/búsqueda → compendio → "← volver" a 390x844 y 1280x800:
`PORT=4300 SHOTS=<carpeta> NODE_PATH=$(npm root -g) node .claude/skills/probar-ui/nav-e2e.js`.
Lógica: `core/navigation/` (pila de páginas visitadas) y `shared/back-link.ts` (el enlace "← volver").

## Reproducir lo que ve el usuario (lecciones aprendidas)

- **Modo oscuro** (`--dark`): el usuario usa el tema oscuro; hay fallos que solo salen ahí.
- **Con scroll** (`--scroll=…`): la línea de puntos que flotaba a media página solo aparecía al
  desplazarse (un `::after` absoluto cuyo padre dejó de estar posicionado en móvil). Una captura
  sin scroll "limpia" no demuestra nada.
- **Ancho real del móvil**: 390–412 px. Las cabeceras y selectores se cortan ahí, no en escritorio.
- Para encontrar qué pinta algo raro: recorre `document.querySelectorAll('*')` con
  `getComputedStyle(el)` y `getComputedStyle(el, '::before'/'::after')` buscando la propiedad
  (p. ej. `borderTopStyle === 'dashed'`) y su `getBoundingClientRect()`.
- Si el usuario dice que "sigue igual" y aquí está bien, sospecha de **caché** (skill `desplegar`).

## Build de producción (como Pages)

Solo si el fallo podría depender del build (CSS minificado, service worker):

```bash
cd app && npx ng build -c production,bundled
cp -r .dev-data/data .dev-data/characters dist/app/browser/   # si no, "data/meta.json: HTTP 404"
npx http-server dist/app/browser -p 4444 -s &
```

Al terminar: para los servidores (`pkill -f "ng serve --port 4300"`, `pkill -f http-server`) y
borra `dist/app/browser/{data,characters}`.
