# Extractor de datos de las wikis

Convierte [dnd5e.wikidot.com](https://dnd5e.wikidot.com) (reglas de 2014) y
[dnd2024.wikidot.com](https://dnd2024.wikidot.com) (reglas de 2024) en los JSON de `data/`.

## Uso

Lo normal es lanzarlo desde GitHub: **Actions → "Extraer datos de las wikis" → Run workflow**.
La acción descarga solo las páginas que han cambiado desde la última vez (usa la fecha de los
sitemaps y una caché entre ejecuciones), valida el resultado y, si todo está bien, hace commit de
`data/` y de `tools/scraper/report.md`. Marca *full_refresh* para ignorar la caché y descargarlo todo.

En local:

```bash
cd tools/scraper
pip install -r requirements.txt
python -m dndscraper            # descarga (con caché en .cache/) y genera data/
python -m dndscraper --offline  # solo con lo que ya está en .cache/
python -m dndscraper.validate   # comprueba data/*.json
```

La primera descarga completa son ~4.300 páginas (≈1 h a una petición cada 0,5 s).

## Qué hace

1. **Descubre** las páginas en los sitemaps de ambas wikis.
2. **Descarga** cada página (con caché en `.cache/`, fuera de git).
3. **Convierte** cada tipo con su conversor (`dndscraper/*.py`) al mismo esquema JSON, sea cual sea la wiki.
4. **Adapta lo de 2014 a las reglas de 2024**:
   - Especies: se quitan aumentos de característica, idiomas y rasgos sin mecánica (edad, alineamiento…).
   - Subclases: cada rasgo pasa al siguiente nivel de subclase de la clase de 2024
     (p. ej. Clérigo 1, 2, 8 → 3, 3, 10); las tablas de hechizos de subclase empiezan como pronto en el nivel de subclase.
   - Dotes: pasan a `general` (o `racial` si piden una especie) con requisito de nivel 4.
   - Estilos de combate de 2014: pasan a dotes `fighting-style`.
   - Cada cambio queda anotado en el campo `adjustments` del elemento.
5. **Fusiona**: si algo existe en las dos ediciones (mismo nombre o sucesor), se queda la versión de 2024
   y la de 2014 se apunta en su campo `replaced`. Dentro de una misma wiki, el contenido publicado gana a su
   versión UA, y la UA más reciente a las anteriores.
6. **Escribe** `data/<tipo>.json`, `data/meta.json` y el informe `tools/scraper/report.md`.

## Traducción al español

Al final de cada extracción, `dndscraper.translate` traduce al español los textos que se leen (nombres,
descripciones, rasgos, alcances, duraciones…) y escribe `data/es/*.json`, con la misma estructura e ids
que `data/*.json`. Así inglés y español siempre van alineados. Lo que usan las reglas de la app (ids,
categorías, competencias…) no se traduce.

- Usa el traductor público y gratuito de Google, sin cuenta. Solo se envía lo nuevo o lo que ha
  cambiado: cada traducción se guarda en `translations.es.json` (se sube al repo con los datos).
- **`terms.es.yaml`**: términos de juego que se respetan siempre (puntos de golpe, acción adicional,
  po…). Puedes añadir los que salgan mal. Los nombres de herramientas se toman del glosario de la app.
- **`fixes.es.yaml`**: correcciones que se aplican al texto ya traducido (p. ej. «hechizo» → «conjuro»,
  «Wizard» → «Mago»). Cambiarlo no obliga a volver a traducir: basta con regenerar
  (`python -m dndscraper.translate --offline`).
- Si Google pide ir más despacio, el script espera; si tarda demasiado (`--translate-budget`, 90 minutos
  en la acción) se para, guarda lo traducido y la siguiente ejecución continúa. El resumen de la acción
  dice cuántos textos están traducidos.
- **Hasta el 100 %:** la acción «Seguir traduciendo los datos» (`translate.yml`) se lanza sola cada
  3 horas, retoma lo que falte y no hace nada cuando la traducción está completa.
- `python -m dndscraper --no-translate` extrae sin traducir; `python -m dndscraper.translate` solo traduce.

## Imágenes de las especies

El extractor no busca imágenes. Las de las especies las pone el usuario a mano en
`app/public/species/<id>.webp` y van con la app (ver `app/public/species/README.md`).

## Exclusiones

- La clase Mystic y sus disciplinas.
- La clase Psion (Psiónico, UA de 2024): sus páginas de clase, sus disciplinas psiónicas y sus subclases
  (`ua:class-psion*`, `ua:subclass-psion-*`) no se descargan (`crawl.py`). Los hechizos que solo están en
  la lista del Psion se descartan y, en los demás, `psion` se quita de `classes`
  (`common.EXCLUDED_CLASSES`). `dndscraper.validate` falla si aparece algo del Psion en `data/` o `data/es/`.
  Se conservan las dotes *Wild Talent* del mismo UA (son dotes generales) y lo psiónico de otras clases
  (Psi Warrior, Soulknife, Aberrant Sorcery…).
- La sección *Homebrew Subclasses* de la wiki de 2014 y la sección *Homebrew* de la de 2024.
- Los trasfondos de 2014 (solo se usan los de 2024).

## Mantenimiento

- **`successors.yaml`**: cambios de nombre entre 2014 y 2024 que no se pueden deducir
  (p. ej. *Totem Warrior → Wild Heart*). El informe tiene una sección *Posibles sucesores por revisar*
  con candidatos.
- **`multiclass.yaml`**: lo que da multiclasear en las clases cuyo texto no lo dice (Blood Hunter). Una
  clase nueva sin texto ni entrada en la tabla recibe una estimación (armaduras salvo pesada, armas
  marciales si todas sus armas lo son) marcada como `origin: estimate`, que la app avisa.
- **`report.md`**: totales, qué se sustituyó, qué se conservó de 2014, páginas que fallaron y avisos.
- Si una wiki cambia su maquetación, el validador (`python -m dndscraper.validate`) falla y la acción
  no hace commit.
