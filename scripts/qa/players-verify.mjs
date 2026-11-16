// Players QA (studio overhaul, players-1): every target in the players plan's section 3 (revision 3,
// Game Design V2), PASS or FAIL. It runs the players harness (or reads the reports a previous run left
// in --out), runs the named unit tests that prove the targets a browser can't measure, and prints one
// row per target. It is the release gate for players-10 and the post-merge check the lead runs on the
// merged tree.
//
//   node scripts/qa/players-verify.mjs [--run all|none|sprites,screen,...] [--quick] [--tag verify]
//        [--no-vitest] [--strict] [--out DIR] [--port 5214]
// --run starts Playwright and vitest: run it through the machine's semaphore,
//   bash <overhaul>/heavy.sh node scripts/qa/players-verify.mjs --run all --port <port>
//
// --run none   evaluate the reports already in --out (written by the scripts with the same --tag)
// --quick      shorter windows (fewer seconds, games and viewports): a smoke check, not a gate
// --strict     exit 1 when any row FAILs
// Rows are PASS, FAIL, or N/A (not measurable here, with the reason). A row whose unit test does not
// exist yet FAILs with "not built yet (<task>)": that is the expected state before its task lands.
// Proving tests are named by repo path (TEST below), never by file name, so another team's test of
// the same name can't pass a row; a basename that also exists elsewhere under src/ is listed as a
// warning in the report.
// The V2 rows follow GAME-DESIGN-V2 as revised at 13:09 on 2026-11-16 (C.1.2 sizes as floors with
// camera guides, C.1.3 five tones + rim light + cast shadows, C.2 shirt-and-head crowds, C.5 rule 4
// stands 30-40%); S1's 1.5 design px half waits for the lead's ruling (S1_RULING).
// Card-text rows (C4, C5, C7) need the Archivo face: they are N/A when a report says
// `fonts: "fallback"` (see players-lib.mjs for PS_QA_FONT_DIR).
// Rows marked "reported" measure what another team owns (the sport teams' cameras and horizons):
// they PASS or FAIL against V2 like any row, and the owner is named in the task column.
// Relative targets ("no worse than before") compare with BASELINE below: the numbers players-1
// measured on the base commit with these same scripts on the dev server (docs/studio-overhaul/
// players.md has the full record). The table and the route log go to stderr; stdout carries the
// one-line JSON report, like every players script.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { listOf, OUT, opts, PORT, ROOT, round } from './players-lib.mjs';

const tag = String(opts.tag ?? 'verify');
const quick = !!opts.quick;
const ALL_STEPS = ['sprites', 'screen', 'matchperf', 'readiness', 'lineup', 'strips', 'cards', 'keep', 'slide'];
const runList = opts.run === 'none' ? [] : listOf(opts.run === 'all' ? undefined : opts.run, ALL_STEPS);

/**
 * The base commit's numbers (1d14201 = acdf3e2's source, dev server, this harness, players-1 on
 * 2026-11-16 with the machine shared by seven teams), for the relative targets.
 */
const BASELINE = {
  // 4x CPU, DPR 3, 10 s windows: [fps, frames over 20 ms] per sport and viewport
  fps4x: {
    nba: { 393: [34.8, 160], 430: [21.7, 181], 320: [33.2, 156], 375: [37.1, 146], '844land': [30.6, 172] },
    nfl: { 393: [33.3, 158], 430: [37.5, 148], 320: [37.6, 132], 375: [38.0, 139], '844land': [39.1, 131] },
    soccer: { 393: [40.1, 140], 430: [38.5, 163], 320: [46.4, 101], 375: [38.2, 137], '844land': [33.7, 177] },
  },
  // navigation to the autoplay bench -> first drawn frame, median of 3, ms (1x, 4x)
  firstFrame: { nba: { 1: 3101, 4: 5972 }, nfl: { 1: 2691, 4: 4739 }, soccer: { 1: 2884, 4: 5823 } },
  // the UtCard outer box at every width: width x 1.4, in design px
  box: (w) => [w, w * 1.4],
  // tap -> UT ready onto the club, ms (1x, 4x), for the UT-first-open target (no worse than +5%): the
  // median of three runs, which spread by up to 2x on the shared machine (NBA 1x 2,220-4,361 ms)
  utOpen: { nba: { 1: 2534, 4: 8942 }, nfl: { 1: 5097, 4: 12337 }, soccer: { 1: 1590, 4: 3096 } },
};

/**
 * The lead's ruling on S1 (V2 contradicts itself: C.6 "replaces the flat 1.5 px per art pixel rule ...
 * size is whatever the camera says" vs C.5 rule 3 and lead decision 3 "one art pixel = 1.5 design
 * px"). null = pending: S1 gates only the whole-device-pixel half. 'flat-1.5' = gate 1.5 ±0.05 design
 * px per art px. 'camera' = no fixed art-pixel size (S6's floors still apply).
 */
const S1_RULING = null;

