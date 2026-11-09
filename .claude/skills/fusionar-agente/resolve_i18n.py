"""Resuelve conflictos de fusión en los ficheros de textos (es.ts / en.ts) quedándose con ambos lados.

Casi todas las fusiones de subagentes chocan solo aquí: cada uno añade claves nuevas en el mismo
sitio. Uso (desde la raíz del repo, con la fusión a medias):

    python3 .claude/skills/fusionar-agente/resolve_i18n.py

Falla si después quedan claves duplicadas (entonces hay que elegir a mano cuál vale).
"""

import pathlib
import re
import sys

I18N = pathlib.Path(__file__).resolve().parents[3] / "app/src/app/core/i18n"
CONFLICT = re.compile(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", re.S)

bad = False
for name in ("es.ts", "en.ts"):
    path = I18N / name
    text = path.read_text()
    if "<<<<<<<" in text:
        text = CONFLICT.sub(lambda m: m.group(1) + m.group(2), text)
        path.write_text(text)
        print(f"{name}: conflictos resueltos (ambos lados)")
    keys = re.findall(r"^  '([^']+)':", text, re.M)
    dup = sorted({k for k in keys if keys.count(k) > 1})
    if dup:
        bad = True
        print(f"{name}: CLAVES DUPLICADAS, elige a mano: {', '.join(dup)}")
sys.exit(1 if bad else 0)
