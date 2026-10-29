"""Magic items (one page each) and mundane equipment (rows of equipment tables)."""

from __future__ import annotations

import re

from bs4 import Tag

from .common import base_entry, split_source
from .html import Page, clean, labeled_fields, slug, table_rows, text_of, to_markdown

RARITIES = ["common", "uncommon", "rare", "very rare", "legendary", "artifact", "varies", "unknown rarity", "unique",
            "rarity by"]
_ITEM_TYPES = ["armor", "weapon", "potion", "ring", "rod", "scroll", "staff", "wand", "wondrous item", "shield",
               "ammunition"]


def cost(raw: str | None) -> dict | None:
    m = re.search(r"([\d,]+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)\b", raw or "", re.I)
    if not m:
        return None
    amount = float(m.group(1).replace(",", ""))
    return {"amount": int(amount) if amount.is_integer() else amount, "unit": m.group(2).lower()}


def weight(raw: str | None) -> float | None:
    m = re.search(r"(\d+)\s*/\s*(\d+)\s*lb|([\d,]+(?:\.\d+)?)\s*lb", raw or "", re.I)
    if not m:
        return None
    if m.group(1):
        return round(int(m.group(1)) / int(m.group(2)), 3)
    w = float(m.group(3).replace(",", ""))
    return int(w) if w.is_integer() else w


def _item(page: Page, name: str, category: str, description: str, source: str | None, **extra) -> dict:
    e = base_entry(page, "item", slug(name), name=clean(name), source=source, description=description)
    e.update({"category": category, "cost": extra.pop("cost", None), "weight": extra.pop("weight", None)})
    e.update(extra)
    return e


# -- magic items ---------------------------------------------------------------------

def is_magic_item(page: Page) -> bool:
    """False for index pages (tables of items) and rules pages."""
    for table in page.content.find_all("table"):
        rows = table_rows(table)
        if rows and rows[0] and rows[0][0].strip().lower() == "item name":
            return False
    return parse_magic_item(page)[0] is not None


def parse_magic_item(page: Page) -> tuple[dict | None, list[str]]:
    source, blocks = split_source(page)
    header = None
    rest = []
    for el in blocks:
        t = text_of(el)
        low_t = t.lower()
        if header is None and not rest and len(t) < 250 and "item name" not in low_t and (
                any(r in low_t for r in RARITIES) or "???" in t) and (
                (el.find("em") if isinstance(el, Tag) else False) or low_t.startswith(tuple(_ITEM_TYPES))):
            header = t
            continue
        rest.append(el)
    if header is None:
        return None, ["no type/rarity line"]
    low = header.lower()
    item_type = next((t for t in _ITEM_TYPES if low.startswith(t) or f"{t} (" in low or f"{t}," in low), None)
    sub = re.match(r"^[^(,]+\(([^)]*)\)", header)
    rarity = None
    for r in sorted(RARITIES, key=len, reverse=True):
        if re.search(rf"\b{r}\b", low):
            rarity = r
            break
    att = re.search(r"requires attunement(?: by ([^)]*))?", header, re.I)
    category = {"armor": "armor", "shield": "shield", "weapon": "weapon", "ammunition": "weapon"}.get(item_type, "other")
    entry = _item(page, page.title, category, to_markdown(rest), source, magic={
        "rarity": rarity,
        "type": item_type or clean(header.split(",")[0]).lower(),
        "subtype": clean(sub.group(1)) if sub and item_type else None,
        "attunement": bool(att),
        "attunementBy": clean(att.group(1)) if att and att.group(1) else None,
        "raw": header,
    })
    return entry, [] if rarity or "???" in header else [f"rarity not found in '{header}'"]


# -- equipment tables ----------------------------------------------------------------

def _context(table: Tag) -> str:
    """Caption/headings preceding a table (closest first)."""
    bits = []
    rows = table_rows(table)
    if rows and sum(1 for c in rows[0] if c) == 1:
        bits.append(rows[0][0])
    for prev in table.find_all_previous(["h1", "h2", "h3", "h4", "h5", "h6", "p"], limit=6):
        t = text_of(prev)
        if prev.name != "p" or (prev.find("strong") and len(t) < 60):
            bits.append(t)
    return " | ".join(bits).lower()


def _weapon(row: dict, ctx: str) -> dict:
    dmg = []
    for m in re.finditer(r"(\d+d\d+(?:\s*\+\s*\d+)?|\b1\b)\s*(\w+)", row.get("damage", "")):
        dmg.append({"dice": m.group(1).replace(" ", ""), "type": m.group(2).lower()})
    props_raw = row.get("properties", "")
    props = [clean(p) for p in re.split(r",\s*(?![^()]*\))", props_raw) if clean(p) and clean(p) != "-"]
    rng = re.search(r"range\s*(\d+/\d+)|(\d+/\d+)", props_raw, re.I)
    return {
        "kind": "martial" if "martial" in ctx else "simple" if "simple" in ctx else None,
        "ranged": bool("ranged" in ctx or "firearm" in ctx or re.search(r"ammunition", props_raw, re.I)),
        "damage": dmg,
        "properties": props,
        "range": (rng.group(1) or rng.group(2)) if rng else None,
        "mastery": row.get("mastery") if row.get("mastery") not in (None, "", "-") else None,
    }


