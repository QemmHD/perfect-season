// An in-process Nostr relay for soccer browser QA (studio overhaul soccer-1, Claude 2026-11-10), the
// isolated relay scripts/qa/online.mjs runs, without the `ws` package (not a project dependency): a
// small RFC 6455 server on node:http that verifies every event's signature, stores replaceable
// kind-30078 state, and fans events out to matching subscriptions. It lives and dies with the QA
// script. If the port is busy (another team's run on the shared machine) it retries every 10 s for
// 3 minutes and then fails; it never falls back to a live relay.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const { verifyEvent } = createRequire(new URL('../../package.json', import.meta.url))('nostr-tools/pure');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** A server frame (unmasked): FIN + opcode, then the length. */
function frame(op, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | op, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([head, payload]);
}

/** One WebSocket connection: text messages in (client frames are masked), text out. */
function accept(req, socket, onOpen) {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  const peer = { open: true, send: (text) => peer.open && socket.write(frame(0x1, Buffer.from(text))), onMessage: () => {}, onClose: () => {} };
  let buf = Buffer.alloc(0);
  let parts = [];
  const close = () => {
    if (!peer.open) return;
    peer.open = false;
    peer.onClose();
    socket.end();
  };
  socket.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80;
      const op = buf[0] & 0x0f;
      let len = buf[1] & 0x7f;
      let at = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        at = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        at = 10;
      }
      const masked = buf[1] & 0x80;
      const mask = masked ? buf.subarray(at, at + 4) : null;
      if (masked) at += 4;
      if (buf.length < at + len) return;
      const data = Buffer.from(buf.subarray(at, at + len));
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(at + len);
      if (op === 0x8) {
        if (peer.open) socket.write(frame(0x8, Buffer.alloc(0)));
        close();
        return;
      }
      if (op === 0x9) socket.write(frame(0xa, data));
      else if (op === 0x1 || op === 0x2 || op === 0x0) {
        parts.push(data);
        if (fin) {
          const text = Buffer.concat(parts).toString('utf8');
          parts = [];
          peer.onMessage(text);
        }
      }
    }
  });
  socket.on('close', close);
  socket.on('error', close);
  onOpen(peer);
}

const fits = (e, f) =>
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (!f.since || e.created_at >= f.since) &&
  Object.entries(f).every(([k, v]) => !k.startsWith('#') || e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));

function listen(port) {
  const clients = new Map();
  const stored = new Map();
  const stats = { events: 0, rejected: 0 };
  const sockets = new Set();
  const server = createServer((_, res) => res.writeHead(426).end('a Nostr relay for QA'));
  server.on('upgrade', (req, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    accept(req, socket, (peer) => {
      const subs = new Map();
      clients.set(peer, subs);
      const send = (msg) => peer.send(JSON.stringify(msg));
      peer.onClose = () => clients.delete(peer);
      peer.onMessage = (text) => {
        let m;
        try {
          m = JSON.parse(text);
        } catch {
          return;
        }
        if (m[0] === 'EVENT') {
          const e = m[1];
          if (!verifyEvent(e)) {
            stats.rejected++;
            send(['OK', e.id, false, 'invalid: bad signature']);
            return;
          }
          stats.events++;
          if (e.kind === 30078) stored.set(e.pubkey + ':' + e.tags.find((t) => t[0] === 'd')?.[1], e);
          for (const [other, ss] of clients) for (const [id, filters] of ss) if (filters.some((f) => fits(e, f))) other.send(JSON.stringify(['EVENT', id, e]));
          send(['OK', e.id, true, '']);
        } else if (m[0] === 'REQ') {
          subs.set(m[1], m.slice(2));
          for (const e of stored.values()) if (m.slice(2).some((f) => fits(e, f))) send(['EVENT', m[1], e]);
          send(['EOSE', m[1]]);
        } else if (m[0] === 'CLOSE') subs.delete(m[1]);
      };
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve({
        port,
        stats,
        close: () =>
          new Promise((done) => {
            for (const peer of clients.keys()) peer.open = false;
            // upgraded sockets are no longer the HTTP server's: end them here, or close() waits forever
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}

/** Start the relay on `port` (7777: the app's ?relay=ws://localhost:7777), waiting for the port. */
export async function startRelay({ port = 7777, retryMs = 10000, maxMs = 180000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    try {
      return await listen(port);
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      if (Date.now() - t0 + retryMs > maxMs) throw new Error('QA relay: port ' + port + ' stayed busy for ' + Math.round(maxMs / 1000) + ' s (another QA run?); not falling back to a live relay');
      console.log('QA relay: port ' + port + ' busy, retrying in ' + retryMs / 1000 + ' s');
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
}
