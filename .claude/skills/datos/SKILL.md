---
name: datos
description: Cómo cambiar el compendio de D&D Helper (data/*.json y data/es/*.json) sin que la próxima extracción lo deshaga - scraper Python en tools/scraper, nombres y correcciones en español, exclusiones, variantes de especie, validación y traducción offline. Úsala antes de tocar cualquier fichero de data/ o tools/scraper/.
---

# Datos del compendio

`data/*.json` (inglés) y `data/es/*.json` (español, mismos ids y estructura) los **genera**
`tools/scraper/`. La extracción online (`scrape.yml`, a mano) los regenera enteros: lo que se edite
a mano en el JSON sin su regla en el scraper **se pierde**.

## Regla de oro

Todo cambio de datos = (1) la regla en el scraper + (2) el JSON regenerado o editado igual, en el
mismo commit. Sin caché de páginas (`tools/scraper/.cache/` no existe aquí) no se puede regenerar
todo offline: entonces aplica el cambio al JSON **y** deja la regla en el scraper para la próxima
extracción. Comprueba siempre:

```bash
cd tools/scraper
python3 -m dndscraper.validate            # 0 error(s)
python3 -m dndscraper.translate --offline # regenera data/es/ desde la caché de traducciones
```

**Nunca** `python -m dndscraper` sin `--offline` (descarga ~4.300 páginas) salvo que el usuario lo
pida; para eso está el workflow `scrape.yml`.

## Dónde va cada tipo de cambio

| Quiero… | Dónde |
| --- | --- |
| Nombre en español de una cosa concreta | `names.es.yaml` (nombre exacto → traducción) |
| Corregir una palabra/frase traducida en todos los textos | `fixes.es.yaml` |
| Término de juego que la traducción debe respetar | `terms.es.yaml` (y el glosario de la app si sale en la UI) |
| Quitar del compendio un contenido entero (dotes de dragonmark, Planar Pact, Psion…) | `dndscraper/pipeline.py` (exclusiones) |
| Orden por defecto, agrupaciones, campos derivados | `dndscraper/pipeline.py` |
| Clase sucesora 2014 → 2024 | `successors.yaml` |
| Ganancias de multiclase | `multiclass.yaml` |
| Planos del Artífice | `dndscraper/plans.py` (`python3 -m dndscraper.plans` offline) |
| Variante de especie: elección real vs. reimpresión | `dndscraper/species.py` (`reprint`; `PLAYABLE_PRINTINGS` para reimpresiones jugables como el Goblin de Zendikar) |
| Elecciones dentro de un rasgo (Gnomish Lineage, Tribe...) | No es dato: `app/src/app/core/rules/trait-choices.ts` (`TRAIT_CHOICE_KEYS`) |

Tras tocar `names.es.yaml` o `fixes.es.yaml`: `translate --offline` y revisa el `git diff` de
`data/es/` (que cambie solo lo esperado).

## Comprobaciones antes de commit

- `validate` en verde y `git diff --stat data/` razonable (si cambian miles de líneas sin motivo,
  algo se regeneró de más).
- Los tests de la app leen `data/*.json` reales: `bash .claude/skills/verificar/verify.sh`.
- Si cambias la estructura de un campo, la app (`core/models/compendium.ts`) y sus lectores
  también.

## Imágenes

No son datos del scraper: retratos IA en `app/public/species/` y `media/monsters/` (skill
`retratos`).
