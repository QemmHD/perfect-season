// "So we know who is who" (studio overhaul players-4, plan §3.2 identity row): the lineup stars in ONE
// shared kit, all drawn at the same height, must still differ from each other. At 24 art px at least
// 80% of the NBA's 66 pairs (75% of the NFL's 55 and soccer's 66) differ by 8% of their pixels or
// more; at 34 art px every pair differs by 12% or more; at 60 art px every pair by 8% or more. The
// method is players-lineup.mjs's (likeness.helpers.ts). Each sport runs under its own PS_SPORT.
import { SPORT } from '../../engine/sport';
import type { Sport } from './appearance';
import { identity, STARS } from './likeness.helpers';

const SHARE_24: Record<Sport, number> = { nba: 0.8, nfl: 0.75, soccer: 0.75 };

describe.each(['nba', 'nfl', 'soccer'] as const)('%s: who is who in one shared kit', (sport) => {
  it.skipIf(SPORT !== sport)('differs pair by pair at 24, 34 and 60 art px', async () => {
    const [r24, r34, r60] = await identity(sport, [24, 34, 60]);
    const n = sport === 'nfl' ? STARS.nfl.length - 1 : STARS[sport].length;
    expect(r24.pairs).toHaveLength((n * (n - 1)) / 2);
    const closest = (r: typeof r24) => [...r.pairs].sort((a, b) => a.d - b.d).slice(0, 3).map((p) => `${p.a}/${p.b} ${(p.d * 100).toFixed(1)}%`);
    console.log(sport, { share8at24: r24.share8, min24: r24.min, min34: r34.min, min60: r60.min, closest34: closest(r34), closest60: closest(r60) });
    expect(r24.share8).toBeGreaterThanOrEqual(SHARE_24[sport]);
    expect(r34.min).toBeGreaterThanOrEqual(0.12);
    expect(r60.min).toBeGreaterThanOrEqual(0.08);
  }, 120000);
});
