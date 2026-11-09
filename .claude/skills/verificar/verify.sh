#!/usr/bin/env bash
# Todas las comprobaciones que CI y los despliegues exigen, en el mismo orden. Sale con error en
# la primera que falle. Uso: bash .claude/skills/verificar/verify.sh [--fast]
#   --fast: sin el build de producción (para iterar; antes de empujar, sin --fast)
set -euo pipefail
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$root"

step() { printf '\n== %s\n' "$*"; }

if [ -n "$(git diff --name-only HEAD -- data tools/scraper; git ls-files --others --exclude-standard -- data tools/scraper)" ]; then
  step "Datos: validador del scraper"
  (cd tools/scraper && python3 -m dndscraper.validate | tail -3)
fi
# Los dispositivos guardan data/*.json en caché y solo lo vuelven a bajar si cambia
# translatedAt/generatedAt de data/meta.json: un cambio de datos sin eso no llega al usuario.
changed="$(git diff --name-only HEAD -- data | grep -v '^data/meta.json$' || true)"
if [ -n "$changed" ] && ! git diff --name-only HEAD -- data/meta.json | grep -q meta.json; then
  echo "Cambiaste data/ sin actualizar translatedAt en data/meta.json: los dispositivos con caché no verían el cambio."
  exit 1
fi

cd app
[ -d node_modules ] || { step "npm ci"; npm ci; }

step "Formato (prettier)"
npx prettier --check src >/dev/null || { echo "Arréglalo con: (cd app && npx prettier --write src)"; exit 1; }
echo ok

step "Glosario"
npm run --silent check-glossary

step "Tests (Vitest)"
npm test 2>&1 | grep -E "Test Files|Tests |FAIL|Error" | sed 's/\x1b\[[0-9;]*m//g'
npm test >/dev/null 2>&1 || { echo "Tests en rojo: npm test para ver el detalle"; exit 1; }

if [ "${1:-}" != "--fast" ]; then
  step "Build de producción (como Pages y la APK)"
  out="$(npx ng build -c production,bundled 2>&1)" || { echo "$out" | tail -30; exit 1; }
  echo "$out" | grep -E "Initial total|WARNING|exceeded" | sed 's/\x1b\[[0-9;]*m//g' || true
fi

step "Todo en verde"
