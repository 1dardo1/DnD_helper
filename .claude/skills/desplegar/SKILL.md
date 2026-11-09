---
name: desplegar
description: Cómo se publica D&D Helper (web en GitHub Pages, PWA, APK Android en la release android-latest), cómo comprobar que un push se desplegó bien, cómo relanzar o revertir un despliegue y qué hacer si falla. Úsala después de empujar a la rama de producción, cuando el usuario diga que "no ve" un cambio, o si un workflow falla.
---

# Desplegar

Todo es **automático al empujar** a `claude/practical-ride-qnr51a` (rama por defecto). No hay paso
manual de publicación.

| Workflow | Se lanza con | Hace | Resultado |
| --- | --- | --- | --- |
| `app.yml` | push/PR que toque `app/**` o `data/**` | glosario + tests + build | solo comprueba |
| `pages.yml` | push a producción (`app/**`, `data/**`, `media/**`) | glosario + tests + build con datos | https://1dardo1.github.io/DnD_helper/ |
| `apk.yml` | push a producción (`app/**`, `data/**`) | glosario + tests + Capacitor + firma | release `android-latest` (APK) |
| `translate.yml` | cada 3 h | continúa la traducción si no está completa | commit en `data/es/` |
| `portraits.yml` | diario 04:23 UTC / a mano | retratos IA (no hace nada sin secretos) | rama `portraits/<kind>` |
| `scrape.yml` | solo a mano | extracción completa de las wikis | **no lanzar** sin que lo pida el usuario |

Pages y APK **no publican si fallan glosario o tests**: el usuario se queda en la última versión
buena. Los commits de personajes/encuentros (`characters/`, `encounters/`) no despliegan nada.

## Comprobar un despliegue

Tras empujar, espera ~2 min (app/Pages) o ~3–5 min (APK) y mira las ejecuciones del commit:

```bash
gh run list -R 1dardo1/DnD_helper -c "$(git rev-parse HEAD)"
```

Sin `gh`: herramienta `mcp__github__actions_list` (`method: list_workflow_runs`, `branch:
claude/practical-ride-qnr51a`) y `list_workflow_jobs` para ver el paso que falló. No hagas *polling*
con `sleep`; comprueba una vez cuando toque.

## Cuando falla

- **Tests/glosario**: no se publicó nada. Arregla, `verificar`, empuja.
- **"deploy" de Pages agota el tiempo** (fallo de GitHub, ha pasado): relanza solo ese workflow
  (`gh run rerun <id>` o `mcp__github__actions_run_trigger` con `rerun_workflow_run`). Una vez.
- **APK: `gradlew` o `cap sync` fallan**: suele ser una versión nueva de Android Gradle/Capacitor;
  mira el log del paso. La APK anterior sigue publicada.
- **Aviso "Sin secretos de firma"**: normal hasta que el usuario haga `PENDIENTE.md` §1.

## "No veo el cambio"

1. ¿Terminó bien el despliegue de ese commit? (arriba)
2. **Web/PWA**: el service worker sirve la versión en caché; la barra superior ofrece recargar
   cuando hay una nueva (`core/pwa/app-update.service.ts`, comprueba cada 6 h o al volver a la
   pestaña). Recarga forzada o cerrar y abrir.
3. **APK**: la app avisa si la release tiene un `build: N` mayor (`core/app-update/`). Hay que
   descargar e instalar la APK nueva; sin clave de firma, desinstalando la vieja (¡que suba antes
   sus personajes a GitHub!).
4. Si todo está al día y sigue igual, **reprodúcelo** con la skill `probar-ui` antes de responder.

## Revertir

No hay "volver a desplegar una versión vieja": se revierte el commit y se empuja (redespliega solo).

```bash
git revert --no-edit <sha>      # o un rango: git revert --no-edit <viejo>..<nuevo>
bash .claude/skills/verificar/verify.sh && git push -u origin claude/practical-ride-qnr51a
```

Nunca `push --force` a producción: la app del usuario empuja personajes a esa rama.

## Cambios de modelo de datos (personaje, encuentro)

Lo publicado convive con personajes viejos guardados en GitHub y en dispositivos sin actualizar:
- Campos nuevos **opcionales**, normalizados en `normalizeCharacter` / `normalizeEncounter`.
- Nunca renombres ni cambies el tipo de un campo existente sin migración en la normalización.
- IndexedDB (`core/storage/local-db.ts`): si añades un almacén, sube la versión y crea el almacén en
  `onupgradeneeded` sin borrar los existentes.
