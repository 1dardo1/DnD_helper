# Imágenes de las especies

Las imágenes de las especies van en esta carpeta (`app/public/species/`) y se incluyen en la app
(web y Android). Salen solas en las tarjetas de especie (compendio y creación de personaje) y
arriba en la página de cada especie.

## Cómo añadir una

1. Guarda la imagen como **`<id>.webp`**, donde `<id>` es el identificador de la especie, en
   minúsculas y con guiones: `elf.webp`, `air-genasi.webp`, `owlfolk-ua.webp`…
   - El id es la última parte de la dirección de la especie en el compendio:
     `#/compendium/species/elf` → `elf.webp`.
   - También está en el campo `id` de cada especie en `data/species.json`.
2. Ejecuta `npm start` o `npm test` (o `node scripts/sync-dev-data.mjs`) desde `app/`: actualizan
   `index.json`, la lista de especies que tienen imagen. Súbelo junto con las imágenes: la app solo
   pide las que están en esa lista (así no busca las que no existen).

Si una especie no tiene imagen, no se muestra nada.

## Generarlas con IA

No hace falta hacerlas a mano: `tools/portraits/` las genera con una IA gratuita (Cloudflare
Workers AI) a partir de las descripciones de `tools/portraits/species.yaml`, ya en este formato, y
actualiza `index.json`. Se lanza desde *Actions* → "Generar retratos con IA" y deja el resultado en
una rama aparte para revisarlo. Ver [tools/portraits/README.md](../../../tools/portraits/README.md).

## Formato recomendado

- **WebP** (solo se buscan ficheros `.webp`; un JPG o PNG se puede convertir, p. ej.
  `cwebp -q 80 elf.png -o elf.webp`).
- Unos **480 px de ancho**, en vertical o en 4:3. En las tarjetas se recorta a 4:3 centrada en la
  parte de arriba (donde suele estar la cara); en la página de la especie se ve entera.
- Que pese poco (unos 30–80 KB): se guardan en la caché de la app para usarla sin conexión.
