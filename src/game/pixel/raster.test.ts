// players-2: the raster golden set. 6 looks x 4 views in hand-keyed poses (no clip loading), hashed
// pixel by pixel with their anchors. RASTER_HASH pins the drawing: the move of the raster code out of
// body.ts reproduced the base commit's hash (e36f4a3b) exactly; a later style change updates it on
// purpose, in the same commit as the change, with the reason in the commit message.
import { LOOKS } from './__fixtures__/looks';
import { rasterBody } from './body';
import * as P from './poses';

const VIEWS = [
  { facing: Math.PI / 2, pitch: 0.45 },
  { facing: -Math.PI / 2, pitch: 0.3 },
  { facing: 0, pitch: 0.45 },
  { facing: 0.9, pitch: 0.6 },
];
const POSES = [P.idle(0.25), P.run(0.375, 1), P.jumpShot(0.5), P.stance(true), P.kickLeg(0.5), P.dive(0.6)];
const SIZES = [34, 60, 24, 34, 22, 40];

const RASTER_HASH = '38046b9e';

function setHash(): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  LOOKS.forEach((look, i) =>
    VIEWS.forEach((view) => {
      const r = rasterBody(look, POSES[i], view, SIZES[i]);
      mix(r.w);
      mix(r.h);
      for (const v of r.px) mix(v);
      for (const v of [r.ax, r.ay, r.top, r.handL.x, r.handL.y, r.handR.x, r.handR.y]) mix(Math.round(v * 1000));
    }),
  );
  return h.toString(16).padStart(8, '0');
}

describe('the raster golden set', () => {
  it('draws the 24 pinned sprites pixel for pixel', () => {
    expect(setHash()).toBe(RASTER_HASH);
  });
});
