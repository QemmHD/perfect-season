// Claude (studio overhaul, shell-1, 2026-11-10): Home's vertical budget in every state, measured.
// 4 modes × saved run (checkpoint off/on) × online (off/on) × 3 sports × 9 phones. Online "on" runs a
// signature-verifying Nostr relay on this machine with two signed stand-in players (one browsing, one
// in the head-to-head queue), so the live count, the LIVE badge and "N in queue right now" appear the
// way they do for a real player; "off" points the app at a closed local port. Measurement only:
// edge-lib homeAudit + auditScreen per state, screenshots at 393.
//
//   node scripts/qa/home-matrix.mjs [--sports nba,nfl,soccer] [--devices …|all] [--phase before]
//     [--shots 393|all|none]
//
// Output: <PS_QA_SHOTS>/<phase>/home-matrix/home-matrix-<sports>.json, <sport>-cp<0|1>-on<0|1>-<mode>-
// <device>.png and a contact sheet per sport.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { artifacts, base, buildRoot, fixture, launch } from './browser.mjs';
import { auditScreen, contactSheet, DEVICE_IDS, DEVICES, expectedLayout, forceStandaloneRule, homeAudit, settle } from './edge-lib.mjs';
import { waitForHome } from './fixtures.mjs';

const { finalizeEvent, generateSecretKey, verifyEvent } = createRequire(new URL('../../package.json', import.meta.url))('nostr-tools/pure');

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const list = (name, fallback, all) => {
  const v = opt(name, null);
  return v === null ? fallback : v === 'all' ? all : v === 'none' ? [] : v.split(',');
};
const sports = list('sports', ['nba', 'nfl', 'soccer'], ['nba', 'nfl', 'soccer']);
const devices = list('devices', DEVICE_IDS, DEVICE_IDS);
const shotsAt = list('shots', ['393'], DEVICE_IDS);
const phase = opt('phase', 'before');
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), phase, 'home-matrix');
const MODES = ['classic', 'blind', 'daily', '1v1'];

// ---------- a minimal local Nostr relay (RFC 6455 text frames, NIP-01 EVENT/REQ/CLOSE) ----------

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(text) {
  const body = Buffer.from(text);
  const head = body.length < 126 ? Buffer.from([0x81, body.length]) : body.length < 65536 ? Buffer.from([0x81, 126, body.length >> 8, body.length & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(body.length)); return b; })()]);
  return Buffer.concat([head, body]);
}
/** Complete client frames from a buffer: [{ op, data }], and what is left over. */
function readFrames(buf) {
  const out = [];
  let at = 0;
  while (buf.length - at >= 2) {
    const op = buf[at] & 15,
      masked = buf[at + 1] & 128;
    let len = buf[at + 1] & 127,
      p = at + 2;
    if (len === 126) {
      if (buf.length - p < 2) break;
      len = buf.readUInt16BE(p);
      p += 2;
    } else if (len === 127) {
      if (buf.length - p < 8) break;
      len = Number(buf.readBigUInt64BE(p));
      p += 8;
    }
    const mask = masked ? buf.subarray(p, p + 4) : null;
    if (masked) p += 4;
    if (buf.length - p < len) break;
    const data = Buffer.from(buf.subarray(p, p + len));
    if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    out.push({ op, fin: !!(buf[at] & 128), data });
    at = p + len;
  }
  return { frames: out, rest: buf.subarray(at) };
}
const matches = (e, f) =>
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (!f.ids || f.ids.includes(e.id)) &&
  (!f.since || e.created_at >= f.since) &&
  Object.entries(f).every(([k, v]) => !k.startsWith('#') || e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));

/**
 * Start the relay. Stand-ins publish signed presence (and one of them queue) events on the tags the
 * app itself subscribes to, every two seconds, in `sport`. Port 7777 when free, else any free port.
 */
