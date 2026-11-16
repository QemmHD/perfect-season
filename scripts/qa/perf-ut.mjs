// Claude (studio overhaul, shell-1, 2026-11-10): how long Ultimate Team takes to open, measured the
// way the 2026-11-09 performance audit did it (coldstart.cjs phase C), but isolated and with real
// players. Each run is a fresh context: the fixture is injected (fixtures.mjs), the page loads once so
// a production build's worker installs and precaches, then loads again so nothing is in memory, and
// the UT tab is tapped with the CPU at the chosen slowdown.
//
//   node scripts/qa/perf-ut.mjs [--sports nba,nfl,soccer] [--profiles standard,heavy] [--rates 1,4]
//     [--runs 3] [--dsf 3] [--cpu-profile first|all|none] [--ready tabs|audit] [--label before]
//
// Recorded per run: tap → UT ready (`.ut-tabs` on screen and no `.ut-loading`; `--ready audit` uses the
// audit's looser condition instead), tap → first paint
// after that, long tasks (count, total, longest), heap after a forced GC on Home and after UT, and
// the JS/JSON bytes decoded for the open. Medians over the runs go in the summary.
//
// CPU profile of the open (`--cpu-profile`, the first run of each case by default):
//  - production build (PS_QA_BUILD_ROOT set): no source maps and minified names, so self time is
//    grouped by chunk (cards-nba-*.js is the card data evaluated as a JS object literal, …) and the
//    heaviest functions are listed with their chunk and position;
//  - dev server: real function names. Self time is split at the end of the card pool build
//    (buildPool/poolBuilder/buildPoolInSlices) into "pool" and "first render", the top functions of
//    each are listed, and rate.ts's own functions are reported per 1,000 rated card lines.
// Isolation: ?ns=inspect, local relay, every non-localhost host aborted (browser.mjs isolate).
//
// Output: <PS_QA_SHOTS>/perf-ut/perf-ut-<label>.json (runs, medians, profiles) and one line per run.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifacts, base, buildRoot, isolate, launch } from './browser.mjs';
import { inject, waitForHome } from './fixtures.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const sports = opt('sports', 'nba,nfl,soccer').split(',');
const profiles = opt('profiles', 'standard,heavy').split(',');
const rates = opt('rates', '1').split(',').map(Number);
const runs = Math.max(1, +opt('runs', 3));
const dsf = +opt('dsf', 3);
const cpuProfile = opt('cpu-profile', 'first');
const label = opt('label', buildRoot ? 'build' : 'dev');
const readyAs = opt('ready', 'tabs');
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), 'perf-ut');

const appUrl = (sport) => {
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  return u.href;
};
const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};
const mb = (n) => +(n / 1048576).toFixed(1);

/** Long tasks from the start of every document (the same observer the audit used). */
const LONG_TASKS = () => {
  window.__lt = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // no long-task timing in this browser
  }
};

/** Heap in use after a full collection, in bytes. */
async function heapAfterGc(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  return (await cdp.send('Runtime.getHeapUsage')).usedSize;
}

/**
 * Self time of a CPU profile, per node, with each node's stack. `split` names functions whose last
 * sample ends phase one ("pool"); later samples are phase two ("render").
 */
export function aggregateProfile(profile, split = null) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const stackHas = (id, names) => {
    for (let x = id; x !== undefined; x = parent.get(x)) if (names.includes(byId.get(x).callFrame.functionName)) return true;
    return false;
  };
  let t = profile.startTime,
    splitAt = null;
  const times = profile.samples.map((id, i) => (t += profile.timeDeltas[i] ?? 0));
  if (split) profile.samples.forEach((id, i) => stackHas(id, split) && (splitAt = times[i]));
  const self = { pool: new Map(), render: new Map(), all: new Map() };
  const add = (m, k, us) => m.set(k, (m.get(k) ?? 0) + us);
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = profile.timeDeltas[i + 1] ?? 0;
    const id = profile.samples[i];
    add(self.all, id, dt);
    if (splitAt !== null) add(times[i] <= splitAt ? self.pool : self.render, id, dt);
  }
  return { byId, self, splitAt: splitAt === null ? null : (splitAt - profile.startTime) / 1000, totalMs: (profile.endTime - profile.startTime) / 1000 };
}

const fileOf = (url) => (url ? url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '') : '');
const IDLE = ['(idle)', '(program)', '(garbage collector)', '(root)'];

