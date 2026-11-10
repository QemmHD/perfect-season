// The studio overhaul's NBA targets as data (Claude 2026-11-10): every row of the team plan's §3
// (docs/studio-overhaul/nba-plan.md), with the real value where there is one, the accepted band,
// the audit's baseline where it measured one, where the number comes from and the task that
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
  /** what the audit (2026-11-09) measured, when it did */
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

// §3.3: shooting (full-width windows in ms, Pro, fresh, catch-and-shoot)
const SHOOT_SRC = 'research §5.1.2 / §5.1.6, plan §3.3';
const SHOOTING = t('3.3', 'nba-4', [
  ['thrAvg.engine', 'THR_avg, ratings.ts (draft)', THR_AVG_ENGINE, 70, 76, 'measured 2026-11-10 (harness thrAvg)'],
  ['thrAvg.ut', 'THR_avg, UT card rating', THR_AVG_UT, 70, 76, 'measured 2026-11-10 (harness thrAvg): 7 over the engine, escalated', { task: 'packs + nba-4' }],
  ['window.thr55.open', 'THR 55 open green (ms)', null, 20, 25, SHOOT_SRC],
  ['window.thrAvg.open', 'THR_avg open green (ms)', null, 44, 50, SHOOT_SRC],
  ['window.thr75.open', 'THR 75 open green (ms)', null, 45, 55, SHOOT_SRC],
  ['window.thr85.heavy', 'THR 85 heavy sweet spot (ms)', null, 25, 30, SHOOT_SRC],
  ['window.thr85.smothered', 'THR 85 smothered sweet spot (ms)', null, 10, 12, SHOOT_SRC],
  ['window.thr95.open', 'THR 95+ open green (ms; rhythm catch ≤ 95)', null, 70, 85, SHOOT_SRC],
  ['window.light', 'Light contest window (× open)', null, 0.75, 0.75, SHOOT_SRC, { baseline: 0.7 }],
  ['window.heavy', 'Heavy contest window (× open, amber)', null, 0.42, 0.42, SHOOT_SRC, { baseline: 0.4 }],
  ['window.smothered', 'Smothered contest window (× open, amber)', null, 0.17, 0.17, SHOOT_SRC, { baseline: 0.15 }],
  ['window.floorOpen', 'Open and light window floor, every difficulty (ms)', null, 20, INF, 'plan §3.3'],
  ['window.floorContested', 'Heavy and smothered floor (ms)', null, 8, INF, 'plan §3.3'],
  ['window.pullupScale', 'Pull-up / moving / fade window (×)', null, 0.88, 0.88, 'plan §3.3'],
  ['window.pullupLate', 'Pull-up window moved later (ms)', null, 10, 10, 'plan §3.3'],
  ['window.fatigue60', 'Window later at 60% energy (ms)', null, 15, 15, 'research §5.7'],
  ['window.fatigue40', 'Window later at 40% energy (ms)', null, 25, 25, 'research §5.7'],
  ['window.fatigueShrink', 'Fatigue shrink at most (×)', null, 0.85, 1, 'research §5.7'],
  ['window.capScale', 'Combined window multipliers at most (×)', null, -INF, 1.45, 'plan §3.3'],
  ['window.capMs', 'Absolute full green at most (ms)', null, -INF, 110, 'plan §3.3'],
  ['make.avg.open.sd50', 'THR_avg open three, σ 50 ms', 0.391, 0.38, 0.41, 'NBA.com 2024-25 wide open 39.1% (research §5.1.6)'],
  ['make.avg.light.sd50', 'THR_avg light, σ 50', 0.35, 0.33, 0.36, 'NBA.com open 35.0%'],
  ['make.avg.heavy.sd50', 'THR_avg heavy, σ 50', 0.297, 0.25, 0.29, 'NBA.com tight 29.7%'],
  ['make.avg.smothered.sd50', 'THR_avg smothered, σ 50', 0.271, 0.15, 0.22, 'NBA.com very tight 27.1%'],
  ['make.elite.open.sd50', 'Elite (THR 95) open three, σ 50', 0.5, 0.5, 0.56, 'research §5.1.6 48-52% (accepted divergence)'],
  ['make.avg.open.sd35', 'THR_avg open, σ 35 (ceiling)', null, -INF, 0.55, 'plan §3.3'],
  ['make.avg.light.sd35', 'THR_avg light, σ 35 (ceiling)', null, -INF, 0.46, 'plan §3.3'],
  ['make.avg.heavy.sd35', 'THR_avg heavy, σ 35', null, 0.25, 0.31, 'plan §3.3'],
  ['make.avg.smothered.sd35', 'THR_avg smothered, σ 35', null, 0.15, 0.24, 'plan §3.3'],
  ['make.pullupRatio', 'Pull-up make rate, × the catch-and-shoot rate', 0.88, -INF, 0.9, 'NBA.com 32.9 vs 37.4%'],
  ['make.avg.openMid.sd50', 'THR_avg open mid-range, σ 50', null, 0.4, 0.46, 'plan §3.3'],
  ['ft.meterVsRating', 'FT meter at σ 50 vs freeThrow(rating), points', null, -6, 6, 'plan §3.3'],
  ['release.precisionMs', 'A release between two 60 Hz steps lands within (ms)', null, 0, 1, 'plan §3.3', { baseline: 16.7 }],
  ['meter.radius', 'Meter radius (× min(W, H))', null, 0.13, 0.13, 'plan §3.3', { baseline: 0.09 }],
  ['meter.thr75GreenPx', 'THR-75 open green width at 390 px (px)', null, 8, INF, 'plan §3.3', { baseline: 4 }],
]);

