// Copies the repo's data/ and characters/ JSON files into .dev-data/, which the development
// build serves as /data and /characters (Angular only serves folders inside the project), and the
// monster pictures (media/monsters/) as /monsters.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, '.dev-data');
rmSync(out, { recursive: true, force: true });
for (const dir of ['data', 'characters']) {
  const src = join(app, '..', dir);
  mkdirSync(join(out, dir), { recursive: true });
  if (existsSync(src)) {
    cpSync(src, join(out, dir), {
      recursive: true,
      filter: (p) => statSync(p).isDirectory() || p.endsWith('.json'),
    });
  }
}
// A static server can't list folders: characters/index.json is the list of character files.
const characters = readdirSync(join(out, 'characters')).filter((f) => f.endsWith('.json'));
writeFileSync(
  join(out, 'characters', 'index.json'),
  JSON.stringify(characters.map((f) => `characters/${f}`)),
);
console.log('dev data copied to .dev-data/');

// <folder>/index.json: the ids of the pictures in a folder (<id>.webp), so the app only asks for the
// ones that exist. Committed (the builds use it as is); rewritten here, so `npm start` / `npm test`
// keep it up to date when pictures are added or removed. tools/portraits writes it the same way.
function writeIndex(pictures, label) {
  const ids = existsSync(pictures)
    ? readdirSync(pictures)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.slice(0, -'.webp'.length))
        .sort()
    : [];
  const manifest = join(pictures, 'index.json');
  const json = JSON.stringify(ids, null, 2) + '\n';
  if (!existsSync(manifest) || readFileSync(manifest, 'utf8') !== json) {
    mkdirSync(pictures, { recursive: true });
    writeFileSync(manifest, json);
    console.log(`${label} pictures: ${ids.length} listed in ${manifest}`);
  }
}

// Species: public/species/, inside the app.
writeIndex(join(app, 'public', 'species'), 'species');

// Monsters: ../media/monsters/, outside the app (only published on GitHub Pages, see
// media/monsters/README.md). The development server serves this copy as monsters/.
const monsters = join(app, '..', 'media', 'monsters');
writeIndex(monsters, 'monster');
mkdirSync(join(out, 'monsters'), { recursive: true });
cpSync(monsters, join(out, 'monsters'), {
  recursive: true,
  filter: (p) => p === monsters || p.endsWith('.webp') || p.endsWith('/index.json'),
});
