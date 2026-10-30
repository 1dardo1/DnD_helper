"""End-to-end run: discover → download → parse → convert 2014 to 2024 rules → merge → write."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

import yaml

from . import backgrounds, classes, feats, items, rules, species, spells
from .common import ALL_CLASSES, CLASSES_2024
from .crawl import SITES, Crawler
from .html import Page, clean, parse_page, slug

TYPES = ["class", "subclass", "option", "spell", "feat", "species", "background", "item", "rule"]
FILES = {"class": "classes", "subclass": "subclasses", "option": "options", "spell": "spells", "feat": "feats",
         "species": "species", "background": "backgrounds", "item": "items", "rule": "rules"}

# Pages kept as generic rules (category = page name prefix).
RULE_PAGES = {
    "2014": re.compile(r"^(epic-boons|supernatural-gifts|dark-gifts|draconic-gifts|blessings|charms|sidekicks?(:.+)?|"
                       r"spell-points|madness|survivors|this-is-your-life|artifact-properties|ranger-revised|"
                       r"ranger-ambuscade-ua|ranger-no-spells|rune-scribe|7pack-[a-z]+(:.+)?|multisubclass(:.+)?|"
                       r"quick-characters-ua|siege-equipment(:.+)?|currency)$"),
    "2024": re.compile(r"^(bastions|circle-magic|evolving-magic-items|renown(:.+)?|class:multiclassing|"
                       r"equipment:crafting|magic-item:crafting|equipment:currency)$"),
}
EQUIPMENT_PAGES = {
    "2014": {"weapons": "weapon", "armor": "armor", "adventuring-gear": "gear", "tools": "tool",
             "mounts-vehicles": "mount", "firearms": "weapon", "explosives": "gear"},
    "2024": {"equipment:weapon": "weapon", "equipment:armor": "armor", "equipment:adventuring-gear": "gear",
             "equipment:tool": "tool", "equipment:mounts-and-vehicles": "mount", "equipment:poison": "poison",
             "equipment:modern-firearms-and-explosives": "weapon"},
}


class Report:
    def __init__(self):
        self.warnings: dict[str, list[str]] = defaultdict(list)
        self.failures: dict[str, list[str]] = defaultdict(list)
        self.replaced: dict[str, list[tuple[str, str]]] = defaultdict(list)   # type → (2014 name, 2024 name)
        self.duplicates: dict[str, list[tuple[str, str]]] = defaultdict(list)  # type → (kept url, dropped url)
        self.kept_2014: dict[str, list[str]] = defaultdict(list)
        self.near: list[tuple[str, str, str]] = []
        self.skipped: list[str] = []

    def warn(self, page: Page | str, msgs: list[str]):
        if msgs:
            self.warnings[page.url if isinstance(page, Page) else page].extend(msgs)

    def fail(self, page: Page | str, msgs: list[str]):
        self.failures[page.url if isinstance(page, Page) else page].extend(msgs or ["failed"])


# -- names ---------------------------------------------------------------------------

# "(UA)", "(Revised UA)", "(UA9 - 02.10.2025)", " UA", and source tags like "(SCC)", "(OGA)"
_NAME_SUFFIX = re.compile(r"\s*\((?:[^)]*\bUA\d*\b[^)]*|Unearthed Arcana[^)]*|[A-Z]{2,5})\)\s*$|\s+UA$")
_HOMEBREW_TAG = re.compile(r"\(HB\)")


def display_name(name: str) -> str:
    prev = None
    while prev != name:
        prev, name = name, _NAME_SUFFIX.sub("", name)
    return clean(name)


def key(name: str) -> str:
    s = display_name(name)
    s = re.sub(r"\s*\(?(revised|revisited|legacy|playtest)\)?$", "", s, flags=re.I)
    return slug(s)


def item_key(name: str) -> str:
    """'Arrows (20)', 'Acid (vial)', 'Padded Armor' → 'arrows', 'acid', 'padded'."""
    s = re.sub(r"\s*\((?:\d[^)]*|bag of [^)]*|vial|flask|bottle|jug|pint|\d+ ?ft\.?[^)]*)\)", "", name, flags=re.I)
    return re.sub(r"-armor$", "", key(s))


def is_ua(e: dict) -> bool:
    src = (e.get("source") or "").lower()
    return bool("unearthed arcana" in src or re.match(r"^ua\s*\d", src) or re.search(r"-ua(-|$)", e["url"])
                or "/ua:" in e["url"])


def _ua_number(e: dict) -> int:
    m = re.search(r"\bua\s*(\d+)|unearthed arcana\s*(\d+)", (e.get("source") or "").lower())
    return int(m.group(1) or m.group(2)) if m else 0


def version_rank(e: dict) -> tuple:
    """Higher is better among same-name entries of one edition."""
    trailing = re.search(r"(\d+)$", e["url"])
    return (not is_ua(e), _ua_number(e), int(trailing.group(1)) if trailing else 0, len(e.get("description") or ""))


def entry_key(e: dict) -> tuple:
    t = e["type"]
    if t == "subclass":
        return (t, e["classId"], key(e["shortName"]))
    if t == "option":
        return (t, e["group"], key(e["name"]))
    if t == "rule":
        return (t, e["category"], key(e["name"]))
    if t == "item":
        return (t, item_key(e["name"]))
    return (t, key(e["name"]))


# -- discovery & parsing -------------------------------------------------------------

class Run:
    def __init__(self, crawler: Crawler, report: Report):
        self.c = crawler
        self.r = report
        self.pages: dict[str, dict[str, str | None]] = {}

    def page(self, edition: str, name: str) -> Page | None:
        if edition not in self.pages:
            self.pages[edition] = self.c.list_pages(edition, refresh=not self.c.offline)
        html = self.c.page(edition, name, lastmod=self.pages[edition].get(name))
        if html is None:
            self.r.fail(f"{SITES[edition]}/{name}", ["could not download"])
            return None
        return parse_page(html, edition, name, f"{SITES[edition]}/{name}")

    def names(self, edition: str, pattern: str) -> list[str]:
        if edition not in self.pages:
            self.pages[edition] = self.c.list_pages(edition, refresh=not self.c.offline)
        rx = re.compile(pattern)
        return [p for p in self.pages[edition] if rx.match(p)]

    def _add(self, out: list, page: Page, result):
        entry, warns = result
        if _HOMEBREW_TAG.search(page.title):   # homebrew is excluded wherever the wiki lists it
            self.r.skipped.append(page.url)
            return None
        if entry is None:
            self.r.fail(page, warns)
            return None
        self.r.warn(page, warns)
        entry["name"] = display_name(entry["name"])
        out.append(entry)
        return entry

    # 2024 ---------------------------------------------------------------------------
    def parse_2024(self) -> list[dict]:
        ed = "2024"
        out: list[dict] = []
        class_pages = {c: f"{c}:main" for c in CLASSES_2024}
        ua_option_pages = []
        for n in self.names(ed, r"^ua:class-"):
            p = self.page(ed, n)
            if p and classes.parse_progression(p.content.find_all("table")):
                cid = slug(re.sub(r"\(.*", "", p.title))
                if cid not in class_pages or version_rank_page(n) > version_rank_page(class_pages[cid]):
                    class_pages[cid] = n
            elif p:
                ua_option_pages.append(p)
        class_entries = {}
        for cid, n in class_pages.items():
            p = self.page(ed, n)
            if not p:
                continue
            e = self._add(out, p, classes.parse_class(p, cid))
            if e:
                class_entries.setdefault(cid, e)
                for sn in classes.subclass_links(p, cid):
                    sp = self.page(ed, sn)
                    if sp:
                        self._add(out, sp, classes.parse_subclass(sp, cid, e["subclassLevel"]))
        for p in ua_option_pages:   # e.g. "Psionic Discipline Options", "Eldritch Invocation Options"
            title = display_name(p.title)
            group = slug(re.sub(r"\s*\(.*?\)|\s+options?$", "", title, flags=re.I)).rstrip("s")
            group = "eldritch-invocation" if "invocation" in group else group
            cid = next((c for c in sorted(class_entries, key=len, reverse=True) if p.name.startswith(f"ua:class-{c}")),
                       None) or _guess_class(p.text, class_entries)
            opts, warns = classes.parse_options(p, group, cid, None)
            self.r.warn(p, warns)
            out.extend(opts)
        # UA pages: ua:subclass-<class>-..., ua:feat-..., ua:spell-..., ua:species-...; the rest by content.
        for n in self.names(ed, r"^ua:(?!all$|class-)"):
            p = self.page(ed, n)
            if not p:
                continue
            rest = n[3:]
            if rest.startswith("subclass-"):
                cid = next((c for c in sorted(class_entries, key=len, reverse=True)
                            if rest.startswith(f"subclass-{c}-")), None)
                cid = cid or _guess_class(p.text, class_entries)
                if not cid:
                    self.r.fail(p, ["UA subclass: class not found"])
                    continue
                lvl = class_entries.get(cid, {}).get("subclassLevel", 3)
                self._add(out, p, classes.parse_subclass(p, cid, lvl))
            elif spells.is_spell(p):
                self._add(out, p, spells.parse_spell(p))
            elif rest.startswith("species-"):
                self._add(out, p, species.parse_species_2024(p))
            elif rest.startswith(("magic-item", "item-")) or items.is_magic_item(p):
                self._add(out, p, items.parse_magic_item(p))
            elif rest.startswith("feat-") or re.search(r"\bFeat\b", p.text[:400]):
                self._add(out, p, feats.parse_feat(p, None))
            else:
                self._add(out, p, rules.parse_rule(p, "ua"))
        cats = feats.feat_categories_2024(self.page(ed, "feat:all"))
        for n in self.names(ed, r"^feat:(?!all$|link-collection$)"):
            p = self.page(ed, n)
            if p:
                self._add(out, p, feats.parse_feat(p, cats.get(n[5:])))
        for n in self.names(ed, r"^spell:"):
            p = self.page(ed, n)
            if p and spells.is_spell(p):
                self._add(out, p, spells.parse_spell(p))
        for n in self.names(ed, r"^species:(?!all$|link-collection$)"):
            p = self.page(ed, n)
            if p:
                self._add(out, p, species.parse_species_2024(p))
        for n in self.names(ed, r"^background:(?!all$|link-collection$)"):
            p = self.page(ed, n)
            if p and backgrounds.is_background(p):
                self._add(out, p, backgrounds.parse_background(p))
        for n in self.names(ed, r"^magic-item:"):
            p = self.page(ed, n)
            if p and items.is_magic_item(p):
                self._add(out, p, items.parse_magic_item(p))
        self._common(ed, out)
        return out

    # 2014 ---------------------------------------------------------------------------
    def parse_2014(self) -> list[dict]:
        ed = "2014"
        out: list[dict] = []
        home = self.page(ed, "")
        class_entries = {}
        for cid in ALL_CLASSES:
            p = self.page(ed, cid)
            if p:
                e = self._add(out, p, classes.parse_class(p, cid))
                if e:
                    class_entries[cid] = e
        if home:
            for cid, subs in classes.subclass_links_2014(home, ALL_CLASSES).items():
                lvl = class_entries.get(cid, {}).get("subclassLevel")
                for sn in subs:
                    sp = self.page(ed, sn)
                    if sp:
                        self._add(out, sp, classes.parse_subclass(sp, cid, lvl))
            self.r.skipped.extend(sorted(f"{SITES[ed]}/{n}" for n in classes.homebrew_links_2014(home)))
        for f in feats.fighting_styles_2014(list(class_entries.values())):
            out.append(f)
        for n in self.names(ed, r"^feat:"):
            p = self.page(ed, n)
            if p:
                self._add(out, p, feats.parse_feat(p, None))
        for n in self.names(ed, r"^spell:"):
            p = self.page(ed, n)
            if p and spells.is_spell(p):
                self._add(out, p, spells.parse_spell(p))
        lineage = self.page(ed, "lineage")
        race_pages = sorted(set(re.findall(r'href="/(lineage:[a-z0-9-]+)"', str(lineage.content)))) if lineage else []
        for n in race_pages:
            p = self.page(ed, n)
            if p:
                self._add(out, p, species.parse_race_2014(p))
        for n in self.names(ed, r"^wondrous-items:"):
            p = self.page(ed, n)
            if p and items.is_magic_item(p):
                self._add(out, p, items.parse_magic_item(p))
        for n in self.names(ed, r"^poisons:"):
            p = self.page(ed, n)
            if p:
                self._add(out, p, items.parse_single_item(p, "poison"))
        self._common(ed, out)
        return out

    def _common(self, ed: str, out: list):
        for n, (group, cid, scid) in classes.OPTION_PAGES[ed].items():
            p = self.page(ed, n)
            if p:
                opts, warns = classes.parse_options(p, group, cid, scid)
                self.r.warn(p, warns)
                for o in opts:
                    o["name"] = display_name(o["name"])
                out.extend(opts)
        for n, hint in EQUIPMENT_PAGES[ed].items():
            p = self.page(ed, n)
            if p:
                found, warns = items.parse_equipment_page(p, hint)
                self.r.warn(p, warns)
                out.extend(found)
        for n in self.names(ed, RULE_PAGES[ed].pattern):
            p = self.page(ed, n)
            if p:
                self._add(out, p, rules.parse_rule(p, slug(n.split(":")[0])))


def version_rank_page(name: str) -> int:
    m = re.search(r"(\d+)$", name)
    return int(m.group(1)) if m else 0


_CLASS_SIGNATURES = {
    "rogue": r"sneak attack|cunning action", "barbarian": r"\brage\b", "monk": r"focus points?|\bki\b",
    "sorcerer": r"sorcery points?|metamagic", "paladin": r"lay on hands|divine smite|\boath\b",
    "cleric": r"channel divinity|\bdomain\b", "warlock": r"pact magic|eldritch invocation|\bpatron\b",
    "wizard": r"spellbook|arcane recovery", "druid": r"wild shape", "bard": r"bardic inspiration",
    "ranger": r"favored enemy|hunter's mark", "fighter": r"action surge|second wind|maneuver",
    "artificer": r"infus|tinker", "psion": r"psionic energy",
}


def _guess_class(text: str, class_ids) -> str | None:
    """Class a page talks about the most: its name or its signature features (Sneak Attack → Rogue)."""
    counts = Counter()
    for cid in class_ids:
        counts[cid] = len(re.findall(rf"\b{re.escape(cid.replace('-', ' '))}s?\b", text, re.I))
        if cid in _CLASS_SIGNATURES:
            counts[cid] += len(re.findall(_CLASS_SIGNATURES[cid], text, re.I))
    best = counts.most_common(1)
    return best[0][0] if best and best[0][1] else None


# -- conversion of 2014 entries to 2024 rules -------------------------------------------

def _next_level(x: int, levels: list[int], first: int) -> int:
    if x <= first:
        return first
    return next((lv for lv in sorted(levels) if lv >= x), x)


def convert_subclass(e: dict, cls: dict) -> None:
    levels, first = cls["subclassFeatureLevels"], cls["subclassLevel"]
    changes = {}
    for f in e["features"]:
        if f["level"] is None:
            f["level"] = first
        new = _next_level(f["level"], levels, first)
        if new != f["level"]:
            changes[f["level"]] = new
            f["level"] = new
    if e.get("spells"):
        merged: dict[int, list[str]] = {}
        for row in e["spells"]:
            lv = max(row["classLevel"], first)
            if lv != row["classLevel"]:
                changes.setdefault(row["classLevel"], lv)
            merged.setdefault(lv, [])
            merged[lv] += [s for s in row["spells"] if s not in merged[lv]]
        e["spells"] = [{"classLevel": lv, "spells": sp} for lv, sp in sorted(merged.items())]
    if changes:
        desc = ", ".join(f"{a}→{b}" for a, b in sorted(changes.items()))
        e.setdefault("adjustments", []).append(
            f"Levels moved to the 2024 {cls['name']} subclass levels {levels} ({desc})")


def convert_feat(e: dict, species_keys: set[str]) -> None:
    pre = e.get("prerequisites") or {}
    raw = (pre.get("raw") or "").lower()
    if e["category"] != "fighting-style":
        def named(k: str) -> bool:   # "half-elf" matches "Half-Elf" and "half elf", but "elf" not inside "half-elf"
            return bool(re.search(rf"(?<![\w-]){'[ -]'.join(map(re.escape, k.split('-')))}(?![\w-])", raw))
        found = sorted(k for k in species_keys if len(k) > 2 and named(k))
        e["category"] = "racial" if found else "general"
        if found:
            pre["species"] = found
        if "level" not in pre:
            pre["level"] = 4
            pre["raw"] = ("Level 4+, " + pre["raw"]) if pre.get("raw") else "Level 4+"
            e.setdefault("adjustments", []).append("Added the level 4 prerequisite of 2024 general feats")
        e["prerequisites"] = pre


# -- merge -------------------------------------------------------------------------------

def dedupe(entries: list[dict], report: Report) -> dict[tuple, dict]:
    by: dict[tuple, dict] = {}
    for e in entries:
        k = entry_key(e)
        if k not in by:
            by[k] = e
            continue
        a, b = by[k], e
        keep, drop = (a, b) if version_rank(a) >= version_rank(b) else (b, a)
        by[k] = keep
        if keep["url"] != drop["url"]:
            report.duplicates[e["type"]].append((keep["url"], drop["url"]))
    return by


def load_successors(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    out: dict = {}
    for t, mapping in (data or {}).items():
        if t == "subclass":
            for cid, pairs in (mapping or {}).items():
                for a, b in (pairs or {}).items():
                    out[("subclass", cid, key(a))] = ("subclass", cid, key(b))
        else:
            for a, b in (mapping or {}).items():
                ka = ("item", item_key(a)) if t == "item" else (t, key(a))
                kb = ("item", item_key(b)) if t == "item" else (t, key(b))
                out[ka] = kb
    return out


def merge(e14: list[dict], e24: list[dict], successors: dict, report: Report) -> list[dict]:
    new = dedupe(e24, report)
    old = dedupe(e14, report)
    classes_2024 = {e["id"]: e for k, e in new.items() if k[0] == "class"}
    species_keys = {k[1] for k in list(new) + list(old) if k[0] == "species"}
    kept_2014_classes = {k[1] for k in old if k[0] == "class" and k not in new}

    result = dict(new)
    renamed_ids: dict[str, str] = {}
    for k, e in old.items():
        target = k if k in new else successors.get(k)
        if target and target in new:
            winner = new[target]
            renamed_ids[e["id"]] = winner["id"]
            winner.setdefault("replaced", []).append(e["url"])
            report.replaced[e["type"]].append((e["name"], winner["name"]))
            if e["type"] == "spell":   # keep 2014-only classes on the spell list
                extra = [c for c in e["classes"] if c in kept_2014_classes and c not in winner["classes"]]
                winner["classes"] += extra
            continue
        if e["type"] == "subclass" and e["classId"] in classes_2024:
            convert_subclass(e, classes_2024[e["classId"]])
        if e["type"] == "feat":
            convert_feat(e, species_keys)
        result[k] = e
        report.kept_2014[e["type"]].append(e["name"])
        _near_matches(k, e, new, report)
    for e in result.values():   # options of a replaced 2014 subclass now point at its 2024 successor
        if e["type"] == "option" and e.get("subclassId") in renamed_ids:
            e["subclassId"] = renamed_ids[e["subclassId"]]
    return list(result.values())


def _near_matches(k: tuple, e: dict, new: dict, report: Report) -> None:
    """2014 entries kept whose name resembles a 2024 one: candidates for successors.yaml."""
    mine = k[-1]
    if len(mine) < 4:
        return
    for k2, e2 in new.items():
        if k2[:-1] != k[:-1]:
            continue
        other = k2[-1]
        contained = (mine in other or other in mine) and abs(len(mine) - len(other)) <= 6
        if contained or SequenceMatcher(None, mine, other).ratio() >= 0.85:
            report.near.append((e["type"], f"{e['name']} ({e.get('classId', '')})".replace(" ()", ""), e2["name"]))


# -- output ------------------------------------------------------------------------------

def _clean_entry(e: dict) -> dict:
    return {k: v for k, v in e.items() if not k.startswith("_")}


def write(entries: list[dict], data_dir: Path, report: Report, crawler: Crawler, report_path: Path) -> dict:
    data_dir.mkdir(parents=True, exist_ok=True)
    by_type: dict[str, list[dict]] = defaultdict(list)
    for e in entries:
        by_type[e["type"]].append(_clean_entry(e))
    counts = {}
    for t in TYPES:
        rows = sorted(by_type.get(t, []), key=lambda e: e["id"])
        ids = Counter(e["id"] for e in rows)
        for e in rows:   # ids must be unique within a file
            if ids[e["id"]] > 1:
                e["id"] = f"{e['id']}--{slug(e['url'].rsplit('/', 1)[-1])}"
        counts[t] = len(rows)
        (data_dir / f"{FILES[t]}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "sources": SITES,
        "counts": counts,
        "byEdition": {t: dict(Counter(e["edition"] for e in by_type.get(t, []))) for t in TYPES},
        "pagesDownloaded": crawler.fetched,
        "downloadFailures": len(crawler.failed),
        "parseFailures": len(report.failures),
    }
    (data_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report_path.write_text(render_report(meta, report, crawler), encoding="utf-8")
    return meta


def render_report(meta: dict, r: Report, crawler: Crawler) -> str:
    L = ["# Informe de extracción\n", f"Generado: {meta['generatedAt']}\n", "## Totales\n",
         "| Tipo | Total | De 2024 | De 2014 |", "|---|---|---|---|"]
    for t in TYPES:
        be = meta["byEdition"].get(t, {})
        L.append(f"| {FILES[t]} | {meta['counts'][t]} | {be.get('2024', 0)} | {be.get('2014', 0)} |")
    L.append(f"\nPáginas descargadas en esta ejecución: {meta['pagesDownloaded']}  ")
    L.append(f"Fallos de descarga: {meta['downloadFailures']} · Páginas que no se pudieron convertir: {meta['parseFailures']}\n")

    L.append("## Sustituidos por la versión de 2024\n")
    for t in TYPES:
        pairs = sorted(r.replaced.get(t, []))
        if pairs:
            renamed = [f"{a} → {b}" for a, b in pairs if key(a) != key(b)]
            L.append(f"- **{FILES[t]}**: {len(pairs)}" + (f" (renombrados: {', '.join(renamed)})" if renamed else ""))
    L.append("\n## Conservados de 2014 (no existen en 2024)\n")
    for t in TYPES:
        names = sorted(set(r.kept_2014.get(t, [])))
        if names:
            L.append(f"<details><summary>{FILES[t]}: {len(names)}</summary>\n\n{', '.join(names)}\n\n</details>\n")
    if r.near:
        L.append("## Posibles sucesores por revisar\n")
        L.append("Elementos de 2014 que se han conservado pero se parecen a uno de 2024. "
                 "Si son la misma cosa, añádelos a `tools/scraper/successors.yaml`.\n")
        L.append("| Tipo | 2014 (conservado) | 2024 parecido |")
        L.append("|---|---|---|")
        for t, a, b in sorted(set(r.near)):
            L.append(f"| {t} | {a} | {b} |")
    if r.skipped:
        L.append(f"\n## Excluidos (homebrew)\n\n{len(r.skipped)} páginas: secciones *Homebrew* de las wikis "
                 "y páginas marcadas «(HB)».\n")
    if r.failures or crawler.failed:
        L.append("\n## Páginas que fallaron\n")
        for url, err in crawler.failed:
            L.append(f"- {url}: descarga ({err})")
        for url, msgs in sorted(r.failures.items()):
            L.append(f"- {url}: {'; '.join(msgs)}")
    if r.warnings:
        L.append("\n## Avisos (datos dudosos, revisar)\n")
        L.append(f"<details><summary>{len(r.warnings)} páginas</summary>\n")
        for url, msgs in sorted(r.warnings.items()):
            L.append(f"- {url}: {'; '.join(sorted(set(msgs)))}")
        L.append("\n</details>")
    dup = sum(len(v) for v in r.duplicates.values())
    L.append(f"\n## Duplicados dentro de una misma wiki\n\n{dup} páginas eran alias o versiones anteriores "
             "(p. ej. UA ya publicado) y se descartaron.\n")
    return "\n".join(L) + "\n"


def apply_multiclass_gains(entries: list[dict], path: Path, report: Report) -> None:
    """multiclass.gains for every class: its 2024 text, else multiclass.yaml, else the estimate
    the 2024 classes' pattern gives (flagged so the app can warn)."""
    table = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    for e in entries:
        if e["type"] != "class":
            continue
        gains, origin = classes.multiclass_gains_from_text(e["multiclass"].get("proficienciesGained")), "text"
        if gains is None and e["id"] in (table or {}):
            t = table[e["id"]] or {}
            gains, origin = {k: t.get(k, d) for k, d in (("armor", []), ("weapons", []), ("tools", []),
                                                          ("skill", None), ("instrument", False))}, "table"
        if gains is None:
            gains, origin = classes.estimated_multiclass_gains(e), "estimate"
            report.warn(e["url"], ["no multiclass text nor multiclass.yaml entry: estimated from the 2024 pattern"])
        e["multiclass"]["gains"] = {**gains, "origin": origin}


def run(root: Path, offline: bool = False, delay: float = 0.5) -> dict:
    crawler = Crawler(root / "tools/scraper/.cache", delay=delay, offline=offline)
    report = Report()
    r = Run(crawler, report)
    e24 = r.parse_2024()
    e14 = r.parse_2014()
    successors = load_successors(root / "tools/scraper/successors.yaml")
    merged = merge(e14, e24, successors, report)
    apply_multiclass_gains(merged, root / "tools/scraper/multiclass.yaml", report)
    return write(merged, root / "data", report, crawler, root / "tools/scraper/report.md")
