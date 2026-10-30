"""Page discovery (via sitemaps) and polite, cached downloading."""

from __future__ import annotations

import re
import time
from datetime import datetime
from pathlib import Path

import requests

SITES = {
    "2014": "https://dnd5e.wikidot.com",
    "2024": "https://dnd2024.wikidot.com",
}

USER_AGENT = "Mozilla/5.0 (compatible; dnd-helper-scraper; personal use)"

# Page-name prefixes (the part before ":" or the whole name) that never hold game content.
_SKIP_PREFIXES = {
    "system", "help", "nav", "css", "admincss", "legal", "search", "forum", "home", "main",
    "wip", "deleted", "redirect-hub", "template", "technical", "icons", "random-site.php",
    "asph-s-main-page-proposal", "asph-s-class-icon-proposals",
    # Excluded by decision: Mystic class and its psionic disciplines.
    "mystic", "discipline", "disciplines",
    # Excluded by decision: homebrew.
    "homebrew", "homebrew-spell", "homebrew-spells", "hb",
}
# Whole page names excluded by decision: the Psion class (UA) with its disciplines and subclasses.
# Psion-only spells live on ordinary ua:spell-* pages and are dropped by their class list
# (see common.EXCLUDED_CLASSES).
_SKIP_PAGES = re.compile(r"^ua:(class-psion|subclass-psion-)")


def _prefix(page: str) -> str:
    return page.split(":", 1)[0]


class Crawler:
    def __init__(self, cache_dir: Path, delay: float = 0.5, offline: bool = False):
        self.cache_dir = cache_dir
        self.delay = delay
        self.offline = offline
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._last = 0.0
        self.fetched = 0
        self.failed: list[tuple[str, str]] = []

    # -- low level -----------------------------------------------------------------
    def _get(self, url: str) -> str | None:
        for attempt in range(4):
            wait = self.delay - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            try:
                r = self.session.get(url, timeout=30, allow_redirects=False)
                hops = 0
                # wikidot redirects aliases to plain http://; follow them ourselves over https
                while r.is_redirect and hops < 5 and r.headers.get("Location"):
                    nxt = requests.compat.urljoin(url, r.headers["Location"]).replace("http://", "https://", 1)
                    r = self.session.get(nxt, timeout=30, allow_redirects=False)
                    hops += 1
            except requests.RequestException as e:
                err = str(e)
            else:
                if r.status_code == 200:
                    r.encoding = "utf-8"
                    return r.text
                if r.status_code == 404:
                    return None
                err = f"HTTP {r.status_code}"
            time.sleep(2 ** (attempt + 1))
        self.failed.append((url, err))
        return None

    def _cache_path(self, edition: str, page: str) -> Path:
        safe = page.replace(":", "__").replace("/", "_") or "_home"
        return self.cache_dir / edition / f"{safe}.html"

    def page(self, edition: str, page: str, refresh: bool = False, lastmod: str | None = None) -> str | None:
        """Return the HTML of a page, from cache unless it is older than the sitemap's lastmod."""
        path = self._cache_path(edition, page)
        if path.exists() and not refresh and not self._stale(path, lastmod):
            return path.read_text(encoding="utf-8")
        if self.offline:
            return None
        html = self._get(f"{SITES[edition]}/{page}")
        if html is None:
            return None
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        self.fetched += 1
        return html

    @staticmethod
    def _stale(path: Path, lastmod: str | None) -> bool:
        if not lastmod:
            return False
        try:
            changed = datetime.fromisoformat(lastmod.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return False
        return path.stat().st_mtime < changed

    # -- discovery -----------------------------------------------------------------
    def list_pages(self, edition: str, refresh: bool = False) -> dict[str, str | None]:
        """All page names of a wiki according to its sitemap(s) → lastmod."""
        index = self.page(edition, "sitemap.xml", refresh=refresh) or ""
        xmls = [index]
        for sub in re.findall(r"<loc>([^<]*sitemap_page_\d+\.xml)</loc>", index):
            xmls.append(self.page(edition, sub.rsplit("/", 1)[1], refresh=refresh) or "")
        pages: dict[str, str | None] = {}
        base = SITES[edition] + "/"
        for xml in xmls:
            for loc, lastmod in re.findall(r"<loc>([^<]+)</loc>(?:<lastmod>([^<]+)</lastmod>)?", xml):
                if loc.startswith(base) and not loc.endswith(".xml"):
                    pages[loc[len(base):]] = lastmod or None
        return {p: m for p, m in sorted(pages.items()) if p and _prefix(p) not in _SKIP_PREFIXES
                and not _SKIP_PAGES.match(p)}
