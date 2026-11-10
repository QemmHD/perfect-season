// Team nfl browser baselines (Claude, studio overhaul), on the dev server at port 5216, isolated by
// nfl-lib.mjs. Each mode prints one JSON line per measurement.
//
//   node scripts/qa/nfl-baselines.mjs load      PLAY tap to the first playable tray (draft and UT), at 1x and 4x CPU,
//                                                and the nfl-attrs bytes a UT match fetches
//   node scripts/qa/nfl-baselines.mjs heap      JS heap after two autoplayed drives
//   node scripts/qa/nfl-baselines.mjs profiler  React commits during a 2 s drag of the run stick
//   node scripts/qa/nfl-baselines.mjs wall [n]  n autoplayed games at 1x with real timers, each drive's wall time
//                                                against the pacing model (sim-kit playWall) for the same plays
//
// Positions and timings are read QA-side only (the renderer's draw call, Juice's hit-stop, React's
// devtools hook); no product debug hook is shipped.
import { launch, phone, report, serverUp } from './nfl-lib.mjs';

const MODE = process.argv[2] ?? 'load';
if (!(await serverUp())) throw Error('Start the dev server on port 5216 first');
const browser = await launch();
const results = [];
const log = (r) => {
  results.push(r);
  console.log(JSON.stringify(r));
};

/** Mount an Arcade on top of the app, as a draft game (`ut: false`) or a UT match (`ut: true`), at its kickoff. */
async function mountArcade(page, ut) {
  return page.evaluate(async (ut) => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { Arcade } = await import('/src/game/Arcade.tsx');
    const { kitsFor } = await import('/src/game/uniforms.ts');
    let props;
    if (ut) {
      const { loadCards } = await import('/src/ut/cards.ts');
      const { teamsOf } = await import('/src/ut/teams.ts');
      const pinned = await (await fetch('/docs/studio-overhaul/nfl-calibration/fixtures.json')).json();
      const pool = await loadCards('nfl');
      const sq = Object.fromEntries(Object.entries(pinned.tiers.gold.cards).map(([slot, id]) => [slot, { line: pool.byId.get(id), level: 1 }]));
      props = { teams: teamsOf('nfl', sq, sq, 'baseline-ut') };
    } else {
      const { CELLS } = await import('/src/engine/data.ts');
      const { rankOf } = await import('/src/game/football/model.ts');
      const at = (pos, l) => {
        const list = CELLS.flatMap((c) => c.players)
          .filter((p) => p.pos[0] === pos)
          .sort((a, b) => rankOf(a) - rankOf(b));
        return list[Math.floor(l * (list.length - 1))];
      };
      const lineup = (l) => ({ QB: at('QB', l), RB: at('RB', l), WR: at('WR', l), TE: at('TE', l), FLEX: at('WR', l - 0.04), DL: at('DL', l), LB: at('LB', l), DB: at('DB', l) });
      props = { lineup: lineup(0.8), rivalLineup: lineup(0.6) };
    }
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#06121a';
    document.body.append(host);
    window.__mountT = performance.now();
    (dom.createRoot ?? dom.default.createRoot)(host).render(
      React.createElement(Arcade, { ...props, rivalName: 'RIVAL', seed: 'baseline', online: false, botLevel: 'pro', rivalLive: null, rivalGone: false, tookMe: null, kits: kitsFor(null, null, 'nfl'), onProgress: () => {}, onTakeover: () => {}, onFinish: () => {} })
    );
  }, ut);
}

