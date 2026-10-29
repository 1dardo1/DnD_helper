// Copies the repo's data/ and characters/ JSON files into .dev-data/, which the development
// build serves as /data and /characters (Angular only serves folders inside the project).
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
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
console.log('dev data copied to .dev-data/');
