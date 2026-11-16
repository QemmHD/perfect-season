// Team nba's own Nostr relay for QA (Claude 2026-11-16): a signature-verifying, in-memory relay on
// localhost:7795, the server half of scripts/qa/online.mjs. Two test clients talk through it and
// nothing reaches a real relay or board. The shared online.mjs keeps 7777 (run it only under
// `flock /tmp/ps-qa-relay-7777.lock`, see nba-qa-run.mjs).
//   node scripts/audit/nba-relay.mjs            run until Ctrl-C (or `kill` its PID)
//   import { startRelay } from './nba-relay.mjs' inside a probe
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELAY_PORT, require } from './nba-lib.mjs';

/** The WebSocket server playwright already ships (the repo has no `ws` of its own). */
function wsServer() {
  try {
    return require('ws').WebSocketServer;
  } catch {
    const core = path.dirname(createRequire(require.resolve('playwright')).resolve('playwright-core'));
    return require(path.join(core, 'lib/utilsBundle.js')).wsServer;
  }
}

export function startRelay(port = RELAY_PORT) {
  const { verifyEvent } = require('nostr-tools/pure');
  const Server = wsServer();
  const relay = new Server({ host: '127.0.0.1', port });
  const clients = new Map();
  const stored = new Map();
  const stats = { signed: 0, rejected: 0 };
  const fits = (e, f) =>
    (!f.kinds || f.kinds.includes(e.kind)) &&
    (!f.authors || f.authors.includes(e.pubkey)) &&
    (!f.since || e.created_at >= f.since) &&
    Object.entries(f).every(([k, v]) => !k.startsWith('#') || e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));
  const send = (socket, data) => socket.readyState === 1 && socket.send(JSON.stringify(data));
  relay.on('connection', (socket) => {
    const subs = new Map();
    clients.set(socket, subs);
    socket.on('close', () => clients.delete(socket));
    socket.on('message', (bytes) => {
      let m;
      try {
        m = JSON.parse(bytes.toString());
      } catch {
        return;
      }
      if (m[0] === 'EVENT') {
        const e = m[1];
        if (!verifyEvent(e)) {
          stats.rejected++;
          send(socket, ['OK', e.id, false, 'invalid signature']);
          return;
        }
        stats.signed++;
        if (e.kind >= 30000 && e.kind < 40000) stored.set(e.pubkey + ':' + e.kind + ':' + (e.tags.find((t) => t[0] === 'd')?.[1] ?? ''), e);
        for (const [peer, subscriptions] of clients) for (const [id, filters] of subscriptions) if (filters.some((f) => fits(e, f))) send(peer, ['EVENT', id, e]);
        send(socket, ['OK', e.id, true, '']);
      } else if (m[0] === 'REQ') {
        subs.set(m[1], m.slice(2));
        for (const e of stored.values()) if (m.slice(2).some((f) => fits(e, f))) send(socket, ['EVENT', m[1], e]);
        send(socket, ['EOSE', m[1]]);
      } else if (m[0] === 'CLOSE') subs.delete(m[1]);
    });
  });
  const ready = new Promise((resolve, reject) => {
    relay.once('listening', resolve);
    relay.once('error', reject);
  });
  return {
    ready,
    stats,
    close: () =>
      new Promise((resolve) => {
        for (const socket of clients.keys()) socket.terminate();
        relay.close(resolve);
      }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = startRelay();
  r.ready.then(
    () => console.log(`nba-relay: listening on ws://localhost:${RELAY_PORT} (Ctrl-C to stop)`),
    (e) => {
      console.error('nba-relay: ' + e.message);
      process.exit(1);
    }
  );
  const stop = () => r.close().then(() => (console.log('nba-relay: stopped', JSON.stringify(r.stats)), process.exit(0)));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
