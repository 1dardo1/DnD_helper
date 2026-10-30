"""python -m dndscraper.translate [--offline] [--limit N]

Builds data/es/*.json: the same files as data/*.json with the texts people read (names,
descriptions, traits, ranges...) machine-translated to Spanish. Ids, enums and every field the
app's rules use stay in English, so the app keeps computing with data/*.json and only shows these.

- Game terms from terms.es.yaml are swapped for markers before translating and put back after.
- translations.es.json caches every translated text (keyed by the text sent), so a new extraction
  only translates what changed. --offline uses only that cache and leaves the rest in English.
- Uses Google's free public translate endpoint (no account). It may throttle: the run backs off,
  saves the cache as it goes and can simply be launched again to continue.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parents[1]
FILES = ["backgrounds", "classes", "feats", "items", "options", "rules", "species", "spells", "subclasses"]

# Paths (dot-separated, [] = every list item) of the texts to translate, per file. Everything else
# is copied as is.
COMMON = ["name", "description", "source", "adjustments[]"]
PATHS = {
    "backgrounds": ["equipment", "feat", "tools"],
    "classes": ["features[].name", "features[].description", "startingEquipment", "subclassTitle",
                "multiclass.proficienciesGained", "progression.rows[].features[]"],
    "feats": ["prerequisites.raw"],
    "items": ["magic.raw", "magic.attunementBy"],
    "options": ["prerequisites.raw"],
    "rules": [],
    "species": ["traits[].name", "traits[].description", "variants[].name", "variants[].description",
                "variants[].traits[].name", "variants[].traits[].description"],
    "spells": ["castingTime.raw", "components.material", "duration", "range", "higherLevels",
               "reactionTrigger"],
    "subclasses": ["features[].name", "features[].description", "shortName"],
}

URL = "https://translate.googleapis.com/translate_a/single"
SEP = "\n⟦#⟧\n"          # between texts sent in one request
MAX_CHARS = 4500         # per request
MARK = "⟦{}⟧"


# -- terms ---------------------------------------------------------------------------------------

def load_terms(path: Path, app_glossary: Path | None = None) -> list[tuple[re.Pattern, str, str]]:
    terms = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if app_glossary and app_glossary.exists():
        # Tool names as the app shows them (only distinctive ones: "Thieves' Tools", not "Dice").
        glossary = json.loads(app_glossary.read_text(encoding="utf-8"))
        for domain in ("tool", "toolGroup"):
            for en, es in glossary.get(domain, {}).items():
                if " " in en or "'" in en:
                    terms.setdefault(en.title().replace("'S", "'s"), es)
    out = []
    for en in sorted(terms, key=len, reverse=True):
        out.append((re.compile(rf"(?<![\w-]){re.escape(en)}(?![\w-])", re.I), en, terms[en]))
    return out


def protect(text: str, terms) -> tuple[str, list[str]]:
    """Replace game terms with ⟦0⟧, ⟦1⟧...; returns the text and the Spanish for each marker."""
    found: list[str] = []

    def sub(es):
        def f(m):
            found.append(es)
            return MARK.format(len(found) - 1)
        return f

    for rx, _, es in terms:
        text = rx.sub(sub(es), text)
    return text, found


def restore(text: str, values: list[str]) -> str:
    def f(m):
        i = int(m.group(1))
        if i >= len(values):
            return m.group(0)
        es = values[i]
        # A term that starts a sentence, a line or a bold label gets a capital.
        before = text[:m.start()].rstrip(" *_")
        if not before or before[-1] in ".!?:\n|-":
            es = es[:1].upper() + es[1:]
        return es
    return re.sub(r"⟦\s*(\d+)\s*⟧", f, text)


# -- translation ----------------------------------------------------------------------------------

class Translator:
    def __init__(self, cache_path: Path, offline: bool, delay: float = 0.3):
        self.cache_path = cache_path
        self.cache: dict[str, str] = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
        self.offline = offline
        self.delay = delay
        self.session = requests.Session()
        self.requests = 0
        self.dirty = 0

    @staticmethod
    def key(text: str) -> str:
        return hashlib.sha1(text.encode("utf-8")).hexdigest()

    def save(self) -> None:
        self.cache_path.write_text(json.dumps(self.cache, ensure_ascii=False, indent=0, sort_keys=True) + "\n",
                                   encoding="utf-8")
        self.dirty = 0

    def _call(self, text: str) -> str:
        wait = 5.0
        for attempt in range(8):
            try:
                r = self.session.post(URL, data={"client": "gtx", "sl": "en", "tl": "es", "dt": "t", "q": text},
                                      timeout=60)
                if r.status_code == 200:
                    self.requests += 1
                    time.sleep(self.delay)
                    return "".join(seg[0] for seg in r.json()[0] if seg[0])
                print(f"  HTTP {r.status_code}, reintento en {wait:.0f}s")
            except requests.RequestException as e:
                print(f"  {e.__class__.__name__}, reintento en {wait:.0f}s")
            time.sleep(wait)
            wait = min(wait * 2, 300)
        raise RuntimeError("el traductor no responde; vuelve a lanzarlo más tarde (la caché se conserva)")

    def _chunks(self, text: str) -> list[str]:
        """Split a long text by paragraphs (then lines) so each piece fits in a request."""
        if len(text) <= MAX_CHARS:
            return [text]
        out, cur = [], ""
        for para in re.split(r"(\n\n)", text):
            pieces = [para] if len(para) <= MAX_CHARS else re.split(r"(\n)", para)
            for p in pieces:
                if len(cur) + len(p) > MAX_CHARS and cur:
                    out.append(cur)
                    cur = ""
                cur += p
        if cur:
            out.append(cur)
        return out

    def translate_many(self, texts: list[str]) -> None:
        """Fill the cache for every protected text that isn't in it yet."""
        todo = list(dict.fromkeys(t for t in texts if self.key(t) not in self.cache and t.strip()))
        if self.offline or not todo:
            return
        total = sum(len(t) for t in todo)
        print(f"Traduciendo {len(todo)} textos ({total:,} caracteres)...")
        batch: list[str] = []
        done = 0

        def flush():
            nonlocal batch
            if not batch:
                return
            parts = self._call(SEP.join(batch)).split("⟦#⟧")
            if len(parts) == len(batch):
                for src, es in zip(batch, parts):
                    self.cache[self.key(src)] = es.strip("\n ") if not src.startswith(("\n", " ")) else es
            else:   # the separator got lost: one text per request
                for src in batch:
                    self.cache[self.key(src)] = self._call(src)
            self.dirty += len(batch)
            batch = []

        for t in todo:
            if len(t) > MAX_CHARS:
                flush()
                self.cache[self.key(t)] = "".join(self._call(c) for c in self._chunks(t))
                self.dirty += 1
            else:
                if sum(len(b) + len(SEP) for b in batch) + len(t) > MAX_CHARS:
                    flush()
                batch.append(t)
            done += len(t)
            if self.dirty >= 200:
                self.save()
                print(f"  {done:,}/{total:,} caracteres ({self.requests} peticiones)")
        flush()
        self.save()

    def get(self, protected: str) -> str | None:
        return self.cache.get(self.key(protected))


