// V2 baseline probe for plan §3.8 (Claude 2026-11-16): today's NBA controls, HUD and camera measured
// against the V2 A.5 geometry table (targets.ts GEO), at 393×852 (sat 59 / sab 34) and 320×568
// (20 / 0), on `.arcade-full` with the insets injected; the other six sizes report overlaps, small
// targets and controls under the insets. Prints a value for every §3.8 row ("absent" where today's
// game has no such control) and writes JSON.
//   node scripts/audit/nba-geo.mjs
// Today's controls map onto V2's slots as: A = SHOOT, B = PASS, C = the SCREEN/CUT/SPACE calls,
// D = the CROSS/STEP BACK/SPIN skill buttons, stick = the fixed stick, toast = the hint/banner line.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { context, launch, needServer, openLab, PORTRAIT, rect, report, shot, SIZES, touch, wait } from './nba-lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// the V2 table itself (node strips the file's types on import)
const { GEO, GEO_GAPS } = await import('../../src/game/hoops2/targets.ts');

const SLOT = { A: '.hg2-shoot', B: '.hg2-pass', C: '.hg2-coach button', D: '.hg2-skills button', stick: '.hg2-stick' };
const RIGHT = ['.hg2-shoot', '.hg2-pass', '.hg2-coach button', '.hg2-skills button', '.play-readout-toggle'];

/** every tappable control's box */
const controls = (page) =>
  page.$$eval('.arcade-full button, .arcade-full .hg2-stick', (els) =>
    els
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => {
        const r = e.getBoundingClientRect();
        const round = Math.abs(r.width - r.height) < 1 && parseFloat(getComputedStyle(e).borderTopLeftRadius) >= r.width / 2 - 1;
        return { sel: e.className || e.tagName, label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), x: r.x, y: r.y, w: r.width, h: r.height, round };
      })
  );

/** smallest font of any visible text inside the game */
const minText = (page) =>
  page.$$eval('.arcade-full *', (els) => {
    let min = Infinity;
    let who = '';
    for (const e of els) {
      if (e.offsetParent === null) continue;
      if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (fs < min) {
        min = fs;
        who = e.textContent.trim().slice(0, 20);
      }
    }
    return { px: min, text: who };
  });

/**
 * Camera samples from the engine (the dev probe), every frame of an autoplay game: the handler's
 * feet and head, the rim, the ball's distance to it, and at each release the on-ball defender's
 * overlap of the shooter's sprite (a 2.4 × 7.5 ft box at his feet).
 */
const sampleCamera = (page, n) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const RIM = { cx: 41.75, cz: 0 };
        const out = [];
        const releases = [];
        let shotBall = false;
        const step = () => {
          const q = window.__hg2;
          const p = q?.possession();
          const c = q?.canvas()?.getBoundingClientRect();
          if (q && p && c && !p.end) {
            const z = q.zoom();
            const at = (cx, cz, h = 0) => {
              const s = q.screenOf(cx, cz, h);
              return s && { x: c.left + s.x * z, y: c.top + s.y * z, s: s.s * z };
            };
            const box = (b) => {
              const f = at(b.cx, b.cz, 0);
              const hd = at(b.cx, b.cz, 7.5);
              return f && hd && { x0: f.x - 1.2 * f.s, x1: f.x + 1.2 * f.s, y0: hd.y, y1: f.y };
            };
            const rim = at(RIM.cx, RIM.cz, 10);
            const rimFloor = at(RIM.cx, RIM.cz, 0);
            const hb = p.handler !== null ? p.bodies[p.handler] : null;
            const ballAt = p.ball && 'to' in p.ball ? null : hb;
            const handler = hb ? box(hb) : null;
            const dRim = ballAt ? Math.hypot(ballAt.cx - RIM.cx, ballAt.cz - RIM.cz) : null;
            out.push({ rimY: rim?.y, rimS: rimFloor?.s, handler, dRim });
            const isShot = p.ball?.kind === 'shot';
            if (isShot && !shotBall) {
              const sh = p.bodies[p.ball.who];
              const d = p.bodies.filter((b) => b.side === 'D').sort((a, b) => Math.hypot(a.cx - sh.cx, a.cz - sh.cz) - Math.hypot(b.cx - sh.cx, b.cz - sh.cz))[0];
              const A = box(sh);
              const B = box(d);
              if (A && B) {
                const ix = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0));
                const iy = Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
                // only a defender drawn in front of the shooter (nearer the camera, lower on screen) hides him
                const front = B.y1 > A.y1;
                releases.push(front ? (ix * iy) / ((A.x1 - A.x0) * (A.y1 - A.y0)) : 0);
              }
            }
            shotBall = isShot;
          }
          if (out.length < n) requestAnimationFrame(step);
          else resolve({ samples: out, releases });
        };
        requestAnimationFrame(step);
      }),
    n
  );

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[(s.length - 1) >> 1] : NaN;
};
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : x);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);

