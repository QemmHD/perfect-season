// Claude (packs-3, 2026-11-16): the Store's time-limited moments (research §8.2; packs-plan packs-3 items 5–6).
//
//   Lightning windows   2 of the 4 weekend slots each ISO week (Sat 12–2 pm, Sat 8–10 pm, Sun 1–3 pm,
//                       Sun 7–9 pm Eastern; live-calendar.json defaults.flashWindows), chosen by the seed
//                       'flash:' + week, so everyone has the same two. The Lightning Standout is 25% off
//                       inside one, 1 per player per window (limit key `lightning:<day>:<hour>`, unchanged).
//   Named flash sales   the Live Calendar's seasons[].flash entries ("Black Friday Blitz", "Big Game
//                       Flash", ...): in each of their windows, "<pack>@-N%" sells that pack N% off,
//                       1 per player per sale day (limit key `flash:<sale>:<pack>:<day>`), and
//                       "swap-desk 4-for-1" makes a swap take 4 duplicates instead of 5. Any other offer
//                       text is ignored (flashOfferIssues lists them for the tests).
//   Program boost       from each program wave's Friday 18:00 Eastern for 48 hours, the program slot of
//                       that promo's program packs is 1.5 times as likely, at most 60%.
// Everything is a function of the Eastern clock and the schedule, the same on every device.
import { hashString, rng } from '../engine/rng';
import { addDays, cycleOf, cycleSuffix, packsOn, per, promoById, seasonsOfCycle, wavesOf } from './calendar';
import type { CalPromoOn } from './calendar';
import { weekOf } from './sbc';
import type { UtSport } from './types';

const HOUR = 3600000;

/** Eastern wall-clock parts of an instant. */
export function easternParts(at: number): { day: string; weekday: number; hour: number; minute: number } {
  const d = new Date(at);
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
    return { day: g('year') + '-' + g('month') + '-' + g('day'), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), hour: Number(g('hour')) % 24, minute: Number(g('minute')) };
  } catch {
    return { day: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
}

/** The instant of an Eastern wall-clock time (EST or EDT as that moment has it). */
export function easternAt(day: string, hour = 0, minute = 0): number {
  const utc = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), hour, minute);
  for (const off of [5, 4]) {
    const at = utc + off * HOUR;
    const e = easternParts(at);
    if (e.day === day && e.hour === hour && e.minute === minute) return at;
  }
  return utc + 5 * HOUR;
}

/** The ISO weekday (Mon 0 … Sun 6) offset of a date from its week's Monday. */
const mondayOf = (day: string) => {
  const wd = new Date(day + 'T12:00:00Z').getUTCDay();
  return addDays(day, -((wd + 6) % 7));
};
/** The Monday of an ISO week ("2026-W48"). */
export function weekMonday(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4)).toISOString().slice(0, 10);
  return addDays(mondayOf(jan4), (w - 1) * 7);
}

// ---------- Lightning windows ----------

/** The four weekend slots (days after the week's Monday, Eastern start hour), 2 hours each. */
export const LIGHTNING_SLOTS: readonly { d: 5 | 6; h: number; label: string }[] = [
  { d: 5, h: 12, label: 'Sat 12:00-14:00' },
  { d: 5, h: 20, label: 'Sat 20:00-22:00' },
  { d: 6, h: 13, label: 'Sun 13:00-15:00' },
  { d: 6, h: 19, label: 'Sun 19:00-21:00' },
];
export const LIGHTNING_PER_WEEKEND = 2;
export const LIGHTNING_LENGTH_H = 2;
/** The Lightning Standout's discount on the Standout Guarantee. */
export const LIGHTNING_DISCOUNT = 0.25;

export interface Window {
  /** `<Eastern day>:<start hour>`, the limit key's suffix */
  id: string;
  day: string;
  hour: number;
  start: number;
  end: number;
}

