"""Shared vocabulary and small parsers used by every content type."""

from __future__ import annotations

import re

from .html import Page, clean, slug, to_markdown, top_blocks

ABILITIES = {
    "strength": "STR", "dexterity": "DEX", "constitution": "CON",
    "intelligence": "INT", "wisdom": "WIS", "charisma": "CHA",
    "str": "STR", "dex": "DEX", "con": "CON", "int": "INT", "wis": "WIS", "cha": "CHA",
}

SKILLS = [
    "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight",
    "intimidation", "investigation", "medicine", "nature", "perception", "performance",
    "persuasion", "religion", "sleight-of-hand", "stealth", "survival",
]

CLASSES_2024 = [
    "artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin",
    "ranger", "rogue", "sorcerer", "warlock", "wizard",
]
CLASSES_2014_ONLY = ["blood-hunter"]
ALL_CLASSES = CLASSES_2024 + CLASSES_2014_ONLY
# Excluded by decision (never extracted): their pages are skipped by the crawler, they are removed
# from spell class lists, and spells listed only for them are dropped.
EXCLUDED_CLASSES = ["mystic", "psion"]

# Publication year of 2014-era books, to pick the most recent printing of a page.
_SOURCE_YEARS = [
    ("player's handbook", 2014), ("dungeon master", 2014), ("elemental evil", 2015), ("sword coast", 2015),
    ("volo", 2016), ("plane shift", 2017), ("xanathar", 2017), ("tortle package", 2017),
    ("tome of foes", 2018), ("guildmaster", 2018), ("acquisitions", 2019), ("eberron", 2019),
    ("wildemount", 2020), ("theros", 2020), ("tasha", 2020), ("dankwood", 2020), ("witchlight", 2021),
    ("van richten", 2021), ("strixhaven", 2021), ("fizban", 2021), ("monsters of the multiverse", 2022),
    ("spelljammer", 2022), ("dragonlance", 2022), ("krynn", 2022), ("planescape", 2023), ("bigby", 2023),
    ("book of many things", 2023), ("critical role", 2020), ("blood hunter", 2020),
]


def source_year(title: str | None) -> int:
    low = (title or "").lower()
    if "unearthed arcana" in low or re.search(r"\bua\b", low):
        return 0
    return next((y for k, y in _SOURCE_YEARS if k in low), 0)


ORDINAL = re.compile(r"(\d+)(?:st|nd|rd|th)")


def abilities_in(text: str) -> list[str]:
    """Ability codes mentioned in text, in order of appearance, without repeats."""
    out: list[str] = []
    for m in re.finditer(r"\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\b", text, re.I):
        code = ABILITIES[m.group(1).lower()]
        if code not in out:
            out.append(code)
    return out


def skills_in(text: str) -> list[str]:
    out = []
    low = slug(text)
    for s in SKILLS:
        if re.search(rf"(^|-){s}(-|$)", low) and s not in out:
            out.append(s)
    return out


def classes_in(text: str, among: list[str] = ALL_CLASSES) -> list[str]:
    out = []
    low = slug(text)
    for c in among:
        if re.search(rf"(^|-){c}s?(-|$)", low) and c not in out:
            out.append(c)
    return out


def number(text: str | None) -> int | None:
    if not text:
        return None
    m = re.search(r"-?\d+", text.replace(",", ""))
    return int(m.group()) if m else None


def split_source(page: Page) -> tuple[str | None, list]:
    """Return (source, remaining top-level blocks) removing the 'Source: X' paragraph."""
    blocks = top_blocks(page.content)
    source = None
    rest = []
    for el in blocks:
        t = clean(el.get_text(" ")) if el.name == "p" else ""
        m = re.match(r"^Sour?ces?\s*[:-]\s*(.+)$", t)
        if m and source is None:
            source = m.group(1).strip()
            continue
        rest.append(el)
    return source, rest


def base_entry(page: Page, kind: str, entry_id: str, name: str | None = None,
               source: str | None = None, description: str = "") -> dict:
    return {
        "id": entry_id,
        "type": kind,
        "name": name or page.title,
        "edition": page.edition,
        "source": source,
        "description": description,
        "url": page.url,
    }


def markdown(nodes) -> str:
    return to_markdown(nodes)
