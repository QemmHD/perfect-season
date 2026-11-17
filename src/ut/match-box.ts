// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5; contracts C1 and C2 in
// docs/studio-overhaul/ut-plan.md): what a finished match tells the recap about itself, read without
// trusting it. The sports put a box score (`Progress.box`) and a match grade (`Progress.grade`) on the
// final Progress only; the three teams published slightly different shapes, so this file reads each
// one duck-typed into one RecapBox and one RecapGrade, and drops anything malformed. Nothing is ever
// invented: no box means no player ratings and no MOTM; no grade means no grade line.
//
// `stripLocal` keeps both off the wire: the match channel only ever carries the shared fields.
// Light on purpose (types only): it sits in the UT match chunk next to the recap.

export type BoxSide = 'us' | 'them';

/** One player's line, whatever sport it came from. `stats` holds finite numbers only. */
export interface RecapLine {
  id: string;
  name: string;
  tag?: string;
  pos?: string;
  side: BoxSide;
  /** the sport's own 1–10 rating, when it gave one (soccer) */
  rating?: number;
  stats: Record<string, number>;
}
export interface RecapBox {
  lines: RecapLine[];
  /** player of the match, by name, when the sport named one */
  potm?: string;
}

/** How the match was played (C1), the fields every sport's grade agrees on. */
export interface RecapGrade {
  letter: 'S' | 'A' | 'B' | 'C';
  perfects: number;
  /** gold chances offered, when the sport counts them */
  chances?: number;
  /** the best Heat reached, 0–100 (66 is HEATING UP, 100 ON FIRE), when reported */
  heat?: number;
  /** ON FIRE spells */
  fires: number;
  /** a win with no turnovers: only ever true for a win */
  flawless: boolean;
}

/** Most lines a box can hold (two full squads with a bench, any sport). */
export const MAX_LINES = 40;
const LETTERS = ['S', 'A', 'B', 'C'] as const;

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const text = (v: unknown, max = 40): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const count = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000 ? Math.floor(v) : undefined);
const NOT_STATS = new Set(['id', 'name', 'tag', 'pos', 'side', 'rating', 'stats']);

/** Finite numbers from a stats record (at most 40 keys, each a short name). */
function statsOf(src: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  let n = 0;
  for (const [k, v] of Object.entries(src)) {
    if (NOT_STATS.has(k) || k.length > 24 || typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 100000) continue;
    out[k] = v;
    if (++n >= 40) break;
  }
  return out;
}

function lineOf(raw: unknown, side?: BoxSide): RecapLine | null {
  const o = obj(raw);
  if (!o) return null;
  const id = text(o.id, 64),
    name = text(o.name),
    s = side ?? (o.side === 'us' || o.side === 'them' ? o.side : undefined);
  if (!id || !name || !s) return null;
  // C2 lines keep their numbers in `stats`; NBA's tracker lines carry them flat
  const stats = statsOf(obj(o.stats) ?? o);
  const rating = typeof o.rating === 'number' && Number.isFinite(o.rating) && o.rating >= 1 && o.rating <= 10 ? Math.round(o.rating * 10) / 10 : undefined;
  const tag = text(o.tag, 8),
    pos = text(o.pos, 8);
  return { id, name, side: s, stats, ...(tag ? { tag } : {}), ...(pos ? { pos } : {}), ...(rating !== undefined ? { rating } : {}) };
}

/**
 * The box from a final Progress's `box`, in any of the published shapes:
 * C2 `BoxLine[]` (each with `side`), NBA's `{ us, them, pog? }`, or `{ lines, potm? }`.
 * Null when there is no usable line for your side (nothing to rate, so nothing is shown).
 */
export function boxOf(raw: unknown): RecapBox | null {
  let lines: RecapLine[] = [];
  let potm: string | undefined;
  if (Array.isArray(raw)) lines = raw.map((l) => lineOf(l)).filter((l): l is RecapLine => !!l);
  else {
    const o = obj(raw);
    if (!o) return null;
    if (Array.isArray(o.lines)) lines = o.lines.map((l) => lineOf(l)).filter((l): l is RecapLine => !!l);
    else
      for (const side of ['us', 'them'] as const)
        if (Array.isArray(o[side])) lines.push(...(o[side] as unknown[]).map((l) => lineOf(l, side)).filter((l): l is RecapLine => !!l));
    potm = text(o.potm) ?? text(o.pog);
  }
  // one line per player and side, at most MAX_LINES
  const seen = new Set<string>();
  lines = lines.filter((l) => !seen.has(l.side + ':' + l.id) && (seen.add(l.side + ':' + l.id), true)).slice(0, MAX_LINES);
  if (!lines.some((l) => l.side === 'us')) return null;
  return { lines, ...(potm ? { potm } : {}) };
}

/**
 * The grade from a final Progress's `grade`, whichever sport wrote it (nba: bestHeat/fires/moments,
 * nfl: heatBest/lit/chances, the plan's C1: heatPeak/onFire/chances). FLAWLESS needs the win.
 */
export function gradeOf(raw: unknown, won: boolean): RecapGrade | null {
  const o = obj(raw);
  if (!o || !LETTERS.includes(o.letter as RecapGrade['letter'])) return null;
  const perfects = count(o.perfects) ?? 0,
    chances = count(o.chances) ?? count(o.moments),
    heatRaw = [o.heatPeak, o.bestHeat, o.heatBest].find((x) => typeof x === 'number' && Number.isFinite(x)) as number | undefined,
    fires = count(o.onFire) ?? count(o.fires) ?? count(o.lit) ?? 0;
  return {
    letter: o.letter as RecapGrade['letter'],
    perfects,
    ...(chances !== undefined ? { chances: Math.max(chances, perfects) } : {}),
    ...(heatRaw !== undefined ? { heat: Math.max(0, Math.min(100, Math.round(heatRaw))) } : {}),
    fires,
    flawless: won && o.flawless === true,
  };
}

/** "ON FIRE ×2", "ON FIRE", "HEATING UP", "48%": the best Heat a match reached. Null when not reported. */
export function heatText(g: RecapGrade): string | null {
  if (g.fires > 0) return g.fires > 1 ? 'ON FIRE ×' + g.fires : 'ON FIRE';
  if (g.heat === undefined) return null;
  return g.heat >= 66 ? 'HEATING UP' : g.heat + '%';
}

/**
 * The progress as it may go over the match channel: never this phone's box or grade (a second guard
 * behind each sport's own wire strip). Returns the same object when there is nothing to drop.
 */
export function stripLocal<P extends object>(p: P): Omit<P, 'box' | 'grade'> {
  if (!('box' in p) && !('grade' in p)) return p;
  const { box: _box, grade: _grade, ...rest } = p as P & { box?: unknown; grade?: unknown };
  return rest;
}
