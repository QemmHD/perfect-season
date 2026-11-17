// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4; audit H4/M10, research "the Hub"): what UT
// Home shows around its one hero (the next best action, next-action.ts):
//   - Live Now: what is running right now, each with the clock it ends on (amber under 24 h, the kit's
//     Countdown) and a "new" dot while unseen (seen.ts);
//   - Upcoming: what starts next (tomorrow's Daily Drop day, Monday's weekly reset, the next Season
//     Pass season, the Live Calendar's next drops by name only);
//   - the Season card (M10 within the current 25-level scheme): the top reward from day 1, the next
//     named reward and the levels to it, the season's clock;
//   - today's three objectives;
//   - tomorrow's teaser for Done for today (the rule itself is next-action.ts loopDone).
// Every clock is an Eastern-midnight instant, so it is right across DST changes. Every item leads to a
// screen that exists in this sport (soccer has no Club Season, Legends Events or Moments, and no Live
// Calendar).
import { easternClock, dropStatus, DROP_STREAK_DAYS } from './claimables';
import { daysBetween, nextSeason, per, promosOn, upcoming } from './calendar';
import { lightningWindow } from './content-packs';
import { LABEL } from './labels';
import { battlesNow, packName, plural, rivalsNext, RUNGS } from './next-action';
import { DAILY, hqOf, objectiveDeck, seasonFor, seasonReward, SEASON_STEP, SEASON_TIERS, weekKey, type Objective } from './objectives';
import { showDot } from './seen';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { UtView } from './UltimateTeam';

const HOUR = 3600000,
  DAY_MS = 24 * HOUR;

/** Views a sport does not have (soccer: no Club Season, Legends Events or Moments). */
export const HIDDEN_VIEWS: Record<UtSport, UtView[]> = { nba: [], nfl: [], soccer: ['league', 'events', 'moments'] };
export const viewShown = (view: UtView, sport: UtSport) => !HIDDEN_VIEWS[sport].includes(view);

/** The calendar day after an Eastern date key. */
export function dayAfter(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + DAY_MS).toISOString().slice(0, 10);
}

/** The instant an Eastern day starts (midnight in New York, EST or EDT as that day has it). */
export function etStart(day: string): number {
  for (const off of ['-05:00', '-04:00']) {
    const t = Date.parse(day + 'T00:00:00' + off);
    const c = easternClock(t);
    if (c.day === day && c.hoursLeft === 24) return t;
  }
  return Date.parse(day + 'T00:00:00-05:00');
}
/** When today ends (the next Eastern midnight). */
export const endOfDay = (day: string) => etStart(dayAfter(day));
/** When this ISO week ends (Monday 00:00 Eastern), for weekly ladders, Rivals and Standouts. */
export function endOfWeek(day: string): number {
  let d = dayAfter(day);
  for (let i = 0; i < 7 && weekKey(d) === weekKey(day); i++) d = dayAfter(d);
  return etStart(d);
}

// ---------- Live Now ----------

export interface FeedItem {
  /** stable: 'drop', 'battles', 'rivals', 'circuit', 'standouts', 'lightning', 'promo:<id>' */
  id: string;
  eyebrow: string;
  title: string;
  line: string;
  /** when it ends (epoch ms) */
  endsAt: number;
  view: UtView;
  /** unseen and actionable: a "new" dot */
  fresh: boolean;
  /** the token that marks it seen (seen.ts key `live:<id>`) */
  token: string;
}