def _armor(row: dict, ctx: str, name: str) -> tuple[str, dict]:
    ac_raw = row.get("armor class (ac)") or row.get("armor class") or row.get("ac") or ""
    if "shield" in name.lower() or "shield" in ctx.split("|")[0]:
        return "shield", {"kind": "shield", "baseAC": int(re.search(r"\d+", ac_raw).group()) if re.search(r"\d+", ac_raw) else 2,
                          "dexCap": None, "strength": None, "stealthDisadvantage": False}
    kind = "heavy" if "heavy" in ctx else "medium" if "medium" in ctx else "light"
    m = re.search(r"(\d+)", ac_raw)
    cap = re.search(r"max\s*(\d+)", ac_raw)
    add_dex = "dex" in ac_raw.lower()
    strength = re.search(r"(\d+)", row.get("strength", "") or "")
    return "armor", {
        "kind": kind,
        "baseAC": int(m.group(1)) if m else None,
        "dexCap": (int(cap.group(1)) if cap else None) if add_dex else 0,
        "strength": int(strength.group(1)) if strength else None,
        "stealthDisadvantage": "disadvantage" in (row.get("stealth", "") or "").lower(),
    }


def parse_equipment_page(page: Page, hint: str) -> tuple[list[dict], list[str]]:
    """hint: weapon | armor | gear | tool | mount | vehicle | trinket | poison | other."""
    source, blocks = split_source(page)
    out: list[dict] = []
    seen: set[str] = set()
    for table in page.content.find_all("table"):
        rows = table_rows(table, keep_breaks=True)
        if rows and sum(1 for c in rows[0] if c) == 1 and len(rows) > 1:
            rows = rows[1:]
        if len(rows) < 2:
            continue
        head = [clean(h).lower() for h in rows[0]]
        if not any(h in ("cost", "price", "weight", "damage", "armor class (ac)", "armor class") for h in head):
            continue
        if hint not in ("armor", "weapon") and any(h.startswith("armor class") for h in head):
            continue   # e.g. barding on the mounts page
        ctx = _context(table)
        for r in rows[1:]:
            if len(r) < 2 or not r[0] or r[0] in ("-", "—"):
                continue
            if not any(c for c in r[1:]):   # sub-caption row inside the table, e.g. "Martial Ranged Weapons"
                ctx = r[0].lower() + " | " + ctx
                continue
            name, _, inline_desc = r[0].partition("\n")   # 2014 gear: "Acid (vial)<br>* description"
            r = [name] + [c.replace("\n", " ") for c in r[1:]]
            row = dict(zip(head, r))
            inline_desc = clean(inline_desc.lstrip("* "))
            if slug(name) in seen:
                continue
            seen.add(slug(name))
            extra_cols = {h: v for h, v in row.items() if h not in (head[0], "cost", "price", "weight") and v not in ("", "-")}
            desc_col = next((h for h in ("function", "effect", "description", "utilize", "use") if h in row), None)
            extras: dict = {}
            category = hint
            if hint == "weapon" or "damage" in head:
                category = "weapon"
                extras["weapon"] = _weapon(row, ctx)
            elif hint == "armor" or "armor class (ac)" in head or "armor class" in head:
                category, extras["armor"] = _armor(row, ctx, name)
            if category == "gear" and re.search(r"tool|kit|supplies|instrument", name, re.I):
                category = "tool"
            desc = (row.get(desc_col, "") if desc_col else "") or inline_desc
            other = {h: v for h, v in extra_cols.items() if h != desc_col and category not in ("weapon", "armor", "shield")}
            if other:
                desc = (desc + "\n\n" + "\n".join(f"**{h.title()}:** {v}" for h, v in other.items())).strip()
            out.append(_item(page, name, category, desc, source,
                             cost=cost(row.get("cost") or row.get("price")), weight=weight(row.get("weight")), **extras))
    # Items described as sections ("### Thieves' Tools" + "Weight:/Cost:" lines), e.g. 2024 tools.
    for h in page.content.find_all(["h2", "h3", "h4", "h5", "h6"]):
        nodes = []
        for sib in h.find_next_siblings():
            if re.fullmatch(r"h[1-6]", sib.name or ""):
                break
            nodes.append(sib)
        md = to_markdown(nodes)
        f = labeled_fields(md)
        if "cost" in f and len(text_of(h)) < 60 and slug(text_of(h)) not in seen:
            name = re.sub(r"\s*\(.*?\)$", "", text_of(h))
            seen.add(slug(text_of(h)))
            cat = "tool" if hint in ("tool", "gear") else hint
            out.append(_item(page, name, cat, md, source, cost=cost(f.get("cost")), weight=weight(f.get("weight"))))
    return out, [] if out else ["no equipment rows"]


def parse_single_item(page: Page, category: str) -> tuple[dict | None, list[str]]:
    """A page describing one mundane item (e.g. 2014 poisons:*)."""
    source, blocks = split_source(page)
    md = to_markdown(blocks)
    if not md:
        return None, ["empty page"]
    f = labeled_fields(md)
    price = next((v for k, v in f.items() if "price" in k or "cost" in k), None)
    return _item(page, page.title, category, md, source, cost=cost(price), weight=weight(f.get("weight"))), []
