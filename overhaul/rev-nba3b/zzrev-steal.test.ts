import { it } from 'vitest';
import { decide, pilot } from './autopilot';
import { step } from './engine';
import { afterPossession, newHoopsGame, startPossession } from './game';
import { synthSquad } from './harness';
it('early steals', () => {
  let poss = 0, early = 0, steals = 0;
  const ts: number[] = [];
  for (let gi = 0; gi < 30; gi++) {
    const a = synthSquad('s' + 'a' + gi), b = synthSquad('s' + 'b' + gi);
    const g = newHoopsGame(a.five, b.five, 'st' + gi, 16, a.bench, 0);
    const pl = pilot(0.7, 'st' + gi);
    while (!g.over) {
      const p = startPossession(g);
      pl.letGo = null; pl.driving = false; pl.goal = null; pl.nextThink = 0; pl.crosses = 0;
      for (let i = 0; i < 1800 && !p.end; i++) { step(p, 1 / 60, decide(p, pl)); p.events.length = 0; }
      if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
      poss++;
      if (p.end.kind === 'steal') { steals++; ts.push(p.t); if (p.t < 0.5) early++; }
      afterPossession(g, p);
    }
  }
  ts.sort((x, y) => x - y);
  console.log('RV poss', poss, 'steals', steals, 'early<0.5s', early, 'first ts', ts.slice(0, 10).map((x) => x.toFixed(2)).join(','));
});
