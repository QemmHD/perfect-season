// AUDIT ONLY: production build (vite preview on 5206, isolated ns=inspect, local relay, every
// non-localhost request aborted). Per sport, at 390x844 iPhone emulation:
//  A. cold first visit (no cache, no worker), two profiles: desktop CPU / no throttle, and 4x CPU +
//     "4G" (9 Mbps, 60 ms RTT): FCP, welcome-screen interactive, long tasks, JS bytes, requests, heap.
//  B. onboarding -> Home; worker ready; warm relaunch timing; OFFLINE relaunch.
//  C. open Ultimate Team (first time): tap -> UT screen ready; JS bytes fetched for it; long tasks.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const fs = require('fs');
const SH = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
const BASE = 'http://localhost:5206/';
const profileArg = process.argv[3] || 'both';
const sports = (process.argv[2] || 'nba,nfl,soccer').split(',');
const PROFILES = { fast: { cpu: 1, net: null }, slow: { cpu: 4, net: { offline: false, latency: 60, downloadThroughput: 1125000, uploadThroughput: 93750 } } };

async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  await ctx.addInitScript(() => {
    window.__lt = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  });
  return ctx;
}
async function dismiss(page) {
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(600);
    const d = page.locator('[role=dialog]').last();
    if (!(await d.isVisible().catch(() => false))) { if (i > 3) return; continue; }
    const b = d.locator('button').last();
    await b.click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
  }
}
const metrics = (page) => page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const res = performance.getEntriesByType('resource');
  const js = res.filter((r) => /\.js(\?|$)/.test(r.name));
  return {
    ttfb: nav ? Math.round(nav.responseStart) : null,
    domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    load: nav ? Math.round(nav.loadEventEnd) : null,
    fcp: fcp ? Math.round(fcp.startTime) : null,
    requests: res.length,
    jsFiles: js.length,
    jsTransfer: js.reduce((s, r) => s + (r.transferSize || 0), 0),
    jsDecoded: js.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
    longTasks: window.__lt.length,
    longTaskMs: window.__lt.reduce((s, x) => s + x[1], 0),
    longest: Math.max(0, ...window.__lt.map((x) => x[1])),
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
});

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const out = {};
  for (const sport of sports) {
    out[sport] = {};
    for (const [pname, prof] of Object.entries(PROFILES)) {
      if (profileArg !== 'both' && profileArg !== pname) continue;
      const ctx = await newCtx(browser);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (prof.net) await cdp.send('Network.emulateNetworkConditions', prof.net);
      if (prof.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
      const t0 = Date.now();
      await page.goto(BASE + `?sport=${sport}&ns=inspect&relay=ws://localhost:7777`, { waitUntil: 'commit' });
      await page.locator('input.namefield, input[placeholder]').first().waitFor({ state: 'visible', timeout: 120000 });
      const interactive = await page.evaluate(() => Math.round(performance.now()));
      const wall = Date.now() - t0;
      await page.waitForTimeout(1500);
      const A = { ...(await metrics(page)), welcomeInteractive: interactive, wallMs: wall };
      out[sport][pname] = { cold: A };
      console.log(sport, pname, 'COLD', JSON.stringify(A));
      if (pname === 'fast') {
        // B. onboarding -> Home
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
        await page.locator('input').first().fill('Audit');
        await page.getByRole('button', { name: /NEXT/ }).click();
        await page.getByRole('button', { name: /Skip for now/ }).click();
        await page.locator('nav.tabs').waitFor({ timeout: 30000 });
        await dismiss(page);
        await page.evaluate(async () => { if (navigator.serviceWorker) await navigator.serviceWorker.ready; });
        await page.waitForTimeout(6000);
        await page.screenshot({ path: SH + `perf-home-${sport}-390.png` });
        // warm relaunch
        const w0 = Date.now();
        await page.reload({ waitUntil: 'commit' });
        await page.locator('nav.tabs').waitFor({ timeout: 60000 });
        const warmHome = await page.evaluate(() => Math.round(performance.now()));
        const warm = { ...(await metrics(page)), homeReady: warmHome, wallMs: Date.now() - w0 };
        console.log(sport, 'WARM', JSON.stringify(warm));
        // offline relaunch
        await ctx.setOffline(true);
        let offline;
        try {
          const o0 = Date.now();
          await page.reload({ waitUntil: 'commit', timeout: 30000 });
          await page.locator('nav.tabs').waitFor({ timeout: 30000 });
          await dismiss(page);
          offline = { ok: true, homeReady: await page.evaluate(() => Math.round(performance.now())), wallMs: Date.now() - o0 };
          // UT offline before ever opening it online
          await page.locator('.tab-ut').click();
          await page.waitForTimeout(8000);
          offline.utText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
          await page.screenshot({ path: SH + `perf-offline-ut-${sport}-390.png` });
        } catch (e) {
          offline = { ok: false, err: String(e).slice(0, 200) };
          await page.screenshot({ path: SH + `perf-offline-${sport}-390.png` }).catch(() => {});
        }
        console.log(sport, 'OFFLINE', JSON.stringify(offline));
        await ctx.setOffline(false);
        // C. open UT online: a fresh page each time (the pool is cached in memory), 1x then 4x CPU
        const C = {};
        for (const rate of [1, 4]) {
          await page.goto(BASE + `?sport=${sport}&ns=inspect&relay=ws://localhost:7777`);
          await page.locator('nav.tabs').waitFor({ timeout: 60000 });
          await dismiss(page);
          await page.waitForTimeout(1500);
          await page.evaluate(() => { window.__lt = []; performance.clearResourceTimings(); });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          const u0 = await page.evaluate(() => performance.now());
          await page.locator('.tab-ut').click();
          await page.waitForFunction(() => !document.querySelector('.ut-loading') && document.querySelector('.ut-title, .ut-tabs, [class*="ut-"]'), null, { timeout: 120000 });
          const u1 = await page.evaluate(() => performance.now());
          await page.waitForTimeout(rate === 1 ? 1500 : 4000);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
          const m = await metrics(page);
          C['x' + rate] = { utReadyMs: Math.round(u1 - u0), longTasks: m.longTasks, longTaskMs: m.longTaskMs, longest: m.longest, jsDecoded: m.jsDecoded, heapMB: m.heapMB };
          if (rate === 1) await page.screenshot({ path: SH + `perf-ut-${sport}-390.png` });
        }
        console.log(sport, 'UT-OPEN', JSON.stringify(C));
        out[sport].warm = warm;
        out[sport].offline = offline;
        out[sport].ut = C;
      }
      if (errors.length) console.log(sport, pname, 'pageerrors', errors.slice(0, 3));
      await ctx.close();
    }
  }
  fs.writeFileSync('/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/likeness/out/coldstart-' + sports.join('-') + '-' + profileArg + '.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
