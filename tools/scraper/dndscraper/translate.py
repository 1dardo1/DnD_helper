"""python -m dndscraper.translate [--offline] [--limit N] [--budget MINUTES]

Runs on its own or as the last step of `python -m dndscraper` (the extraction).

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
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

from . import monsters

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parents[1]
FILES = ["backgrounds", "classes", "feats", "items", "options", "rules", "species", "spells", "subclasses",
         "monsters"]

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
# Files with their own list instead of COMMON + PATHS. Monsters: the description (their traits and
# actions together) isn't sent again; it's rebuilt from the translated parts (REBUILD).
OWN_PATHS = {
    "monsters": ["name", "languages"] + [f"{part}[].{field}" for part, _ in monsters.PARTS
                                         for field in ("name", "description")],
}
REBUILD = {"monsters": lambda e: monsters.describe(e, "es")}


def paths_of(file: str) -> list[str]:
    return OWN_PATHS.get(file) or COMMON + PATHS[file]

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


def load_fixes(path: Path) -> list[tuple[re.Pattern, str]]:
    """fixes.es.yaml: whole-word replacements applied to translated text (keep the first capital)."""
    fixes = yaml.safe_load(path.read_text(encoding="utf-8")) or {} if path.exists() else {}
    return [(re.compile(rf"(?<![\w-]){re.escape(wrong)}(?![\w-])", re.I), right)
            for wrong, right in sorted(fixes.items(), key=lambda kv: len(kv[0]), reverse=True)]


def apply_fixes(text: str, fixes) -> str:
    def keep_case(right):
        return lambda m: right[:1].upper() + right[1:] if m.group(0)[:1].isupper() else right
    for rx, right in fixes:
        text = rx.sub(keep_case(right), text)
    return text


# -- translation ----------------------------------------------------------------------------------

class Throttled(Exception):
    """The translator kept refusing requests for longer than the waiting budget."""


class Translator:
    def __init__(self, cache_path: Path, offline: bool, delay: float = 1.0, budget_minutes: float = 60):
        self.cache_path = cache_path
        self.cache: dict[str, str] = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
        self.offline = offline
        self.delay = delay
        self.session = requests.Session()
        self.requests = 0
        self.dirty = 0
        self.waited = 0.0
        self.stopped = False
        self.budget = budget_minutes * 60

    @staticmethod
    def key(text: str) -> str:
        return hashlib.sha1(text.encode("utf-8")).hexdigest()

    def save(self) -> None:
        self.cache_path.write_text(json.dumps(self.cache, ensure_ascii=False, indent=0, sort_keys=True) + "\n",
                                   encoding="utf-8")
        self.dirty = 0

    def _call(self, text: str) -> str:
        wait = 30.0
        while True:
            try:
                r = self.session.post(URL, data={"client": "gtx", "sl": "en", "tl": "es", "dt": "t", "q": text},
                                      timeout=60)
                if r.status_code == 200:
                    self.requests += 1
                    time.sleep(self.delay)
                    return "".join(seg[0] for seg in r.json()[0] if seg[0])
                problem = f"HTTP {r.status_code}"
            except requests.RequestException as e:
                problem = e.__class__.__name__
            if self.waited + wait > self.budget:
                raise Throttled(problem)
            print(f"  {problem}: espero {wait:.0f}s (el traductor pide ir más despacio)")
            time.sleep(wait)
            self.waited += wait
            wait = min(wait * 2, 600)

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
        print(f"Traduciendo {len(todo)} textos ({sum(len(t) for t in todo):,} caracteres)...")
        try:
            self._translate(todo)
        except Throttled as e:
            self.stopped = True
            print(f"El traductor sigue rechazando peticiones ({e}). Se guarda lo traducido; "
                  "la próxima ejecución continúa desde aquí.")
        self.save()

    def _send(self, batch: list[str]) -> None:
        parts = self._call(SEP.join(batch)).split("⟦#⟧")
        if len(parts) == len(batch):
            for src, es in zip(batch, parts):
                self.cache[self.key(src)] = es.strip("\n ")
        else:   # the separator got lost: one text per request
            for src in batch:
                self.cache[self.key(src)] = self._call(src)
        self.dirty += len(batch)

    def _translate(self, todo: list[str]) -> None:
        total = sum(len(t) for t in todo)
        done = 0
        batch: list[str] = []
        for t in todo:
            if len(t) > MAX_CHARS:
                self.cache[self.key(t)] = "".join(self._call(c) for c in self._chunks(t))
                self.dirty += 1
            else:
                if batch and sum(len(b) + len(SEP) for b in batch) + len(t) > MAX_CHARS:
                    self._send(batch)
                    batch = []
                batch.append(t)
            done += len(t)
            if self.dirty >= 200:
                self.save()
                print(f"  {done:,}/{total:,} caracteres ({self.requests} peticiones)")
        if batch:
            self._send(batch)

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


def run(root: Path, offline: bool = False, limit: int | None = None, budget_minutes: float = 60) -> dict:
    """Translate data/*.json into data/es/*.json. budget_minutes: how long to keep waiting when the
    translator asks to slow down before stopping (what's done is kept for the next run)."""
    terms = load_terms(HERE / "terms.es.yaml", root / "app/src/app/core/i18n/glossary.es.json")
    tr = Translator(HERE / "translations.es.json", offline, budget_minutes=budget_minutes)
    fixes = load_fixes(HERE / "fixes.es.yaml")
    names_path = HERE / "names.es.yaml"
    fixed_names = (yaml.safe_load(names_path.read_text(encoding="utf-8")) or {}) if names_path.exists() else {}
    data = {f: json.loads((root / "data" / f"{f}.json").read_text(encoding="utf-8")) for f in FILES
            if (root / "data" / f"{f}.json").exists()}

    # 1. Collect every text (protected) and translate what's missing.
    protected_texts = []
    for f, entries in data.items():
        for e in entries:
            for c, k in strings_of(e, paths_of(f)):
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
            for c, k in strings_of(e, paths_of(f)):
                text, values = protect(c[k], terms)
                if not text.strip():   # empty texts have nothing to translate
                    continue
                es = tr.get(text)
                if es is None:
                    missing += 1
                else:
                    es = apply_fixes(restore(es, values), fixes)
                    if k in ("name", "shortName"):
                        es = fixed_names.get(c[k]) or es[:1].upper() + es[1:]
                    c[k] = es
            if f in REBUILD:
                e["description"] = REBUILD[f](e)
        (out_dir / f"{f}.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stats = {"texts": len(protected_texts), "untranslated": missing, "requests": tr.requests,
             "complete": missing == 0}
    # The app downloads data/es again when this changes.
    meta_path = root / "data" / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["translatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    meta["translation"] = {"es": stats}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats))
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="only use translations.es.json, translate nothing new")
    ap.add_argument("--limit", type=int, help="translate at most N texts (for testing)")
    ap.add_argument("--budget", type=float, default=60,
                    help="minutes to keep waiting when the translator asks to slow down (default 60)")
    ap.add_argument("--summary", action="store_true", help="only print how much is translated (Markdown)")
    ap.add_argument("--root", type=Path, default=ROOT)
    args = ap.parse_args()
    if args.summary:
        meta = json.loads((args.root / "data" / "meta.json").read_text(encoding="utf-8"))
        t = meta.get("translation", {}).get("es", {})
        done = t.get("texts", 0) - t.get("untranslated", 0)
        more = "" if t.get("complete") else " (lanza otra vez la acción para seguir traduciendo)"
        print(f"\n**Traducción al español:** {done} de {t.get('texts', 0)} textos{more}")
        return
    run(args.root, offline=args.offline, limit=args.limit, budget_minutes=args.budget)


if __name__ == "__main__":
    main()
