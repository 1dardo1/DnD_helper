"""Species (2024) and races (2014), normalised to the 2024 shape."""

from __future__ import annotations

import copy
import re

from bs4 import Tag

from .common import base_entry, number, source_year, split_source
from .html import Page, labeled_fields, slug, table_rows, text_of, to_markdown, top_blocks, traits

# 2014 traits that carry no mechanics under 2024 rules (ASIs and languages are dropped too).
_NON_MECHANICAL = re.compile(
    r"^(ability score (increase|increases)|age|alignment|size|speed|(extra )?languages?|creature type|"
    r"ability scores?|subraces?)$", re.I)
_SIZES = ["Tiny", "Small", "Medium", "Large"]
_CREATURE_TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend",
                   "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"]


def _creature_type(raw: str | None) -> str:
    m = re.search(r"\b(" + "|".join(_CREATURE_TYPES) + r")\b", raw or "", re.I)
    return m.group(1).lower() if m else "humanoid"


def _heading_level(el) -> int | None:
    if isinstance(el, Tag) and re.fullmatch(r"h[1-6]", el.name or ""):
        return int(el.name[1])
    return None


def _until_heading(nodes: list, start: int, level: int) -> list:
    out = []
    for el in nodes[start + 1:]:
        lv = _heading_level(el)
        if lv is not None and lv <= level:
            break
        out.append(el)
    return out


def _fields_from(nodes: list) -> dict[str, str]:
    return labeled_fields(to_markdown(nodes))


def _sizes(raw: str) -> list[str]:
    outside = re.sub(r"\(.*?\)", "", raw or "")
    return [s for s in _SIZES if re.search(rf"\b{s}\b", outside)] or ["Medium"]


def _speed(raw: str, trait_text: str) -> dict:
    speed = {"walk": number(raw) or 30}
    for kind in ("fly", "swim", "climb", "burrow"):
        m = re.search(rf"{kind}(?:ing)? speed (?:of |equal to )?(\d+)", f"{raw} {trait_text}", re.I)
        if m:
            speed[kind] = int(m.group(1))
        elif re.search(rf"{kind}(?:ing)? speed equal to your (?:walking )?speed", f"{raw} {trait_text}", re.I):
            speed[kind] = speed["walk"]
    return speed


def _darkvision(text: str) -> int | None:
    m = re.search(r"darkvision[^\n]{0,90}?(\d+) feet", text, re.I)
    return int(m.group(1)) if m else None


def _feature_list(items) -> list[dict]:
    # Species traits are gained at character level 1; later benefits are described in the text.
    return [{"name": t.name, "level": 1, "description": t.description} for t in items]


def _variants_from_tables(nodes: list) -> list[dict]:
    variants = []
    for el in nodes:
        tables = [el] if el.name == "table" else el.find_all("table") if isinstance(el, Tag) else []
        for table in tables:
            rows = table_rows(table)
            if len(rows) > 1 and sum(1 for c in rows[0] if c) == 1:
                rows = rows[1:]
            if len(rows) < 2 or not re.search(r"lineage|legacy|ancestry|dragon|giant|heritage", rows[0][0], re.I):
                continue
            head = rows[0]
            for r in rows[1:]:
                if not r or not r[0]:
                    continue
                desc = "\n".join(f"**{h}:** {c}" for h, c in zip(head[1:], r[1:]) if c)
                spells = []
                for h, c in zip(head[1:], r[1:]):
                    lv = re.match(r"level (\d+)", h, re.I)
                    if lv and c and len(c) < 60:
                        spells.append({"level": int(lv.group(1)), "spells": [s.strip() for s in re.split(r",| and ", c) if s.strip()]})
                variants.append({"name": r[0], "description": desc, "traits": [], "spells": spells or None})
    return variants


