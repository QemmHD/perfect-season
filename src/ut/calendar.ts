// Claude, 2026-11-01 (wave 3): the Live Calendar core. Everything comes from the US-Eastern date
// plus src/data/live-calendar.json (12 seasons, Nov 2026 to Nov 2027; built and validated by the
// content-plan tools). After the last season the year repeats seasons 2–12 shifted by 364 days (same
// weekdays): season ids continue (season:13, ...) and promo/SBC/pack ids get `-y<cycle>` so every
// repeat has its own stable ids. The schedule loads with the card pool (pool.ts `getPool`).
import type { UtSport } from './types';

type PerSport<T> = T | { nba?: T | null; nfl?: T | null };
export interface CalWave {
  d: string;
  label?: PerSport<string>;
  count?: PerSport<number>;
  rule?: PerSport<string | string[]>;
  slots?: PerSport<{ pos?: Record<string, number>; any?: number }>;
  featured?: { count: number; band: [number, number] };
}
export interface CalPromo {
  id: string;
  kind: string;
  name: PerSport<string>;
  start: string;
  end: string;
  ovrBand: [number, number];
  delta: number;
  count: PerSport<number>;
  rule: PerSport<string | string[] | { pair: [string, string] }>;
  pick?: 'top' | 'seeded';
  distinct?: string;
  maxPer?: Record<string, PerSport<number>>;
  waves?: CalWave[] | { nba?: CalWave[] | null; nfl?: CalWave[] | null };
  featured?: { count: number; band: [number, number] };
  excludePrevious?: boolean;
}
export interface CalSbc {
  id: string;
  name: PerSport<string>;
  promo?: string;
  size: number;
  reqs: unknown;
  reward: { card?: string; featured?: boolean; wave?: string; pack?: string };
  repeat?: number | string;
  start: string;
  end: string;
}
export interface CalPack {
  id: string;
  tpl: string;
  name: PerSport<string>;
  start: string;
  end: string;
  price?: number;
  programOdds?: number;
  extraOdds?: Record<string, number>;
}
export interface CalSeasonRaw {
  id: string;
  n: number;
  name: string;
  start: string;
  end: string;
  tagline: string;
  accent: string[];
  promos: CalPromo[];
  sbcs: CalSbc[];
  packs: CalPack[];
  programPick?: string;
}
export interface Schedule {
  version: number | string;
  defaults: { packTemplates: Record<string, { price?: number; programOdds?: number; limit?: { perDay?: number; perWeek?: number } }> };
  seasons: CalSeasonRaw[];
}

let data: Schedule | null = null;

/** The schedule, loaded once (pool.ts loads it with the cards). */
export async function loadSchedule(): Promise<Schedule> {
  if (!data) data = (await import('../data/live-calendar.json')).default as unknown as Schedule;
  return data;
}
/** For tests and tools: set the schedule directly. */
export function setSchedule(s: Schedule): void {
  data = s;
}
export function schedule(): Schedule | null {
  return data;
}

export const CYCLE_DAYS = 364;

export function per<T>(v: PerSport<T> | undefined, sport: UtSport): T | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v) && ('nba' in (v as object) || 'nfl' in (v as object))) return ((v as { nba?: T; nfl?: T })[sport] ?? undefined) as T | undefined;
  return v as T | undefined;
}

const MS = 86400000;
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(toMs(d) + n * MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / MS);

/** One season of one cycle (cycle 0 is the scheduled year), its dates shifted and ids suffixed. */
export interface CalSeason {
  id: string;
  n: number;
  cycle: number;
  name: string;
  tagline: string;
  accent: string[];
  start: string;
  end: string;
  raw: CalSeasonRaw;
}

/** a cycle's id suffix: none for the scheduled year, `-y2`, `-y3`, ... after */
export const cycleSuffix = (cycle: number) => (cycle ? '-y' + (cycle + 1) : '');

function seasonOf(raw: CalSeasonRaw, cycle: number): CalSeason {
  const shift = cycle * CYCLE_DAYS;
  return { id: 'season:' + (raw.n + (cycle ? 11 * cycle : 0)), n: raw.n + (cycle ? 11 * cycle : 0), cycle, name: raw.name, tagline: raw.tagline, accent: raw.accent, start: addDays(raw.start, shift), end: addDays(raw.end, shift), raw };
}

/** The seasons of a cycle (cycle 0 includes season 1; repeats are seasons 2–12). */
export function seasonsOfCycle(cycle: number): CalSeason[] {
  const s = data?.seasons ?? [];
  return (cycle ? s.slice(1) : s).map((raw) => seasonOf(raw, cycle));
}

/** The cycle a day falls in (0 = the scheduled year). */
export function cycleOf(day: string): number {
  const s = data?.seasons;
  if (!s?.length) return 0;
  const last = s[s.length - 1].end;
  if (day <= last) return 0;
  return Math.floor(daysBetween(s[1].start, day) / CYCLE_DAYS);
}

