// The always-on calibration smoke (Claude 2026-11-16): 20 seeded AI-v-AI games with the audit's own
// even-78 Squad Battles squads (both teams, Pro), every number counted from the engine's events by
// box.ts and the harness tally, checked against wide bands. The bands hold for today's engine (the
// audit's PPP 1.28) and for plan §3.1's targets (PPP 1.145), so the smoke catches a collapse or a
// runaway, not the fit: calibration.test.ts (opt-in, 150 games) measures that. A task that moves a
// number for good narrows its band here and says so in docs/studio-overhaul/nba.md.
import { getPool } from '../../ut/pool';
import { BoxTracker, type BoxTeam } from './box';
import { newTally, playMatch, squadShown, summary } from './harness';

const GAMES = 20;
const PRO = 0.68;

/** [key, lo, hi]: the wide bands (summary() keys, one side's numbers per 16 possessions or per possession) */
const SMOKE: [string, number, number][] = [
  ['ppp', 0.95, 1.4],
  ['fga16', 11, 18],
  // nba-4 lowered this floor from .15: the AI reads a three by its ring at the release (a contested one
  // is amber), so it takes fewer (.10 / .09 here, from .33 / .24); nba-8's AI playbook raises it back
  ['tpaRate', 0.06, 0.55],
  // free throws arrive with nba-5 (shooting fouls); it raises this floor to .12
  ['ftaRate', 0, 0.4],
  ['tovPct', 0.03, 0.2],
  ['fgPct', 0.38, 0.62],
  ['orbPct', 0.12, 0.4],
  ['astRate', 0.4, 0.95],
  ['passesPerPoss', 0.6, 4],
  ['secPerPoss', 4, 11],
  ['scorers', 2, 5],
];

const sum = (parts: BoxTeam[]): BoxTeam => {
  const out = { ...parts[0] };
  for (const p of parts.slice(1)) for (const k of Object.keys(out) as (keyof BoxTeam)[]) out[k] += p[k];
  return out;
};

describe('NBA calibration smoke', () => {
  it(`${GAMES} AI v AI games at even 78 Pro land inside the wide bands`, async () => {
    const pool = await getPool();
    const ta = newTally();
    const tb = newTally();
    const us: BoxTeam[] = [];
    const them: BoxTeam[] = [];
    for (let i = 0; i < GAMES; i++) {
      const A = squadShown(pool, 78, 'Aeven78' + (i % 10));
      const B = squadShown(pool, 78, 'Beven78' + (i % 10));
      const box = new BoxTracker();
      const m = playMatch(A, B, 'smoke' + i, PRO, 0, { box, ta, tb });
      us.push(box.team('us'));
      them.push(box.team('them'));
      // the box agrees with the engine's own score every game
      expect(box.team('us').pts).toBe(m.us.g.score);
      expect(box.team('them').pts).toBe(m.them.g.score);
    }
    const U = sum(us);
    const T = sum(them);
    const sides = { us: summary(U, T, ta), them: summary(T, U, tb) };
    const out: string[] = [];
    for (const [side, s] of Object.entries(sides))
      for (const [k, lo, hi] of SMOKE) {
        const v = s[k];
        if (!(v >= lo && v <= hi)) out.push(`${side} ${k} ${v.toFixed(3)} outside ${lo}-${hi}`);
      }
    expect(out).toEqual([]);
  }, 60_000);
});