def parse_species_2024(page: Page) -> tuple[dict | None, list[str]]:
    source, blocks = split_source(page)
    idx = next((i for i, el in enumerate(blocks)
                if _heading_level(el) and re.search(r"traits$", text_of(el), re.I)), None)
    if idx is None:
        return None, ["no '<Species> Traits' heading"]
    level = _heading_level(blocks[idx])
    section = _until_heading(blocks, idx, level)
    fields = _fields_from(section)
    body = [el for el in section if not re.match(r"^\**(Creature Type|Size|Speed)\**:", to_markdown([el]))]
    # stop traits at the first sub-heading (lineage tables, etc.)
    trait_nodes = []
    for el in body:
        if _heading_level(el):
            break
        trait_nodes.append(el)
    _, items = traits(trait_nodes)
    for t in items:   # some pages write "**Size.** ..." as a trait instead of a field
        if _NON_MECHANICAL.match(t.name):
            fields.setdefault(t.name.lower(), t.description)
    items = [t for t in items if not _NON_MECHANICAL.match(t.name)]
    trait_text = " ".join(f"{t.name}. {t.description}" for t in items)
    description = to_markdown(blocks[:idx])
    entry = base_entry(page, "species", slug(page.title), source=source, description=description)
    entry.update({
        "creatureType": _creature_type(fields.get("creature type")),
        "size": _sizes(fields.get("size", "")),
        "speed": _speed(fields.get("speed", ""), trait_text),
        "darkvision": _darkvision(trait_text),
        "traits": _feature_list(items),
        "variants": _variants_from_tables(section),
    })
    warnings = [] if items else ["no traits found"]
    return entry, warnings


def _li_as_paragraphs(nodes: list) -> list:
    """2014 race pages list traits as <ul><li>; turn each top-level <li> into a <p>."""
    out = []
    for el in nodes:
        if isinstance(el, Tag) and el.name == "ul" and el.find("li", recursive=False) and \
                el.find("li", recursive=False).find(["strong", "b"]):
            el = copy.copy(el)   # never mutate the shared tree
            for li in el.find_all("li", recursive=False):
                li.name = "p"
                for sub in li.find_all(["ul", "ol"], recursive=False):
                    sub.extract()
                    out.append(li)
                    li = sub
                out.append(li)
        else:
            out.append(el)
    return out


def _has_base_traits(nodes: list) -> bool:
    _, items = traits(_li_as_paragraphs([n for n in nodes if not _heading_level(n)]))
    return any(re.match(r"^(speed|size|ability score)", t.name, re.I) for t in items)


