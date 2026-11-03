"""Species pictures: the main image of each species' page on the Fandom wikis (Forgotten Realms
first). Only the URL is stored (species[].image); the app shows the picture from the wiki without
a Referer header (the wikis refuse images linked from other sites).

    python -m dndscraper.images [--offline]

The URLs found are kept in species-images.json, so an offline run (or a wiki that is down) keeps
the previous ones. images.yaml lists the wikis and the exceptions.
"""

import argparse
import json
import re
from pathlib import Path

import requests
import yaml

HERE = Path(__file__).resolve().parents[1]
API = "https://{wiki}.fandom.com/api.php"
WIDTH = 480
UA = {"User-Agent": "DnD-helper-scraper (personal project)"}


def _variants(name: str) -> list[str]:
    hyphen = name.replace(" ", "-")
    return list(dict.fromkeys([name, hyphen, hyphen.capitalize(), name.capitalize()]))


def _query(wiki: str, titles: list[str]) -> dict[str, str]:
    """title → original image URL, for the titles that have a page with an image."""
    out: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        r = requests.get(API.format(wiki=wiki), headers=UA, timeout=30, params={
            "action": "query", "titles": "|".join(chunk), "prop": "pageimages",
            "piprop": "original", "format": "json", "redirects": 1})
        r.raise_for_status()
        q = r.json().get("query", {})
        norm = {x["from"]: x["to"] for x in q.get("normalized", [])}
        red = {x["from"]: x["to"] for x in q.get("redirects", [])}
        pages = {p["title"]: p["original"]["source"]
                 for p in q.get("pages", {}).values() if p.get("original")}
        for t in chunk:
            final = red.get(norm.get(t, t), norm.get(t, t))
            if final in pages:
                out[t] = pages[final]
    return out


def thumbnail(url: str, width: int = WIDTH) -> str:
    """Fandom serves a smaller copy: .../revision/latest/scale-to-width-down/480?cb=..."""
    return re.sub(r"/revision/latest(?:/[^?]*)?", f"/revision/latest/scale-to-width-down/{width}", url, count=1)


def find(species: list[dict], config: dict) -> dict[str, str | None]:
    overrides = config.get("overrides") or {}
    found: dict[str, str | None] = {}
    for sid, target in overrides.items():
        if target is None:
            found[sid] = None
        else:
            wiki, title = target.split(":", 1)
            found[sid] = _query(wiki, [title]).get(title)
    for wiki in config["wikis"]:
        todo = [s for s in species if s["id"] not in found]
        hits = _query(wiki, [v for s in todo for v in _variants(s["name"])])
        for s in todo:
            url = next((hits[v] for v in _variants(s["name"]) if v in hits), None)
            if url:
                found[s["id"]] = url
    return {sid: thumbnail(u) if u else None for sid, u in found.items()}


def run(root: Path, offline: bool = False) -> dict:
    config = yaml.safe_load((HERE / "images.yaml").read_text(encoding="utf-8"))
    cache_path = HERE / "species-images.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    path = root / "data" / "species.json"
    species = json.loads(path.read_text(encoding="utf-8"))
    if not offline:
        try:
            cache = find(species, config)
            cache_path.write_text(json.dumps(cache, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        except requests.RequestException as e:
            print(f"Imágenes: no se ha podido consultar las wikis ({e}); se usan las de antes.")
    for s in species:
        s["image"] = cache.get(s["id"])
    path.write_text(json.dumps(species, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stats = {"species": len(species), "withImage": sum(1 for s in species if s["image"])}
    print(f"Imágenes de especies: {stats['withImage']} de {stats['species']}")
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3])
    args = ap.parse_args()
    run(args.root, offline=args.offline)


if __name__ == "__main__":
    main()
