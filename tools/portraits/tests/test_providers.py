import base64
import io
import json
import unittest

import requests
from PIL import Image

from portraits.providers import AuthError, CloudflareProvider, FakeProvider, ProviderError, QuotaExceeded

ACCOUNT = "acc0123456789abcdef"
TOKEN = "tok-SECRET-value-xyz"


def jpeg(size=(64, 64)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 180, 140)).save(buf, "JPEG")
    return buf.getvalue()


class FakeResponse:
    def __init__(self, status=200, body=None, headers=None, content=None):
        self.status_code = status
        self._body = body
        self.headers = headers or {"Content-Type": "application/json"}
        self.content = content if content is not None else (json.dumps(body).encode() if body is not None else b"")
        self.text = self.content.decode("latin-1")

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


def ok(img=None):
    return FakeResponse(200, {"result": {"image": base64.b64encode(img or jpeg()).decode()}, "success": True, "errors": [], "messages": []})


def err(status, code=None, message="error"):
    errors = [{"code": code, "message": message}] if code is not None else [{"message": message}]
    return FakeResponse(status, {"result": None, "success": False, "errors": errors, "messages": []})


class FakeSession:
    """Answers each post with the next response (or raises it, if it's an exception)."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def post(self, url, headers=None, data=None, timeout=None):
        self.calls.append({"url": url, "headers": headers, "body": json.loads(data)})
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def provider(*responses):
    session = FakeSession(*responses)
    sleeps = []
    p = CloudflareProvider(ACCOUNT, TOKEN, session=session, sleep=sleeps.append)
    return p, session, sleeps


class CloudflareTests(unittest.TestCase):
    def test_success_decodes_base64_and_sends_the_documented_request(self):
        img = jpeg((100, 100))
        p, s, _ = provider(ok(img))
        self.assertEqual(p.generate("a dwarf", 42, (768, 1024)), img)
        call = s.calls[0]
        self.assertEqual(
            call["url"],
            f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/ai/run/@cf/black-forest-labs/flux-1-schnell",
        )
        self.assertEqual(call["headers"]["Authorization"], f"Bearer {TOKEN}")
        # only properties the model accepts: no width/height
        self.assertEqual(call["body"], {"prompt": "a dwarf", "steps": 4, "seed": 42})
        self.assertTrue(p.seed_applied)

    def test_raw_image_answer(self):
        img = jpeg()
        p, _, _ = provider(FakeResponse(200, None, {"Content-Type": "image/jpeg"}, img))
        self.assertEqual(p.generate("x", 1, (512, 512)), img)

    def test_daily_quota_stops_without_retrying(self):
        p, s, sleeps = provider(err(429, 3036, "You have used up your daily free allocation of 10,000 neurons."))
        with self.assertRaises(QuotaExceeded):
            p.generate("x", 1, (512, 512))
        self.assertEqual(len(s.calls), 1)
        self.assertEqual(sleeps, [])

    def test_out_of_capacity_retries_then_stops(self):
        p, s, sleeps = provider(err(429, 3040, "Capacity temporarily exceeded"), err(429, 3040), err(429, 3040))
        with self.assertRaises(QuotaExceeded):
            p.generate("x", 1, (512, 512))
        self.assertEqual(len(s.calls), 3)
        self.assertEqual(len(sleeps), 2)

    def test_rate_limit_then_success(self):
        retry = FakeResponse(429, {"success": False, "errors": []}, {"Content-Type": "application/json", "Retry-After": "7"})
        p, _, sleeps = provider(retry, ok())
        self.assertTrue(p.generate("x", 1, (512, 512)))
        self.assertEqual(sleeps, [7.0])

    def test_server_error_retries(self):
        p, s, sleeps = provider(err(500, 1000, "internal"), FakeResponse(502, None, {"Content-Type": "text/html"}, b"bad gateway"), ok())
        self.assertTrue(p.generate("x", 1, (512, 512)))
        self.assertEqual(len(s.calls), 3)
        self.assertEqual(len(sleeps), 2)

    def test_server_error_gives_up(self):
        p, _, _ = provider(err(503), err(503), err(503))
        with self.assertRaisesRegex(ProviderError, "503") as cm:
            p.generate("x", 1, (512, 512))
        self.assertNotIsInstance(cm.exception, QuotaExceeded)

    def test_network_error_retries(self):
        p, _, _ = provider(requests.ConnectionError(f"failed /client/v4/accounts/{ACCOUNT}/ai"), ok())
        self.assertTrue(p.generate("x", 1, (512, 512)))

    def test_auth_errors(self):
        for status in (401, 403):
            p, s, _ = provider(err(status, 10000, "Authentication error"))
            with self.assertRaises(AuthError):
                p.generate("x", 1, (512, 512))
            self.assertEqual(len(s.calls), 1)

    def test_other_client_error_fails_only_this_picture(self):
        p, _, _ = provider(err(413, 3006, "Request is too large"))
        with self.assertRaisesRegex(ProviderError, "413"):
            p.generate("x", 1, (512, 512))

    def test_seed_rejected_is_dropped(self):
        p, s, _ = provider(err(400, 5006, "Error: required properties at '/' are 'prompt'; additional property seed"), ok(), ok())
        self.assertTrue(p.generate("x", 1, (512, 512)))
        self.assertFalse(p.seed_applied)
        self.assertEqual(s.calls[1]["body"], {"prompt": "x", "steps": 4})
        p.generate("y", 2, (512, 512))  # no more seeds afterwards
        self.assertNotIn("seed", s.calls[2]["body"])

    def test_bad_request_without_seed_is_an_error(self):
        p, s, _ = provider(err(400, 5004, "bad"), err(400, 5004, "bad"))
        with self.assertRaisesRegex(ProviderError, "400"):
            p.generate("x", 1, (512, 512))
        self.assertEqual(len(s.calls), 2)
        self.assertTrue(p.seed_applied)

    def test_success_false_with_status_200(self):
        p, _, _ = provider(FakeResponse(200, {"success": False, "errors": [{"code": 7000, "message": "oops"}]}))
        with self.assertRaisesRegex(ProviderError, "oops"):
            p.generate("x", 1, (512, 512))

    def test_credentials_never_in_errors(self):
        p, _, _ = provider(err(401, 10000, f"bad token {TOKEN} for {ACCOUNT}"))
        with self.assertRaises(AuthError) as cm:
            p.generate("x", 1, (512, 512))
        self.assertNotIn(TOKEN, str(cm.exception))
        self.assertNotIn(ACCOUNT, str(cm.exception))
        p, _, _ = provider(*(requests.ConnectionError(f"https://api/{ACCOUNT}/x {TOKEN}") for _ in range(3)))
        with self.assertRaises(ProviderError) as cm:
            p.generate("x", 1, (512, 512))
        self.assertNotIn(TOKEN, str(cm.exception))
        self.assertNotIn(ACCOUNT, str(cm.exception))

    def test_missing_credentials(self):
        with self.assertRaisesRegex(AuthError, "CLOUDFLARE_API_TOKEN"):
            CloudflareProvider("", "")
        with self.assertRaises(AuthError):
            CloudflareProvider(ACCOUNT, "  ".strip())

    def test_prompt_too_long(self):
        p, s, _ = provider()
        with self.assertRaisesRegex(ProviderError, "2048"):
            p.generate("x" * 2049, 1, (512, 512))
        self.assertEqual(s.calls, [])


class FakeProviderTests(unittest.TestCase):
    def test_draws_requested_size_and_is_deterministic(self):
        f = FakeProvider()
        a = f.generate("p", 3, (300, 400), label="elf")
        self.assertEqual(Image.open(io.BytesIO(a)).size, (300, 400))
        self.assertEqual(a, FakeProvider().generate("p", 3, (300, 400), label="elf"))
        self.assertNotEqual(a, f.generate("p", 4, (300, 400), label="elf"))

    def test_square_mode(self):
        a = FakeProvider(square=True).generate("p", 3, (300, 400))
        self.assertEqual(Image.open(io.BytesIO(a)).size, (400, 400))


if __name__ == "__main__":
    unittest.main()
