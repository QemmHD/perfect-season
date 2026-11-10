// Claude (packs-1, 2026-11-10): the promo hub contract between the packs and ut teams
// (docs/studio-overhaul/packs.md "Contracts"). ut's Hub, Store tab badge, objectives, Season Pass and
// Collection read promos through these functions only, so packs can change how waves, launches and
// program cards work without touching ut's screens.
//
// What works today: upcomingDrops (the Live Calendar's next promo starts and waves), storeBadge (its
// Daily Drop reason), programRewardCard and resolvedEditions. What fills in later, with the same
// signatures: liveNow and launchDue (packs-7: two Friday waves a week apart, a launch per wave, saved
// "seen" marks), Scout Stamps in storeBadge (packs-6) and the Season Pass cards (packs-7). Until then
// they return their empty answer: no live drop, nothing due, no Season card.
import { pickFor } from '../engine/sport';
import { hashString, rng } from '../engine/rng';
import { easternDateKey } from '../engine/season';
import { cycleOf, cycleSuffix, per, promoById, seasonsOfCycle, wavesOf } from './calendar';
import { dailyStatus } from './content-packs';
import { landmarkId } from './editions';
import { fcToDisplay } from './fc-scale';
import { landmarkCatalog } from './landmarks';
import { promoCards } from './live-cards';
import { type Pool, shortSeason } from './pool';
import { STAMP_SHELF_MIN, stampsBalance } from './stamps';
import type { UtState } from './state';
import type { RatedCard, UtSport } from './types';

/** Something live (or just launched) that ut's Hub, Store hero and badge can point at. */
export interface LiveDrop {
  /** 'drop:<promoId>:w<i>' (a program wave) | 'standouts:<week>' | 'flash:<window>' */
  id: string;
  kind: 'program' | 'wave' | 'standouts' | 'landmark' | 'flash';
  title: string;
  subtitle?: string;
  /** the program's two accent colours */
  accent: [string, string];
  /** ms */
  start: number;
  end: number;
  /** displayed overall band */
  band?: [number, number];
  /** the released headliner, never an unreleased card */
  heroCardId?: string;
  /** the first 48 hours */
  isNew: boolean;
  /** program-slot odds are boosted until then (ms) */
  boosted?: { until: number };
  cta: { view: 'program' | 'store' | 'standouts' | 'sbc'; arg?: string };
}

/** A drop that hasn't started: its name and band only (players are never revealed early). */
export interface UpcomingDrop {
  /** 'drop:<promoId>:w<i>' */
  id: string;
  title: string;
  /** ms: midnight Eastern on its date */
  start: number;
  /** displayed overall band */
  band: [number, number];
}

/** Midnight US-Eastern on an Eastern date, in ms (EST or EDT as that night has it). */
export function easternStart(day: string): number {
  const utc = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  let offset = 5;
  try {
    // 05:00 UTC is 00:00 in EST or 01:00 in EDT on that date
    offset = 5 - Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(utc + 5 * 3600000)));
  } catch {
    // no time-zone data: EST
  }
  return utc + offset * 3600000;
}

/** What is live now (program waves, this week's Standouts, flash windows). Filled by packs-7. */
export function liveNow(_pool: Pool, _ut: UtState, _at: number): LiveDrop[] {
  return [];
}

/** The next `n` promo starts and waves after `at`, soonest first. Empty in soccer (no Live Calendar yet). */
export function upcomingDrops(sport: UtSport, at: number, n = 3): UpcomingDrop[] {
  const day = easternDateKey(new Date(at));
  const c = cycleOf(day);
  const out: UpcomingDrop[] = [];
  for (const cycle of [c, c + 1])
    for (const season of seasonsOfCycle(cycle))
      for (const raw of season.raw.promos) {
        const promo = promoById(raw.id + cycleSuffix(cycle));
        if (!promo || !per(promo.count, sport)) continue;
        const name = per(promo.name, sport) ?? promo.baseId;
        const waves = wavesOf(promo, sport);
        const starts = waves.length ? waves.map((w, i) => ({ d: w.d, i, label: per(w.label, sport), band: w.featured?.band ?? promo.ovrBand })) : [{ d: promo.start, i: 0, label: undefined, band: promo.ovrBand }];
        for (const w of starts)
          if (w.d > day)
            out.push({
              id: 'drop:' + promo.id + ':w' + w.i,
              title: w.i ? name + ' · ' + (w.label ?? 'Wave ' + (w.i + 1)) : name,
              start: easternStart(w.d),
              band: [fcToDisplay(w.band[0], sport), fcToDisplay(w.band[1], sport)],
            });
      }
  return out.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1)).slice(0, n);
}

