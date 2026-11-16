// The studio overhaul's NBA targets as data (Claude 2026-11-10): every row of the team plan's §3
// (docs/studio-overhaul/nba-plan.md), with the real value where there is one, the accepted band,
// the baseline where one was measured (the audit's, or nba-1's for the V2 rows: §3.8 geometry,
// §3.9 performance, §3.10 flow), where the number comes from and the task that
// proves it. Test-only: the harnesses print their measurements against these rows, and nba-10's
// fit asserts them (NBA_CAL_ASSERT=1). The app never imports this file.

export interface Target {
  /** plan section, e.g. '3.1' */
  section: string;
  /** the metric's key (the calibration summary uses the same keys) */
  key: string;
  label: string;
  /** the real-world value, or null where there's none (a game-design number) */
  real: number | null;
  lo: number;
  hi: number;
  source: string;
  /**
   * Today's value before any overhaul change, when one was measured: the audit's (2026-11-09), or
   * nba-1's (2026-11-16; the V2 rows: §3.8 geometry and camera, §3.9 perf, §3.10 flow). Rows whose
   * thing doesn't exist yet (the pause button, the Heat bar, the gold ring, haptics, grades) have none.
   */
  baseline?: number;
  /** the band applies to (this metric − the metric named here), for era rows */
  relTo?: string;
  /** the task that asserts it */
  task: string;
}

const INF = Infinity;
const BR = 'Basketball-Reference 2024-25 per 100 (research §4.7, §5.14)';

/**
 * THR_avg (plan §3.3): the three-point rating a 2024-25 player who shot 36.0% on ≥ 3 attempts a
 * game gets, measured 2026-11-10 by `thrAvg()` (harness.ts) as the median over the 46 season cards
 * within ±1.0% of 36.0%. `ratings.ts` alone (the draft modes) gives 73; the UT card rating
 * (`ut/rate.ts` + calibration, what UT matches play with) gives 80. The §3.3 windows key off the
 * engine value; the 7-point gap is escalated in docs/studio-overhaul/nba.md.
 */
export const THR_AVG_ENGINE = 73;
export const THR_AVG_UT = 80;
export const THR_AVG = THR_AVG_ENGINE;
/** "Elite" (plan §3.3) */
export const THR_ELITE = 92;

const t = (section: string, task: string, rows: [key: string, label: string, real: number | null, lo: number, hi: number, source: string, extra?: Partial<Target>][]): Target[] =>
  rows.map(([key, label, real, lo, hi, source, extra]) => ({ section, key, label, real, lo, hi, source, task, ...extra }));

// §3.1: per 16 possessions, one side, even 78 Pro (AI v AI, Pro skill, Pro defense, modern era)
const BOX = t('3.1', 'nba-10', [
  ['ppp', 'Points a possession', 1.145, 1.08, 1.18, BR, { baseline: 1.28 }],
  ['fga16', 'FGA per 16', 14.4, 13.4, 15.4, BR],
  ['tpaRate', '3PA / FGA', 0.42, 0.35, 0.45, BR, { baseline: 0.327 }],
  ['ftaRate', 'FTA / FGA', 0.24, 0.18, 0.28, BR, { baseline: 0.019 }],
  ['tovPct', 'Turnovers a possession', 0.126, 0.11, 0.15, BR, { baseline: 0.066 }],
  ['stl16', 'Steals per 16', 1.31, 1.0, 1.5, BR],
  ['blk16', 'Blocks per 16', 0.78, 0.6, 1.0, BR],
  ['pf16', 'Personal fouls per 16', 2.98, 2.5, 3.5, BR, { baseline: 0 }],
  ['orbPct', 'Offensive-rebound rate', 0.25, 0.22, 0.29, BR, { baseline: 0.223 }],
  ['astRate', 'AST / FGM', 0.635, 0.55, 0.68, BR, { baseline: 0.84 }],
  ['fgPct', 'FG%', 0.467, 0.44, 0.5, BR, { baseline: 0.539 }],
  ['tpPct', '3P%', 0.36, 0.33, 0.39, BR, { baseline: 0.431 }],
  ['efg', 'eFG%', 0.543, 0.52, 0.57, BR, { baseline: 0.61 }],
  ['rimPct', 'Rim FG% (0-3 ft)', 0.696, 0.62, 0.72, 'Cleaning the Glass 2024-25 (research §5.14)', { baseline: 0.58 }],
  ['midPct', 'Mid-range FG%', 0.42, 0.38, 0.47, 'Cleaning the Glass 2024-25: 40-44% (research §5.14)', { baseline: 0.65 }],
  ['ftPct', 'FT%', 0.78, 0.74, 0.8, BR],
  ['mixRim', 'Shot mix: rim', 0.23, 0.2, 0.38, 'research §5.14 zone mix', { baseline: 0.27 }],
  ['mixClose', 'Shot mix: close (under 14 ft)', 0.3, 0.12, 0.25, 'research §5.14 zone mix', { baseline: 0.14 }],
  ['mixMid', 'Shot mix: mid-range', 0.05, 0.04, 0.12, 'research §5.14 zone mix', { baseline: 0.26 }],
  ['mixThree', 'Shot mix: three', 0.42, 0.35, 0.45, 'research §5.14 zone mix', { baseline: 0.33 }],
  ['heavyShare', 'Heavy + smothered share of jumpers (all configs)', null, 0, 0.45, 'plan §3.1', { baseline: 0.46 }],
  ['passesPerPoss', 'Passes a possession (incl. 90 v 75)', 3, 1.2, INF, 'NBA tracking ~3 (research)', { baseline: 1.31 }],
  ['secPerPoss', 'Seconds a possession (14 s clock)', null, 6.5, 9.5, 'plan §3.1', { baseline: 6.2 }],
  ['topUsageFgaShare', "Highest-usage card's share of FGA", 0.315, 0.25, 0.36, 'NBA star usage 28-35% (research §5.11)', { baseline: 0.15 }],
  ['topScorerShare', "Top scorer's share of team points", null, 0, 0.45, 'plan §3.1', { baseline: 0.62 }],
  ['scorers', 'Players who score, per game', null, 3.5, INF, 'plan §3.1', { baseline: 2.9 }],
  ['pgHoldShare', "PG slot's share of possession time", null, 0, 0.45, 'plan §3.1', { baseline: 0.74 }],
  ['cTpaShare', "C slot's share of team 3PA (unless his real 3PA ≥ 3/g)", null, 0, 0.1, 'plan §3.1'],
  ['transitionShare', 'Possessions in transition', 0.157, 0.12, 0.17, 'Synergy 2024-25 (research §5.6)', { baseline: 0 }],
  ['transitionPpp', 'Transition points a possession', 1.22, 1.15, 1.35, 'Synergy 2024-25 (research §5.6)'],
  ['tiesOffFloor', 'Ties decided off the floor (OT cap never hit in 10k sims)', 0, 0, 0, 'plan §3.1 (NBA-06)', { baseline: 0.07 }],
  // per-player sanity rows (research §5.11)
  ['bigThreesPerGame', 'Bigs with real 3PA < 1/g: threes a game', null, 0, 0.25, 'research §5.11'],
  ['shooter40TpPct', 'Shooters with real 3P% ≥ .40 on ≥ 4 3PA/g: their 3P%', null, 0.4, 0.45, 'research §5.11'],
  ['playerFtPct', "Every player's FT% stays within", null, 0.5, 0.93, 'research §5.11'],
]);

