---
name: verificar
description: Ejecuta todas las comprobaciones del proyecto D&D Helper (validador de datos si cambian, prettier, glosario, tests Vitest y build de producción) antes de un commit o push. Úsala siempre antes de empujar y tras fusionar trabajo de un subagente.
---

# Verificar

```bash
bash .claude/skills/verificar/verify.sh          # completo: antes de empujar
bash .claude/skills/verificar/verify.sh --fast   # sin build de producción: para iterar
```

Hace lo mismo que exigen `app.yml`, `pages.yml` y `apk.yml` (estos dos **no publican** si fallan
el glosario o los tests), más el validador del scraper si hay cambios en `data/` o `tools/scraper/`.

## Si algo falla

- **Prettier**: `(cd app && npx prettier --write src)` y vuelve a verificar. Nunca `--write` sobre
  todo el repo: solo `src`.
- **Glosario**: falta un término de juego en español → añádelo al glosario de
  `app/src/app/core/i18n/` (el mensaje dice cuál).
- **Tests**: `cd app && npm test` para el detalle. Si un test viejo choca con una regla nueva
  (p. ej. un aviso nuevo que antes no salía), arregla el *fixture* del test, no la regla, y solo
  si la regla nueva es correcta según el texto de los datos.
- **Build**: errores de plantilla/TS. Los avisos de presupuesto (`exceeded maximum budget`) no
  rompen, pero apúntalos: ver "Riesgos conocidos" en `CLAUDE.md`.
- **`npx vitest run <fichero>` suelto falla con "describe is not defined"**: es normal; los tests
  van por `npm test` (Angular), no por vitest directo.

## Claves i18n duplicadas

Tras fusiones, comprueba que no haya claves repetidas:

```bash
cd app/src/app/core/i18n && python3 -c "
import re
for f in ('es.ts','en.ts'):
    k=re.findall(r\"^  '([^']+)':\",open(f).read(),re.M)
    print(f,{x for x in k if k.count(x)>1} or 'ok')"
```