/** The season a day is in (days before the first season belong to it). */
export function seasonOn(day: string): CalSeason | null {
  const list = seasonsOfCycle(cycleOf(day));
  if (!list.length) return null;
  return list.find((x) => x.start <= day && day <= x.end) ?? (day < list[0].start ? list[0] : list[list.length - 1]);
}

/** A promo of a cycle: dates shifted, id suffixed. */
export interface CalPromoOn extends CalPromo {
  baseId: string;
  cycle: number;
  season: CalSeason;
}

function promosOfCycle(cycle: number): CalPromoOn[] {
  return seasonsOfCycle(cycle).flatMap((se) =>
    se.raw.promos.map((p) => ({
      ...p,
      id: p.id + cycleSuffix(cycle),
      baseId: p.id,
      cycle,
      season: se,
      start: addDays(p.start, cycle * CYCLE_DAYS),
      end: addDays(p.end, cycle * CYCLE_DAYS),
      waves: shiftWaves(p.waves, cycle * CYCLE_DAYS),
    }))
  );
}

/** Any promo by its id, in any cycle (`-y<k>` ids map to the base promo shifted). */
export function promoById(id: string): CalPromoOn | null {
  const m = /^(.*?)(?:-y(\d+))?$/.exec(id);
  if (!m) return null;
  const cycle = m[2] ? Number(m[2]) - 1 : 0;
  if (m[2] && cycle < 1) return null;
  return promosOfCycle(cycle).find((p) => p.baseId === m[1]) ?? null;
}

function shiftWaves(w: CalPromo['waves'], days: number): CalPromo['waves'] {
  const sh = (l: CalWave[] | null | undefined) => l?.map((x) => ({ ...x, d: addDays(x.d, days) })) ?? null;
  if (!w) return undefined;
  return Array.isArray(w) ? sh(w)! : { nba: sh(w.nba), nfl: sh(w.nfl) };
}

/** A promo's waves for a sport (they can differ by sport). */
export function wavesOf(p: Pick<CalPromo, 'waves'>, sport: UtSport): CalWave[] {
  const w = p.waves;
  if (!w) return [];
  return (Array.isArray(w) ? w : (w[sport] ?? [])) as CalWave[];
}

const near = (day: string) => {
  const c = cycleOf(day);
  return [...(c > 0 ? [c - 1] : []), c, c + 1];
};

/** Promos live on a day (some run a few days into the next season). */
export function promosOn(day: string): CalPromoOn[] {
  return near(day)
    .flatMap(promosOfCycle)
    .filter((p) => p.start <= day && day <= p.end);
}

/** Packs and SBCs of the cycles around a day, shifted and suffixed. */
export function packsOn(day: string): (CalPack & { season: CalSeason; cycle: number })[] {
  return near(day).flatMap((c) =>
    seasonsOfCycle(c).flatMap((se) =>
      se.raw.packs
        .map((p) => ({ ...p, id: p.id + cycleSuffix(c), start: addDays(p.start, c * CYCLE_DAYS), end: addDays(p.end, c * CYCLE_DAYS), season: se, cycle: c }))
        .filter((p) => p.start <= day && day <= p.end)
    )
  );
}
export function sbcsOn(day: string): (CalSbc & { season: CalSeason; cycle: number })[] {
  return near(day).flatMap((c) =>
    seasonsOfCycle(c).flatMap((se) =>
      se.raw.sbcs
        .map((b) => ({ ...b, id: b.id + cycleSuffix(c), promo: b.promo ? b.promo + cycleSuffix(c) : undefined, reward: { ...b.reward, ...(b.reward.card ? { card: b.reward.card + cycleSuffix(c) } : {}) }, start: addDays(b.start, c * CYCLE_DAYS), end: addDays(b.end, c * CYCLE_DAYS), season: se, cycle: c }))
        .filter((b) => b.start <= day && day <= b.end)
    )
  );
}

export interface Upcoming {
  date: string;
  title: string;
  band: [number, number];
  kind: 'promo' | 'wave';
}

/** The next n promo starts and waves after a day (names only: players are never revealed early). */
export function upcoming(day: string, n: number, sport: UtSport): Upcoming[] {
  const out: Upcoming[] = [];
  for (const p of near(day).flatMap(promosOfCycle)) {
    if (!per(p.count, sport)) continue;
    const name = per(p.name, sport) ?? p.baseId;
    if (p.start > day) out.push({ date: p.start, title: name, band: p.ovrBand, kind: 'promo' });
    for (const w of wavesOf(p, sport)) if (w.d > day && w.d !== p.start) out.push({ date: w.d, title: name + ' · ' + (per(w.label, sport) ?? 'next wave'), band: w.featured?.band ?? p.ovrBand, kind: 'wave' });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title < b.title ? -1 : 1)).slice(0, n);
}

/** The next season after the one a day is in. */
export function nextSeason(day: string): CalSeason | null {
  const cur = seasonOn(day);
  if (!cur) return null;
  return seasonOn(addDays(cur.end, 1));
}
