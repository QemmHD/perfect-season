// Players QA (studio overhaul, players-1): animation strips, the pose jump at hard cuts, and the
// golden per-frame sequence of a seeded autoplay match.
//
// 1. Strips (port of the audit's strips.cjs, A-2/A-3): key actions rendered frame by frame exactly as
//    the renderers sample them, `<tag>-anim-strips.png`; the largest joint jump at each common hard
//    cut as a share of body height, against normal frame-to-frame steps inside clips; warp rates.
// 2. Golden sequence (the players-2 extraction check): each sport's autoplay bench runs under
//    Playwright's virtual clock (exactly 60 frames a second of game time, timers included), and every
//    frame records, per body, `who anim facing/dirs px pitch` from the sprite key the renderer asked
//    for. Two digests: `anim` (who, pose, facing) and `full` (plus size and pitch). The run is
//    repeated (`--repeat 2`) to prove the sequence is deterministic. The sequences are written to
//    OUT/<tag>-golden-<sport>.txt for diffing.
//
//   node scripts/qa/players-strips.mjs [--sport nba,nfl,soccer] [--secs 20] [--repeat 2]
//        [--no-strips] [--no-golden] [--tag before] [--out DIR]
import fs from 'node:fs';
import path from 'node:path';
import { appUrl, ROOT, emit, fnv, hex, installProbe, isolate, listOf, matchUrl, needServer, newContext, OUT, opts, SPORTS, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const secs = Number(opts.secs ?? 20);
const repeat = Number(opts.repeat ?? 2);
const tag = String(opts.tag ?? 'before');

/** Runs in the page (?pixel=x): the audit's strips and cut measurements, unchanged. */
async function strips() {
  const body = await import('/src/game/pixel/body.ts');
  const mocap = await import('/src/game/pixel/mocap.ts');
  const P = await import('/src/game/pixel/poses.ts');
  const rig = await import('/src/game/pixel/rig.ts');
  const all = Object.keys(mocap.CLIPS).filter((n) => !mocap.CLIPS[n].mirrorOf);
  await mocap.loadClips(all);
  const nbaLook = { sport: 'nba', ht: 78, wt: 215, num: 23, hair: 0, skin: body.DEFAULT_SKIN, hairColor: body.DEFAULT_HAIR, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
  const nflLook = { ...nbaLook, sport: 'nfl', ht: 74, wt: 215, num: 81, jersey: '#203731', trim: '#ffb612', shorts: '#f2f2f2', helmet: '#ffb612', stripe: '#203731', pants: '#f2f2f2', socks: '#203731', pads: 1 };
  const socLook = { ...nbaLook, sport: 'soccer', ht: 70, wt: 160, num: 10, jersey: '#a50044', trim: '#004d98', shorts: '#004d98', socks: '#a50044' };
  const S = (look) => body.shapeFor(look);
  const clipFrames = (name, look, step, t0 = 0, t1 = null, warpFn = null) => {
    const meta = mocap.clipMeta(name);
    const end = t1 ?? meta.duration;
    const out = [];
    let last = -1;
    for (let t = t0; t <= end + 1e-6; t += 1 / 60) {
      const ct = warpFn ? warpFn(t) : t;
      const f = mocap.frameAt(name, ct, step);
      if (f !== last) {
        out.push(mocap.mocapJoints(name, f, look, { ground: 'clip' }));
        last = f;
      }
    }
    return out;
  };
  const poseFrames = (fn, n, look) => Array.from({ length: n + 1 }, (_, i) => rig.joints(fn(i / n), S(look)));
  const JUMPER = mocap.warp(mocap.clipMeta('jumpshot'), { release: 0.62 });
  const KICK = mocap.warp(mocap.clipMeta('kick'), { contact: 0.11 });
  const seqs = [
    ['NBA jump shot (mocap, 30fps)', nbaLook, clipFrames('jumpshot', nbaLook, 1, 0, 1.0, JUMPER)],
    ['NBA layup (mocap, 15fps)', nbaLook, clipFrames('layup', nbaLook, 2, 0, 0.95, mocap.warp(mocap.clipMeta('layup'), { takeoff: 0.26, release: 0.57 }))],
    ['NBA dunk windmill (hand-keyed, 12 ph)', nbaLook, poseFrames((ph) => P.dunk(ph, 'windmill'), 12, nbaLook)],
    ['NBA crossover (hand-keyed, 6 ph)', nbaLook, poseFrames((ph) => P.crossover(ph), 6, nbaLook)],
    ['NBA spin (hand-keyed, 6 ph)', nbaLook, poseFrames((ph) => P.spin(ph), 6, nbaLook)],
    ['NBA pass (hand-keyed, 6 ph)', nbaLook, poseFrames((ph) => P.pass(ph), 6, nbaLook)],
    ['NBA contest/block/rebound (hand-keyed, 10 ph)', nbaLook, poseFrames((ph) => P.contest(ph), 10, nbaLook)],
    ['NFL throw (mocap)', nflLook, clipFrames('throw', nflLook, 1, 1.62, 2.4)],
    ['NFL juke = basketball crossover (hand-keyed)', nflLook, poseFrames((ph) => P.crossover(ph), 6, nflLook)],
    ['NFL stiff arm (hand-keyed)', nflLook, poseFrames((ph) => P.stiffArm(ph), 6, nflLook)],
    ['NFL truck (hand-keyed)', nflLook, poseFrames((ph) => P.truck(ph), 6, nflLook)],
    ['NFL tackle (mocap dive)', nflLook, clipFrames('dive', nflLook, 2, 0, 0.9, mocap.warp(mocap.clipMeta('dive'), { takeoff: 0, impact: 0.35, ground: 0.55 }))],
    ['SOC kick: every pass+shot (mocap)', socLook, clipFrames('kick', socLook, 1, 0, 0.55, KICK)],
    ['SOC keeper dive = tackle dive (mocap)', socLook, clipFrames('dive', socLook, 2, 0, 0.9, mocap.warp(mocap.clipMeta('dive'), { takeoff: 0.02, impact: 0.42, ground: 0.6 }))],
    ['SOC header (mocap two-foot jump)', socLook, clipFrames('jump', socLook, 1, 0, 0.7, mocap.warp(mocap.clipMeta('jump'), { takeoff: 0.0, apex: 0.18 }))],
  ];
  const px = 44,
    sc = 2,
    cell = 64 * sc;
  const cols = Math.min(Math.max(...seqs.map((s) => s[2].length)), 14);
  const c = document.createElement('canvas');
  c.width = 260 + cols * cell * 0.62;
  c.height = seqs.length * (cell + 6);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#3a6b37';
  g.fillRect(0, 0, c.width, c.height);
  g.font = 'bold 12px sans-serif';
  const counts = [];
  seqs.forEach(([label, look, frames], r) => {
    const y = r * (cell + 6);
    g.fillStyle = r % 2 ? '#35623a' : '#3e7240';
    g.fillRect(0, y, c.width, cell + 6);
    g.fillStyle = '#fff';
    g.fillText(label, 6, y + 20);
    g.fillText(frames.length + ' drawn frames', 6, y + 38);
    counts.push([label, frames.length]);
    const step = frames.length > cols ? frames.length / cols : 1;
    for (let i = 0, k = 0; i < frames.length && k < cols; i += step, k++) {
      const sp = body.drawBody(look, frames[Math.floor(i)], { facing: 0.6, pitch: 0.45 }, px);
      g.drawImage(sp.canvas, 260 + k * cell * 0.62 + cell * 0.3 - sp.ax * sc, y + cell - sp.ay * sc + 2, sp.canvas.width * sc, sp.canvas.height * sc);
    }
  });
  // ---- the pop at hard cuts (largest joint jump, pelvis-relative, as a share of body height) ----
  const rel = (j) => {
    const o = {};
    for (const k of Object.keys(j)) o[k] = { x: j[k].x - j.pelvis.x, y: j[k].y, z: j[k].z - j.pelvis.z };
    return o;
  };
  const dist = (a, b) => {
    const A = rel(a),
      B = rel(b);
    let m = 0;
    for (const k of Object.keys(A)) m = Math.max(m, Math.hypot(A[k].x - B[k].x, A[k].y - B[k].y, A[k].z - B[k].z));
    return m;
  };
  const inClip = (name, look, step) => {
    const fr = Math.round(mocap.clipMeta(name).duration * 30);
    const d = [];
    for (let f = 0; f + step < fr; f += step) d.push(dist(mocap.mocapJoints(name, f, look), mocap.mocapJoints(name, f + step, look)));
    d.sort((a, b) => a - b);
    return { p50: d[Math.floor(d.length / 2)], p95: d[Math.floor(d.length * 0.95)] };
  };
  const midRun = (look) => mocap.mocapJoints('run', 6, look);
  const cuts = [
    ['kick->run', 'soccer kick last used frame (0.55s) -> run', dist(mocap.mocapJoints('kick', mocap.frameAt('kick', KICK(0.55), 1), socLook), mocap.mocapJoints('run', 0, socLook))],
    ['jumper->ready', 'jump shot 1.0s -> ready', dist(mocap.mocapJoints('jumpshot', mocap.frameAt('jumpshot', JUMPER(1.0), 1), nbaLook), mocap.mocapJoints('ready', 0, nbaLook))],
    ['run->kick', 'run (mocap) -> soccer kick first frame', dist(mocap.mocapJoints('run', 6, socLook), mocap.mocapJoints('kick', mocap.frameAt('kick', KICK(0), 1), socLook))],
    ['sprint->stiffarm', 'sprint (mocap) -> NFL stiff arm pose', dist(mocap.mocapJoints('sprint', 6, nflLook), rig.joints(P.stiffArm(0), S(nflLook)))],
    ['run->crossover', 'run (mocap) -> hand-keyed crossover', dist(midRun(nbaLook), rig.joints(P.crossover(0), S(nbaLook)))],
    ['run->jumper', 'run (mocap) -> jump shot first frame', dist(midRun(nbaLook), mocap.mocapJoints('jumpshot', mocap.frameAt('jumpshot', JUMPER(0), 1), nbaLook))],
    ['sprint->juke', 'sprint (mocap) -> NFL juke pose', dist(mocap.mocapJoints('sprint', 6, nflLook), rig.joints(P.crossover(0), S(nflLook)))],
    ['run->dunk', 'run (mocap) -> hand-keyed dunk', dist(midRun(nbaLook), rig.joints(P.dunk(0, 'two'), S(nbaLook)))],
    ['ready->contest', 'ready (mocap) -> hand-keyed contest', dist(mocap.mocapJoints('ready', 10, nbaLook), rig.joints(P.contest(0), S(nbaLook)))],
    ['ready->pass', 'ready (mocap) -> hand-keyed pass', dist(mocap.mocapJoints('ready', 10, nbaLook), rig.joints(P.pass(0), S(nbaLook)))],
  ];
  const ref = { run15: inClip('run', nbaLook, 2), sprint15: inClip('sprint', nbaLook, 2), jumpshot30: inClip('jumpshot', nbaLook, 1), ready10: inClip('ready', nbaLook, 3) };
  const rate = (meta, at) => {
    const w = mocap.warp(meta, at);
    const xs = [];
    for (let t = 0; t < 1.5; t += 0.02) xs.push((w(t + 0.02) - w(t)) / 0.02);
    return { min: Math.min(...xs), max: Math.max(...xs) };
  };
  const warps = {
    jumpshot: rate(mocap.clipMeta('jumpshot'), { release: 0.62 }),
    layup: rate(mocap.clipMeta('layup'), { takeoff: 0.26, release: 0.57 }),
    kickSoccer: rate(mocap.clipMeta('kick'), { contact: 0.11 }),
    kickNfl: rate(mocap.clipMeta('kick'), { contact: 0.22 }),
    diveSoccer: rate(mocap.clipMeta('dive'), { takeoff: 0.02, impact: 0.42, ground: 0.6 }),
    throwNfl: rate(mocap.clipMeta('throw'), { release: 0.06 }),
    headerJump: rate(mocap.clipMeta('jump'), { takeoff: 0.0, apex: 0.18 }),
  };
  return { url: c.toDataURL(), counts, cuts, ref, warps, clips: all };
}

/** The clips each renderer loads (its CLIPS list, or a per-sport clip bundle once players-4 adds one). */
function loadLists() {
  const lists = {};
  for (const [sport, file, bundle] of [
    ['nba', 'src/game/hoops2/render.ts', 'src/data/mocap/clips-nba.ts'],
    ['nfl', 'src/game/football2/render.ts', 'src/data/mocap/clips-nfl.ts'],
    ['soccer', 'src/game/soccer2/render.ts', 'src/data/mocap/clips-soccer.ts'],
  ]) {
    const src = [file, bundle].filter((f) => fs.existsSync(path.join(ROOT, f))).map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    const m = /const CLIPS\s*=\s*\[([^\]]*)\]/.exec(src);
    lists[sport] = m ? [...m[1].matchAll(/'([\w]+)'/g)].map((x) => x[1]) : null;
  }
  return lists;
}

/** Run one sport's bench for `secs` of game time under the virtual clock; the sequence lines. */
async function goldenRun(browser, sport) {
  const context = await newContext(browser, '393', { dpr: 1 });
  const page = await context.newPage();
  const errors = watchErrors(page);
  // an installed clock still follows real time until paused: pause it before the page exists
  await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));
  await page.goto(matchUrl(sport, { seed: 'golden' }), { waitUntil: 'load' });
  // the canvas mounts without timers; the clock has not moved, so nothing has been drawn yet
  let advanced = 0;
  for (let i = 0; i < 200 && !(await page.evaluate(() => !!document.querySelector('canvas'))); i++) {
    if (i > 40) {
      await page.clock.runFor(50);
      advanced += 50;
    } else await wait(100);
  }
  // nothing real-time may race the virtual clock: every clip the renderer loads is in, and any other
  // chunk has had time to arrive, before the first frame of game time runs
  await page.evaluate(async (names) => {
    const m = await import('/src/game/pixel/mocap.ts');
    await m.loadClips(names);
  }, loadLists()[sport] ?? []);
  await wait(1500);
  await installProbe(page, sport, { golden: true, goldenCap: 8e6 });
  const framesBefore = await page.evaluate(() => window.__psProbe.frames);
  for (let t = 0; t < secs * 1000; t += 1000) await page.clock.runFor(1000);
  const lines = await page.evaluate(() => window.__psProbe.golden);
  await context.close();
  return { lines, advancedBeforeProbeMs: advanced, framesBefore, errors };
}