async function startRelay(sport) {
  const clients = new Set(),
    tags = { presence: null, queue: null };
  let signed = 0;
  const send = (c, msg) => !c.socket.destroyed && c.socket.write(frame(JSON.stringify(msg)));
  const publish = (e) => {
    for (const c of clients) for (const [id, filters] of c.subs) if (filters.some((f) => matches(e, f))) send(c, ['EVENT', id, e]);
  };
  const server = http.createServer((_, res) => res.writeHead(426).end());
  server.on('upgrade', (req, socket) => {
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const c = { socket, subs: new Map(), buf: Buffer.alloc(0), parts: [] };
    clients.add(c);
    const drop = () => clients.delete(c);
    socket.on('close', drop);
    socket.on('error', drop);
    socket.on('data', (chunk) => {
      const { frames, rest } = readFrames(Buffer.concat([c.buf, chunk]));
      c.buf = rest;
      for (const f of frames) {
        if (f.op === 8) return socket.end(Buffer.from([0x88, 0]));
        if (f.op === 9) socket.write(Buffer.concat([Buffer.from([0x8a, f.data.length]), f.data]));
        if (f.op !== 1 && f.op !== 0) continue;
        c.parts.push(f.data);
        if (!f.fin) continue;
        const text = Buffer.concat(c.parts).toString();
        c.parts = [];
        let m;
        try {
          m = JSON.parse(text);
        } catch {
          continue;
        }
        if (m[0] === 'EVENT') {
          const e = m[1];
          if (!verifyEvent(e)) {
            send(c, ['OK', e.id, false, 'invalid: bad signature']);
            continue;
          }
          signed++;
          send(c, ['OK', e.id, true, '']);
          publish(e);
        } else if (m[0] === 'REQ') {
          const filters = m.slice(2);
          c.subs.set(m[1], filters);
          // learn the presence and head-to-head queue tags the app listens on (they carry its namespace and rules)
          for (const f of filters) {
            if (f.kinds?.includes(25890) && f['#t']) tags.presence = f['#t'][0];
            if (f.kinds?.includes(25891) && f['#t']?.[0]?.startsWith('ps1-queue-')) tags.queue = f['#t'][0];
          }
          send(c, ['EOSE', m[1]]);
        } else if (m[0] === 'CLOSE') c.subs.delete(m[1]);
      }
    });
  });
  const port = await new Promise((resolve, reject) => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' ? server.listen(0, '127.0.0.1', () => resolve(server.address().port)) : reject(e)));
    server.listen(7777, '127.0.0.1', () => resolve(7777));
  });
  const stand = [
    { key: generateSecretKey(), name: 'Matrix Peer A', st: 'menu' },
    { key: generateSecretKey(), name: 'Matrix Peer B', st: 'queue' },
  ];
  const now = () => Math.floor(Date.now() / 1000);
  const beat = setInterval(() => {
    for (const p of stand) {
      if (tags.presence) publish(finalizeEvent({ kind: 25890, created_at: now(), tags: [['t', tags.presence]], content: JSON.stringify({ name: p.name, st: p.st, sp: sport }) }, p.key));
      if (p.st === 'queue' && tags.queue) publish(finalizeEvent({ kind: 25891, created_at: now(), tags: [['t', tags.queue]], content: JSON.stringify({ name: p.name }) }, p.key));
    }
  }, 2000);
  return {
    url: 'ws://localhost:' + port,
    stats: () => ({ port, signedFromApp: signed, tags: { ...tags } }),
    close: async () => {
      clearInterval(beat);
      for (const c of clients) c.socket.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}

// ---------- the matrix ----------

/** Show one phone in an open context: viewport, insets, the standalone height rule, then let the stage settle. */
async function asDevice(page, dev) {
  const d = DEVICES[dev];
  await page.setViewportSize({ width: d.w, height: d.h });
  await page.evaluate((ins) => {
    window.__psInsets = ins;
    window.dispatchEvent(new Event('resize'));
    window.visualViewport?.dispatchEvent(new Event('resize'));
  }, d.insets);
  await forceStandaloneRule(page, d.insets[0]);
  await settle(page, 250);
}

const browser = await launch();
const rows = [];
const started = Date.now();
fs.mkdirSync(OUT, { recursive: true });
try {
  for (const sport of sports) {
    for (const online of [false, true]) {
      const relay = online ? await startRelay(sport) : null;
      try {
        for (const checkpoint of [false, true]) {
          const first = DEVICES[devices[0]];
          const f = await fixture(browser, sport, 'Matrix QA', first.w, { isMobile: true, hasTouch: true }, { insets: first.insets, height: first.h, standalone: true, dsf: 1, profile: checkpoint ? 'checkpoint' : 'standard', serialized: true, relay: relay ? relay.url : 'ws://localhost:9' });
          const { page } = f;
          try {
            await waitForHome(page);
            let onlineReady = null;
            if (online) {
              onlineReady = await page
                .locator('.mode .livebadge:not(.daily-new)')
                .first()
                .waitFor({ timeout: 15000 })
                .then(() => true)
                .catch(() => false);
            }
            for (const dev of devices) {
              await asDevice(page, dev);
              for (const [i, mode] of MODES.entries()) {
                await page.locator('.modes .mode').nth(i).click();
                await settle(page, 300);
                const home = await homeAudit(page);
                const a = await auditScreen(page, dev);
                const exp = expectedLayout(dev);
                const shot = shotsAt.includes(dev) ? `${sport}-cp${+checkpoint}-on${+online}-${mode}-${dev}.png` : null;
                if (shot) await page.screenshot({ path: path.join(OUT, shot) });
                rows.push({
                  sport,
                  device: dev,
                  mode,
                  checkpoint,
                  online,
                  onlineReady,
                  queueText: await page.locator('.mode .queue-now').count(),
                  homeClass: home.homeClass,
                  expectedHomeClass: exp.homeClass,
                  fit: home.fit,
                  expectedFit: exp.fit,
                  classOk: home.homeClass === exp.homeClass && home.fit === exp.fit,
                  rows: home.rows,
                  play: home.play,
                  tabs: home.tabs,
                  fadeTop: home.fadeTop,
                  gapToPlay: home.gapToPlay,
                  gapToFade: home.gapToFade,
                  overflows: home.overflows,
                  scrollRange: home.scrollRange,
                  lastRowClearsFadeAtEnd: home.lastRowClearsFadeAtEnd,
                  topMost: a.topMost.y,
                  textInBand: a.textInBand.length,
                  controlInBand: a.controlInBand.length,
                  bottomCut: a.bottomCut.map((x) => x.label),
                  overlap: a.overlap,
                  docScroll: a.docScroll,
                  shot,
                });
              }
            }
            if (f.errors.length) rows.push({ sport, online, checkpoint, errors: f.errors });
            console.log(JSON.stringify({ sport, online, checkpoint, onlineReady, errors: f.errors.length, blocked: [...new Set(f.blocked)], relay: relay?.stats() ?? null }));
          } finally {
            await f.context.close();
          }
        }
      } finally {
        await relay?.close();
      }
    }
    const files = rows.filter((r) => r.sport === sport && r.shot).map((r) => path.join(OUT, r.shot));
    await contactSheet(browser, files, path.join(OUT, 'sheet-home-' + sport + '.png'), { cols: 8, title: `home-matrix ${phase} · ${sport} · cp/online/mode at ${shotsAt.join(', ')}` });
  }
} finally {
  await browser.close();
}
const states = rows.filter((r) => r.mode);
const errors = rows.filter((r) => r.errors).flatMap((r) => r.errors);
const summary = {
  phase,
  base,
  build: buildRoot,
  wallMs: Date.now() - started,
  states: states.length,
  classMismatches: states.filter((r) => !r.classOk).map((r) => `${r.sport} ${r.device} ${r.mode} cp${+r.checkpoint} on${+r.online}: ${r.homeClass}/${r.fit} vs ${r.expectedHomeClass}/${r.expectedFit}`),
  rowUnderPlay: states.filter((r) => r.gapToPlay < 0).length,
  rowUnderFade: states.filter((r) => r.gapToFade < 0).length,
  overflowing: states.filter((r) => r.overflows).length,
  lastRowHiddenAtEnd: states.filter((r) => r.overflows && !r.lastRowClearsFadeAtEnd).length,
  onlineNotReady: [...new Set(states.filter((r) => r.online && !r.onlineReady).map((r) => r.sport))],
  pageErrors: errors,
};
fs.writeFileSync(path.join(OUT, 'home-matrix-' + sports.join('-') + '.json'), JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary));
if (errors.length || summary.classMismatches.length) process.exitCode = 1;