// §3.1b: eras, fives grouped by the median season of the starting five
const ERA_ROWS: [string, number, number, number, number, number, number, number, number][] = [
  // decade, 3PA/FGA lo-hi, PPP lo-hi, TOV/16 lo-hi, ORB/16 lo-hi (NaN: no row)
  ['1960s', 0, 0.05, 1.0, 1.1, 2.6, 3.2, 2.2, INF],
  ['1980s', 0, 0.12, 1.02, 1.12, 2.6, 3.0, NaN, NaN],
  ['1990s', 0.1, 0.25, 1.02, 1.12, 2.5, 2.9, NaN, NaN],
  ['2000s', 0.15, 0.28, 1.02, 1.12, 2.3, 2.7, NaN, NaN],
  ['2010s', 0.25, 0.38, 1.02, 1.12, 2.2, 2.6, NaN, NaN],
  ['2020s', 0.36, 0.46, 1.1, 1.18, 2.1, 2.5, 1.6, 2.0],
];
const ERA_SRC = 'research §4.6-4.7 era table (B-R estimates before 1974)';
const ERAS: Target[] = [
  ...ERA_ROWS.flatMap(([d, tl, th, pl, ph, vl, vh, ol, oh]) => {
    // (the 1960s row pools the 1960s and 1970s)
    const name = d === '1960s' ? '1960s-70s' : d;
    return t('3.1b', 'nba-10', [
      [`era.${d}.tpaRate`, `${name}: 3PA / FGA`, null, tl, th, ERA_SRC],
      [`era.${d}.ppp`, `${name}: points a possession`, null, pl, ph, ERA_SRC],
      [`era.${d}.tov16`, `${name}: turnovers per 16`, null, vl, vh, ERA_SRC],
      ...(Number.isNaN(ol) ? [] : ([[`era.${d}.orb16`, `${name}: offensive rebounds per 16`, null, ol, oh, ERA_SRC]] as [string, string, null, number, number, string][])),
    ]);
  }),
  ...t('3.1b', 'nba-10', [
    ['era.1960s.ftLead', '1960s-70s: FT/FGA, at least the 2020s + .04', null, 0.04, INF, ERA_SRC, { relTo: 'era.2020s.ftRate' }],
    ['era.1980s.orbLead', '1980s: ORB per 16, at least the 2020s + 0.2', null, 0.2, INF, ERA_SRC, { relTo: 'era.2020s.orb16' }],
    ['era.1980s.ftLead', '1980s: FT/FGA above the 2020s', null, 1e-9, INF, ERA_SRC, { relTo: 'era.2020s.ftRate' }],
    ['era.2020s.pppLead', '2020s: the highest-scoring decade by at least', null, 0.02, INF, ERA_SRC],
    ['era.tpaStep', '3PA/FGA by decade: smallest step (non-decreasing with 0.02 slack)', null, -0.02, INF, ERA_SRC],
    ['era.pace80v00', 'Seconds a possession, 1980s minus 2000s (the 80s faster)', null, -INF, -1e-9, ERA_SRC],
  ]),
];

// §3.2: the difficulty ladder, four rungs on one curve (median-human harness, defense played)
const LADDER = t('3.2', 'nba-10', [
  ['ladder.rookie.aiPpp', 'Rookie: AI offense PPP vs a median-human defender', null, -INF, 1.0, 'plan §3.2'],
  ['ladder.pro.aiPpp', 'Pro: AI offense PPP', null, 1.08, 1.18, 'plan §3.2'],
  ['ladder.allstar.aiPpp', 'All-Star: AI offense PPP', null, 1.12, 1.22, 'plan §3.2'],
  ['ladder.legend.aiPpp', 'Legend: AI offense PPP', null, 1.18, INF, 'plan §3.2'],
  ['ladder.rookie.humanPpp', 'Rookie: median-human offense PPP', null, 1.15, INF, 'plan §3.2', { baseline: 0.65 }],
  ['ladder.pro.humanPpp', 'Pro: median-human offense PPP', null, 1.05, 1.2, 'plan §3.2', { baseline: 0.65 }],
  ['ladder.allstar.humanPpp', 'All-Star: median-human offense PPP', null, 0.98, 1.12, 'plan §3.2'],
  ['ladder.legend.humanPpp', 'Legend: median-human offense PPP', null, 0.9, 1.05, 'plan §3.2'],
  ['ladder.rookie.humanWin', 'Rookie: median human wins', null, 0.6, 0.8, 'plan §3.2'],
  ['ladder.pro.humanWin', 'Pro: median human wins', null, 0.4, 0.6, 'plan §3.2'],
  ['ladder.allstar.humanWin', 'All-Star: median human wins', null, 0.3, 0.5, 'plan §3.2'],
  ['ladder.legend.humanWin', 'Legend: median human wins', null, 0.2, 0.4, 'plan §3.2'],
  ['ladder.rookie.aiTov', 'Rookie: AI turnover rate', 0.126, 0.11, 0.15, 'plan §3.2', { baseline: 0.056 }],
  ['ladder.pro.aiTov', 'Pro: AI turnover rate', 0.126, 0.11, 0.15, 'plan §3.2', { baseline: 0.066 }],
  ['ladder.allstar.aiTov', 'All-Star: AI turnover rate', 0.126, 0.11, 0.15, 'plan §3.2'],
  ['ladder.legend.aiTov', 'Legend: AI turnover rate', 0.126, 0.11, 0.15, 'plan §3.2', { baseline: 0.18 }],
  ['ladder.pro.honestTactics', 'Pro: every simple honest tactic, PPP at least', null, 0.8, INF, 'plan §3.2'],
  ['ladder.pro.stepback', 'Pro: the step-back exploit, PPP at most', null, -INF, 1.3, 'plan §3.2'],
  ['ladder.pro.driveStrip', 'Pro: straight drives ending in a strip', null, 0, 0.07, 'plan §3.2', { baseline: 0.1 }],
  ['ladder.legend.driveStrip', 'Legend: straight drives ending in a strip', null, 0, 0.1, 'plan §3.2', { baseline: 0.25 }],
  ['ladder.pro.autopilotGap', 'Pro: autopilot PPP minus the median human (same fives)', null, -INF, -0.05, 'research §5.3'],
  // the two curves the rungs sit on
  ['releaseSd.0.45', 'AI release spread at skill 0.45 (ms)', null, 90, 100, 'plan §3.2', { baseline: 84, task: 'nba-8' }],
  ['releaseSd.0.68', 'AI release spread at skill 0.68 (ms)', null, 53, 63, 'plan §3.2', { baseline: 65.6, task: 'nba-8' }],
  ['releaseSd.0.76', 'AI release spread at skill 0.76 (ms)', null, 45, 55, 'plan §3.2', { baseline: 59.2, task: 'nba-8' }],
  ['releaseSd.0.88', 'AI release spread at skill 0.88 (ms)', null, 39, 49, 'plan §3.2', { baseline: 49.6, task: 'nba-8' }],
  ['windowFactor.rookie', 'Your window under Rookie defense (×)', null, 1.25, 1.25, 'plan §3.2', { baseline: 1.08, task: 'nba-8' }],
  ['windowFactor.pro', 'Under Pro defense (×)', null, 1, 1, 'plan §3.2', { baseline: 1, task: 'nba-8' }],
  ['windowFactor.allstar', 'Under All-Star defense (×)', null, 0.9, 0.9, 'plan §3.2', { baseline: 0.92, task: 'nba-8' }],
  ['windowFactor.legend', 'Under Legend defense (×)', null, 0.8, 0.8, 'plan §3.2', { baseline: 0.84, task: 'nba-8' }],
]);

