"""Checks the generated data/*.json. Exit code 1 when something is wrong.

python -m dndscraper.validate [--root REPO]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .pipeline import FILES

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
}
# Lower bounds that catch a broken parser or a wiki layout change.
MINIMUMS = {"class": 14, "subclass": 150, "spell": 500, "feat": 250, "species": 60, "background": 50,
            "item": 600, "option": 100}
MUST_EXIST = [("class", "blood-hunter"), ("class", "artificer"), ("class", "barbarian"),
              ("subclass", "blood-hunter/order-of-the-ghostslayer"), ("subclass", "blood-hunter/order-of-the-lycan"),
              ("subclass", "blood-hunter/order-of-the-mutant"), ("subclass", "blood-hunter/order-of-the-profane-soul"),
              ("spell", "fireball"), ("feat", "alert"), ("species", "elf"), ("background", "acolyte")]
# Must have been replaced by their 2024 version (the 2014 one must not survive).
MUST_BE_2024 = [("class", "barbarian"), ("spell", "fireball"), ("species", "elf"), ("feat", "alert"),
                ("subclass", "barbarian/path-of-the-zealot")]
EXCLUDED_URLS = ["fighter:gunslinger", "monk:cobalt-soul", "barbarian:juggernaut", "/mystic", "/hb:"]


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
    feat_ids = {e["id"] for e in data["feat"]}
    for e in data["feat"]:
        if e["edition"] == "2014" and e["category"] in ("general", "racial") and \
                (e.get("prerequisites") or {}).get("level") is None:
            errors.append(f"feat '{e['id']}': 2014 feat without the level 4 prerequisite")
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
