// The calibration kit itself (always on, synthetic teams), and the real-card calibration bands
// (opt-in: CAL=1 PS_SPORT=nfl npx vitest run src/game/football2/calibration.test.ts; CAL_GAMES sets
// the games per case, 400 by default, the full calibration's size).
import { describe, expect, it } from 'vitest';
import { AUTO_PACE, type Band, fixtureTeams, HUMAN_PACE, HUMAN_SKILL, LEVELS, meanBand, newAcc, type PilotMode, playGame, playWall, quantileBand, runCase, summarize, synthTeams, TIERS, wallClock, wilson } from './sim-kit';
import * as pacing from './pacing';
import { REPLAY_AFTER, REPLAY_BEFORE, REPLAY_SPEED } from '../replay';

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};

const inside = (b: Band) => b.n > 0 && b.lo <= b.v && b.v <= b.hi;

describe('calibration kit', () => {
  it('plays the same game from the same seed, and a different one from another', () => {
    const a = playGame(synthTeams(0.6), { kind: 'ai', ...LEVELS.pro }, 'same');
    const b = playGame(synthTeams(0.6), { kind: 'ai', ...LEVELS.pro }, 'same');
    const c = playGame(synthTeams(0.6), { kind: 'ai', ...LEVELS.pro }, 'other');
    expect(b).toEqual(a);
    expect(JSON.stringify(c.plays)).not.toEqual(JSON.stringify(a.plays));
  });

  it('summarizes 40 synthetic games into sane bands, each with its sample size and interval', () => {
    const acc = newAcc();
    for (let i = 0; i < 40; i++) playGame(synthTeams(0.6), { kind: 'ai', ...LEVELS.pro }, 'sanity:' + i, acc);
    const s = summarize(acc);
    expect(s.games).toBe(40);
    expect(s.drives).toBe(160);
    for (const b of [s.ptsPerDrive, s.completion, s.intRate, s.sackRate, s.yac, s.runs.ypc, s.runs.median, s.third.all, s.passShare, s.driveEnds.TD, s.scores.tie]) expect(inside(b), JSON.stringify(b)).toBe(true);
    expect(s.completion.v).toBeGreaterThan(0.45);
    expect(s.completion.v).toBeLessThan(0.9);
    expect(s.runs.ypc.v).toBeGreaterThan(1.5);
    expect(s.runs.ypc.v).toBeLessThan(7);
    expect(s.ptsPerDrive.v).toBeGreaterThan(0.3);
    expect(s.ptsPerDrive.v).toBeLessThan(6);
    expect(s.sackRate.v).toBeLessThan(0.2);
    // every drive ended one way or another, and the score shares add up
    const ends = Object.values(s.driveEnds).reduce((n, b) => n + b.v * b.n, 0);
    expect(Math.round(ends)).toBe(160);
    const targets = Object.values(s.targets).reduce((n, b) => n + b.v, 0);
    expect(targets).toBeGreaterThan(0.95);
  });

  it('computes Wilson, mean and quantile intervals by their formulas', () => {
    const w = wilson(5, 10);
    expect(w.v).toBe(0.5);
    expect(w.lo).toBeCloseTo(0.2366, 3);
    expect(w.hi).toBeCloseTo(0.7634, 3);
    expect(wilson(0, 400).hi).toBeCloseTo(0.0095, 3);
    const m = meanBand([1, 2, 3, 4, 5]);
    expect(m.v).toBe(3);
    expect(m.hi - m.v).toBeCloseTo((1.96 * Math.sqrt(2.5)) / Math.sqrt(5), 2);
    const q = quantileBand(Array.from({ length: 101 }, (_, i) => i), 0.5);
    expect(q.v).toBe(50);
    expect(q.lo).toBeLessThan(50);
    expect(q.hi).toBeGreaterThan(50);
  });

  it('adds up a game on the screen from the pacing constants', () => {
    const snap = { kind: 'snap' as const, secs: 4, after: 'play' as const, trucks: 0, replay: null, last: false };
    expect(playWall(snap, AUTO_PACE)).toBeCloseTo(pacing.AUTO_PICK + 4 + pacing.WHISTLE_TO_TRAY.play);
    expect(playWall({ ...snap, after: 'score', replay: 'long-td' }, HUMAN_PACE)).toBeCloseTo(
      pacing.HUMAN_PICK + 4 + pacing.REPLAY_LEAD.score + (pacing.LONG_TD_REPLAY.before + REPLAY_AFTER) / REPLAY_SPEED + pacing.REPLAY_TAIL
    );
    expect(playWall({ ...snap, replay: 'moment' }, HUMAN_PACE)).toBeCloseTo(pacing.HUMAN_PICK + 4 + pacing.REPLAY_LEAD.play + (REPLAY_BEFORE + REPLAY_AFTER) / REPLAY_SPEED + pacing.REPLAY_TAIL);
    // no replay without motion, or on the game's last play
    expect(playWall({ ...snap, replay: 'moment' }, AUTO_PACE)).toBeCloseTo(pacing.AUTO_PICK + 4 + pacing.WHISTLE_TO_TRAY.play);
    expect(playWall({ ...snap, replay: 'moment', last: true, after: 'drive' }, HUMAN_PACE)).toBeCloseTo(pacing.HUMAN_PICK + 4 + pacing.WHISTLE_TO_TRAY.drive);
    expect(playWall({ ...snap, trucks: 1 }, AUTO_PACE)).toBeCloseTo(pacing.AUTO_PICK + 4 + pacing.WHISTLE_TO_TRAY.play + pacing.SLOWMO.truck * (1 - pacing.SLOWMO_RATE) + pacing.TRUCK_HIT_STOP);
    const kick = { kind: 'kick' as const, secs: 0, after: 'score' as const, trucks: 0, replay: null, last: false };
    expect(playWall(kick, AUTO_PACE)).toBeCloseTo(pacing.AUTO_PICK + pacing.AUTO_KICK_AIM + pacing.KICK_RESULT + pacing.KICK_TO_TRAY);
    const w = wallClock([snap, snap, { ...snap, after: 'drive' }, kick], AUTO_PACE);
    expect(w.drives).toHaveLength(2);
    expect(w.total).toBeCloseTo(w.drives[0] + w.drives[1]);
  });

  it('pins all four fixture tiers, with the promo tier above 99', () => {
    for (const t of TIERS) {
      const { off, def } = fixtureTeams(t);
      expect(off.wr).toHaveLength(3);
      expect(def.dl).toHaveLength(4);
    }
    const promo = fixtureTeams('promo');
    const top = Math.max(...[promo.off.qb, promo.off.rb, ...promo.off.wr, promo.off.te].flatMap((p) => Object.values(p.a)));
    expect(top).toBeGreaterThan(99);
    expect(top).toBeLessThanOrEqual(110);
  });
});

