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

/** 3x5 capitals, for the initials on a basketball jersey */
const LETTERS: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '110', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
};

export interface HoopKit {
  c1: string;
  c2: string;
  /** inches */
  ht: number;
  /** pounds */
  wt: number;
  initials: string;
}

/**
 * A basketball player: tank top, shorts, a headband in the trim color. Seen from behind (`back`,
 * your five going at the rim) or the front (the defense). `pose`: 0/1 the stride, 2 arms up (a
 * shot, a contest).
 */
function hooper(k: HoopKit, back: boolean, pose: number): Grid {
  const H = Math.round(Math.max(22, Math.min(31, k.ht / 2.85)));
  const torsoW = Math.round(Math.max(6, Math.min(10, 6 + (k.wt - 170) / 30)));
  const W = torsoW + 6;
  const g = grid(W, H + (pose === 2 ? 0 : 0));
  const cx = Math.floor(W / 2);
  const left = cx - Math.floor(torsoW / 2);
  // head and headband
  rect(g, cx - 2, 0, 4, 4, SKIN);
  rect(g, cx - 2, 0, 4, 1, k.c2);
  if (!back) rect(g, cx - 1, 2, 2, 1, SKIN_SHADE);
  rect(g, cx - 1, 4, 2, 1, SKIN_SHADE);
  // the jersey: tank top with trim
  const torsoH = Math.round(H * 0.32);
  const top = 5;
  rect(g, left, top, torsoW, torsoH, k.c1);
  rect(g, left, top, torsoW, 1, k.c2);
  rect(g, left, top, 1, torsoH, shade(k.c1, 0.85));
  rect(g, left + torsoW - 1, top, 1, torsoH, shade(k.c1, 0.85));
  const ink = contrast(k.c1) === '#141414' ? shade(k.c2, 0.55) : '#ffffff';
  const letters = k.initials.slice(0, 2);
  if (torsoW >= 7 && letters) {
    let x = cx - Math.floor((letters.length * 4 - 1) / 2);
    for (const ch of letters) {
      LETTERS[ch]?.forEach((row, j) => [...row].forEach((bit, i) => bit === '1' && rect(g, x + i, top + 2 + j, 1, 1, ink)));
      x += 4;
    }
  }
  // arms: down at his sides, or up for a shot
  if (pose === 2) {
    rect(g, left - 1, 0, 1, top + 2, SKIN);
    rect(g, left + torsoW, 0, 1, top + 2, SKIN);
  } else {
    rect(g, left - 1, top + 1, 1, torsoH + 2, SKIN);
    rect(g, left + torsoW, top + 1, 1, torsoH + 2, SKIN);
  }
  // shorts, with a stripe down the side
  const sTop = top + torsoH;
  rect(g, left, sTop, torsoW, 4, k.c1);
  rect(g, left, sTop, 1, 4, k.c2);
  rect(g, left + torsoW - 1, sTop, 1, 4, k.c2);
  // legs, socks, shoes
  const lTop = sTop + 4;
  const legH = H - lTop - 3;
  const l1 = cx - 2;
  const l2 = cx + 1;
  const up = pose === 1 ? 1 : 0;
  rect(g, l1, lTop, 1, legH - up, SKIN);
  rect(g, l2, lTop, 1, legH - (1 - up) + (pose === 2 ? 0 : 0), SKIN);
  rect(g, l1, lTop + legH - up, 1, 2, '#f4f4f4');
  rect(g, l2, lTop + legH - (1 - up), 1, 2, '#f4f4f4');
  rect(g, l1 - 1, lTop + legH - up + 2, 2, 1, '#151515');
  rect(g, l2, lTop + legH - (1 - up) + 2, 2, 1, '#151515');
  return g;
}

export function hoopSprite(k: HoopKit, back: boolean, pose: number): HTMLCanvasElement {
  const key = ['h', k.c1, k.c2, k.ht, Math.round(k.wt / 10), k.initials, back ? 1 : 0, pose].join('|');
  let c = cache.get(key);
  if (!c) {
    c = toCanvas(hooper(k, back, pose));
    cache.set(key, c);
  }
  return c;
}
