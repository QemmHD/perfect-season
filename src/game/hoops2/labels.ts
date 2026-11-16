// Readable text on the court (nba-3, NBA-22; Claude 2026-11-16): the 3×5 pixel font, names folded to
// letters it has (Jokić → JOKIC, Dončić → DONCIC, Ø, Ł, ß…), on-court tags made unique when two men
// share a surname (J.JOHNSON / M.JOHNSON), and the chips placed by priority so none covers another.
// Pure: the renderer draws what `layoutLabels` places.

/** The 3×5 pixel font: 15 bits a glyph, row by row. */
export const F35: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000', '!': '010010010000010', '%': '101001010100101',
  // NBA-22 / V2 C.3: & / : + ' and the brackets and comma names and banners need
  '&': '010101010101011', '/': '001001010100100', ':': '000010000010000', '+': '000010111010000', '(': '010100100100010', ')': '010001001001010', ',': '000000000010100', '·': '000000010000000',
};

/** Letters a fold can't get from Unicode's decomposition (they're whole letters, not marks). */
const FOLD: Record<string, string> = { Ø: 'O', Ł: 'L', Đ: 'D', Ð: 'D', ß: 'SS', ẞ: 'SS', Æ: 'AE', Œ: 'OE', Þ: 'TH', Ħ: 'H', Ŧ: 'T', ı: 'I', Ё: 'E', Е: 'E', А: 'A', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', '’': "'", '‘': "'", 'ʼ': "'", '–': '-', '—': '-' };

/**
 * A name in the pixel font's letters: uppercased, accents dropped (NFD, then the combining marks
 * removed), whole letters like Ø Ł ß Æ Œ spelled out, and anything still missing dropped.
 */
export function foldName(s: string): string {
  let out = '';
  for (const ch of s.toUpperCase().normalize('NFD')) {
    if (/\p{M}/u.test(ch)) continue;
    const up = FOLD[ch] ?? FOLD[ch.toUpperCase()] ?? ch;
    for (const c of up) if (F35[c] !== undefined) out += c;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** The characters a string would print with holes (after folding). */
export const glyphMisses = (s: string) => [...foldName(s)].filter((c) => F35[c] === undefined);

/**
 * On-court tags, unique across both fives: a shared surname gets the first name's initial
 * (J.JOHNSON / M.JOHNSON), then two letters (JA.JOHNSON), then a number. Folded to the font.
 */
export function uniqueTags(men: { name: string; tag: string }[]): string[] {
  const base = men.map((m) => foldName(m.tag) || foldName(m.name));
  const out = base.slice();
  const first = (m: { name: string }) => foldName(m.name.replace(/ \(.*\)$/, '').split(' ')[0] ?? '');
  for (let n = 1; n <= 2; n++) {
    const seen = new Map<string, number[]>();
    out.forEach((t, i) => seen.set(t, [...(seen.get(t) ?? []), i]));
    for (const idx of seen.values()) {
      if (idx.length < 2) continue;
      for (const i of idx) {
        const f = first(men[i]).slice(0, n);
        if (f) out[i] = f + '.' + base[i];
      }
    }
  }
  // still level (the same first letters too): number them
  const count = new Map<string, number>();
  out.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1));
  const k = new Map<string, number>();
  return out.map((t) => {
    if ((count.get(t) ?? 0) < 2) return t;
    const i = (k.get(t) ?? 0) + 1;
    k.set(t, i);
    return t + ' ' + i;
  });
}

/** A chip's size on screen: the font doubled (z = 2), on a plate 7 art px tall (5 + a pixel each side). */
export const CHIP_Z = 2;
export const CHIP_H = 7 * CHIP_Z;
export const chipWidth = (s: string) => (Math.max(1, s.length) * 4 - 1) * CHIP_Z + 4 * CHIP_Z;

/** A label to place: centred at x, wanting its top at y; higher `pri` is placed first. */
export interface LabelReq {
  text: string;
  x: number;
  y: number;
  pri: number;
  color: string;
  /** may move up or down this far to find room (px); 0 pins it */
  slack?: number;
}
export interface Placed extends LabelReq {
  /** the box it takes (top-left, size) */
  bx: number;
  by: number;
  bw: number;
  bh: number;
}

const GAP = 2;

/**
 * Place the chips: highest priority first, each at its wanted spot, else nudged up then down in
 * steps of its height (within its slack and the screen), else left out. Nothing placed overlaps.
 */
export function layoutLabels(reqs: LabelReq[], W: number, H: number): Placed[] {
  const placed: Placed[] = [];
  const order = reqs.map((r, i) => ({ r, i })).sort((a, b) => b.r.pri - a.r.pri || a.i - b.i);
  const hits = (x: number, y: number, w: number, h: number) => placed.some((p) => x < p.bx + p.bw + GAP && p.bx < x + w + GAP && y < p.by + p.bh + GAP && p.by < y + h + GAP);
  for (const { r } of order) {
    const bw = chipWidth(r.text);
    const bh = CHIP_H;
    const bx = Math.round(Math.min(Math.max(1, r.x - bw / 2), Math.max(1, W - bw - 1)));
    const slack = r.slack ?? 3 * (bh + GAP);
    const tries = [0];
    for (let d = bh + GAP; d <= slack; d += bh + GAP) tries.push(-d, d);
    for (const d of tries) {
      const by = Math.round(r.y + d);
      if (by < 0 || by + bh > H) continue;
      if (hits(bx, by, bw, bh)) continue;
      placed.push({ ...r, bx, by, bw, bh });
      break;
    }
  }
  return placed;
}

/** Draw a placed chip: a dark plate, the folded text in the pixel font (z = 2). */
export function drawChip(ctx: CanvasRenderingContext2D, p: Placed): void {
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.fillRect(p.bx, p.by, p.bw, p.bh);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(p.bx, p.by, p.bw, 1);
  ctx.fillStyle = p.color;
  const z = CHIP_Z;
  const s = p.text;
  const x0 = p.bx + 2 * z;
  const y0 = p.by + z;
  for (let i = 0; i < s.length; i++) {
    const g = F35[s[i]] ?? F35[' '];
    for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) if (g[r * 3 + col] === '1') ctx.fillRect(x0 + (i * 4 + col) * z, y0 + r * z, z, z);
  }
}

/** A chip's text, ready for the font (folded). */
export const chipText = (s: string) => foldName(s);
