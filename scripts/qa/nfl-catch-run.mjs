// Team nfl (Claude, studio overhaul): does a receiver keep running after the catch when the player
// never touches the stick? In the real component on the dev server (port 5216, isolated), it calls
// a pass, throws to the back and leaves the stick alone, reading the carrier from the renderer's
// draw call (QA-only, as audit nfl_catchstop.cjs did; no product hook). Passes when every one of six
// free carriers (the play still live 0.5 s after the catch) keeps at least 70% of his catch speed
// at +0.25 s and 50% at +0.5 s, and at least five of six gain more than a yard after the catch. It
// also photographs the HOLD TO RUN ghost while the ball is in the air and a carrier at +0.25 s.
//
// With `held` (the nfl-1 review fix), a thumb lands in the stick zone while the ball is in the air
// and holds the stick hard right through the catch, as real multi-touch. Passes when every one of
// six carriers turns right at once: vx rises at least 1.5 yd/s by +0.1 s after the catch and he is
// moving right (vx > 0) by +0.25 s. It also photographs the top hint while the ball is in the air.
//
//   node scripts/qa/nfl-catch-run.mjs [A,C] [no-preference|reduce|both] [free|held]
import { launch, phone, report, serverUp, shotPath } from './nfl-lib.mjs';

const VIEWS = (process.argv[2] ?? 'A,C').split(',');
const MOTION = process.argv[3] ?? 'both';
const HELD = (process.argv[4] ?? 'free') === 'held';
const NEED = 6;
const SEEDS = Array.from({ length: 16 }, (_, i) => 'catch' + (i + 1));