/** The drop whose launch moment is due (shown once per drop), or null. Filled by packs-7. */
export function launchDue(pool: Pool, ut: UtState, at: number): LiveDrop | null {
  return liveNow(pool, ut, at).find((d) => d.isNew) ?? null;
}

/** The state with a drop's launch marked as seen. Records nothing until packs-7 adds the saved marks. */
export function markLaunchSeen(ut: UtState, _id: string): UtState {
  return ut;
}

/** What the Store tab's badge counts: a new wave, today's unclaimed Daily Drop, stamps to spend. */
export function storeBadge(pool: Pool, ut: UtState, at: number): { n: number; reasons: ('wave' | 'daily' | 'stamps')[] } {
  const reasons: ('wave' | 'daily' | 'stamps')[] = [];
  if (liveNow(pool, ut, at).some((d) => d.isNew)) reasons.push('wave');
  if (dailyStatus(ut, easternDateKey(new Date(at))).ready) reasons.push('daily');
  if (stampsBalance(ut) >= STAMP_SHELF_MIN) reasons.push('stamps');
  return { n: reasons.length, reasons };
}

/**
 * A program's card for one of ut's reward slots (the program objective group): one of its released,
 * non-featured cards, the same one for the same seed. Null before the program starts (or in soccer).
 */
export function programRewardCard(pool: Pool, promoId: string, slot: 'objective', seed: string, day = easternDateKey()): RatedCard | null {
  const released = promoCards(pool, promoId, day);
  const list = released.filter((rc) => !rc.line.featured);
  const from = list.length ? list : released;
  if (!from.length) return null;
  return from[Math.floor(rng(hashString('program-reward:' + slot + ':' + promoId + ':' + seed))() * from.length)];
}

/** The Season Pass's named cards (research §8.7: A at level 10, B at 20, the headliner at 30). Filled by packs-7. */
export function seasonPassCard(_pool: Pool, _day: string, _slot: 'A' | 'B' | 'headliner'): RatedCard | null {
  return null;
}

export type EditionKind = 'promo' | 'legend' | 'spotlight' | 'goat' | 'landmark';
const KIND_LABEL: Record<EditionKind, string> = { promo: 'Hot Season', legend: 'Legend', spotlight: 'Spotlight', goat: 'GOAT', landmark: 'Landmark' };

/** Every permanent special edition of these kinds (ut's Collection), best first. */
export function resolvedEditions(pool: Pool, kinds: EditionKind[]): { id: string; kind: EditionKind; label: string; ovr: number }[] {
  const out: { id: string; kind: EditionKind; label: string; ovr: number }[] = [];
  const add = (kind: EditionKind, rc: RatedCard | undefined) => rc && out.push({ id: rc.line.id, kind, label: rc.line.name + ' · ' + KIND_LABEL[kind] + ' ' + shortSeason(rc.line), ovr: rc.ovr });
  for (const kind of kinds) {
    if (kind !== 'landmark') {
      for (const rc of Object.values(pool.buckets[kind]).flat()) add(kind, rc);
      continue;
    }
    // soccer has no Landmark Seasons
    if (!pickFor(pool.sport, { nba: true, nfl: true, soccer: false })) continue;
    for (const sid of landmarkCatalog(pool.lines).keys()) {
      const season = pool.byId.get(sid);
      if (season) add(kind, pool.base.get(landmarkId(season)));
    }
  }
  return out.sort((a, b) => b.ovr - a.ovr || (a.id < b.id ? -1 : 1));
}
