---
name: fusionar-agente
description: Fusiona en la rama de producción el trabajo de un subagente que trabajó en un git worktree (rama worktree-agent-*), resuelve los conflictos típicos (textos i18n, motor de reglas), verifica, empuja y limpia el worktree. Úsala cuando llegue el informe de un subagente o para revisar si quedan worktrees sin fusionar.
---

# Fusionar el trabajo de un subagente

Rama de producción: `claude/practical-ride-qnr51a`. Los subagentes trabajan en
`.claude/worktrees/agent-<id>` sobre la rama `worktree-agent-<id>` y **no empujan**.

## Pasos

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short                      # debe estar limpio; si no, commitea o guarda antes
git merge --no-edit worktree-agent-<id>
git diff --name-only --diff-filter=U    # ficheros en conflicto
```

1. **Conflictos en `es.ts`/`en.ts`** (lo habitual): `python3 .claude/skills/fusionar-agente/resolve_i18n.py`.
2. **Conflictos en código** (`engine.ts`, `sheet.ts`, `character-create.*`, `character-sheet.html`,
   `equipment-panel.*`): casi siempre son **aditivos** (dos agentes añaden campos o bloques
   distintos en el mismo sitio). Lee los dos lados y quédate con ambos. Cuidado con:
   - parámetros nuevos de una función en un lado y su uso en el otro (`combatOf`, `computeSheet`);
   - plantillas reorganizadas (p. ej. pestañas) contra una adición pequeña: toma la versión
     reorganizada y vuelve a aplicar a mano la adición donde corresponda ahora.
3. `git add -A` y `bash .claude/skills/verificar/verify.sh`. Si fallan tests de **otro** agente por
   la interacción (p. ej. un aviso nuevo que aparece en sus fixtures), ajusta el fixture.
4. Commit (si hubo conflictos) y:

```bash
git worktree remove -f -f .claude/worktrees/agent-<id>
git branch -D worktree-agent-<id>
git fetch -q origin claude/practical-ride-qnr51a
git merge --no-edit origin/claude/practical-ride-qnr51a   # la app sube personajes a esta rama
git push -u origin claude/practical-ride-qnr51a
```

El `git merge` del remoto es necesario: la app del usuario empuja commits
"Personaje: guardar …" / encuentros a la misma rama en cualquier momento.

## Informe al usuario (en español)

Qué hace ahora, decisiones del agente que contradicen lo pedido (y por qué), qué **no** se hizo,
y qué quedó sin verificar en pantalla. Las afirmaciones del informe del subagente son suyas:
compruébalas (tests, captura) antes de darlas por buenas.

## Worktrees olvidados

```bash
for b in $(git branch --format='%(refname:short)' | grep '^worktree-agent-'); do
  [ "$(git merge-base HEAD $b)" = "$(git rev-parse $b)" ] && echo "$b ya fusionada" || echo "$b PENDIENTE"
done
```

Las "ya fusionadas" se pueden borrar (worktree + rama). Las pendientes: revisa su `git log` antes.

## Subagentes cortados por límite de uso

Su trabajo queda en el worktree. Cuando se restablezca el límite, reanúdalos con `SendMessage`
(`to: <agentId>`) — no lances uno nuevo.
