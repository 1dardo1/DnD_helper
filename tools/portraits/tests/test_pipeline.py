import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from portraits import catalog, cli, imaging
from portraits.catalog import Kind
from portraits.providers import FakeProvider, QuotaExceeded

YAML = """
style: >-
  Ink sketch on parchment,
  single figure.
negative: text
species:
  elf:
    prompt: >-
      A slender elf
      with pointed ears.
    seed: 11
  dwarf:
    prompt: A stout dwarf.
    seed: 22
  tabaxi:
    prompt: A cat person.
  kobold:
    prompt: A small reptile.
    skip: true
  nobody:
    prompt: Not in the data.
"""

DATA = [
    {"id": "dwarf", "name": "Dwarf"},
    {"id": "elf", "name": "Elf"},
    {"id": "human", "name": "Human"},
    {"id": "kobold", "name": "Kobold"},
    {"id": "tabaxi", "name": "Tabaxi"},
]
DATA_ES = [{"id": "dwarf", "name": "Enano"}, {"id": "elf", "name": "Elfo"}]


class Sandbox:
    """A temporary data/, prompts file and pictures folder."""

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "data" / "es").mkdir(parents=True)
        (root / "data" / "species.json").write_text(json.dumps(DATA))
        (root / "data" / "es" / "species.json").write_text(json.dumps(DATA_ES))
        (root / "species.yaml").write_text(YAML)
        self.root = root
        self.out = root / "out"
        self.kind = Kind("species", root / "data" / "species.json", root / "data" / "es" / "species.json", root / "species.yaml", root / "pictures")

    def run(self, *args, provider=None):
        provider = provider or FakeProvider(square=True)
        buf = io.StringIO()
        with mock.patch.dict(cli.KINDS, {"species": self.kind}), mock.patch.object(cli, "make_provider", lambda name: provider), contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            rc = cli.main(["species", "--out", str(self.out), *args])
        return rc, buf.getvalue(), provider

    def pics(self):
        return sorted(p.stem for p in self.out.glob("*.webp"))

    def close(self):
        self.tmp.cleanup()


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox()

    def tearDown(self):
        self.box.close()

    def test_load(self):
        cat = catalog.load(self.box.kind)
        e = cat.by_id()
        self.assertEqual(cat.style, "Ink sketch on parchment, single figure.")
        self.assertEqual(e["elf"].full_prompt, "Ink sketch on parchment, single figure. Elf: A slender elf with pointed ears.")
        self.assertEqual(e["elf"].name_es, "Elfo")
        self.assertEqual(e["tabaxi"].name_es, "Tabaxi")  # no Spanish name: the English one
        self.assertEqual(e["elf"].seed, 11)
        self.assertIsInstance(e["tabaxi"].seed, int)  # no seed: a fixed one from the id
        self.assertEqual(e["tabaxi"].seed, catalog.load(self.box.kind).by_id()["tabaxi"].seed)
        self.assertFalse(e["kobold"].drawable)
        self.assertFalse(e["human"].drawable)
        text = "\n".join(cat.warnings)
        self.assertIn("human", text)  # in the data, no prompt
        self.assertIn("nobody", text)  # prompt, not in the data
        self.assertNotIn("kobold", text)  # skip is not a warning

    def test_hash_follows_prompt_and_negative(self):
        a = catalog.prompt_hash("x", "n")
        self.assertEqual(a, catalog.prompt_hash("x", "n"))
        self.assertNotEqual(a, catalog.prompt_hash("y", "n"))
        self.assertNotEqual(a, catalog.prompt_hash("x", "m"))

    def test_index_matches_sync_dev_data(self):
        pics = self.box.root / "pics"
        self.assertEqual(catalog.write_index(pics), [])
        self.assertEqual((pics / "index.json").read_text(), "[]\n")
        for i in ("elf", "air-genasi", "dwarf"):
            (pics / f"{i}.webp").write_bytes(b"x")
        (pics / "notes.txt").write_text("x")
        catalog.write_index(pics)
        # JSON.stringify(ids, null, 2) + "\n"
        self.assertEqual((pics / "index.json").read_text(), '[\n  "air-genasi",\n  "dwarf",\n  "elf"\n]\n')


class ImagingTests(unittest.TestCase):
    def _img(self, size, color=(180, 150, 100)):
        buf = io.BytesIO()
        Image.new("RGB", size, color).save(buf, "PNG")
        return buf.getvalue()

    def test_square_becomes_portrait_webp(self):
        out = imaging.to_webp(self._img((1024, 1024)))
        img = Image.open(io.BytesIO(out))
        self.assertEqual((img.format, img.size), ("WEBP", (480, 640)))

    def test_tall_and_already_portrait(self):
        for size in ((500, 1500), (768, 1024)):
            img = Image.open(io.BytesIO(imaging.to_webp(self._img(size))))
            self.assertEqual(img.size, (480, 640))

    def test_heavy_picture_is_compressed(self):
        noisy = Image.effect_noise((1024, 1024), 120).convert("RGB")
        buf = io.BytesIO()
        noisy.save(buf, "PNG")
        out = imaging.to_webp(buf.getvalue(), max_bytes=40_000)
        self.assertLess(len(out), len(imaging.to_webp(buf.getvalue(), max_bytes=10**9)))

    def test_invalid(self):
        with self.assertRaises(ValueError):
            imaging.to_webp(b"not an image")