/** A week's two Lightning windows, earliest first (seeded by 'flash:' + week). */
export function flashWindowsOf(week: string): Window[] {
  const rand = rng(hashString('flash:' + week));
  const idx = [0, 1, 2, 3];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const mon = weekMonday(week);
  return idx
    .slice(0, LIGHTNING_PER_WEEKEND)
    .sort((a, b) => a - b)
    .map((i) => {
      const s = LIGHTNING_SLOTS[i];
      const day = addDays(mon, s.d);
      const start = easternAt(day, s.h);
      return { id: day + ':' + s.h, day, hour: s.h, start, end: start + LIGHTNING_LENGTH_H * HOUR };
    });
}

/** The Lightning window open at `at`, with minutes left, or null. */
export function lightningWindow(at: number): { id: string; minutesLeft: number } | null {
  const w = flashWindowsOf(weekOf(easternParts(at).day)).find((x) => x.start <= at && at < x.end);
  return w ? { id: w.id, minutesLeft: Math.ceil((w.end - at) / 60000) } : null;
}

/** The next Lightning window that hasn't ended (this week's or next week's). */
export function nextLightning(at: number): Window | null {
  const week = weekOf(easternParts(at).day);
  const next = weekOf(addDays(weekMonday(week), 7));
  return [...flashWindowsOf(week), ...flashWindowsOf(next)].find((w) => w.end > at) ?? null;
}

// ---------- named season flash sales ----------

interface RawFlash {
  id: string;
  name: string;
  d: string;
  windows: string[];
  hours: number;
  offers: string[];
}

export interface FlashSale {
  /** the sale's id with the cycle suffix ("s2-black-friday", "s2-black-friday-y2") */
  id: string;
  name: string;
  day: string;
  start: number;
  end: number;
  offers: FlashOffer[];
  /** a swap takes this many duplicates during the window (the Swap Desk normally takes 5) */
  swapSize?: number;
}

export interface FlashOffer {
  /** this build's pack kind: a Store kind or a program pack id ("live:s2-feast-week") */
  kind: string;
  /** the discount, 0..1 */
  off: number;
  /** the limit key: `flash:<sale>:<kind>:<day>` */
  key: string;
}

/** Store kinds the schedule names in flash offers. */
const OFFER_KIND: Record<string, string> = { 'jumbo-premium': 'jumbo', 'elite-gold': 'elite', 'scout-choice': 'scout', 'standout-guarantee': 'standout', premium: 'premium', gold: 'gold' };

