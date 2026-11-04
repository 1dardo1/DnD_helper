"""Artificer magic item plans (Replicate Magic Item, 2024) as class options.

python -m dndscraper.plans   updates data/options.json (and the counts in data/meta.json) in place,
                             from data/classes.json + data/items.json. No network.

The artificer's "Replicate Magical Item" feature lists, in tables per Artificer level (2+, 6+, 10+,
14+), the magic items whose plans can be learned. Each row becomes an option of the group
`magic-item-plan` that points at the compendium item (`itemId`), with the item's description and the
Attunement column (`attunement`: true / false / null when it varies). Three rows are not an item but
a kind of item that can be learned several times, each time a different one (Common magic item,
Uncommon / Rare Wondrous Item): they carry `itemPick` instead of `itemId`, and the app lets the
player pick the item from the compendium. The pipeline calls add_plans() after merging and pruning;
running it again replaces the previous plans, so it is idempotent.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

GROUP = "magic-item-plan"
CLASS_ID = "artificer"

# Table rows whose name is not an item name in the compendium: the generic "+1, +2 or +3" entries
# and spellings that differ.
ITEM_ALIASES = {
    "Armor +1": "armor-1-2-or-3",
    "Armor +2": "armor-1-2-or-3",
    "Shield +1": "shield-1-2-or-3",
    "Shield +2": "shield-1-2-or-3",
    "Weapon +1": "weapon-1-2-or-3",
    "Weapon +2": "weapon-1-2-or-3",
    "Wand of the War Mage +1": "wand-of-the-war-mage-1-2-or-3",
    "Wand of the War Mage +2": "wand-of-the-war-mage-1-2-or-3",
    "Wraps of Unarmed Power +1": "wraps-of-unarmed-power",
    "Wraps of Unarmed Power +2": "wraps-of-unarmed-power",
    "Necklace of Adaption": "necklace-of-adaptation",
    "Radiant Weapon": "radiant-weapon-ua",
}

# Rows that stand for a kind of item: (start of the row, id, name, rarity, wondrous only).
PICK_ROWS = [
    ("Common magic item", "common-magic-item", "Common Magic Item", "common", False),
    ("Uncommon Wondrous Item", "uncommon-wondrous-item", "Uncommon Wondrous Item", "uncommon", True),
    ("Rare Wondrous Item", "rare-wondrous-item", "Rare Wondrous Item", "rare", True),
]

HEADING = re.compile(r"^#+\s*Magic Item Plans \(Artificer Level (\d+)\+\)", re.I)
ROW = re.compile(r"^\|\s*(.+?)\s*\|\s*(Yes|No|Varies)\s*\|\s*$")


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_tables(cls: dict) -> list[tuple[int, str, str]]:
    """(level, row name, attunement) for every plan row of the class feature."""
    feature = next((f for f in cls["features"] if "Magic Item Plans" in f["description"]), None)
    if not feature:
        return []
    rows, level = [], 0
    for line in feature["description"].splitlines():
        h = HEADING.match(line.strip())
        if h:
            level = int(h.group(1))
            continue
        m = ROW.match(line.strip())
        if m and level and m.group(1) not in ("Magic Item Plan",):
            rows.append((level, m.group(1), m.group(2)))
    return rows


def build_plans(classes: list[dict], items: list[dict]) -> tuple[list[dict], list[str]]:
    """The plan options and the problems found (a row without its item)."""
    cls = next((c for c in classes if c["id"] == CLASS_ID and c["edition"] == "2024"), None)
    if not cls:
        return [], []
    by_id = {i["id"]: i for i in items}
    by_name: dict[str, list[dict]] = {}
    for i in items:
        by_name.setdefault(i["name"].lower(), []).append(i)
    problems: list[str] = []
    out: list[dict] = []
    seen: set[str] = set()
    for level, row, attunement in parse_tables(cls):
        base = {
            "type": "option",
            "edition": "2024",
            "source": cls["source"],
            "url": cls["url"],
            "group": GROUP,
            "classId": CLASS_ID,
            "subclassId": None,
            "prerequisites": {"raw": f"Level {level}+ Artificer", "level": level},
            "attunement": {"Yes": True, "No": False}.get(attunement),
        }
        pick = next((p for p in PICK_ROWS if row.lower().startswith(p[0].lower())), None)
        if pick:
            _, pid, name, rarity, wondrous = pick
            kind = f"{rarity} {'wondrous item' if wondrous else 'magic item'}"
            cursed = "isn't a Potion, a Scroll, or cursed" if not wondrous else "isn't cursed"
            out.append({
                **base, "id": f"{GROUP}/{pid}", "name": name,
                "description": (f"Choose a {kind} that {cursed}. You can learn this option "
                                f"multiple times, but you must select a different item each time. "
                                f"Each item selected counts as a different plan."),
                "itemPick": {"rarity": rarity, "wondrous": wondrous},
            })
            continue
        item_id = ITEM_ALIASES.get(row)
        if not item_id:
            found = by_name.get(row.lower(), [])
            found = sorted(found, key=lambda i: i["edition"] != "2024")
            item_id = found[0]["id"] if found else None
        item = by_id.get(item_id or "")
        if not item:
            problems.append(f"plan '{row}': no item in items.json")
            continue
        pid = slug(row.replace("+", "plus "))
        if pid in seen:
            problems.append(f"plan '{row}': duplicate id")
            continue
        seen.add(pid)
        out.append({
            **base, "id": f"{GROUP}/{pid}", "name": row,
            "description": item["description"], "itemId": item["id"],
        })
    return out, problems


def add_plans(entries: list[dict], report=None) -> list[dict]:
    """Pipeline step: entries without plan options → entries with the current ones."""
    plans, problems = build_plans([e for e in entries if e["type"] == "class"],
                                  [e for e in entries if e["type"] == "item"])
    if report is not None:
        for p in problems:
            report.warn("artificer plans", [p])
    kept = [e for e in entries if not (e["type"] == "option" and e.get("group") == GROUP)]
    return kept + plans


def update_files(root: Path) -> dict:
    """Offline: rewrite the plan options of data/options.json and the option counts of meta.json."""
    data = root / "data"
    read = lambda n: json.loads((data / f"{n}.json").read_text(encoding="utf-8"))
    plans, problems = build_plans(read("classes"), read("items"))
    if problems:
        raise SystemExit("\n".join(problems))
    options = [o for o in read("options") if o.get("group") != GROUP] + plans
    options.sort(key=lambda o: o["id"])
    (data / "options.json").write_text(
        json.dumps(options, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta = read("meta")
    meta["counts"]["option"] = len(options)
    by_edition: dict[str, int] = {}
    for o in options:
        by_edition[o["edition"]] = by_edition.get(o["edition"], 0) + 1
    meta["byEdition"]["option"] = by_edition
    (data / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"plans": len(plans), "options": len(options)}


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[3]
    print(update_files(root))
    if "--no-translate" not in sys.argv:
        print("now run: python3 -m dndscraper.translate --offline")