if (!(await serverUp())) throw Error('Start the dev server on port 5216 first');
const browser = await launch();
const out = [];
let pass = true;
try {
  for (const view of VIEWS)
    for (const reducedMotion of MOTION === 'both' ? ['no-preference', 'reduce'] : [MOTION]) {
      const { page, context, errors, url, viewport } = await phone(browser, { viewport: view, reducedMotion });
      const cdp = HELD ? await context.newCDPSession(page) : null;
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      const carriers = [];
      const tried = [];
      let ghostShot = false;
      let catchShot = false;
      for (const seed of SEEDS) {
        if (carriers.length >= NEED) break;
        await page.goto(url({ arcade: '', sport: 'nfl', seed }), { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.fb2-tray', { timeout: 60000 });
        await page.evaluate(async () => {
          const { FootballRenderer } = await import(performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === '/src/game/football2/render.ts').pop() ?? '/src/game/football2/render.ts');
          if (!window.__catchDraw) {
            window.__catchDraw = FootballRenderer.prototype.draw;
            FootballRenderer.prototype.draw = function (ctx, p, los, o) {
              if (p.phase !== 'pre' && window.__log) window.__log.push({ t: p.t, phase: p.phase, slot: p.carrier?.slot ?? null, v: p.carrier ? Math.hypot(p.carrier.vx, p.carrier.vy) : null, vx: p.carrier ? p.carrier.vx : null, y: p.carrier?.y ?? null, end: p.end ? p.end.kind : null });
              return window.__catchDraw.call(this, ctx, p, los, o);
            };
          }
          window.__log = [];
        });
        const cards = page.locator('.fb2-tray .fb2-card[data-call]');
        for (let i = 0; i < (await cards.count()); i++)
          if ((await cards.nth(i).innerText()).includes('PASS')) {
            await cards.nth(i).click();
            break;
          }
        await page.getByRole('button', { name: 'SNAP', exact: true }).click();
        await page.waitForTimeout(900);
        // (the chip may sit in the stick zone, which owns touches there: throw through its keyboard path)
        await page.getByRole('button', { name: /^Pass to RB/ }).dispatchEvent('click');
        // held: a thumb lands in the stick zone while the ball is in the air and pushes hard right
        if (HELD) {
          for (let k = 0; k < 40 && (await page.evaluate(() => window.__log.at(-1)?.phase)) !== 'air'; k++) await page.waitForTimeout(15);
          const x = Math.round(viewport.w * 0.2);
          const y = Math.round(viewport.h * 0.78);
          await touch('touchStart', [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]);
          for (const dx of [10, 25, 45, 70]) await touch('touchMove', [{ x: x + dx, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]);
          await page.waitForTimeout(60);
          if (!ghostShot) {
            ghostShot = true;
            await page.screenshot({ path: shotPath('nfl-1', `air-held-${view}-${reducedMotion}`) });
          }
        }
        // the ball in the air: the stick shows, untouched (the ghost, once the momentum carry is in)
        if (!ghostShot) {
          await page.waitForTimeout(120);
          if (await page.locator('.v2-stick.ghost').count()) {
            ghostShot = true;
            await page.screenshot({ path: shotPath('nfl-1', `ghost-${view}-${reducedMotion}`) });
          }
        }
        let shotTaken = catchShot;
        for (let k = 0; k < 120; k++) {
          const st = await page.evaluate(() => {
            const log = window.__log;
            const i = log.findIndex((f) => f.phase === 'run' && f.slot === 'RB');
            const last = log[log.length - 1];
            return { caught: i >= 0, since: i >= 0 ? last.t - log[i].t : 0, dead: !!last?.end, phase: last?.phase };
          });
          if (st.caught && !shotTaken && st.since >= 0.25) {
            shotTaken = catchShot = true;
            await page.screenshot({ path: shotPath('nfl-1', `catch-0.25s-${view}-${reducedMotion}`) });
          }
          if (st.dead && (!st.caught || st.since >= 0.6 || st.phase === 'dead')) break;
          await page.waitForTimeout(50);
        }
        await page.waitForTimeout(250);
        if (HELD) await touch('touchEnd', []);
        const log = await page.evaluate(() => window.__log);
        const ci = log.findIndex((f) => f.phase === 'run' && f.slot === 'RB');
        const end = log.find((f) => f.end)?.end ?? null;
        if (ci < 0) {
          tried.push({ seed, caught: false, end });
          continue;
        }
        const at = log[ci];
        const live = log.filter((f) => f.phase === 'run');
        const after = (dt) => live.find((f) => f.t >= at.t + dt);
        const lastRun = live[live.length - 1];
        const r = {
          seed,
          catchT: +at.t.toFixed(2),
          vCatch: +at.v.toFixed(2),
          v025: after(0.25) ? +after(0.25).v.toFixed(2) : null,
          v05: after(0.5) ? +after(0.5).v.toFixed(2) : null,
          yac: +(lastRun.y - at.y).toFixed(1),
          end,
          ranFor: +(lastRun.t - at.t).toFixed(2),
          vxCatch: +at.vx.toFixed(2),
          vx01: after(0.1) ? +after(0.1).vx.toFixed(2) : null,
          vx025: after(0.25) ? +after(0.25).vx.toFixed(2) : null
        };
        tried.push(r);
        // a carrier tackled inside half a second says nothing about braking: he isn't counted
        if (HELD) {
          if (r.vx025 !== null) carriers.push({ ...r, turn01: +(r.vx01 - r.vxCatch).toFixed(2) });
        } else if (r.v05 !== null) carriers.push({ ...r, keep025: +(r.v025 / Math.max(0.01, r.vCatch)).toFixed(2), keep05: +(r.v05 / Math.max(0.01, r.vCatch)).toFixed(2) });
      }
      const ok025 = carriers.filter((c) => c.keep025 >= 0.7).length;
      const ok05 = carriers.filter((c) => c.keep05 >= 0.5).length;
      const yac1 = carriers.filter((c) => c.yac > 1).length;
      const turned = carriers.filter((c) => c.turn01 >= 1.5 && c.vx025 > 0).length;
      const good = HELD ? carriers.length >= NEED && turned >= NEED && errors.length === 0 : carriers.length >= NEED && ok025 >= NEED && ok05 >= NEED && yac1 >= NEED - 1 && errors.length === 0;
      pass &&= good;
      if (HELD) out.push({ view, reducedMotion, held: true, carriers: carriers.length, turnedRight: turned, pass: good, errors, detail: carriers, tried: tried.filter((t) => !t.vx025) });
      else out.push({ view, reducedMotion, carriers: carriers.length, keep70at025: ok025, keep50at05: ok05, yacOver1: yac1, pass: good, errors, detail: carriers, tried: tried.filter((t) => !t.v05) });
      await context.close();
    }
} finally {
  await browser.close();
}
for (const o of out) console.log(JSON.stringify(o));
console.log(pass ? 'catch-run: PASS' : 'catch-run: FAIL');
if (!report() || !pass) process.exitCode = 1;
