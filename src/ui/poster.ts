// The share image: a 1080x1350 poster of the run. The record, the grade, how the playoffs went,
// and the team as a hand of trading cards drawn the way the game draws them (era frame, team
// colors, rarity finish). A Daily shows the cards face down, each edged with its pick's grade,
// so the day's teams aren't spoiled.
import { GAMES } from '../engine/rating';
import { rarityOf, type Rarity } from '../engine/rarity';
import type { PickGrade } from '../engine/review';
import { NFL } from '../engine/sport';
import { type Player, type Slot, SLOTS } from '../engine/types';
import type { ResultInfo } from './Results';
import { eraOf, type Era } from './Card';
import { initials } from './common';
import { cardName, isDefense } from './sportui';

const W = 1080;
const H = 1350;
const TEAL = '#19E3C9';
const GOLD = '#F5B83D';
const INK = '#F2F6F7';
const MUTED = '#8FA6B2';

const GRADE_COLOR: Record<PickGrade, string> = { best: '#19e3c9', great: '#6fe8b2', good: '#f5d03d', reach: '#ff9f43', miss: '#ff6b6b' };

// the card art's paths, the same as the SVG jerseys (a 100x100 box)
const JERSEY = {
  nfl: ['M30 10 Q50 20 70 10 L92 22 L98 48 L80 52 L78 40 L78 94 H22 L22 40 L20 52 L2 48 L8 22 Z', 'M30 10 Q50 26 70 10', 'M86 30 L95 40 M14 30 L5 40'],
  nba: ['M30 6 L38 6 Q50 24 62 6 L70 6 Q72 22 84 30 L84 96 H16 L16 30 Q28 22 30 6 Z', 'M38 6 Q50 24 62 6 M30 6 Q28 22 16 30 M70 6 Q72 22 84 30'],
  def: ['M50 6 L86 18 V48 C86 72 70 86 50 95 C30 86 14 72 14 48 V18 Z', 'M50 16 L76 25 V48 C76 66 65 77 50 84 C35 77 24 66 24 48 V25 Z'],
};

const disp = (size: number, weight = 900) => 'italic ' + weight + ' ' + size + "px 'Archivo', 'Arial Narrow', sans-serif";
const body = (size: number, weight = 800) => weight + ' ' + size + "px 'Archivo', 'Helvetica Neue', sans-serif";

