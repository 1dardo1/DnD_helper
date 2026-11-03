"""Image providers: anything that turns a prompt into picture bytes (JPEG/PNG/WebP...).

A provider is a small object with:

- ``name``: short id used on the command line and stored in generated.json.
- ``model``: what made the picture (stored in generated.json).
- ``generate(prompt, seed, size, negative=None, label="") -> bytes``: one picture. ``size`` is the
  (width, height) we'd like; providers that can't choose the size return what they make (e.g. a
  square) and the caller crops it. ``negative`` is used only by providers that support it.
- ``seed_applied``: False if the provider ignored the seed (the picture can't be regenerated
  identically).

Errors: ``QuotaExceeded`` (stop the run, keep what's done: the next run goes on), ``AuthError``
(stop: nothing will work until the credentials are fixed), ``ProviderError`` (this picture failed;
go on with the next one). To add another provider (Gemini, a local ComfyUI/Automatic1111...),
write a class like these and add it to ``PROVIDERS``.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import time
from typing import Callable

import requests
from PIL import Image, ImageDraw, ImageFont


class ProviderError(Exception):
    """This picture couldn't be made (the next one may work)."""


class QuotaExceeded(ProviderError):
    """Free allowance used up or rate limited: stop now, the next run goes on."""


class AuthError(ProviderError):
    """Missing or wrong credentials / permissions: stop now."""


class Provider:
    name = "base"
    model = ""
    seed_applied = True

    def generate(
        self,
        prompt: str,
        seed: int,
        size: tuple[int, int],
        negative: str | None = None,
        label: str = "",
    ) -> bytes:
        raise NotImplementedError


