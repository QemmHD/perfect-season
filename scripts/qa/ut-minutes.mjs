// Claude, 2026-11-16 (studio overhaul, team ut, ut-2): MINUTES in a real browser. A full Ultimate Team
// Squad Battles match plays on the autopilot (?autoplay) while a stand-in thumb taps around the
// screen every 1.5 s, on an isolated phone (?ns=inspect&relay=ws://localhost:7777, every non-local
// host aborted, every socket except the local relay and the dev server's HMR refused). It measures:
//   - profile writes (localStorage 'perfect-season:profile:v1') while the match plays: must be 0,
//     and exactly 1 when it banks (the result screen);
//   - the counted seconds the match added to profile.playtime against the active time (first tap in
//     the arena to the bank): within ±5%;
//   - the ticker's own per-second work: the duration of each call from a DevTools trace of the match
//     with the CPU throttled 4x (thread time, so other load on this shared machine stays out of it;
//     the throttler's own slices still land in some calls, hence the median): must be <= 0.2 ms.
//   node scripts/qa/ut-minutes.mjs [--sport nba|nfl|soccer|all] [--speed 4] [--cpu 4]
// Writes O/shots/ut/ut-2/minutes-<sport>.json and a result screenshot. Needs the dev server on 5212.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg('base', 'http://localhost:5212/');
const OUT = arg('out', '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/shots/ut/ut-2');
const SPEED = +arg('speed', '4');
const CPU = +arg('cpu', '4');
const SPORTS = arg('sport', 'nba') === 'all' ? ['nba', 'nfl', 'soccer'] : [arg('sport', 'nba')];
const RELAY_OK = ['localhost:7777', '127.0.0.1:7777'];
fs.mkdirSync(OUT, { recursive: true });

