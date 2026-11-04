"""Checks the generated data/*.json. Exit code 1 when something is wrong.

python -m dndscraper.validate [--root REPO]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from .common import EXCLUDED_CLASSES
from .pipeline import FILES as WIKI_FILES

# data/monsters.json comes from the SRD 5.2 (dndscraper.monsters), not from the wikis.
FILES = {**WIKI_FILES, "monster": "monsters"}

ABILITIES = {"STR", "DEX", "CON", "INT", "WIS", "CHA"}
BASE = {"id": str, "type": str, "name": str, "edition": str, "description": str, "url": str}
FIELDS = {
    "class": {"hitDie": int, "primaryAbility": list, "savingThrows": list, "proficiencies": dict,
              "multiclass": dict, "subclassTitle": str, "subclassLevel": int, "subclassFeatureLevels": list,
              "progression": dict, "features": list},
    "subclass": {"classId": str, "shortName": str, "features": list},
    "option": {"group": str, "classId": (str, type(None))},
    "spell": {"level": int, "school": str, "ritual": bool, "castingTime": dict, "range": str,
              "components": dict, "duration": str, "concentration": bool, "classes": list},
    "feat": {"category": str, "repeatable": bool},
    "species": {"creatureType": str, "size": list, "speed": dict, "traits": list, "variants": list},
    "background": {"abilityScores": list, "skills": list, "equipment": str},
    "item": {"category": str},
    "rule": {"category": str},
    "monster": {"category": str, "size": list, "creatureType": str, "alignment": str, "ac": int, "hp": int,
                "hitDice": str, "speed": dict, "abilities": dict, "saves": dict, "skills": dict,
                "resistances": list, "immunities": list, "vulnerabilities": list, "conditionImmunities": list,
                "senses": dict, "passivePerception": int, "languages": str, "cr": (int, float), "xp": int,
                "proficiencyBonus": int, "traits": list, "actions": list, "bonusActions": list,
                "reactions": list, "legendaryActions": list, "legendary": bool, "spellcasting": bool},
}
CHALLENGE_RATINGS = {0, 0.125, 0.25, 0.5, *range(1, 31)}
# Lower bounds that catch a broken parser or a wiki layout change.
MINIMUMS = {"class": 14, "subclass": 150, "spell": 500, "feat": 250, "species": 60, "background": 50,
            "item": 600, "option": 80, "monster": 300}
MUST_EXIST = [("class", "blood-hunter"), ("class", "artificer"), ("class", "barbarian"),
              ("subclass", "blood-hunter/order-of-the-ghostslayer"), ("subclass", "blood-hunter/order-of-the-lycan"),
              ("subclass", "blood-hunter/order-of-the-mutant"), ("subclass", "blood-hunter/order-of-the-profane-soul"),
              ("spell", "fireball"), ("feat", "alert"), ("species", "elf"), ("background", "acolyte"),
              ("monster", "aboleth"), ("monster", "adult-red-dragon"), ("monster", "goblin-warrior")]
# Must have been replaced by their 2024 version (the 2014 one must not survive).
MUST_BE_2024 = [("class", "barbarian"), ("spell", "fireball"), ("species", "elf"), ("feat", "alert"),
                ("subclass", "barbarian/path-of-the-zealot")]
EXCLUDED_URLS = ["fighter:gunslinger", "monk:cobalt-soul", "barbarian:juggernaut", "/mystic", "/hb:",
                 "/ua:class-psion", "/ua:subclass-psion-",
                 # spells only on the Psion list (dropped because their only class is excluded)
                 "/ua:spell-ego-whip", "/ua:spell-life-siphon", "/ua:spell-mind-blast",
                 "/ua:spell-telekinetic-fling", "/ua:spell-thought-form"]
# Option groups that only exist for an excluded class.
EXCLUDED_GROUPS = {"psionic-discipline"}
_EXCLUDED_ID = re.compile(r"(^|/)(?:" + "|".join(EXCLUDED_CLASSES) + r")(/|$)")


def excluded_class_errors(where: str, e: dict) -> list[str]:
    """Anything that belongs to an excluded class (Mystic, Psion) must not be in the output."""
    errors = []
    if _EXCLUDED_ID.search(e.get("id") or ""):
        errors.append(f"{where}: id names an excluded class")
    if e.get("classId") in EXCLUDED_CLASSES:
        errors.append(f"{where}: belongs to excluded class '{e['classId']}'")
    if e.get("type") == "option" and e.get("group") in EXCLUDED_GROUPS:
        errors.append(f"{where}: excluded option group '{e['group']}'")
    if e.get("type") == "spell" and set(e.get("classes") or []) & set(EXCLUDED_CLASSES):
        errors.append(f"{where}: excluded class in the spell's class list {e['classes']}")
    return errors


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    data: dict[str, list[dict]] = {}
    for t, f in FILES.items():
        path = root / "data" / f"{f}.json"
        try:
            data[t] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            errors.append(f"{path}: {e}")
            data[t] = []

    for t, rows in data.items():
        ids = set()
        for e in rows:
            where = f"{FILES[t]}.json[{e.get('id')}]"
            for k, typ in {**BASE, **FIELDS[t]}.items():
                if not isinstance(e.get(k), typ):
                    errors.append(f"{where}: field '{k}' missing or not {typ}")
            if e.get("type") != t:
                errors.append(f"{where}: type '{e.get('type')}' != '{t}'")
            if e.get("edition") not in ("2014", "2024"):
                errors.append(f"{where}: bad edition {e.get('edition')}")
            if e.get("id") in ids:
                errors.append(f"{where}: duplicate id")
            ids.add(e.get("id"))
            if any(x in e.get("url", "") for x in EXCLUDED_URLS):
                errors.append(f"{where}: excluded page made it into the data ({e['url']})")
            errors.extend(excluded_class_errors(where, e))
        if len(rows) < MINIMUMS.get(t, 0):
            errors.append(f"{FILES[t]}.json: only {len(rows)} entries (expected ≥ {MINIMUMS[t]})")

    index = {(t, e["id"]): e for t, rows in data.items() for e in rows if "id" in e}
    for t, i in MUST_EXIST:
        if (t, i) not in index:
            errors.append(f"missing {t} '{i}'")
    for t, i in MUST_BE_2024:
        if (t, i) in index and index[(t, i)]["edition"] != "2024":
            errors.append(f"{t} '{i}' should be the 2024 version")

    class_ids = {e["id"] for e in data["class"]}
    for e in data["subclass"]:
        if e["classId"] not in class_ids:
            errors.append(f"subclass '{e['id']}': unknown class '{e['classId']}'")
        if any(not isinstance(f.get("level"), int) or not 1 <= f["level"] <= 20 for f in e["features"]):
            errors.append(f"subclass '{e['id']}': feature without a valid level")
    for e in data["class"]:
        if len(e["progression"].get("rows", [])) != 20:
            errors.append(f"class '{e['id']}': progression doesn't have 20 levels")
        if not set(e["savingThrows"]) <= ABILITIES or len(e["savingThrows"]) != 2:
            errors.append(f"class '{e['id']}': bad saving throws {e['savingThrows']}")
        gains = e["multiclass"].get("gains")
        if not isinstance(gains, dict) or gains.get("origin") not in ("text", "table", "estimate"):
            errors.append(f"class '{e['id']}': no multiclass gains")
        if e.get("spellcasting") and e["spellcasting"].get("ability") not in ABILITIES:
            errors.append(f"class '{e['id']}': spellcasting without a spellcasting ability")
    for e in data["subclass"]:
        sc = e.get("spellcasting")
        if sc and (sc.get("ability") not in ABILITIES or len(sc.get("slotsByLevel", [])) != 20):
            errors.append(f"subclass '{e['id']}': incomplete spellcasting")
    for e in data["spell"]:
        if not 0 <= e["level"] <= 9:
            errors.append(f"spell '{e['id']}': bad level {e['level']}")
    for e in data["species"]:
        if e["edition"] == "2014" and "abilityScores" in e:
            errors.append(f"species '{e['id']}': 2014 ability score increase survived")
    for e in data["background"]:
        if e["edition"] != "2024":
            errors.append(f"background '{e['id']}': only 2024 backgrounds are kept")
        if len(e["abilityScores"]) != 3:
            errors.append(f"background '{e['id']}': expected 3 ability scores")
    for e in data["monster"]:
        if e["cr"] not in CHALLENGE_RATINGS:
            errors.append(f"monster '{e['id']}': bad challenge rating {e['cr']}")
        if set(e["abilities"]) != ABILITIES or not set(e["saves"]) <= ABILITIES:
            errors.append(f"monster '{e['id']}': bad ability scores or saving throws")
        parts = ("traits", "actions", "bonusActions", "reactions", "legendaryActions")
        # the Giant Fly (a mount of the Figurines of Wondrous Power) has nothing but its stats
        if not any(e[k] for k in parts) and e["id"] != "giant-fly":
            errors.append(f"monster '{e['id']}': no traits nor actions")
        if any(not a.get("name") or not a.get("description") for k in parts for a in e[k]):
            errors.append(f"monster '{e['id']}': trait or action without a name or text")
    item_ids = {e["id"] for e in data["item"]}
    plans = [e for e in data["option"] if e.get("group") == "magic-item-plan"]
    if not any(e.get("itemId") for e in plans) or not any(e.get("itemPick") for e in plans):
        errors.append("artificer magic item plans missing (python -m dndscraper.plans)")
    for e in plans:   # every plan is a real compendium item, or a kind of item to pick
        where = f"options.json[{e['id']}]"
        if e.get("classId") != "artificer" or not isinstance(e.get("prerequisites", {}).get("level"), int):
            errors.append(f"{where}: plan without class or level")
        if bool(e.get("itemId")) == bool(e.get("itemPick")):
            errors.append(f"{where}: needs exactly one of itemId / itemPick")
        elif e.get("itemId") and e["itemId"] not in item_ids:
            errors.append(f"{where}: unknown item '{e['itemId']}'")
        if e.get("attunement") not in (True, False, None):
            errors.append(f"{where}: bad attunement {e.get('attunement')!r}")
    feat_ids = {e["id"] for e in data["feat"]}
    for e in data["feat"]:
        if e["edition"] == "2014" and e["category"] in ("general", "racial") and \
                (e.get("prerequisites") or {}).get("level") is None:
            errors.append(f"feat '{e['id']}': 2014 feat without the level 4 prerequisite")
    # The translated copy must not bring excluded content back either.
    for t, f in FILES.items():
        path = root / "data" / "es" / f"{f}.json"
        if path.exists():
            try:
                rows = json.loads(path.read_text(encoding="utf-8"))
            except ValueError as e:
                errors.append(f"{path}: {e}")
                continue
            for e in rows:
                if any(x in e.get("url", "") for x in EXCLUDED_URLS):
                    errors.append(f"es/{f}.json[{e.get('id')}]: excluded page made it into the data ({e['url']})")
                errors.extend(excluded_class_errors(f"es/{f}.json[{e.get('id')}]", e))
    missing_feats = sorted({e["featId"] for e in data["background"] if e.get("featId") and e["featId"] not in feat_ids})
    if len(missing_feats) > 5:
        errors.append(f"backgrounds reference unknown feats: {missing_feats}")
    return errors


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3])
    errors = validate(ap.parse_args().root)
    for e in errors[:200]:
        print("ERROR", e)
    print(f"{len(errors)} error(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
