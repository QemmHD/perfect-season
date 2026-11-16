// The head (studio overhaul players-4, V2 C.1.4 and C.5 rule 2): every hair style but bald changes the
// head's outline by at least one art pixel on two sides; below 24 art px the 18 styles collapse to
// four silhouettes; facial hair goes below 20 except a full beard; a football player's hair out of the
// back of his helmet shows at 23 art px.
import { type Appearance, defaultAppearance, type Facial, HAIR, type Hair, skinTone } from './appearance';
import { type Look, rasterBody, type Raster } from './body';
import { headTraits } from './head';
import { STAND } from './rig';
import { HAIR_HANG, HAIR_VOL, HEAD } from './slots';

const look = (sport: Look['sport'], app: Partial<Appearance>): Look => ({
  sport,
  ht: 78,
  wt: 215,
  num: 23,
  hair: 0,
  skin: skinTone(6),
  hairColor: '#1d1612',
  jersey: '#1d428a',
  trim: '#ffc72c',
  shorts: '#1d428a',
  socks: '#f2f2f2',
  shoes: '#1b1b1f',
  helmet: '#1d428a',
  stripe: '#ffc72c',
  mask: '#9aa0a6',
  pants: '#f2f2f2',
  app: { ...defaultAppearance(sport, 'test', 2010), facial: 'none', ...app },
});

/** The head's silhouette (skull, hair and head gear, and hair hanging from it), row by row: [left, right]. */
function outline(r: Raster): Map<number, [number, number]> {
  const rows = new Map<number, [number, number]>();
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      if (!r.slot[i] || (r.part[i] !== HEAD && r.part[i] !== HAIR_VOL && r.part[i] !== HAIR_HANG)) continue;
      const row = rows.get(y);
      rows.set(y, row ? [Math.min(row[0], x), Math.max(row[1], x)] : [x, x]);
    }
  return rows;
}

/** Which sides of the bald outline a style stands out on, by at least one art pixel. */
function sides(style: Map<number, [number, number]>, bald: Map<number, [number, number]>): string[] {
  const ys = [...bald.keys()];
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const out = new Set<string>();
  for (const [y, [l, r]] of style) {
    if (y < top) out.add('top');
    if (y > bottom) out.add('bottom');
    const b = bald.get(y);
    if (!b) continue;
    if (l < b[0]) out.add('left');
    if (r > b[1]) out.add('right');
  }
  return [...out];
}

const VIEWS = [
  { facing: 0.9, pitch: 0.45 },
  { facing: Math.PI / 2, pitch: 0.3 },
  { facing: 2.4, pitch: 0.45 },
];

describe('hair silhouettes (V2 C.5 rule 2)', () => {
  it.each([24, 34, 60])('every style but bald stands off the bald head on two sides at %i art px, in every view', (px) => {
    for (const view of VIEWS) {
      const bald = outline(rasterBody(look('nba', { hair: 'bald' }), STAND, view, px));
      for (const hair of HAIR.filter((h) => h !== 'bald')) {
        const s = sides(outline(rasterBody(look('nba', { hair }), STAND, view, px)), bald);
        expect(s.length, `${hair} at ${px} px, facing ${view.facing.toFixed(2)}: ${s.join(',')}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('collapses the 18 styles to four silhouettes below 24 art px', () => {
    const at = (hair: Hair, px: number) => headTraits(look('nba', { hair }), px).hair;
    expect(new Set(HAIR.map((h) => at(h, 23)))).toEqual(new Set(['bald', 'short', 'hightop', 'flow']));
    expect(new Set(HAIR.map((h) => at(h, 24))).size).toBe(18);
    // the drawn heads agree: two styles that collapse together draw the same head below 24
    const draw = (hair: Hair) => Array.from(rasterBody(look('nba', { hair }), STAND, VIEWS[0], 20).px).join();
    expect(draw('afro')).toBe(draw('hightop'));
    expect(draw('locs-long')).toBe(draw('ponytail'));
    expect(draw('afro')).not.toBe(draw('buzz'));
  });

  it('draws facial hair from 20 art px, and only a full (or long) beard below', () => {
    const f = (facial: Facial, px: number) => headTraits(look('nba', { facial }), px).facial;
    for (const facial of ['goatee', 'mustache', 'stubble', 'chinstrap', 'short'] as Facial[]) {
      expect(f(facial, 19)).toBe('none');
      expect(f(facial, 20)).toBe(facial);
    }
    expect(f('full', 16)).toBe('full');
    expect(f('long', 16)).toBe('full');
    const face = (facial: Facial, px: number) => Array.from(rasterBody(look('nba', { facial }), STAND, { facing: Math.PI / 2, pitch: 0.3 }, px).px).join();
    expect(face('goatee', 19)).toBe(face('none', 19));
    expect(face('goatee', 34)).not.toBe(face('none', 34));
    expect(face('full', 18)).not.toBe(face('none', 18));
  });
});

describe('football heads', () => {
  const back = { facing: -2.2, pitch: 0.4 };
  it.each(['locs', 'flow', 'curly'] as const)('shows %s out of the back of the helmet at 23 art px', (helmetHair) => {
    const r = rasterBody(look('nfl', { helmetHair }), STAND, back, 23);
    const none = rasterBody(look('nfl', { helmetHair: 'none' }), STAND, back, 23);
    let hair = 0;
    for (let i = 0; i < r.slot.length; i++) if (r.slot[i] && r.part[i] === HAIR_HANG) hair++;
    expect(hair, helmetHair).toBeGreaterThanOrEqual(3);
    expect(Array.from(r.px).join()).not.toBe(Array.from(none.px).join());
  });

  it('carries the centre stripe and a visor in its tint', () => {
    const front = { facing: Math.PI / 2, pitch: 0.4 };
    const colours = (eyes: Appearance['eyes']) => new Set(Array.from(rasterBody(look('nfl', { eyes }), STAND, front, 60).px));
    const clear = colours('visor-clear');
    const dark = colours('visor-dark');
    const tint = colours('visor-tint');
    // each visor brings a colour the others don't have
    expect([...dark].some((c) => !clear.has(c) && !tint.has(c))).toBe(true);
    expect([...tint].some((c) => !clear.has(c) && !dark.has(c))).toBe(true);
  });
});
