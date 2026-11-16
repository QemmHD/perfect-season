// players-2: the raster golden set. 6 looks x 4 views in hand-keyed poses (no clip loading), hashed
// pixel by pixel with their anchors. RASTER_HASH pins the drawing: the move of the raster code out of
// body.ts reproduced the base commit's hash (e36f4a3b) exactly; a later style change updates it on
// purpose, in the same commit as the change, with the reason in the commit message.
import { rasterBody, type Look } from './body';
import * as P from './poses';

export const LOOKS: Look[] = [
  { sport: 'nba', ht: 78, wt: 215, num: 23, hair: 0, beard: false, skin: '#a8714f', hairColor: '#1d1612', jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' },
  { sport: 'nba', ht: 85, wt: 325, num: 34, hair: 3, beard: true, skin: '#a8714f', hairColor: '#1d1612', jersey: '#552583', trim: '#fdb927', shorts: '#552583', socks: '#ffffff', shoes: '#111111' },
  { sport: 'nba', ht: 72, wt: 165, num: 3, hair: 4, beard: false, skin: '#a8714f', hairColor: '#3b2a20', jersey: '#ffffff', trim: '#006bb6', shorts: '#ffffff', socks: '#ffffff', shoes: '#ffffff' },
  { sport: 'nfl', ht: 76, wt: 315, num: 71, hair: 0, skin: '#a8714f', hairColor: '#1d1612', jersey: '#203731', trim: '#ffb612', shorts: '#ffb612', socks: '#203731', shoes: '#111111', helmet: '#203731', stripe: '#ffffff', mask: '#9aa0a6', pants: '#ffb612', pads: 1.25 },
  { sport: 'soccer', ht: 70, wt: 159, num: 10, hair: 5, beard: true, skin: '#a8714f', hairColor: '#1d1612', jersey: '#75aadb', trim: '#ffffff', shorts: '#111111', socks: '#ffffff', shoes: '#111111', sleeves: 'short' },
  { sport: 'soccer', ht: 76, wt: 190, num: 1, hair: 2, beard: false, skin: '#a8714f', hairColor: '#1d1612', jersey: '#1fa34a', trim: '#111111', shorts: '#111111', socks: '#1fa34a', shoes: '#111111', sleeves: 'long', gloves: '#f2f2ee' },
];
const VIEWS = [
  { facing: Math.PI / 2, pitch: 0.45 },
  { facing: -Math.PI / 2, pitch: 0.3 },
  { facing: 0, pitch: 0.45 },
  { facing: 0.9, pitch: 0.6 },
];
const POSES = [P.idle(0.25), P.run(0.375, 1), P.jumpShot(0.5), P.stance(true), P.kickLeg(0.5), P.dive(0.6)];
const SIZES = [34, 60, 24, 34, 22, 40];

const RASTER_HASH = 'e36f4a3b';

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
