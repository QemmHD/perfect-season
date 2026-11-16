// Claude (packs-3, 2026-11-16; split out of flash.ts in the packs-3 review fixes): the Eastern clock and
// the weekend Lightning windows. Two of the four weekend slots (Sat 12–2 pm, Sat 8–10 pm, Sun 1–3 pm,
// Sun 7–9 pm Eastern) each ISO week, chosen by the seed 'flash:' + week, so everyone has the same two. The
// Lightning Standout is 25% off inside one, 1 per player per window (limit key `lightning:<day>:<hour>`).
// It is small and imports no sales or boosts, because content-packs.ts (loaded with the profile, at first
// paint) needs it; flash.ts re-exports everything here.
import { hashString, rng } from '../engine/rng';
import { addDays } from './calendar';
import { weekOf } from './sbc';

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
