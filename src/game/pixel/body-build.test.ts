// Build from real data (studio overhaul players-4, V2 C.1.1 L-2), re-run through the same path the
// match and the cards use: each player's card line through `cardLook` (looks.ts: `buildOf`'s height and
// weight). At 34 art px Shaq's torso is at least 3 art px wider than Manute Bol's; in soccer, where the
// weight comes from the position's build, Haaland's is at least 2 wider than Messi's.
import { SPORT } from '../../engine/sport';
import { rasterBody, type Look } from './body';
import { starLines } from './likeness.helpers';
import { cardLook } from './looks';
import { drawnHeight, MEAN_HEIGHT_IN } from './proportions';
import * as P from './poses';
import { ARM_L, ARM_R, TORSO } from './slots';

/** The torso's face-on width at its widest, in rows no arm crosses (arms raised out of the way). */
function torsoWidth(look: Look, px = 34): number {
  const up = { ...P.idle(0), shL: 3.0, shR: 3.0, elL: 0, elR: 0, abL: 0.25, abR: 0.25 };
  const r = rasterBody(look, up, { facing: Math.PI / 2, pitch: 0.45 }, px);
  let best = 0;
  for (let y = 0; y < r.h; y++) {
    let a = -1,
      b = -1,
      arm = false;
    for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      if (!r.slot[i]) continue;
      if (r.part[i] === ARM_L || r.part[i] === ARM_R) arm = true;
      if (r.part[i] === TORSO) {
        if (a < 0) a = x;
        b = x;
      }
    }
    if (!arm && a >= 0) best = Math.max(best, b - a + 1);
  }
  return best;
}

describe.skipIf(SPORT !== 'nba')('NBA builds from the card data', () => {
  it("Shaq's torso is 3+ art px wider than Manute Bol's at 34 art px", async () => {
    const lines = await starLines('nba');
    const w = (name: string) => torsoWidth(cardLook(lines.find((l) => l.name === name)!));
    const shaq = w("Shaquille O'Neal");
    const bol = w('Manute Bol');
    console.log({ shaq, bol, jokic: w('Nikola Jokić'), giannis: w('Giannis Antetokounmpo'), curry: w('Stephen Curry'), bogues: w('Muggsy Bogues') });
    expect(shaq - bol).toBeGreaterThanOrEqual(3);
  }, 60000);
});

describe.skipIf(SPORT !== 'soccer')('soccer builds from the card data', () => {
  it("Haaland's torso is 2+ art px wider than Messi's, each at his own drawn height", async () => {
    const lines = await starLines('soccer');
    const w = (name: string) => {
      const look = cardLook(lines.find((l) => l.name === name)!);
      return torsoWidth(look, Math.round((34 * drawnHeight('soccer', look.ht)) / MEAN_HEIGHT_IN.soccer));
    };
    console.log({ haaland: w('Erling Haaland'), messi: w('Lionel Messi') });
    expect(w('Erling Haaland') - w('Lionel Messi')).toBeGreaterThanOrEqual(2);
  }, 60000);
});