/** The proving tests, by repo path (the planned path for tests not written yet). */
const TEST = {
  'art-scale': 'src/game/pixel/art-scale.test.ts',
  proportions: 'src/game/pixel/proportions.test.ts',
  outline: 'src/game/pixel/outline.test.ts',
  shading: 'src/game/pixel/shading.test.ts',
  'body-build': 'src/game/pixel/body-build.test.ts',
  'render-only': 'src/game/pixel/render-only.test.ts',
  head: 'src/game/pixel/head.test.ts',
  ground: 'src/game/pixel/ground.test.ts',
  'cast-shadow': 'src/game/pixel/cast-shadow.test.ts',
  appearance: 'src/game/pixel/appearance.test.ts',
  'appearance-data': 'src/game/pixel/appearance-data.test.ts',
  'appearance-soccer': 'src/game/pixel/appearance-soccer.test.ts',
  numbers: 'src/game/pixel/numbers.test.ts',
  venue: 'src/game/pixel/venue.test.ts',
  crowd: 'src/game/pixel/crowd.test.ts',
  readiness: 'src/game/pixel/readiness.test.ts',
  time: 'src/game/pixel/time.test.ts',
  locomotion: 'src/game/pixel/locomotion.test.ts',
  'sprite-budget': 'src/game/pixel/sprite-budget.test.ts',
  transitions: 'src/game/pixel/transitions.test.ts',
  'actions-nba': 'src/game/pixel/actions-nba.test.ts',
  'actions-nfl': 'src/game/pixel/actions-nfl.test.ts',
  'actions-soccer': 'src/game/pixel/actions-soccer.test.ts',
  impact: 'src/game/pixel/impact.test.ts',
  celebrate: 'src/game/pixel/celebrate.test.ts',
  'motion-dna': 'src/game/pixel/motion-dna.test.ts',
  mocap: 'src/game/pixel/mocap.test.ts',
  bust: 'src/game/pixel/bust.test.ts',
  portrait: 'src/game/pixel/portrait.test.ts',
  walkout: 'src/game/pixel/walkout.test.ts',
  'card-frames': 'src/ut/card-frames.test.ts',
  'card-contract': 'src/ut/card-contract.test.ts',
};

const NODE = process.execPath;
const scriptArgs = (extra) => ['--out', OUT, '--port', String(PORT), '--tag', tag, ...extra];
const STEPS = {
  sprites: [[NODE, ['scripts/qa/players-sprites.mjs', ...scriptArgs(['--secs', quick ? '10' : '18'])]]],
  screen: [[NODE, ['scripts/qa/players-screen.mjs', ...scriptArgs(quick ? ['--vp', '393', '--dpr-vp', '393', '--secs', '9'] : [])]]],
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
  if (!STEPS[step]) {
    process.stderr.write(`players-verify: unknown step ${step} (have ${ALL_STEPS.join(', ')})\n`);
    process.exit(2);
  }
  for (const [cmd, args, env = {}] of STEPS[step]) {
    const t0 = Date.now();
    const r = spawnSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const name = step === 'slide' ? path.basename(args[1], '.ts') : step;
    ran[name] = { ok: r.status === 0, secs: round((Date.now() - t0) / 1000, 0), err: r.status === 0 ? null : String(r.stderr).split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300) };
    process.stderr.write(`players-verify: ${name} ${ran[name].ok ? 'ok' : 'FAILED'} (${ran[name].secs}s)\n`);
  }
}

