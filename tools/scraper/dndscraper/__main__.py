"""python -m dndscraper [--offline] [--delay SECONDS] [--no-translate]"""

import argparse
import json
from pathlib import Path

from .pipeline import run


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offline", action="store_true", help="use only the local cache, download nothing")
    ap.add_argument("--delay", type=float, default=0.5, help="seconds between requests (default 0.5)")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3],
                    help="repository root (default: inferred)")
    ap.add_argument("--no-translate", action="store_true", help="skip the Spanish translation (data/es)")
    ap.add_argument("--translate-budget", type=float, default=60,
                    help="minutes to keep waiting when the translator asks to slow down (default 60)")
    args = ap.parse_args()
    meta = run(args.root, offline=args.offline, delay=args.delay, translate=not args.no_translate,
               translate_budget=args.translate_budget)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
