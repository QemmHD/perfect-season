// Claude (packs-3, 2026-11-16; split out of flash.ts in the packs-3 review fixes): the Friday program
// boost. From each program wave's Friday 18:00 Eastern for 48 hours, the program slot of that promo's
// program packs is 1.5 times as likely, at most 60%. A function of the Eastern clock and the schedule, the
// same on every device. Small on purpose: live-packs.ts loads with the profile (first paint).
import { addDays, per, promoById, wavesOf } from './calendar';
import type { CalPromoOn } from './calendar';
import { easternAt } from './lightning';
import type { UtSport } from './types';

const HOUR = 3600000;

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
