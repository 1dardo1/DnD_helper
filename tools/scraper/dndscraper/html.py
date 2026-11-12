"""Helpers to turn wikidot pages into clean Markdown and structured pieces."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup, NavigableString, Tag

_WS = re.compile(r"[ \t ]+")


@dataclass
class Page:
    edition: str
    name: str          # wikidot page name, e.g. "barbarian:zealot"
    url: str
    title: str
    content: Tag       # the cleaned #page-content element

    @property
    def text(self) -> str:
        return text_of(self.content)


def parse_page(html: str, edition: str, name: str, url: str) -> Page | None:
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find(id="page-content")
    if content is None:
        return None
    for bad in content.find_all(["script", "style", "noscript", "iframe"]):
        bad.decompose()
    for bad in content.find_all(class_=re.compile(r"wd-adunit|content-separator|footnotes-footer")):
        bad.decompose()
    for bad in content.find_all(id=re.compile(r"^(wad-|toc$)")):
        bad.decompose()
    title_el = soup.find(class_="page-title")
    title = clean(title_el.get_text()) if title_el else name
    return Page(edition, name, url, title, content)


# -- text helpers --------------------------------------------------------------------

def clean(s: str) -> str:
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "—").replace("…", "...")
    return _WS.sub(" ", s).strip()


def text_of(el: Tag | NavigableString | None) -> str:
    if el is None:
        return ""
    if isinstance(el, NavigableString):
        return clean(str(el))
    return clean(el.get_text(" "))


def slug(s: str) -> str:
    s = clean(s).lower().replace("'", "").replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# -- Markdown conversion ------------------------------------------------------------

def _inline(el) -> str:
    if isinstance(el, NavigableString):
        return str(el)
    if not isinstance(el, Tag):
        return ""
    if el.name == "br":
        return "\n"
    inner = "".join(_inline(c) for c in el.children)
    if el.name in ("strong", "b"):
        return _wrap(inner, "**")
    if el.name in ("em", "i"):
        return _wrap(inner, "*")
    if el.name == "sup":
        return inner
    return inner


def _wrap(inner: str, mark: str) -> str:
    stripped = inner.strip()
    if not stripped:
        return inner
    lead = inner[: len(inner) - len(inner.lstrip())]
    trail = inner[len(inner.rstrip()):]
    return f"{lead}{mark}{stripped}{mark}{trail}"


def _inline_text(el) -> str:
    lines = [clean(line) for line in _inline(el).split("\n")]
    return "  \n".join(line for line in lines if line)


def table_rows(table: Tag, keep_breaks: bool = False) -> list[list[str]]:
    """Rows of a table as plain-text cells (colspans repeated as empty cells).
    keep_breaks keeps <br> line breaks inside cells as "\n"."""
    rows = []
    for tr in table.find_all("tr"):
        if tr.find_parent("table") is not table:
            continue
        cells = []
        for td in tr.find_all(["td", "th"], recursive=False):
            lines = [clean(re.sub(r"\*+", "", line)) for line in _inline_text(td).split("  \n")]
            text = ("\n" if keep_breaks else " ").join(line for line in lines if line)
            cells.append(text.replace("|", "\\|"))
            cells.extend([""] * (int(td.get("colspan", 1) or 1) - 1))
        if cells:
            rows.append(cells)
    return rows


def _table_md(table: Tag) -> str:
    rows = table_rows(table)
    if not rows:
        return ""
    out = []
    # A first row with a single real cell is the table's caption.
    if len(rows) > 1 and sum(1 for c in rows[0] if c) == 1 and len(rows[1]) > 1:
        out.append(f"**{next(c for c in rows[0] if c)}**\n")
        rows = rows[1:]
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    out.append("| " + " | ".join(rows[0]) + " |")
    out.append("|" + "---|" * width)
    for r in rows[1:]:
        out.append("| " + " | ".join(r) + " |")
    return "\n".join(out)


def to_markdown(nodes) -> str:
    """Convert an element (or an iterable of sibling elements) to Markdown."""
    if isinstance(nodes, Tag):
        nodes = list(nodes.children)
    blocks: list[str] = []
    for el in nodes:
        _block(el, blocks)
    return "\n\n".join(b for b in blocks if b.strip()).strip()


def _block(el, blocks: list[str]) -> None:
    if isinstance(el, NavigableString):
        t = clean(str(el))
        if t:
            blocks.append(t)
        return
    if not isinstance(el, Tag):
        return
    name = el.name
    if name in ("p", "span", "strong", "em", "b", "i", "a"):
        t = _inline_text(el)
        if t:
            blocks.append(t)
    elif re.fullmatch(r"h[1-6]", name):
        t = text_of(el)
        if t:
            blocks.append("#" * int(name[1]) + " " + t)
    elif name in ("ul", "ol"):
        items = []
        for i, li in enumerate(el.find_all("li", recursive=False), 1):
            sub = [c for c in li.children if isinstance(c, Tag) and c.name in ("ul", "ol")]
            for s in sub:
                s.extract()
            bullet = f"{i}." if name == "ol" else "-"
            items.append(f"{bullet} {_inline_text(li)}")
            for s in sub:
                items.extend("  " + line for line in to_markdown([s]).split("\n"))
        blocks.append("\n".join(items))
    elif name == "table":
        blocks.append(_table_md(el))
    elif name == "blockquote":
        inner = to_markdown(el)
        blocks.append("\n".join("> " + line for line in inner.split("\n")))
    elif name in ("hr", "img", "br"):
        return
    elif "yui-navset" in (el.get("class") or []):
        for label, tab in tabs(el):
            blocks.append(f"### {label}")
            blocks.append(to_markdown(tab))
    elif "collapsible-block" in (el.get("class") or []):
        unfolded = el.find(class_="collapsible-block-unfolded")
        body = unfolded.find(class_="collapsible-block-content") if unfolded else None
        if body:
            blocks.append(to_markdown(body))
    else:
        for c in el.children:
            _block(c, blocks)


# -- structure helpers ---------------------------------------------------------------

def tabs(navset: Tag) -> list[tuple[str, Tag]]:
    labels = [text_of(li) for li in navset.select("ul.yui-nav > li")]
    content = navset.find(class_="yui-content")
    panes = [d for d in content.find_all("div", recursive=False)] if content else []
    return list(zip(labels, panes))


def top_blocks(root: Tag) -> list[Tag]:
    """Direct block children of root, descending through wrapper divs (but not tabs/collapsibles)."""
    out: list[Tag] = []
    for el in root.children:
        if not isinstance(el, Tag):
            if isinstance(el, NavigableString) and clean(str(el)):
                p = BeautifulSoup(f"<p>{el}</p>", "html.parser").p
                out.append(p)
            continue
        classes = el.get("class") or []
        if el.name == "div" and not {"yui-navset", "collapsible-block"} & set(classes):
            out.extend(top_blocks(el))
        else:
            out.append(el)
    return out


@dataclass
class Section:
    title: str
    level: int
    nodes: list = field(default_factory=list)

    @property
    def markdown(self) -> str:
        return to_markdown(self.nodes)


def sections(nodes: list[Tag], min_level: int = 1, max_level: int = 6) -> tuple[list, list[Section]]:
    """Split sibling nodes on headings. Returns (nodes before first heading, sections)."""
    intro: list = []
    secs: list[Section] = []
    for el in nodes:
        m = re.fullmatch(r"h([1-6])", el.name or "") if isinstance(el, Tag) else None
        if m and min_level <= int(m.group(1)) <= max_level:
            secs.append(Section(text_of(el), int(m.group(1))))
        elif secs:
            secs[-1].nodes.append(el)
        else:
            intro.append(el)
    return intro, secs


_TRAIT_START = re.compile(r"^\s*(?:\*\*\*|\*\*)([^*]{1,80}?)[.:]\s*(?:\*\*\*|\*\*)")
# A trait that introduces options: the named paragraphs after it are its options, not new traits.
_INTRODUCES_OPTIONS = re.compile(
    r"(following options|options below|one of the following (?:options|ways)|"
    r"the following (?:ways|options|effects|choices|benefits):|:\s*$)", re.I)


@dataclass
class Trait:
    name: str
    description: str


def traits(nodes: list, nest_options: bool = True, end_nesting: bool = False) -> tuple[str, list[Trait]]:
    """Split paragraphs of the form '**Name.** text' into named traits.

    Paragraphs that don't start a new trait are appended to the current one, and so are
    named paragraphs following a trait that introduces options (nest_options).
    end_nesting: the options of a trait end with their list (<ul>/<ol>) or, when they are named
    paragraphs, with the first plain paragraph after them; a named paragraph after that is a new
    trait (Goliath's Large Form after the Giant Ancestry list, Hexblood's Hex Magic after Eerie
    Token's options), not one more option.
    Returns (markdown before the first trait, traits)."""
    lead: list[str] = []
    out: list[Trait] = []
    nesting = False
    nested = False   # an option has been nested under the current trait
    for el in nodes:
        md = to_markdown([el])
        if not md:
            continue
        m = _TRAIT_START.match(md) if el.name == "p" else None
        if m and not md[m.end():].strip():   # a fully bold/italic paragraph is flavour text, not a trait
            m = None
        if m and nesting:
            out[-1].description = (out[-1].description + "\n\n" + md).strip()
            nested = True
        elif m:
            nested = False
            if nest_options and _INTRODUCES_OPTIONS.search(md):
                nesting = True
            name = clean(m.group(1))
            body = md[m.end():].strip()
            out.append(Trait(name, body))
        elif out:
            out[-1].description = (out[-1].description + "\n\n" + md).strip()
            if end_nesting and nesting and (el.name in ("ul", "ol") or nested):
                nesting = False
            if nest_options and _INTRODUCES_OPTIONS.search(md):
                nesting = True
        else:
            lead.append(md)
    return "\n\n".join(lead), out


def labeled_fields(md: str) -> dict[str, str]:
    """'**Label:** value' lines → {label: value} (labels lower-cased)."""
    out = {}
    for line in md.split("\n"):
        m = re.match(r"^\s*\*\*([^*]+?):?\*\*:?\s*(.*)$", line.strip())
        if not m:   # unbolded "Label: value"
            m = re.match(r"^([A-Z][A-Za-z' ]{1,40}):\s*(.+)$", clean(re.sub(r"\*+", "", line)))
        if m:
            out.setdefault(clean(m.group(1)).rstrip(":").lower(), clean(re.sub(r"\*+", "", m.group(2))).rstrip())
    return out
