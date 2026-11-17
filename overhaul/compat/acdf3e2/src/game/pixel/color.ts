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
