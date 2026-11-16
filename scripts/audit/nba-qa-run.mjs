// Run a shared QA script (scripts/qa/*.mjs) the nba team's isolated way (Claude 2026-11-16):
//   node scripts/audit/nba-qa-run.mjs scripts/qa/gameplay.mjs [args…]
// - against the team's own dev server (PS_QA_URL = http://localhost:5215/), which must be up
// - with nba-qa-preload.mjs loaded first, so every browser it launches aborts requests and
//   WebSockets to any other host and talks to the team's relay on 7795 (started here for the run)
// - online.mjs brings its own relay on 7777: it runs only while this process holds
//   `flock /tmp/ps-qa-relay-7777.lock`, so two teams never share that port
// It refuses to run (exit 2) when: the script isn't a repo QA script; it talks to a live backend
// (admin-registry, cloud-backend, or any remote host in its source); the dev server isn't up; or
// a dry run shows the preload did not isolate playwright.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, needServer, SHOTS } from './nba-lib.mjs';
import { startRelay } from './nba-relay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PRELOAD = path.join(HERE, 'nba-qa-preload.mjs');
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
const src = fs.readFileSync(file, 'utf8');
const remote = src.match(REMOTE);
if (remote) refuse(`${rel} names a remote host (${remote[0]})`);
if (!fs.existsSync(PRELOAD)) refuse('the isolation preload is missing');
await needServer().catch((e) => refuse(e.message));

// the dry run: the preload must have wrapped playwright's launchers in this node
const probe = spawnSync(process.execPath, ['--import', PRELOAD, '-e', "const r=require('module').createRequire(process.cwd()+'/package.json');process.exit(r('playwright').chromium.launch.nbaIsolated?0:3)"], { cwd: ROOT, encoding: 'utf8' });
if (probe.status !== 0) refuse('playwright is not isolated in a dry run: ' + (probe.stderr || probe.stdout).trim().split('\n').slice(-2).join(' '));

const online = path.basename(file) === 'online.mjs';
const env = { ...process.env, PS_QA_URL: BASE, PS_QA_ARTIFACTS: process.env.PS_QA_ARTIFACTS || path.join(SHOTS, 'qa'), NBA_QA_KEEP_RELAY: online ? '1' : '' };
const relay = online ? null : startRelay();
if (relay) await relay.ready.catch((e) => (e.code === 'EADDRINUSE' ? console.log('nba-qa-run: relay 7795 already up, using it') : refuse('relay: ' + e.message)));
const cmd = online ? ['flock', ['/tmp/ps-qa-relay-7777.lock', process.execPath, '--import', PRELOAD, file, ...args]] : [process.execPath, ['--import', PRELOAD, file, ...args]];
console.log(`nba-qa-run: ${rel} → ${BASE}${online ? ' (relay 7777 under its lock)' : ' (relay 7795)'}`);
const child = spawn(cmd[0], cmd[1], { cwd: ROOT, env, stdio: 'inherit' });
const code = await new Promise((resolve) => child.on('exit', (c, sig) => resolve(c ?? (sig ? 1 : 0))));
if (relay) await relay.close().catch(() => {});
process.exit(code);
