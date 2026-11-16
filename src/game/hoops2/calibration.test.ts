// The box-score calibration (Claude 2026-11-10; opt-in, it plays thousands of possessions):
//   NBA_CAL=1 npx vitest run src/game/hoops2/calibration.test.ts
// AI against AI with real Squad Battles squads, every number counted from the engine's own events
// (box.ts and the harness tally) and printed against targets.ts. Options:
//   NBA_CAL_GAMES     games per config (15 to iterate, 150 to accept; never assert on 15)
//   NBA_CAL_CONFIGS   a comma list of configs to run (default: all but the eras)
//   NBA_ERA=1         add the by-decade era run
//   NBA_CAL_OUT       where the JSON goes (default: the OS temp dir; never committed)
//   NBA_CAL_ASSERT=1  turn the bands into assertions (nba-10's single global fit only)
import { LEVEL } from '../../ut/battles';
import { getPool, type Pool } from '../../ut/pool';
import { type BoxLine, type BoxTeam, BoxTracker } from './box';
import { env, newTally, outPath, playMatch, playSide, type Squad, squadRaw, squadShown, summary, type Tally, thrAvg, writeOut } from './harness';
import { newHoopsGame, POSSESSIONS } from './game';
import { target, TARGETS, THR_AVG_ENGINE, THR_AVG_UT, within } from './targets';

const run = env.NBA_CAL ? it : it.skip;
const GAMES = Number(env.NBA_CAL_GAMES ?? 15);
const ASSERT = !!env.NBA_CAL_ASSERT;
const OUT = outPath(env.NBA_CAL_OUT, 'nba-cal.json');
const PRO = 0.68;

interface Config {
  id: string;
  what: string;
  a: (pool: Pool, i: number) => Squad;
  b: (pool: Pool, i: number) => Squad;
  skill: number;
  def: number;
  /** the games' seed prefix (default: the config's id) */
  seed?: string;
}

const rung = (lv: keyof typeof LEVEL) => ({ skill: PRO + LEVEL[lv].skill, def: LEVEL[lv].def });
const raw = (n: number, tag: string) => (pool: Pool, i: number) => squadRaw(pool, n, tag + (i % 10));
const shown = (n: number, tag: string) => (pool: Pool, i: number) => squadShown(pool, n, tag + (i % 10));

const CONFIGS: Config[] = [
  // the audit's own config (aiOpponent at displayed 78, the audit's seeds): the baseline reproduction
  { id: 'audit78', what: 'audit even 78 (displayed team 78), Pro', a: (p, i) => squadShown(p, 78, 'Aeven78' + (i % 10)), b: (p, i) => squadShown(p, 78, 'Beven78' + (i % 10)), skill: PRO, def: 0, seed: 'even78_pro' },
  { id: 'even70', what: 'even 70 (raw), Pro', a: raw(70, 'A70:'), b: raw(70, 'B70:'), skill: PRO, def: 0 },
  { id: 'even78', what: 'even 78 (raw), Pro', a: raw(78, 'A78:'), b: raw(78, 'B78:'), skill: PRO, def: 0 },
  { id: 'even86', what: 'even 86 (raw), Pro', a: raw(86, 'A86:'), b: raw(86, 'B86:'), skill: PRO, def: 0 },
  { id: 'even78_rookie', what: 'even 78, UT Rookie rung', a: raw(78, 'A78:'), b: raw(78, 'B78:'), ...rung('rookie') },
  { id: 'even78_allstar', what: 'even 78, UT All-Star rung', a: raw(78, 'A78:'), b: raw(78, 'B78:'), ...rung('allstar') },
  { id: 'even78_legend', what: 'even 78, UT Legend rung', a: raw(78, 'A78:'), b: raw(78, 'B78:'), ...rung('legend') },
  { id: '90v75', what: '90 v 75 (raw), Pro', a: raw(90, 'A90:'), b: raw(75, 'B75:'), skill: PRO, def: 0 },
  { id: 'shown96v64', what: 'displayed 96 v 64, Pro', a: shown(96, 'A96:'), b: shown(64, 'B64:'), skill: PRO, def: 0 },
  { id: 'edge5', what: 'displayed edge +5 (80 v 75), Pro', a: shown(80, 'E80:'), b: shown(75, 'E75:'), skill: PRO, def: 0 },
  { id: 'edge10', what: 'displayed edge +10 (80 v 70), Pro', a: shown(80, 'E80:'), b: shown(70, 'E70:'), skill: PRO, def: 0 },
  { id: 'edge20', what: 'displayed edge +20 (80 v 60), Pro', a: shown(80, 'E80:'), b: shown(60, 'E60:'), skill: PRO, def: 0 },
];

