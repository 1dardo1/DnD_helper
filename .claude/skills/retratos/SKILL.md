---
name: retratos
description: Genera con IA (Cloudflare Workers AI, FLUX.1 schnell, gratis) los retratos de especies y monstruos de D&D Helper mediante el workflow portraits.yml, los revisa y los lleva a producción. Úsala cuando el usuario confirme que ya creó los secretos de Cloudflare o pida rehacer imágenes.
---

# Retratos con IA

Detalle completo: `tools/portraits/README.md`. Estado al escribir esto: **bloqueado** hasta que el
usuario cree `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` (`PENDIENTE.md` §2). Esas
credenciales son suyas: nunca se las pidas por el chat ni las crees tú.

## Comprobar si ya hay secretos

La ejecución diaria programada de "Generar retratos con IA" termina en segundos con el aviso
"Faltan los secretos" mientras no existan. Mira la última ejecución de `portraits.yml` (skill
`desplegar`): si el paso "Generate" ya no aparece como *skipped*, los secretos están.

## Flujo

1. **Prueba de estilo** (siempre primero): lanzar `portraits.yml` a mano con `kind=species`,
   `only=elf,dwarf,tabaxi,warforged` (`mcp__github__actions_run_trigger`, `run_workflow`,
   `workflow_id: portraits.yml`, `ref: claude/practical-ride-qnr51a`, inputs). Descarga el artefacto
   (`review.html` + imágenes) y enséñaselas al usuario. Ajustes de estilo: `style`/`negative` y
   prompts en `tools/portraits/species.yaml` / `monsters.yaml`.
2. **Especies**: `kind=species` sin `only` (89, caben en una ejecución).
3. **Monstruos**: `kind=monsters` (331; ~170/día de cuota gratuita). La ejecución diaria
   programada continúa sola donde se quedó hasta terminar.
4. Las imágenes van a la rama de revisión `portraits/<kind>`, **nunca** directas a producción.
   Revisadas: fusiona esa rama en `claude/practical-ride-qnr51a` (skill `fusionar-agente`, pasos
   de fusión/verificación) y empuja. Pages/APK se redespliegan solos.
5. Rehacer alguna: `only=<ids>` (se rehacen aunque existan) o cambia su `seed`/`prompt` y lanza
   con `changed=true`.

## Dónde acaban

- Especies: `app/public/species/<id>.webp` + `index.json` → dentro de la web y de la APK.
- Monstruos: `media/monsters/<id>.webp` + `index.json` → solo publicadas en Pages
  (`<web>/monsters/`); la APK las pide a la web (no engordan la APK).
