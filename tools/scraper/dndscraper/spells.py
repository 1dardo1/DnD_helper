"""Spell pages (both editions share the same layout with small wording differences)."""

from __future__ import annotations

import re

from .common import ALL_CLASSES, EXCLUDED_CLASSES, base_entry, classes_in, number, split_source
from .html import Page, clean, labeled_fields, slug, to_markdown

SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation",
           "illusion", "necromancy", "transmutation"]

_HIGHER = re.compile(r"^\*{2,3}(At Higher Levels|Using a Higher-Level Spell Slot|Cantrip Upgrade)\.?\*{2,3}\.?\s*", re.I)
_LISTS = re.compile(r"^\*{2,3}Spell Lists?\.?\*{2,3}\.?\s*", re.I)


def is_spell(page: Page) -> bool:
    return "Casting Time:" in page.text and "Duration:" in page.text


def parse_spell(page: Page) -> tuple[dict | None, list[str]]:
    warnings: list[str] = []
    source, blocks = split_source(page)
    header = None
    fields: dict[str, str] = {}
    body: list[str] = []
    higher: list[str] = []
    lists_text = ""
    for el in blocks:
        md = to_markdown([el])
        if not md:
            continue
        plain = clean(re.sub(r"\*+", "", md))
        if not fields and header is None and "Casting Time" not in md and re.search(
                r"(cantrip|level)", plain, re.I) and any(s in plain.lower() for s in SCHOOLS) and len(plain) < 200:
            header = plain
            continue
        if not fields and "Casting Time" in md:
            first, _, rest = md.partition("\n")
            if re.match(r"^\**Source:", first):   # "Source:" line glued to the header paragraph
                source = source or clean(re.sub(r"\*+|^Source:", "", first))
                md = rest
                first, _, rest = md.partition("\n")
            if header is None and "Casting Time" not in first:   # header and fields in one paragraph
                header = clean(re.sub(r"\*+", "", first))
            fields = labeled_fields(md)
            continue
        if _HIGHER.match(md):
            higher.append(_HIGHER.sub("", md))
        elif _LISTS.match(md):
            lists_text = _LISTS.sub("", md)
        elif higher:
            higher.append(md)
        else:
            body.append(md)

    if header is None or not fields:
        return None, ["no spell header or field block"]

    low = header.lower()
    school = next((s for s in SCHOOLS if s in low), None)
    if "cantrip" in low:
        level = 0
    else:
        m = re.search(r"level\s*(\d)", low) or re.search(r"(\d)(?:st|nd|rd|th)[- ]level", low)
        level = int(m.group(1)) if m else None
    if level is None:
        warnings.append(f"spell level not found in '{header}'")
    ritual = "ritual" in low

    # 2024 puts the class list in the header parenthesis; 2014 in a trailing "Spell Lists." line.
    paren = " ".join(re.findall(r"\(([^)]*)\)", header))
    listed = classes_in(lists_text or paren, ALL_CLASSES + EXCLUDED_CLASSES)
    classes = [c for c in listed if c not in EXCLUDED_CLASSES]

    casting_raw = fields.get("casting time", "")
    if "ritual" in casting_raw.lower():
        ritual = True
    components_raw = fields.get("components", "")
    duration = fields.get("duration", "")

    entry = base_entry(page, "spell", slug(page.title), source=source, description="\n\n".join(body))
    entry.update({
        "level": level,
        "school": school,
        "ritual": ritual,
        "castingTime": _casting_time(casting_raw),
        "reactionTrigger": _reaction_trigger(casting_raw),
        "range": fields.get("range", ""),
        "components": _components(components_raw),
        "duration": duration,
        "concentration": "concentration" in duration.lower(),
        "classes": classes,
        "higherLevels": "\n\n".join(higher) or None,
    })
    if listed and not classes:
        entry["_excluded"] = True   # only for an excluded class (Psion): the pipeline drops it
    elif not classes:
        warnings.append("no class lists")
    return entry, warnings


def _casting_time(raw: str) -> dict:
    low = raw.lower()
    amount = number(low) or 1
    if "bonus" in low:
        unit = "bonus-action"
    elif "reaction" in low:
        unit = "reaction"
    elif "action" in low:
        unit = "action"
    elif "minute" in low:
        unit = "minute"
    elif "hour" in low:
        unit = "hour"
    else:
        unit = "other"
    return {"raw": raw, "amount": amount, "unit": unit}


def _reaction_trigger(raw: str) -> str | None:
    m = re.search(r"reaction,?\s*(?:which you take\s*)?(.+)$", raw, re.I)
    if m and m.group(1).strip(" ,"):
        return m.group(1).strip(" ,")
    return None


def _components(raw: str) -> dict:
    material = None
    m = re.search(r"\((.*)\)", raw)
    if m:
        material = m.group(1).strip()
    head = re.sub(r"\(.*\)", "", raw).upper()
    tokens = {t.strip() for t in head.split(",")}
    cost = None
    if material:
        cm = re.search(r"([\d,]+)\+?\s*(gp|sp|cp|pp)", material, re.I)
        if cm:
            cost = int(cm.group(1).replace(",", ""))
    return {
        "v": "V" in tokens,
        "s": "S" in tokens,
        "m": "M" in tokens or material is not None,
        "material": material,
        "cost": cost,
        "consumed": bool(material and re.search(r"consume", material, re.I)),
    }