// §3.4: game format and length (median-human script, 1×, defense played, replays on)
const LENGTH = t('3.4', 'nba-6', [
  ['format.possessions', 'Solo game: possessions a side', null, 16, 16, 'plan §3.4'],
  ['format.quarter', 'Possessions a side per quarter', null, 4, 4, 'plan §3.4'],
  ['format.otPeriod', 'Possessions a side per OT period', null, 2, 2, 'plan §3.4'],
  ['time.livePossession', 'Live possession, median, both ends (s)', null, 7, 9, 'plan §3.4'],
  ['time.dead', 'Dead time between possessions (s)', null, 0, 1.2, 'plan §3.4'],
  ['time.freeThrow', 'Free-throw attempt (s; online auto-shoot after 4 s idle)', null, 0, 4, 'plan §3.4'],
  ['time.cardPick', 'Card or look pick, median (s; auto-pick at 2.5 s)', null, 0, 1, 'plan §3.4', { task: 'nba-10' }],
  ['time.replay', 'A replay (s; ≤ 1 per quarter, tap skips)', null, 0, 4, 'plan §3.4'],
  ['time.introHalftime', 'Tip-off intro + halftime (s)', null, 0, 5, 'plan §3.4', { task: 'nba-9' }],
  ['time.simDefense', "A SIM'd defensive possession (s)", null, 0, 0.3, 'plan §3.4'],
  ['time.game', 'Whole solo game (s)', null, 240, 360, 'owner decision 3'],
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

// §3.6: defense must reward playing (owner decision 2)
const DEFENSE = t('3.6', 'nba-7', [
  ['def.median', 'Median-human defender PPP conceded, minus Auto-defend', null, -INF, -0.03, 'plan §3.6'],
  ['def.poor', 'Poor defender PPP conceded, minus Auto-defend', null, -INF, 0.12, 'plan §3.6'],
  ['def.simVsAuto', 'Per-possession SIM PPP minus Auto-defend', null, -0.03, 0.03, 'plan §3.6', { task: 'nba-6' }],
  ['def.fullSimWin', 'Full-game SIM win % minus Auto-defend win % (300 games)', null, -0.05, 0.05, 'plan §3.6', { task: 'nba-6' }],
  ['def.cameraOverlap', 'Your defender over the AI handler: AI releases with ≤ 35% sprite overlap', null, 0.9, 1, 'plan §3.6', { task: 'nba-6' }],
  ['def.underControls', 'Your defender under a control rect (30 frames × 8 sizes)', null, 0, 0, 'plan §3.6', { task: 'nba-6' }],
]);

// §3.7: heat, runs and late-game fouls
const HEAT = t('3.7', 'nba-6', [
  ['heat.stage1Games', 'Hot Hand (stage 1) reached, share of games', null, 0.5, 0.8, 'plan §3.7', { task: 'nba-4' }],
  ['heat.stage2Games', 'Locked In (stage 2) reached, share of games', null, 0.15, 0.35, 'plan §3.7', { task: 'nba-4' }],
  ['run.perGame', 'RUN banners per alternate game', null, 0.8, 2.0, 'plan §3.7'],
  ['foul.outsideState', 'Intentional fouls outside the qualifying state', null, 0, 0, 'plan §3.7', { task: 'nba-7' }],
  ['foul.firedInState', 'Intentional foul fired in qualifying states', null, 0.7, 1, 'plan §3.7', { task: 'nba-7' }],
]);

// §3.8: controls, HUD and text (8 sizes, injected insets)
const HUD = t('3.8', 'nba-3', [
  ['gesture.misclass', 'Gesture misclassification (200 jittered per class)', null, 0, 0.02, 'plan §3.8'],
  ['gesture.accidentalPass', 'Accidental passes from stick touches', null, 0, 0, 'plan §3.8'],
  ['stick.responseFrames', 'Stick response after pointerdown (frames)', null, 0, 1, 'plan §3.8'],
  ['stick.homeBandPx', 'Stick never spawns in the bottom band (px above sab)', null, 12, 12, 'plan §3.8'],
  ['hud.393.topPx', '393×852: top HUD at most (px below sat)', null, 0, 96, 'plan §3.8', { task: 'nba-2' }],
  ['hud.393.bottomPx', '393×852: bottom controls at most (px above sab)', null, 0, 190, 'plan §3.8'],
  ['hud.393.court59', '393×852: court share at sat 59', null, 0.55, 1, 'plan §3.8', { baseline: 0.45 }],
  ['hud.393.court81', '393×852: court share at sat 81 (shell Fix A)', null, 0.52, 1, 'plan §3.8'],
  ['hud.320.topPx', '320×568: top HUD at most (px below sat)', null, 0, 84, 'plan §3.8', { task: 'nba-2' }],
  ['hud.320.bottomPx', '320×568: bottom controls at most (px above sab)', null, 0, 170, 'plan §3.8'],
  ['hud.320.court', '320×568: court share', null, 0.5, 1, 'plan §3.8'],
  ['size.320.shoot', '320 wide: SHOOT (px)', null, 84, 84, 'plan §3.8'],
  ['size.320.pass', '320 wide: PASS (px)', null, 56, 56, 'plan §3.8'],
  ['size.320.stickR', '320 wide: stick base radius (px)', null, 48, 48, 'plan §3.8'],
  ['text.minPx', 'Every new DOM text at 320 wide (px)', null, 10, INF, 'BUILD-RULES', { task: 'every task' }],
  ['tags.duplicates', 'Duplicate on-court tags over 1,000 random UT squads', null, 0, 0, 'plan §3.8', { task: 'nba-2' }],
  ['font.glyphMisses', 'Pixel-font glyph misses (F35)', null, 0, 0, 'plan §3.8', { task: 'nba-2' }],
]);

// §3.9: performance, bundle and test time
const PERF = t('3.9', 'nba-10', [
  ['perf.4x.medianFps', '4× CPU: median fps', null, 55, INF, 'plan §3.9'],
  ['perf.4x.over20', '4× CPU: share of frames over 20 ms', null, 0, 0.05, 'plan §3.9'],
  ['perf.1x.p99Ms', '1×: rAF callback p99 (ms)', null, 0, 10, 'plan §3.9', { baseline: 8.9 }],
  ['bundle.gameKb', 'Game chunk growth (KB gzip)', null, -INF, 15, 'plan §3.9'],
  ['bundle.mainKb', 'Main / first-paint chunk growth (KB gzip)', null, -INF, 0, 'plan §3.9'],
  ['bundle.utKb', 'UT chunk growth (KB gzip)', null, -INF, 2, 'plan §3.9'],
  ['tests.addedS', 'Always-on test time added to the NBA run (s)', null, 0, 60, 'plan §2'],
]);

// §3.10: flow and pause
const FLOW = t('3.10', 'nba-9', [
  ['flow.pregameTaps', 'PLAY tap to the first controllable possession (taps)', null, 0, 2, 'plan §3.10'],
  ['flow.pregameS', 'PLAY tap to the first controllable possession (s)', null, 0, 3.5, 'plan §3.10'],
  ['flow.skipIntroS', 'Skipping the intro (s)', null, 0, 0.3, 'plan §3.10'],
  ['pause.steps', 'Engine steps during a 10 s pause', null, 0, 0, 'plan §3.10'],
  ['pause.timers', 'Timer callbacks during a 10 s pause', null, 0, 0, 'plan §3.10'],
  ['pause.markDiff', 'Marks differing from the same run unpaused', null, 0, 0, 'plan §3.10'],
]);

// §3.11: practice drills and Moments
const PRACTICE = t('3.11', 'nba-5', [
  ['practice.ftTrips', 'Practice: free-throw trips', null, 0, 0, 'plan §3.11'],
  ['practice.ot', 'Practice: OT periods', null, 0, 0, 'plan §3.11'],
  ['practice.alternation', 'Practice: defensive possessions', null, 0, 0, 'plan §3.11'],
  ['practice.cards', 'Practice: card picks', null, 0, 0, 'plan §3.11'],
  ['moment.greenRoom', 'The Green Room (2 PURE in 5), median human completes', null, 0.35, 0.65, 'plan §3.11', { task: 'nba-10' }],
]);

// §3.12: online overtime and forfeit (two clients, relay 7795)
const ONLINE = t('3.12', 'nba-9', [
  ['online.mismatches', 'Mismatched results over 20 seeded two-client runs', null, 0, 0, 'plan §3.12'],
  ['online.maxEnds', 'Ends on the wire at most (16 + 2×10 OT + FF; arcadeOf caps at 40)', null, 0, 37, 'plan §3.12'],
]);

// §3.13: haptics (owner's phone)
const HAPTICS = t('3.13', 'nba-3', [
  ['haptic.greenTicks', 'iOS: a green is this many ticks', null, 2, 2, 'plan §3.13'],
  ['haptic.greenGapMs', 'iOS: between the green ticks (ms)', null, 50, 70, 'plan §3.13'],
  ['haptic.makeTicks', 'iOS: a make is this many ticks', null, 1, 1, 'plan §3.13'],
]);

export const TARGETS: Target[] = [...BOX, ...ERAS, ...LADDER, ...SHOOTING, ...LENGTH, ...VARIANCE, ...DEFENSE, ...HEAT, ...HUD, ...PERF, ...FLOW, ...PRACTICE, ...ONLINE, ...HAPTICS];

export const target = (key: string): Target => {
  const r = TARGETS.find((x) => x.key === key);
  if (!r) throw Error('no target ' + key);
  return r;
};

/** Is `v` inside the row's band? */
export const within = (row: Target, v: number): boolean => v >= row.lo - 1e-9 && v <= row.hi + 1e-9;
