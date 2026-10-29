"""Classes, subclasses and class options (invocations, metamagic, blood curses...)."""

from __future__ import annotations

import re

from bs4 import Tag

from .common import ABILITIES, SKILLS, abilities_in, base_entry, number, skills_in, split_source
from .feats import parse_prerequisites
from .html import Page, clean, labeled_fields, slug, table_rows, tabs, text_of, to_markdown, top_blocks

# 2014 names of the subclass choice feature, per class.
SUBCLASS_TITLES_2014 = {
    "artificer": "Artificer Specialist", "barbarian": "Primal Path", "bard": "Bard College",
    "blood-hunter": "Blood Hunter Order", "cleric": "Divine Domain", "druid": "Druid Circle",
    "fighter": "Martial Archetype", "monk": "Monastic Tradition", "paladin": "Sacred Oath",
    "ranger": "Ranger Archetype", "rogue": "Roguish Archetype", "sorcerer": "Sorcerous Origin",
    "warlock": "Otherworldly Patron", "wizard": "Arcane Tradition",
}
_SLOT_COLS = {"1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6, "7th": 7, "8th": 8, "9th": 9}
_LEVEL_HEADING = re.compile(r"^Level\s+(\d+)\s*:\s*(.+)$", re.I)
_PROSE_LEVEL = re.compile(
    r"(?:\bat|starting at|beginning at|when you (?:choose|select|adopt|join|take|reach)[^.]{0,60}?at|\bby|"
    r"upon reaching|once you reach|when you reach|\bfrom)\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)[- ]level"
    r"|^\W*(\d+)(?:st|nd|rd|th)[- ]level\b", re.I)


def _hlevel(el) -> int | None:
    if isinstance(el, Tag) and re.fullmatch(r"h[1-6]", el.name or ""):
        return int(el.name[1])
    return None


def _split_cells(s: str) -> list[str]:
    """Split 'A, B (1, 2), C' on commas outside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [clean(x) for x in out if clean(x) and clean(x) not in ("-", "—")]


def _all_tables(blocks: list) -> list[Tag]:
    out = []
    for el in blocks:
        if isinstance(el, Tag):
            out.extend([el] if el.name == "table" else el.find_all("table"))
    return out


# -- progression ---------------------------------------------------------------------

def parse_progression(blocks: list) -> dict | None:
    rows_by_level: dict[int, dict] = {}
    columns: list[str] = []
    for table in _all_tables(blocks):
        rows = table_rows(table)
        while rows and not re.match(r"^level$", rows[0][0].strip(), re.I):
            rows = rows[1:]
        if len(rows) < 21:
            continue
        head = rows[0]
        for r in rows[1:]:
            lv = number(r[0])
            if not lv or not 1 <= lv <= 20:
                continue
            row = rows_by_level.setdefault(lv, {"level": lv, "proficiencyBonus": None, "features": [], "values": {}})
            for h, c in zip(head[1:], r[1:]):
                hl = h.lower()
                if "proficiency" in hl:
                    row["proficiencyBonus"] = number(c)
                elif "feature" in hl:
                    row["features"] = _split_cells(c)
                else:
                    row["values"][h] = c
                    if h not in columns:
                        columns.append(h)
    if len(rows_by_level) < 20:
        return None
    return {"columns": columns, "rows": [rows_by_level[i] for i in range(1, 21)]}


def parse_spellcasting(progression: dict | None, features: list[dict]) -> dict | None:
    if not progression:
        return None
    cols = progression["columns"]
    rows = progression["rows"]
    slot_cols = {c: _SLOT_COLS[c.lower()] for c in cols if c.lower() in _SLOT_COLS}
    pact_slots = next((c for c in cols if re.fullmatch(r"spell slots", c, re.I)), None)
    pact_level = next((c for c in cols if re.fullmatch(r"slot level", c, re.I)), None)
    if not slot_cols and not (pact_slots and pact_level):
        return None
    spell_feat = next((f for f in features if re.search(r"spellcasting|pact magic", f["name"], re.I)), None)
    ability = None
    if spell_feat:
        m = re.search(r"(\w+) is (?:your|the) spellcasting ability", spell_feat["description"], re.I)
        if m and m.group(1).lower() in ABILITIES:
            ability = ABILITIES[m.group(1).lower()]
    slots = []
    for r in rows:
        lvl = [0] * 9
        if slot_cols:
            for c, i in slot_cols.items():
                lvl[i - 1] = number(r["values"].get(c)) or 0
        else:
            n, sl = number(r["values"].get(pact_slots)), number(r["values"].get(pact_level))
            if n and sl:
                lvl[sl - 1] = n
        slots.append(lvl)
    top = max((i + 1 for i, v in enumerate(slots[19]) if v), default=0)
    kind = "pact" if not slot_cols else {9: "full", 5: "half", 4: "third"}.get(top, "other")
    cantrip_col = next((c for c in cols if "cantrip" in c.lower()), None)
    prep_col = next((c for c in cols if re.search(r"prepared|spells known", c, re.I)), None)
    preparation = "known" if prep_col and "known" in prep_col.lower() else "prepared"
    if not prep_col and spell_feat and re.search(r"spells known", spell_feat["description"], re.I):
        preparation = "known"
    return {
        "ability": ability,
        "kind": kind,
        "preparation": preparation,
        "cantripsByLevel": [number(r["values"].get(cantrip_col)) or 0 for r in rows] if cantrip_col else None,
        "preparedByLevel": [number(r["values"].get(prep_col)) or 0 for r in rows] if prep_col else None,
        "slotsByLevel": slots,
    }


# -- features ------------------------------------------------------------------------

def _feature_sections(blocks: list, heading_level: int) -> list[tuple[str, list]]:
    """(heading text, nodes) for each heading of exactly heading_level; deeper headings stay inside."""
    out: list[tuple[str, list]] = []
    cur = None
    for el in blocks:
        lv = _hlevel(el)
        if lv is not None and lv <= heading_level:
            cur = None
            if lv == heading_level:
                cur = (text_of(el), [])
                out.append(cur)
            continue
        if cur is not None:
            cur[1].append(el)
    return out


def _level_from_table(name: str, progression: dict | None) -> int | None:
    if not progression:
        return None
    key = slug(re.sub(r"\(.*?\)", "", name))
    for r in progression["rows"]:
        for f in r["features"]:
            if slug(re.sub(r"\(.*?\)", "", f)) == key:
                return r["level"]
    return None


def _prose_level(md: str, head_only: bool = False) -> int | None:
    """Level stated in a feature's prose ("Starting at 6th level", "*3rd-Level ... Feature*").
    head_only looks only at the opening words, where subclass features state their own level."""
    m = _PROSE_LEVEL.search(md[:220] if head_only else md)
    return int(m.group(1) or m.group(2)) if m else None


def _feature(name: str, nodes: list, level: int | None) -> dict:
    optional = bool(re.search(r"\(optional\)", name, re.I))
    name = clean(re.sub(r"\(optional\)", "", name, flags=re.I)).rstrip(".")
    f = {"name": name, "level": level, "description": to_markdown(nodes)}
    if optional:
        f["optional"] = True
    return f


def _features_2024(blocks: list) -> list[dict]:
    feats = []
    for title, nodes in _feature_sections(blocks, 3):
        m = _LEVEL_HEADING.match(title)
        if m:
            feats.append(_feature(m.group(2), nodes, int(m.group(1))))
        elif feats:   # e.g. "### Life Domain Spells" table heading: belongs to the previous feature
            feats[-1]["description"] += f"\n\n### {title}\n\n" + to_markdown(nodes)
    return feats


# -- classes -------------------------------------------------------------------------

def _skill_choice(raw: str) -> dict:
    low = raw.lower()
    m = re.search(r"choose (?:any )?(\d|one|two|three|four)", low)
    n = {"one": 1, "two": 2, "three": 3, "four": 4}.get(m.group(1), None) if m else None
    n = n or (number(m.group(1)) if m else 0)
    frm = SKILLS if re.search(r"choose any|any (?:\w+ )?skills", low) else skills_in(raw)
    return {"choose": n or 0, "from": frm}


def _list(raw: str | None) -> list[str]:
    if not raw or raw.strip().lower() in ("none", "-"):
        return []
    if re.search(r"\bthat\b|\bchoose\b", raw, re.I):
        return [clean(raw)]
    parts = re.split(r",\s*(?:and\s+)?|\s+and\s+", raw)
    return [clean(p) for p in parts if clean(p)]


def parse_class(page: Page, class_id: str) -> tuple[dict | None, list[str]]:
    warnings: list[str] = []
    source, blocks = split_source(page)
    progression = parse_progression(blocks)
    if not progression:
        return None, ["no 20-level progression table"]

    if page.edition == "2024":
        core = {}
        for table in _all_tables(blocks):
            rows = table_rows(table)
            if rows and re.search(r"core .* traits", rows[0][0], re.I):
                core = {clean(r[0]).lower(): r[1] for r in rows[1:] if len(r) > 1}
                break
        if not core:
            warnings.append("no core traits table")
        features = _features_2024(blocks)
        primary_raw = core.get("primary ability", "")
        primary = abilities_in(primary_raw)
        saves = abilities_in(core.get("saving throw proficiencies", ""))
        prof = {
            "armor": _list(re.sub(r"(?i)training", "", core.get("armor training", ""))),
            "weapons": _list(core.get("weapon proficiencies", "")),
            "tools": _list(core.get("tool proficiencies", "")),
            "skills": _skill_choice(core.get("skill proficiencies", "")),
        }
        equipment = core.get("starting equipment", "")
        hit_die = number(core.get("hit point die", "").lower().replace("d", " ")) or None
        prereqs = _prereq_groups(primary_raw)
        mc_nodes = []
        for title, nodes in _feature_sections(blocks, 2):
            if "multiclass" in title.lower():
                mc_nodes = nodes
        mc_gained = to_markdown(mc_nodes) or None
        sub_feat = next((f for f in features if re.search(r"subclass$", f["name"], re.I)), None)
        subclass_title = sub_feat["name"] if sub_feat else f"{page.title} Subclass"
        subclass_level = sub_feat["level"] if sub_feat else 3
        intro_md = _intro(blocks)
    else:
        intro_md = _intro(blocks)
        secs = {t.lower(): n for t, n in _feature_sections(blocks, 5)}
        hp = labeled_fields(to_markdown(secs.get("hit points", [])))
        pf = labeled_fields(to_markdown(secs.get("proficiencies", [])))
        equipment = to_markdown(secs.get("equipment", []))
        hit_die = number((hp.get("hit dice") or hp.get("hit die") or "").lower().split("d", 1)[-1])
        saves = abilities_in(pf.get("saving throws", ""))
        prof = {
            "armor": _list(pf.get("armor")),
            "weapons": _list(pf.get("weapons")),
            "tools": _list(pf.get("tools")),
            "skills": _skill_choice(pf.get("skills", "")),
        }
        text = page.text
        m = re.search(r"You must have ([^.]*?) in order to multiclass", text, re.I)
        mc_raw = m.group(1) if m else ""
        primary = abilities_in(mc_raw)
        prereqs = _prereq_groups(mc_raw)
        mc_gained = None
        features = []
        for title, nodes in _feature_sections(blocks, 3):
            md = to_markdown(nodes)
            level = _level_from_table(title, progression) or _prose_level(md) or 1
            features.append(_feature(title, nodes, level))
        subclass_title = SUBCLASS_TITLES_2014.get(class_id, "Subclass")
        subclass_level = _level_from_table(subclass_title, progression)
        if subclass_level is None:
            sf = next((f for f in features if slug(f["name"]) == slug(subclass_title)), None)
            subclass_level = sf["level"] if sf else 3
            warnings.append(f"subclass level for '{subclass_title}' not in table, using {subclass_level}")

    sub_levels = sorted({subclass_level} | {
        r["level"] for r in progression["rows"]
        if any(re.search(r"\bfeature\b", f, re.I) or slug(f) == slug(subclass_title) for f in r["features"])})
    entry = base_entry(page, "class", class_id, source=source, description=intro_md)
    entry.update({
        "hitDie": hit_die,
        "primaryAbility": primary,
        "savingThrows": saves,
        "proficiencies": prof,
        "startingEquipment": equipment,
        # every group is required; any ability within a group satisfies it
        "multiclass": {"prerequisites": prereqs, "proficienciesGained": mc_gained},
        "subclassTitle": subclass_title,
        "subclassLevel": subclass_level,
        "subclassFeatureLevels": sub_levels,
        "progression": progression,
        "spellcasting": parse_spellcasting(progression, features),
        "features": features,
    })
    if not hit_die:
        warnings.append("no hit die")
    if not features:
        warnings.append("no features")
    return entry, warnings


def _prereq_groups(raw: str) -> list[dict]:
    """'Strength or Dexterity' / 'a Charisma score and a Strength score of 13 or higher' →
    [{"anyOf": [...], "min": 13}, ...]."""
    groups = []
    for clause in re.split(r"\band\b", raw, flags=re.I):
        abil = abilities_in(clause)
        if abil:
            groups.append({"anyOf": abil, "min": 13})
    return groups


def _intro(blocks: list) -> str:
    """Flavor text before the first table/heading."""
    out = []
    for el in blocks:
        if _hlevel(el) or (isinstance(el, Tag) and (el.name == "table" or el.find("table"))):
            break
        out.append(el)
    return to_markdown(out)


def subclass_links(page: Page, class_id: str) -> list[str]:
    """Page names of subclasses linked from a 2024 class page's subclass table."""
    out = []
    for a in page.content.find_all("a", href=True):
        m = re.search(rf"/({re.escape(class_id)}:[a-z0-9-]+)$", a["href"])
        if m and m.group(1) not in out and not m.group(1).endswith((":main", ":spell-list")):
            if a.find_parent("table"):
                out.append(m.group(1))
    return out


# -- subclasses ----------------------------------------------------------------------

def _unwrap_tabs(blocks: list, warnings: list[str]) -> list:
    """Pages holding several versions in tabs: keep the most recent (last) tab."""
    navs = [el for el in blocks if isinstance(el, Tag) and "yui-navset" in (el.get("class") or [])]
    substantive = [el for el in blocks if el not in navs and text_of(el)]
    if len(navs) == 1 and len(substantive) <= 2:
        panes = tabs(navs[0])
        if panes:
            if len(panes) > 1:
                warnings.append(f"kept tab '{panes[-1][0]}' of {[p[0] for p in panes]}")
            return substantive + top_blocks(panes[-1][1])
    return blocks


def subclass_spells(nodes: list) -> list[dict] | None:
    out = []
    for table in _all_tables(nodes):
        rows = table_rows(table)
        if len(rows) > 1 and sum(1 for c in rows[0] if c) == 1:
            rows = rows[1:]
        if len(rows) < 2 or not re.search(r"level", rows[0][0], re.I) or not re.search(r"spell", " ".join(rows[0][1:]), re.I):
            continue
        for r in rows[1:]:
            lv = number(r[0])
            if lv and len(r) > 1:
                spells = [clean(s) for s in re.split(r",\s*", " ".join(r[1:])) if clean(s) and clean(s) != "-"]
                if spells and not any(re.fullmatch(r"[\d\s+—-]+", s) for s in spells):
                    out.append({"classLevel": lv, "spells": spells})
    return out or None


_SHORT_NAME = re.compile(
    r"^(path of the|path of|college of the|college of|circle of the|circle of|oath of the|oath of|"
    r"way of the|way of|warrior of the|warrior of|school of|order of the|order of|the)\s+|"
    r"\s+(domain|sorcery|patron|bloodline|soul|mind|magic|conclave|archetype|\(ua\))$", re.I)


def short_name(name: str) -> str:
    prev = None
    s = clean(name)
    while prev != s:
        prev = s
        s = _SHORT_NAME.sub("", s).strip()
    return s or clean(name)


def parse_subclass(page: Page, class_id: str, default_level: int | None = None) -> tuple[dict | None, list[str]]:
    warnings: list[str] = []
    source, blocks = split_source(page)
    blocks = _unwrap_tabs(blocks, warnings)
    if source is None:
        for el in blocks:
            m = re.search(r"Source:\s*([^\n]+)", text_of(el)) if isinstance(el, Tag) else None
            if m:
                source = m.group(1).strip()
                break
    intro = []
    for el in blocks:
        if _hlevel(el):
            break
        if isinstance(el, Tag) and re.match(r"^Source:", text_of(el)):
            continue
        intro.append(el)
    if page.edition == "2024":
        features = _features_2024(blocks)
        if not features:   # some pages use h4/h5 for features
            for lv in (4, 5, 2):
                secs = [(t, n) for t, n in _feature_sections(blocks, lv) if _LEVEL_HEADING.match(t)]
                if secs:
                    features = [_feature(_LEVEL_HEADING.match(t).group(2), n, int(_LEVEL_HEADING.match(t).group(1)))
                                for t, n in secs]
                    break
    else:
        features = []
        level_h = next((lv for lv in (3, 4, 5, 2) if _feature_sections(blocks, lv)), 3)
        for title, nodes in _feature_sections(blocks, level_h):
            md = to_markdown(nodes)
            lvl = _prose_level(md, head_only=True)
            m = _LEVEL_HEADING.match(title)
            if m:
                lvl, title = int(m.group(1)), m.group(2)
            if lvl is None:   # same level as the previous feature (or the subclass level for the first)
                lvl = features[-1]["level"] if features else default_level
                if lvl is None:
                    warnings.append(f"no level for feature '{title}'")
            features.append(_feature(title, nodes, lvl))
    if not features:
        return None, warnings + ["no features"]
    # 2014 titles read "Barbarian: Path of the Zealot"
    name = re.sub(r"^[A-Z][A-Za-z ]+:\s*", "", page.title) if ":" in page.title else page.title
    entry = base_entry(page, "subclass", f"{class_id}/{slug(name)}", name=name, source=source,
                       description=to_markdown(intro))
    entry.update({
        "classId": class_id,
        "shortName": short_name(name),
        "features": features,
        "spells": subclass_spells(blocks),
    })
    return entry, warnings


# -- class options -------------------------------------------------------------------

def parse_options(page: Page, group: str, class_id: str, subclass_id: str | None,
                  heading_level: int | None = None) -> tuple[list[dict], list[str]]:
    """Pages listing options as headings (or bold paragraphs) each with an optional prerequisite."""
    warnings: list[str] = []
    page_source, blocks = split_source(page)
    best = []
    levels = [heading_level] if heading_level else [3, 4, 5, 6, 2]
    for lv in levels:
        secs = _feature_sections(blocks, lv)
        if len(secs) > len(best):
            best = secs
    out = []
    for title, nodes in best:
        if re.search(r"options?$|^table|list$", title, re.I) and len(best) > 3:
            continue
        md = to_markdown(nodes)
        fields = labeled_fields(md)
        prereq_raw = fields.get("prerequisite") or fields.get("prerequisites")
        if not prereq_raw:
            m = re.search(r"Prerequisites?:\s*([^\n*]+)", md)
            prereq_raw = m.group(1) if m else None
        src = fields.get("source") or page_source
        body = "\n".join(line for line in md.split("\n")
                         if not re.match(r"^\**(Source|Prerequisites?)\**:", re.sub(r"^\*+", "", line).strip())
                         and not re.match(r"^\*?\*?(Source|Prerequisites?):", line.strip()))
        entry = {
            "id": f"{group}/{slug(title)}",
            "type": "option",
            "name": clean(title),
            "edition": page.edition,
            "source": src,
            "description": body.strip(),
            "url": page.url,
            "group": group,
            "classId": class_id,
            "subclassId": subclass_id,
            "prerequisites": parse_prerequisites(prereq_raw),
        }
        out.append(entry)
    if not out:
        warnings.append("no options found")
    return out, warnings


# -- discovery -----------------------------------------------------------------------

# Pages under a class prefix that hold options rather than a subclass: page → (group, class, subclass).
OPTION_PAGES = {
    "2014": {
        "artificer:infusions": ("artificer-infusion", "artificer", None),
        "blood-hunter:blood-curse": ("blood-curse", "blood-hunter", None),
        "blood-hunter:mutagens": ("mutagen", "blood-hunter", "blood-hunter/order-of-the-mutant"),
        "fighter:battle-master:maneuvers": ("maneuver", "fighter", "fighter/battle-master"),
        "warlock:eldritch-invocations": ("eldritch-invocation", "warlock", None),
        "monk:four-elements:disciplines": ("elemental-discipline", "monk", "monk/way-of-the-four-elements"),
    },
    "2024": {
        "warlock:eldritch-invocations": ("eldritch-invocation", "warlock", None),
        "sorcerer:metamagic": ("metamagic", "sorcerer", None),
    },
}


def homebrew_links_2014(home: Page) -> set[str]:
    """Page names linked inside the 2014 home page's 'Homebrew Subclasses' section."""
    out: set[str] = set()
    start = next((h for h in home.content.find_all(re.compile(r"^h[1-6]$"))
                  if "homebrew subclasses" in text_of(h).lower()), None)
    if start is None:
        return out
    level = int(start.name[1])
    for el in start.find_all_next():
        if re.fullmatch(r"h[1-6]", el.name or "") and int(el.name[1]) <= level and el is not start:
            break
        if el.name == "a" and el.get("href", "").startswith("/"):
            out.add(el["href"][1:].split("#")[0])
    return out


def subclass_links_2014(home: Page, class_ids: list[str]) -> dict[str, list[str]]:
    hb = homebrew_links_2014(home)
    out: dict[str, list[str]] = {c: [] for c in class_ids}
    for a in home.content.find_all("a", href=True):
        name = a["href"].lstrip("/").split("#")[0]
        if name.count(":") != 1 or name in hb or name in OPTION_PAGES["2014"]:
            continue
        cls, _ = name.split(":")
        if cls in out and name not in out[cls]:
            out[cls].append(name)
    return out
