"""python -m dndscraper [--offline] [--delay SECONDS]"""

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
    args = ap.parse_args()
    meta = run(args.root, offline=args.offline, delay=args.delay)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