const read = (name) => {
  const f = path.join(OUT, `players-${name}-${tag}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const R = {
  sprites: read('sprites'),
  screen: read('screen'),
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
// every test file under src/, by basename, to warn when a planned name also exists elsewhere
const byBase = (() => {
  const out = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/\.test\.tsx?$/.test(e.name)) out.set(e.name, [...(out.get(e.name) ?? []), path.relative(ROOT, path.join(d, e.name))]);
    }
  };
  walk(path.join(ROOT, 'src'));
  return out;
})();
const testWarnings = Object.values(TEST)
  .map((f) => [f, (byBase.get(path.basename(f)) ?? []).filter((x) => x !== f)])
  .filter(([, others]) => others.length)
  .map(([f, others]) => `${f}: the same name also at ${others.join(', ')} (not used)`);
const vitestCache = new Map();
/**
 * The named tests (keys of TEST, each one exact repo path), run with vitest for `sport`. A test that
 * doesn't exist yet FAILs the row as "not built yet (<task>)".
 */
function tests(names, task, sport = 'nba') {
  const files = names.map((n) => {
    if (!TEST[n]) throw new Error('unknown test ' + n);
    return TEST[n];
  });
  const missing = files.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) return { status: 'FAIL', value: `not built yet (${task}): ${missing.join(', ')}` };
  const label = files.map((f) => path.basename(f)).join(', ');
  if (opts['no-vitest']) return { status: 'N/A', value: 'tests exist (' + label + '); --no-vitest' };
  const key = sport + ':' + files.join(',');
  if (!vitestCache.has(key)) {
    const env = { ...process.env, ...(sport === 'nba' ? {} : { PS_SPORT: sport }) };
    const r = spawnSync('npx', ['vitest', 'run', ...files], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    vitestCache.set(key, r.status === 0);
  }
  return vitestCache.get(key) ? { status: 'PASS', value: label + ' pass' } : { status: 'FAIL', value: label + ' fail' };
}
/** A measured row and its proving test: PASS only when both pass. */
const both = (m, t) => ({ status: m.status === 'PASS' && t.status === 'PASS' ? 'PASS' : m.status === 'N/A' && t.status !== 'FAIL' ? 'N/A' : 'FAIL', value: m.value + ' · ' + t.value });

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
const SP = ['nba', 'nfl', 'soccer'];
const lineupOf = (sport) => R.lineup?.results?.find((r) => r.sport === sport);
/** Card-text rows need the real Archivo face: N/A when the cards report ran on the fallback font. */
const needArchivo = (rep) => (rep && rep.fonts !== 'archivo-local' ? { status: 'N/A', value: `Archivo not available (fonts: ${rep.fonts ?? 'unknown'}); set PS_QA_FONT_DIR and re-run players-cards` } : null);

// ---------- section 3, row by row ----------
const ROWS = [
  // --- 3.1 Broadcast Pixel sprites (V2 C.1) ---
  ['S1', 'Art pixel', 'a whole number of device px at DPR 1, 2 and 3; 1 art px = 1.5 design px (±0.05) pending the lead ruling (C.6 vs C.5 rule 3)', 'players-2', () => {
    const a = R.screen?.artPixel;
    if (!a?.length) return missing('players-screen');
    const off = a.filter((x) => Math.abs(x.designPerArt - 1.5) > 0.05);
    const frac = a.filter((x) => !x.integer);
    const show = SP.map((s) => a.find((x) => x.sport === s && x.vp === '393' && x.dpr === 3)).filter(Boolean).map((x) => `${x.sport} ${x.designPerArt} design/art, ${x.devPerArt} dev/art @3x`);
    const t = tests(['art-scale'], 'players-2');
    const v = `${show.join(' · ')} · ${frac.length}/${a.length} non-integer`;
    if (frac.length || t.status === 'FAIL') return both(pf(!frac.length, v), t);
    if (S1_RULING === 'flat-1.5') return both(pf(!off.length, v + ` · ${off.length}/${a.length} off 1.5`), t);
    if (S1_RULING === 'camera') return both(pf(true, v + ' · size set by the camera (ruling)'), t);
    return { status: 'N/A', value: v + ' · whole device px PASS; the 1.5 design px half is pending the lead ruling (team doc section 5, request 7) · ' + t.value };
  }],
  ['S2', 'Heads tall and head box', 'C.1.1: 4.5/5/5.5/6 heads (±0.25) and 5x5, 6x6, 7x8, 12x13 (±1) at 20/24/34/60 art px', 'players-2', () => {
    const n = lineupOf('nba');
    if (!n?.proportions) return missing('players-lineup');
    const v = n.proportions.map((p) => `${p.artH ?? p.px}px ${p.headsTall}h ${p.headW}x${p.headH}`).join(' · ');
    return both(pf(n.proportions.every((p) => p.ok), v), tests(['proportions'], 'players-2'));
  }],
  ['S3', 'Outline and shading', 'edge #14121c 100%; 0 inner outline-colour px; >=3 tones per main material and a rim highlight (C.7 #8; C.1.3 asks 5 tones)', 'players-2/4', () => {
    const rs = SP.map(lineupOf).filter((r) => r?.outline);
    if (!rs.length) return missing('players-lineup');
    const edge = Math.min(...rs.map((r) => r.outline.edgeV2ShareMin));
    const inner = Math.max(...rs.map((r) => Math.max(...r.outline.each.map((e) => e.innerLinePx))));
    const measuredShading = rs.every((r) => r.outline.tonesMin !== undefined);
    const tones = measuredShading ? Math.min(...rs.map((r) => r.outline.tonesMin)) : null;
    const rim = measuredShading ? Math.min(...rs.map((r) => r.outline.rimShareMin)) : null;
    const v = rs.map((r) => `${r.sport} edge #14121c ${Math.round(100 * r.outline.edgeV2ShareMin)}%, inner line px p50 ${r.outline.innerLinePxP50}, tones min ${r.outline.tonesMin ?? '?'}, rim lit min ${r.outline.rimShareMin ?? '?'}`).join(' · ');
    // the rim is "present" when at least 90% of the pixels with nothing above-left are their material's brightest tone
    const ok = edge >= 0.999 && inner === 0 && measuredShading && tones >= 3 && rim >= 0.9;
    return both(pf(ok, v + (measuredShading ? '' : ' · re-run players-lineup for tones and rim')), tests(['outline', 'shading'], 'players-2/4'));
  }],
  // the audit's measure: the widest row of the chest band (30-45% down), arms included, front-on; the
  // torso-only 8-13 px band is proportions.test.ts's
  ['S4', 'Body width by build (34 art px)', 'Shaq − Bol >=3; BMI 31 vs 20 >=25% wider; Jokic − Giannis >=1 (chest band, arms in)', 'players-2/4', () => {
    const t = lineupOf('nba')?.torso34;
    if (!t) return missing('players-lineup');
    const ok = t.Shaq - t['Manute Bol'] >= 3 && t['BMI 31 (78 in)'] >= 1.25 * t['BMI 20 (78 in)'] && t.Jokic - t.Giannis >= 1;
    return both(pf(ok, `Curry ${t.Curry} · Giannis ${t.Giannis} · Jokic ${t.Jokic} · Shaq ${t.Shaq} · Bol ${t['Manute Bol']} · BMI20/31 ${t['BMI 20 (78 in)']}/${t['BMI 31 (78 in)']}`), tests(['proportions', 'body-build'], 'players-2/4'));
  }],
  ['S5', 'Height spread', 'drawn height spread x1.15 (±0.02) around the sport mean; sim height untouched', 'players-2', () => tests(['proportions', 'render-only'], 'players-2')],
  ['S6', 'On-screen heights (reported)', 'C.1.2 floors at 393: controlled >= NBA 51 / NFL, soccer 34 design px; far >= 36 / 22.5 (guides 95/70/75 reported)', 'sport teams (cameras); re-run players-10', () => {
    if (!R.screen?.runs) return missing('players-screen');
    const rs = SP.map((s) => run(R.screen, s, '393')).filter(Boolean);
    if (!rs.length) return missing('players-screen --vp 393');
    const FLOOR = { nba: [51, 36], nfl: [34, 22.5], soccer: [34, 22.5] };
    const GUIDE = { nba: [95, 60], nfl: [70, 45], soccer: [75, 55] };
    const ok = rs.every((r) => (r.heights.designPx.controlled ?? 0) >= FLOOR[r.sport][0] && (r.heights.designPx.far ?? 0) >= FLOOR[r.sport][1]);
    return pf(ok, rs.map((r) => `${r.sport} controlled ${r.heights.designPx.controlled} (floor ${FLOOR[r.sport][0]}, guide ~${GUIDE[r.sport][0]}) far ${r.heights.designPx.far} (floor ${FLOOR[r.sport][1]}, guide ~${GUIDE[r.sport][1]})`).join(' · '));
  }],
  ['S7', 'Level of detail', 'far bodies drawn at native art size; hair collapses to 4 below 24 art px; facial hair off below 20 except a full beard', 'players-2/4', () => tests(['head', 'art-scale'], 'players-2/4')],
  ['S8', 'Ground marks', 'cast shadow: the silhouette sheared away from the lights at 34-42% alpha plus an occlusion ellipse; you #f6b93b, target #4fe3c1, pressure #ff5d5d, rival #8b7cf6; no other field use of those', 'players-2/4', () => tests(['ground', 'cast-shadow'], 'players-2/4')],
  // --- 3.2 Likeness and venues ---
  ['L1', 'Identity in one shared kit', 'pairs >=8% different at 24 px (NBA 80%, NFL/soccer 75%); all >=12% at 34; all >=8% at 60', 'players-4/9', () => {
    if (!R.lineup) return missing('players-lineup');
    const v = R.lineup.results.map((r) => {
      const need = r.sport === 'nba' ? 0.8 : 0.75;
      const i34 = r.identity['34px'] ?? r.identity['40px'];
      const ok = r.identity['24px'].sharePairsAtLeast8pct >= need && i34.minPct >= 12 && r.identity['60px'].minPct >= 8;
      return [ok, `${r.sport} ${Math.round(100 * r.identity['24px'].sharePairsAtLeast8pct)}%/${i34.minPct}%/${r.identity['60px'].minPct}%`];
    });
    return pf(all(v.map((x) => x[0])), v.map((x) => x[1]).join(' · ') + ' (24 px share >=8%, 34 px min, 60 px min)');
  }],
  ['L2', 'Default looks', 'no style >40% per era bucket; >=5 silhouettes; 0 goggles/headband/dyed/blond/left defaults', 'players-3', () => tests(['appearance'], 'players-3')],
  ['L3', 'Tier A coverage', 'first-run 100% (>=12 per sport) + 7 owner-named; then GOAT + Legend + top 60; src + reviewed on every row; <=20 KB gzip', 'players-3/9', () => tests(['appearance-data'], 'players-3')],
  ['L4', 'Owner-named looks', 'from the appearance record: Shaq bald, Iverson cornrows + headband, Kareem goggles, Rodman dyed (1994-98), Haaland long blond, Mbappe short + clean-shaven, Brady curated and reviewed', 'players-3/4', () => {
    if (!R.lineup) return missing('players-lineup');
    const ex = R.lineup.results.flatMap((r) => r.ownerExamples);
    const notBuilt = ex.filter((e) => e.notBuilt || (e.correct === null && !('record' in e)));
    if (notBuilt.length) return { status: 'FAIL', value: `not built yet (players-3): the appearance record (${notBuilt.length} of ${ex.length} looks unjudged)` };
    const wrong = ex.filter((e) => e.correct !== true).map((e) => e.name.split(' ').pop());
    return pf(!wrong.length, wrong.length ? 'wrong: ' + wrong.join(', ') : ex.length + ' checked');
  }],
  ['L5', 'Numbers', 'exact front-on from 28 design px; exact or hidden, never scrambled; 6x10 font at >=60 art px', 'players-4', () => tests(['numbers'], 'players-4')],
  ['L6', 'Venue (C.2)', 'surface grain <=4%; stands softer and foggier than the play (edge and chroma ratios <1); a mixed crowd (>=3 colour families at >=3%, none >55%, near-white <=20%; exact C.2 shirt shares in venue.test.ts); corners darker (<=-15%)', 'players-4', () => {
    if (!R.screen?.runs) return missing('players-screen');
    const rs = SP.map((s) => run(R.screen, s, '393')).filter(Boolean);
    const ratio = (a, b) => (a === null || a === undefined || !b ? null : round(a / b, 2));
    const each = rs.map((r) => {
      const v = r.venue;
      const edge = ratio(v.standsEdge, v.spriteEdge),
        chroma = ratio(v.standsChroma, v.spriteChroma);
      const mixOk = v.crowdFamilies3pct !== undefined && v.crowdFamilies3pct >= 3 && v.crowdTopFamilyShare <= 0.55 && v.crowdWhiteShare <= 0.2;
      const ok = (v.grainPct ?? 99) <= 4 && edge !== null && edge < 1 && chroma !== null && chroma < 1 && mixOk && (v.vignettePct ?? 0) <= -15;
      return [ok, `${r.sport} grain ${v.grainPct}% · stands/sprites edge ${edge ?? '?'} chroma ${chroma ?? '?'} · crowd families ${v.crowdFamilies3pct ?? '?'} top ${v.crowdTopFamilyShare ?? '?'} white ${v.crowdWhiteShare ?? '?'} · corners ${v.vignettePct}% (venue vs sprites L* ${v.venueDarkerPct}% darker, reported)`];
    });
    const m = pf(each.length > 0 && all(each.map((x) => x[0])), each.map((x) => x[1]).join(' · '));
    return both(m, tests(['venue'], 'players-4'));
  }],
  ['L7', 'Stands share of screen (reported)', 'C.5 rule 4: the stands about 30-40% of the screen height above the far boundary in portrait (27-43% accepted) at 393 and 320', 'sport teams (horizon); re-run players-10', () => {
    if (!R.screen?.runs) return missing('players-screen');
    const rs = R.screen.runs.filter((r) => r.vp !== '844land');
    return pf(rs.length > 0 && rs.every((r) => (r.venue.crowdScreenPct ?? 0) >= 27 && (r.venue.crowdScreenPct ?? 99) <= 43), rs.map((r) => `${r.sport}/${r.vp} stands ${r.venue.crowdScreenPct}% (all above the surface ${r.venue.aboveSurfaceScreenPct}%)`).join(' · '));
  }],
  ['L8', 'Crowd reactions', 'front rows stand/bounce/wave within 6-12 frames of a score, ON FIRE or Clutch; back within 1.5 s', 'players-9 (stretch)', () => tests(['crowd'], 'players-9 stretch')],
  // --- 3.3 Animation and engine render ---
  ['A1', 'Stale body draws, NFL autoplay', '>=48 px <2%, 32-47 px <5%, overall <10%', 'players-5', () => {
    const r = run(R.sprites, 'nfl');
    if (!r) return missing('players-sprites');
    const big = stalePct(r, ['48-71', '72+']),
      mid = stalePct(r, ['32-47']);
    return pf((big ?? 0) < 2 && (mid ?? 0) < 5 && r.stalePct < 10, `>=48 ${big}% · 32-47 ${mid}% · overall ${r.stalePct}%`);
  }],
  ['A2', 'Stale draws, NBA / soccer', 'NBA >=48 px <2% and first 10 frames <5%; soccer <=1%', 'players-5', () => {
    const n = run(R.sprites, 'nba'),
      s = run(R.sprites, 'soccer');
    if (!n || !s) return missing('players-sprites');
    const big = stalePct(n, ['48-71', '72+']);
    const first = n.bySinceStart?.['0-9']?.stalePct ?? 0;
    return pf((big ?? 0) < 2 && first < 5 && s.stalePct <= 1, `NBA >=48 ${big}% · NBA first 10 frames ${first}% · soccer ${s.stalePct}%`);
  }],
  ['A3', 'Pre-warm after snap, kickoff, inbound', 'stale <=1% for >=32 px in the first 30 frames', 'players-5', () => {
    const rs = SP.map((s) => run(R.sprites, s));
    if (rs.some((r) => !r)) return missing('players-sprites');
    const v = rs.map((r) => {
      const a = r.bySinceStart?.['0-9'],
        b = r.bySinceStart?.['10-29'];
      const n = (a?.lookups ?? 0) + (b?.lookups ?? 0);
      return n ? ((a?.stalePct ?? 0) * (a?.lookups ?? 0) + (b?.stalePct ?? 0) * (b?.lookups ?? 0)) / n : null;
    });
    return pf(v.every((x) => x === null || x <= 1), SP.map((s, i) => `${s} ${v[i] === null ? 'no starts' : round(v[i], 1) + '%'}`).join(' · '));
  }],
  ['A4', 'Effective animation rate', 'handler/carrier, nearest and large bodies >=28 fps; every body >=12, none <10 (1x)', 'players-5', () => {
    const rs = SP.map((s) => run(R.sprites, s));
    if (rs.some((r) => !r)) return missing('players-sprites');
    const v = rs.map((r) => r.animFps);
    const ok = v.every((a) => a.all.under12 === 0 && a.all.under10 === 0 && [a.large40, a.ball, a.nearest6].every((d) => !d.bodies || d.min >= 28));
    return pf(ok, SP.map((s, i) => `${s} min ${v[i].all.min}/p50 ${v[i].all.p50} (near ${v[i].nearest6.min}, ball ${v[i].ball.min ?? '-'})`).join(' · '));
  }],
  ['A5', 'In-match fps', '1x holds 60.0 at 5 viewports; 4x at or above before; >20 ms frames no worse than +10%', 'players-2/5/6/7/9/10', () => {
    if (!R.matchperf) return missing('players-matchperf');
    const bad = [];
    for (const r of R.matchperf.runs) {
      if (r['1x'] && r['1x'].fps < 59.5) bad.push(`${r.sport} ${r.vp} 1x ${r['1x'].fps}`);
      const b = BASELINE.fps4x[r.sport]?.[r.vp];
      if (b && r['4x'] && (r['4x'].fps < b[0] - 1 || r['4x'].over20 > Math.ceil(b[1] * 1.1) + 2)) bad.push(`${r.sport} ${r.vp} 4x ${r['4x'].fps}/${r['4x'].over20} vs ${b[0]}/${b[1]}`);
    }
    return pf(!bad.length, bad.length ? `${bad.length} misses, e.g. ` + bad.slice(0, 4).join(' · ') : `${R.matchperf.runs.length} runs within target`);
  }],
  ['A6', 'Canvas memory', 'cached sprite area <=6 Mpx per match; heap within +10%', 'players-2/5/6', () => {
    if (!R.matchperf) return missing('players-matchperf');
    const peak = Math.max(...R.matchperf.runs.map((r) => r.spriteAreaPeakMpx ?? 0));
    const worst = R.matchperf.runs.find((r) => r.spriteAreaPeakMpx === peak);
    const heap = R.matchperf.runs.filter((r) => r.heapEndMB > r.heapStartMB * 1.1 + 2);
    return pf(peak <= 6 && !heap.length, `peak ${peak} Mpx (${worst?.sport} ${worst?.vp}) · heap grew >10% in ${heap.length} runs`);
  }],
  ['A7', 'Readiness at match start', '0 frames with stand-in poses or default looks after frame 1; PLAY-to-first-frame <= before +100 ms', 'players-3', () => {
    if (!R.readiness) return missing('players-readiness');
    const bad = [];
    for (const r of R.readiness.results) {
      const pd = r.each?.[0]?.pixelDebug;
      const stand = pd ? (pd.standIn ?? pd.standInPoses ?? 0) + (pd.defaultLooks ?? 0) : r.median.standInFramesAfterFirst;
      if (stand > 0) bad.push(`${r.sport} ${r.cpu}x ${stand} stand-in frames`);
      // until the appearance data exists, every frame draws default looks
      if (!pd && !r.each?.some((e) => e.appearanceChunks > 0)) bad.push(`${r.sport} ${r.cpu}x no appearance data: every frame draws default looks`);
      const b = BASELINE.firstFrame[r.sport]?.[r.cpu];
      if (b && r.median.playToFirstFrameMs > b + 100) bad.push(`${r.sport} ${r.cpu}x first frame ${r.median.playToFirstFrameMs} vs ${b}`);
    }
    return both(pf(!bad.length, bad.length ? bad.slice(0, 3).join(' · ') + (bad.length > 3 ? ` (+${bad.length - 3})` : '') : R.readiness.results.map((r) => `${r.sport} ${r.cpu}x ${r.median.playToFirstFrameMs} ms`).join(' · ')), tests(['readiness'], 'players-3'));
  }],
  ['A8', 'Foot sliding', 'NBA <=8%, soccer <=4%, NFL <=5% and 0 idle-while-moving QB frames', 'players-5', () => {
    if (!R.slideNba || !R.slideSoccer || !R.slideNfl) return missing('players-slide-*.ts');
    return pf(R.slideNba.slidingPct <= 8 && R.slideSoccer.slidingPct <= 4 && R.slideNfl.slidingPct <= 5 && R.slideNfl.qbIdleMovingFrames === 0, `NBA ${R.slideNba.slidingPct}% · soccer ${R.slideSoccer.slidingPct}% · NFL ${R.slideNfl.slidingPct}% · QB idle-moving ${R.slideNfl.qbIdleMovingFrames}`);
  }],
  ['A9', 'Time discontinuities', 'replay, pause, SIM, rematch, hit-stop: 0 frames blend from the pre-jump pose; first resumed jump <=20%', 'players-5/6', () => tests(['time'], 'players-5')],
  ['A10', 'HUD anchors and sprite budget', 'drawn offset <=5% of body height; drawnOffset/headTop/feetAt/handAnchor exported; near bodies never stale >2 frames', 'players-5', () => tests(['locomotion', 'sprite-budget'], 'players-5')],
  ['A11', 'Pose jump at hard cuts', 'every listed cut <=20% of body height via 80-120 ms blends', 'players-6', () => {
    const t = tests(['transitions'], 'players-6');
    const raw = R.strips?.strips?.cutJumpPct;
    return { ...t, value: t.value + (raw ? ' · raw cuts today ' + Object.entries(raw).slice(0, 5).map(([k, v]) => `${k} ${v}%`).join(', ') : '') };
  }],
  ['A12', 'Frame plans (V2 B.1.6, B.2.6, B.3.6)', 'event frames on engine time (±0 f); frame counts ±1 f; the five recorded clips played', 'players-6/7', () => {
    const r = [tests(['actions-nba'], 'players-7'), tests(['actions-nfl'], 'players-6', 'nfl'), tests(['actions-soccer'], 'players-6', 'soccer')];
    return { status: r.every((x) => x.status === 'PASS') ? 'PASS' : 'FAIL', value: r.map((x) => x.value).join(' · ') };
  }],
  ['A13', 'Hit-stop and shake', 'impactOf ±10 ms; <=150 ms hit-stop per second; trauma by mass x speed; reduced motion <=30 ms, 0 shake', 'players-6', () => tests(['impact'], 'players-6')],
  ['A14', 'Celebrations', '<=4 per sport; NBA 0.8 s, NFL/soccer 1.2 s; skippable from 0.25 s; 0 frames at the next start; 0 s added', 'players-7', () => tests(['celebrate'], 'players-7')],
  ['A15', 'Motion DNA and handedness', 'set point >=3 art px apart at 60; QB slot 15/35/55 ±5; run lean >=4 deg; lefties mirrored on 100% of releases', 'players-7/9', () => both(tests(['motion-dna'], 'players-9'), tests(['mocap'], 'players-7'))],
  ['A16', 'Soccer feet', '>=85% recorded foot; >=95% of left-footers kick with kick_l', 'players-9', () => both(tests(['appearance-soccer'], 'players-3/9', 'soccer'), tests(['actions-soccer'], 'players-6', 'soccer'))],
  ['A17', 'Simulation untouched', 'import graph and per-step seeded state hash identical with rendering on', 'players-2', () => tests(['render-only'], 'players-2')],
  ['A18', 'Blends under load', 'stale <=2% for >=48 px (>=32 px when the camera shows no 48 px body that early) in the 20 frames after an NFL snap, on >=200 lookups; blend sprites <=10% of cache', 'players-6', () => {
    const r = run(R.sprites, 'nfl');
    if (!r) return missing('players-sprites');
    const b48 = r.bySinceStart?.['48px-0-19'],
      b32 = r.bySinceStart?.['32px-0-19'];
    const [b, size] = (b48?.lookups ?? 0) >= 200 ? [b48, '>=48 px'] : (b32?.lookups ?? 0) >= 200 ? [b32, '>=32 px'] : [null, null];
    const sample = b ? `stale after snap ${size} ${b.stalePct}% (${b.lookups} lookups)` : `no >=48 or >=32 px sample after a snap (48 px: ${b48?.lookups ?? 0} lookups, 32 px: ${b32?.lookups ?? 0})`;
    const pd = r.pixelDebug;
    if (!b) return pf(false, sample);
    if (!pd || pd.blendEntries === undefined) return pf(false, `no blends yet (players-6 adds the ?pixeldebug counters) · ${sample}`);
    return pf(b.stalePct <= 2 && pd.blendEntries / Math.max(1, r.cacheEntries) <= 0.1, `${sample} · blends ${pd.blendEntries}/${r.cacheEntries}`);
  }],
  // --- 3.4 Cards ---
  ['C1', 'Card art head size (design px)', 'head >=24 at 80, >=45 at 150/170, >=57 at 190, >=14 at 44, >=11 at 34-40', 'players-8', () => {
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
  ['C2', 'Bust recognisability', '12 stars in one kit differ pairwise >=15% on the 80 px card; locked >=10%', 'players-8', () => tests(['bust'], 'players-8')],
  ['C3', 'Frame ladder (C.4)', 'a distinct silhouette per family; metals dE >=15; programs dE >=10 or a motif; 100% non-fallback; 0 running animations at w<120', 'players-8', () => {
    const t = tests(['card-frames'], 'players-8');
    if (!R.cards) return t;
    const anims = R.cards.results.flatMap((r) => Object.entries(r.sweep?.byWidth ?? {}).filter(([w]) => +w < 120).map(([, v]) => v.animations)).reduce((a, b) => a + b, 0);
    return { status: t.status === 'PASS' && anims === 0 ? 'PASS' : 'FAIL', value: t.value + ` · running animations on w<120: ${anims}` };
  }],
  ['C4', 'Card text at every size', 'OVR and POS >=10 design px at w>=34; name >=10 at w>=52; 0 overflow at 393 and 320', 'players-8', () => {
    if (!R.cards) return missing('players-cards');
    const nf = needArchivo(R.cards);
    if (nf) return nf;
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
  ['C5', '3-digit values and long names', 'OVR 105 >=20 px at 80 with 0 overflow; long names whole at w=44, 80, 170; "Throw under pressure" and every CardDetail text whole', 'players-8', () => {
    if (!R.cards) return missing('players-cards');
    const nf = needArchivo(R.cards);
    if (nf) return nf;
    const bad = [];
    for (const r of R.cards.results) {
      for (const c of r.threeDigit ?? []) if ((c.w === 80 && c.ovrPx < 20) || c.overflow.length || c.truncated.length) bad.push(`${r.sport}/${r.vp} 105 at w${c.w}`);
      for (const c of r.longNames ?? []) if (c.truncated || (c.w >= 80 && !c.name)) bad.push(`${r.sport}/${r.vp} ${c.name ?? 'name hidden'} at w${c.w}`);
      if (r.detail && !r.detail.truncatedTexts) bad.push(`${r.sport}/${r.vp} detail not measured for truncation: re-run players-cards`);
      for (const t of r.detail?.truncatedTexts ?? []) bad.push(`${r.sport}/${r.vp} detail "${t}" cut off`);
    }
    return pf(!bad.length, bad.length ? `${bad.length} misses, e.g. ` + bad.slice(0, 4).join(' · ') : 'all fixtures');
  }],
  ['C6', 'Team badges', 'badge ink >=4.5:1 for every team', 'players-8', () => {
    if (!R.cards) return missing('players-cards');
    const v = R.cards.results.filter((r) => r.badges);
    const bySport = Object.fromEntries(v.map((r) => [r.sport, r.badges]));
    return pf(Object.values(bySport).every((b) => b.under45 === 0), Object.entries(bySport).map(([s, b]) => `${s} ${b.under45}/${b.teams} under 4.5 (min ${b.min})`).join(' · '));
  }],
  ['C7', 'CardDetail', 'first six-tile row above the action bar at 393 and 320; labels >=11; 0 a[target]; 0 brand names', 'players-8', () => {
    if (!R.cards) return missing('players-cards');
    const nf = needArchivo(R.cards);
    if (nf) return nf;
    const d = R.cards.results.filter((r) => r.detail).map((r) => [r, r.detail]);
    if (!d.length) return { status: 'N/A', value: 'detail not reached' };
    const ok = d.every(([, x]) => x.firstRowVisible && (x.labelPxMin ?? 0) >= 11 && x.targetLinks === 0 && !x.brandNames.length && x.keyTiles >= 6);
    return pf(ok, d.map(([r, x]) => `${r.sport}/${r.vp} row ${x.firstRowVisible ? 'in view' : 'hidden'} · labels ${x.labelPxMin} · target links ${x.targetLinks} · brands ${x.brandNames.join('/') || 0}`).slice(0, 3).join(' · '));
  }],
  ['C8', 'UtCard outer box', 'identical (±0.5 px) at every width 34-190; classes and aria-label kept', 'players-8', () => {
    if (!R.cards) return missing('players-cards');
    const bad = [];
    for (const r of R.cards.results)
      for (const [w, v] of Object.entries(r.sweep?.byWidth ?? {})) {
        const [bw, bh] = BASELINE.box(+w);
        if (Math.abs(v.boxW - bw) > 0.5 || Math.abs(v.boxH - bh) > 0.5) bad.push(`${r.sport}/${r.vp} w${w} ${v.boxW}x${v.boxH}`);
      }
    return both(pf(!bad.length, bad.length ? bad.slice(0, 3).join(' · ') : 'boxes identical'), tests(['card-contract'], 'players-8'));
  }],
  ['C9', 'Portrait fill and scroll', 'first club row <=300 ms at 1x, <=900 ms at 4x; 120-card fill <=1.2 s / <=3.5 s; 0 long tasks >50 ms; club-grid scroll p95 <=17.5 ms at 1x, <=34 ms at 4x (UT first open reported; gated in players-10 on vite preview)', 'players-8', () => {
    if (!R.cards) return missing('players-cards');
    const bad = [],
      vals = [];
    const rs = R.cards.results.filter((x) => x.fill);
    if (!rs.length) return missing('players-cards (fill pass)');
    for (const r of rs) {
      for (const [rate, rowLim, fillLim, p95Lim] of [
        [1, 300, 1200, 17.5],
        [4, 900, 3500, 34],
      ]) {
        const f = r.fill[rate + 'x'];
        if (!f) {
          bad.push(`${r.sport} ${rate}x not measured`);
          continue;
        }
        const sc = f.scroll;
        vals.push(`${r.sport} ${rate}x row ${f.firstRowArtMs} ms · 120 fill ${sc?.fill120Ms ?? '-'} ms · scroll p95 ${sc?.frameP95Ms ?? '-'} ms · long tasks ${sc?.longTasks ?? '-'} (max ${sc?.longTaskMaxMs ?? '-'} ms) · open ${f.utOpenMs} ms (base ${BASELINE.utOpen[r.sport]?.[rate] ?? '-'}, reported)`);
        if (f.firstRowArtMs === null || f.firstRowArtMs > rowLim) bad.push(`${r.sport} ${rate}x row ${f.firstRowArtMs}`);
        if (!sc || sc.error) {
          bad.push(`${r.sport} ${rate}x no scroll pass${sc?.error ? ': ' + sc.error : ' (re-run players-cards)'}`);
          continue;
        }
        if (sc.fill120Ms === null || sc.fill120Ms > fillLim) bad.push(`${r.sport} ${rate}x 120-card fill ${sc.fill120Ms ?? 'never'} (${sc.cardsInGrid} cards)`);
        if (sc.frameP95Ms === null || sc.frameP95Ms > p95Lim) bad.push(`${r.sport} ${rate}x scroll p95 ${sc.frameP95Ms}`);
        if (sc.longTaskMaxMs > 50) bad.push(`${r.sport} ${rate}x long task ${sc.longTaskMaxMs} ms`);
      }
    }
    return pf(!bad.length, (bad.length ? bad.slice(0, 4).join(' · ') + (bad.length > 4 ? ` (+${bad.length - 4})` : '') + ' || ' : '') + vals.slice(0, 2).join(' · '));
  }],
  ['C10', 'Portrait memory', 'cache <=6 MB per 300 portraits; no main-thread toDataURL', 'players-8', () => {
    const files = ['src/ut/CardArt.tsx', 'src/game/pixel/portrait.ts', 'src/ui/PlayerPortrait.tsx'].filter((f) => fs.existsSync(path.join(ROOT, f)));
    const hits = files.filter((f) => /\.toDataURL\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    const t = tests(['portrait'], 'players-8');
    return { status: !hits.length && t.status === 'PASS' ? 'PASS' : 'FAIL', value: (hits.length ? 'toDataURL in ' + hits.join(', ') : 'no toDataURL') + ' · ' + t.value };
  }],
  ['C11', 'Walkout figure', '56-72 art px, 6 heads tall; walk-in + celebration <=2.0 s; reduced motion a static bust for 600 ms', 'players-7', () => tests(['walkout'], 'players-7')],
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
// the route log of every report read: nothing may have left the machine
const routes = Object.entries(R)
  .filter(([, x]) => x)
  .map(([k, x]) => ({ report: k, external: x.routeLog?.externalCount ?? 0, blocked: x.routeLog?.blocked ?? {}, local: Object.values(x.routeLog?.continued ?? {}).reduce((a, b) => a + b, 0) }));
const externalRequests = routes.reduce((a, r) => a + r.external, 0);
const blocked = {};
for (const r of routes) for (const [h, n] of Object.entries(r.blocked)) blocked[h] = (blocked[h] ?? 0) + n;
process.stderr.write(
  '\n' +
    rows.map((r) => `${pad(r.status, 5)} ${pad(r.id, 4)} ${pad(r.area, 36)} ${r.value}`).join('\n') +
    `\n\n${count('PASS')} PASS · ${count('FAIL')} FAIL · ${count('N/A')} N/A\n` +
    `route log: ${routes.length} reports, ${routes.reduce((a, r) => a + r.local, 0)} localhost requests, ${externalRequests} external, blocked ${JSON.stringify(blocked)}\n`
);
const fonts = Object.fromEntries(Object.entries(R).filter(([, x]) => x).map(([k, x]) => [k, x.fonts ?? 'unknown']));
process.stderr.write(`fonts: ${JSON.stringify(fonts)}\n` + (testWarnings.length ? 'test name warnings: ' + testWarnings.join('; ') + '\n' : ''));
const out = { script: 'players-verify', tag, at: new Date().toISOString(), ran, pass: count('PASS'), fail: count('FAIL'), na: count('N/A'), externalRequests, fonts, s1Ruling: S1_RULING, testWarnings, routeLog: { reports: routes, blocked }, rows };
fs.writeFileSync(path.join(OUT, `players-verify-${tag}.json`), JSON.stringify(out, null, 1));
process.stdout.write(JSON.stringify(out) + '\n');
if (opts.strict && count('FAIL')) process.exit(1);