// §3.3: the gold ring for the jumper (V2 B.0.1, B.1.5). Half-widths in ms, open, catch-and-shoot,
// Pro, fresh. The baselines are today's green half-width for an open set shot (curve.test.ts).
const GOLD_SRC = 'plan §3.3 (V2 B.0.1, B.1.5)';
/** plan §3.3: gold half-width (ms) for a three-point rating, before any multiplier */
export const goldBase = (thr: number): number => 30 + 30 * Math.min(1, Math.max(0, (thr - 55) / 44)) + Math.min(5, 0.4 * Math.max(0, thr - 99));
/** plan §3.3: V2's multipliers, which meet only in `windowScale` (perfect.ts, nba-4) */
export const WINDOW_PARTS = { light: 0.75, rhythm: 1.2, fire: 1.25, meterOff: 1.1, pullup: 0.88, rookie: 1.25, pro: 1, allstar: 0.9, legend: 0.8 } as const;
export const GOLD_FLOOR_MS = 30;
export const WINDOW_CAP = { mult: 1.45, ms: 90 } as const;
const gold = (thr: number) => Math.round(goldBase(thr) * 10) / 10;
const SHOOTING = t('3.3', 'nba-4', [
  ['thrAvg.engine', 'THR_avg, ratings.ts (draft)', THR_AVG_ENGINE, 70, 76, 'measured 2026-11-10 (harness thrAvg)'],
  ['thrAvg.ut', 'THR_avg, UT card rating', THR_AVG_UT, 70, 76, 'measured 2026-11-10 (harness thrAvg): 7 over the engine, escalated', { task: 'packs + nba-4' }],
  // gold half-widths by THR (starting values, fitted in nba-4 and nba-10)
  ['gold.thr55.half', 'Gold ± at THR 55 (ms)', null, gold(55) - 1, gold(55) + 1, GOLD_SRC, { baseline: 6.6 }],
  ['gold.thrAvg.half', `Gold ± at THR_avg (${THR_AVG}) (ms)`, null, gold(THR_AVG) - 1, gold(THR_AVG) + 1, GOLD_SRC, { baseline: 16.1 }],
  ['gold.thr85.half', 'Gold ± at THR 85 (ms)', null, gold(85) - 1, gold(85) + 1, GOLD_SRC, { baseline: 25.1 }],
  ['gold.thr95.half', 'Gold ± at THR 95 (ms)', null, gold(95) - 1, gold(95) + 1, GOLD_SRC, { baseline: 34.1 }],
  ['gold.thr99.half', 'Gold ± at THR 99 (ms)', null, gold(99) - 1, gold(99) + 1, GOLD_SRC, { baseline: 36 }],
  ['gold.over99PerPoint', 'Gold ± per point above 99 (ms; at most +5)', null, 0.4, 0.4, GOLD_SRC],
  // the multipliers, all through windowScale
  ['window.light', 'Light contest (×)', null, WINDOW_PARTS.light, WINDOW_PARTS.light, GOLD_SRC, { baseline: 0.7 }],
  ['window.rhythm', 'Rhythm catch, shot within 0.4 s of the catch (×)', null, WINDOW_PARTS.rhythm, WINDOW_PARTS.rhythm, GOLD_SRC, { baseline: 1.16 }],
  ['window.fire', 'On Fire (×)', null, WINDOW_PARTS.fire, WINDOW_PARTS.fire, GOLD_SRC, { baseline: 1.2 }],
  ['window.meterOff', 'Meter Off (×)', null, WINDOW_PARTS.meterOff, WINDOW_PARTS.meterOff, GOLD_SRC],
  ['window.pullupScale', 'Pull-up (×)', null, WINDOW_PARTS.pullup, WINDOW_PARTS.pullup, GOLD_SRC],
  ['window.pullupLate', 'Pull-up window centre moved later (ms)', null, 10, 10, GOLD_SRC, { baseline: 0 }],
  ['window.fatigue60', 'Window centre later at 60% energy (ms)', null, 15, 15, GOLD_SRC, { baseline: 0 }],
  ['window.fatigue40', 'Window centre later at 40% energy (ms)', null, 25, 25, GOLD_SRC, { baseline: 0 }],
  ['window.fatigueShrink', 'Fatigue narrows the window to at least (×)', null, 0.85, 1, GOLD_SRC, { baseline: 0.85 }],
  ['window.capScale', 'The multipliers multiplied, at most (×)', null, -INF, WINDOW_CAP.mult, GOLD_SRC],
  ['window.capMs', 'Gold ± at most (ms)', null, -INF, WINDOW_CAP.ms, GOLD_SRC],
  ['window.floorMs', 'Gold ± at least, every difficulty and contest the gold state allows (ms; applied last)', null, GOLD_FLOOR_MS, INF, GOLD_SRC, { baseline: 3 }],
  ['window.worstStack', 'THR 99 + rhythm + On Fire + Off + Rookie: gold ± (ms)', null, 87, 90, GOLD_SRC],
  // states: gold never lies
  ['state.goldWorse', 'In-gold releases over 10,000 seeded tries worse than a make', 0, 0, 0, 'plan §4.4 (the honesty rule)'],
  ['state.redCap', 'Red state: make rate even when perfectly timed, at most', null, 0, 0.15, GOLD_SRC],
  ['range.thr85', 'In range (gold possible) to, THR ≥ 85 (ft)', null, 27.75, 27.75, GOLD_SRC],
  ['range.thr70', 'In range to, THR 70-84 (ft)', null, 25.75, 25.75, GOLD_SRC],
  ['range.thr60', 'In range to, THR 60-69 (ft; the arc, 22 in the corner)', null, 23.75, 23.75, GOLD_SRC],
  ['range.thrLow', 'In range to, THR under 60 (ft)', null, 16, 16, GOLD_SRC],
  ['range.redBeyond', 'Red beyond range by more than (ft)', null, 4, 4, GOLD_SRC],
  // the person's numbers (median σ 50, skilled σ 35; catch-and-shoot threes, Pro, fresh)
  ['goldRate.thr55.open.sd50', 'THR 55 open: gold rate at σ 50', null, 0.4, 0.5, GOLD_SRC, { baseline: 0.107 }],
  ['make.thr55.open.overGold', 'THR 55 open: make rate minus gold rate at σ 50, at most', null, 0, 0.08, GOLD_SRC, { relTo: 'goldRate.thr55.open.sd50', baseline: 0.316 }],
  ['goldRate.thrAvg.open.sd50', 'THR_avg open: gold rate at σ 50', null, 0.55, 0.65, GOLD_SRC, { baseline: 0.255 }],
  ['make.thrAvg.open.overGold', 'THR_avg open: make minus gold at σ 50, at most', null, 0, 0.08, GOLD_SRC, { relTo: 'goldRate.thrAvg.open.sd50', baseline: 0.362 }],
  ['make.thrAvg.open.sd35', 'THR_avg open: make rate at σ 35, at most', null, 0, 0.8, GOLD_SRC, { baseline: 0.735 }],
  ['goldRate.thr95.open.sd50', 'THR 95 open: gold rate at σ 50', null, 0.7, 0.8, GOLD_SRC, { baseline: 0.507 }],
  ['make.thr95.open.overGold', 'THR 95 open: make minus gold at σ 50, at most', null, 0, 0.06, GOLD_SRC, { relTo: 'goldRate.thr95.open.sd50', baseline: 0.313 }],
  ['make.thr95.open.sd35', 'THR 95 open: make rate at σ 35, at most', null, 0, 0.92, GOLD_SRC, { baseline: 0.914 }],
  ['goldRate.thrAvg.light.sd50', 'THR_avg light (not Legend): gold rate at σ 50', null, 0.42, 0.52, GOLD_SRC, { baseline: 0.178 }],
  ['make.thrAvg.light.overGold', 'THR_avg light: make minus gold at σ 50, at most', null, 0, 0.08, GOLD_SRC, { relTo: 'goldRate.thrAvg.light.sd50', baseline: 0.325 }],
  ['goldRate.thrAvg.heavy.sd50', 'THR_avg heavy (amber): gold rate', null, 0, 0, GOLD_SRC, { baseline: 0.099 }],
  ['make.thrAvg.heavy.sd50', 'THR_avg heavy: make rate at σ 50', null, 0.22, 0.3, GOLD_SRC, { baseline: 0.258 }],
  ['make.thrAvg.heavy.sd35', 'THR_avg heavy: make rate at σ 35, at most', null, 0, 0.34, GOLD_SRC, { baseline: 0.306 }],
  ['goldRate.thrAvg.smothered.sd50', 'Smothered (red): gold rate', null, 0, 0, GOLD_SRC, { baseline: 0.048 }],
  ['make.thrAvg.smothered.sd50', 'Smothered: make rate at σ 50, at most', null, 0, 0.15, GOLD_SRC, { baseline: 0.115 }],
  ['make.thrAvg.smothered.sd35', 'Smothered: make rate at σ 35, at most', null, 0, 0.15, GOLD_SRC, { baseline: 0.132 }],
  ['make.pullupRatio', 'Pull-up make rate ÷ catch-and-shoot, at most', 0.88, 0, 0.9, 'NBA.com 32.9 vs 37.4% (research §5.1.6)', { baseline: 0.966 }],
  ['ft.meterVsRating', 'FT band meter at σ 50 vs freeThrow(rating) (points)', null, -6, 6, GOLD_SRC, { task: 'nba-5' }],
  // timing and drawing
  ['release.precisionMs', 'A release between two 60 Hz steps lands within (ms)', null, 0, 1, GOLD_SRC, { baseline: 13.3 }],
  ['ring.goldPx320', 'Gold segment on screen at 320 wide (design px)', null, 8, INF, GOLD_SRC, { baseline: 4 }],
  ['ring.goldPx393', 'Gold segment on screen at 393 wide (design px)', null, 8, INF, GOLD_SRC, { baseline: 4 }],
  ['ring.arcRadius', 'Arc meter radius (× min(W, H))', null, 0.13, 0.13, GOLD_SRC, { baseline: 0.09 }],
]);
/** plan §3.3, row for row: the median human's gold rate and make rate are reported against these */
export const MAKE_TABLE = [
  { row: 'THR 55, open', thr: 55, contest: 'open', state: 'gold', goldRate: [0.4, 0.5], overGold: 0.08 },
  { row: 'THR_avg, open', thr: THR_AVG, contest: 'open', state: 'gold', goldRate: [0.55, 0.65], overGold: 0.08, ceil35: 0.8 },
  { row: 'THR 95, open', thr: 95, contest: 'open', state: 'gold', goldRate: [0.7, 0.8], overGold: 0.06, ceil35: 0.92 },
  { row: 'THR_avg, light (not Legend)', thr: THR_AVG, contest: 'light', state: 'gold', goldRate: [0.42, 0.52], overGold: 0.08 },
  { row: 'THR_avg, heavy', thr: THR_AVG, contest: 'heavy', state: 'amber', goldRate: [0, 0], make: [0.22, 0.3], ceil35: 0.34 },
  { row: 'any, smothered', thr: THR_AVG, contest: 'smothered', state: 'red', goldRate: [0, 0], make: [0, 0.15], ceil35: 0.15 },
] as const;

