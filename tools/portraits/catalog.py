"""What to draw: the compendium entries (data/<kind>.json) joined with their prompts (<kind>.yaml)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


@dataclass(frozen=True)
class Kind:
    """One kind of compendium entry that gets pictures."""

    name: str
    data: Path  # data/<kind>.json (list of {id, name, ...})
    data_es: Path  # data/es/<kind>.json (Spanish names), optional
    prompts: Path  # tools/portraits/<kind>.yaml
    pictures: Path  # where <id>.webp + index.json go (see PICTURES)


# Where each kind's pictures live, relative to the repo. The species are few (89 × ~50 KB) and ship
# inside the app (web and Android). The monsters are many (331 × ~50 KB ≈ 16 MB): they stay out of
# the app build (the APK would grow) and are only published on GitHub Pages (pages.yml copies
# media/monsters/ to <site>/monsters/), where the app loads them from (media/monsters/README.md).
PICTURES = {
    "species": Path("app/public/species"),
    "monsters": Path("media/monsters"),
}


def kind(name: str) -> Kind:
    return Kind(
        name=name,
        data=REPO / "data" / f"{name}.json",
        data_es=REPO / "data" / "es" / f"{name}.json",
        prompts=HERE / f"{name}.yaml",
        pictures=REPO / PICTURES[name],
    )


KINDS = {name: kind(name) for name in PICTURES}


@dataclass
class Entry:
    id: str
    name: str  # English
    name_es: str
    prompt: str | None  # the entry's own prompt (None: not in the YAML)
    seed: int = 0
    skip: bool = False
    full_prompt: str = ""
    hash: str = ""

    @property
    def drawable(self) -> bool:
        return bool(self.prompt) and not self.skip


@dataclass
class Catalog:
    kind: Kind
    style: str
    negative: str
    entries: list[Entry]
    warnings: list[str] = field(default_factory=list)

    def by_id(self) -> dict[str, Entry]:
        return {e.id: e for e in self.entries}


def compose(style: str, name: str, prompt: str) -> str:
    """The text sent to the model: the common style, then the entry's name and description."""
    style = " ".join(style.split()).rstrip(" .")
    prompt = " ".join(prompt.split())
    return f"{style}. {name}: {prompt}" if style else f"{name}: {prompt}"


def prompt_hash(full_prompt: str, negative: str = "") -> str:
    return hashlib.sha256(f"{full_prompt}\n--\n{negative}".encode()).hexdigest()[:16]


def _seed_for(id_: str) -> int:
    """A stable default seed when the YAML has none."""
    return int(hashlib.sha256(id_.encode()).hexdigest()[:8], 16) % 1_000_000


def load(k: Kind, data_path: Path | None = None, prompts_path: Path | None = None, data_es_path: Path | None = None) -> Catalog:
    data_path = data_path or k.data
    prompts_path = prompts_path or k.prompts
    data_es_path = data_es_path or k.data_es
    items = json.loads(data_path.read_text(encoding="utf-8"))
    names_es: dict[str, str] = {}
    if data_es_path.exists():
        for it in json.loads(data_es_path.read_text(encoding="utf-8")):
            if isinstance(it, dict) and it.get("id") and it.get("name"):
                names_es[it["id"]] = it["name"]
    conf = yaml.safe_load(prompts_path.read_text(encoding="utf-8")) if prompts_path.exists() else None
    conf = conf or {}
    style = str(conf.get("style") or "").strip()
    negative = " ".join(str(conf.get("negative") or "").split())
    prompts = conf.get(k.name) or {}
    if not isinstance(prompts, dict):
        raise SystemExit(f"{prompts_path}: '{k.name}' debe ser un diccionario id -> {{prompt, seed}}")
    warnings: list[str] = []
    if not style:
        warnings.append(f"{prompts_path.name}: falta 'style' (el estilo común)")

    entries: list[Entry] = []
    ids = set()
    for it in items:
        id_ = it["id"]
        ids.add(id_)
        name = it.get("name") or id_
        p = prompts.get(id_)
        if p is None:
            entries.append(Entry(id_, name, names_es.get(id_, name), None))
            continue
        if isinstance(p, str):
            p = {"prompt": p}
        if not isinstance(p, dict):
            warnings.append(f"{id_}: entrada no válida en {prompts_path.name}")
            entries.append(Entry(id_, name, names_es.get(id_, name), None))
            continue
        text = " ".join(str(p.get("prompt") or "").split())
        seed = p.get("seed")
        if not isinstance(seed, int) or isinstance(seed, bool):
            if seed is not None:
                warnings.append(f"{id_}: 'seed' no es un número entero ({seed!r}); se usa uno fijo")
            seed = _seed_for(id_)
        skip = bool(p.get("skip"))
        e = Entry(id_, name, names_es.get(id_, name), text or None, seed, skip)
        if not text and not skip:
            warnings.append(f"{id_}: sin 'prompt'")
        if text:
            e.full_prompt = compose(style, name, text)
            e.hash = prompt_hash(e.full_prompt, negative)
        entries.append(e)

    missing = [e.id for e in entries if e.prompt is None and not e.skip]
    if missing:
        warnings.append(f"{len(missing)} sin prompt en {prompts_path.name}: {', '.join(missing)}")
    orphans = sorted(set(prompts) - ids)
    if orphans:
        warnings.append(f"prompts sin {k.name} en {data_path.name} (¿id mal escrito?): {', '.join(orphans)}")
    return Catalog(k, style, negative, entries, warnings)


def write_index(pictures: Path) -> list[str]:
    """<pictures>/index.json: the ids of the <id>.webp files, exactly as app/scripts/sync-dev-data.mjs
    writes it (sorted, 2-space JSON, trailing newline), so the two never fight."""
    ids = sorted(p.name[: -len(".webp")] for p in pictures.glob("*.webp")) if pictures.exists() else []
    text = json.dumps(ids, indent=2) + "\n"
    manifest = pictures / "index.json"
    if not manifest.exists() or manifest.read_text(encoding="utf-8") != text:
        pictures.mkdir(parents=True, exist_ok=True)
        manifest.write_text(text, encoding="utf-8")
    return ids