/** F35 (render.ts) against every name in cards-nba.json: names the pixel font can't print whole */
function glyphMisses() {
  const r = fs.readFileSync(ROOT + 'src/game/hoops2/render.ts', 'utf8');
  const block = r.slice(r.indexOf('const F35'), r.indexOf('};', r.indexOf('const F35')));
  const keys = new Set([...block.matchAll(/(?:'(.)'|"(.)"|\b(\w))\s*:\s*'[01]{15}'/g)].map((m) => m[1] ?? m[2] ?? m[3]));
  const cards = JSON.parse(fs.readFileSync(ROOT + 'src/data/cards-nba.json', 'utf8'));
  // players are rows: [id, name, …]
  const names = new Set(cards.players.map((row) => row[1]).filter((n) => typeof n === 'string'));
  const bad = [...names].filter((n) => [...n.toUpperCase()].some((ch) => !keys.has(ch)));
  return { glyphs: keys.size, names: names.size, namesWithMisses: bad.length, examples: bad.slice(0, 8) };
}

await needServer();
const browser = await launch();
const out = { v2: GEO, sizes: {} };
try {
  for (const size of Object.keys(SIZES)) {
    const { ctx, page, cdp, errors } = await context(browser, size);
    const H = SIZES[size].h;
    const W = SIZES[size].w;
    const [sat, sar, sab, sal] = SIZES[size].insets;
    await openLab(page, { seed: 'geo' + size });
    await wait(400);
    await shot(page, `geo-${size}-tipoff`);
    const res = { errors };
    const els = await controls(page);
    // overlaps, small targets, controls under the insets
    res.overlaps = [];
    for (let i = 0; i < els.length; i++)
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i];
        const b = els[j];
        // two round buttons overlap only when their circles do (their boxes can meet diagonally)
        const hit = a.round && b.round ? Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) < (a.w + b.w) / 2 - 0.5 : a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
        if (hit) res.overlaps.push(a.label + ' x ' + b.label);
      }
    res.minTarget = r1(Math.min(...els.map((e) => Math.min(e.w, e.h))));
    res.smallTargets = els.filter((e) => Math.min(e.w, e.h) < 44).map((e) => `${e.label} ${Math.round(e.w)}×${Math.round(e.h)}`);
    res.underInsets = els.filter((e) => e.y < sat || e.y + e.h > H - sab || e.x < sal || e.x + e.w > W - sar).map((e) => e.label);
    if (PORTRAIT.includes(size)) {
      const right = els.filter((e) => e.x + e.w / 2 > W / 2 && e.sel !== 'hg2-stick');
      res.rightTargets = right.length;
      res.highestTargetShare = r3(Math.min(...right.map((e) => e.y)) / H);
      res.text = await minText(page);
    }
    if (size === '393' || size === '320') {
      const g = GEO[size];
      const v = {};
      for (const [slot, sel] of Object.entries(SLOT)) {
        const b = await rect(page, sel);
        v[slot] = b && { d: r1(Math.min(b.w, b.h)), w: b.w, h: b.h, cx: b.cx, cy: b.cy };
      }
      const st = v.stick;
      v.zone = st && { x0: r1(st.cx - st.w / 2), x1: r1(st.cx + st.w / 2), y0: r1(st.cy - st.h / 2), y1: r1(st.cy + st.h / 2) };
      v.bug = await rect(page, '.hg2-bug');
      v.pause = null;
      v.heat = null;
      const hint = (await rect(page, '.hg2-hint')) ?? (await rect(page, '.hg2-pop'));
      v.toast = hint && { bottom: r1(hint.y + hint.h), h: hint.h, x: hint.x, w: hint.w };
      const gap = (a, b) => a && b && r1(Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.d / 2 - b.d / 2);
      v.gaps = { AB: gap(v.A, v.B), AC: gap(v.A, v.C), AD: gap(v.A, v.D) };
      // the stick: how fast the knob answers a touch (frames), with no dead zone and a fixed ring today
      if (st) {
        // frames from the pointerdown to the knob drawn moved (rAF timestamps against the event's)
        await page.evaluate(() => {
          const k0 = document.querySelector('.hg2-stick i')?.style.transform;
          let down = null;
          window.__knobFrames = null;
          document.addEventListener('pointerdown', (e) => (down ??= e.timeStamp), { capture: true, once: true });
          const f = (t) => {
            if (down !== null && document.querySelector('.hg2-stick i')?.style.transform !== k0) window.__knobFrames = Math.max(0, Math.ceil((t - down) / (1000 / 60)));
            else if (down === null || t - down < 1000) requestAnimationFrame(f);
            else window.__knobFrames = Infinity;
          };
          requestAnimationFrame(f);
        });
        await touch(cdp, 'touchStart', [{ x: st.cx + 2, y: st.cy - st.h * 0.4, id: 1 }]);
        await page.waitForFunction(() => window.__knobFrames !== null, null, { timeout: 5000 }).catch(() => null);
        v.stickResponseFrames = await page.evaluate(() => window.__knobFrames);
        await touch(cdp, 'touchEnd', []);
      }
      // the camera over an autoplay game (controls hidden; their rects are the ones just measured)
      const auto = await ctx.newPage();
      await openLab(auto, { seed: 'geo-cam' + size, auto: '' });
      const cam = await sampleCamera(auto, 2400);
      await auto.close();
      const ss = cam.samples;
      const inSafe = (y) => y >= g.safe.y0 && y <= g.safe.y1;
      const withH = ss.filter((s) => s.handler);
      const hidden = withH.filter((s) => els.some((e) => e.x < s.handler.x1 && s.handler.x0 < e.x + e.w && e.y < s.handler.y1 && s.handler.y0 < e.y + e.h)).length;
      const near = ss.filter((s) => s.dRim !== null && s.dRim <= 15 && s.rimS);
      const rimS = near.map((s) => s.rimS);
      v.camera = {
        frames: ss.length,
        safeHandlerRim: r3(withH.filter((s) => inSafe(s.handler.y1) && inSafe(s.handler.y0) && inSafe(s.rimY)).length / withH.length),
        handlerUnderAControl: r3(hidden / withH.length),
        rimYShare: r3(median(ss.map((s) => s.rimY)) / H),
        handlerFeetYShare: r3(median(withH.map((s) => s.handler.y1)) / H),
        releases: cam.releases.length,
        overlapOk: r3(cam.releases.filter((x) => x <= 0.35).length / Math.max(1, cam.releases.length)),
        zoomVar: r3(rimS.length ? (Math.max(...rimS) - Math.min(...rimS)) / (rimS.reduce((a, x) => a + x, 0) / rimS.length) : NaN),
      };
      // every row against the V2 table
      const rows = [];
      const row = (key, v2, today) => rows.push({ key, v2, today: today ?? 'absent', delta: typeof today === 'number' && typeof v2 === 'number' ? r1(today - v2) : '' });
      for (const el of ['A', 'B', 'C', 'D', 'stick']) for (const k of ['d', 'cx', 'cy']) row(`geo.${size}.${el}.${k}`, g[el][k], v[el]?.[k]);
      for (const k of ['x0', 'x1', 'y0', 'y1']) row(`geo.${size}.zone.${k}`, g.zone[k], v.zone?.[k]);
      for (const el of ['bug', 'pause', 'heat']) for (const k of ['x', 'y', 'w', 'h']) row(`geo.${size}.${el}.${k}`, g[el][k], v[el]?.[k]);
      row(`geo.${size}.toast.bottom`, g.toast.bottom, v.toast?.bottom);
      row(`geo.${size}.toast.h`, g.toast.h, v.toast?.h);
      row(`geo.${size}.safe.y0`, g.safe.y0, 'n/a (no safe box today)');
      row(`geo.${size}.safe.y1`, g.safe.y1, 'n/a (no safe box today)');
      for (const [pair, want] of Object.entries(GEO_GAPS)) row(`geo.${size}.gap.${pair}`, want[size === '393' ? 0 : 1], v.gaps[pair]);
      row(`geo.${size}.minTarget`, '≥ 44', res.minTarget);
      row(`geo.${size}.rightTargets`, '≤ 4', res.rightTargets);
      row(`geo.${size}.highestTarget`, '≥ 0.333', res.highestTargetShare);
      row(`geo.${size}.overlaps`, 0, res.overlaps.length);
      row(`safe.handlerRim (${size})`, '≥ 0.98', v.camera.safeHandlerRim);
      row(`cam.rimY (${size})`, '0.20-0.24', v.camera.rimYShare);
      row(`cam.handlerY (${size})`, '0.50-0.55', v.camera.handlerFeetYShare);
      row(`cam.overlap (${size})`, '≥ 0.90', v.camera.overlapOk);
      row(`cam.zoomVar (${size})`, '≤ 0.02', v.camera.zoomVar);
      row(`stick.responseFrames (${size})`, '≤ 1', v.stickResponseFrames);
      row(`text.minPx (${size})`, '≥ 10', res.text?.px);
      res.v2rows = rows;
      res.today = v;
      console.log(`\n${size}: today vs V2 (±2 px)`);
      for (const x of rows) console.log(`  ${x.key.padEnd(30)} V2 ${String(x.v2).padStart(10)}  today ${String(x.today).padStart(10)}  ${x.delta === '' ? '' : 'Δ ' + x.delta}`);
    }
    out.sizes[size] = res;
    console.log(`${size}: overlaps ${res.overlaps.length}, min target ${res.minTarget}, small ${res.smallTargets.length}, under insets ${res.underInsets.length}`);
    await ctx.close();
  }
  // duplicate on-court tags: 1,000 random Squad Battles squads, paired into 500 courts of ten
  const { ctx: tctx, page: tp } = await context(browser, '393');
  await openLab(tp, { seed: 'geo-tags' });
  const tags = await tp.evaluate(async () => {
    const { getPool } = await import('/src/ut/pool.ts');
    const { aiOpponent } = await import('/src/ut/battles.ts');
    const { squadFromWire, fiveOfSquad } = await import('/src/ut/teams.ts');
    const pool = await getPool();
    const five = (target, seed) => fiveOfSquad(squadFromWire(pool, aiOpponent(pool, target, seed).squad)).five;
    let courts = 0;
    let withDup = 0;
    const examples = [];
    for (let i = 0; i < 500; i++) {
      const t = [...five(60 + (i % 36), 'tagA' + i), ...five(60 + ((i * 7) % 36), 'tagB' + i)].map((h) => h.tag);
      courts++;
      const dup = t.filter((x, k) => t.indexOf(x) !== k);
      if (dup.length) {
        withDup++;
        if (examples.length < 6) examples.push(dup.join('/'));
      }
    }
    return { squads: courts * 2, courts, courtsWithDuplicateTags: withDup, examples };
  });
  await tctx.close();
  // rows with no live control today, and the node-side ones
  out.static = {
    'tags.duplicates': tags,
    'stick.deadZone': '0 (no dead zone: stickAt maps any offset)',
    'stick.sprintAt': '0.92 × ring radius, inside the ring (engine SPRINT_AT)',
    'stick.followAt': 'absent (a fixed stick)',
    'stick.preheldFt': 'see nba-deadstick.mjs',
    'gesture.misclass': 'absent (no gestures on SHOOT; moves are buttons or a court swipe)',
    'gesture.accidentalPass': 'absent (a court tap passes; the stick is its own element)',
    'gesture.twoPointers': 'stick + SHOOT both tracked (separate pointer ids)',
    'geo.*.pause / heat': 'absent',
    'font.glyphMisses': glyphMisses(),
  };
  console.log('\nnode-side rows', JSON.stringify(out.static, null, 1));
} finally {
  await browser.close();
}
report('nba-geo', out);