// §3.4: game format and length (median-human script, 1×, defense played, replays on)
const LENGTH = t('3.4', 'nba-6', [
  ['format.possessions', 'Solo game: possessions a side', null, 16, 16, 'plan §3.4'],
  ['format.quarter', 'Possessions a side per quarter', null, 4, 4, 'plan §3.4'],
  ['format.clutch', 'Clutch: the last possessions a side of Q4', null, 2, 2, 'plan §3.4'],
  ['format.otPeriod', 'Possessions a side per OT period (cap 10 periods)', null, 2, 2, 'plan §3.4'],
  ['time.livePossession', 'Live possession, median, both ends (s)', null, 7, 9, 'plan §3.4'],
  ['time.dead', 'Dead time between possessions (s)', null, 0, 1.2, 'plan §3.4'],
  ['time.freeThrow', 'Free-throw attempt (s; online auto-shoot after 4 s idle)', null, 0, 4, 'plan §3.4'],
  ['time.replay', 'A replay (s; ≤ 1 per quarter plus the Clutch replay, tap skips)', null, 0, 4, 'plan §3.4'],
  ['time.introHalftime', 'Tip-off curtain + halftime (s)', null, 0, 5, 'plan §3.4', { task: 'nba-9' }],
  ['time.simDefense', "A SIM'd defensive possession (s)", null, 0, 0.3, 'plan §3.4'],
  ['time.game', 'Whole solo game, median human, defense played (s; expected ≈ 330)', null, 240, 360, 'owner decision 3'],
]);