export function drawPoster(info: ResultInfo): string | null {
  try {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return null;
    const r = info.record;
    const players = SLOTS.map((k) => ({ slot: k, p: info.lineup[k] })).filter((x): x is { slot: Slot; p: Player } => !!x.p);
    const daily = r.mode === 'daily';
    const star = players.slice().sort((a, b) => b.p.val - a.p.val)[0]?.p;
    const condensed = (on: boolean) => {
      // the display face is a variable font with a width axis: narrow it where the browser lets us
      const gg = g as CanvasRenderingContext2D & { fontStretch?: string };
      if ('fontStretch' in gg) gg.fontStretch = on ? 'condensed' : 'normal';
    };

    // a Daily's glow is the game's own color: a team's would hint at the day's spins
    backdrop(g, daily ? '#19E3C9' : (star?.c1 ?? '#0f3a44'), r.title || r.perfect);

    // header
    condensed(true);
    g.textBaseline = 'alphabetic';
    g.fillStyle = TEAL;
    g.font = disp(58);
    g.fillText('PERFECT SEASON', 64, 118);
    // where to play, under the name (any address fits here)
    condensed(false);
    g.fillStyle = hexA(TEAL, 0.75);
    g.font = body(26, 700);
    fitText(g, where(), 64, 162, W - 128);
    condensed(true);
    const tag = (NFL ? 'NFL · ' : 'NBA · ') + (daily && info.dailyNo ? 'DAILY #' + info.dailyNo : r.mode === '1v1' ? (r.online ? 'HEAD TO HEAD' : '1 VS 1') : r.mode.toUpperCase());
    pill(g, tag, W - 64, 86, 'right');

    // the record, and the grade beside it
    const rec = r.wins + '–' + (GAMES - r.wins);
    // as big as it goes without running into the medal
    g.font = disp(290);
    const recSize = Math.min(290, Math.floor((290 * 640) / g.measureText(rec).width));
    g.font = disp(recSize);
    const recGrad = g.createLinearGradient(0, 230, 0, 470);
    recGrad.addColorStop(0, '#FFFFFF');
    recGrad.addColorStop(1, r.perfect ? '#FFE29A' : '#BFD3DB');
    g.fillStyle = recGrad;
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 30;
    g.shadowOffsetY = 10;
    g.fillText(rec, 50, 330 + recSize * 0.36);
    g.shadowColor = 'transparent';
    // the medal, and the tier under it; a champion's stamp is slapped over that
    const stamped = r.perfect || r.title;
    badge(g, 880, 300, r.grade, stamped ? '' : r.tier);
    if (stamped) stamp(g, r.perfect ? 'PERFECT' : 'CHAMPS', 880, 470);

    // how it ended
    condensed(false);
    g.font = body(38, 800);
    g.fillStyle = r.title ? GOLD : INK;
    wrapLines(g, r.playoff, W - 128)
      .slice(0, 3)
      .forEach((l, i) => g.fillText(l, 64, 576 + i * 48));

    // the hand
    hand(g, players, daily, info);

    // the draft, Wordle style
    const rv = info.review;
    const dy = 1146;
    if (rv) {
      condensed(true);
      g.fillStyle = MUTED;
      g.font = body(28, 800);
      g.fillText('DRAFT', 64, dy);
      g.fillStyle = gradeColor(rv.letter);
      g.font = disp(64);
      g.fillText(rv.letter, 64, dy + 62);
      const lw = g.measureText(rv.letter).width;
      condensed(false);
      let x = 64 + Math.max(lw, 90) + 26;
      for (const p of rv.picks) {
        g.fillStyle = GRADE_COLOR[p.grade];
        roundRect(g, x, dy + 6, 54, 54, 12);
        g.fill();
        x += 64;
      }
      g.fillStyle = MUTED;
      g.font = body(28, 700);
      g.textAlign = 'right';
      const parLine = r.draft?.par !== undefined ? r.draft.par + '% OF PAR' : Math.round(rv.score) + '% OF BEST';
      g.fillText(parLine, W - 64, dy);
      g.fillStyle = INK;
      g.font = disp(56);
      g.fillText(info.rating.rating.toFixed(1), W - 64, dy + 60);
      g.fillStyle = MUTED;
      g.font = body(22, 800);
      g.fillText('TEAM RATING', W - 64, dy + 90);
      g.textAlign = 'left';
    }

    // the dare, and where to play
    condensed(false);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, H - 84, W, 84);
    g.fillStyle = INK;
    g.font = body(30, 800);
    g.textAlign = 'center';
    g.fillText(NFL ? 'Can you go 17–0 and win the Super Bowl?' : 'Can you go 82–0, then 16–0?', W / 2, H - 32);
    g.textAlign = 'left';
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** the game's address, without the scheme */
function where(): string {
  try {
    return (location.host + location.pathname).replace(/\/(index\.html)?$/, '');
  } catch {
    return '';
  }
}

/** Night sky over a lit stadium: the star player's team color glowing behind the cards. */
function backdrop(g: CanvasRenderingContext2D, glow: string, gold: boolean) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b2630');
  bg.addColorStop(0.55, '#06151c');
  bg.addColorStop(1, '#02080c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // light from above
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = 120 + i * 140;
    const grad = g.createLinearGradient(0, 0, 0, 900);
    grad.addColorStop(0, 'rgba(180,230,255,0.07)');
    grad.addColorStop(1, 'rgba(180,230,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - 8, 0);
    g.lineTo(x + 8, 0);
    g.lineTo(x + 120 + (i - 3) * 50, 900);
    g.lineTo(x - 120 + (i - 3) * 50, 900);
    g.closePath();
    g.fill();
  }
  // the team's glow behind the hand
  const rg = g.createRadialGradient(W / 2, 880, 40, W / 2, 880, 640);
  rg.addColorStop(0, hexA(glow, 0.55));
  rg.addColorStop(1, hexA(glow, 0));
  g.fillStyle = rg;
  g.fillRect(0, 300, W, 1050);
  if (gold) {
    const gg = g.createRadialGradient(W - 180, 330, 20, W - 180, 330, 420);
    gg.addColorStop(0, 'rgba(245,184,61,0.22)');
    gg.addColorStop(1, 'rgba(245,184,61,0)');
    g.fillStyle = gg;
    g.fillRect(0, 0, W, 800);
  }
  g.restore();
  // the floor: a court's circles or a field's yard lines
  g.save();
  g.strokeStyle = 'rgba(25,227,201,0.10)';
  g.lineWidth = 5;
  if (NFL) {
    for (let i = 0; i < 9; i++) {
      const y = 1010 + i * 34;
      g.globalAlpha = 0.25 + i * 0.08;
      g.beginPath();
      g.moveTo(-40 - i * 40, y);
      g.lineTo(W + 40 + i * 40, y);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.arc(W / 2, H + 160, 560, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, H + 160, 250, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  // grain, so the gradients don't band
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 2600; i++) g.fillRect(rand() * W, rand() * H, 2, 2);
}

function pill(g: CanvasRenderingContext2D, text: string, x: number, y: number, align: 'left' | 'right') {
  g.font = body(26, 800);
  const w = g.measureText(text).width + 40;
  const left = align === 'right' ? x - w : x;
  g.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(g, left, y - 4, w, 46, 23);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = INK;
  g.fillText(text, left + 20, y + 28);
}

function gradeColor(letter: string): string {
  if (letter.startsWith('S')) return GOLD;
  if (letter.startsWith('A')) return TEAL;
  if (letter.startsWith('B')) return '#6CB4FF';
  if (letter.startsWith('C')) return '#F2A33A';
  if (letter.startsWith('D')) return '#A3B1BC';
  return '#FF7A7A';
}

/** The grade as a medal: a ring in the grade's color, the letter, the tier under it. */
function badge(g: CanvasRenderingContext2D, x: number, y: number, grade: string, tier: string) {
  const col = gradeColor(grade);
  g.save();
  g.shadowColor = hexA(col, 0.6);
  g.shadowBlur = 50;
  const fill = g.createRadialGradient(x - 40, y - 50, 10, x, y, 140);
  fill.addColorStop(0, '#173844');
  fill.addColorStop(1, '#061218');
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, 128, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = col;
  g.lineWidth = 10;
  g.beginPath();
  g.arc(x, y, 122, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = hexA(col, 0.35);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, 104, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = col;
  g.textAlign = 'center';
  g.font = disp(grade.length > 1 ? 128 : 150);
  g.fillText(grade, x, y + 44);
  if (tier) {
    g.font = body(26, 900);
    g.fillStyle = INK;
    g.fillText(tier.toUpperCase(), x, y + 172);
  }
  g.textAlign = 'left';
}

/** A rubber stamp: PERFECT or CHAMPS, tilted. */
function stamp(g: CanvasRenderingContext2D, text: string, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  g.font = disp(62);
  const w = g.measureText(text).width + 56;
  g.strokeStyle = GOLD;
  g.lineWidth = 7;
  roundRect(g, -w / 2, -48, w, 92, 14);
  g.stroke();
  g.lineWidth = 2.5;
  roundRect(g, -w / 2 + 10, -38, w - 20, 72, 9);
  g.stroke();
  g.fillStyle = GOLD;
  g.textAlign = 'center';
  g.fillText(text, 0, 22);
  g.restore();
}

/** The lineup fanned out like a hand, each card over the one before it, so every spot shows. */
function hand(g: CanvasRenderingContext2D, players: { slot: Slot; p: Player }[], daily: boolean, info: ResultInfo) {
  const n = players.length;
  if (!n) return;
  const cw = n > 5 ? 206 : 238;
  const ch = Math.round(cw * 1.405);
  const step = n > 5 ? 152 : 184;
  const mid = (n - 1) / 2;
  const cy = 880;
  const grades: Partial<Record<Slot, PickGrade>> = {};
  for (const p of info.review?.picks ?? []) grades[p.slot] = p.grade;
  players.forEach(({ slot, p }, i) => {
    const d = i - mid;
    const x = W / 2 + d * step;
    const y = cy + d * d * 7;
    g.save();
    g.translate(x, y);
    g.rotate((d * 4.2 * Math.PI) / 180);
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 34;
    g.shadowOffsetY = 18;
    if (daily) cardBack(g, cw, ch, slot, grades[slot]);
    // the next card covers this one's right side: keep its name in the part that shows
    else card(g, p, slot, cw, ch, i === n - 1 ? cw : step - 6);
    g.restore();
  });
}

/** One trading card, centered on the origin. Mirrors the CSS card in Card.tsx. */
function card(g: CanvasRenderingContext2D, p: Player, slot: Slot, w: number, h: number, shown: number) {
  const s = w / 84;
  const era: Era = eraOf(p.era);
  const rar: Rarity = rarityOf(p);
  const x0 = -w / 2;
  const y0 = -h / 2;
  const outer = (ctx: CanvasRenderingContext2D, inset: number, rad: number) => {
    if (era === 'diecut') clipCorners(ctx, x0 + inset, y0 + inset, w - inset * 2, h - inset * 2, (12 - inset / s) * s);
    else roundRect(ctx, x0 + inset, y0 + inset, w - inset * 2, h - inset * 2, rad);
  };

  // frame (with the card's shadow), and the rarity's edge glow
  if (rar === 'legendary') {
    g.shadowColor = 'rgba(245,184,61,0.75)';
    g.shadowBlur = 40;
    g.shadowOffsetY = 0;
  }
  g.fillStyle = frameFill(g, era, p, x0, y0, w, h);
  outer(g, 0, (era === 'vintage' ? 6 : 10) * s);
  g.fill();
  g.shadowColor = 'transparent';
  if (rar === 'epic' || rar === 'legendary') {
    g.strokeStyle = rar === 'epic' ? '#B07BFF' : GOLD;
    g.lineWidth = 1.6 * s;
    outer(g, 0.8 * s, 10 * s);
    g.stroke();
  }

  // body
  const pad = (era === 'vintage' ? 4 : era === 'modern' ? 2 : 3) * s;
  const bx = x0 + pad;
  const by = y0 + pad;
  const bw = w - pad * 2;
  const bh = h - pad * 2;
  g.save();
  outer(g, pad, (era === 'vintage' ? 3 : era === 'retro' ? 5 : 7) * s);
  g.clip();
  const bodyGrad = g.createLinearGradient(bx, by, bx + bw * 0.3, by + bh * 1.2);
  bodyGrad.addColorStop(0, p.c1);
  bodyGrad.addColorStop(1, era === 'vintage' ? mix(p.c1, '#2b2116', 0.45) : '#050d12');
  g.fillStyle = bodyGrad;
  g.fillRect(bx, by, bw, bh);

  const plateH = 30 * s;
  const artH = bh - plateH;
  pattern(g, era, p, bx, by, bw, artH, s);

  // the jersey (or a defense's shield)
  const def = isDefense(p);
  const jw = bw * 0.74;
  const jx = bx + (bw - jw) / 2;
  const jy = by + artH - jw * 0.9;
  g.save();
  g.translate(jx, jy);
  g.scale(jw / 100, jw / 100);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 5;
  const paths = def ? JERSEY.def : NFL ? JERSEY.nfl : JERSEY.nba;
  g.fillStyle = era === 'vintage' ? mix(p.c1, '#8a6b45', 0.15) : p.c1;
  g.fill(new Path2D(paths[0]));
  g.shadowColor = 'transparent';
  g.strokeStyle = def ? p.c2 : 'rgba(0,0,0,0.35)';
  g.lineWidth = def ? 5 : 1.5;
  g.lineJoin = 'round';
  g.stroke(new Path2D(paths[0]));
  g.strokeStyle = def ? 'rgba(255,255,255,0.28)' : p.c2;
  g.lineWidth = def ? 2 : 5;
  if (paths[1]) g.stroke(new Path2D(paths[1]));
  if (paths[2]) g.stroke(new Path2D(paths[2]));
  g.textAlign = 'center';
  g.font = disp(def ? 28 : 34);
  const num = def ? p.abbr.slice(0, 3) : initials(p.name);
  g.lineWidth = 3.2;
  g.strokeStyle = p.c2;
  g.strokeText(num, 50, def ? 60 : 74);
  g.fillStyle = '#fff';
  g.fillText(num, 50, def ? 60 : 74);
  g.restore();

  // the name plate
  const py = by + artH;
  plate(g, era, p, bx, py, bw, plateH);
  const name = cardName(p);
  const tw = Math.min(bw, shown - pad) - 6 * s;
  const tx = bx + 3 * s + tw / 2;
  g.textAlign = 'center';
  g.fillStyle = era === 'vintage' ? '#2b2116' : '#fff';
  if (era !== 'vintage') {
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 2 * s;
    g.shadowOffsetY = 1;
  }
  const nameSize = (name.length > 9 ? 10 : 11) * s;
  g.font = era === 'vintage' ? 'italic 700 ' + nameSize + 'px Georgia, serif' : body(nameSize, 800);
  fitText(g, name, tx, py + 13.5 * s, tw);
  g.font = body(8.5 * s, 800);
  g.globalAlpha = 0.85;
  g.fillText(p.abbr + ' ’' + p.era.slice(2, 4), tx, py + 24.5 * s);
  g.globalAlpha = 1;
  g.shadowColor = 'transparent';

  // slot and value
  g.textAlign = 'left';
  g.font = body(9 * s, 900);
  const sw = g.measureText(slot).width + 8 * s;
  g.fillStyle = era === 'vintage' ? '#efe3c4' : 'rgba(2,8,12,0.66)';
  roundRect(g, bx + 3 * s, by + 3 * s, sw, 13 * s, 4 * s);
  g.fill();
  g.fillStyle = era === 'vintage' ? '#2b2116' : '#fff';
  g.fillText(slot, bx + 7 * s, by + 13 * s);
  g.font = disp(16 * s);
  g.shadowColor = 'rgba(0,0,0,0.7)';
  g.shadowBlur = 3 * s;
  g.shadowOffsetY = 1 * s;
  g.fillStyle = '#ffe29a';
  // right-aligned in the part of the card the next one doesn't cover; under the spot's badge when
  // that part is too narrow for both
  const val = p.val.toFixed(0);
  const right = bx + Math.min(bw, shown - pad) - 4 * s;
  if (right - g.measureText(val).width < bx + 3 * s + sw + 3 * s) {
    g.textAlign = 'left';
    g.fillText(val, bx + 4 * s, by + 33 * s);
  } else {
    g.textAlign = 'right';
    g.fillText(val, right, by + 17 * s);
  }
  g.shadowColor = 'transparent';
  g.textAlign = 'left';

  // the finish
  foil(g, rar, bx, by, bw, bh);
  g.restore();
}

function frameFill(g: CanvasRenderingContext2D, era: Era, p: Player, x: number, y: number, w: number, h: number): string | CanvasGradient {
  if (era === 'vintage') return '#efe3c4';
  if (era === 'retro') return '#f4f6f7';
  if (era === 'diecut') return '#070b0f';
  if (era === 'chrome') {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    [
      [0, '#7f8b93'],
      [0.26, '#f6f9fb'],
      [0.48, '#6b7780'],
      [0.7, '#eef3f6'],
      [1, '#75818a'],
    ].forEach(([o, c]) => gr.addColorStop(o as number, c as string));
    return gr;
  }
  const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h);
  gr.addColorStop(0, p.c2);
  gr.addColorStop(0.55, p.c1);
  gr.addColorStop(1, '#04121a');
  return gr;
}

function pattern(g: CanvasRenderingContext2D, era: Era, p: Player, x: number, y: number, w: number, h: number, s: number) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  if (era === 'vintage') {
    g.fillStyle = 'rgba(0,0,0,0.16)';
    const step = 4 * s;
    for (let yy = y; yy < y + h; yy += step) for (let xx = x; xx < x + w; xx += step) g.fillRect(xx, yy, 1.1 * s, 1.1 * s);
  } else if (era === 'retro') {
    g.fillStyle = p.c2;
    g.globalAlpha = 0.9;
    const band = (a: number, b: number) => {
      // stripes at 118deg, as in the CSS
      g.beginPath();
      g.moveTo(x + w * a, y + h);
      g.lineTo(x + w * b, y + h);
      g.lineTo(x + w * b + h * 0.53, y);
      g.lineTo(x + w * a + h * 0.53, y);
      g.closePath();
      g.fill();
    };
    band(0.4, 0.52);
    band(0.6, 0.65);
  } else if (era === 'chrome') {
    g.fillStyle = 'rgba(255,255,255,0.09)';
    const cx = x + w / 2;
    const cy = y + h * 1.1;
    for (let a = -90; a < 90; a += 12) {
      const r1 = ((a - 90) * Math.PI) / 180;
      const r2 = ((a - 86) * Math.PI) / 180;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(r1) * h * 2, cy + Math.sin(r1) * h * 2);
      g.lineTo(cx + Math.cos(r2) * h * 2, cy + Math.sin(r2) * h * 2);
      g.closePath();
      g.fill();
    }
  } else if (era === 'diecut') {
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 2 * s;
    for (let k = -h; k < w; k += 5 * s) {
      g.beginPath();
      g.moveTo(x + k, y + h);
      g.lineTo(x + k + h, y);
      g.stroke();
    }
    g.strokeStyle = p.c2;
    g.lineWidth = 1.5 * s;
  } else {
    const sheen = g.createLinearGradient(x, y, x + w * 0.5, y + h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1 * s;
    for (let k = -h; k < w + h; k += 7 * s) {
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k + h * 0.58, y + h);
      g.stroke();
    }
  }
  g.restore();
}

function plate(g: CanvasRenderingContext2D, era: Era, p: Player, x: number, y: number, w: number, h: number) {
  if (era === 'vintage') g.fillStyle = '#efe3c4';
  else if (era === 'retro') g.fillStyle = p.c1;
  else if (era === 'chrome') {
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, '#1a2328');
    gr.addColorStop(1, '#070b0e');
    g.fillStyle = gr;
  } else if (era === 'diecut') g.fillStyle = 'rgba(0,0,0,0.78)';
  else g.fillStyle = 'rgba(2,8,12,0.62)';
  g.fillRect(x, y, w, h);
  if (era === 'retro') {
    // the two-tone band above the name, as on the card in the app
    g.fillStyle = p.c2;
    g.fillRect(x, y, w, h * 0.1);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, y + h * 0.1, w, h * 0.035);
  }
  if (era === 'chrome' || era === 'diecut') {
    g.fillStyle = era === 'chrome' ? 'rgba(255,255,255,0.35)' : p.c2;
    g.fillRect(x, y, w, era === 'chrome' ? 1.5 : 4);
  }
}

