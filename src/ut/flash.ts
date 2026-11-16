// Claude (packs-3, 2026-11-16): the Store's time-limited moments (research §8.2; packs-plan packs-3 items 5–6).
//
// (packs-3 review fixes: the Lightning windows are in lightning.ts and the boost in boost.ts, both
// re-exported here, so the profile's first-paint modules don't load the sales.)
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
import { addDays, cycleOf, cycleSuffix, packsOn, seasonsOfCycle } from './calendar';
import { easternAt, easternParts } from './lightning';
import type { UtSport } from './types';

const HOUR = 3600000;

// Claude (packs-3 review fixes): the Eastern clock and the Lightning windows live in lightning.ts, a
// small module the profile's first-paint code (content-packs.ts) can load without the sales and boosts.
export { easternAt, easternParts, flashWindowsOf, LIGHTNING_DISCOUNT, LIGHTNING_LENGTH_H, LIGHTNING_PER_WEEKEND, LIGHTNING_SLOTS, lightningWindow, nextLightning, weekMonday, type Window } from './lightning';

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

// Claude (packs-3 review fixes): the Friday program boost lives in boost.ts (live-packs.ts loads with the
// profile, at first paint, and needs only the boost); re-exported here for the tests and tools.
export { BOOST, BOOST_CAP, BOOST_HOURS, boosted, boostOf, boostWindows } from './boost';