interface Result {
  id: string;
  what: string;
  games: number;
  /** the fives' measured means (A, B): rating scale, displayed, team overall */
  fives: { a: [number, number, number]; b: [number, number, number] };
  team: Record<string, number>;
  opp: Record<string, number>;
  match: Record<string, number>;
}

const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v)]));

/** Per-player lines summed over games (for the sanity rows), by card id. */
type Career = Map<string, BoxLine & { games: number }>;
function fold(c: Career, lines: BoxLine[]) {
  for (const l of lines) {
    const had = c.get(l.id);
    if (!had) c.set(l.id, { ...l, games: 1 });
    else {
      for (const k of Object.keys(l) as (keyof BoxLine)[]) if (typeof l[k] === 'number') (had as unknown as Record<string, number>)[k] += l[k] as number;
      had.games++;
    }
  }
}

/** Teams' totals summed over games. */
function sumTeams(parts: BoxTeam[]): BoxTeam {
  const out = { ...parts[0] };
  for (const p of parts.slice(1)) for (const k of Object.keys(out) as (keyof BoxTeam)[]) out[k] += p[k];
  return out;
}

function runConfig(pool: Pool, c: Config, careers: Career | null): Result {
  const ta = newTally();
  const tb = newTally();
  const us: BoxTeam[] = [];
  const them: BoxTeam[] = [];
  const margins: number[] = [];
  let wins = 0;
  let ties = 0;
  const fa = [0, 0, 0];
  const fb = [0, 0, 0];
  for (let i = 0; i < GAMES; i++) {
    const A = c.a(pool, i);
    const B = c.b(pool, i);
    [A.raw, A.shown, A.team].forEach((x, k) => (fa[k] += x / GAMES));
    [B.raw, B.shown, B.team].forEach((x, k) => (fb[k] += x / GAMES));
    const box = new BoxTracker();
    const m = playMatch(A, B, (c.seed ?? c.id) + i, c.skill, c.def, { box, ta, tb });
    us.push(box.team('us'));
    them.push(box.team('them'));
    if (careers) {
      fold(careers, box.lines('us'));
      fold(careers, box.lines('them'));
    }
    const margin = m.us.g.score - m.them.g.score;
    margins.push(margin);
    if (margin > 0) wins++;
    else if (margin === 0) ties++;
  }
  const U = sumTeams(us);
  const T = sumTeams(them);
  const mean = margins.reduce((a, x) => a + x, 0) / GAMES;
  const sorted = margins.slice().sort((x, y) => x - y);
  return {
    id: c.id,
    what: c.what,
    games: GAMES,
    fives: { a: fa.map(r3) as [number, number, number], b: fb.map(r3) as [number, number, number] },
    team: round(summary(U, T, ta)),
    opp: round(summary(T, U, tb)),
    match: round({
      winPct: (wins + 0.5 * ties) / GAMES,
      ties: ties / GAMES,
      meanMargin: mean,
      marginSd: Math.sqrt(margins.reduce((a, x) => a + (x - mean) * (x - mean), 0) / GAMES),
      medianMargin: (sorted[(GAMES - 1) >> 1] + sorted[GAMES >> 1]) / 2,
    }),
  };
}