/** Top functions by self time (idle and unattributed time left out; GC kept): name, file:line, ms. */
function topFunctions(byId, selfMap, n = 12, lines = null) {
  const rows = new Map();
  for (const [id, us] of selfMap) {
    const f = byId.get(id).callFrame;
    if (['(idle)', '(program)', '(root)'].includes(f.functionName)) continue;
    const key = (f.functionName || '(anonymous)') + ' ' + fileOf(f.url) + ':' + (f.lineNumber + 1) + ':' + (f.columnNumber + 1);
    rows.set(key, (rows.get(key) ?? 0) + us);
  }
  return [...rows]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([fn, us]) => ({ fn, ms: Math.round(us / 100) / 10, ...(lines ? { msPer1000Lines: Math.round((us / lines) * 100) / 100 } : {}) }));
}

/** Self time grouped by script file (a production chunk, or a dev module), plus GC and idle. */
function byFile(byId, selfMap, n = 12) {
  const rows = new Map();
  for (const [id, us] of selfMap) {
    const f = byId.get(id).callFrame;
    const key = IDLE.includes(f.functionName) ? f.functionName : fileOf(f.url).replace(/^.*\/assets\//, 'assets/') || '(native)';
    rows.set(key, (rows.get(key) ?? 0) + us);
  }
  return [...rows].sort((a, b) => b[1] - a[1]).slice(0, n).map(([file, us]) => ({ file, ms: Math.round(us / 100) / 10 }));
}

/** rate.ts's own functions (dev names), ms in total and per 1,000 rated lines. */
function rateCosts(byId, selfMap, lines) {
  const rows = new Map();
  for (const [id, us] of selfMap) {
    const f = byId.get(id).callFrame;
    if (!/\/src\/ut\/rate\.ts$/.test(fileOf(f.url))) continue;
    const key = f.functionName || '(anonymous)';
    rows.set(key, (rows.get(key) ?? 0) + us);
  }
  return [...rows]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([fn, us]) => ({ fn, ms: Math.round(us / 100) / 10, msPer1000Lines: lines ? Math.round((us / 1000 / (lines / 1000)) * 100) / 100 : null }));
}

const POOL_FNS = ['buildPool', 'poolBuilder', 'buildPoolInSlices'];

