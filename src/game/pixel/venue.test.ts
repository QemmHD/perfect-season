// Calmer venues (studio overhaul players-4, V2 C.2 through the players venue grant), measured on the
// textures the renderers draw from (a stand-in canvas lets the texture builders run here): the surface
// grain at 4% contrast or less, team paint at 85% saturation, the far end 6% darker, light pools, a
// corner vignette of 18%, and the crowd in three dark bands, nearest lightest, flecked with the home
// colour (6% at most) and white (2% at most) in 2 px blocks.
import { mix, rgb, saturate, toLab, type RGB } from './color';
import { CROWD_BANDS, crowdPalette, FLECK } from './crowd';
import { courtTexture, fieldTexture, type FieldTex } from './persp';
import { pitchTexture } from './pitch';
import { DEPTH_DARKEN, drawVignette, lit, plankColor, teamPaint, VENUE, VIGNETTE } from './venue';

class FakeImageData {
  data: Uint8ClampedArray;
  constructor(
    a: number | Uint8ClampedArray,
    public width: number,
    public height = 0
  ) {
    if (typeof a === 'number') {
      this.height = width;
      this.width = a;
      this.data = new Uint8ClampedArray(a * width * 4);
    } else this.data = a;
  }
}
const gradients: { stops: [number, string][] }[] = [];
function fakeCanvas() {
  let img: FakeImageData | null = null;
  const c = {
    width: 0,
    height: 0,
    getContext: () => ({
      putImageData: (i: FakeImageData) => (img = i),
      getImageData: () => img ?? new FakeImageData(c.width, c.height),
      createImageData: (w: number, h: number) => new FakeImageData(w, h),
      createRadialGradient: () => {
        const g = { stops: [] as [number, string][], addColorStop: (o: number, s: string) => g.stops.push([o, s]) };
        gradients.push(g);
        return g;
      },
      fillRect: () => undefined,
      drawImage: () => undefined,
      fillStyle: '',
    }),
  };
  return c;
}
beforeAll(() => {
  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
});
afterAll(() => vi.unstubAllGlobals());

const unpack = (v: number): RGB => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
const key = (c: RGB) => c.join(',');
const lum = (c: RGB) => {
  const l = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * l(c[0]) + 0.7152 * l(c[1]) + 0.0722 * l(c[2]);
};

/** Median Michelson contrast (p90 vs p10 luminance) over 12x12 tiles whose pixels all pass `keep`. */
function grain(px: Uint32Array, w: number, h: number, keep: (c: RGB) => boolean): { median: number; tiles: number } {
  const out: number[] = [];
  for (let ty = 0; ty + 12 <= h; ty += 12)
    for (let tx = 0; tx + 12 <= w; tx += 12) {
      const ys: number[] = [];
      let ok = true;
      for (let y = ty; y < ty + 12 && ok; y++)
        for (let x = tx; x < tx + 12; x++) {
          const c = unpack(px[y * w + x]);
          if (!keep(c)) {
            ok = false;
            break;
          }
          ys.push(lum(c));
        }
      if (!ok) continue;
      ys.sort((a, b) => a - b);
      const lo = ys[Math.floor(ys.length * 0.1)],
        hi = ys[Math.floor(ys.length * 0.9)];
      out.push((hi - lo) / (hi + lo));
    }
  out.sort((a, b) => a - b);
  return { median: out[out.length >> 1], tiles: out.length };
}

/** The crowd's pixels in a wall of stands: rows that are neither pad, ribbon, facade nor roof. */
function wallCrowd(tex: FieldTex, tiers: { ribbon: number; facade: number; facadeH: number; roof: number }) {
  const rows: number[] = [];
  const H = Math.round(tex.wallH * tex.wallK);
  for (let y = 0; y < H; y++) {
    const yd = tex.wallH - y / tex.wallK;
    if (yd >= tiers.ribbon && yd < tiers.roof && !(yd >= tiers.facade && yd < tiers.facade + tiers.facadeH)) rows.push(y);
  }
  return rows;
}

const THEMES = {
  court: { c1: '#1d428a', c2: '#ffc72c', abbr: 'GSW' },
  field: { homeC1: '#e31837', homeC2: '#ffb81c', homeName: 'Chiefs', awayC1: '#002244', awayC2: '#69be28', awayName: 'Seahawks' },
  pitch: { homeC1: '#da291c', homeC2: '#fbe122', awayC1: '#6cabdd' },
};