const CAL = env.CAL ? describe : describe.skip;
const GAMES = Number(env.CAL_GAMES ?? 400);

CAL('real-card calibration bands (pinned gold fixture, Pro)', () => {
  it('stays inside the guard bands: completion 55-80%, INT at most 4%, 3-6 yards a carry', () => {
    const r = runCase(() => fixtureTeams('gold'), { kind: 'ai', ...LEVELS.pro }, 'cal-guard', GAMES);
    expect(r.completion.v).toBeGreaterThan(0.55);
    expect(r.completion.v).toBeLessThan(0.8);
    expect(r.intRate.v).toBeLessThanOrEqual(0.04);
    expect(r.runs.ypc.v).toBeGreaterThan(3);
    expect(r.runs.ypc.v).toBeLessThan(6);
  }, 900_000);

  // nfl-1, the momentum carry: a thumb that finds the stick a reaction late (or never) costs a run
  // or a catch almost nothing against one already holding it (C-1: it cost 70% of the YPC)
  it('keeps late and untouched sticks close to a held one: YPC at least 0.95x, YAC at least 0.85x', () => {
    const human = (extra: Partial<PilotMode>): PilotMode => ({ kind: 'human', skill: HUMAN_SKILL, defIQ: LEVELS.pro.defIQ, ...extra });
    const held = runCase(() => fixtureTeams('gold'), human({ stickDelay: 0 }), 'stick-held', GAMES);
    const late = runCase(() => fixtureTeams('gold'), human({ stickDelay: pacing.HUMAN_STICK_REACTION }), 'stick-late' + pacing.HUMAN_STICK_REACTION, GAMES);
    const never = runCase(() => fixtureTeams('gold'), human({ neverStick: true }), 'stick-untouched', GAMES);
    expect(late.runs.ypc.v).toBeGreaterThanOrEqual(0.95 * held.runs.ypc.v);
    expect(never.runs.ypc.v).toBeGreaterThanOrEqual(0.95 * held.runs.ypc.v);
    expect(late.yac.v).toBeGreaterThanOrEqual(0.85 * held.yac.v);
  }, 1_800_000);
});