async function run(browser, sport, profile, rate, withProfile) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  const blocked = await isolate(context);
  await inject(context, profile, sport, 'Perf QA');
  await context.addInitScript(LONG_TASKS);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  try {
    // 1. first load: a production build's worker installs and precaches (as on a phone after an update)
    await page.goto(appUrl(sport), { waitUntil: 'domcontentloaded' });
    await waitForHome(page);
    const worker = buildRoot
      ? await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => 'active'), new Promise((r) => setTimeout(() => r('none'), 20000))]))
      : 'dev server';
    // 2. a fresh document: nothing of UT in memory, every file from the worker's cache or the HTTP cache
    await page.goto(appUrl(sport), { waitUntil: 'domcontentloaded' });
    await waitForHome(page);
    await page.waitForTimeout(1500);
    const heapHome = await heapAfterGc(cdp);
    await page.evaluate((audit) => {
      window.__lt = [];
      performance.clearResourceTimings();
      window.__tap = null;
      window.__utReady = null;
      window.__utPaint = null;
      addEventListener('pointerdown', () => (window.__tap ??= performance.now()), { capture: true, once: true });
      // the audit's condition (any ut- element and no spinner) also counts the starter-pack screen and
      // UT's first shell as ready; the default waits for the tab bar
      const ready = audit
        ? () => !document.querySelector('.ut-loading') && !!document.querySelector('.ut-title, .ut-tabs, [class*="ut-"]')
        : () => !!document.querySelector('.ut-tabs') && !document.querySelector('.ut-loading');
      const mo = new MutationObserver(() => {
        if (window.__tap === null || !ready()) return;
        window.__utReady = performance.now();
        mo.disconnect();
        requestAnimationFrame(() => setTimeout(() => (window.__utPaint = performance.now()), 0));
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }, readyAs === 'audit');
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    if (withProfile) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');
    }
    await page.locator('.tab-ut').tap();
    await page.waitForFunction(() => window.__utPaint !== null, null, { timeout: 180000, polling: 100 });
    const cpu = withProfile ? (await cdp.send('Profiler.stop')).profile : null;
    await page.waitForTimeout(rate === 1 ? 1500 : 4000);
    if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const m = await page.evaluate(() => {
      const res = performance.getEntriesByType('resource').filter((r) => /\.(m?js|json)(\?|$)/.test(r.name));
      return {
        readyMs: Math.round(window.__utReady - window.__tap),
        paintMs: Math.round(window.__utPaint - window.__tap),
        tapAt: window.__tap,
        longTasks: window.__lt.filter((x) => x[0] >= window.__tap).length,
        longTaskMs: window.__lt.filter((x) => x[0] >= window.__tap).reduce((s, x) => s + x[1], 0),
        longest: Math.max(0, ...window.__lt.filter((x) => x[0] >= window.__tap).map((x) => x[1])),
        files: res.length,
        decodedKB: Math.round(res.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024),
      };
    });
    const heapUt = await heapAfterGc(cdp);
    let prof = null;
    if (cpu) {
      const dev = !buildRoot;
      const agg = aggregateProfile(cpu, dev ? POOL_FNS : null);
      const lines = dev ? await page.evaluate(async () => (await (await import('/src/ut/pool.ts')).getPool()).base.size).catch(() => null) : null;
      prof = {
        totalMs: Math.round(agg.totalMs),
        byFile: byFile(agg.byId, agg.self.all),
        top: topFunctions(agg.byId, agg.self.all),
        ...(dev
          ? {
              poolEndsAtMs: agg.splitAt === null ? null : Math.round(agg.splitAt),
              ratedLines: lines,
              poolTop: topFunctions(agg.byId, agg.self.pool, 10, lines),
              renderTop: topFunctions(agg.byId, agg.self.render, 10),
              renderMs: Math.round([...agg.self.render.entries()].filter(([id]) => !IDLE.includes(agg.byId.get(id).callFrame.functionName)).reduce((s, [, us]) => s + us, 0) / 1000),
              rate: rateCosts(agg.byId, agg.self.all, lines),
            }
          : {}),
      };
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `cpu-${label}-${sport}-${profile}-x${rate}.cpuprofile`), JSON.stringify(cpu));
    }
    return { sport, profile, rate, worker, ...m, heapHomeMB: mb(heapHome), heapUtMB: mb(heapUt), errors, blocked: [...new Set(blocked)], cpu: prof };
  } finally {
    await context.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const browser = await launch();
  const all = [];
  const summary = [];
  try {
    for (const sport of sports)
      for (const profile of profiles)
        for (const rate of rates) {
          const rs = [];
          for (let i = 0; i < runs; i++) {
            const r = await run(browser, sport, profile, rate, cpuProfile === 'all' || (cpuProfile === 'first' && i === 0));
            rs.push(r);
            all.push(r);
            const { cpu: p, ...line } = r;
            console.log(JSON.stringify({ ...line, run: i + 1, cpu: p ? { totalMs: p.totalMs, poolEndsAtMs: p.poolEndsAtMs, renderMs: p.renderMs } : null }));
          }
          summary.push({
            sport,
            profile,
            rate,
            runs: rs.length,
            readyMs: median(rs.map((r) => r.readyMs)),
            paintMs: median(rs.map((r) => r.paintMs)),
            longest: median(rs.map((r) => r.longest)),
            longTaskMs: median(rs.map((r) => r.longTaskMs)),
            heapHomeMB: median(rs.map((r) => r.heapHomeMB * 10)) / 10,
            heapUtMB: median(rs.map((r) => r.heapUtMB * 10)) / 10,
            decodedKB: median(rs.map((r) => r.decodedKB)),
            readyEach: rs.map((r) => r.readyMs),
            errors: rs.flatMap((r) => r.errors),
            blocked: [...new Set(rs.flatMap((r) => r.blocked))],
          });
        }
  } finally {
    await browser.close();
  }
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `perf-ut-${label}.json`);
  fs.writeFileSync(file, JSON.stringify({ label, base, build: buildRoot, dsf, ready: readyAs, viewport: '390x844', summary, runs: all }, null, 1));
  console.log(JSON.stringify({ file, summary: summary.map(({ readyEach, errors, blocked, ...s }) => ({ ...s, errors: errors.length, blocked })) }));
  if (all.some((r) => r.errors.length)) process.exitCode = 1;
}