/** What runs right now in this sport, soonest-ending first. */
export function liveNow(ut: UtState, sport: UtSport, now: number): FeedItem[] {
  const { day } = easternClock(now),
    week = weekKey(day),
    weekEnd = endOfWeek(day),
    out: Omit<FeedItem, 'fresh'>[] = [];
  const drop = dropStatus(ut, day);
  out.push({
    id: 'drop',
    eyebrow: drop.ready ? 'FREE TODAY' : 'CLAIMED TODAY',
    title: LABEL.dailyDrop,
    line: drop.ready ? 'Day ' + drop.streak + ' of ' + DROP_STREAK_DAYS + (drop.streak === DROP_STREAK_DAYS ? ' · plus a Gold Pack' : ' · a free pack') : 'Day ' + drop.streak + ' done · Day ' + ((drop.streak % DROP_STREAK_DAYS) + 1) + ' tomorrow',
    endsAt: endOfDay(day),
    view: 'daily',
    token: day + ':' + (drop.ready ? 'ready' : 'done'),
  });
  const lw = lightningWindow(now);
  if (lw)
    out.push({
      id: 'lightning',
      eyebrow: 'STORE · 25% OFF',
      title: 'Lightning Standout',
      line: 'A Weekly Standout guaranteed',
      endsAt: Math.ceil(now / 60000) * 60000 + lw.minutesLeft * 60000,
      view: 'store',
      token: lw.id,
    });
  const b = battlesNow(ut, week);
  out.push({
    id: 'battles',
    eyebrow: 'THIS WEEK',
    title: LABEL.squadBattles,
    line: b.cleared >= RUNGS ? 'Ladder cleared · a new one Monday' : 'Rung ' + (b.rung + 1) + ' of ' + RUNGS + ' · new ladder Monday',
    endsAt: weekEnd,
    view: 'battles',
    token: week,
  });
  const rn = rivalsNext(ut, week);
  out.push({
    id: 'rivals',
    eyebrow: 'THIS WEEK',
    title: LABEL.rivals,
    line: rn ? plural(rn.wins, 'win') + ' to ' + rn.name + ' · ' + packName(rn.pack, sport) : 'Every division reward earned',
    endsAt: weekEnd,
    view: 'rivals',
    token: week,
  });
  const c = hqOf(ut).circuit.active;
  out.push({
    id: 'circuit',
    eyebrow: 'THIS WEEK',
    title: LABEL.championsCircuit,
    line: c ? c.wins + '–' + (c.games - c.wins) + ' · match ' + Math.min(6, c.games + 1) + ' of 6' : 'Six matches · titles at 2, 4 and 6 wins',
    endsAt: weekEnd,
    view: 'circuit',
    token: week,
  });
  out.push({ id: 'standouts', eyebrow: 'THIS WEEK', title: LABEL.weeklyStandouts, line: 'New cards every Monday', endsAt: weekEnd, view: 'standouts', token: week });
  // the Live Calendar's programs (NBA and NFL; soccer has no Live Calendar)
  if (sport !== 'soccer')
    for (const p of promosOn(day).filter((x) => per(x.count, sport)))
      out.push({ id: 'promo:' + p.id, eyebrow: 'PROGRAM', title: per(p.name, sport) ?? p.baseId, line: 'Program packs in the Store', endsAt: endOfDay(p.end), view: 'store', token: p.id });
  return out
    .filter((x) => viewShown(x.view, sport) && x.endsAt > now)
    .sort((a, b) => a.endsAt - b.endsAt || (a.id < b.id ? -1 : 1))
    .map((x) => ({ ...x, fresh: showDot(ut, 'live:' + x.id, x.token, x.id === 'drop' ? x.token.endsWith('ready') : true) }));
}

// ---------- Upcoming ----------

export interface UpcomingItem {
  id: string;
  /** "TOMORROW", "MON", "FRI NOV 21" */
  when: string;
  title: string;
  at: number;
}

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function whenOf(today: string, day: string): string {
  const n = daysBetween(today, day),
    d = new Date(day + 'T12:00:00Z');
  if (n === 1) return 'TOMORROW';
  if (n < 7) return WD[d.getUTCDay()];
  return WD[d.getUTCDay()] + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
}