class QuotaAfter(FakeProvider):
    """Works n times, then says the daily quota is used up."""

    def __init__(self, n):
        super().__init__(square=True)
        self.n = n

    def generate(self, *a, **kw):
        if len(self.calls) >= self.n:
            raise QuotaExceeded("daily free allocation used up")
        return super().generate(*a, **kw)


class Flaky(FakeProvider):
    def __init__(self, bad):
        super().__init__()
        self.bad = bad

    def generate(self, prompt, seed, size, negative=None, label=""):
        if label in self.bad:
            from portraits.providers import ProviderError

            raise ProviderError("HTTP 400: nope")
        return super().generate(prompt, seed, size, negative, label)


class CliTests(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox()

    def tearDown(self):
        self.box.close()

    def test_generates_missing_then_nothing(self):
        rc, log, p = self.box.run()
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.box.pics(), ["dwarf", "elf", "tabaxi"])
        self.assertEqual(json.loads((self.box.out / "index.json").read_text()), ["dwarf", "elf", "tabaxi"])
        self.assertEqual(p.calls[0]["size"], cli.REQUEST_SIZE)
        rec = json.loads((self.box.out / "generated.json").read_text())["species"]
        self.assertEqual(rec["elf"]["seed"], 11)
        self.assertEqual(rec["elf"]["provider"], "fake")
        self.assertEqual(rec["elf"]["hash"], catalog.load(self.box.kind).by_id()["elf"].hash)
        review = (self.box.out / "review.html").read_text()
        for text in ("Elfo", "Enano", "data:image/webp;base64,", "A slender elf with pointed ears.", "seed 11"):
            self.assertIn(text, review)
        rc, log, p = self.box.run()
        self.assertEqual((rc, p.calls), (0, []))
        self.assertIn("Nada que generar", log)

    def test_only_and_force(self):
        self.box.run()
        rc, _, p = self.box.run("--only", "elf")
        self.assertEqual([c["label"] for c in p.calls], ["elf"])
        rc, _, p = self.box.run("--force")
        self.assertEqual(len(p.calls), 3)
        with self.assertRaises(SystemExit):
            self.box.run("--only", "nope")

    def test_changed(self):
        self.box.run()
        yaml_path = self.box.root / "species.yaml"
        yaml_path.write_text(YAML.replace("seed: 22", "seed: 23").replace("A slender elf", "A tall elf"))
        rc, _, p = self.box.run()
        self.assertEqual(p.calls, [])  # without --changed nothing is redone
        rc, _, p = self.box.run("--changed")
        self.assertEqual(sorted(c["label"] for c in p.calls), ["dwarf", "elf"])
        rc, _, p = self.box.run("--changed")
        self.assertEqual(p.calls, [])

    def test_limit(self):
        rc, _, p = self.box.run("--limit", "2")
        self.assertEqual(len(p.calls), 2)
        rc, _, p = self.box.run()
        self.assertEqual(len(p.calls), 1)

    def test_quota_keeps_whats_done(self):
        summary = self.box.root / "summary.md"
        rc, log, _ = self.box.run("--summary", str(summary), provider=QuotaAfter(1))
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.box.pics(), ["dwarf"])
        self.assertIn("Parado", log)
        self.assertIn("Pendientes de esta selección: **2**", summary.read_text())
        self.assertEqual(json.loads((self.box.out / "index.json").read_text()), ["dwarf"])
        rc, _, p = self.box.run()  # next run goes on
        self.assertEqual(sorted(c["label"] for c in p.calls), ["elf", "tabaxi"])

    def test_one_failure_goes_on(self):
        rc, log, _ = self.box.run(provider=Flaky({"elf"}))
        self.assertEqual(rc, 1)
        self.assertEqual(self.box.pics(), ["dwarf", "tabaxi"])
        self.assertIn("falló", (self.box.out / "review.html").read_text())

    def test_missing_credentials(self):
        summary = self.box.root / "summary.md"
        with mock.patch.dict("os.environ", {"CLOUDFLARE_ACCOUNT_ID": "", "CLOUDFLARE_API_TOKEN": ""}):
            buf = io.StringIO()
            with mock.patch.dict(cli.KINDS, {"species": self.box.kind}), contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                rc = cli.main(["species", "--out", str(self.box.out), "--summary", str(summary)])
        self.assertEqual(rc, 2)
        self.assertIn("CLOUDFLARE_ACCOUNT_ID", buf.getvalue())
        self.assertEqual(self.box.pics(), [])

    def test_dry_run_writes_nothing(self):
        rc, log, p = self.box.run("--dry-run")
        self.assertEqual((rc, p.calls), (0, []))
        self.assertFalse(self.box.out.exists())
        self.assertIn("Elf: A slender elf", log)


if __name__ == "__main__":
    unittest.main()