/** The dates a sale's `d` names ("2026-11-27", or "every Sat 2027-07-10..2027-08-07"), shifted by `shift` days. */
function saleDays(d: string, shift: number): string[] {
  const one = /^\d{4}-\d{2}-\d{2}$/.exec(d);
  if (one) return [addDays(d, shift)];
  const every = /^every (Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(d);
  if (!every) return [];
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(every[1]);
  const out: string[] = [];
  for (let x = every[2]; x <= every[3]; x = addDays(x, 1)) if (new Date(x + 'T12:00:00Z').getUTCDay() === wd) out.push(addDays(x, shift));
  return out;
}

/** One offer string as this build understands it, or null (the offer is ignored). */
export function parseOffer(text: string, suffix: string): { kind: string; off: number } | { swapSize: number } | null {
  const sale = /^([a-z0-9:-]+)@-(\d{1,2})%$/.exec(text.trim());
  if (sale) {
    const off = Number(sale[2]) / 100;
    const kind = sale[1].startsWith('live:') ? sale[1] + suffix : OFFER_KIND[sale[1]];
    return kind && off > 0 && off < 1 ? { kind, off } : null;
  }
  const swap = /^swap-desk (\d)-for-1\b/.exec(text.trim());
  if (swap && Number(swap[1]) >= 2) return { swapSize: Number(swap[1]) };
  return null;
}

/** The raw flash entries of a cycle's seasons. */
function rawSales(cycle: number): { raw: RawFlash; shift: number; suffix: string }[] {
  return seasonsOfCycle(cycle).flatMap((se) => ((se.raw as unknown as { flash?: RawFlash[] }).flash ?? []).map((raw) => ({ raw, shift: cycle * 364, suffix: cycleSuffix(cycle) })));
}

/**
 * The named flash sales running at `at` (their window open), with the offers this build can sell in
 * `sport`: a Store pack, or a program pack on sale that day.
 */
export function flashSalesAt(at: number, sport: UtSport): FlashSale[] {
  const day = easternParts(at).day;
  const out: FlashSale[] = [];
  const c = cycleOf(day);
  for (const cycle of c > 0 ? [c - 1, c] : [c])
    for (const { raw, shift, suffix } of rawSales(cycle))
      for (const d of saleDays(raw.d, shift))
        for (const w of raw.windows) {
          const m = /^(\d{2}):(\d{2})$/.exec(w);
          if (!m) continue;
          const start = easternAt(d, Number(m[1]), Number(m[2]));
          const end = start + raw.hours * HOUR;
          if (at < start || at >= end) continue;
          const id = raw.id + suffix;
          const sale: FlashSale = { id, name: raw.name, day: d, start, end, offers: [] };
          for (const text of raw.offers) {
            const o = parseOffer(text, suffix);
            if (!o) continue;
            if ('swapSize' in o) sale.swapSize = o.swapSize;
            else if (o.kind.startsWith('live:') ? packsOn(d).some((p) => p.id === o.kind) && sport !== 'soccer' : true) sale.offers.push({ kind: o.kind, off: o.off, key: 'flash:' + id + ':' + o.kind + ':' + d });
          }
          if (sale.offers.length || sale.swapSize) out.push(sale);
        }
  return out;
}

/** Offer strings in the scheduled year this build ignores (for the tests: logged, never thrown). */
export function flashOfferIssues(): string[] {
  return rawSales(0).flatMap(({ raw }) => raw.offers.filter((t) => !parseOffer(t, '')).map((t) => raw.id + ': ' + t));
}

/** Every named flash sale window of the scheduled year (for the tests and the measurements). */
export function scheduledFlashWindows(): { id: string; day: string; start: number; end: number }[] {
  return rawSales(0).flatMap(({ raw }) =>
    saleDays(raw.d, 0).flatMap((d) =>
      raw.windows.map((w) => {
        const [h, m] = w.split(':').map(Number);
        const start = easternAt(d, h, m);
        return { id: raw.id, day: d, start, end: start + raw.hours * HOUR };
      }),
    ),
  );
}

/** A flash price: the Store price N% off, to the nearest 50 coins. */
export const flashPrice = (price: number, off: number) => Math.max(50, Math.round((price * (1 - off)) / 50) * 50);

/** How many duplicates the Swap Desk takes at `at` (4 inside a "swap-desk 4-for-1" window). */
export const SWAP_SIZE = 5;
export function swapSize(at: number, sport: UtSport): number {
  return flashSalesAt(at, sport).find((s) => s.swapSize)?.swapSize ?? SWAP_SIZE;
}

// ---------- the Friday program boost ----------

/** Program-slot odds × this during a boost, at most BOOST_CAP. */
export const BOOST = 1.5;
export const BOOST_CAP = 0.6;
export const BOOST_HOURS = 48;

/** The days a promo releases cards: its start, or each of its waves. */
function releaseDays(p: CalPromoOn, sport: UtSport): string[] {
  const w = wavesOf(p, sport);
  return w.length ? w.map((x) => x.d) : [p.start];
}

/**
 * A promo's boost windows: from the Friday on or after each release day (within the promo's run),
 * 18:00 Eastern, for 48 hours.
 */
export function boostWindows(promoId: string, sport: UtSport): { start: number; end: number }[] {
  const p = promoById(promoId);
  if (!p || !per(p.count, sport)) return [];
  const fridays = new Set<string>();
  for (const d of releaseDays(p, sport)) {
    let f = d;
    while (new Date(f + 'T12:00:00Z').getUTCDay() !== 5) f = addDays(f, 1);
    if (f <= p.end) fridays.add(f);
  }
  return [...fridays].sort().map((f) => {
    const start = easternAt(f, 18);
    return { start, end: start + BOOST_HOURS * HOUR };
  });
}

/** The boost on a promo's program packs at `at`: until when, or null. */
export function boostOf(promoId: string, sport: UtSport, at: number): { until: number } | null {
  const w = boostWindows(promoId, sport).find((x) => x.start <= at && at < x.end);
  return w ? { until: w.end } : null;
}

/** The boosted program-slot chance. */
export const boosted = (p: number) => Math.min(BOOST_CAP, p * BOOST);
