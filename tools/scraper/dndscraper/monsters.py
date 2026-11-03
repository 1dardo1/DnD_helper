"""Monsters: the creatures of the SRD 5.2 (the free part of the 2024 Monster Manual, CC-BY-4.0).

    python -m dndscraper.monsters [--offline]

The wikis have no monsters, so they come from two public APIs that publish the SRD 5.2:
- Open5e (https://api.open5e.com/v2/creatures/?document__key=srd-2024): the list (331 creatures,
  one entry per shapechanger) and most fields: traits and actions with their full text (spell
  lists included), speeds, senses, initiative, immunities...
- the D&D 5e API (https://www.dnd5eapi.co/api/2024/monsters): what Open5e gets wrong or lacks,
  for the creatures it also has: sizes ("Medium or Small", Tiny), alignment, proficient saving
  throws, XP of CR 0 creatures and in a lair, armor and gear.

Both answers are cached in tools/scraper/.cache/monsters/, so --offline works. Writes
data/monsters.json and the monster count in data/meta.json.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import requests

from .html import slug

OPEN5E = "https://api.open5e.com/v2/creatures/?document__key=srd-2024&limit=100"
DND5EAPI = "https://www.dnd5eapi.co/api/2024/monsters"
PAGE_URL = "https://open5e.com/monsters/{key}"
SOURCE = "SRD 5.2"
CREDIT = ("This work includes material from the System Reference Document 5.2 (\"SRD 5.2\") by Wizards of "
          "the Coast LLC, available at https://www.dndbeyond.com/srd, licensed under the Creative Commons "
          "Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/legalcode).")
UA = {"User-Agent": "DnD-helper-scraper (personal project)"}
ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
CODES = {a: a[:3].upper() for a in ABILITIES}
SENSES = ["blindsight", "darkvision", "tremorsense", "truesight"]
PARTS = [("traits", "Traits"), ("actions", "Actions"), ("bonusActions", "Bonus Actions"),
         ("reactions", "Reactions"), ("legendaryActions", "Legendary Actions")]
ACTION_TYPES = {"ACTION": "actions", "BONUS_ACTION": "bonusActions", "REACTION": "reactions",
                "LEGENDARY_ACTION": "legendaryActions"}
# Section titles of the description (data/monsters.json is in English; translate.py rebuilds it).
LABELS = {
    "en": {"traits": "Traits", "actions": "Actions", "bonusActions": "Bonus Actions",
           "reactions": "Reactions", "legendaryActions": "Legendary Actions",
           "uses": "Legendary Action Uses: {uses}.", "inLair": "{uses} ({lair} in Lair)",
           "legendary": "Immediately after another creature's turn, it can expend a use to take one of "
                        "the following actions. It regains all expended uses at the start of each of its turns."},
    "es": {"traits": "Rasgos", "actions": "Acciones", "bonusActions": "Acciones adicionales",
           "reactions": "Reacciones", "legendaryActions": "Acciones legendarias",
           "uses": "Usos de acciones legendarias: {uses}.", "inLair": "{uses} ({lair} en su guarida)",
           "legendary": "Justo después del turno de otra criatura, puede gastar un uso para realizar una de "
                        "las siguientes acciones. Recupera todos los usos gastados al comienzo de cada uno "
                        "de sus turnos."},
}


# -- download --------------------------------------------------------------------------------------

def _get_json(session: requests.Session, url: str):
    r = session.get(url, headers=UA, timeout=60)
    r.raise_for_status()
    return r.json()


def download(cache: Path, offline: bool) -> tuple[list[dict], list[dict]]:
    """(Open5e creatures, D&D 5e API monsters), from the cache when offline or when a source fails."""
    cache.mkdir(parents=True, exist_ok=True)
    o_path, d_path = cache / "open5e.json", cache / "dnd5eapi.json"
    if not offline:
        s = requests.Session()
        try:
            url, rows = OPEN5E, []
            while url:
                page = _get_json(s, url)
                rows += page["results"]
                url = page.get("next")
            o_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        except (requests.RequestException, ValueError, KeyError) as e:
            print(f"Open5e: {e.__class__.__name__}; uso la caché")
        try:
            index = _get_json(s, DND5EAPI)["results"]
            rows = [_get_json(s, "https://www.dnd5eapi.co" + m["url"]) for m in index]
            d_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        except (requests.RequestException, ValueError, KeyError) as e:
            print(f"D&D 5e API: {e.__class__.__name__}; uso la caché")
    if not o_path.exists():
        raise SystemExit(f"No monster data: {o_path} is missing (run without --offline once)")
    other = json.loads(d_path.read_text(encoding="utf-8")) if d_path.exists() else []
    return json.loads(o_path.read_text(encoding="utf-8")), other


# -- conversion ------------------------------------------------------------------------------------

def _plain(name: str) -> str:
    return name.replace("’", "'").strip()


def proficiency_bonus(cr: float) -> int:
    return 2 + max(0, (int(max(cr, 1)) - 1) // 4)


# "Melee Attack Roll: +9, reach 15 ft. 12 (2d6 + 5) ..." → "... reach 15 ft. Hit: 12 (2d6 + 5) ..."
# (Open5e drops the "Hit:" the SRD has before the damage).
_HIT = re.compile(r"(Attack Roll: [^\n]*?(?:reach|range) [\d/]+ ft\.(?: or range [\d/]+ ft\.)?) (?=\d)")


def fix_text(text: str) -> str:
    text = _HIT.sub(r"\1 Hit: ", text or "")
    return text.replace("’", "'").strip()


def _usage(a: dict) -> str | None:
    u = a.get("usage_limits") or {}
    p = u.get("param")
    if u.get("type") in ("RECHARGE_ON_ROLL", "RECHARGE") and p:
        return "Recharge 6" if p == 6 else f"Recharge {p}–6"
    if u.get("type") == "PER_DAY" and p:
        return f"{p}/Day"
    return None


def action_name(a: dict) -> str:
    name = _plain(a["name"])
    name = re.sub(r"(\d)-(\d)", r"\1–\2", name)
    # "Fire Breath (Recharge 5–6)", "Bite (Wolf or Hybrid Form Only)", "Charm (Recharge 5–6; ...)"
    extra = [x for x in (_usage(a), a.get("limited_to_form")) if x and x.lower() not in name.lower()]
    if extra:
        name = name[:-1] + f"; {'; '.join(extra)})" if name.endswith(")") else f"{name} ({'; '.join(extra)})"
    cost = a.get("legendary_action_cost") or 1
    if a.get("action_type") == "LEGENDARY_ACTION" and cost > 1:
        name += f" (Costs {cost} Actions)"
    return name


def _sizes(o: dict, d: dict | None) -> list[str]:
    # Open5e says "Small" for "Medium or Small" creatures; shapechangers (one form matched) are both
    if d and ", " in d["name"] and o["size"]["key"] == "small":
        return ["Medium", "Small"]
    raw = d["size"] if d else o["size"]["name"]
    return [s.strip().capitalize() for s in re.split(r"\s+or\s+", raw)]


def _speed(o: dict) -> dict:
    sp = o.get("speed") or {}
    out = {k: int(sp[k]) for k in ("walk", "burrow", "climb", "fly", "swim") if sp.get(k)}
    out.setdefault("walk", 0)
    if (o.get("speed_all") or {}).get("hover") and out.get("fly"):
        out["hover"] = True
    return out


def _saves(o: dict, d: dict | None) -> dict:
    if d:
        prof = [p for p in d.get("proficiencies", []) if p["proficiency"]["index"].startswith("saving-throw-")]
        return {p["proficiency"]["index"][-3:].upper(): p["value"] for p in prof}
    return {CODES[a]: v for a, v in o["saving_throws"].items() if v != o["modifiers"][a]}


def describe(m: dict, lang: str = "en") -> str:
    """Markdown with the traits and actions, for the views that only show the text of an entry."""
    L = LABELS[lang]
    out = []
    for key, _ in PARTS:
        items = m.get(key) or []
        if not items:
            continue
        out.append(f"### {L[key]}")
        if key == "legendaryActions" and m.get("legendaryActionUses"):
            u = m["legendaryActionUses"]
            uses = L["inLair"].format(uses=u["uses"], lair=u["inLair"]) if u.get("inLair") else u["uses"]
            out.append(f"*{L['uses'].format(uses=uses)} {L['legendary']}*")
        for it in items:
            out.append(f"**{it['name']}.** {it['description']}")
    return "\n\n".join(out)


def convert(o: dict, d: dict | None) -> dict:
    parts: dict[str, list] = {k: [] for k, _ in PARTS}
    parts["traits"] = [{"name": _plain(t["name"]), "description": fix_text(t["desc"])} for t in o.get("traits", [])]
    for a in sorted(o.get("actions", []), key=lambda a: a.get("order_in_statblock") or 0):
        parts[ACTION_TYPES[a["action_type"]]].append({"name": action_name(a), "description": fix_text(a["desc"])})
    cr = float(o["challenge_rating"])
    cr = int(cr) if cr >= 1 else cr
    legendary = parts["legendaryActions"]
    lair = any("in lair" in t["name"].lower() for t in parts["traits"]) or bool(d and d.get("xp_in_lair"))
    texts = [x for k, _ in PARTS for x in parts[k]]
    ri = o.get("resistances_and_immunities") or {}
    keys = lambda field: sorted(x["key"] for x in ri.get(field) or [])  # noqa: E731
    armor = [a["name"] for a in (d["armor_class"][0].get("armor") or [])] if d and d.get("armor_class") else []
    name = _plain(o["name"])
    entry = {
        "id": slug(name),
        "type": "monster",
        "name": name,
        "edition": "2024",
        "source": SOURCE,
        "description": "",
        "url": PAGE_URL.format(key=o["key"]),
        "category": "animal" if o.get("category") in ("Animals", "Beast") else "monster",
        "size": _sizes(o, d),
        "creatureType": o["type"]["key"],
        "tags": ["swarm"] if name.startswith("Swarm of") else [],
        "alignment": (d or o)["alignment"].lower(),
        "ac": o["armor_class"],
        "armor": armor,
        "hp": o["hit_points"],
        "hitDice": re.sub(r"\s+", " ", o.get("hit_dice") or ""),
        "speed": _speed(o),
        "initiative": o.get("initiative_bonus"),
        "abilities": {CODES[a]: o["ability_scores"][a] for a in ABILITIES},
        "saves": _saves(o, d),
        "skills": {k.replace("_", "-"): v for k, v in (o.get("skill_bonuses") or {}).items()},
        "vulnerabilities": keys("damage_vulnerabilities"),
        "resistances": keys("damage_resistances"),
        "immunities": keys("damage_immunities"),
        "conditionImmunities": keys("condition_immunities"),
        "senses": {s: o[f"{s}_range"] for s in SENSES if o.get(f"{s}_range")},
        "passivePerception": o.get("passive_perception"),
        "languages": (o.get("languages") or {}).get("as_string") or "",
        "cr": cr,
        "xp": d["xp"] if d and cr == 0 else o["experience_points"],
        "xpInLair": (d or {}).get("xp_in_lair"),
        "proficiencyBonus": proficiency_bonus(cr),
        "gear": [g.strip() for g in (d or {}).get("gear", "").split(",") if g.strip()] if d else [],
        **parts,
        "legendaryActionUses": ({"uses": 3, "inLair": 4 if lair else None} if legendary else None),
        "legendary": bool(legendary),
        "spellcasting": any(x["name"].startswith("Spellcasting") or "spellcasting ability" in x["description"]
                            for x in texts),
    }
    entry["description"] = describe(entry)
    return entry


def _match(o: dict, others: dict[str, dict]) -> dict | None:
    name = _plain(o["name"])
    if name in others:
        return others[name]
    # shapechangers: the D&D 5e API has one entry per form ("Werewolf, Human Form")
    forms = sorted(k for k in others if k.startswith(name + ", "))
    return others[forms[0]] if forms else None


def build(open5e: list[dict], dnd5eapi: list[dict]) -> list[dict]:
    others = {_plain(m["name"]): m for m in dnd5eapi}
    rows = [convert(o, _match(o, others)) for o in open5e]
    ids = Counter(r["id"] for r in rows)
    dup = [i for i, n in ids.items() if n > 1]
    if dup:
        raise SystemExit(f"duplicate monster ids: {dup}")
    return sorted(rows, key=lambda r: r["id"])


def run(root: Path, offline: bool = False) -> int:
    """Writes data/monsters.json and its count in data/meta.json; returns the count."""
    open5e, dnd5eapi = download(root / "tools/scraper/.cache/monsters", offline)
    rows = build(open5e, dnd5eapi)
    (root / "data" / "monsters.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
                                                 encoding="utf-8")
    meta_path = root / "data" / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta.setdefault("sources", {})["monsters"] = "https://api.open5e.com (SRD 5.2, CC-BY-4.0)"
        meta.setdefault("counts", {})["monster"] = len(rows)
        meta.setdefault("byEdition", {})["monster"] = {"2024": len(rows)}
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(rows)} monsters → data/monsters.json")
    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="use only the cache, download nothing")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3])
    args = ap.parse_args()
    run(args.root, offline=args.offline)


if __name__ == "__main__":
    main()
