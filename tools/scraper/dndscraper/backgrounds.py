"""Backgrounds (2024 only, by decision)."""

from __future__ import annotations

import re

from .common import abilities_in, base_entry, skills_in, split_source
from .html import Page, labeled_fields, slug, to_markdown


def is_background(page: Page) -> bool:
    return bool(re.search(r"Ability Scores?\s*:", page.text) and re.search(r"\bFeats?\s*:", page.text))


def parse_background(page: Page) -> tuple[dict | None, list[str]]:
    warnings: list[str] = []
    source, blocks = split_source(page)
    md = to_markdown(blocks)
    fields = labeled_fields(md)
    desc = "\n\n".join(p for p in md.split("\n\n")
                       if not re.match(r"^\**(Ability Scores?|Feat|Skill|Tool|Equipment)", p))
    abil = abilities_in(fields.get("ability scores") or fields.get("ability score") or "")
    feat_raw = fields.get("feat", "")
    skills = skills_in(fields.get("skill proficiencies", ""))
    if len(abil) != 3:
        warnings.append(f"expected 3 abilities, got {abil}")
    if not feat_raw:
        warnings.append("no feat")
    entry = base_entry(page, "background", slug(page.title), source=source, description=desc)
    entry.update({
        "abilityScores": abil,
        "feat": feat_raw or None,                         # e.g. "Magic Initiate (Cleric)"
        # null when the background offers a choice ("X or a Dark Gift feat of your choice")
        "featId": None if re.search(r"\bor\b|choose|of your choice", feat_raw, re.I)
        else slug(re.sub(r"\(.*\)", "", feat_raw)) or None,
        "skills": skills,
        "tools": fields.get("tool proficiency") or fields.get("tool proficiencies"),
        "equipment": fields.get("equipment", ""),
    })
    return entry, warnings
