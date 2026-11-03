"""generated.json: how each picture was made, to tell when its prompt or seed changed.

``{"species": {"elf": {"hash": ..., "seed": 1101, "seed_applied": true, "provider": "cloudflare",
"model": "...", "date": "2026-11-03"}}}``
"""

from __future__ import annotations

import json
from pathlib import Path


class Record:
    def __init__(self, path: Path):
        self.path = path
        try:
            self.data: dict = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        except ValueError:
            print(f"aviso: {path} no es JSON válido; se empieza de cero")
            self.data = {}
        if not isinstance(self.data, dict):
            self.data = {}

    def get(self, kind: str, id_: str) -> dict | None:
        return (self.data.get(kind) or {}).get(id_)

    def set(self, kind: str, id_: str, info: dict) -> None:
        self.data.setdefault(kind, {})[id_] = info

    def changed(self, kind: str, id_: str, hash_: str, seed: int) -> bool:
        """True if there's a record and its prompt or seed differ from the current ones."""
        r = self.get(kind, id_)
        return r is not None and (r.get("hash") != hash_ or r.get("seed") != seed)

    def save(self) -> None:
        data = {k: dict(sorted(v.items())) for k, v in sorted(self.data.items())}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.path)