# -- walking the data -----------------------------------------------------------------------------

def _visit(node, parts: list[str], fn):
    """Call fn(container, key) for every string at the path."""
    if not parts or node is None:
        return
    head, rest = parts[0], parts[1:]
    many = head.endswith("[]")
    key = head[:-2] if many else head
    if not isinstance(node, dict) or key not in node:
        return
    value = node[key]
    if many:
        if not isinstance(value, list):
            return
        for i, item in enumerate(value):
            if rest:
                _visit(item, rest, fn)
            elif isinstance(item, str):
                fn(value, i)
    elif rest:
        _visit(value, rest, fn)
    elif isinstance(value, str):
        fn(node, key)


def strings_of(entry: dict, paths: list[str]):
    """(container, key) of every text to translate in the entry."""
    out = []
    for p in paths:
        _visit(entry, p.split("."), lambda c, k: out.append((c, k)))
    return out


def run(root: Path, offline: bool = False, limit: int | None = None) -> dict:
    terms = load_terms(HERE / "terms.es.yaml", root / "app/src/app/core/i18n/glossary.es.json")
    tr = Translator(HERE / "translations.es.json", offline)
    data = {f: json.loads((root / "data" / f"{f}.json").read_text(encoding="utf-8")) for f in FILES}

    # 1. Collect every text (protected) and translate what's missing.
    protected_texts = []
    for f, entries in data.items():
        for e in entries:
            for c, k in strings_of(e, COMMON + PATHS[f]):
                protected_texts.append(protect(c[k], terms)[0])
    if limit:
        protected_texts = protected_texts[:limit]
    tr.translate_many(protected_texts)

    # 2. Write data/es with the translations (the English stays where a text has none yet).
    out_dir = root / "data" / "es"
    out_dir.mkdir(exist_ok=True)
    missing = 0
    for f, entries in data.items():
        for e in entries:
            for c, k in strings_of(e, COMMON + PATHS[f]):
                text, values = protect(c[k], terms)
                es = tr.get(text)
                if es is None:
                    missing += 1
                else:
                    es = restore(es, values)
                    c[k] = es[:1].upper() + es[1:] if k in ("name", "shortName") else es
        (out_dir / f"{f}.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stats = {"texts": len(protected_texts), "untranslated": missing, "requests": tr.requests}
    print(json.dumps(stats))
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="only use translations.es.json, translate nothing new")
    ap.add_argument("--limit", type=int, help="translate at most N texts (for testing)")
    ap.add_argument("--root", type=Path, default=ROOT)
    args = ap.parse_args()
    run(args.root, offline=args.offline, limit=args.limit)


if __name__ == "__main__":
    main()