/** The era run: squads near 80 (raw), grouped by the median season of the starting five. */
function runEras(pool: Pool): Record<string, Record<string, number>> {
  const by = new Map<string, { tally: Tally; t: BoxTeam[]; d: BoxTeam[] }>();
  for (let i = 0; i < GAMES * 10; i++) {
    const A = squadRaw(pool, 80, 'era' + i);
    const B = squadRaw(pool, 80, 'eraopp' + (i % 12));
    const dec = Math.floor(A.season / 10) * 10;
    const key = (dec < 1980 ? 1960 : dec) + 's';
    let e = by.get(key);
    if (!e) by.set(key, (e = { tally: newTally(), t: [], d: [] }));
    const box = new BoxTracker();
    playSide(newHoopsGame(A.five, B.five, 'era' + i, POSSESSIONS, A.bench, 0), { skill: PRO, seed: 'era' + i, box, side: 'us', tally: e.tally });
    e.t.push(box.team('us'));
    e.d.push(box.team('them'));
  }
  const out: Record<string, Record<string, number>> = {};
  for (const [k, e] of [...by.entries()].sort()) out[k] = round(summary(sumTeams(e.t), sumTeams(e.d), e.tally));
  return out;
}

/** Derived era rows (targets §3.1b). */
function eraRows(eras: Record<string, Record<string, number>>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [d, s] of Object.entries(eras)) {
    m[`era.${d}.tpaRate`] = s.tpaRate;
    m[`era.${d}.ppp`] = s.ppp;
    m[`era.${d}.tov16`] = s.tov16;
    m[`era.${d}.orb16`] = s.orb16;
    m[`era.${d}.ftRate`] = s.ftaRate;
  }
  const g = (k: string) => m[k] ?? NaN;
  m['era.1960s.ftLead'] = g('era.1960s.ftRate') - g('era.2020s.ftRate');
  m['era.1980s.ftLead'] = g('era.1980s.ftRate') - g('era.2020s.ftRate');
  m['era.1980s.orbLead'] = g('era.1980s.orb16') - g('era.2020s.orb16');
  const others = Object.keys(eras).filter((d) => d !== '2020s');
  m['era.2020s.pppLead'] = g('era.2020s.ppp') - Math.max(...others.map((d) => g(`era.${d}.ppp`)));
  const decs = Object.keys(eras).sort();
  m['era.tpaStep'] = Math.min(...decs.slice(1).map((d, i) => g(`era.${d}.tpaRate`) - g(`era.${decs[i]}.tpaRate`)));
  m['era.pace80v00'] = (eras['1980s']?.secPerPoss ?? NaN) - (eras['2000s']?.secPerPoss ?? NaN);
  return m;
}

/** Print a section of targets against measured values. */
function table(title: string, section: string, values: Record<string, number>): string[] {
  const lines = [`\n${title}`, `${'target'.padEnd(64)} ${'measured'.padStart(9)}  band              real    baseline`];
  for (const row of TARGETS.filter((r) => r.section === section)) {
    const v = values[row.key];
    if (v === undefined) continue;
    const ok = Number.isFinite(v) ? (within(row, v) ? '  ' : '!!') : '--';
    const band = `${row.lo === -Infinity ? '' : row.lo}–${row.hi === Infinity ? '' : row.hi}`;
    lines.push(`${ok} ${row.label.slice(0, 61).padEnd(61)} ${String(r3(v)).padStart(9)}  ${band.padEnd(16)}  ${String(row.real ?? '').padEnd(6)}  ${row.baseline ?? ''}`);
  }
  return lines;
}