def parse_race_2014(page: Page) -> tuple[dict | None, list[str]]:
    """2014 race page. A page may hold several printings as h1 sections named after their book:
    the most recent complete printing wins, and subraces only printed elsewhere become variants."""
    warnings: list[str] = []
    nodes = top_blocks(page.content)
    versions: list[tuple[str | None, list]] = []
    for el in nodes:
        if _heading_level(el) == 1:
            versions.append((text_of(el), []))
        elif versions:
            versions[-1][1].append(el)
        else:
            versions.append((None, [el]))
    # Merge flavour text before the first h1 into the first version.
    if len(versions) > 1 and versions[0][0] is None:
        lead = versions.pop(0)[1]
        versions[0] = (versions[0][0], lead + versions[0][1])
    full = [v for v in versions if _has_base_traits(_until_first_sub(v[1]))]
    if not full:
        return None, ["no traits found"]
    title, chosen = max(full, key=lambda v: _printing_rank(v[0]))
    source = title if source_year(title) else None
    for el in chosen:
        m = re.match(r"^Source:\s*(.+)$", text_of(el)) if isinstance(el, Tag) and el.name == "p" else None
        if m:
            source = m.group(1)

    main_nodes = [el for el in _until_first_sub(chosen)
                  if not (isinstance(el, Tag) and re.match(r"^Source:", text_of(el)))]
    lead, all_items = traits(_li_as_paragraphs(main_nodes), nest_options=False)
    kept = [t for t in all_items if not _NON_MECHANICAL.match(t.name)]
    variants = _subraces(chosen)
    for vtitle, vnodes in versions:
        if vnodes is chosen:
            continue
        if any(vnodes is f[1] for f in full):   # another complete printing: not a player choice,
            # just the same creature told again in another book (Goblin's Volo's/Plane Shift...).
            vl, vitems = traits(_li_as_paragraphs(_until_first_sub(vnodes)), nest_options=False)
            variants.append({"name": f"{page.title} ({vtitle})", "description": vl,
                             "traits": _feature_list([t for t in vitems if not _NON_MECHANICAL.match(t.name)]),
                             "spells": None, "reprint": True,
                             "_asi": any(re.match(r"ability score", t.name, re.I) for t in vitems)})
        for v in _subraces(vnodes):
            if all(slug(v["name"]) != slug(x["name"]) for x in variants):
                variants.append(v)

    fields = {t.name.lower(): t.description for t in all_items}
    trait_text = " ".join(f"{t.name}. {t.description}" for t in kept)
    entry = base_entry(page, "species", slug(page.title), source=source, description=lead)
    entry.update({
        "creatureType": _creature_type(fields.get("creature type")),
        "size": _sizes(re.sub(r".*?(your size is|you are)", "", fields.get("size", "Medium"), flags=re.I)),
        "speed": _speed(fields.get("speed", ""), trait_text),
        "darkvision": _darkvision(trait_text),
        "traits": _feature_list(kept),
        "variants": variants,
    })
    adjustments = []
    if any(re.match(r"ability score", t.name, re.I) for t in all_items) or any(v.pop("_asi", False) for v in variants):
        adjustments.append("Removed racial Ability Score Increase (2024 rules)")
    if any(re.match(r"(extra )?languages?$", t.name, re.I) for t in all_items):
        adjustments.append("Removed racial languages (2024 rules)")
    for v in variants:
        v.pop("_asi", None)
    if adjustments:
        entry["adjustments"] = adjustments
    return entry, warnings


_SETTING_BOOKS = re.compile(r"plane shift|eberron|wildemount|theros|ravnica|guildmaster|spelljammer|krynn|"
                            r"dragonlance|strixhaven|witchlight|dankwood|kaladesh|zendikar|amonkhet|ixalan|"
                            r"innistrad|dominaria", re.I)


def _printing_rank(title: str | None) -> int:
    """Most recent general printing first; setting-specific books only when nothing else exists."""
    year = source_year(title)
    return year - 100 if title and _SETTING_BOOKS.search(title) else year


def _segments(nodes: list) -> tuple[list, list[tuple[str, list]]]:
    """(main nodes, [(heading, nodes)]). Headed sections before the base traits (e.g. a
    '##### History' table heading) are part of the main block, not subraces."""
    main: list = []
    subs: list[tuple[str, list]] = []
    cur = None
    for el in nodes:
        if _heading_level(el):
            cur = (text_of(el), [])
            subs.append(cur)
        elif cur:
            cur[1].append(el)
        else:
            main.append(el)
    if not _has_base_traits(main):
        first = next((i for i, (_, n) in enumerate(subs) if _has_base_traits(n)), None)
        if first is not None:
            for _, n in subs[:first + 1]:
                main += n
            subs = subs[first + 1:]
    return main, subs


def _until_first_sub(nodes: list) -> list:
    return _segments(nodes)[0]


def _subraces(nodes: list) -> list[dict]:
    out = _segments(nodes)[1]
    variants = []
    for name, sub in out:
        lead, items = traits(_li_as_paragraphs(sub), nest_options=False)
        if not items:
            continue
        variants.append({
            "name": name,
            "description": lead,
            "traits": _feature_list([t for t in items if not _NON_MECHANICAL.match(t.name)]),
            "spells": None,
            "_asi": any(re.match(r"ability score", t.name, re.I) for t in items),
        })
    return variants
