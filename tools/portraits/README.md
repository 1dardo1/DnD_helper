# Retratos con IA

Genera una imagen por especie y por monstruo con una IA de imágenes gratuita, **Cloudflare Workers
AI** (modelo FLUX.1 [schnell]), y la deja lista para la app (480×640 px, WebP, unos 20–80 KB), con
la lista `index.json` de las que hay. No hay que descargar ni convertir nada a mano.

| kind | imágenes en | prompts | dónde se ven |
| --- | --- | --- | --- |
| `species` (89) | `app/public/species/` | `species.yaml` | dentro de la app (web y APK) |
| `monsters` (331) | `media/monsters/` | `monsters.yaml` | solo publicadas en GitHub Pages; la app (web y APK) las pide allí ([media/monsters/README.md](../../media/monsters/README.md)) |

Los monstruos no van dentro de la app porque son muchos (331 × ~50 KB ≈ 16 MB): la APK crecería.

- `species.yaml` / `monsters.yaml`: el estilo común y la descripción (prompt) y la semilla (seed) de
  cada entrada (mismo formato: `style`, `negative` y `species:` o `monsters:` con
  `<id>: { prompt, seed, skip? }`; el id es el de `data/<kind>.json`).
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

- **kind**: `species` o `monsters`.
- **only**: ids separados por comas (p. ej. `elf,tabaxi`) para hacer o rehacer solo esos; vacío =
  todas las que faltan.
- **force**: rehacer todas, aunque ya existan.
- **changed**: rehacer también las que tienen el prompt o la seed cambiados desde que se hicieron.
- **limit**: como mucho N imágenes (útil para una primera prueba con 3–4).

La acción **no toca la rama principal**: sube las imágenes, `index.json` y `generated.json` a la
rama de revisión `portraits/<kind>` (`portraits/species` o `portraits/monsters`) y en el resumen
de la ejecución deja el enlace para compararla y abrir el *pull request*. Si esa rama ya existe
(aún no fusionada), la siguiente ejecución **sigue en ella**: cuenta como hechas sus imágenes y le
fusiona antes la rama actual (prompts y datos nuevos). Después de fusionar el PR, borra la rama. En *Artifacts* está `review.html` con todas las imágenes: ábrelo, marca
las que no te gusten y copia la lista de ids que se forma arriba.

Si faltan los secretos, la acción falla al principio con un mensaje que lo dice.

### Monstruos: dos días

Los 331 monstruos no caben en la cuota gratuita de un día (~170). La primera ejecución hace unos
170, para al acabarse la cuota y los sube a `portraits/monsters`; la siguiente (al día siguiente,
la cuota se reinicia a las 00:00 UTC) sigue con los que faltan en la misma rama. Para eso:

- **A mano**: *Run workflow* con **kind** = `monsters` otra vez (o *Re-run jobs* de la ejecución
  anterior).
- **Solo**: la acción también se ejecuta **cada día a las 04:23 UTC** (`schedule`) para los
  monstruos: si no hay secretos o no falta ninguno (en la rama `portraits/monsters`), no hace nada
  y termina en verde. GitHub solo lanza las programadas desde la rama por defecto del repo.

Cuando estén todos, revisa `review.html` y fusiona el PR de `portraits/monsters`: al llegar a la
rama principal, la acción de GitHub Pages las publica.

## Cambiar una imagen

1. En `species.yaml` (o `monsters.yaml`), cambia la `seed` de esa entrada (cualquier otro número = otra imagen con la
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
python -m portraits monsters                     # monstruos (a media/monsters/)
python -m portraits monsters --status            # pictures=..., total=..., pending=... (lo usa la acción)

# de prueba, sin API: dibuja marcadores de posición en otra carpeta (no toca la app)
python -m portraits species --provider fake --out /tmp/retratos
python -m portraits monsters --provider fake --out /tmp/monstruos
```

Después abre `portraits/review.html` (o el de la carpeta `--out`) en el navegador.
Tests: `python -m unittest discover -s portraits/tests -t .`

## Cuota gratuita

El plan gratuito de Workers AI da **10.000 *neurons* al día** (se reinicia a las 00:00 UTC). Cada
imagen de 1024×1024 a 4 pasos gasta unas 58 (4 teselas de 512×512 × 4,8 + 4 pasos × 9,6), así que
caben **unas 170 imágenes al día**: las 89 especies en una ejecución; los 331 monstruos, en dos días. Si se acaba la cuota (o la API
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
- Otro tipo de entrada: añadirlo a `PICTURES` en `catalog.py` (con su carpeta), escribir
  `<kind>.yaml` y añadir la opción en la acción.
