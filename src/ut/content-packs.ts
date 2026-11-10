import { pickFor as bySport } from '../engine/sport';
// Claude, 2026-11-01: the new packs' rules outside their slots (packs.ts holds the slots and odds):
// purchase limits, the weekend Lightning windows, the Daily Drop and its 7-day streak, and pick
// sheets (Scout's Choice, Standout picks): three face-down options, exactly one kept.
// All of it opens locally like Gold/Premium (UltimateTeam openNow); nothing uses the card registry.
import { hashString, rng, shuffle } from '../engine/rng';
import { easternDateKey } from '../engine/season';
import { per, promosOn } from './calendar';
import { claimed, contentOf, withClaim, withContent, type PickState } from './content-state';
import { promoCards } from './live-cards';
import { packRand, SCOUT_STANDOUT } from './packs';
import type { Pool } from './pool';
import { fcToDisplay } from './fc-scale';
import { weekOf } from './sbc';
import { standoutProgram } from './standouts';
import type { UtState } from './state';
import { organizeStorage } from './storage';
import type { OwnedCard, RatedCard, UtSport } from './types';

// ---------- purchase limits ----------

export type LimitedKind = 'elite' | 'jumbo' | 'scout' | 'standout' | 'lightning' | 'swap';
export const LIMITS: Record<LimitedKind, { per: 'day' | 'week' | 'window'; n: number }> = {
  elite: { per: 'day', n: 2 },
  jumbo: { per: 'day', n: 1 },
  scout: { per: 'week', n: 3 },
  standout: { per: 'week', n: 1 },
  lightning: { per: 'window', n: 1 },
  swap: { per: 'day', n: 3 },
};

/** Weekend Lightning windows, Eastern time: Saturday and Sunday, 12–2 pm and 8–10 pm. */
export const LIGHTNING_HOURS = [12, 20];
export const LIGHTNING_LENGTH_H = 2;

