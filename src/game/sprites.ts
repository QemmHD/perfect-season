// Pixel-art players, drawn in code: no image files. A sprite is a little grid of colored cells,
// built once per look (uniform, number, build, pose) and cached as a small canvas the games scale
// up with smoothing off, so the pixels stay crisp.
//
// Everyone shares one skin tone: the data has no reliable source for what a player looks like,
// and the games don't guess.
export const SKIN = '#b98260';
const SKIN_SHADE = '#9a6847';

export interface Kit {
  c1: string;
  c2: string;
  pants: string;
  num: number | null;
  /** 0.85-1.25 */
  width: number;
  /** 0.92-1.1 */
  tall: number;
}

/** 3x5 digits */
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

function contrast(hex: string): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#141414' : '#ffffff';
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + ((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}

type Grid = (string | null)[][];

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = c;
}

function number(g: Grid, n: number, cx: number, top: number, c: string) {
  const s = String(n);
  const w = s.length * 3 + (s.length - 1);
  let x = cx - Math.floor(w / 2);
  for (const ch of s) {
    DIGITS[ch]?.forEach((row, j) => [...row].forEach((bit, i) => bit === '1' && rect(g, x + i, top + j, 1, 1, c)));
    x += 4;
  }
}

/**
 * A football player, seen from behind (`back`, your offense going up the field) or the front (the
 * defense). `frame` 0-3 is the running stride.
 */
function football(k: Kit, back: boolean, frame: number): Grid {
  const W = 14;
  const torso = Math.round(8 * k.width); // 7-10 cells across the shoulders
  const legs = k.tall > 1.03 ? 4 : 3;
  const H = 4 + 1 + 6 + 2 + legs + 1;
  const g = grid(W, H);
  const cx = W / 2;
  const left = Math.round(cx - torso / 2);
  // helmet
  rect(g, Math.round(cx - 2), 0, 4, 1, k.c1);
  rect(g, Math.round(cx - 3), 1, 6, 3, k.c1);
  rect(g, Math.round(cx - 1), 0, 2, back ? 4 : 2, k.c2); // the stripe
  if (!back) {
    rect(g, Math.round(cx - 2), 2, 4, 2, '#cfd6da'); // facemask
    rect(g, Math.round(cx - 1), 2, 2, 1, SKIN_SHADE);
  }
  // neck, shoulders (pads), jersey
  rect(g, Math.round(cx - 1), 4, 2, 1, SKIN_SHADE);
  rect(g, left - 1, 5, torso + 2, 2, k.c1);
  rect(g, left, 7, torso, 4, k.c1);
  rect(g, left - 1, 5, 1, 1, shade(k.c1, 0.8));
  rect(g, left + torso, 5, 1, 1, shade(k.c1, 0.8));
  // sleeves and arms
  rect(g, left - 2, 6, 1, 2, k.c1);
  rect(g, left + torso + 1, 6, 1, 2, k.c1);
  rect(g, left - 2, 8, 1, 2, SKIN);
  rect(g, left + torso + 1, 8, 1, 2, SKIN);
  if (k.num !== null) number(g, k.num, Math.round(cx), 6, contrast(k.c1) === '#141414' ? shade(k.c2, 0.6) : '#ffffff');
  // pants
  rect(g, left + 1, 11, torso - 2, 2, k.pants);
  rect(g, left + 1, 11, torso - 2, 1, shade(k.pants, 0.9));
  // legs: a stride, one leg up, one down
  const up = frame % 2 === 0 ? 0 : 1;
  const l1 = Math.round(cx - 2.5);
  const l2 = Math.round(cx + 0.5);
  const y0 = 13;
  rect(g, l1, y0, 2, legs - up, k.c1);
  rect(g, l2, y0, 2, legs - (1 - up), k.c1);
  rect(g, l1, y0 + legs - up - 1, 2, 1, '#f2f2f2');
  rect(g, l2, y0 + legs - (1 - up) - 1, 2, 1, '#f2f2f2');
  rect(g, l1, y0 + legs - up, 2, 1, '#151515');
  rect(g, l2, y0 + legs - (1 - up), 2, 1, '#151515');
  return g;
}

const cache = new Map<string, HTMLCanvasElement>();

function toCanvas(g: Grid): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = g[0].length;
  c.height = g.length;
  const x = c.getContext('2d')!;
  g.forEach((row, j) =>
    row.forEach((col, i) => {
      if (!col) return;
      x.fillStyle = col;
      x.fillRect(i, j, 1, 1);
    })
  );
  // a dark outline, one cell wide, so the players read on grass
  const img = x.getImageData(0, 0, c.width, c.height);
  const out = x.createImageData(c.width + 2, c.height + 2);
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= c.width || j >= c.height ? 0 : img.data[(j * c.width + i) * 4 + 3]);
  const o = document.createElement('canvas');
  o.width = c.width + 2;
  o.height = c.height + 2;
  const ox = o.getContext('2d')!;
  for (let j = -1; j <= c.height; j++)
    for (let i = -1; i <= c.width; i++) {
      if (at(i, j)) continue;
      if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) {
        const k = ((j + 1) * (c.width + 2) + (i + 1)) * 4;
        out.data[k] = 10;
        out.data[k + 1] = 18;
        out.data[k + 2] = 22;
        out.data[k + 3] = 200;
      }
    }
  ox.putImageData(out, 0, 0);
  ox.drawImage(c, 1, 1);
  return o;
}

export function footballSprite(k: Kit, back: boolean, frame: number): HTMLCanvasElement {
  const key = ['f', k.c1, k.c2, k.pants, k.num, k.width.toFixed(2), k.tall.toFixed(2), back ? 1 : 0, frame % 2].join('|');
  let c = cache.get(key);
  if (!c) {
    c = toCanvas(football(k, back, frame));
    cache.set(key, c);
  }
  return c;
}
