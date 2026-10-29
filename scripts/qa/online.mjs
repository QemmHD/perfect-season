// Implemented by Codex. Two real clients over an isolated, signature-verifying local Nostr relay.
import { launch, fixture, require } from './browser.mjs';
import { createRequire } from 'node:module';
const { WebSocketServer } = require('ws');
const { verifyEvent } = createRequire(new URL('../../package.json', import.meta.url))('nostr-tools/pure');
const relay = new WebSocketServer({ port: 7777 }),
  clients = new Map(),
  stored = new Map();
let signed = 0;
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
    const m = JSON.parse(bytes.toString());
    if (m[0] === 'EVENT') {
      const e = m[1];
      if (!verifyEvent(e)) {
        send(socket, ['OK', e.id, false, 'invalid signature']);
        return;
      }
      signed++;
      if (e.kind === 30078) stored.set(e.pubkey + ':' + e.tags.find((t) => t[0] === 'd')?.[1], e);
      for (const [peer, subscriptions] of clients) for (const [id, filters] of subscriptions) if (filters.some((f) => fits(e, f))) send(peer, ['EVENT', id, e]);
      send(socket, ['OK', e.id, true, '']);
    } else if (m[0] === 'REQ') {
      subs.set(m[1], m.slice(2));
      for (const e of stored.values()) if (m.slice(2).some((f) => fits(e, f))) send(socket, ['EVENT', m[1], e]);
      send(socket, ['EOSE', m[1]]);
    } else if (m[0] === 'CLOSE') subs.delete(m[1]);
  });
});
const browser = await launch();
try {
  for (const sport of ['nba', 'nfl']) {
    const a = await fixture(browser, sport, 'Codex QA A'),
      b = await fixture(browser, sport, 'Codex QA B');
    for (const p of [a.page, b.page]) {
      await p.getByRole('button', { name: /Ultimate Team:/ }).click();
      await p.getByRole('button', { name: 'Head to Head', exact: true }).click();
    }
    await Promise.all(
      [a.page, b.page].map(async (p) => {
        const sim = p.getByRole('button', { name: /^SIM/ });
        await sim.waitFor({ timeout: 30000 });
        await sim.click();
      })
    );
    await Promise.all([a.page, b.page].map((p) => p.getByRole('heading', { name: /WIN|LOSS/, exact: true }).waitFor({ timeout: 45000 })));
    const pa = await a.current(),
      pb = await b.current();
    if (pa.ut.record.h2hW + pb.ut.record.h2hW !== 1 || pa.ut.record.h2hL + pb.ut.record.h2hL !== 1) throw Error('Real-opponent settlement failed');
    if (a.errors.length || b.errors.length) throw Error([...a.errors, ...b.errors].join(';'));
    console.log(
      JSON.stringify({
        sport,
        h2hWins: pa.ut.record.h2hW + pb.ut.record.h2hW,
        h2hLosses: pa.ut.record.h2hL + pb.ut.record.h2hL,
        rivalsPoints: (pa.ut.rivals?.points ?? 0) + (pb.ut.rivals?.points ?? 0),
        signedMessages: signed,
      })
    );
    await a.context.close();
    await b.context.close();
  }
} finally {
  await browser.close();
  for (const socket of clients.keys()) socket.terminate();
  await new Promise((resolve) => relay.close(resolve));
}