// §3.5: variance and squad strength
const VARIANCE = t('3.5', 'nba-10', [
  ['even.marginSd', 'Even game: final-margin SD (points)', null, 4, 6, 'research §4.5'],
  ['even.tiesBeforeOt', 'Even game: tied after regulation', 0.06, 0.04, 0.08, 'research §4.5'],
  ['even.leadChanges', 'Even game: lead changes', null, 1.5, INF, 'plan §3.5'],
  ['edge5.win', 'Displayed OVR +5: win probability', null, 0.6, 0.7, 'plan §3.5'],
  ['edge10.win', 'Displayed OVR +10: win probability', null, 0.75, 0.85, 'plan §3.5'],
  ['edge20.win', 'Displayed OVR +20: win probability', null, 0.9, 1, 'plan §3.5'],
  ['d96v64.medianMargin', 'Displayed 96 v 64: median margin at most', null, -INF, 20, 'ut-ui M3 (24-2 blowouts)'],
]);

// §3.6: defense must reward playing (owner decision 2), plus V2's CONTEST and STEAL rings
const DEFENSE = t('3.6', 'nba-7', [
  ['def.median', 'Median-human defender PPP conceded, minus Auto-defend', null, -INF, -0.03, 'plan §3.6'],
  ['def.poor', 'Poor defender PPP conceded, minus Auto-defend', null, -INF, 0.12, 'plan §3.6'],
  ['def.simVsAuto', 'Per-possession SIM PPP minus Auto-defend', null, -0.03, 0.03, 'plan §3.6', { task: 'nba-6' }],
  ['def.fullSimWin', 'Full-game SIM win % minus Auto-defend win % (300 games)', null, -0.05, 0.05, 'plan §3.6', { task: 'nba-6' }],
  ['def.contestGold', 'CONTEST ring: median human hits gold on AI jumpers from ≤ 4 ft', null, 0.35, 0.55, 'plan §3.6 (V2)'],
  ['def.contestPppDrop', 'CONTEST ring: AI PPP lowered vs idle-assist, at least', null, 0.06, INF, 'plan §3.6 (V2)'],
  ['def.stealInFlash', 'STEAL flash: strip rate for a tap inside it at σ 50 (no foul roll)', null, 0.3, 0.45, 'plan §3.6 (V2)'],
  ['def.stealOutside', 'STEAL outside the flash: strip rate, at most', null, 0, 0.08, 'plan §3.6 (V2)'],
  ['def.stealSpamFoul', 'STEAL repeated inside 1 s: foul rate', null, 0.25, 0.35, 'plan §3.6 (V2)'],
  ['def.cameraOverlap', 'Your defender over the AI handler: AI releases with ≤ 35% sprite overlap', null, 0.9, 1, 'plan §3.6', { task: 'nba-6' }],
  ['def.underControls', 'Your defender under a control rect (30 frames × 8 sizes)', null, 0, 0, 'plan §3.6', { task: 'nba-6' }],
]);

// §3.7: Heat (V2 B.0.2; replaces the two-stage per-player heat and the RUN factor). Per solo game,
// median human, Pro, even 78.
/** plan §3.7 and §4.5: Heat's published rules (NBA values; heat.ts builds them per sport) */
export const HEAT_RULES = { gain: { perfect: 12, score: 10, stop: 15, clean: 5, turnover: -20, conceded: -10 }, up: 66, fire: 100, spell: 2, windowMult: 1.25 } as const;
const HEAT_SRC = 'plan §3.7 (V2 B.0.2)';
const HEAT = t('3.7', 'nba-4', [
  ['heat.youHeating', 'You reach HEATING UP, share of games', null, 0.7, 0.95, HEAT_SRC],
  ['heat.youFire', 'You reach ON FIRE, share of games', null, 0.25, 0.55, HEAT_SRC],
  ['heat.aiHeating', 'AI reaches HEATING UP, share of games', null, 0.6, 0.9, HEAT_SRC, { task: 'nba-6' }],
  ['heat.aiFire', 'AI reaches ON FIRE, share of games', null, 0.15, 0.45, HEAT_SRC, { task: 'nba-6' }],
  ['heat.spells', 'On Fire spells per side per game (mean), at most', null, 0, 2, HEAT_SRC],
  ['heat.firePppGain', 'PPP on On Fire possessions minus that side\'s baseline, at most', null, -INF, 0.25, HEAT_SRC],
  ['foul.outsideState', 'Intentional fouls outside the qualifying state', null, 0, 0, 'plan §3.7', { task: 'nba-7' }],
  ['foul.firedInState', 'Intentional foul fired in qualifying states', null, 0.7, 1, 'plan §3.7', { task: 'nba-7' }],
]);

// §3.8: controls geometry (V2 A.5): exact rects on `.arcade-full` with injected insets, ±2 px at the
// two V2 sizes (393×852 at sat 59 / sab 34, 320×568 at 20 / 0). nba-geo.mjs prints today's against these.
type Circle = { d: number; cx: number; cy: number };
type Rect = { x: number; y: number; w: number; h: number };
export interface GeoSize {
  w: number;
  h: number;
  sat: number;
  sab: number;
  /** the right-thumb cluster and the stick's ghost ring (centre and diameter) */
  A: Circle;
  B: Circle;
  C: Circle;
  D: Circle;
  stick: Circle;
  /** where a thumb may spawn the floating stick */
  zone: { x0: number; x1: number; y0: number; y1: number };
  bug: Rect;
  pause: Rect;
  heat: Rect;
  /** the toast line's bottom edge and height */
  toast: { bottom: number; h: number };
  /** the action-safe box: the handler and the rim stay between these */
  safe: { y0: number; y1: number };
}
export const GEO: Record<'393' | '320', GeoSize> = {
  '393': {
    w: 393, h: 852, sat: 59, sab: 34,
    A: { d: 92, cx: 323, cy: 738 }, B: { d: 64, cx: 238, cy: 778 }, C: { d: 48, cx: 250, cy: 694 }, D: { d: 48, cx: 340, cy: 652 },
    stick: { d: 120, cx: 84, cy: 730 }, zone: { x0: 0, x1: 189, y0: 383, y1: 818 },
    bug: { x: 80, y: 65, w: 232, h: 40 }, pause: { x: 12, y: 63, w: 44, h: 44 }, heat: { x: 80, y: 108, w: 232, h: 6 },
    toast: { bottom: 618, h: 28 }, safe: { y0: 115, y1: 568 },
  },
  '320': {
    w: 320, h: 568, sat: 20, sab: 0,
    A: { d: 84, cx: 266, cy: 510 }, B: { d: 56, cx: 190, cy: 536 }, C: { d: 44, cx: 200, cy: 468 }, D: { d: 44, cx: 282, cy: 436 },
    stick: { d: 104, cx: 70, cy: 496 }, zone: { x0: 0, x1: 154, y0: 256, y1: 568 },
    bug: { x: 60, y: 24, w: 200, h: 34 }, pause: { x: 6, y: 20, w: 44, h: 44 }, heat: { x: 60, y: 60, w: 200, h: 5 },
    toast: { bottom: 404, h: 24 }, safe: { y0: 76, y1: 368 },
  },
};
/**
 * nba-1's measurement of today's controls on these rows (`nba-geo.mjs`, 2026-11-16, before nba-2):
 * A = SHOOT, B = PASS, C = the SCREEN/CUT/SPACE strip, D = the CROSS/STEP BACK/SPIN row, the stick =
 * the fixed stick (its zone is the ring only), the toast = the hint line. The pause button and the
 * Heat bar didn't exist (no row); the safe box is new.
 */