run('NBA calibration: AI v AI box scores against the targets', async () => {
  const pool = await getPool();
  const t0 = Date.now();
  const want = env.NBA_CAL_CONFIGS?.split(',').map((s) => s.trim());
  const configs = CONFIGS.filter((c) => (want ? want.includes(c.id) : true));
  const careers: Career = new Map();
  const results: Result[] = [];
  for (const c of configs) {
    const r = runConfig(pool, c, c.id === 'even78' ? careers : null);
    results.push(r);
    console.log(c.id, JSON.stringify({ fives: r.fives, match: r.match, team: r.team }));
  }
  const out: Record<string, unknown> = { games: GAMES, results };
  const report: string[] = [];
  const even = results.find((r) => r.id === 'even78');
  if (even) {
    // the per-player sanity rows, from every game's lines
    const lineOf = (id: string) => pool.byId.get(id);
    let bigThrees = 0;
    let bigGames = 0;
    let shM = 0;
    let shA = 0;
    let ftLo = 1;
    let ftHi = 0;
    for (const c of careers.values()) {
      const l = lineOf(c.id);
      if (!l) continue;
      const a3 = l.stats.a3 ?? 0;
      if ((l.pos[0] === 'C' || l.pos[0] === 'PF') && a3 < 1) {
        bigThrees += c.tpa;
        bigGames += c.games;
      }
      if ((l.stats.fg3 ?? 0) >= 0.4 && a3 >= 4) {
        shM += c.tpm;
        shA += c.tpa;
      }
      if (c.fta >= 10) {
        ftLo = Math.min(ftLo, c.ftm / c.fta);
        ftHi = Math.max(ftHi, c.ftm / c.fta);
      }
    }
    const values: Record<string, number> = {
      ...even.team,
      tiesOffFloor: even.match.ties,
      bigThreesPerGame: bigGames ? bigThrees / bigGames : NaN,
      shooter40TpPct: shA ? shM / shA : NaN,
      playerFtPct: ftHi > 0 ? ftLo : NaN,
    };
    out.sanity = round({ bigThreesPerGame: values.bigThreesPerGame, shooter40TpPct: values.shooter40TpPct, ftPctMin: ftLo, ftPctMax: ftHi });
    report.push(...table(`§3.1 even 78 Pro (${GAMES} games, fives ${even.fives.a.join('/')} v ${even.fives.b.join('/')} raw/shown/team)`, '3.1', values));
    if (ASSERT) for (const row of TARGETS.filter((x) => x.section === '3.1' && Number.isFinite(values[x.key] ?? NaN) && x.key !== 'transitionPpp')) expect.soft(values[row.key], row.label).toSatisfy((v: number) => within(row, v));
  }
  // the heavy-contest share and passes hold in every config
  for (const r of results) {
    for (const k of ['heavyShare', 'passesPerPoss'] as const) {
      const row = target(k);
      if (!within(row, r.team[k])) report.push(`!! ${r.id}: ${row.label} ${r.team[k]} (band ${row.lo}-${row.hi})`);
      if (ASSERT) expect.soft(r.team[k], `${r.id} ${k}`).toSatisfy((v: number) => within(row, v));
    }
  }
  // variance and squad strength (§3.5)
  const v: Record<string, number> = {};
  const res = (id: string) => results.find((r) => r.id === id);
  if (res('even78')) {
    v['even.marginSd'] = res('even78')!.match.marginSd;
    v['even.tiesBeforeOt'] = res('even78')!.match.ties;
  }
  for (const e of ['edge5', 'edge10', 'edge20']) if (res(e)) v[`${e}.win`] = res(e)!.match.winPct;
  if (res('shown96v64')) v['d96v64.medianMargin'] = res('shown96v64')!.match.medianMargin;
  report.push(...table('§3.5 variance and squad strength', '3.5', v));
  if (env.NBA_ERA) {
    const eras = runEras(pool);
    out.eras = eras;
    const rows = eraRows(eras);
    report.push(...table(`§3.1b eras (${GAMES * 10} squads near 80, grouped by the five's median season)`, '3.1b', rows));
    for (const [d, s] of Object.entries(eras)) report.push(`   ${d}: games ${s.games} ppp ${s.ppp} 3PA ${s.tpaRate} TOV/16 ${s.tov16} ORB/16 ${s.orb16} sec ${s.secPerPoss}`);
  }
  // THR_avg, re-measured from the cards (plan §3.3)
  const thr = thrAvg(pool);
  out.thrAvg = thr;
  report.push(`\nTHR_avg: engine ${thr.engine} (targets.ts ${THR_AVG_ENGINE}), UT ${thr.ut} (targets.ts ${THR_AVG_UT}), from ${thr.n} cards`);
  if (ASSERT) {
    expect(thr.engine).toBe(THR_AVG_ENGINE);
    expect(thr.ut).toBe(THR_AVG_UT);
  }
  out.ms = Date.now() - t0;
  await writeOut(OUT, JSON.stringify(out, null, 1));
  console.log(report.join('\n') + `\n\nJSON: ${OUT} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}, 3_600_000);