class FakeProvider(Provider):
    """Draws a placeholder (parchment, a silhouette, the id and seed): tests and dry runs."""

    name = "fake"
    model = "placeholder"

    def __init__(self, square: bool = False):
        # square=True mimics providers that can't make portrait pictures (like Cloudflare's FLUX)
        self.square = square
        self.calls: list[dict] = []

    def generate(self, prompt, seed, size, negative=None, label=""):
        self.calls.append({"prompt": prompt, "seed": seed, "size": size, "label": label})
        w, h = (max(size), max(size)) if self.square else size
        digest = hashlib.sha256(f"{prompt}|{seed}".encode()).digest()
        tint = (200 + digest[0] % 40, 170 + digest[1] % 40, 120 + digest[2] % 40)
        img = Image.new("RGB", (w, h), (236, 222, 190))
        draw = ImageDraw.Draw(img)
        # some texture, so the WebP weighs something like a real picture
        for i in range(0, 600):
            b = hashlib.sha256(digest + i.to_bytes(2, "big")).digest()
            x, y, r = b[0] * w // 256, b[1] * h // 256, 2 + b[2] % 14
            draw.ellipse((x - r, y - r, x + r, y + r), fill=(220 - b[3] % 50, 200 - b[4] % 50, 160 - b[5] % 50))
        cx = w // 2
        draw.ellipse((cx - w // 10, h // 8, cx + w // 10, h // 8 + w // 5), fill=tint, outline=(90, 60, 30), width=3)
        draw.rounded_rectangle((cx - w // 6, h // 8 + w // 5, cx + w // 6, h * 7 // 8), radius=w // 20, fill=tint, outline=(90, 60, 30), width=3)
        font = _font(max(14, w // 14))
        small = _font(max(12, w // 22))
        draw.text((cx, h - h // 14), label or "?", fill=(80, 30, 20), font=font, anchor="ms")
        draw.text((cx, h // 16), f"seed {seed}", fill=(80, 30, 20), font=small, anchor="ms")
        out = io.BytesIO()
        img.save(out, "JPEG", quality=90)
        return out.getvalue()


def _font(size: int):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


class CloudflareProvider(Provider):
    """Cloudflare Workers AI, FLUX.1 [schnell] (free: 10,000 neurons a day).

    Input schema (developers.cloudflare.com/workers-ai/models/flux-1-schnell): ``prompt`` (1–2048
    chars) and ``steps`` (≤ 8, default 4); no width/height, so the picture comes square (1024×1024)
    and is cropped later. The schema doesn't list ``seed`` (and forbids extra properties) although
    Cloudflare's own curl example sends one: we send it, and if the API answers 400 we retry once
    without it and stop sending it (``seed_applied`` becomes False and is noted in generated.json).
    """

    name = "cloudflare"
    model = "@cf/black-forest-labs/flux-1-schnell"
    API = "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    MAX_PROMPT = 2048
    # Workers AI error codes (developers.cloudflare.com/workers-ai/platform/errors)
    DAILY_LIMIT = 3036
    OUT_OF_CAPACITY = 3040

    def __init__(
        self,
        account_id: str,
        api_token: str,
        steps: int = 4,
        session=None,
        sleep: Callable[[float], None] = time.sleep,
        retries: int = 3,
        timeout: float = 120,
    ):
        if not account_id or not api_token:
            raise AuthError(
                "Faltan las credenciales de Cloudflare: define CLOUDFLARE_ACCOUNT_ID y "
                "CLOUDFLARE_API_TOKEN (ver tools/portraits/README.md)."
            )
        self._account = account_id.strip()
        self._token = api_token.strip()
        self.steps = max(1, min(8, steps))
        self.session = session or requests.Session()
        self.sleep = sleep
        self.retries = retries
        self.timeout = timeout
        self.send_seed = True
        self.seed_applied = True

    @classmethod
    def from_env(cls, **kw) -> "CloudflareProvider":
        return cls(os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""), os.environ.get("CLOUDFLARE_API_TOKEN", ""), **kw)

    def _clean(self, text: str) -> str:
        """Never let the credentials reach a log."""
        for secret in (self._token, self._account):
            if secret:
                text = text.replace(secret, "***")
        return text

    def generate(self, prompt, seed, size, negative=None, label=""):
        if len(prompt) > self.MAX_PROMPT:
            raise ProviderError(f"prompt de {len(prompt)} caracteres (máximo {self.MAX_PROMPT})")
        body = {"prompt": prompt, "steps": self.steps}
        if self.send_seed:
            body["seed"] = int(seed)
        try:
            return self._post(body)
        except _BadRequest as e:
            if "seed" not in body:
                raise ProviderError(str(e)) from None
            # the schema may reject "seed": try once without it
            del body["seed"]
            try:
                data = self._post(body)
            except _BadRequest as e2:
                raise ProviderError(str(e2)) from None
            self.send_seed = False
            self.seed_applied = False
            print(
                f"  aviso: la API rechazó 'seed' ({e}); se generan sin semilla "
                "(no se podrán repetir idénticas)."
            )
            return data

    def _post(self, body: dict) -> bytes:
        url = self.API.format(account=self._account, model=self.model)
        headers = {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}
        delay = 5.0
        last = "sin respuesta"
        for attempt in range(1, self.retries + 1):
            try:
                res = self.session.post(url, headers=headers, data=json.dumps(body), timeout=self.timeout)
            except requests.RequestException as e:
                last = self._clean(f"error de red: {e.__class__.__name__}: {e}")
            else:
                status = res.status_code
                codes, message = _errors(res)
                message = self._clean(message)
                if status == 200:
                    image = _image(res)
                    if image:
                        return image
                    # 200 with success: false or no image
                    last = f"respuesta sin imagen ({message or 'vacía'})"
                    if any(c == self.DAILY_LIMIT for c in codes):
                        raise QuotaExceeded(message)
                    raise ProviderError(last)
                if status in (401, 403):
                    raise AuthError(
                        f"HTTP {status}: {message or 'sin permiso'}. Revisa el Account ID y que el "
                        "token tenga el permiso Workers AI."
                    )
                if status == 429:
                    if self.DAILY_LIMIT in codes or "neurons" in message.lower() or "daily" in message.lower():
                        raise QuotaExceeded(f"cuota diaria gratuita agotada ({message or 'HTTP 429'})")
                    last = f"HTTP 429: {message or 'demasiadas peticiones'}"
                    if attempt == self.retries:
                        raise QuotaExceeded(last)
                    self.sleep(_retry_after(res, delay))
                    delay *= 3
                    continue
                if 400 <= status < 500 and status != 408:
                    if status == 400:
                        raise _BadRequest(f"HTTP 400: {message or 'petición no válida'}")
                    raise ProviderError(f"HTTP {status}: {message or 'error'}")
                # 408 and 5xx: transient
                last = f"HTTP {status}: {message or 'error del servidor'}"
            if attempt < self.retries:
                self.sleep(delay)
                delay *= 3
        raise ProviderError(last)


class _BadRequest(ProviderError):
    pass


def _errors(res) -> tuple[list[int], str]:
    """The error codes and messages of a Cloudflare API answer (``{"errors": [{code, message}]}``)."""
    try:
        data = res.json()
    except ValueError:
        text = (getattr(res, "text", "") or "").strip()
        return [], text[:300]
    if not isinstance(data, dict):
        return [], ""
    codes, messages = [], []
    for err in data.get("errors") or []:
        if isinstance(err, dict):
            if isinstance(err.get("code"), int):
                codes.append(err["code"])
            if err.get("message"):
                messages.append(f"{err['message']} [{err.get('code')}]" if err.get("code") else str(err["message"]))
        elif err:
            messages.append(str(err))
    return codes, "; ".join(messages)[:500]


def _image(res) -> bytes | None:
    """The picture in a 200 answer: JSON ``{"result": {"image": base64}}`` or the raw bytes."""
    ctype = (res.headers.get("Content-Type") or "").lower()
    if ctype.startswith("image/"):
        return res.content or None
    try:
        data = res.json()
    except ValueError:
        return None
    if not isinstance(data, dict) or data.get("success") is False:
        return None
    result = data.get("result")
    b64 = result.get("image") if isinstance(result, dict) else data.get("image")
    if not isinstance(b64, str) or not b64:
        return None
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[-1]
    try:
        return base64.b64decode(b64, validate=False)
    except ValueError:
        return None


def _retry_after(res, default: float) -> float:
    try:
        return min(120.0, max(1.0, float(res.headers.get("Retry-After"))))
    except (TypeError, ValueError):
        return default


PROVIDERS = {
    "cloudflare": CloudflareProvider.from_env,
    "fake": FakeProvider,
}


def make_provider(name: str) -> Provider:
    try:
        factory = PROVIDERS[name]
    except KeyError:
        raise SystemExit(f"Proveedor desconocido: {name} (hay: {', '.join(PROVIDERS)})") from None
    return factory()
