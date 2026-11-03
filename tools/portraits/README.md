# Retratos con IA

Genera un retrato por especie (más adelante también para monstruos) con una IA de imágenes
gratuita, **Cloudflare Workers AI** (modelo FLUX.1 [schnell]), y lo deja listo para la app:
`app/public/species/<id>.webp` (480×640 px, WebP, unos 20–80 KB) y la lista
`app/public/species/index.json`. No hay que descargar ni convertir nada a mano.

- `species.yaml`: el estilo común y la descripción (prompt) y la semilla (seed) de cada especie.
- `generated.json`: cómo se hizo cada imagen (huella del prompt, seed, proveedor, fecha), para saber
  cuáles han cambiado.
- `review.html`: hoja de contactos de cada ejecución (no se sube al repo), para elegir cuáles rehacer.

## Preparación (una sola vez)

1. Crea una cuenta gratuita de Cloudflare: <https://dash.cloudflare.com/sign-up>.
2. Copia tu **Account ID**: en el panel, *Workers & Pages* → columna derecha (*Account details*), o
   la parte larga de la URL del panel (`dash.cloudflare.com/<ACCOUNT_ID>/...`).
3. Crea un **API token**: icono de usuario → *My Profile* → *API Tokens* → *Create Token* → plantilla
   **"Workers AI"** (o *Custom token* con el permiso *Account* → *Workers AI* → *Read* y *Edit*).
   Copia el token (solo se muestra una vez).
4. En GitHub: el repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
   - `CLOUDFLARE_ACCOUNT_ID`: el Account ID
   - `CLOUDFLARE_API_TOKEN`: el token

## Uso desde GitHub (lo normal)

*Actions* → **"Generar retratos con IA"** → *Run workflow*:

- **kind**: `species`.
- **only**: ids separados por comas (p. ej. `elf,tabaxi`) para hacer o rehacer solo esos; vacío =
  todas las que faltan.
- **force**: rehacer todas, aunque ya existan.
- **changed**: rehacer también las que tienen el prompt o la seed cambiados desde que se hicieron.
- **limit**: como mucho N imágenes (útil para una primera prueba con 3–4).

La acción **no toca la rama principal**: sube las imágenes, `index.json` y `generated.json` a una
rama nueva `portraits/<número>` y en el resumen de la ejecución deja el enlace para compararla y
abrir el *pull request*. En *Artifacts* está `review.html` con todas las imágenes: ábrelo, marca
las que no te gusten y copia la lista de ids que se forma arriba.

Si faltan los secretos, la acción falla al principio con un mensaje que lo dice.

## Cambiar una imagen

1. En `species.yaml`, cambia la `seed` de esa especie (cualquier otro número = otra imagen con la
   misma descripción) o retoca su `prompt`. Si una especie no debe tener imagen: `skip: true`.
2. Lánzalo con **only** = su id (o marca **changed** para rehacer todas las que hayas cambiado).

Con el mismo prompt y la misma seed sale la misma imagen (si Cloudflare acepta la seed: ver abajo).

## Uso en local

Desde `tools/`:

```bash
pip install -r portraits/requirements.txt
export CLOUDFLARE_ACCOUNT_ID=...  CLOUDFLARE_API_TOKEN=...

python -m portraits species                      # las que faltan
python -m portraits species --only elf,tabaxi    # solo esas (aunque existan)
python -m portraits species --changed            # también las de prompt/seed cambiados
python -m portraits species --force --limit 5    # rehacer, como mucho 5
python -m portraits species --dry-run            # solo enseña qué haría y con qué prompt

# de prueba, sin API: dibuja marcadores de posición en otra carpeta (no toca la app)
python -m portraits species --provider fake --out /tmp/retratos
```

Después abre `portraits/review.html` (o el de la carpeta `--out`) en el navegador.
Tests: `python -m unittest discover -s portraits/tests -t .`

## Cuota gratuita

El plan gratuito de Workers AI da **10.000 *neurons* al día** (se reinicia a las 00:00 UTC). Cada
imagen de 1024×1024 a 4 pasos gasta unas 58 (4 teselas de 512×512 × 4,8 + 4 pasos × 9,6), así que
caben **unas 170 imágenes al día**: las 89 especies en una ejecución. Si se acaba la cuota (o la API
pide esperar), el programa para, **guarda lo que ya ha hecho** e indica cuántas quedan; la siguiente
ejecución sigue por donde se quedó.

## Detalles

- Prompt enviado = `style` + `. ` + nombre en inglés + `: ` + `prompt` de la especie (máximo 2048
  caracteres). `negative` solo lo usan los proveedores que admiten prompt negativo (FLUX no).
- El modelo de Cloudflare no deja elegir el tamaño: devuelve una imagen cuadrada y aquí se recorta
  a 3:4 (por los lados, centrada) y se reduce a 480×640. Por eso el estilo pide una figura centrada.
- La documentación del modelo no lista `seed` como parámetro (aunque su ejemplo lo usa). Se envía;
  si la API lo rechazara, se repite sin él, se avisa y se anota `"seed_applied": false` en
  `generated.json` (entonces la misma seed no garantiza la misma imagen).
- Errores: 401/403 (credenciales o permisos) paran todo; 429 de cuota diaria para y guarda; 429 de
  capacidad, 408 y 5xx se reintentan (3 intentos con espera); otro error falla solo esa imagen (tras
  3 fallos seguidos se para). Las credenciales nunca se escriben en el log.
- Otro proveedor (Gemini, ComfyUI o Automatic1111 en local...): una clase con
  `generate(prompt, seed, size, negative, label) -> bytes` en `providers.py`, añadida a `PROVIDERS`.
- Monstruos: añadir `"monsters"` a `KINDS` en `catalog.py`, escribir `monsters.yaml` y la opción en
  la acción; las imágenes irían a `app/public/monsters/`.