/** What starts next: tomorrow's drop, the weekly reset, the next Season Pass season, calendar drops. */
export function upcomingFeed(ut: UtState, sport: UtSport, now: number, n = 4): UpcomingItem[] {
  const { day } = easternClock(now),
    tomorrow = dayAfter(day),
    out: UpcomingItem[] = [];
  const t = dropStatus(ut, tomorrow);
  out.push({ id: 'drop', when: 'TOMORROW', title: LABEL.dailyDrop + ' · Day ' + t.streak + (t.streak === DROP_STREAK_DAYS ? ' + a Gold Pack' : ''), at: etStart(tomorrow) });
  const monday = new Date(endOfWeek(day)),
    mondayKey = easternClock(monday.getTime()).day;
  out.push({ id: 'week', when: whenOf(day, mondayKey), title: 'New ' + LABEL.squadBattles + ' ladder, ' + LABEL.rivals + ' week and ' + LABEL.weeklyStandouts, at: monday.getTime() });
  const s = seasonFor(day),
    next = dayAfter(s.end);
  out.push({ id: 'pass', when: whenOf(day, next), title: LABEL.seasonPass + ' · ' + seasonFor(next).title + ' begins', at: etStart(next) });
  if (sport !== 'soccer') {
    for (const u of upcoming(day, 3, sport)) out.push({ id: 'cal:' + u.date + ':' + u.title, when: whenOf(day, u.date), title: u.title, at: etStart(u.date) });
    const ns = nextSeason(day);
    if (ns && ns.start > day && daysBetween(day, ns.start) <= 14) out.push({ id: 'cal-season:' + ns.start, when: whenOf(day, ns.start), title: 'Season ' + String(ns.n).padStart(2, '0') + ': ' + ns.name, at: etStart(ns.start) });
  }
  const seen = new Set<string>();
  return out
    .filter((x) => x.at > now && !seen.has(x.id) && seen.add(x.id))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
    .slice(0, n);
}

// ---------- the Season card (M10) ----------

export interface SeasonCard {
  title: string;
  level: number;
  tiers: number;
  /** SP into the current level, of SEASON_STEP */
  into: number;
  /** the top reward, shown from day 1 */
  top: { tier: number; pack: string; name: string; coins: number };
  /** the next level that pays a pack, the levels to it and its name; null once the track is done */
  next: { tier: number; levels: number; name: string; pack: string } | null;
  endsAt: number;
  /** claimable levels now */
  ready: number;
}

export function seasonCard(ut: UtState, sport: UtSport, now: number): SeasonCard {
  const { day } = easternClock(now),
    s = seasonFor(day),
    track = hqOf(ut).seasons[s.id] ?? { xp: 0, claimed: [] },
    level = Math.min(SEASON_TIERS, Math.floor(track.xp / SEASON_STEP)),
    topR = seasonReward(SEASON_TIERS);
  let next: SeasonCard['next'] = null;
  for (let t = level + 1; t <= SEASON_TIERS && !next; t++) {
    const r = seasonReward(t);
    if (r.pack) next = { tier: t, levels: t - level, name: packName(r.pack, sport), pack: r.pack };
  }
  return {
    title: s.title,
    level,
    tiers: SEASON_TIERS,
    into: level >= SEASON_TIERS ? SEASON_STEP : track.xp - level * SEASON_STEP,
    top: { tier: SEASON_TIERS, pack: topR.pack!, name: packName(topR.pack!, sport), coins: topR.coins ?? 0 },
    next,
    endsAt: endOfDay(s.end),
    ready: Array.from({ length: level }, (_, i) => i + 1).filter((t) => !track.claimed.includes(t)).length,
  };
}

// ---------- today's objectives and Done for today ----------

export interface TodayCard {
  rows: { id: string; text: string; progress: number; target: number; done: boolean; claimed: boolean }[];
  done: number;
}
export function todayCard(ut: UtState, day: string, deck: Objective[] = objectiveDeck(ut, day)): TodayCard {
  const rows = deck
    .filter((o) => o.group === 'daily' && o.period === day)
    .slice(0, DAILY.length)
    .map((o) => ({ id: o.id, text: o.title, progress: Math.min(o.progress, o.target), target: o.target, done: o.claimed || o.progress >= o.target, claimed: o.claimed }));
  return { rows, done: rows.filter((r) => r.done).length };
}

/** Tomorrow's teaser for Done for today and the session summary: "Daily Drop Day 3 of 7 · 3 new objectives". */
export function tomorrowLine(ut: UtState, now: number): string {
  const { day } = easternClock(now),
    t = dropStatus(ut, dayAfter(day));
  return LABEL.dailyDrop + ' Day ' + t.streak + ' of ' + DROP_STREAK_DAYS + ' · ' + DAILY.length + ' new ' + LABEL.objectives.toLowerCase();
}

