"""review.html: a contact sheet of the pictures (self-contained: the pictures go inside), to pick
the ones to redo. Ticking cards builds the ``--only`` list for the command line or the Action."""

from __future__ import annotations

import base64
import html
from pathlib import Path

from .catalog import Catalog
from .record import Record

STATUS = {
    "new": "nueva",
    "failed": "falló",
    "ok": "",
    "missing": "sin imagen",
    "skip": "skip",
    "noprompt": "sin prompt",
}


def write(path: Path, cat: Catalog, record: Record, pictures: Path, new: set[str], failed: dict[str, str], date: str) -> None:
    kind = cat.kind.name
    cards = []
    order = {"new": 0, "failed": 1, "ok": 2, "missing": 3, "skip": 4, "noprompt": 5}
    rows = []
    for e in cat.entries:
        pic = pictures / f"{e.id}.webp"
        if e.id in failed:
            status = "failed"
        elif e.id in new:
            status = "new"
        elif e.skip:
            status = "skip"
        elif pic.exists():
            status = "ok"
        elif e.prompt is None:
            status = "noprompt"
        else:
            status = "missing"
        rows.append((order[status], e.name_es.lower(), e, status, pic))
    rows.sort(key=lambda r: r[:2])

    for _, _, e, status, pic in rows:
        rec = record.get(kind, e.id) or {}
        img = ""
        if pic.exists():
            b64 = base64.b64encode(pic.read_bytes()).decode()
            img = f'<img src="data:image/webp;base64,{b64}" alt="{html.escape(e.name_es)}" loading="lazy">'
        else:
            img = '<div class="noimg">sin imagen</div>'
        meta = [f"seed {e.seed}" if e.prompt else ""]
        if rec:
            meta.append(f"{rec.get('provider', '?')} · {rec.get('date', '')}")
            if rec.get("seed_applied") is False:
                meta.append("semilla no aplicada")
            if e.hash and record.changed(kind, e.id, e.hash, e.seed):
                meta.append("<b>prompt/seed cambiado</b>")
        note = f'<p class="err">{html.escape(failed[e.id])}</p>' if e.id in failed else ""
        badge = f'<span class="badge {status}">{STATUS[status]}</span>' if STATUS[status] else ""
        prompt = html.escape(e.prompt or "—")
        cards.append(
            f"""<article class="card {status}" data-id="{html.escape(e.id)}">
  <label class="pick"><input type="checkbox" value="{html.escape(e.id)}"> rehacer</label>
  {img}
  <h2>{html.escape(e.name_es)} {badge}</h2>
  <p class="sub">{html.escape(e.name)} · <code>{html.escape(e.id)}</code></p>
  <p class="meta">{" · ".join(m for m in meta if m)}</p>
  {note}
  <p class="prompt">{prompt}</p>
</article>"""
        )

    counts = {s: sum(1 for r in rows if r[3] == s) for s in order}
    summary = (
        f"{counts['new']} nuevas, {counts['ok']} ya estaban, {counts['failed']} fallidas, "
        f"{counts['missing']} pendientes, {counts['noprompt']} sin prompt, {counts['skip']} con skip"
    )
    page = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisión de retratos</title>
<style>
  :root {{ --bg:#efe3c8; --card:#f8f0dc; --ink:#3b2416; --muted:#7a5c43; --line:#cdb48a; --accent:#8c2f1c; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; padding:16px; background:var(--bg); color:var(--ink); font:15px/1.4 Georgia, serif; }}
  header {{ max-width:1400px; margin:0 auto 16px; }}
  h1 {{ margin:0 0 4px; font-size:1.6rem; }}
  .bar {{ max-width:1400px; margin:0 auto 12px; position:sticky; top:0; z-index:1; background:var(--bg); padding:8px 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }}
  .bar input {{ flex:1 1 280px; min-width:0; padding:6px 8px; font:13px monospace; border:1px solid var(--line); background:var(--card); color:var(--ink); }}
  .bar button {{ padding:6px 12px; border:1px solid var(--accent); background:var(--accent); color:#fff; font:inherit; cursor:pointer; }}
  .style {{ font-size:.85rem; color:var(--muted); }}
  main {{ max-width:1400px; margin:0 auto; display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:6px; padding:10px; position:relative; }}
  .card.new {{ border-color:#5d7a2e; box-shadow:0 0 0 2px #5d7a2e55; }}
  .card.failed {{ border-color:var(--accent); }}
  .card.picked {{ outline:3px solid var(--accent); }}
  .card img, .noimg {{ display:block; width:100%; aspect-ratio:3/4; object-fit:cover; border:1px solid var(--line); border-radius:4px; }}
  .noimg {{ display:grid; place-items:center; color:var(--muted); font-style:italic; }}
  .pick {{ position:absolute; top:14px; right:14px; background:#f8f0dcdd; padding:2px 6px; border-radius:4px; font-size:.8rem; cursor:pointer; }}
  h2 {{ font-size:1.05rem; margin:8px 0 0; }}
  .sub, .meta {{ margin:2px 0; font-size:.8rem; color:var(--muted); }}
  .prompt {{ margin:6px 0 0; font-size:.8rem; }}
  .err {{ color:var(--accent); font-size:.8rem; margin:4px 0; }}
  .badge {{ font:600 .7rem sans-serif; padding:1px 6px; border-radius:8px; background:var(--line); vertical-align:middle; }}
  .badge.new {{ background:#5d7a2e; color:#fff; }}
  .badge.failed {{ background:var(--accent); color:#fff; }}
  code {{ font-size:.8em; }}
</style>
</head>
<body>
<header>
  <h1>Retratos: {html.escape(kind)}</h1>
  <p>{html.escape(date)} · {summary}</p>
  <p class="style"><b>Estilo:</b> {html.escape(cat.style)}</p>
</header>
<div class="bar">
    <span>Rehacer (cambia antes su prompt o su seed en <code>tools/portraits/{html.escape(kind)}.yaml</code>):</span>
    <input id="only" readonly placeholder="marca las tarjetas que quieras rehacer">
    <button id="copy" type="button">Copiar</button>
</div>
<main>
{chr(10).join(cards)}
</main>
<script>
  const box = document.getElementById('only');
  const update = () => {{
    const ids = [...document.querySelectorAll('.pick input:checked')].map((c) => c.value);
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('picked', ids.includes(c.dataset.id)));
    box.value = ids.length ? ids.join(',') : '';
  }};
  document.querySelectorAll('.pick input').forEach((c) => c.addEventListener('change', update));
  document.getElementById('copy').addEventListener('click', () => {{
    box.select();
    navigator.clipboard?.writeText(box.value).catch(() => document.execCommand('copy'));
  }});
</script>
</body>
</html>
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(page, encoding="utf-8")
