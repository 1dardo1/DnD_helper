"""Picture conversion: whatever the provider returns -> a light portrait WebP for the app."""

from __future__ import annotations

import io

from PIL import Image

# What the app wants (app/public/species/README.md): ~480 px wide, portrait, 30–80 KB.
WIDTH = 480
ASPECT = (3, 4)  # width : height
MAX_BYTES = 80_000
QUALITIES = (80, 75, 70, 65, 60)


def to_webp(data: bytes, width: int = WIDTH, aspect: tuple[int, int] = ASPECT, max_bytes: int = MAX_BYTES) -> bytes:
    """Crop to ``aspect`` (sides of a wide picture, centred; bottom of a tall one, keeping the
    head), scale to ``width`` and save as WebP, lowering the quality if it weighs too much."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:  # noqa: BLE001 - any decoding problem
        raise ValueError(f"no es una imagen válida ({e.__class__.__name__})") from None
    img = img.convert("RGB")
    w, h = img.size
    aw, ah = aspect
    if w * ah > h * aw:  # too wide: trim both sides
        nw = h * aw // ah
        left = (w - nw) // 2
        img = img.crop((left, 0, left + nw, h))
    elif w * ah < h * aw:  # too tall: keep the top (heads), trim the bottom
        nh = w * ah // aw
        top = min((h - nh) // 4, h - nh)
        img = img.crop((0, top, w, top + nh))
    height = round(width * ah / aw)
    if img.size != (width, height):
        img = img.resize((width, height), Image.LANCZOS)
    out = b""
    for q in QUALITIES:
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q, method=6)
        out = buf.getvalue()
        if len(out) <= max_bytes:
            break
    return out
