// AUDIT ONLY: in the real component, does a receiver keep running after the catch if the player is not holding the stick?
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nfl';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = new URL(r.request().url()); return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.continue() : r.abort(); });
  const results = [];
  for (const seed of ['cs1', 'cs2', 'cs3', 'cs4', 'cs5', 'cs6']) {
    await page.goto('http://localhost:5202/?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=' + seed, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.fb2-call', { timeout: 60000 });
    await page.evaluate(async () => {
      const { FootballRenderer } = await import('/src/game/football2/render.ts');
      const draw = FootballRenderer.prototype.draw;
      window.__log = [];
      FootballRenderer.prototype.draw = function (ctx, p, los, o) {
        if (p.phase !== 'pre') window.__log.push({ t: +p.t.toFixed(3), phase: p.phase, slot: p.carrier?.slot ?? null, v: p.carrier ? +Math.hypot(p.carrier.vx, p.carrier.vy).toFixed(2) : null, y: p.carrier ? +p.carrier.y.toFixed(2) : null, end: p.end ? p.end.kind + ':' + p.end.gain : null });
        return draw.call(this, ctx, p, los, o);
      };
    });
    const cards = page.locator('.fb2-cards .fb2-card');
    for (let i = 0; i < (await cards.count()); i++) if ((await cards.nth(i).innerText()).includes('PASS')) { await cards.nth(i).click(); break; }
    await page.getByRole('button', { name: 'SNAP', exact: true }).click();
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /^Pass to RB/ }).click();
    await page.waitForSelector('.fb2-call', { timeout: 20000 }).catch(() => {});
    const log = await page.evaluate(() => window.__log);
    const ci = log.findIndex((f) => f.phase === 'run' && f.slot === 'RB');
    if (ci < 0) { results.push({ seed, caught: false, end: log[log.length - 1]?.end }); continue; }
    const at = log[ci];
    const after = (dt) => log.find((f) => f.t >= at.t + dt) ?? log[log.length - 1];
    results.push({ seed, caught: true, catchT: at.t, vAtCatch: at.v, v_0_25s: after(0.25).v, v_0_5s: after(0.5).v, v_1s: after(1).v, yardsAfterCatch: +((log[log.length - 1].y ?? at.y) - at.y).toFixed(1), end: log[log.length - 1].end });
    if (seed === 'cs1') await page.screenshot({ path: path.join(OUT, '390-40-catch-nostick.png') });
  }
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
