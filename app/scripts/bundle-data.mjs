// Copies the repo's data/ (the compendium JSON, English and Spanish) into the built app, for the
// GitHub Pages site and the Android app: they read it while GitHub isn't configured. Characters
// are not copied (they are personal); an empty characters/index.json says there are none.
//   node scripts/bundle-data.mjs dist/app/browser
import { cpSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? join(app, 'dist/app/browser'));
cpSync(join(app, '..', 'data'), join(out, 'data'), {
  recursive: true,
  filter: (p) => statSync(p).isDirectory() || p.endsWith('.json'),
});
mkdirSync(join(out, 'characters'), { recursive: true });
writeFileSync(join(out, 'characters', 'index.json'), '[]\n');
console.log(`data/ copied into ${out}`);

// version.json: the commit this site was built from (GitHub Actions sets GITHUB_SHA). The app reads
// it from the network and compares it with its own APP_COMMIT (Settings → Version): a different
// commit means a newer version is published than the one on screen.
const version = { commit: process.env.GITHUB_SHA ?? null, builtAt: new Date().toISOString() };
writeFileSync(join(out, 'version.json'), JSON.stringify(version) + '\n');
console.log(`version.json: ${version.commit ?? '(no commit: local build)'}`);
