"""python -m portraits <kind> [options]: generate the missing pictures (see README.md)."""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from . import catalog, imaging, review
from .catalog import KINDS, Catalog, Entry
from .providers import AuthError, Provider, ProviderError, QuotaExceeded, make_provider
from .record import Record

# Ask for a portrait picture; providers that can't choose the size return a square, cropped later.
REQUEST_SIZE = (768, 1024)
# Stop after this many pictures in a row fail (something is wrong, not just one prompt).
MAX_FAILURES_IN_A_ROW = 3


def parse_args(argv=None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(prog="python -m portraits", description="Genera los retratos con IA.")
    ap.add_argument("kind", choices=sorted(KINDS), help="qué retratar")
    ap.add_argument("--only", default="", help="solo estos ids (separados por comas); se rehacen aunque existan")
    ap.add_argument("--force", action="store_true", help="rehacer todas, aunque existan")
    ap.add_argument("--changed", action="store_true", help="también las que tienen el prompt o la seed cambiados")
    ap.add_argument("--provider", default="cloudflare", help="cloudflare (por defecto) o fake (de prueba)")
    ap.add_argument("--limit", type=int, default=0, help="como mucho N imágenes en esta ejecución")
    ap.add_argument("--dry-run", action="store_true", help="solo decir qué haría (no genera ni escribe nada)")
    ap.add_argument(
        "--out",
        type=Path,
        default=None,
        help="carpeta de salida (imágenes, index.json, generated.json y review.html); "
        "por defecto app/public/<kind>/ y tools/portraits/",
    )
    ap.add_argument("--prompts", type=Path, default=None, help="fichero de prompts (por defecto tools/portraits/<kind>.yaml)")
    ap.add_argument("--review", type=Path, default=None, help="dónde escribir review.html")
    ap.add_argument("--summary", type=Path, default=None, help="añadir un resumen en Markdown a este fichero")
    return ap.parse_args(argv)


def select(cat: Catalog, record: Record, pictures: Path, only: list[str], force: bool, changed: bool) -> list[Entry]:
    """The entries to draw now, in data order."""
    by_id = cat.by_id()
    if only:
        unknown = [i for i in only if i not in by_id]
        if unknown:
            raise SystemExit(f"ids desconocidos en --only: {', '.join(unknown)}")
        chosen = [by_id[i] for i in only]
        for e in chosen:
            if not e.drawable:
                print(f"aviso: {e.id} {'tiene skip' if e.skip else 'no tiene prompt'}: se salta")
        return [e for e in chosen if e.drawable]
    todo = []
    for e in cat.entries:
        if not e.drawable:
            continue
        exists = (pictures / f"{e.id}.webp").exists()
        if force or not exists or (changed and record.changed(cat.kind.name, e.id, e.hash, e.seed)):
            todo.append(e)
    return todo


def main(argv=None) -> int:
    args = parse_args(argv)
    kind = KINDS[args.kind]
    out = args.out.resolve() if args.out else None
    pictures = out if out else kind.pictures
    record_path = (out / "generated.json") if out else (catalog.HERE / "generated.json")
    review_path = args.review or ((out / "review.html") if out else (catalog.HERE / "review.html"))

    cat = catalog.load(kind, prompts_path=args.prompts)
    for w in cat.warnings:
        print(f"aviso: {w}")
    record = Record(record_path)
    only = [i.strip() for i in args.only.replace(" ", ",").split(",") if i.strip()]
    todo = select(cat, record, pictures, only, args.force, args.changed)
    selected = len(todo)
    if args.limit and args.limit > 0:
        todo = todo[: args.limit]
    drawable = sum(1 for e in cat.entries if e.drawable)
    print(f"{kind.name}: {drawable} con prompt, {selected} por generar" + (f", {len(todo)} en esta ejecución" if len(todo) != selected else ""))

    if args.dry_run:
        for e in todo:
            print(f"  {e.id} (seed {e.seed}, {len(e.full_prompt)} car.): {e.full_prompt}")
        return 0
    if not todo:
        print("Nada que generar.")
        review.write(review_path, cat, record, pictures, set(), {}, _now())
        catalog.write_index(pictures)
        _summary(args.summary, kind.name, [], {}, None, 0, review_path)
        return 0

    try:
        provider = make_provider(args.provider)
    except AuthError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        _summary(args.summary, kind.name, [], {}, str(e), selected, review_path)
        return 2

    done, failed, stop, fatal = _generate(provider, cat, record, pictures, todo)
    ids = catalog.write_index(pictures)
    review.write(review_path, cat, record, pictures, set(done), failed, _now())
    left = sum(1 for e in cat.entries if e.drawable and not (pictures / f"{e.id}.webp").exists())
    print(
        f"\nHechas {len(done)}, fallidas {len(failed)}; {len(ids)} con imagen en total, {left} sin imagen todavía."
        f"\nRevisión: {review_path}"
    )
    if stop:
        print(f"Parado: {stop}. La próxima ejecución sigue por donde se quedó.")
    pending = selected - len(done)
    _summary(args.summary, kind.name, done, failed, stop, pending, review_path)
    if fatal:
        return 2
    return 1 if failed else 0


def _generate(provider: Provider, cat: Catalog, record: Record, pictures: Path, todo: list[Entry]):
    done: list[str] = []
    failed: dict[str, str] = {}
    stop = None
    fatal = False
    in_a_row = 0
    pictures.mkdir(parents=True, exist_ok=True)
    for n, e in enumerate(todo, 1):
        print(f"[{n}/{len(todo)}] {e.id} (seed {e.seed})...", flush=True)
        try:
            raw = provider.generate(e.full_prompt, e.seed, REQUEST_SIZE, negative=cat.negative or None, label=e.id)
            webp = imaging.to_webp(raw)
        except QuotaExceeded as ex:
            stop = f"cuota o límite de peticiones: {ex}"
            break
        except AuthError as ex:
            stop = f"credenciales: {ex}"
            fatal = True
            break
        except (ProviderError, ValueError) as ex:
            failed[e.id] = str(ex)
            print(f"  falló: {ex}")
            in_a_row += 1
            if in_a_row >= MAX_FAILURES_IN_A_ROW:
                stop = f"{in_a_row} fallos seguidos (el último: {ex})"
                break
            continue
        in_a_row = 0
        target = pictures / f"{e.id}.webp"
        tmp = target.with_suffix(".webp.tmp")
        tmp.write_bytes(webp)
        tmp.replace(target)
        record.set(
            cat.kind.name,
            e.id,
            {
                "hash": e.hash,
                "seed": e.seed,
                "seed_applied": bool(getattr(provider, "seed_applied", True)),
                "provider": provider.name,
                "model": provider.model,
                "date": _now(),
            },
        )
        record.save()  # after each one: an interrupted run keeps what's done
        done.append(e.id)
        print(f"  ok ({len(webp) // 1024} KB)")
    return done, failed, stop, fatal


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")


def _summary(path: Path | None, kind: str, done, failed, stop, pending: int, review_path: Path) -> None:
    if not path:
        return
    lines = [f"## Retratos: {kind}", ""]
    lines.append(f"- Generadas: **{len(done)}**" + (f" ({', '.join(done)})" if done else ""))
    if failed:
        lines.append(f"- Fallidas: **{len(failed)}**")
        lines += [f"  - `{i}`: {m}" for i, m in failed.items()]
    if stop:
        lines.append(f"- Parado: {stop}")
    lines.append(f"- Pendientes de esta selección: **{max(0, pending)}**" + (" (la próxima ejecución sigue)" if pending > 0 else ""))
    lines.append("")
    with open(path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