function easternParts(at: number): { day: string; weekday: number; hour: number; minute: number } {
  const d = new Date(at);
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
    return { day: g('year') + '-' + g('month') + '-' + g('day'), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), hour: Number(g('hour')) % 24, minute: Number(g('minute')) };
  } catch {
    return { day: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
}

/** The Lightning window open at `at` ("2026-11-07:12"), with minutes left, or null. */
export function lightningWindow(at: number): { id: string; minutesLeft: number } | null {
  const e = easternParts(at);
  if (e.weekday !== 0 && e.weekday !== 6) return null;
  for (const h of LIGHTNING_HOURS)
    if (e.hour >= h && e.hour < h + LIGHTNING_LENGTH_H) return { id: e.day + ':' + h, minutesLeft: (h + LIGHTNING_LENGTH_H - e.hour) * 60 - e.minute };
  return null;
}

/** Minutes until the next Lightning window opens (0 while one is open). */
export function minutesToLightning(at: number): number {
  if (lightningWindow(at)) return 0;
  const e = easternParts(at);
  const start = at - e.minute * 60000;
  for (let h = 1; h <= 24 * 8; h++) if (lightningWindow(start + h * 3600000)) return Math.max(1, h * 60 - e.minute);
  return 0;
}

export function limitKey(kind: LimitedKind, day: string, at: number): string | null {
  const per = LIMITS[kind].per;
  if (per === 'day') return kind + ':' + day;
  if (per === 'week') return kind + ':' + weekOf(day);
  const w = lightningWindow(at);
  return w ? kind + ':' + w.id : null;
}

/** How many more of a limited pack can be bought now (0 outside a Lightning window). */
export function buysLeft(ut: UtState, kind: LimitedKind, day: string, at: number): number {
  const key = limitKey(kind, day, at);
  if (!key) return 0;
  return Math.max(0, LIMITS[kind].n - (contentOf(ut).buys?.[key] ?? 0));
}

/** The purchase counted (old periods' counters drop). */
export function recordBuy(ut: UtState, kind: LimitedKind, day: string, at: number): UtState {
  const key = limitKey(kind, day, at);
  if (!key) return ut;
  const week = weekOf(day);
  return withContent(ut, (c) => {
    const kept = Object.fromEntries(Object.entries(c.buys ?? {}).filter(([k]) => k.includes(day) || k.includes(week) || (kind === 'lightning' && k.startsWith('lightning:'))).slice(-40));
    return { ...c, buys: { ...kept, [key]: (kept[key] ?? 0) + 1 } };
  });
}

// ---------- the Daily Drop ----------

export const STREAK_DAYS = 7;

export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

/** Today's drop: ready to claim or not, and the streak day it is (or was) for. */
export function dailyStatus(ut: UtState, day: string): { ready: boolean; streak: number } {
  const d = contentOf(ut).daily;
  if (d?.day === day) return { ready: false, streak: d.streak };
  const cont = d && d.day === previousDay(day);
  return { ready: true, streak: cont ? (d!.streak % STREAK_DAYS) + 1 : 1 };
}

/**
 * Claim today's Daily Drop once: the streak moves on (a missed day starts it over at 1); its seventh
 * day also deposits a Gold pack. Returns null when today's is already claimed.
 */
export function claimDaily(ut: UtState, day: string, at: number): { ut: UtState; streak: number; gold: boolean } | null {
  const s = dailyStatus(ut, day);
  if (!s.ready) return null;
  const c = contentOf(ut);
  const gold = s.streak === STREAK_DAYS;
  const goldId = 'daily-gold:' + day;
  const next: UtState = {
    ...ut,
    content: { ...c, daily: { day, streak: s.streak, total: (c.daily?.total ?? 0) + 1 } },
    packs: gold && !ut.packs.some((p) => p.id === goldId) ? [...ut.packs, { id: goldId, kind: 'gold', at }] : ut.packs,
  };
  return { ut: next, streak: s.streak, gold };
}

/** The Daily Drop's pack id (its copies' uids are `pack:daily-<day>:<i>`). */
export const dailyPackId = (sport: UtSport, day: string) => 'daily-' + sport + '-' + day;

// ---------- picks: three face down, keep one ----------

/** Football's Scout's Choice comes from one position group. */
const NFL_GROUPS: [string, string[]][] = [
  ['Quarterbacks', ['QB']],
  ['Running backs', ['RB']],
  ['Pass catchers', ['WR', 'TE']],
  ['Offensive line', ['OT', 'OG', 'C']],
  ['Defensive line', ['DE', 'DT']],
  ['Linebackers', ['LB']],
  ['Secondary', ['CB', 'S']],
];

/** Scout's Choice: three different players, golds at basketball's 84+, deterministic from the seed. */
export function scoutOptions(pool: Pool, seed: string, week: string): { options: RatedCard[]; group: string } {
  const rand = packRand('scout:' + seed);
  const floor = fcToDisplay(84, pool.sport);
  let positions: string[] | null = null;
  let group = 'Any position';
  if (pool.sport === 'nfl') {
    const g = NFL_GROUPS[Math.floor(rand() * NFL_GROUPS.length)];
    positions = g[1];
    group = g[0];
  }
  const golds = Object.entries(pool.buckets.gold)
    .filter(([pos]) => !positions || positions.includes(pos))
    .flatMap(([, list]) => list)
    .filter((rc) => rc.line.kind === 'season' && rc.ovr >= floor)
    .sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const standouts = standoutProgram(pool, week).cards.filter((rc) => !positions || positions.includes(rc.line.pos[0]));
  const out: RatedCard[] = [];
  const pids = new Set<string>();
  const usedPos = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const so = standouts.filter((rc) => !pids.has(rc.line.pid));
    let pick: RatedCard | undefined;
    if (rand() < SCOUT_STANDOUT && so.length) pick = so[Math.floor(rand() * so.length)];
    else {
      // basketball: three different positions when it can
      const fresh = golds.filter((rc) => !pids.has(rc.line.pid) && (pool.sport === 'nfl' || !usedPos.has(rc.line.pos[0])));
      const list = fresh.length ? fresh : golds.filter((rc) => !pids.has(rc.line.pid));
      pick = list[Math.floor(rand() * list.length)];
    }
    if (!pick) break;
    pids.add(pick.line.pid);
    usedPos.add(pick.line.pos[0]);
    out.push(pick);
  }
  return { options: out, group };
}

/** A Standout pick: three different Standouts of the week (featured among them by chance). */
export function standoutOptions(pool: Pool, seed: string, week: string): RatedCard[] {
  const all = standoutProgram(pool, week).cards;
  return shuffle(all, rng(hashString('standout-pick:' + seed))).slice(0, 3);
}

/** A pick sheet saved into the state (once per id). */
export function addPick(ut: UtState, pick: PickState): UtState {
  const c = contentOf(ut);
  if (claimed(ut, 'pick:' + pick.id) || c.picks?.some((p) => p.id === pick.id)) return ut;
  return { ...ut, content: { ...c, picks: [...(c.picks ?? []), pick] } };
}

