// Color helpers for the pixel art: every part is painted in three tones (shadow, base, light) made
// from one base color, and outlines are a dark version of whatever they border.

export type RGB = [number, number, number];

export function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: RGB): string {
  return '#' + ((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1);
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** perceived lightness, 0-255 */
export function luma([r, g, b]: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Three tones from one color, the way pixel artists ramp them: the shadow shifts toward a cool
 * purple-blue and darkens, the light shifts warm and brightens. Very dark and very light colors
 * get a ramp that still reads (black jerseys get a visible light tone, white ones a visible shadow).
 */
export function ramp(base: RGB): [RGB, RGB, RGB] {
  const l = luma(base);
  const shadowK = l > 200 ? 0.78 : l < 50 ? 0.62 : 0.68;
  const shadow = mix(mix(base, [0, 0, 0], 1 - shadowK), [40, 30, 90], 0.12);
  const lift = l < 50 ? 0.2 : l > 200 ? 0.35 : 0.24;
  const light = mix(mix(base, [255, 255, 255], lift), [255, 220, 150], 0.08);
  return [shadow, base, light];
}

/** the outline drawn around a part: a deep, slightly cool version of it */
export function outlineOf(base: RGB): RGB {
  return mix(mix(base, [0, 0, 0], 0.78), [20, 10, 50], 0.25);
}

/** distance between colors, to tell whether two team colors clash */
export function dist(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** a readable color on top of `bg`: the first of `prefs` that stands out enough, else black or white */
export function onColor(bg: RGB, prefs: RGB[]): RGB {
  for (const p of prefs) if (dist(p, bg) > 120 && Math.abs(luma(p) - luma(bg)) > 45) return p;
  return luma(bg) > 140 ? [20, 20, 24] : [255, 255, 255];
}

/** The Broadcast Pixel outline (Game Design V2 C.1.3): one near-black violet around every sprite. */
export const OUTLINE: RGB = [0x14, 0x12, 0x1c];

function toHsl([r, g, b]: RGB): [number, number, number] {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const mx = Math.max(R, G, B),
    mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const same = (a: RGB, b: RGB) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * V2's three tones for one material (C.1.3): the shadow 22 points of lightness darker with its hue
 * turned 10 degrees toward blue, the highlight 14 points lighter. A colour at either end of the scale
 * is moved in a little so all three tones stay distinct (white kits keep a white highlight, black
 * ones a visible shadow), and no tone ever lands on the outline colour.
 */
export function ramp3(base: RGB): [RGB, RGB, RGB] {
  let [h, s, l] = toHsl(base.map(clamp255) as RGB);
  // room for the highlight above and the shadow below
  l = Math.max(0.07, Math.min(0.9, l));
  const toBlue = ((240 - h + 540) % 360) - 180;
  const sh = s < 0.05 ? 235 : h + Math.sign(toBlue) * Math.min(10, Math.abs(toBlue));
  const shadow = fromHsl(sh, s < 0.05 ? 0.08 : Math.min(1, s * 1.05), Math.max(0.025, l - 0.22));
  const mid = fromHsl(h, s, l);
  const light = fromHsl(h, s, Math.min(0.985, l + 0.14));
  const out: [RGB, RGB, RGB] = [shadow, mid, light];
  for (const c of out) if (same(c, OUTLINE)) c[2] += 1;
  if (same(out[0], out[1])) out[0] = out[0].map((v) => Math.max(0, v - 6)) as RGB;
  if (same(out[1], out[2])) out[2] = out[2].map((v) => Math.min(255, v + 6)) as RGB;
  return out;
}
