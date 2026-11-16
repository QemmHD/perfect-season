// Run a shared QA script (scripts/qa/*.mjs) the nba team's isolated way (Claude 2026-11-16):
//   node scripts/audit/nba-qa-run.mjs scripts/qa/gameplay.mjs [args…]
// - against the team's own dev server (PS_QA_URL = http://localhost:5215/), which must be up
// - with nba-qa-preload.mjs loaded first, so every browser it launches aborts requests and
//   WebSockets to any other host (the guard sits on the Route itself, so the script's own
//   page.route(...).continue() can't get past it: nba-guard.mjs) and talks to the team's relay on
//   7795 (started here for the run)
// - online.mjs brings its own relay on 7777: it runs only while this process holds
//   `flock /tmp/ps-qa-relay-7777.lock`, so two teams never share that port
// It refuses to run (exit 2) when: the script isn't a repo QA script; it talks to a live backend
// (admin-registry, cloud-backend, or any remote host in its source or in any local module it
// imports, followed transitively); the dev server isn't up; or the guard's self-test
// (nba-qa-selftest.mjs, run under the same preload) shows any way past the guard.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, needServer, SHOTS } from './nba-lib.mjs';
import { startRelay } from './nba-relay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PRELOAD = path.join(HERE, 'nba-qa-preload.mjs');
const SELFTEST = path.join(HERE, 'nba-qa-selftest.mjs');
/** shared scripts that exist to talk to a live backend: never run from here */
const REFUSED = new Set(['admin-registry.mjs', 'cloud-backend.mjs']);
const REMOTE = /\b(?:https?|wss?):\/\/(?!localhost\b|127\.0\.0\.1\b)[a-z0-9.-]+\.[a-z]{2,}/i;

function refuse(why) {
  console.error('nba-qa-run: refused: ' + why);
  process.exit(2);
}

const [target, ...args] = process.argv.slice(2);
if (!target) refuse('usage: node scripts/audit/nba-qa-run.mjs scripts/qa/<script>.mjs [args]');
const file = path.resolve(ROOT, target);
const rel = path.relative(ROOT, file);
if (!/^scripts\/(qa|audit)\/[\w.-]+\.mjs$/.test(rel) || !fs.existsSync(file)) refuse(`${target} is not a QA script in this worktree`);
if (REFUSED.has(path.basename(file))) refuse(`${rel} talks to a live backend`);
/** a local module an import names, as a file (./x, ./x.mjs, ./x/index.js…), or null */
function resolveLocal(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const f of [base, ...['.mjs', '.js', '.cjs', '.ts', '.json'].map((e) => base + e), ...['index.mjs', 'index.js'].map((i) => path.join(base, i))])
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  return null;
}
/** the static gate: the script and every local module it imports (relative specifiers, transitively) */
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;
const seen = new Set();
function scan(f) {
  if (seen.has(f)) return;
  seen.add(f);
  const r = path.relative(ROOT, f);
  if (r.startsWith('..')) refuse(`${rel} imports ${f}, outside this worktree`);
  if (REFUSED.has(path.basename(f))) refuse(`${r} talks to a live backend`);
  const src = fs.readFileSync(f, 'utf8');
  const remote = src.match(REMOTE);
  if (remote) refuse(`${r}${f === file ? '' : ` (imported by ${rel})`} names a remote host (${remote[0]})`);
  for (const m of src.matchAll(IMPORT)) {
    const dep = resolveLocal(f, m[2]);
    if (dep) scan(dep);
  }
}
scan(file);
if (!fs.existsSync(PRELOAD) || !fs.existsSync(SELFTEST)) refuse('the isolation preload or its self-test is missing');
await needServer().catch((e) => refuse(e.message));

// the dry run: under the same preload, the guard's self-test must find no way past it (a page-level
// continue() to a host that isn't allowed, URL overrides, route.fetch, API requests, unroute, sockets…)
const probe = spawnSync(process.execPath, ['--import', PRELOAD, SELFTEST], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
if (probe.status !== 0) refuse('the guard self-test failed: ' + (probe.stdout + probe.stderr).trim().split('\n').filter((l) => /FAIL|Error|refus/.test(l)).slice(0, 6).join(' | '));
console.log(`nba-qa-run: guard self-test passed; static scan covered ${seen.size} file(s)`);

const online = path.basename(file) === 'online.mjs';
const env = { ...process.env, PS_QA_PROXY: '', PS_QA_URL: BASE, PS_QA_ARTIFACTS: process.env.PS_QA_ARTIFACTS || path.join(SHOTS, 'qa'), NBA_QA_KEEP_RELAY: online ? '1' : '' };
const relay = online ? null : startRelay();
if (relay) await relay.ready.catch((e) => (e.code === 'EADDRINUSE' ? console.log('nba-qa-run: relay 7795 already up, using it') : refuse('relay: ' + e.message)));
const cmd = online ? ['flock', ['/tmp/ps-qa-relay-7777.lock', process.execPath, '--import', PRELOAD, file, ...args]] : [process.execPath, ['--import', PRELOAD, file, ...args]];
console.log(`nba-qa-run: ${rel} → ${BASE}${online ? ' (relay 7777 under its lock)' : ' (relay 7795)'}`);
const child = spawn(cmd[0], cmd[1], { cwd: ROOT, env, stdio: 'inherit' });
const code = await new Promise((resolve) => child.on('exit', (c, sig) => resolve(c ?? (sig ? 1 : 0))));
if (relay) await relay.close().catch(() => {});
process.exit(code);