async function phone(browser, sport) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const blocked = [];
  const sockets = { local: 0, refused: [] };
  const devHost = new URL(BASE).host;
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    blocked.push(u.hostname);
    return route.abort();
  });
  await context.routeWebSocket(/.*/, (ws) => {
    const u = new URL(ws.url());
    const host = u.hostname + ':' + (u.port || (u.protocol === 'wss:' ? '443' : '80'));
    if (RELAY_OK.includes(host) || host === devHost) {
      sockets.local++;
      ws.connectToServer();
      return;
    }
    sockets.refused.push(host);
    ws.close({ code: 1008, reason: 'QA isolation' });
  });
  await context.addInitScript(() => {
    window.__psInsets = [59, 0, 34, 0];
    // every profile write, with when it happened
    const set = Storage.prototype.setItem;
    window.__writes = [];
    Storage.prototype.setItem = function (k, v) {
      if (k === 'perfect-season:profile:v1') window.__writes.push(performance.now());
      return set.call(this, k, v);
    };
    // when the arena first shows (the match's play stage starts)
    new MutationObserver(() => {
      if (!window.__arcadeAt && document.querySelector('.screen.arcade')) window.__arcadeAt = performance.now();
    }).observe(document, { childList: true, subtree: true });
    window.__long = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = new URL(BASE);
  url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ sport }) => {
    const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
    const { getPool, byValue } = await import('/src/ut/pool.ts');
    const { openPack } = await import('/src/ut/packs.ts');
    const { autoBuild } = await import('/src/ut/squad.ts');
    const { freshUt } = await import('/src/ut/state.ts');
    const pool = await getPool(),
      p = freshProfile();
    p.name = 'Minutes QA';
    p.coins = 5000;
    p.firstRun = false;
    p.gifts = ['testers-2026-10'];
    p.settings.sound = false;
    p.settings.haptics = false;
    p.xp = 5200;
    p.stats.games = 3;
    p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const cards = [...openPack(pool, 'starter', 'qa'), ...[...pool.base.values()].filter((c) => c.line.kind === 'season').sort(byValue).slice(0, 25)].filter(
      (c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i,
    );
    const owned = cards.map((rc, i) => ({ uid: 'mq-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
    p.ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1 };
    localStorage.setItem('perfect-season:fav:asked', '1');
    saveProfile(p);
  }, { sport });
  const u = new URL(page.url());
  u.searchParams.set('autoplay', '1');
  await page.goto(u.href, { waitUntil: 'domcontentloaded' });
  return { context, page, errors, blocked, sockets };
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let failed = false;
try {
  for (const sport of SPORTS) {
    const { context, page, errors, blocked, sockets } = await phone(browser, sport);
    await page.locator('.home .playbar').waitFor({ timeout: 90000 });
    if (SPEED !== 1)
      await page.evaluate(async (speed) => {
        const code = await (await fetch('/src/game/Arcade.tsx')).text();
        const reactUrl = code.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
        const React = (await import(reactUrl)).default;
        const original = React.createElement;
        React.createElement = (type, props, ...children) => {
          if (['Hoops2', 'Football2', 'Soccer2'].includes(type?.name)) props = { ...props, timeScale: speed };
          return original(type, props, ...children);
        };
      }, SPEED);
    const focused = await page.evaluate(() => document.hasFocus());
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs').waitFor({ timeout: 90000 });
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 90000 });
    await page.locator('.ut-tabs button').filter({ hasText: 'PLAY' }).first().click();
    await page.waitForTimeout(800);
    await page.locator('.play-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /^Rung 1:/ }).click().catch(async () => page.getByRole('button', { name: 'PLAY', exact: true }).first().click());
    await page.waitForTimeout(1200);
    const go = page.getByRole('button', { name: /^PLAY/ }).last();
    if (await go.isVisible().catch(() => false)) await go.click();
    await page.locator('.screen.arcade').waitFor({ timeout: 90000 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:v1')).playtime ?? null);
    // the thumb: a tap every 1.5 s at a different spot, until the result shows
    const t0 = await page.evaluate(() => {
      window.__tap = 0;
      const tap = () => {
        const n = window.__tap++;
        const x = 40 + ((n * 67) % 300),
          y = 200 + ((n * 41) % 420);
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerType: 'touch' }));
      };
      tap();
      window.__tapper = setInterval(tap, 1500);
      return window.__arcadeAt ?? performance.now();
    });
    const writesAtStart = await page.evaluate(() => window.__writes.length);
    // the ticker's CPU time per call from a trace (thread time, so neither the throttler's suspensions
    // nor other processes on this shared machine count); a 4x slower CPU takes 4x that
    const events = [];
    cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
    const traced = new Promise((res) => cdp.once('Tracing.tracingComplete', res));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' });
    await page.waitForTimeout(20000);
    await cdp.send('Tracing.end');
    await traced;
    const cpu = events
      .filter((e) => e.name === 'FunctionCall' && e.args?.data?.functionName === 'tick' && /\/src\/lib\/playtime\.ts/.test(e.args?.data?.url ?? ''))
      .map((e) => (e.tdur ?? e.dur ?? 0) / 1000)
      .sort((a, b) => a - b);
    await page.locator('.utm-result').waitFor({ timeout: 900000 });
    const r = await page.evaluate(() => {
      clearInterval(window.__tapper);
      return { now: performance.now(), writes: window.__writes.slice(), long: window.__long.slice(), taps: window.__tap };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:v1')).playtime ?? null);
    const writes = r.writes.slice(writesAtStart).filter((t) => t >= t0);
    const bankAt = writes[writes.length - 1] ?? r.now;
    const during = writes.filter((t) => t < bankAt - 50).length;
    const active = (bankAt - t0) / 1000;
    // the match's own seconds: counted minus menu seconds (menus browsed before it bank with it)
    const play = (x) => (x?.daySec ?? 0) - (x?.dayMenuSec ?? 0);
    const counted = play(after) - play(before);
    const report = {
      sport,
      focused,
      speed: SPEED,
      cpu: CPU,
      activeSec: +active.toFixed(1),
      countedSec: counted,
      diffPct: +((100 * (counted - active)) / active).toFixed(2),
      acts: (after?.acts ?? 0) - (before?.acts ?? 0),
      writesDuringPlay: during,
      writesAtBank: writes.length - during,
      taps: r.taps,
      menuSecBanked: (after?.dayMenuSec ?? 0) - (before?.dayMenuSec ?? 0),
      // CDP throttling suspends the main thread in slices, so a short callback sometimes absorbs a
      // whole suspension: the median is the callback's own cost, the mean and max include those
      // thread time per call of the ticker, at the --cpu throttle
      tickCpuMs: { n: cpu.length, median: +(cpu[cpu.length >> 1] ?? 0).toFixed(4), p90: +(cpu[Math.floor(cpu.length * 0.9)] ?? 0).toFixed(4), max: +Math.max(0, ...cpu).toFixed(4) },
      longTasksOver50: r.long.length,
      errors,
      blockedHosts: [...new Set(blocked)],
      sockets,
    };
    await page.screenshot({ path: path.join(OUT, 'minutes-' + sport + '-result.png') });
    fs.writeFileSync(path.join(OUT, 'minutes-' + sport + '.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report));
    const ok = during === 0 && report.writesAtBank === 1 && Math.abs(report.diffPct) <= 5 && report.tickCpuMs.n > 5 && report.tickCpuMs.median <= 0.2 && !errors.length && !sockets.refused.length;
    if (!ok) failed = true;
    console.log(sport + ': ' + (ok ? 'PASS' : 'FAIL'));
    await context.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
