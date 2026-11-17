// Better cards win more (Claude 2026-11-17, studio overhaul soccer-4 review fix; plan A4, audit B-2).
// Whole matches, AI against AI at Pro, between real club-season elevens at least 8 OVR apart (squadOvr):
// the better side must win most of them, so a change that flattens the rating gradient (soccer-4
// first took it from 72% to 44% with nothing failing) can't land unnoticed. A seeded guard, wide of
// the harness band (scripts/soccer/sim.ts 400 pro: 60-72% at ΔOVR ≥ 8); the tight number lives in the
// team doc. Measured on these 60 seeded matches: 35 better wins, 9 worse (58%); at the soccer-4 commit's
// successor (soccer-5, before this fix) 23 and 8 (38%), which this fails. Each match is both sides' seven attacks as the Arcade scoreboard and the UT sims play them.
import cardsRaw from '../../data/cards-soccer.json';
import { hashString, rng } from '../../engine/rng';
import { aiAttacksOf } from './match';
import { clubSquad, soccerLines, squadOvr, type SoccerCardsFile } from './ratings';
import type { Squad } from './types';

const MATCHES = 60;

describe('the rating gradient (plan A4)', () => {
  it(`the side 8+ OVR better wins most of ${MATCHES} Pro matches, and far more than it loses`, () => {
    const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
    const counts = new Map<string, number>();
    for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
    const elevens: Squad[] = [];
    for (const [k, n] of counts) {
      if (n < 14) continue;
      const [fr, s] = k.split('|');
      try {
        elevens.push(clubSquad(seasons, fr, Number(s)));
      } catch {
        // not a full eleven
      }
    }
    const r = rng(hashString('rating-gradient'));
    let better = 0;
    let worse = 0;
    let n = 0;
    for (let tries = 0; n < MATCHES && tries < 20_000; tries++) {
      const x = elevens[Math.floor(r() * elevens.length)];
      const y = elevens[Math.floor(r() * elevens.length)];
      const gap = squadOvr(x) - squadOvr(y);
      if (Math.abs(gap) < 8) continue;
      const seed = 'grad:' + n;
      const us = aiAttacksOf(x, y, seed + ':a', 0.68).score;
      const them = aiAttacksOf(y, x, seed + ':b', 0.68).score;
      n++;
      if (us === them) continue;
      if (us > them === gap > 0) better++;
      else worse++;
    }
    expect(n).toBe(MATCHES);
    expect(better / n).toBeGreaterThanOrEqual(0.52);
    expect(better).toBeGreaterThanOrEqual(worse * 3);
  }, 60_000);
});