/** Rare: a silver sheen. Epic: a refractor's rainbow. Legendary: holo foil with sparkles. */
function foil(g: CanvasRenderingContext2D, rar: Rarity, x: number, y: number, w: number, h: number) {
  if (rar === 'common') return;
  g.save();
  if (rar === 'rare') {
    const gr = g.createLinearGradient(x, y + h * 0.2, x + w, y + h * 0.75);
    gr.addColorStop(0.3, 'rgba(255,255,255,0)');
    gr.addColorStop(0.47, 'rgba(255,255,255,0.32)');
    gr.addColorStop(0.53, 'rgba(220,235,255,0.14)');
    gr.addColorStop(0.66, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  } else {
    g.globalCompositeOperation = 'color-dodge';
    g.globalAlpha = rar === 'epic' ? 0.3 : 0.4;
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    const stops = ['#ff6b9d', '#ffd36b', '#6bffb8', '#6bc8ff', '#b07bff', '#ff6b9d'];
    stops.forEach((col, i) => gr.addColorStop(i / (stops.length - 1), col));
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    if (rar === 'legendary') {
      g.globalAlpha = 0.85;
      g.fillStyle = '#fff';
      let sd = 11;
      const rand = () => ((sd = (sd * 48271) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        g.beginPath();
        g.arc(x + rand() * w, y + rand() * h, 0.8 + rand() * 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.restore();
}

/** A card face down: the game's mark, the spot it went to, edged in its pick's grade. */
function cardBack(g: CanvasRenderingContext2D, w: number, h: number, slot: Slot, grade?: PickGrade) {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const edge = grade ? GRADE_COLOR[grade] : MUTED;
  g.fillStyle = edge;
  roundRect(g, x0, y0, w, h, 16);
  g.fill();
  g.shadowColor = 'transparent';
  g.save();
  roundRect(g, x0 + 7, y0 + 7, w - 14, h - 14, 11);
  g.clip();
  const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
  gr.addColorStop(0, '#0f3a44');
  gr.addColorStop(1, '#04121a');
  g.fillStyle = gr;
  g.fillRect(x0, y0, w, h);
  g.strokeStyle = 'rgba(25,227,201,0.12)';
  g.lineWidth = 3;
  for (let k = -h; k < w + h; k += 18) {
    g.beginPath();
    g.moveTo(x0 + k, y0);
    g.lineTo(x0 + k + h, y0 + h);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = hexA(edge, 0.6);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, -10, w * 0.3, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = TEAL;
  g.textAlign = 'center';
  g.font = disp(Math.round(w * 0.3));
  g.fillText('PS', 0, -10 + w * 0.1);
  g.fillStyle = INK;
  g.font = body(Math.round(w * 0.12), 900);
  g.fillText(slot, 0, h / 2 - 34);
  g.textAlign = 'left';
}

// ---------- drawing helpers ----------

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function clipCorners(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w - c, y);
  g.lineTo(x + w, y + c);
  g.lineTo(x + w, y + h);
  g.lineTo(x + c, y + h);
  g.lineTo(x, y + h - c);
  g.closePath();
}

function wrapLines(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (g.measureText(t).width > max && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Text shrunk to fit a width. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  const w = g.measureText(text).width;
  if (w <= max) g.fillText(text, x, y);
  else {
    g.save();
    g.translate(x, y);
    g.scale(max / w, 1);
    g.fillText(text, 0, 0);
    g.restore();
  }
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', '').slice(0, 6), 16);
  const pb = parseInt(b.replace('#', '').slice(0, 6), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
