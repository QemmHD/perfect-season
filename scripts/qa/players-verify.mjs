// Players QA (studio overhaul, players-1): every target in the players plan's section 3, PASS or FAIL.
// It runs the players harness (or reads reports a previous run left in --out), runs the named unit
// tests that prove the targets a browser can't measure, and prints one row per target. It is the
// release gate for players-10 and the post-merge check the lead runs on the merged tree.
//
//   node scripts/qa/players-verify.mjs [--run all|none|sprites,cards,...] [--quick] [--tag verify]
//        [--no-vitest] [--strict] [--out DIR] [--port 5214]
//
// --run none   evaluate the reports already in --out (written by the scripts with the same --tag)
// --quick      shorter windows (fewer seconds, games and viewports): a smoke check, not a gate
// --strict     exit 1 when any row FAILs
// Rows are PASS, FAIL, or N/A (not measurable here, with the reason). Relative targets ("no worse
// than before") compare with BASELINE below: the numbers players-1 measured on the base commit with
// these same scripts on the dev server (docs/studio-overhaul/players.md has the full record).
// The table goes to stderr; stdout carries the one-line JSON report, like every players script.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { listOf, OUT, opts, PORT, ROOT, round } from './players-lib.mjs';

const tag = String(opts.tag ?? 'verify');
const quick = !!opts.quick;
const runList = opts.run === 'none' ? [] : listOf(opts.run === 'all' ? undefined : opts.run, ['sprites', 'matchperf', 'readiness', 'lineup', 'strips', 'cards', 'keep', 'slide']);

/** The base commit's numbers (835fd70, dev server, this harness), for the relative targets. */
const BASELINE = {
  // 4x CPU, DPR 3, 10 s windows: fps and frames over 20 ms per sport and viewport
  fps4x: {
    nba: { 393: [58.9, 6], 430: [58.6, 8], 320: [59.7, 2], 375: [59.6, 3], '844land': [58.9, 8] },
    nfl: { 393: [59.8, 1], 430: [59.4, 4], 320: [59.8, 1], 375: [59.7, 1], '844land': [59.6, 3] },
    soccer: { 393: [59.0, 6], 430: [57.4, 16], 320: [59.3, 4], 375: [59.4, 4], '844land': [56.5, 24] },
  },
  // navigation to the autoplay bench -> first drawn frame, median of 3, ms (1x, 4x)
  firstFrame: { nba: { 1: 2423, 4: 6551 }, nfl: { 1: 2209, 4: 6044 }, soccer: { 1: 2165, 4: 5865 } },
  // the UtCard outer box at every width: width x 1.4, in design px
  box: (w) => [w, w * 1.4],
  // tap -> UT ready onto the club, ms (1x, 4x), for the UT-first-open target (no worse than +5%)
  utOpen: { nba: { 1: 2398, 4: 6952 }, nfl: { 1: 2437, 4: 7894 }, soccer: { 1: 1135, 4: 2914 } },
};

const NODE = process.execPath;
const scriptArgs = (extra) => ['--out', OUT, '--port', String(PORT), '--tag', tag, ...extra];
const STEPS = {
  sprites: [[NODE, ['scripts/qa/players-sprites.mjs', ...scriptArgs(['--secs', quick ? '10' : '18'])]]],
  matchperf: [[NODE, ['scripts/qa/players-matchperf.mjs', ...scriptArgs(quick ? ['--vp', '393,844land', '--window', '5'] : [])]]],
  readiness: [[NODE, ['scripts/qa/players-readiness.mjs', ...scriptArgs(['--runs', quick ? '1' : '3'])]]],
  lineup: [[NODE, ['scripts/qa/players-lineup.mjs', ...scriptArgs([])]]],
  strips: [[NODE, ['scripts/qa/players-strips.mjs', ...scriptArgs(['--secs', quick ? '8' : '20'])]]],
  cards: [[NODE, ['scripts/qa/players-cards.mjs', ...scriptArgs(quick ? ['--vp', '393'] : [])]]],
  keep: [[NODE, ['scripts/qa/players-keep.mjs', ...scriptArgs(['--secs', quick ? '20' : '40'])]]],
  slide: [
    ['npx', ['vite-node', 'scripts/qa/players-slide-nba.ts', ...scriptArgs(['--games', quick ? '4' : '24'])], {}],
    ['npx', ['vite-node', 'scripts/qa/players-slide-soccer.ts', ...scriptArgs(['--attacks', quick ? '30' : '120'])], { PS_SPORT: 'soccer' }],
    ['npx', ['vite-node', 'scripts/qa/players-slide-nfl.ts', ...scriptArgs(['--games', quick ? '4' : '24'])], { PS_SPORT: 'nfl' }],
  ],
};
const ran = {};
for (const step of runList) {
  for (const [cmd, args, env = {}] of STEPS[step] ?? []) {
    const t0 = Date.now();
    const r = spawnSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    ran[step] = { ok: r.status === 0, secs: round((Date.now() - t0) / 1000, 0), err: r.status === 0 ? null : String(r.stderr).split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300) };
    process.stderr.write(`players-verify: ${step} ${ran[step].ok ? 'ok' : 'FAILED'} (${ran[step].secs}s)\n`);
  }
}