export const GEO_BASELINE: Record<string, number> = {
  // 393
  'geo.393.A.d': 100,
  'geo.393.A.cx': 329,
  'geo.393.A.cy': 756,
  'geo.393.B.d': 70,
  'geo.393.B.cx': 246,
  'geo.393.B.cy': 685,
  'geo.393.C.d': 44,
  'geo.393.C.cx': 121.5,
  'geo.393.C.cy': 190,
  'geo.393.D.d': 44,
  'geo.393.D.cx': 195.4,
  'geo.393.D.cy': 612,
  'geo.393.stick.d': 128,
  'geo.393.stick.cx': 78,
  'geo.393.stick.cy': 742,
  'geo.393.zone.x0': 14,
  'geo.393.zone.x1': 142,
  'geo.393.zone.y0': 678,
  'geo.393.zone.y1': 806,
  'geo.393.bug.x': 56.3,
  'geo.393.bug.y': 67,
  'geo.393.bug.w': 280.5,
  'geo.393.bug.h': 34,
  'geo.393.toast.bottom': 258,
  'geo.393.toast.h': 38,
  'geo.393.gap.AB': 24.2,
  'geo.393.gap.AC': 530.8,
  'geo.393.gap.AD': 124.4,
  'geo.393.minTarget': 44,
  'geo.393.rightTargets': 6,
  'geo.393.highestTarget': 0.197,
  'geo.393.overlaps': 0,
  // 320
  'geo.320.A.d': 100,
  'geo.320.A.cx': 256,
  'geo.320.A.cy': 506,
  'geo.320.B.d': 70,
  'geo.320.B.cx': 173,
  'geo.320.B.cy': 435,
  'geo.320.C.d': 44,
  'geo.320.C.cx': 91.9,
  'geo.320.C.cy': 151,
  'geo.320.D.d': 44,
  'geo.320.D.cx': 122.4,
  'geo.320.D.cy': 362,
  'geo.320.stick.d': 114.2,
  'geo.320.stick.cx': 71.1,
  'geo.320.stick.cy': 492,
  'geo.320.zone.x0': 14,
  'geo.320.zone.x1': 128.2,
  'geo.320.zone.y0': 428,
  'geo.320.zone.y1': 556,
  'geo.320.bug.x': 46,
  'geo.320.bug.y': 28,
  'geo.320.bug.w': 228,
  'geo.320.bug.h': 29,
  'geo.320.toast.bottom': 231,
  'geo.320.toast.h': 50,
  'geo.320.gap.AB': 24.2,
  'geo.320.gap.AC': 319.1,
  'geo.320.gap.AD': 124.4,
  'geo.320.minTarget': 44,
  'geo.320.rightTargets': 6,
  'geo.320.highestTarget': 0.227,
  'geo.320.overlaps': 0,
};

