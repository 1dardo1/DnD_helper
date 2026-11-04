"""kind=monsters: same pipeline as the species, pictures outside the app (media/monsters/)."""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml

from portraits import catalog, cli
from portraits.catalog import Kind
from portraits.providers import FakeProvider, QuotaExceeded

YAML = """
style: Bestiary ink sketch, a single creature.
negative: text
monsters:
  goblin-warrior:
    prompt: A small goblin with a scimitar.
    seed: 1
  owlbear:
    prompt: A bear with an owl's head.
    seed: 2
  adult-red-dragon:
    prompt: A huge red dragon.
  lich:
    prompt: An undead wizard.
    skip: true
"""

DATA = [
    {"id": "adult-red-dragon", "type": "monster", "name": "Adult Red Dragon", "cr": 17},
    {"id": "goblin-warrior", "type": "monster", "name": "Goblin Warrior", "cr": 0.25},
    {"id": "lich", "type": "monster", "name": "Lich", "cr": 21},
    {"id": "owlbear", "type": "monster", "name": "Owlbear", "cr": 3},
    {"id": "zombie", "type": "monster", "name": "Zombie", "cr": 0.25},
]
DATA_ES = [{"id": "goblin-warrior", "name": "Guerrero trasgo"}, {"id": "owlbear", "name": "Osolechuza"}]


class QuotaAfter(FakeProvider):
    def __init__(self, n):
        super().__init__(square=True)
        self.n = n

    def generate(self, *a, **kw):
        if len(self.calls) >= self.n:
            raise QuotaExceeded("daily free allocation used up")
        return super().generate(*a, **kw)


class MonsterSandbox:
    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "data" / "es").mkdir(parents=True)
        (root / "data" / "monsters.json").write_text(json.dumps(DATA))
        (root / "data" / "es" / "monsters.json").write_text(json.dumps(DATA_ES))
        (root / "monsters.yaml").write_text(YAML)
        self.root = root
        self.pictures = root / "media" / "monsters"
        self.kind = Kind("monsters", root / "data" / "monsters.json", root / "data" / "es" / "monsters.json", root / "monsters.yaml", self.pictures)

    def run(self, *args, provider=None):
        provider = provider or FakeProvider(square=True)
        buf = io.StringIO()
        argv = ["monsters", "--out", str(self.pictures), *args]
        with mock.patch.dict(cli.KINDS, {"monsters": self.kind}), mock.patch.object(cli, "make_provider", lambda name: provider), contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            rc = cli.main(argv)
        return rc, buf.getvalue(), provider

    def pics(self):
        return sorted(p.stem for p in self.pictures.glob("*.webp"))

    def close(self):
        self.tmp.cleanup()


class MonsterKindTests(unittest.TestCase):
    def test_monsters_live_outside_the_app(self):
        k = cli.KINDS["monsters"]
        self.assertEqual(k.pictures, catalog.REPO / "media" / "monsters")
        self.assertEqual(k.data, catalog.REPO / "data" / "monsters.json")
        self.assertEqual(k.prompts, catalog.HERE / "monsters.yaml")
        self.assertNotIn("app", k.pictures.relative_to(catalog.REPO).parts)
        # species unchanged: inside the app
        self.assertEqual(cli.KINDS["species"].pictures, catalog.REPO / "app" / "public" / "species")

    def test_cli_accepts_monsters(self):
        self.assertEqual(cli.parse_args(["monsters"]).kind, "monsters")

    def test_committed_index_is_a_list(self):
        index = catalog.REPO / "media" / "monsters" / "index.json"
        ids = json.loads(index.read_text(encoding="utf-8"))
        self.assertIsInstance(ids, list)
        on_disk = sorted(p.stem for p in index.parent.glob("*.webp"))
        self.assertEqual(ids, on_disk, "media/monsters/index.json no coincide con las imágenes")

    def test_real_prompts_file(self):
        """tools/portraits/monsters.yaml: valid, with a style, and every id is a real monster."""
        conf = yaml.safe_load((catalog.HERE / "monsters.yaml").read_text(encoding="utf-8"))
        self.assertTrue(str(conf.get("style") or "").strip())
        ids = {m["id"] for m in json.loads((catalog.REPO / "data" / "monsters.json").read_text(encoding="utf-8"))}
        unknown = sorted(set(conf["monsters"]) - ids)
        self.assertEqual(unknown, [], "ids de monsters.yaml que no están en data/monsters.json")
        cat = catalog.load(cli.KINDS["monsters"])
        self.assertTrue(any(e.drawable for e in cat.entries))


class MonsterCliTests(unittest.TestCase):
    def setUp(self):
        self.box = MonsterSandbox()

    def tearDown(self):
        self.box.close()

    def test_load(self):
        e = catalog.load(self.box.kind).by_id()
        self.assertEqual(e["owlbear"].full_prompt, "Bestiary ink sketch, a single creature. Owlbear: A bear with an owl's head.")
        self.assertEqual(e["owlbear"].name_es, "Osolechuza")
        self.assertFalse(e["lich"].drawable)  # skip
        self.assertFalse(e["zombie"].drawable)  # no prompt yet

    def test_generates_into_the_pictures_folder(self):
        rc, log, p = self.box.run()
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.box.pics(), ["adult-red-dragon", "goblin-warrior", "owlbear"])
        self.assertEqual(json.loads((self.box.pictures / "index.json").read_text()), ["adult-red-dragon", "goblin-warrior", "owlbear"])
        self.assertEqual([c["label"] for c in p.calls], ["adult-red-dragon", "goblin-warrior", "owlbear"])  # data order
        self.assertIn("monsters: 3 con prompt, 3 por generar", log)

    def test_record_and_review_are_per_kind(self):
        rc, log, _ = self.box.run()
        rec = json.loads((self.box.pictures / "generated.json").read_text())
        self.assertEqual(sorted(rec), ["monsters"])
        self.assertEqual(rec["monsters"]["goblin-warrior"]["seed"], 1)
        review = (self.box.pictures / "review.html").read_text()
        for text in ("Retratos: monsters", "Guerrero trasgo", "tools/portraits/monsters.yaml", "data:image/webp;base64,"):
            self.assertIn(text, review)

    def test_quota_then_next_run_goes_on(self):
        """331 monsters don't fit in one day's quota: stop, keep what's done, go on next time."""
        rc, log, _ = self.box.run(provider=QuotaAfter(2))
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.box.pics(), ["adult-red-dragon", "goblin-warrior"])
        self.assertIn("Parado", log)
        rc, _, p = self.box.run()
        self.assertEqual([c["label"] for c in p.calls], ["owlbear"])
        rc, log, p = self.box.run()
        self.assertEqual(p.calls, [])
        self.assertIn("Nada que generar", log)

    def test_status(self):
        rc, log, _ = self.box.run("--status")
        self.assertEqual(rc, 0)
        self.assertEqual(log.splitlines()[-2:], ["total=3", "pending=3"])
        self.box.run("--limit", "1")
        rc, log, _ = self.box.run("--status")
        lines = dict(line.split("=", 1) for line in log.splitlines())
        self.assertEqual((lines["total"], lines["pending"]), ("3", "2"))
        self.assertTrue(lines["pictures"].endswith("media/monsters"))
        # status alone writes nothing (only the one picture from --limit 1)
        self.assertEqual(len(self.box.pics()), 1)

    def test_status_default_folder_is_relative_to_the_repo(self):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            cli.main(["monsters", "--status"])
        self.assertIn("pictures=media/monsters\n", buf.getvalue())
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            cli.main(["species", "--status"])
        self.assertIn("pictures=app/public/species\n", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
