"""Feats, plus the shared prerequisite parser."""

from __future__ import annotations

import re

from .common import ABILITIES, abilities_in, base_entry, split_source
from .html import Page, clean, slug, to_markdown

_PREREQ = re.compile(r"Prerequisites?:?\s*(.+?)\)?\s*$", re.I)


def parse_prerequisites(raw: str | None) -> dict | None:
    if not raw:
        return None
    raw = clean(raw).strip(" .()*")
    if not raw:
        return None
    out: dict = {"raw": raw}
    low = raw.lower()
    m = re.search(r"level\s*(\d+)\+?", low) or re.search(r"(\d+)(?:st|nd|rd|th)[\s-]*level", low)
    if m:
        out["level"] = int(m.group(1))
    m = re.search(r"((?:(?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:,|\s|or|and)*)+)\s*(?:score\s*(?:of\s*)?)?(\d+)", low)
    if m:
        abil = abilities_in(m.group(1))
        out["abilities"] = [{"ability": a, "min": int(m.group(2))} for a in abil]
        out["abilitiesMode"] = "any" if " or " in m.group(1) and len(abil) > 1 else "all"
    if re.search(r"spellcasting|pact magic|cast at least one spell|ability to cast", low):
        out["spellcasting"] = True
    profs = re.findall(r"proficiency with ([a-z ,]+?(?:armor|shields?|weapons?|[a-z]+'?s? tools?))", low)
    if profs:
        out["proficiency"] = [p.strip() for p in profs]
    return out


def feat_categories_2024(index: Page | None) -> dict[str, str]:
    """feat slug → category, from the headings of feat:all."""
    cats: dict[str, str] = {}
    if index is None:
        return cats
    current = None
    for el in index.content.find_all(["h1", "h2", "h3", "a"]):
        if el.name != "a":
            t = clean(el.get_text()).lower()
            if "origin" in t:
                current = "origin"
            elif "general" in t:
                current = "general"
            elif "fighting style" in t:
                current = "fighting-style"
            elif "epic boon" in t:
                current = "epic-boon"
            elif re.search(r"\bfeats?$", t):
                current = slug(re.sub(r"\bfeats?$", "", t)) or "other"   # dragonmark, planar-pact, dark-gift
            continue
        href = el.get("href", "")
        m = re.search(r"/feat:([^/#?]+)$", href)
        if m and current:
            cats.setdefault(slug(m.group(1)), current)
    return cats


def parse_feat(page: Page, category: str | None) -> tuple[dict | None, list[str]]:
    warnings: list[str] = []
    source, blocks = split_source(page)
    prereq_raw = None
    header_cat = None
    rest = []
    for el in blocks:
        md = to_markdown([el])
        plain = clean(re.sub(r"\*+", "", md))
        if len(rest) < 2 and prereq_raw is None and header_cat is None and len(plain) < 300 and (
                "prerequisite" in plain.lower() or re.search(r"\bfeat\b", plain, re.I) and md.startswith("*")):
            m = re.search(r"(origin|general|fighting style|epic boon|dragonmark)\s*feat", plain, re.I)
            if m:
                header_cat = slug(m.group(1))
            pm = _PREREQ.search(plain)
            if pm:
                prereq_raw = pm.group(1)
            continue
        rest.append(el)

    description = to_markdown(rest)
    prereq = parse_prerequisites(prereq_raw)
    text = description.lower()

    cat = category or header_cat
    if page.edition == "2014":
        cat = "general"
    cat = cat or "general"

    entry = base_entry(page, "feat", slug(page.title), source=source, description=description)
    entry.update({
        "category": cat,
        "prerequisites": prereq,
        "repeatable": bool(re.search(r"repeatable|take this feat more than once", text)),
        "abilityIncrease": _ability_increase(description),
    })
    return entry, warnings


def _ability_increase(md: str) -> dict | None:
    plain = clean(re.sub(r"\*+", "", md))
    m = re.search(r"Increase (?:your |one )?(.{0,120}?)(?:scores?)? by (\d|one|two)(?:,| to)? (?:to )?a maximum of (\d+)", plain, re.I)
    if not m:
        return None
    what = m.group(1)
    amount = {"one": 1, "two": 2}.get(m.group(2).lower(), None) or int(m.group(2))
    abil = abilities_in(what)
    if re.search(r"ability score of your choice|one ability score", what, re.I) or not abil:
        abil = list(dict.fromkeys(ABILITIES.values()))
    return {"choose": 1, "from": abil, "amount": amount, "max": int(m.group(3))}


_STYLE_LINE = re.compile(r"^-\s*\*\*([^*(]+?)\s*(?:\(([^)]*)\))?\.?\*\*\.?\s*(.+)$")


def fighting_styles_2014(classes: list[dict]) -> list[dict]:
    """2014 Fighting Style options (listed inside class features) as 2024-style fighting-style feats."""
    out: dict[str, dict] = {}
    for cls in classes:
        for f in cls.get("features", []):
            if f["name"].lower() not in ("fighting style", "additional fighting style"):
                continue
            for line in f["description"].split("\n"):
                m = _STYLE_LINE.match(line.strip())
                if not m:
                    continue
                name = clean(m.group(1)).rstrip(".")
                key = slug(name)
                if key in out:
                    out[key]["_classes"].add(cls["id"])
                    continue
                out[key] = {
                    "id": key, "type": "feat", "name": name, "edition": "2014",
                    "source": m.group(2) or cls.get("source"), "description": m.group(3).strip(),
                    "url": cls["url"], "category": "fighting-style",
                    "prerequisites": {"raw": "Fighting Style Feature"}, "repeatable": False,
                    "abilityIncrease": None, "_classes": {cls["id"]},
                    "adjustments": ["2014 Fighting Style option converted to a Fighting Style feat (2024 rules)"],
                }
    for e in out.values():
        e.pop("_classes")
    return list(out.values())
