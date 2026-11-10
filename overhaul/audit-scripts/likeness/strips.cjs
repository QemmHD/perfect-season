// AUDIT ONLY (dev 5206): (1) render key actions frame by frame exactly as the renderers sample them
// (mocap clips at their step, hand-keyed poses at their quantized phases) into strip images;
// (2) measure the pose "pop" at the hard cuts between animations (no cross-fade exists): the max
// joint displacement between the last frame of one animation and the first of the next, as a share
// of body height, vs the typical frame-to-frame displacement inside the clips.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
  await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://localhost:5206/?pixel=x&sport=nba&ns=inspect&relay=ws://localhost:7777', { waitUntil: 'load' });
  const res = await page.evaluate(async () => {
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
    // sequences: [label, look, frames: array of joints]
    const clipFrames = (name, look, step, t0 = 0, t1 = null, warpFn = null) => {
      const meta = mocap.clipMeta(name);
      const end = t1 ?? meta.duration;
      const out = [];
      let last = -1;
      for (let t = t0; t <= end + 1e-6; t += 1 / 60) {
        const ct = warpFn ? warpFn(t) : t;
        const f = mocap.frameAt(name, ct, step);
        if (f !== last) { out.push(mocap.mocapJoints(name, f, look, { ground: 'clip' })); last = f; }
      }
      return out;
    };
    const poseFrames = (fn, n, look) => Array.from({ length: n + 1 }, (_, i) => rig.joints(fn(i / n), S(look)));
    const JUMPER = mocap.warp(mocap.clipMeta('jumpshot'), { release: 0.62 });
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
      ['SOC kick: every pass+shot (mocap)', socLook, clipFrames('kick', socLook, 1, 0, 0.55, mocap.warp(mocap.clipMeta('kick'), { contact: 0.11 }))],
      ['SOC keeper dive = tackle dive (mocap)', socLook, clipFrames('dive', socLook, 2, 0, 0.9, mocap.warp(mocap.clipMeta('dive'), { takeoff: 0.02, impact: 0.42, ground: 0.6 }))],
      ['SOC header (mocap two-foot jump)', socLook, clipFrames('jump', socLook, 1, 0, 0.7, mocap.warp(mocap.clipMeta('jump'), { takeoff: 0.0, apex: 0.18 }))],
    ];
    const px = 44, sc = 2, cell = 64 * sc;
    const maxN = Math.max(...seqs.map((s) => s[2].length));
    const cols = Math.min(maxN, 14);
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
    // ---- the pop at hard cuts ----
    const rel = (j) => { const o = {}; for (const k of Object.keys(j)) o[k] = { x: j[k].x - j.pelvis.x, y: j[k].y, z: j[k].z - j.pelvis.z }; return o; };
    const dist = (a, b) => { const A = rel(a), B = rel(b); let m = 0; for (const k of Object.keys(A)) m = Math.max(m, Math.hypot(A[k].x - B[k].x, A[k].y - B[k].y, A[k].z - B[k].z)); return m; };
    const inClip = (name, look, step) => { const meta = mocap.clipMeta(name); const fr = Math.round(meta.duration * 30); const d = []; for (let f = 0; f + step < fr; f += step) d.push(dist(mocap.mocapJoints(name, f, look), mocap.mocapJoints(name, f + step, look))); d.sort((a, b) => a - b); return { p50: d[Math.floor(d.length / 2)], p95: d[Math.floor(d.length * 0.95)] }; };
    const midRun = (look) => mocap.mocapJoints('run', 6, look);
    const cuts = [
      ['run (mocap) -> jump shot first frame', dist(midRun(nbaLook), mocap.mocapJoints('jumpshot', mocap.frameAt('jumpshot', JUMPER(0), 1), nbaLook))],
      ['run (mocap) -> hand-keyed crossover', dist(midRun(nbaLook), rig.joints(P.crossover(0), S(nbaLook)))],
      ['run (mocap) -> hand-keyed dunk', dist(midRun(nbaLook), rig.joints(P.dunk(0, 'two'), S(nbaLook)))],
      ['ready (mocap) -> hand-keyed pass', dist(mocap.mocapJoints('ready', 10, nbaLook), rig.joints(P.pass(0), S(nbaLook)))],
      ['ready (mocap) -> hand-keyed contest', dist(mocap.mocapJoints('ready', 10, nbaLook), rig.joints(P.contest(0), S(nbaLook)))],
      ['sprint (mocap) -> NFL juke pose', dist(mocap.mocapJoints('sprint', 6, nflLook), rig.joints(P.crossover(0), S(nflLook)))],
      ['sprint (mocap) -> NFL stiff arm pose', dist(mocap.mocapJoints('sprint', 6, nflLook), rig.joints(P.stiffArm(0), S(nflLook)))],
      ['run (mocap) -> soccer kick first frame', dist(mocap.mocapJoints('run', 6, socLook), mocap.mocapJoints('kick', mocap.frameAt('kick', mocap.warp(mocap.clipMeta('kick'), { contact: 0.11 })(0), 1), socLook))],
      ['soccer kick last used frame (0.55s) -> run', dist(mocap.mocapJoints('kick', mocap.frameAt('kick', mocap.warp(mocap.clipMeta('kick'), { contact: 0.11 })(0.55), 1), socLook), mocap.mocapJoints('run', 0, socLook))],
      ['jump shot 1.0s -> ready', dist(mocap.mocapJoints('jumpshot', mocap.frameAt('jumpshot', JUMPER(1.0), 1), nbaLook), mocap.mocapJoints('ready', 0, nbaLook))],
    ];
    const ref = { run15: inClip('run', nbaLook, 2), sprint15: inClip('sprint', nbaLook, 2), jumpshot30: inClip('jumpshot', nbaLook, 1), ready10: inClip('ready', nbaLook, 3) };
    // warp rates: how fast a clip is replayed vs its recording, at the engine's event times
    const rate = (meta, at) => { const w = mocap.warp(meta, at); const xs = []; for (let t = 0; t < 1.5; t += 0.02) xs.push((w(t + 0.02) - w(t)) / 0.02); return { min: Math.min(...xs), max: Math.max(...xs) }; };
    const warps = {
      jumpshot: rate(mocap.clipMeta('jumpshot'), { release: 0.62 }),
      layup: rate(mocap.clipMeta('layup'), { takeoff: 0.26, release: 0.57 }),
      kickSoccer: rate(mocap.clipMeta('kick'), { contact: 0.11 }),
      kickNfl: rate(mocap.clipMeta('kick'), { contact: 0.22 }),
      diveSoccer: rate(mocap.clipMeta('dive'), { takeoff: 0.02, impact: 0.42, ground: 0.6 }),
      throwNfl: rate(mocap.clipMeta('throw'), { release: 0.06 }),
      headerJump: rate(mocap.clipMeta('jump'), { takeoff: 0.0, apex: 0.18 }),
    };
    return { url: c.toDataURL(), counts, cuts, ref, warps };
  });
  fs.writeFileSync(OUT + 'anim-strips.png', Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(JSON.stringify({ counts: res.counts, ref: res.ref, warps: res.warps }, null, 1));
  for (const [k, v] of res.cuts) console.log('CUT', k, (v * 100).toFixed(1) + '% of height');
  await browser.close();
})();
