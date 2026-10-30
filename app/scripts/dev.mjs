// `npm start`: runs ng serve plus a small helper for the app's "Update" button, because a web page
// can't run git by itself. The helper only listens on this PC, only accepts the app's own page and
// only does one fixed thing: git pull, then whatever the pulled files need (see update()).
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const HELPER_PORT = 4201;
const APP_ORIGIN = 'http://localhost:4200';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const ngCli = join(app, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const run = promisify(execFile);

let server = null;
let restarting = false;
let busy = false;

function startServer() {
  server = spawn(process.execPath, [ngCli, 'serve'], { cwd: app, stdio: 'inherit' });
  server.on('exit', (code) => {
    if (!restarting) process.exit(code ?? 0);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once('exit', resolve);
    server.kill();
  });
}

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    const ok = await fetch(`${APP_ORIGIN}/`).then(
      (res) => res.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('ng serve did not start again');
}

async function git(...args) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  return (await run('git', args, { cwd: app, env })).stdout.trim();
}

function npm(command) {
  return run(`npm ${command}`, { cwd: app, shell: true });
}

/**
 * Brings this copy up to date. --ff-only never touches uncommitted work: if the pull can't be done
 * cleanly it fails and the error is shown in the app. ng serve notices changes in src/ by itself;
 * dependencies and the files served as assets need it stopped and started again.
 */
async function update() {
  const before = await git('rev-parse', 'HEAD');
  await git('pull', '--ff-only');
  const after = await git('rev-parse', 'HEAD');
  if (before === after) return { commits: 0, restarted: false };

  const range = `${before}..${after}`;
  const commits = Number(await git('rev-list', '--count', range));
  const changed = (await git('diff', '--name-only', range)).split('\n');
  const dependencies = changed.some((f) => /^app\/package(-lock)?\.json$/.test(f));
  const assets = changed.some((f) =>
    /^(data|characters|app\/public)\/|^app\/angular\.json$/.test(f),
  );
  if (!dependencies && !assets) return { commits, restarted: false };

  restarting = true;
  await stopServer();
  try {
    if (dependencies) await npm('ci');
    await npm('run sync-dev-data');
  } finally {
    startServer();
    restarting = false;
  }
  await waitForServer();
  return { commits, restarted: true };
}

const helper = createServer(async (req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, {
      'Access-Control-Allow-Origin': APP_ORIGIN,
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(body));
  };

  // Other websites open in the browser can reach this port too: only the app itself may use it.
  const fromApp =
    req.headers.host === `127.0.0.1:${HELPER_PORT}` && req.headers.origin === APP_ORIGIN;
  if (!fromApp) return reply(403, { error: 'forbidden' });

  if (req.method === 'GET' && req.url === '/status') return reply(200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/update') return reply(404, { error: 'not found' });
  if (busy) return reply(409, { error: 'an update is already running' });

  busy = true;
  try {
    reply(200, await update());
  } catch (e) {
    // git prints progress on stderr too; the app only has room for the reason it failed.
    const output = (e.stderr || e.message).trim();
    reply(500, { error: output.split('\n').find((l) => /^(error|fatal):/.test(l)) ?? output });
  } finally {
    busy = false;
  }
});

helper.on('error', (e) => console.warn(`Update button not available: ${e.message}`));
helper.listen(HELPER_PORT, '127.0.0.1');

process.on('exit', () => server?.kill());
startServer();