/** Lab autoplay with the play log, progress and truck hit-stops recorded for the timing model. */
async function autoplayLab(page, url, seed) {
  await page.addInitScript(() => {
    window.__wall = { t0: null, sawLoading: false, progress: [], ends: [], trucks: [] };
    new MutationObserver(() => {
      const w = window.__wall;
      const loading = !!document.querySelector('.fg-loading');
      if (loading) w.sawLoading = true;
      else if (w.sawLoading && w.t0 === null) w.t0 = performance.now();
      const span = document.querySelector('[data-progress]');
      const v = span?.getAttribute('data-progress');
      if (v && v !== 'null' && v !== w.last) {
        w.last = v;
        w.progress.push({ t: performance.now(), ...JSON.parse(v) });
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-progress'] });
  });
  await page.goto(url({ arcade: '', sport: 'nfl', auto: '', seed }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wall.t0 !== null, null, { timeout: 60000 });
  await page.evaluate(async () => {
    const { FootballRenderer } = await import(performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === '/src/game/football2/render.ts').pop() ?? '/src/game/football2/render.ts');
    const { Juice } = await import(performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === '/src/game/juice.ts').pop() ?? '/src/game/juice.ts');
    const seen = new WeakSet();
    const draw = FootballRenderer.prototype.draw;
    FootballRenderer.prototype.draw = function (ctx, p, los, o) {
      if (p.end && !seen.has(p)) {
        seen.add(p);
        window.__wall.ends.push({ t: performance.now(), secs: p.end.secs, kind: p.end.kind });
      }
      return draw.call(this, ctx, p, los, o);
    };
    const hitStop = Juice.prototype.hitStop;
    Juice.prototype.hitStop = function (kind, now) {
      if (kind === 'truck') window.__wall.trucks.push(performance.now());
      return hitStop.call(this, kind, now);
    };
  });
}

try {
  if (MODE === 'load') {
    for (const cpu of [1, 4])
      for (const ut of [false, true]) {
        const { page, context, errors, url } = await phone(browser, { viewport: 'A', reducedMotion: 'reduce' });
        let attrsBytes = 0;
        page.on('response', async (r) => {
          if (/nfl-attrs/.test(r.url())) attrsBytes += (await r.body().catch(() => Buffer.alloc(0))).length;
        });
        await page.goto(url({ sport: 'nfl' }), { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
        await mountArcade(page, ut);
        const play = page.locator('.arc-kick button.big.shine');
        await play.waitFor();
        await page.waitForFunction(() => !document.querySelector('.arc-kick button.big.shine')?.disabled, null, { timeout: 60000 });
        const enabledAt = await page.evaluate(() => performance.now() - window.__mountT);
        const clickAt = await page.evaluate(() => {
          window.__clickT = performance.now();
          document.querySelector('.arc-kick button.big.shine').click();
          return window.__clickT;
        });
        await page.waitForSelector('.fb2-call .fb2-go.snap', { timeout: 60000 });
        const trayAt = await page.evaluate(() => performance.now());
        log({ mode: 'load', match: ut ? 'ut' : 'draft', cpu, mountToPlayEnabledMs: Math.round(enabledAt), playToTrayMs: Math.round(trayAt - clickAt), mountToTrayMs: Math.round(enabledAt + trayAt - clickAt), nflAttrsBytes: attrsBytes, errors });
        await context.close();
      }
  } else if (MODE === 'heap') {
    const { page, context, errors, url } = await phone(browser, { viewport: 'A', reducedMotion: 'reduce' });
    await autoplayLab(page, url, 'heap');
    await page.waitForFunction(() => window.__wall.progress.some((p) => p.drive >= 2), null, { timeout: 600000 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize, totalSize } = await cdp.send('Runtime.getHeapUsage');
    log({ mode: 'heap', afterDrives: 2, usedMB: +(usedSize / 1048576).toFixed(1), totalMB: +(totalSize / 1048576).toFixed(1), errors });
    await context.close();
  } else if (MODE === 'profiler') {
    const { page, context, errors, url } = await phone(browser, { viewport: 'A', reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.__commits = 0;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        isDisabled: false,
        supportsFiber: true,
        renderers: new Map(),
        inject(r) {
          this.renderers.set(1, r);
          return 1;
        },
        onScheduleFiberRoot() {},
        onCommitFiberRoot() {
          window.__commits++;
        },
        onCommitFiberUnmount() {},
        onPostCommitFiberRoot() {},
        setStrictMode() {},
        checkDCE() {}
      };
    });
    await page.goto(url({ arcade: '', sport: 'nfl', seed: 'profiler' }), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.fb2-call', { timeout: 60000 });
    // keep the run alive for the whole drag: the defenders are held off the field (QA-side only)
    await page.evaluate(async () => {
      const { FootballRenderer } = await import(performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === '/src/game/football2/render.ts').pop() ?? '/src/game/football2/render.ts');
      const draw = FootballRenderer.prototype.draw;
      FootballRenderer.prototype.draw = function (ctx, p, los, o) {
        if (p.phase !== 'pre') for (const d of p.bodies.filter((b) => b.side === 'D')) Object.assign(d, { x: 2, y: 105, vx: 0, vy: 0, stunUntil: Infinity });
        return draw.call(this, ctx, p, los, o);
      };
    });
    const cards = page.locator('.fb2-cards .fb2-card');
    for (let i = 0; i < (await cards.count()); i++)
      if ((await cards.nth(i).innerText()).includes('RUN')) {
        await cards.nth(i).click();
        break;
      }
    await page.getByRole('button', { name: 'SNAP', exact: true }).click();
    const stick = page.getByRole('group', { name: /Run joystick:/ });
    await stick.waitFor();
    await page.waitForTimeout(800);
    const b = await stick.boundingBox();
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const before = await page.evaluate(() => window.__commits);
    let moves = 0;
    const start = Date.now();
    while (Date.now() - start < 2000) {
      const a = (moves / 30) * Math.PI;
      await page.mouse.move(cx + Math.cos(a) * 30, cy - 25 + Math.sin(a) * 12);
      moves++;
      await page.waitForTimeout(8);
    }
    const commits = (await page.evaluate(() => window.__commits)) - before;
    await page.mouse.up();
    log({ mode: 'profiler', dragMs: Date.now() - start, pointerMoves: moves, commits, errors });
    await context.close();
  } else if (MODE === 'wall') {
    const games = Number(process.argv[3] ?? 5);
    for (let gi = 0; gi < games; gi++) {
      const { page, context, errors, url } = await phone(browser, { viewport: 'A', reducedMotion: 'reduce' });
      await autoplayLab(page, url, 'wall' + (gi + 1));
      await page.waitForFunction(() => window.__wall.progress.some((p) => p.done), null, { timeout: 900000 });
      const r = await page.evaluate(async () => {
        const kit = await import('/src/game/football2/sim-kit.ts');
        const w = window.__wall;
        const recs = [];
        let prev = { score: 0, drive: 0 };
        let endAt = 0;
        let lastT = w.t0;
        for (const p of w.progress) {
          // the play this progress reports: the last play end since the previous report, or a kick
          const end = w.ends.filter((e) => e.t > lastT && e.t <= p.t + 5).pop();
          const after = p.score > prev.score ? 'score' : p.drive > prev.drive || p.done ? 'drive' : 'play';
          const trucks = w.trucks.filter((t) => t > lastT && t <= p.t).length;
          recs.push(end ? { kind: 'snap', secs: end.secs, after, trucks, replay: null, last: !!p.done } : { kind: 'kick', secs: 0, after, trucks: 0, replay: null, last: !!p.done });
          endAt = p.t;
          lastT = p.t;
          prev = p;
        }
        // drive boundaries: measured at each report that closed a drive; the model's are its running sum
        // (each play's wall minus its whistle-to-tray wait, which the report comes before)
        const measured = [];
        const model = [];
        let m0 = w.t0;
        let sum = 0;
        let mPrev = 0;
        for (let i = 0; i < w.progress.length; i++) {
          const part = kit.playWallParts(recs[i], kit.AUTO_PACE);
          const at = sum + part.live;
          sum += part.live + part.after;
          if (recs[i].after !== 'play') {
            measured.push((w.progress[i].t - m0) / 1000);
            model.push(at - mPrev);
            m0 = w.progress[i].t;
            mPrev = at;
          }
        }
        return { plays: recs.length, kicks: recs.filter((r) => r.kind === 'kick').length, gameMs: Math.round(endAt - w.t0), measuredDrives: measured.map((x) => +x.toFixed(2)), modelDrives: model.map((x) => +x.toFixed(2)) };
      });
      const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
      log({ mode: 'wall', game: gi + 1, ...r, measuredMean: +mean(r.measuredDrives).toFixed(2), modelMean: +mean(r.modelDrives).toFixed(2), errors });
      await context.close();
    }
    const walls = results.filter((r) => r.mode === 'wall');
    const all = (k) => walls.flatMap((r) => r[k]);
    const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const m = mean(all('measuredDrives')),
      md = mean(all('modelDrives'));
    console.log(JSON.stringify({ mode: 'wall-summary', games: walls.length, drives: all('measuredDrives').length, measuredMeanDrive: +m.toFixed(2), modelMeanDrive: +md.toFixed(2), modelOverMeasured: +(md / m).toFixed(3) }));
  } else throw Error('Unknown mode ' + MODE);
} finally {
  await browser.close();
}
report();
