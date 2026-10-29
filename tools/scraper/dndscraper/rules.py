"""Pages kept as generic rules: boons, gifts, sidekicks, optional rules, bastions, renown..."""

from __future__ import annotations

from .common import base_entry, split_source
from .html import Page, slug, to_markdown


def parse_rule(page: Page, category: str) -> tuple[dict | None, list[str]]:
    source, blocks = split_source(page)
    md = to_markdown(blocks)
    if not md:
        return None, ["empty page"]
    entry = base_entry(page, "rule", f"{category}/{slug(page.title)}", source=source, description=md)
    entry["category"] = category
    return entry, []
