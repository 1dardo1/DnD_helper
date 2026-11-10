"""Generic actions of the 2024 rules, from the Rules Glossary of the SRD 5.2.1 (CC-BY-4.0).

    python -m dndscraper.srd_rules [--offline]

The wikis have no Rules Glossary, so the actions every character can take (Attack, Dash, Disengage,
Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize), what a Bonus Action and a
Reaction are, Opportunity Attacks, the Unarmed Strike (with its Grapple and Shove options) and the
Light weapon property (the extra Bonus Action attack of two-weapon fighting) come from the official
SRD 5.2.1 PDF that Wizards of the Coast publishes on D&D Beyond.

Reads the PDF with pypdf: glossary entries are the 12 pt GillSans-SemiBold headings, the body is
Cambria (bold labels → **Label.**, italics → *text*), indented lines start new paragraphs and the
small GillSans tables become lists. The PDF is cached in tools/scraper/.cache/srd/, so --offline
works once it has been downloaded. Writes the entries (category "actions") into data/rules.json,
replacing the previous ones; the app's combat tab and the compendium ("Other rules") read them.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import requests

PDF_URL = "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
SOURCE = "SRD 5.2.1"
CATEGORY = "actions"
UA = {"User-Agent": "DnD-helper-scraper (personal project)"}
# Attribution (CC-BY-4.0): shown by the app with these entries (UI text "combat.credit").

# Glossary headings kept, in the order they are written (the app orders them itself).
GLOSSARY = ["Action", "Bonus Action", "Reaction", "Attack [Action]", "Dash [Action]", "Disengage [Action]",
            "Dodge [Action]", "Help [Action]", "Hide [Action]", "Influence [Action]", "Magic [Action]",
            "Ready [Action]", "Search [Action]", "Study [Action]", "Utilize [Action]", "Opportunity Attacks",
            "Unarmed Strike"]
# Weapon properties (the "Properties" section of "Equipment"): bold label → glossary-like entry.
PROPERTIES = ["Light"]

HEADING_FONT, HEADING_SIZE = "GillSans-SemiBold", 12.0


def download(cache: Path, offline: bool) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / PDF_URL.rsplit("/", 1)[-1]
    if not offline and not path.exists():
        r = requests.get(PDF_URL, headers=UA, timeout=120)
        r.raise_for_status()
        path.write_bytes(r.content)
    if not path.exists():
        raise FileNotFoundError(f"{path} (run without --offline once to download the SRD)")
    return path


# -- reading the PDF -----------------------------------------------------------------------------------

def chapters(reader) -> dict[str, tuple[int, int]]:
    """Top-level bookmarks of the PDF → (first page, first page of the next chapter)."""
    flat = []

    def walk(items, depth):
        for it in items:
            if isinstance(it, list):
                walk(it, depth + 1)
            elif depth == 1:
                flat.append((it.title, reader.get_destination_page_number(it)))

    walk(reader.outline, 0)
    return {t: (p, flat[i + 1][1] if i + 1 < len(flat) else len(reader.pages)) for i, (t, p) in enumerate(flat)}


def chunks(reader, first: int, end: int) -> list[tuple[str, float, float, float, str]]:
    """(font, size, x, y, text) of every piece of text of those pages, in reading order."""
    out = []
    for page in reader.pages[first:end]:
        def visit(text, cm, tm, font, size):
            if text:
                name = (font.get("/BaseFont") or "").split("+")[-1] if font else ""
                out.append((name, round(size * tm[0], 1), tm[4], tm[5], text))
        page.extract_text(visitor_text=visit)
    return out


def _markup(font: str, text: str) -> str:
    core = text.strip()
    if not core:
        return text
    if "Bold" in font:
        wrap = "***" if "Italic" in font else "**"
    elif "Italic" in font:
        wrap = "*"
    else:
        return text
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    return f"{lead}{wrap}{core}{wrap}{trail}"


def to_markdown(parts: list[tuple[str, float, float, float, str]], tables: bool = True) -> str:
    """Body chunks of one entry (font, size, x, y, text) → Markdown paragraphs and lists. Without
    tables, GillSans text (a sidebar next to a weapon property) is left out."""
    text = ""
    table_x = None
    prev_y = 0.0
    for font, size, x, y, t in parts:
        if not tables and font.startswith("GillSans"):
            continue
        if font.startswith("Cambria"):
            table_x = None
            # an indented line (" On a successful check...") starts a paragraph
            if t.startswith(" ") and (not text or text.endswith("\n")):
                text = text.rstrip("\n ") + "\n\n"
            text += _markup(font, t)
        elif font.startswith("GillSans") and t.strip():
            line = t.strip()
            if font == HEADING_FONT and size > 10:          # a table's title
                text = text.rstrip() + f"\n\n**{line}**\n\n"
                continue
            if font == HEADING_FONT:                         # a table's header row
                continue
            # the other column of a row, or a cell's second line (lower down, to the right); a list
            # in columns starts again at the top of the next one
            if table_x is not None and (abs(y - prev_y) < 1 or x > table_x + 5 and y <= prev_y + 1):
                text = text.rstrip() + " " + line + "\n"
                prev_y = y
                continue
            table_x, prev_y = x, y
            in_list = re.search(r"\n- [^\n]*$", text.rstrip())
            text = text.rstrip() + ("\n" if in_list else "\n\n") + f"- {line}\n"
    # words split at a line end: "brack -\nets", "else -where"
    text = re.sub(r"(\w) -\s*\n?\s*(\w)", r"\1\2", text)
    text = re.sub(r"([a-z])-\s*\n\s*([a-z])", r"\1\2", text)
    paragraphs = []
    for para in re.split(r"\n\s*\n", text):
        lines = [ln for ln in para.split("\n") if ln.strip()]
        if not lines:
            continue
        if all(ln.startswith("- ") for ln in lines):
            paragraphs.append("\n".join(ln.strip() for ln in lines))
        else:
            paragraphs.append(re.sub(r"\s+", " ", " ".join(lines)).strip())
    md = "\n\n".join(paragraphs)
    md = re.sub(r"\*\*\s+\*\*", " ", md)
    md = re.sub(r"(?<!\*)\* \*(?!\*)", " ", md)   # "*See* *also*" → "*See also*"
    return md.replace(" .", ".").strip()


def headed_entries(rows, wanted: list[str], tables: bool = True) -> dict[str, str]:
    """Heading → Markdown for the wanted 12 pt headings (the first of each), up to the next heading."""
    found: dict[str, list] = {}
    current = None
    for font, size, x, y, t in rows:
        if font == HEADING_FONT and size >= HEADING_SIZE and t.strip():
            name = t.strip()
            current = name if size == HEADING_SIZE and name in wanted and name not in found else None
            if current:
                found[current] = []
            continue
        # running headers and page numbers are 11 pt GillSans
        if current and size < 11 and t:
            found[current].append((font, size, x, y, t))
    return {name: to_markdown(parts, tables) for name, parts in found.items()}


def entries_from(pdf: Path) -> list[dict]:
    from pypdf import PdfReader   # only this module needs it

    reader = PdfReader(str(pdf))
    ch = chapters(reader)
    texts = headed_entries(chunks(reader, *ch["Rules Glossary"]), GLOSSARY)
    props = headed_entries(chunks(reader, *ch["Equipment"]), PROPERTIES, tables=False)
    missing = [g for g in GLOSSARY if g not in texts] + [p for p in PROPERTIES if p not in props]
    if missing:
        raise ValueError(f"SRD layout changed: not found {missing}")
    out = []
    for heading in GLOSSARY:
        m = re.match(r"^(.*?)(?: \[(\w[\w ]*)\])?$", heading)
        out.append(entry(m.group(1), m.group(2), texts[heading]))
    for prop in PROPERTIES:
        out.append(entry(f"{prop} Property", "Weapon Property", props[prop]))
    return out


def entry(name: str, tag: str | None, description: str) -> dict:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return {"id": f"{CATEGORY}/{slug}", "type": "rule", "name": name, "edition": "2024", "source": SOURCE,
            "description": description, "url": PDF_URL, "category": CATEGORY, "tag": tag}


def merge_into(rules: list[dict], entries: list[dict]) -> list[dict]:
    """data/rules.json with the actions replaced (the rest untouched, in its order)."""
    kept = [r for r in rules if r.get("category") != CATEGORY]
    return kept + entries


def seed_translations(root: Path, entries: list[dict]) -> int:
    """Puts the hand-made Spanish of actions.es.yaml into the translation cache, under the key the
    translator would use for each English text (so `translate --offline` picks them up). Keys already
    in the cache are left alone: a short text ("Action", or a name that is all one game term) is shared
    with other entries; names.es.yaml fixes those names."""
    import yaml

    from .translate import HERE, Translator, load_terms, protect

    spanish = yaml.safe_load((HERE / "actions.es.yaml").read_text(encoding="utf-8")) or {}
    terms = load_terms(HERE / "terms.es.yaml", root / "app/src/app/core/i18n/glossary.es.json")
    tr = Translator(HERE / "translations.es.json", offline=True)
    added = 0
    for e in entries:
        es = spanish.get(e["id"])
        if not es:
            continue
        for key, value in (("name", es["name"]), ("description", es["description"]), ("source", e["source"])):
            k = tr.key(protect(e[key], terms)[0])
            if k not in tr.cache:
                tr.cache[k] = value
                added += 1
    if added:
        tr.save()
    return added


def run(root: Path, offline: bool = False) -> int:
    """Writes the actions into data/rules.json and the rule count into data/meta.json; returns how many."""
    pdf = download(root / "tools/scraper/.cache/srd", offline)
    entries = entries_from(pdf)
    path = root / "data" / "rules.json"
    rules = merge_into(json.loads(path.read_text(encoding="utf-8")) if path.exists() else [], entries)
    path.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta_path = root / "data" / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta.setdefault("sources", {})["actions"] = f"{PDF_URL} ({SOURCE}, CC-BY-4.0)"
        meta.setdefault("counts", {})["rule"] = len(rules)
        by = meta.setdefault("byEdition", {}).setdefault("rule", {})
        by["2024"] = sum(1 for r in rules if r.get("edition") == "2024")
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    seeded = seed_translations(root, entries)
    print(f"{len(entries)} generic actions from the {SOURCE} → data/rules.json ({seeded} Spanish texts cached)")
    return len(entries)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="only use the cached PDF")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3])
    args = ap.parse_args()
    run(args.root, offline=args.offline)


if __name__ == "__main__":
    main()