await needServer();
const report = await withBrowser(async (browser) => {
  const out = { strips: null, golden: [] };
  if (!opts['no-strips']) {
    const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
    await isolate(context);
    const page = await context.newPage();
    const errors = watchErrors(page);
    await page.goto(appUrl({ pixel: 'x', sport: 'nba' }), { waitUntil: 'load' });
    const r = await page.evaluate(strips);
    const lists = loadLists();
    const file = path.join(OUT, `${tag}-anim-strips.png`);
    fs.writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'));
    const p = (x) => +(x * 100).toFixed(1);
    out.strips = {
      sheet: file,
      drawnFrames: Object.fromEntries(r.counts),
      cutJumpPct: Object.fromEntries(r.cuts.map(([k, , v]) => [k, p(v)])),
      cutLabels: Object.fromEntries(r.cuts.map(([k, l]) => [k, l])),
      inClipStepPct: Object.fromEntries(Object.entries(r.ref).map(([k, v]) => [k, { p50: p(v.p50), p95: p(v.p95) }])),
      warpRates: Object.fromEntries(Object.entries(r.warps).map(([k, v]) => [k, { min: +v.min.toFixed(2), max: +v.max.toFixed(2) }])),
      clips: r.clips,
      loadLists: lists,
      clipsLoadedByNoRenderer: Object.values(lists).every(Boolean) ? r.clips.filter((n) => !Object.values(lists).some((l) => l.includes(n))) : null,
      pageErrors: errors.slice(0, 3),
    };
    await context.close();
  }
  if (!opts['no-golden'])
    for (const sport of sports) {
      const reps = [];
      for (let i = 0; i < repeat; i++) {
        const g = await goldenRun(browser, sport);
        const anim = g.lines.map((l) => l.replace(/ \d+ [\d.]+(?=;|$)/g, ''));
        reps.push({ g, full: hex(fnv(g.lines.join('\n'))), anim: hex(fnv(anim.join('\n'))), bodyFrames: g.lines.reduce((n, l) => n + (l.split(';').length - (l.endsWith(':') ? 1 : 0)), 0) });
      }
      const file = path.join(OUT, `${tag}-golden-${sport}.txt`);
      fs.writeFileSync(file, reps[0].g.lines.join('\n') + '\n');
      // a repeat that differs is kept beside the first, to diff
      reps.forEach((r, i) => i > 0 && r.full !== reps[0].full && fs.writeFileSync(file.replace(/\.txt$/, `.r${i + 1}.txt`), r.g.lines.join('\n') + '\n'));
      out.golden.push({
        sport,
        secs,
        frames: reps[0].g.lines.length,
        bodyFrames: reps[0].bodyFrames,
        digestFull: reps[0].full,
        digestAnim: reps[0].anim,
        deterministic: reps.every((r) => r.full === reps[0].full),
        repeats: reps.map((r) => ({ full: r.full, anim: r.anim, frames: r.g.lines.length, framesBeforeProbe: r.g.framesBefore, advancedBeforeProbeMs: r.g.advancedBeforeProbeMs })),
        file,
        pageErrors: reps[0].g.errors.slice(0, 3),
      });
    }
  return out;
});
emit('players-strips-' + tag, report);