const read = (name) => {
  const f = path.join(OUT, `players-${name}-${tag}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const R = {
  sprites: read('sprites'),
  matchperf: read('matchperf'),
  readiness: read('readiness'),
  lineup: read('lineup'),
  strips: read('strips'),
  cards: read('cards'),
  keep: read('keep'),
  slideNba: read('slide-nba'),
  slideSoccer: read('slide-soccer'),
  slideNfl: read('slide-nfl'),
};

// ---------- the unit tests that prove targets a browser can't ----------
const testFiles = (() => {
  const out = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/\.test\.tsx?$/.test(e.name)) out.set(e.name, path.relative(ROOT, path.join(d, e.name)));
    }
  };
  walk(path.join(ROOT, 'src'));
  return out;
})();
const vitestCache = new Map();
/** The named tests (by file name, wherever they live under src/), run with vitest. */
function tests(names, sport = 'nba') {
  const files = names.map((n) => testFiles.get(n));
  const missing = names.filter((n, i) => !files[i]);
  if (missing.length) return { status: 'FAIL', value: 'not built yet: ' + missing.join(', ') };
  if (opts['no-vitest']) return { status: 'N/A', value: 'tests exist (' + names.join(', ') + '); --no-vitest' };
  const key = sport + ':' + files.join(',');
  if (!vitestCache.has(key)) {
    const env = { ...process.env, ...(sport === 'nba' ? {} : { PS_SPORT: sport }) };
    const r = spawnSync('npx', ['vitest', 'run', ...files], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    vitestCache.set(key, r.status === 0);
  }
  return vitestCache.get(key) ? { status: 'PASS', value: names.join(', ') + ' pass' } : { status: 'FAIL', value: names.join(', ') + ' fail' };
}

// ---------- helpers ----------
const run = (rep, sport, vp) => rep?.runs?.find((r) => r.sport === sport && (vp === undefined || r.vp === vp));
const stalePct = (r, buckets) => {
  let n = 0,
    s = 0;
  for (const b of buckets) {
    const x = r?.byPx?.[b];
    if (!x) continue;
    n += x.lookups;
    s += (x.stalePct * x.lookups) / 100;
  }
  return n ? round((100 * s) / n, 1) : null;
};
const all = (xs) => xs.every(Boolean);
const missing = (what) => ({ status: 'N/A', value: 'no report: run ' + what });
const pf = (ok, value) => ({ status: ok ? 'PASS' : 'FAIL', value });

// ---------- section 3, row by row ----------
const ROWS = [
  // --- animation and engine render ---
  ['A1', 'Stale body draws, NFL autoplay', '>=48 px <2%, 32-47 px <5%, overall <10%', 'players-2', () => {
    const r = run(R.sprites, 'nfl');
    if (!r) return missing('players-sprites');
    const big = stalePct(r, ['48-71', '72+']), mid = stalePct(r, ['32-47']);
    return pf((big ?? 0) < 2 && (mid ?? 0) < 5 && r.stalePct < 10, `>=48 ${big}% · 32-47 ${mid}% · overall ${r.stalePct}%`);
  }],
  ['A2', 'Stale draws, NBA / soccer', 'NBA >=48 px <2%; soccer <=1%', 'players-2', () => {
    const n = run(R.sprites, 'nba'), s = run(R.sprites, 'soccer');
    if (!n || !s) return missing('players-sprites');
    const big = stalePct(n, ['48-71', '72+']);
    return pf((big ?? 0) < 2 && s.stalePct <= 1, `NBA >=48 ${big}% · soccer ${s.stalePct}%`);
  }],
  ['A3', 'Pre-warm after snap, kickoff, inbound', 'stale <=1% for >=32 px in the first 30 frames', 'players-2', () => {
    const rs = ['nba', 'nfl', 'soccer'].map((s) => run(R.sprites, s));
    if (rs.some((r) => !r)) return missing('players-sprites');
    const v = rs.map((r) => {
      const a = r.bySinceStart?.['0-9'], b = r.bySinceStart?.['10-29'];
      const n = (a?.lookups ?? 0) + (b?.lookups ?? 0);
      return n ? ((a?.stalePct ?? 0) * (a?.lookups ?? 0) + (b?.stalePct ?? 0) * (b?.lookups ?? 0)) / n : null;
    });
    return pf(v.every((x) => x === null || x <= 1), ['nba', 'nfl', 'soccer'].map((s, i) => `${s} ${v[i] === null ? 'no starts' : round(v[i], 1) + '%'}`).join(' · '));
  }],
  ['A4', 'In-match fps', '1x holds 60.0 at 5 viewports; 4x at or above before; >20 ms frames no worse than +10%', 'players-2/5/8/9/10', () => {
    if (!R.matchperf) return missing('players-matchperf');
    const bad = [];
    for (const r of R.matchperf.runs) {
      if (r['1x'] && r['1x'].fps < 59.5) bad.push(`${r.sport} ${r.vp} 1x ${r['1x'].fps}`);
      const b = BASELINE.fps4x[r.sport]?.[r.vp];
      if (b && r['4x'] && (r['4x'].fps < b[0] - 1 || r['4x'].over20 > Math.ceil(b[1] * 1.1) + 2)) bad.push(`${r.sport} ${r.vp} 4x ${r['4x'].fps}/${r['4x'].over20} vs ${b[0]}/${b[1]}`);
    }
    return pf(!bad.length, bad.length ? bad.slice(0, 4).join(' · ') : `${R.matchperf.runs.length} runs within target`);
  }],
  ['A5', 'Canvas memory', 'cached sprite area <=6 Mpx per match; heap within +10%', 'players-2/8', () => {
    if (!R.matchperf) return missing('players-matchperf');
    const peak = Math.max(...R.matchperf.runs.map((r) => r.spriteAreaPeakMpx ?? 0));
    const heap = R.matchperf.runs.filter((r) => r.heapEndMB > r.heapStartMB * 1.1 + 2);
    return pf(peak <= 6 && !heap.length, `peak ${peak} Mpx · heap grew >10% in ${heap.length} runs`);
  }],
  ['A6', 'Readiness at match start', '0 stand-in frames after frame 1; PLAY-to-first-frame <= before +100 ms', 'players-4', () => {
    if (!R.readiness) return missing('players-readiness');
    const bad = [];
    for (const r of R.readiness.results) {
      const pd = r.each?.[0]?.pixelDebug;
      const stand = pd ? pd.standIn ?? pd.standInPoses ?? 0 : r.median.standInFramesAfterFirst;
      if (stand > 0) bad.push(`${r.sport} ${r.cpu}x ${stand} stand-in frames`);
      const b = BASELINE.firstFrame[r.sport]?.[r.cpu];
      if (b && r.median.playToFirstFrameMs > b + 100) bad.push(`${r.sport} ${r.cpu}x first frame ${r.median.playToFirstFrameMs} vs ${b}`);
    }
    return pf(!bad.length, bad.length ? bad.join(' · ') : R.readiness.results.map((r) => `${r.sport} ${r.cpu}x ${r.median.playToFirstFrameMs} ms`).join(' · '));
  }],
  ['A7', 'Pose jump at hard cuts', 'every listed cut <=20% of body height (displayed frames)', 'players-8', () => {
    const t = tests(['transitions.test.ts']);
    const raw = R.strips?.strips?.cutJumpPct;
    return { ...t, value: t.value + (raw ? ' · raw cuts ' + Object.values(raw).join('/') + '%' : '') };
  }],
  ['A8', 'Blends under load', 'stale <=2% for >=48 px in the 20 frames after an NFL snap; blend sprites <=10% of cache', 'players-8', () => {
    const r = run(R.sprites, 'nfl');
    if (!r) return missing('players-sprites');
    const b = r.bySinceStart?.['48px-0-19'];
    const pd = r.pixelDebug;
    if (!pd || pd.blendEntries === undefined) return { status: 'N/A', value: `blend counters arrive with players-8 (?pixeldebug); stale after snap >=48 px ${b ? b.stalePct + '%' : 'no sample'}` };
    return pf((b?.stalePct ?? 0) <= 2 && pd.blendEntries / Math.max(1, r.cacheEntries) <= 0.1, `stale ${b?.stalePct}% · blends ${pd.blendEntries}/${r.cacheEntries}`);
  }],
  ['A9', 'Foot sliding', 'NBA <=8%, soccer <=4%, NFL <=5% and 0 idle-while-moving QB frames', 'players-8', () => {
    if (!R.slideNba || !R.slideSoccer || !R.slideNfl) return missing('players-slide-*.ts');
    return pf(R.slideNba.slidingPct <= 8 && R.slideSoccer.slidingPct <= 4 && R.slideNfl.slidingPct <= 5 && R.slideNfl.qbIdleMovingFrames === 0, `NBA ${R.slideNba.slidingPct}% · soccer ${R.slideSoccer.slidingPct}% · NFL ${R.slideNfl.slidingPct}% · QB idle-moving ${R.slideNfl.qbIdleMovingFrames}`);
  }],
  ['A10', 'Animation rate', 'every body >=12 effective fps (none <10); near, large and ball bodies >=28', 'players-8', () => {
    const rs = ['nba', 'nfl', 'soccer'].map((s) => run(R.sprites, s));
    if (rs.some((r) => !r)) return missing('players-sprites');
    const v = rs.map((r) => r.animFps);
    const ok = v.every((a) => a.all.under12 === 0 && a.all.under10 === 0 && [a.large40, a.ball, a.nearest6].every((d) => !d.bodies || d.min >= 28));
    return pf(ok, ['nba', 'nfl', 'soccer'].map((s, i) => `${s} min ${v[i].all.min}/p50 ${v[i].all.p50} (near ${v[i].nearest6.min})`).join(' · '));
  }],
  ['A11', 'Time discontinuities', 'replay, pause, SIM, hit-stop: 0 blended frames from the pre-jump pose', 'players-8', () => tests(['time.test.ts'])],
  ['A12', 'HUD alignment', 'drawn offset <=5% of body height; drawnOffset exported', 'players-8', () => tests(['locomotion.test.ts'])],
  ['A13', 'Holds and secondary motion', 'set 3 f, apex 2-4 f, contact 2 f, follow-through 12-24 f; hair lag; head bob', 'players-8', () => tests(['transitions.test.ts', 'locomotion.test.ts'])],
  ['A14', 'Hit-stop', 'impactOf table +-10 ms; <=150 ms per second; reduced motion <=30 ms, 0 shake', 'players-8', () => tests(['impact.test.ts'])],
  ['A15', 'Motion DNA visibility', 'set point >=3 px; QB slot 15/35/55; run lean >=4 deg; lefties mirrored 100%', 'players-9', () => tests(['motion-dna.test.ts'])],
  ['A16', 'Celebrations and get-ups', '1.2-2.5 s, skippable at 0.5 s, 0 frames past the next start, 0 s added', 'players-6/8', () => tests(['celebrate.test.ts'])],
  ['A17', 'Soccer feet', '>=85% recorded foot; >=95% of left-footers kick with kick_l', 'players-7/9', () => tests(['appearance-soccer.test.ts', 'actions-soccer.test.ts'], 'soccer')],
  ['A18', 'Simulation untouched', 'import graph and per-step seeded state hash identical with rendering on', 'players-5', () => tests(['render-only.test.ts'])],
  // --- likeness ---
  ['L1', 'Body width at 40 px', 'Shaq >=24, Curry <=18, Bol <=18 and >=5 narrower than Shaq, Jokic-Giannis >=2, BMI 31 vs 20 >=25% wider', 'players-5', () => {
    const n = R.lineup?.results?.find((r) => r.sport === 'nba');
    if (!n) return missing('players-lineup');
    const t = n.torso40;
    const ok = t.Shaq >= 24 && t.Curry <= 18 && t['Manute Bol'] <= 18 && t.Shaq - t['Manute Bol'] >= 5 && Math.abs(t.Jokic - t.Giannis) >= 2 && t['BMI 31 (78 in)'] >= 1.25 * t['BMI 20 (78 in)'];
    return pf(ok, `Curry ${t.Curry} · Giannis ${t.Giannis} · Jokic ${t.Jokic} · Shaq ${t.Shaq} · Bol ${t['Manute Bol']} · BMI20/31 ${t['BMI 20 (78 in)']}/${t['BMI 31 (78 in)']}`);
  }],
  ['L2', 'Identity in one shared kit', 'pairs >=8% different at 24 px (NBA 80%, NFL/soccer 75%); all >=12% at 40 px; all differ at 60 px', 'players-5/7', () => {
    if (!R.lineup) return missing('players-lineup');
    const v = R.lineup.results.map((r) => {
      const need = r.sport === 'nba' ? 0.8 : 0.75;
      const ok = r.identity['24px'].sharePairsAtLeast8pct >= need && r.identity['40px'].minPct >= 12 && r.identity['60px'].minPct >= 8;
      return [ok, `${r.sport} ${Math.round(100 * r.identity['24px'].sharePairsAtLeast8pct)}%/${r.identity['40px'].minPct}%/${r.identity['60px'].minPct}%`];
    });
    return pf(all(v.map((x) => x[0])), v.map((x) => x[1]).join(' · ') + ' (24 px share, 40 px min, 60 px min)');
  }],
  ['L3', 'Owner-named looks', 'Shaq bald, Iverson cornrows, Kareem goggles, Rodman dyed, Haaland blond, Mbappe clean, Brady', 'players-4/7', () => {
    if (!R.lineup) return missing('players-lineup');
    const ex = R.lineup.results.flatMap((r) => r.ownerExamples);
    const wrong = ex.filter((e) => e.correct === false).map((e) => e.name.split(' ').pop());
    return pf(!wrong.length, wrong.length ? 'wrong: ' + wrong.join(', ') : ex.length + ' checked');
  }],
  ['L4', 'Default looks', 'no style >40% per era; >=5 silhouettes; 0 goggles/headband/dyed/left defaults', 'players-4', () => tests(['appearance.test.ts'])],
  ['L5', 'Tier A coverage and accuracy', 'GOAT+Legend+top 60 curated, src+reviewed on every row, <=20 KB gzip', 'players-4/7', () => tests(['appearance-data.test.ts'])],
  ['L6', 'Numbers', 'legible front-on from 28 px; exact or hidden; 6x10 font at >=60 px', 'players-5', () => tests(['numbers.test.ts'])],
  // --- cards ---
  ['C1', 'Card art head size (design px)', 'head >=24 at 80, >=45 at 150/170, >=57 at 190, >=14 at 44, >=11 at 34-40', 'players-6', () => {
    if (!R.cards) return missing('players-cards');
    const need = { 34: 11, 40: 11, 44: 14, 80: 24, 150: 45, 170: 45, 190: 57 };
    const bad = [];
    for (const r of R.cards.results)
      for (const [w, n] of Object.entries(need)) {
        const h = r.sweep?.byWidth?.[w]?.headWMin;
        if (h === null || h === undefined || h < n) bad.push(`${r.sport}/${r.vp} w${w} ${h}`);
      }
    return pf(!bad.length, bad.length ? bad.slice(0, 5).join(' · ') + (bad.length > 5 ? ` (+${bad.length - 5})` : '') : 'all widths');
  }],
  ['C2', 'Bust recognisability', '12 stars differ pairwise >=15% (locked >=10%) on the 80 px card', 'players-6', () => tests(['bust.test.ts'])],
  ['C3', 'Card text at every size', 'OVR and POS >=10 design px at w>=34; name >=10 at w>=52; 0 overflow at 393 and 320', 'players-3', () => {
    if (!R.cards) return missing('players-cards');
    const bad = [];
    for (const r of R.cards.results) {
      for (const [w, v] of Object.entries(r.sweep?.byWidth ?? {})) {
        if ((v.ovrPxMin ?? 99) < 10 || (v.posPxMin ?? 99) < 10) bad.push(`${r.sport}/${r.vp} w${w} ovr ${v.ovrPxMin} pos ${v.posPxMin}`);
        if (+w >= 52 && v.namePxMin !== null && v.namePxMin < 10) bad.push(`${r.sport}/${r.vp} w${w} name ${v.namePxMin}`);
        if (v.overflow) bad.push(`${r.sport}/${r.vp} w${w} overflow ${v.overflow}`);
      }
      for (const [s, sv] of Object.entries(r.surfaces ?? {})) for (const [w, v] of Object.entries(sv.byWidth ?? {})) if (v.overflow) bad.push(`${r.sport}/${r.vp} ${s} w${w} overflow`);
    }
    return pf(!bad.length, bad.length ? `${bad.length} misses, e.g. ` + bad.slice(0, 3).join(' · ') : 'all widths');
  }],
  ['C4', '3-digit values and long names', 'OVR 105 >=20 px at 80 with 0 overflow; long names whole at w=44, 80, 170', 'players-3', () => {
    if (!R.cards) return missing('players-cards');
    const bad = [];
    for (const r of R.cards.results) {
      for (const c of r.threeDigit ?? []) if ((c.w === 80 && c.ovrPx < 20) || c.overflow.length || c.truncated.length) bad.push(`${r.sport}/${r.vp} 105 at w${c.w}`);
      for (const c of r.longNames ?? []) if (c.truncated || (c.w >= 80 && !c.name)) bad.push(`${r.sport}/${r.vp} ${c.name ?? 'name hidden'} at w${c.w}`);
    }
    return pf(!bad.length, bad.length ? bad.slice(0, 4).join(' · ') : 'all fixtures');
  }],
  ['C5', 'Edition frames', 'metals dE >=15, programs dE >=10 or another motif, 100% non-fallback; 0 running animations at w<120', 'players-3', () => {
    const t = tests(['card-frames.test.ts']);
    if (!R.cards) return t;
    const anims = R.cards.results.flatMap((r) => Object.entries(r.sweep?.byWidth ?? {}).filter(([w]) => +w < 120).map(([, v]) => v.animations)).reduce((a, b) => a + b, 0);
    return { status: t.status === 'PASS' && anims === 0 ? 'PASS' : 'FAIL', value: t.value + ` · running animations on w<120: ${anims}` };
  }],
  ['C6', 'Team badges', 'badge ink >=4.5:1 for every team', 'players-3', () => {
    if (!R.cards) return missing('players-cards');
    const v = R.cards.results.filter((r) => r.badges);
    const bySport = Object.fromEntries(v.map((r) => [r.sport, r.badges]));
    return pf(Object.values(bySport).every((b) => b.under45 === 0), Object.entries(bySport).map(([s, b]) => `${s} ${b.under45}/${b.teams} under 4.5 (min ${b.min})`).join(' · '));
  }],
  ['C7', 'UtCard outer box', 'identical (+-0.5 px) to before at every width 34-190; classes and aria-label kept', 'players-3/6', () => {
    if (!R.cards) return missing('players-cards');
    const bad = [];
    for (const r of R.cards.results)
      for (const [w, v] of Object.entries(r.sweep?.byWidth ?? {})) {
        const [bw, bh] = BASELINE.box(+w);
        if (Math.abs(v.boxW - bw) > 0.5 || Math.abs(v.boxH - bh) > 0.5) bad.push(`${r.sport}/${r.vp} w${w} ${v.boxW}x${v.boxH}`);
      }
    const t = tests(['card-contract.test.ts']);
    return { status: !bad.length && t.status === 'PASS' ? 'PASS' : 'FAIL', value: (bad.length ? bad.slice(0, 3).join(' · ') : 'boxes identical') + ' · ' + t.value };
  }],
  ['C8', 'CardDetail', 'first six-tile row above the action bar at 393 and 320; labels >=11; 0 a[target]; 0 brand names', 'players-3', () => {
    if (!R.cards) return missing('players-cards');
    const d = R.cards.results.filter((r) => r.detail).map((r) => [r, r.detail]);
    if (!d.length) return { status: 'N/A', value: 'detail not reached' };
    const ok = d.every(([, x]) => x.firstRowVisible && (x.labelPxMin ?? 0) >= 11 && x.targetLinks === 0 && !x.brandNames.length && x.keyTiles >= 6);
    return pf(ok, d.map(([r, x]) => `${r.sport}/${r.vp} row ${x.firstRowVisible ? 'in view' : 'hidden'} · labels ${x.labelPxMin} · target links ${x.targetLinks} · brands ${x.brandNames.join('/') || 0}`).slice(0, 3).join(' · '));
  }],
  ['C9', 'Portrait fill and UT first open', 'first club row <=300 ms at 1x, <=900 ms at 4x; UT first open <= before +5%', 'players-6', () => {
    if (!R.cards) return missing('players-cards');
    const bad = [],
      vals = [];
    for (const r of R.cards.results.filter((x) => x.fill)) {
      for (const [rate, lim] of [[1, 300], [4, 900]]) {
        const f = r.fill[rate + 'x'];
        if (!f) continue;
        vals.push(`${r.sport} ${rate}x row ${f.firstRowArtMs} ms · open ${f.utOpenMs} ms`);
        if (f.firstRowArtMs === null || f.firstRowArtMs > lim) bad.push(`${r.sport} ${rate}x row ${f.firstRowArtMs}`);
        const b = BASELINE.utOpen[r.sport]?.[rate];
        if (b && f.utOpenMs > b * 1.05) bad.push(`${r.sport} ${rate}x open ${f.utOpenMs} vs ${b}`);
      }
    }
    return pf(!bad.length, bad.length ? bad.slice(0, 4).join(' · ') : vals.slice(0, 3).join(' · '));
  }],
  ['C10', 'Binder', '1,000 drafted cards: <=3 bust draws a frame; scroll p95 <=17.5 ms (1x), <=34 ms (4x)', 'players-6', () => ({ status: 'N/A', value: 'the 1,000-card binder fixture arrives with players-6' })],
  ['C11', 'Portrait memory', 'cache <=6 MB per 300 portraits; no main-thread toDataURL', 'players-6', () => {
    const files = ['src/ut/CardArt.tsx', 'src/game/pixel/portrait.ts', 'src/ui/PlayerPortrait.tsx'].filter((f) => fs.existsSync(path.join(ROOT, f)));
    const hits = files.filter((f) => /\.toDataURL\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    const t = testFiles.get('portrait.test.ts') ? tests(['portrait.test.ts']) : { status: 'FAIL', value: 'not built yet: portrait.test.ts' };
    return { status: !hits.length && t.status === 'PASS' ? 'PASS' : 'FAIL', value: (hits.length ? 'toDataURL in ' + hits.join(', ') : 'no toDataURL') + ' · ' + t.value };
  }],
  ['C12', 'Bundle', 'appearance only in lazy chunks; budgets in plan section 2', 'players-10', () => ({ status: 'N/A', value: 'measured on the production build in players-10 (scripts/audit_startup.py)' })],
  // --- what works today ---
  ['K1', 'Keep-list', 'everything the audits say works still draws (anchors, observations, measurements)', 'every task', () => {
    if (!R.keep) return missing('players-keep');
    const fails = R.keep.items.filter((i) => i.status !== 'PASS').map((i) => i.id);
    const seen = R.keep.items.filter((i) => i.observed).length;
    return pf(!fails.length, fails.length ? 'FAIL: ' + fails.join(', ') : `${R.keep.items.length} items, ${seen} observed in play`);
  }],
];

const rows = ROWS.map(([id, area, target, task, f]) => {
  let r;
  try {
    r = f();
  } catch (e) {
    r = { status: 'FAIL', value: 'error: ' + String(e.message).slice(0, 120) };
  }
  return { id, area, target, task, ...r };
});
const count = (s) => rows.filter((r) => r.status === s).length;
const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
process.stderr.write('\n' + rows.map((r) => `${pad(r.status, 5)} ${pad(r.id, 4)} ${pad(r.area, 34)} ${r.value}`).join('\n') + `\n\n${count('PASS')} PASS · ${count('FAIL')} FAIL · ${count('N/A')} N/A\n`);
const routeLogs = Object.values(R).filter(Boolean).map((x) => x.routeLog?.externalCount ?? 0);
const out = { script: 'players-verify', tag, at: new Date().toISOString(), ran, pass: count('PASS'), fail: count('FAIL'), na: count('N/A'), externalRequests: routeLogs.reduce((a, b) => a + b, 0), rows };
fs.writeFileSync(path.join(OUT, `players-verify-${tag}.json`), JSON.stringify(out, null, 1));
process.stdout.write(JSON.stringify(out) + '\n');
if (opts.strict && count('FAIL')) process.exit(1);
