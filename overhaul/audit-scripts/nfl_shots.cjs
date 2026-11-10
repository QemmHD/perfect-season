// AUDIT ONLY: screenshots of the NFL arcade engine via the ?arcade lab on a local vite (port 5202).
// Blocks every non-localhost request. Never touches live services.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nfl';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5202/';
const only = process.argv[2];
const VIEWS = [
  { name: '390', w: 390, h: 844, sat: 59, sab: 34 },
  { name: '430', w: 430, h: 932, sat: 59, sab: 34 },
  { name: '320', w: 320, h: 568, sat: 20, sab: 0 },
  { name: '844L', w: 844, h: 390, sat: 0, sab: 21, sal: 59, sar: 59 },
].filter((v) => !only || v.name === only);
const log = [];
const note = (o) => { log.push(o); console.log(JSON.stringify(o)); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
      note({ blocked: u.href.slice(0, 120) });
      return route.abort();
    });
    const shot = async (n) => { const f = path.join(OUT, v.name + '-' + n + '.png'); await page.screenshot({ path: f }); return f; };
    const insets = async () => page.addStyleTag({ content: `.arcade-full{--sat:${v.sat}px!important;--sab:${v.sab}px!important;--sal:${v.sal ?? 0}px!important;--sar:${v.sar ?? 0}px!important}` });
    const boxes = async (sel) => page.locator(sel).evaluateAll((els) => els.filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => { const r = e.getBoundingClientRect(); return { cls: e.className.toString().slice(0, 40), text: (e.textContent || '').trim().slice(0, 24), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
    try {
      await page.goto(BASE + '?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=audit1', { waitUntil: 'domcontentloaded' });
      await insets();
      await page.waitForSelector('.fb2-call', { timeout: 60000 });
      await page.waitForTimeout(1500);
      await shot('01-playcall');
      note({ v: v.name, step: 'playcall', boxes: await boxes('.fb2-call button, .hg2-bug, .hg2-marks, .play-readout, .hg2-hint') });
      // full playbook
      await page.getByRole('button', { name: /FULL PLAYBOOK/ }).click();
      await page.waitForTimeout(500);
      await shot('02-playbook');
      note({ v: v.name, step: 'playbook', cards: await page.locator('.fb2-book-grid .fb2-card').count(), grid: await boxes('.fb2-playbook') });
      await page.getByRole('button', { name: 'Close playbook' }).click();
      await page.waitForTimeout(300);
      // pass play: first card is a pass
      await page.locator('.fb2-card').first().click();
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      await page.waitForTimeout(700);
      await shot('03-dropback');
      note({ v: v.name, step: 'dropback', boxes: await boxes('.fb2-passing button, .fb2-mv, .hg2-hint, .play-readout') });
      // slingshot drag on the open field (upper middle), pull down to throw up-field
      const cx = v.w / 2, cy = v.h * 0.35;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 10, cy + 60, { steps: 4 });
      await page.mouse.move(cx - 18, cy + 120, { steps: 4 });
      await page.waitForTimeout(150);
      await shot('04-aim');
      await page.mouse.up();
      await page.waitForTimeout(450);
      await shot('05-air');
      // wait for the catch or the end of play
      await page.waitForFunction(() => document.querySelector('.fb2-moves .fb2-mv.juke') || document.querySelector('.fb2-call') || document.querySelector('.hg2-pop'), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(150);
      await shot('06-after-throw');
      note({ v: v.name, step: 'after-throw', boxes: await boxes('.fb2-stick, .fb2-burst, .fb2-mv, .hg2-pop, .play-readout') });
      await page.waitForSelector('.fb2-call', { timeout: 20000 });
      await page.waitForTimeout(400);
      await shot('07-next-call');
      // run play
      const cards = page.locator('.fb2-cards .fb2-card');
      const n = await cards.count();
      let runIdx = -1;
      for (let i = 0; i < n; i++) if ((await cards.nth(i).innerText()).includes('RUN')) runIdx = i;
      if (runIdx >= 0) await cards.nth(runIdx).click();
      await page.waitForTimeout(200);
      await shot('08-run-call');
      const snapBtn = page.getByRole('button', { name: /^(SNAP|GO FOR IT)$/ });
      await snapBtn.click();
      await page.waitForTimeout(250);
      await shot('09-handoff');
      // hold the stick forward
      const stick = page.locator('.fb2-stick');
      if (await stick.count()) {
        const b = await stick.boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 60, { steps: 3 });
        await page.waitForTimeout(700);
        await shot('10-running');
        note({ v: v.name, step: 'running', boxes: await boxes('.fb2-stick, .fb2-burst, .fb2-mv, .play-readout, .hg2-pop') });
        await page.waitForTimeout(900);
        await shot('11-running2');
        await page.mouse.up();
      }
      await page.waitForSelector('.fb2-call', { timeout: 25000 });
      await page.waitForTimeout(300);
      // throw incompletions out of bounds until fourth down
      for (let k = 0; k < 6; k++) {
        if (await page.locator('.fb2-4th').count()) break;
        const cs = page.locator('.fb2-cards .fb2-card');
        for (let i = 0; i < (await cs.count()); i++) if ((await cs.nth(i).innerText()).includes('PASS')) { await cs.nth(i).click(); break; }
        await page.getByRole('button', { name: 'SNAP', exact: true }).click();
        await page.waitForTimeout(500);
        // aim far to the side, past the sideline
        await page.mouse.move(v.w * 0.5, v.h * 0.4);
        await page.mouse.down();
        await page.mouse.move(v.w * 0.95, v.h * 0.45, { steps: 4 });
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForSelector('.fb2-call', { timeout: 25000 });
        await page.waitForTimeout(300);
      }
      await shot('12-fourth');
      note({ v: v.name, step: 'fourth', text: (await page.locator('.fb2-call').innerText()).slice(0, 200) });
      note({ v: v.name, errors });
    } catch (e) {
      note({ v: v.name, error: String(e).slice(0, 300), errors });
      await shot('ERR').catch(() => {});
    }
    await ctx.close();
  }
  // kick meter + final screen, via a practice kick drill mounted directly (390 only)
  {
    const v = { name: '390', w: 390, h: 844 };
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('**/*', (route) => { const u = new URL(route.request().url()); return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? route.continue() : route.abort(); });
    try {
      await page.goto(BASE + '?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=audit2&drives=1', { waitUntil: 'domcontentloaded' });
      await page.addStyleTag({ content: '.arcade-full{--sat:59px!important;--sab:34px!important}' });
      await page.waitForSelector('.fb2-call', { timeout: 60000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, '390-20-two-minute.png') });
      for (let k = 0; k < 8; k++) {
        if (await page.locator('.fb2-4th').count()) break;
        await page.getByRole('button', { name: 'SNAP', exact: true }).click().catch(() => {});
        await page.waitForTimeout(500);
        await page.mouse.move(195, 340); await page.mouse.down(); await page.mouse.move(380, 380, { steps: 4 }); await page.mouse.up();
        await page.waitForSelector('.fb2-call', { timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: path.join(OUT, '390-21-fourth-2min.png') });
      const punt = page.getByRole('button', { name: 'PUNT', exact: true });
      if (await punt.count()) await punt.click();
      await page.waitForSelector('.hg2-final', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, '390-22-final.png') });
    } catch (e) { note({ step: 'final', error: String(e).slice(0, 300) }); }
    // kick drill
    try {
      await page.goto(BASE + '?sport=nfl&ns=inspect&relay=ws://localhost:7777&arcade', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.fb2-call', { timeout: 60000 });
      await page.evaluate(async () => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { CELLS } = await import('/src/engine/data.ts');
        const { fbKitsFor, Football2 } = await import('/src/game/football2/Football2.tsx');
        const { rankOf } = await import('/src/game/football/model.ts');
        const by = (pos) => CELLS.flatMap((c) => c.players).filter((p) => p.pos[0] === pos).sort((a, b) => rankOf(a) - rankOf(b));
        const at = (pos, l) => { const list = by(pos); return list[Math.floor(l * (list.length - 1))]; };
        const lineup = { QB: at('QB', 0.8), RB: at('RB', 0.8), WR: at('WR', 0.8), TE: at('TE', 0.8), FLEX: at('WR', 0.76), DL: at('DL', 0.5), LB: at('LB', 0.5), DB: at('DB', 0.5) };
        document.querySelectorAll('.arcade-full').forEach((e) => e.remove());
        const host = document.createElement('div');
        document.body.append(host);
        const root = (dom.createRoot ?? dom.default.createRoot)(host);
        root.render(React.createElement(Football2, { lineup, rivalLineup: lineup, rivalName: 'Rival', seed: 'kick', practice: { drill: 'kick', onAttempt: () => {} }, rival: null, ourKit: fbKitsFor('#203731', '#ffb612').home, theirKit: fbKitsFor('#aa0000', '#b3995d').away, field: { homeC1: '#203731', homeC2: '#ffb612', homeName: 'Packers', awayC1: '#aa0000', awayC2: '#b3995d', awayName: '49ers' }, onProgress: () => {}, onDone: () => {} }));
      });
      await page.addStyleTag({ content: '.arcade-full{--sat:59px!important;--sab:34px!important}' });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, '390-30-kick-call.png') });
      const kb = page.locator('.fb2-go.kick').last();
      if (await kb.count()) { await kb.click(); await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, '390-31-kick-meter.png') }); await page.locator('.fb2-kick').last().dispatchEvent('pointerdown'); await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, '390-32-kick-flight.png') }); }
    } catch (e) { note({ step: 'kick', error: String(e).slice(0, 300) }); }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'shots-log.json'), JSON.stringify(log, null, 1));
})();