/** plan §3.8: the gap between two buttons' edges (A-B, A-C, A-D), at 393 / 320 */
export const GEO_GAPS = { AB: [16, 10], AC: [15, 14], AD: [18, 12] } as const;
export const GEO_TOL = 2;
const GEO_SRC = 'plan §3.8 (V2 A.5)';
const geoRows = (): Target[] => {
  const rows: [string, string, number | null, number, number, string, Partial<Target>?][] = [];
  const base = (k: string): Partial<Target> | undefined => (k in GEO_BASELINE ? { baseline: GEO_BASELINE[k] } : undefined);
  const px = (k: string, label: string, v: number) => rows.push([k, label, v, v - GEO_TOL, v + GEO_TOL, GEO_SRC, base(k)]);
  for (const [size, g] of Object.entries(GEO)) {
    const at = `${g.w}×${g.h}`;
    for (const el of ['A', 'B', 'C', 'D', 'stick'] as const) {
      const c = g[el];
      px(`geo.${size}.${el}.d`, `${at}: ${el} diameter (px)`, c.d);
      px(`geo.${size}.${el}.cx`, `${at}: ${el} centre x (px)`, c.cx);
      px(`geo.${size}.${el}.cy`, `${at}: ${el} centre y (px)`, c.cy);
    }
    for (const k of ['x0', 'x1', 'y0', 'y1'] as const) px(`geo.${size}.zone.${k}`, `${at}: stick zone ${k} (px)`, g.zone[k]);
    for (const el of ['bug', 'pause', 'heat'] as const) for (const k of ['x', 'y', 'w', 'h'] as const) px(`geo.${size}.${el}.${k}`, `${at}: ${el} ${k} (px)`, g[el][k]);
    px(`geo.${size}.toast.bottom`, `${at}: toast line bottom edge y (px)`, g.toast.bottom);
    px(`geo.${size}.toast.h`, `${at}: toast line height (px)`, g.toast.h);
    px(`geo.${size}.safe.y0`, `${at}: action-safe box top (px)`, g.safe.y0);
    px(`geo.${size}.safe.y1`, `${at}: action-safe box bottom (px)`, g.safe.y1);
    const i = size === '393' ? 0 : 1;
    for (const [pair, v] of Object.entries(GEO_GAPS)) rows.push([`geo.${size}.gap.${pair}`, `${at}: ${pair[0]}-${pair[1]} edge gap (px)`, v[i], 10, 18, GEO_SRC, base(`geo.${size}.gap.${pair}`)]);
    rows.push([`geo.${size}.minTarget`, `${at}: smallest tap target (px)`, null, 44, INF, GEO_SRC, base(`geo.${size}.minTarget`)]);
    rows.push([`geo.${size}.rightTargets`, `${at}: right-thumb targets, at most`, null, 0, 4, GEO_SRC, base(`geo.${size}.rightTargets`)]);
    rows.push([`geo.${size}.highestTarget`, `${at}: highest right-thumb target top, as a share of the height (none above 2/3 up)`, null, 1 / 3, 1, GEO_SRC, base(`geo.${size}.highestTarget`)]);
    rows.push([`geo.${size}.overlaps`, `${at}: overlapping controls`, null, 0, 0, GEO_SRC, base(`geo.${size}.overlaps`)]);
  }
  return t('3.8', 'nba-2', rows);
};
const HUD = [
  ...geoRows(),
  ...t('3.8', 'nba-3', [
    ['geo.otherSizes.overlaps', '430×932 and 375×667: overlaps, targets under 44 px, controls under the insets', null, 0, 0, GEO_SRC, { task: 'nba-2' }],
    ['geo.landscape.overlaps', 'Landscape (852×393, 932×430, 667×375, 568×320): overlaps or controls outside --sal/--sar', null, 0, 0, GEO_SRC, { task: 'nba-2' }],
    ['safe.handlerRim', 'Handler and rim inside the safe box, share of 300 offense frames (every size)', null, 0.98, 1, GEO_SRC, { baseline: 0.406 }],
    ['safe.defense', 'Your defender and the AI handler inside the safe box, share of defense frames', null, 0.98, 1, GEO_SRC, { task: 'nba-6' }],
    ['cam.rimY', 'Camera: rim centre, share of the viewport height', null, 0.2, 0.24, 'plan §3.8 (V2 B.1.3)', { baseline: 0.364 }],
    ['cam.handlerY', "Camera: handler's feet (median), share of the height", null, 0.5, 0.55, 'plan §3.8 (V2 B.1.3)', { baseline: 0.657 }],
    ['cam.overlap', 'On-ball defender overlap ≤ 35%, share of releases', null, 0.9, 1, 'plan §3.8 (V2 B.1.3)', { baseline: 0.5 }],
    ['cam.zoomVar', 'Zoom variation with the ball within 15 ft of the rim, at most', null, 0, 0.02, 'plan §3.8 (V2 B.1.3)', { baseline: 0.127 }],
    ['gesture.misclass', 'Gesture misclassification (200 jittered per class: tap, hold, four swipes)', null, 0, 0.02, 'plan §3.8', { task: 'nba-2' }],
    ['gesture.accidentalPass', 'Accidental passes from stick touches', null, 0, 0, 'plan §3.8', { task: 'nba-2' }],
    ['gesture.twoPointers', 'Stick + A held together: both tracked', null, 1, 1, 'plan §3.8', { task: 'nba-2' }],
    ['stick.responseFrames', 'Stick response after pointerdown (frames)', null, 0, 1, 'plan §3.8', { task: 'nba-2', baseline: 3 }],
    ['stick.preheldFt', 'Thumb resting 300 ms before the whistle: handler moved within 300 ms of it (ft)', null, 1.5, INF, 'plan §3.8 (NBA-12)', { task: 'nba-2', baseline: 0 }],
    ['stick.deadZone', 'Stick dead zone (× ring radius)', null, 0.12, 0.12, 'plan §4.2', { task: 'nba-2', baseline: 0 }],
    ['stick.sprintAt', 'Sprint past (× ring radius)', null, 1.15, 1.15, 'plan §3.8', { task: 'nba-2', baseline: 0.92 }],
    ['stick.followAt', 'Ring follows the thumb beyond (× ring radius)', null, 1.6, 1.6, 'plan §3.8', { task: 'nba-2' }],
    ['text.minPx', 'Every DOM text at 320 wide (px)', null, 10, INF, 'BUILD-RULES', { task: 'every task', baseline: 10 }],
    ['tags.duplicates', 'Duplicate on-court tags over 1,000 random UT squads (courts with one, of 500)', null, 0, 0, 'plan §3.8', { baseline: 76 }],
    ['font.glyphMisses', 'Name-chip glyph misses over every name in cards-nba.json (names with a hole)', null, 0, 0, 'plan §3.8', { baseline: 122 }],
  ]),
];

// §3.9: performance, bundle and test time
const PERF = t('3.9', 'nba-10', [
  // baselines: nba-1's nba-perf.mjs, the worst of 430×932 / 320×568 / 852×393 (each size's is in nba.md)
  ['perf.4x.medianFps', '4× CPU: median fps', null, 55, INF, 'plan §3.9', { baseline: 59.9 }],
  ['perf.4x.over20', '4× CPU: share of frames over 20 ms', null, 0, 0.05, 'plan §3.9', { baseline: 0.482 }],
  ['perf.1x.p99Ms', '1×: rAF callback p99 (ms; 430 / 320 / 852 wide: 13.0 / 9.8 / 9.9)', null, 0, 10, 'plan §3.9', { baseline: 13.0 }],
  ['bundle.gameKb', 'Game chunk growth, shared stick/ring/heat/HUD included (KB gzip)', null, -INF, 18, 'plan §3.9'],
  ['bundle.mainKb', 'Main / first-paint chunk growth (KB gzip)', null, -INF, 0, 'plan §3.9'],
  ['bundle.utKb', 'UT chunk growth (KB gzip; hud/grade.ts and hoops2/usage.ts only)', null, -INF, 2, 'plan §3.9'],
  ['tests.addedS', 'Always-on test time added to the NBA run (s)', null, 0, 60, 'plan §2'],
]);

// §3.10: flow, pause and the held arena (V2 D.1). Baselines: nba-rematch.mjs after the review fix (no
// captures inside a timed span), on the pre-overhaul code at 393×852: the median of 3 pre-game runs
// (6.24 / 6.45 / 6.97 s on a shared machine), one 2-game loop. Pause rows: nothing paused (no row).
const FLOW_SRC = 'plan §3.10 (V2 D.1)';
const FLOW = t('3.10', 'nba-3', [
  ['flow.pregameTaps', 'PLAY tap to the first controllable possession (taps)', null, 0, 2, FLOW_SRC, { task: 'nba-9', baseline: 3 }],
  ['flow.pregameS', 'PLAY tap to the first controllable possession (s)', null, 0, 3.5, FLOW_SRC, { task: 'nba-9', baseline: 6.45 }],
  ['flow.skipCurtainS', 'Skipping the curtain (s)', null, 0, 0.3, FLOW_SRC, { task: 'nba-9' }],
  ['pause.steps', 'Engine steps during a 10 s pause', null, 0, 0, FLOW_SRC, { task: 'nba-2' }],
  ['pause.timers', 'Timer callbacks during a 10 s pause', null, 0, 0, FLOW_SRC, { task: 'nba-2' }],
  ['pause.markDiff', 'Marks differing from the same scripted game unpaused', null, 0, 0, FLOW_SRC, { task: 'nba-2' }],
  ['pause.autoOnHide', 'Auto-pause on visibilitychange / pagehide', null, 1, 1, FLOW_SRC, { task: 'nba-2', baseline: 0 }],
  ['hold.whistleToFinishS', 'Held arena: final whistle to onFinish (s)', null, 0, 0.3, FLOW_SRC, { baseline: 1.6 }],
  ['hold.rematchToPlayS', 'rematch() to the first controllable frame, 4× CPU, curtain included (s)', null, 0, 1.5, FLOW_SRC, { baseline: 2.54 }],
  ['hold.newCanvases', 'New canvases or renderers made by a rematch', null, 0, 0, FLOW_SRC, { baseline: 1 }],
  ['hold.heapGrowth', 'JS heap after the 5th rematch vs after the 1st (×; baseline: game 2 vs 1)', null, 0, 1.1, FLOW_SRC, { baseline: 1.028 }],
  ['hold.loopS', 'Whole loop: whistle to the next tip-off, with ut\'s 5 s slam/tally (s)', null, 0, 10, FLOW_SRC, { baseline: 13.05 }],
]);