describe('the crowd: three dark bands and 2 px flecks', () => {
  const cases = [
    ['court', () => courtTexture(THEMES.court), THEMES.court.c1, { ribbon: 5.5, facade: 13, facadeH: 2, roof: 22 }],
    ['field', () => fieldTexture(THEMES.field), THEMES.field.homeC1, { ribbon: 1.75, facade: 10, facadeH: 1.5, roof: 25.5 }],
    ['pitch', () => pitchTexture(THEMES.pitch), THEMES.pitch.homeC1, { ribbon: 1.8, facade: 7, facadeH: 1.1, roof: 14.6 }],
  ] as const;
  it.each(cases)('%s: the far stands', (_name, make, home, tiers) => {
    const tex = make();
    const p = crowdPalette(home);
    const allowed = new Map([...p.bands.map((b, i) => [key(b), 'band' + i] as const), [key(p.team), 'team'], [key(p.white), 'white']]);
    const count = new Map<string, number>();
    let n = 0;
    const rows = wallCrowd(tex, tiers);
    for (const y of rows)
      for (let x = 0; x < tex.wallW; x++) {
        const c = unpack(tex.wall[y * tex.wallW + x]);
        const what = allowed.get(key(c));
        expect(what, `${c} at ${x},${y}`).toBeDefined();
        count.set(what!, (count.get(what!) ?? 0) + 1);
        n++;
      }
    expect(count.get('team')! / n).toBeLessThanOrEqual(0.06);
    expect(count.get('white')! / n).toBeLessThanOrEqual(0.02);
    expect(count.get('team')! / n).toBeGreaterThan(0.02);
    expect(['band0', 'band1', 'band2'].every((b) => (count.get(b) ?? 0) > 0)).toBe(true);
    // flecks are whole 2x2 blocks (where the block lies inside the crowd's rows)
    const inRows = new Set(rows);
    for (const y of rows)
      for (let x = 0; x < tex.wallW; x++) {
        const c = tex.wall[y * tex.wallW + x];
        const what = allowed.get(key(unpack(c)));
        if (what !== 'team' && what !== 'white') continue;
        const bx = Math.floor(x / FLECK) * FLECK,
          by = Math.floor(y / FLECK) * FLECK;
        if (![0, 1].every((d) => inRows.has(by + d))) continue;
        for (let dy = 0; dy < FLECK; dy++) for (let dx = 0; dx < FLECK; dx++) expect(tex.wall[(by + dy) * tex.wallW + bx + dx]).toBe(c);
      }
  });

  it('dims each tier behind the one below it, and keeps the bands dark', () => {
    const L = CROWD_BANDS.map((c) => toLab(rgb(c))[0]);
    expect(L[0]).toBeGreaterThan(L[1]);
    expect(L[1]).toBeGreaterThan(L[2]);
    expect(Math.max(...L)).toBeLessThan(32);
  });

  it('seats the courtside and touchline fans in the same bands', () => {
    const court = courtTexture(THEMES.court).lv[0];
    const pc = crowdPalette(THEMES.court.c1);
    const ok = new Set([...pc.bands, pc.team, pc.white].map(key));
    // courtside: beyond 31 ft from the middle (8 texels a foot, the middle at 34 ft)
    for (let y = 0; y < court.h; y += 3)
      for (let x = 0; x < court.w; x++) if (Math.abs((x - 34 * 8) / 8) >= 31.2) expect(ok.has(key(unpack(court.px[y * court.w + x]))), `court ${x},${y}`).toBe(true);
    const pitch = pitchTexture(THEMES.pitch).lv[0];
    const pp = crowdPalette(THEMES.pitch.homeC1);
    const okp = new Set([...pp.bands, pp.team, pp.white].map(key));
    // the touchline fans: beyond 8 m off either touchline (the texture spans -16 .. 84 m at 8 texels a metre)
    for (let y = 0; y < pitch.h; y += 5)
      for (let x = 0; x < pitch.w; x++) {
        const m = -16 + (x + 0.5) / 8;
        if (m < -8.2 || m > 76.2) expect(okp.has(key(unpack(pitch.px[y * pitch.w + x]))), `pitch ${x},${y}`).toBe(true);
      }
  });
});

describe('surfaces', () => {
  it('holds the court grain at 4% or less, with the plank tokens', () => {
    const lv = courtTexture(THEMES.court).lv[0];
    const planks = VENUE.nba.planks.map(rgb);
    const wood = (c: RGB) => c[0] > c[2] + 40 && lum(c) < 0.6 && Math.abs(c[0] - planks[0][0]) < 60;
    const g = grain(lv.px, lv.w, lv.h, wood);
    console.log('court grain', g);
    expect(g.tiles).toBeGreaterThan(200);
    expect(g.median).toBeLessThanOrEqual(0.04);
    // the two plank tokens are the ends of the plank range
    expect(plankColor(0, 0)).toEqual(planks[0]);
    for (let i = 0; i < 40; i++) for (const n of [0, 0.5, 1]) expect(lum(plankColor(i, n))).toBeGreaterThanOrEqual(lum(planks[1]) - 1e-9);
  });

  it.each([
    ['field', () => fieldTexture(THEMES.field).lv[0], VENUE.nfl.mow],
    ['pitch', () => pitchTexture(THEMES.pitch).lv[0], VENUE.soccer.mow],
  ] as const)('holds the %s grain at 4% or less', (_n, make, mow) => {
    const lv = make();
    const g0 = rgb(mow[0]);
    const grassy = (c: RGB) => c[1] > c[0] + 30 && c[1] > c[2] + 20 && Math.abs(c[1] - g0[1]) < 50;
    const g = grain(lv.px, lv.w, lv.h, grassy);
    console.log(_n, 'grain', g);
    expect(g.tiles).toBeGreaterThan(100);
    expect(g.median).toBeLessThanOrEqual(0.04);
  });

  it('paints team colour at 85% saturation', () => {
    for (const c of ['#1d428a', '#ce1141', '#007a33', '#fdb927']) expect(teamPaint(c)).toEqual(saturate(rgb(c), 0.85));
  });

  it('darkens the far end by 6% and lifts the pools', () => {
    const c: RGB = [200, 140, 80];
    expect(lit(c, 0, 0, [], 1)).toEqual(mix(c, [0, 0, 0], DEPTH_DARKEN));
    expect(lit(c, 0, 0, [], 0)).toEqual(c);
    const pooled = lit(c, 0, 0, [{ x: 0, y: 0, r: 5, k: VENUE.nba.rimPool }], 0);
    expect(lum(pooled)).toBeGreaterThan(lum(c));
    expect(lum(pooled) / lum(c)).toBeLessThan(1.2);
  });

  it('darkens the screen corners by 18%', () => {
    gradients.length = 0;
    drawVignette(fakeCanvas().getContext() as unknown as CanvasRenderingContext2D, 390, 844);
    expect(VIGNETTE).toBeCloseTo(0.18, 5);
    expect(gradients[0].stops).toEqual([
      [0, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,0.18)'],
    ]);
  });
});
