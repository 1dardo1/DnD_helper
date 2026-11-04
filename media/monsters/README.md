# Imágenes de los monstruos

Las imágenes de los monstruos van en esta carpeta (`media/monsters/<id>.webp`) con la lista
`index.json` de los que tienen imagen. **No van dentro de la app**: son muchas (331 × ~50 KB ≈
16 MB) y la APK de Android crecería con ellas. En su lugar:

1. La acción **"Publicar la app en GitHub Pages"** (`.github/workflows/pages.yml`) copia esta
   carpeta en la web: `https://1dardo1.github.io/DnD_helper/monsters/<id>.webp` y
   `.../monsters/index.json`.
2. La app las pide allí (`app/src/app/core/media/pictures.ts`, `PAGES_URL`, el único sitio donde
   está la dirección):
   - en la web de GitHub Pages, con una ruta relativa (`monsters/<id>.webp`, la misma web; también
     en la web de un *fork*);
   - en la APK (y en una compilación de producción en local), de la web publicada, con la
     dirección completa;
   - en desarrollo (`npm start`), de esta carpeta: `scripts/sync-dev-data.mjs` la copia en
     `app/.dev-data/monsters/` y el servidor la sirve como `monsters/`. Si añades imágenes con el
     servidor en marcha, reinícialo.
3. Primero lee `index.json` (una vez por sesión) y solo pide las imágenes que están en la lista. Sin
   conexión, o si la web aún no las tiene, no se ve nada (ni cajas vacías ni errores).

En la web, el *service worker* guarda `index.json` (red primero, caché si no hay conexión) y cada
imagen que se haya visto (hasta 400, 30 días), para verlas también sin conexión. La APK no tiene
*service worker*: allí hace falta conexión (y luego quedan en la caché normal del navegador).

Salen en las tarjetas de monstruo del compendio y arriba en la página de cada monstruo, encima del
bloque de estadísticas. Si un monstruo no tiene imagen, no se muestra nada.

## Cómo añadirlas

Lo normal es generarlas con IA: `tools/portraits/` (`python -m portraits monsters`, o la acción
**"Generar retratos con IA"** con *kind* = `monsters`) las hace a partir de
`tools/portraits/monsters.yaml`, ya en este formato, y actualiza `index.json`. Como la cuota
gratuita da para ~170 al día, tarda dos días; ver
[tools/portraits/README.md](../../tools/portraits/README.md).

A mano:

1. Guarda la imagen como **`<id>.webp`**, donde `<id>` es el id del monstruo (el campo `id` en
   `data/monsters.json`, o la última parte de la dirección: `#/compendium/monster/owlbear` →
   `owlbear.webp`). Unos 480×640 px (vertical, 3:4), 30–80 KB.
2. Ejecuta `node scripts/sync-dev-data.mjs` (o `npm start` / `npm test`) desde `app/`: actualiza
   `index.json`. Súbelo junto con las imágenes.
3. Al llegar a la rama principal, la acción de GitHub Pages las publica; la app las ve en cuanto
   se publican, sin generar una APK nueva.