// §3.11: practice drills and Moments
const PRACTICE = t('3.11', 'nba-5', [
  ['practice.ftTrips', 'Practice: free-throw trips', null, 0, 0, 'plan §3.11'],
  ['practice.ot', 'Practice: OT periods', null, 0, 0, 'plan §3.11'],
  ['practice.alternation', 'Practice: defensive possessions', null, 0, 0, 'plan §3.11'],
  ['practice.pips', 'Practice: burst-pip limits applied', null, 0, 0, 'plan §3.11', { task: 'nba-7' }],
  ['moment.greenRoom', 'The Green Room (2 PERFECT in 5), median human completes', null, 0.35, 0.65, 'plan §3.11', { task: 'nba-10' }],
]);

// §3.12: online overtime and forfeit (two clients, relay 7795)
const ONLINE = t('3.12', 'nba-9', [
  ['online.mismatches', 'Mismatched results over 20 seeded two-client runs', null, 0, 0, 'plan §3.12'],
  ['online.maxEnds', 'Ends on the wire at most (16 + 2×10 OT + FF; arcadeOf caps at 40)', null, 0, 37, 'plan §3.12'],
]);

// §3.13: feel (V2 B.0.5). The patterns are ut's `src/lib/haptics.ts` (feel.ts shims them until it lands).
export type HapticPattern = 'tick' | 'double' | 'long' | 'heartbeat';
/** plan §3.13: which pattern each event fires (tested with a spy) */
export const HAPTIC_FOR: Record<string, HapticPattern> = {
  sprintEdge: 'tick',
  callPick: 'tick',
  stealTap: 'tick',
  perfectRelease: 'double',
  perfectFinish: 'double',
  perfectBoard: 'double',
  perfectContest: 'double',
  perfectSteal: 'double',
  ankleBreaker: 'double',
  score: 'long',
  block: 'long',
  turnoverAgainst: 'long',
  clutchOneScore: 'heartbeat',
};
const FEEL_SRC = 'plan §3.13 (V2 B.0.5)';
const FEEL = t('3.13', 'nba-4', [
  ['haptic.wrongPattern', 'Events firing the wrong pattern (spy)', null, 0, 0, FEEL_SRC],
  ['haptic.heartbeatPerPoss', 'Clutch heartbeat per possession, at most (one-score margin)', null, 0, 1, FEEL_SRC, { task: 'nba-6' }],
  ['audio.chimeStepSemis', 'PERFECT chime: semitones up per consecutive PERFECT', null, 1, 1, FEEL_SRC],
  ['audio.chimeSteps', 'PERFECT chime: steps at most', null, 0, 5, FEEL_SRC],
  ['audio.ringTickMs', 'Ring-fill tick: the last (ms)', null, 200, 200, FEEL_SRC],
  ['audio.clockTickUnderS', 'Shot-clock tick each second under (s)', null, 4, 4, FEEL_SRC, { task: 'nba-3' }],
  ['juice.hitStopMs', 'Hit-stop length (ms)', null, 33, 120, FEEL_SRC],
  ['juice.hitStopPerS', 'Hit-stop per second, at most (ms)', null, 0, 150, FEEL_SRC],
  ['juice.dunkMs', 'Hit-stop: dunk rim contact (ms)', null, 70, 70, FEEL_SRC],
  ['juice.blockMs', 'Hit-stop: block (ms)', null, 60, 60, FEEL_SRC],
  ['juice.perfectFrames', 'Hit-stop: PERFECT release (frames)', null, 1, 1, FEEL_SRC],
  ['juice.slowmoPerScore', 'Slow-motion beats per score, at most', null, 0, 1, FEEL_SRC],
]);

// §3.14: the match grade (V2 B.0.3), on `Progress.grade`; ut reads it, coin pay never changes
/** plan §3.14: the par (offense points per possession) for each rung, and online */
export const GRADE_PAR = { rookie: 1.2, pro: 1.1, allstar: 1.05, legend: 0.97, online: 1.1 } as const;
/** plan §3.14: S at ≥ 1.25 × par, A at ≥ 1.10 ×, B at ≥ 0.90 ×, otherwise C */
export const GRADE_AT = { S: 1.25, A: 1.1, B: 0.9 } as const;
const GRADE_SRC = 'plan §3.14 (V2 B.0.3)';
const GRADE = t('3.14', 'nba-4', [
  ['grade.S', 'Median human at Pro over 300 games: S', null, 0.05, 0.15, GRADE_SRC],
  ['grade.A', 'Median human at Pro: A', null, 0.2, 0.35, GRADE_SRC],
  ['grade.B', 'Median human at Pro: B', null, 0.3, 0.45, GRADE_SRC],
  ['grade.C', 'Median human at Pro: C', null, 0.15, 0.35, GRADE_SRC],
]);

export const TARGETS: Target[] = [...BOX, ...ERAS, ...LADDER, ...SHOOTING, ...LENGTH, ...VARIANCE, ...DEFENSE, ...HEAT, ...HUD, ...PERF, ...FLOW, ...PRACTICE, ...ONLINE, ...FEEL, ...GRADE];

export const target = (key: string): Target => {
  const r = TARGETS.find((x) => x.key === key);
  if (!r) throw Error('no target ' + key);
  return r;
};

/** Is `v` inside the row's band? */
export const within = (row: Target, v: number): boolean => v >= row.lo - 1e-9 && v <= row.hi + 1e-9;

/** The plan's letter for a points-per-possession line against a par (plan §3.14). */
export const gradeOf = (ppu: number, par: number): 'S' | 'A' | 'B' | 'C' => (ppu >= GRADE_AT.S * par ? 'S' : ppu >= GRADE_AT.A * par ? 'A' : ppu >= GRADE_AT.B * par ? 'B' : 'C');
