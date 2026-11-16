// Kits (studio overhaul players-4, V2 C.1.6): two home kits whose primaries are within CIEDE2000
// delta E 25 always send the rival to a change kit, and the change kit never clashes with yours; no
// kit primary is one of the ground rings' colours, so the gold "you" ring always reads as you.
import { NBA_TEAMS, NFL_TEAMS, SOCCER_TEAMS } from '../data/teams';
import { deltaE2000Lab } from './pixel/color';
import { soccerKits } from './soccer2/kits';
import { CLASH_DE, colorsClash, kitDeltaE, kitsFor, RING_COLORS } from './uniforms';

describe('CIEDE2000', () => {
  it('matches the published test pairs (Sharma, Wu and Dalal 2005)', () => {
    const pairs: [number[], number[], number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
    ];
    for (const [a, b, want] of pairs) expect(deltaE2000Lab(a, b)).toBeCloseTo(want, 3);
  });
});

describe('kits (V2 C.1.6)', () => {
  for (const [sport, list] of [['nba', NBA_TEAMS], ['nfl', NFL_TEAMS]] as const)
    it(`${sport}: every pair within delta E 25 swaps the rival to a kit that doesn't clash`, () => {
      let close = 0;
      for (const a of list)
        for (const b of list) {
          const k = kitsFor(a.abbr, b.abbr, sport);
          if (kitDeltaE(a.c1, b.c1) < CLASH_DE) {
            close++;
            expect(k.rivalAway, `${a.abbr} vs ${b.abbr}`).toBe(true);
            expect(k.theirs.jersey, `${a.abbr} vs ${b.abbr}`).not.toBe(b.c1);
          }
          expect(colorsClash(k.mine.jersey, k.theirs.jersey), `${a.abbr} vs ${b.abbr}`).toBe(false);
        }
      expect(close).toBeGreaterThan(list.length);
    });

  it('soccer: every pair of clubs within delta E 25 swaps the rival to a kit that does not clash', () => {
    let close = 0;
    for (const a of SOCCER_TEAMS)
      for (const b of SOCCER_TEAMS) {
        const k = soccerKits(a, b);
        if (kitDeltaE(a.c1, b.c1) < CLASH_DE) {
          close++;
          expect(k.rivalAway, `${a.abbr} vs ${b.abbr}`).toBe(true);
          expect(k.them.jersey, `${a.abbr} vs ${b.abbr}`).not.toBe(b.c1);
        }
        expect(colorsClash(k.us.jersey, k.them.jersey), `${a.abbr} vs ${b.abbr}`).toBe(false);
        // the keepers read against both outfield sets and each other
        for (const gk of [k.usGk.jersey, k.themGk.jersey]) expect(colorsClash(gk, k.us.jersey) || colorsClash(gk, k.them.jersey), `${a.abbr} vs ${b.abbr} keeper`).toBe(false);
      }
    expect(close).toBeGreaterThan(SOCCER_TEAMS.length);
  });

  it('keeps every kit primary off the four ring colours', () => {
    const rings = RING_COLORS.map((c) => c.toLowerCase());
    for (const t of [...NBA_TEAMS, ...NFL_TEAMS, ...SOCCER_TEAMS]) for (const c of [t.c1, t.c2, t.alt]) expect(rings, t.abbr).not.toContain(c.toLowerCase());
    for (const t of [...NBA_TEAMS, ...NFL_TEAMS, ...SOCCER_TEAMS]) for (const r of RING_COLORS) expect(kitDeltaE(t.c1, r), `${t.abbr} c1 vs ${r}`).toBeGreaterThan(3);
  });
});