export function pickFor(pool: Pool, kind: 'scout' | 'standout-pick' | 'swap', id: string, week: string, at: number): PickState {
  if (kind === 'standout-pick') return { id, kind, title: 'Standout Pick', options: standoutOptions(pool, id, week).map((rc) => rc.line.id), at };
  const s = scoutOptions(pool, id, week);
  return { id, kind, title: kind === 'swap' ? 'Swap Desk · Scout’s Choice' : "Scout's Choice" + bySport(pool.sport, { nba: '', nfl: ' · ' + s.group, soccer: '' }), options: s.options.map((rc) => rc.line.id), at };
}

// ---------- reward picks for the ut team (packs-1 contract; research §8.2) ----------

/** Claude (packs-1): the picks ut's rewards hand out (Rivals bounties, the weekly chest, the Season Pass). */
export type AwardPickKind = 'front-office' | 'pick-82' | 'program-pick';

/** Gold picks: how many options, from which overall (basketball's scale, shown on the sport's own). */
const GOLD_PICKS: Record<'front-office' | 'pick-82', { n: number; floor: number; title: string }> = {
  'front-office': { n: 5, floor: 80, title: 'Front Office Pick' },
  'pick-82': { n: 3, floor: 82, title: 'Player Pick' },
};
/** Programs whose cards a Program Pick offers (the Finale and Landmark programs are SBC rewards only). */
const PICK_PROGRAMS = new Set(['program', 'honors']);

/** `n` different players among the season golds at `floor`+, the same ones for the same seed. */
function goldOptions(pool: Pool, floor: number, n: number, seed: string): RatedCard[] {
  const min = fcToDisplay(floor, pool.sport);
  const golds = Object.values(pool.buckets.gold)
    .flat()
    .filter((rc) => rc.line.kind === 'season' && rc.ovr >= min)
    .sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const rand = packRand('award-pick:' + seed);
  const out: RatedCard[] = [];
  const pids = new Set<string>();
  for (let k = 0; out.length < n && k < n * 40 && golds.length; k++) {
    const c = golds[Math.floor(rand() * golds.length)];
    if (pids.has(c.line.pid)) continue;
    pids.add(c.line.pid);
    out.push(c);
  }
  return out;
}

/**
 * Claude (packs-1): award a reward pick under the reward's own id. It joins the open pick sheets (face
 * down until opened, exactly one card kept with keepPick, uid `pick:<id>`), once per id. front-office:
 * 1 of 5 golds 80+; pick-82: 1 of 3 golds 82+; program-pick: 1 of 3 of the current program's released
 * cards, or a pick-82 when no program is live (and always in soccer, which has no Live Calendar yet).
 */
export function awardPick(ut: UtState, pool: Pool, kind: AwardPickKind, id: string, at: number): UtState {
  if (kind === 'program-pick') {
    const day = easternDateKey(new Date(at));
    const promo = promosOn(day)
      .filter((p) => PICK_PROGRAMS.has(p.kind))
      .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
      .find((p) => promoCards(pool, p.id, day).length);
    if (promo) {
      const released = promoCards(pool, promo.id, day);
      const plain = released.filter((rc) => !rc.line.featured);
      const options = shuffle(plain.length >= 3 ? plain : released, rng(hashString('program-pick:' + id))).slice(0, 3);
      return addPick(ut, { id, kind, title: (per(promo.name, pool.sport) ?? 'Program') + ' Pick', options: options.map((rc) => rc.line.id), at });
    }
    return awardPick(ut, pool, 'pick-82', id, at);
  }
  const g = GOLD_PICKS[kind];
  const options = goldOptions(pool, g.floor, g.n, kind + ':' + id);
  if (!options.length) return ut;
  return addPick(ut, { id, kind, title: g.title + ' · ' + fcToDisplay(g.floor, pool.sport) + '+', options: options.map((rc) => rc.line.id), at });
}

/**
 * Keep option `index` of an open pick: exactly one card joins the club (uid `pick:<id>`), the sheet
 * closes, and the claim id `pick:<id>` makes a retry a no-op.
 */
export function keepPick(ut: UtState, id: string, index: number, at: number): { ut: UtState; card: OwnedCard | null } {
  const c = contentOf(ut);
  const pick = c.picks?.find((p) => p.id === id);
  if (!pick || claimed(ut, 'pick:' + id) || !Number.isInteger(index) || index < 0 || index >= pick.options.length) return { ut, card: null };
  const card: OwnedCard = { uid: 'pick:' + id, cardId: pick.options[index], level: 1, xp: 0, at };
  if (ut.owned.some((o) => o.uid === card.uid)) return { ut, card: null };
  const next = withClaim({ ...ut, content: { ...c, picks: (c.picks ?? []).filter((p) => p.id !== id) } }, 'pick:' + id);
  return { ut: organizeStorage(next, [card]), card };
}
