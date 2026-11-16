// Claude, 2026-11-16 (studio overhaul, team ut; Game Design V2 E.1, E.2, E.3, E.8; contract W1 in
// docs/studio-overhaul/ut.md): MINUTES, the active-time ticker and its ledger.
//
// A 1 Hz ticker on performance.now() deltas counts a second only when the app is visible and
// focused, this is the one ticking tab (a Web Lock), and the screen's context has had recent input:
//   match 45 s (plus input variety), draft 30 s, menus 20 s; a SIM counts its real time;
//   a draft season sim at most 3 min per run, a queue 2 min, replays and reward screens 2 min a match.
// Match and draft seconds are provisional: they bank when the host calls bankActivity('complete'),
// or on a forfeit after 120 s. Menu seconds bank every 60 s and are at most 25% of the day.
// Caps 5,400 s a day and 37,800 a week, keyed by the Eastern day and ISO week. A day key earlier
// than the ledger's (the clock went back) freezes accrual for that day.
//
// Writes: none during a match (provisional seconds stay in memory, and in the device-only pending
// key when the page hides); one when an activity banks; menu seconds at most once a minute. This is
// not simulation code and never runs on a frame path: one interval and one capture input listener.
import { useEffect } from 'react';
import { SPORT, type SportId } from '../engine/sport';
import type { Profile } from './profile';

export type PlayCtx = 'match' | 'sim' | 'draft' | 'draftSim' | 'menu' | 'queue' | 'replay' | 'off';
export interface Activity {
  id: string;
  sport: SportId;
  kind: 'match' | 'draft' | 'daily';
}

/** profile.playtime (V2 E.3, plan §2): additive, cross-sport (`SHARED`), seconds unless named. */
export interface Playtime {
  v: 1;
  life: number;
  rawLife: number;
  /** Eastern day key; counted, menu and raw seconds that day */
  day: string;
  daySec: number;
  dayMenuSec: number;
  rawDaySec: number;
  /** ISO week (weekKey); counted seconds and completed activities per weekday, Monday first */
  week: string;
  weekDays: number[];
  bySport: Record<SportId, number>;
  acts: number;
  weekActs: number[];
  /** rung indexes claimed (src/ut/minutes.ts), for the day and week named */
  claimed: { day: number[]; week: number[]; life: number[]; dayKey?: string; weekKey?: string };
  league: { tier: number; season: string; best: number; lastWeek?: { week: string; rank: number; am: number; moved: -1 | 0 | 1 } };
  /** the day a rested bonus applies (first day back after 3+ days away) */
  restedDay?: string;
  /** the clock went back to this day: nothing counts on it */
  frozenDay?: string;
  /** the day a new player's 3-minute head start applies (endowed progress) */
  endowed?: string;
  /** receipts of rewards another team's API pays out (Scout Stamps, Player Picks): never lost */
  owed?: string[];
  /** cross-sport hook state (Scout Drops, Hot Hand, Career Road) when profile.career is not granted */
  hook?: Record<string, number | string | string[]>;
}

export const DAY_CAP = 5400;
export const WEEK_CAP = 37800;
/** The daily ladder's rungs in minutes (src/ut/minutes.ts pays them). */
export const DAY_RUNGS = [5, 15, 30, 60, 90];
/** Endowed progress: a new player's first ladder day starts this many seconds in. */
export const ENDOWED_SEC = 180;

// ---------- days and weeks ----------

/** The Eastern date key, as engine/season.ts easternDateKey (every browser the app runs in has Intl time zones). */
export const etDay = (now: number): string => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const utc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
/** Days from a to b. */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5);
/** Monday = 0 … Sunday = 6. */
export const weekday = (day: string) => (new Date(utc(day)).getUTCDay() + 6) % 7;
/** ISO week, as net/leaderboard.ts weekKey ("2026-W47"). */
export function isoWeek(day: string): string {
  const t = new Date(utc(day));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  return y + '-W' + String(Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0');
}

// ---------- the ledger (pure) ----------

const zeros = () => [0, 0, 0, 0, 0, 0, 0];
export function freshPlaytime(day: string, endowed = false): Playtime {
  const week = isoWeek(day);
  return {
    v: 1, life: 0, rawLife: 0, day, daySec: 0, dayMenuSec: 0, rawDaySec: 0, week, weekDays: zeros(),
    bySport: { nba: 0, nfl: 0, soccer: 0 }, acts: 0, weekActs: zeros(),
    claimed: { day: [], week: [], life: [], dayKey: day, weekKey: week },
    league: { tier: 0, season: '', best: 0 },
    ...(endowed ? { endowed: day } : {}),
  };
}

/** The ledger moved to `day` (later than its own): a new day, maybe a new week, maybe rested. */
export function rollTo(p: Playtime, day: string): Playtime {
  if (day <= p.day) return p;
  const week = isoWeek(day),
    same = week === p.week;
  const q: Playtime = {
    ...p, day, daySec: 0, dayMenuSec: 0, rawDaySec: 0, week,
    weekDays: same ? p.weekDays : zeros(),
    weekActs: same ? p.weekActs : zeros(),
    claimed: { ...p.claimed, day: [], dayKey: day, ...(same ? {} : { week: [], weekKey: week }) },
  };
  if (p.life > 0 && daysBetween(p.day, day) - 1 >= 3) q.restedDay = day;
  delete q.frozenDay;
  return q;
}

export interface Credit {
  /** counted seconds of play (provisional seconds that banked, replay and sim time) */
  sec: number;
  /** counted menu seconds (the 25% rule applies) */
  menu: number;
  /** raw visible seconds (private, display only) */
  raw: number;
  sport: SportId;
  /** 1 when an activity completed */
  act: number;
}

/** Add seconds to the ledger at `now`, with the caps, the menu rule and the clock freeze. */
export function credit(pt: Playtime | undefined, c: Credit, now: number, endowed = false): Playtime {
  const day = etDay(now);
  let p = pt ?? freshPlaytime(day, endowed);
  if (day < p.day) return { ...p, frozenDay: day, rawLife: p.rawLife + c.raw };
  p = rollTo(p, day);
  const wd = weekday(day),
    others = p.weekDays.reduce((a, b) => a + b, 0) - p.weekDays[wd],
    cap = Math.min(DAY_CAP, WEEK_CAP - others),
    play = Math.min(p.daySec - p.dayMenuSec + c.sec, cap),
    menu = Math.max(p.dayMenuSec, Math.min(p.dayMenuSec + c.menu, Math.floor(play / 3), cap - play)),
    daySec = Math.max(p.daySec, play + menu),
    gain = daySec - p.daySec,
    weekDays = p.weekDays.slice(),
    weekActs = p.weekActs.slice();
  weekDays[wd] = daySec;
  weekActs[wd] += c.act;
  return {
    ...p, daySec, dayMenuSec: menu, weekDays, weekActs,
    rawDaySec: p.rawDaySec + c.raw,
    rawLife: p.rawLife + c.raw,
    life: p.life + gain,
    bySport: { ...p.bySport, [c.sport]: (p.bySport[c.sport] ?? 0) + gain },
    acts: p.acts + c.act,
  };
}

export interface PlaytimeView {
  today: { min: number; rawMin: number; menuMin: number; frozen: boolean };
  week: { min: number; days: number[] };
  life: { hours: number; rawHours: number; bySport: Record<SportId, number> };
  done: boolean;
}

/** Today, this week and lifetime, counted and raw, as of `now` (a stale ledger reads as zero). */
export function playtimeView(p: Pick<Profile, 'playtime'>, now = Date.now()): PlaytimeView {
  const day = etDay(now),
    pt = p.playtime,
    t = pt && pt.day === day ? pt : undefined,
    w = pt && pt.week === isoWeek(day) ? pt.weekDays : zeros(),
    m = (s = 0) => Math.floor(s / 60),
    h = (s = 0) => Math.floor(s / 360) / 10;
  return {
    today: { min: m(t?.daySec), rawMin: m(t?.rawDaySec), menuMin: m(t?.dayMenuSec), frozen: !!pt && day < pt.day },
    week: { min: m(w.reduce((a, b) => a + b, 0)), days: w.map(m) },
    life: { hours: h(pt?.life), rawHours: h(pt?.rawLife), bySport: { nba: h(pt?.bySport.nba), nfl: h(pt?.bySport.nfl), soccer: h(pt?.bySport.soccer) } },
    done: (t?.daySec ?? 0) >= DAY_CAP,
  };
}

/** One line for a pause sheet: "Today 27 min · next reward at 30". */
export function playtimeLine(p: Pick<Profile, 'playtime'>, now = Date.now()): string {
  const v = playtimeView(p, now);
  if (v.today.frozen) return 'Minutes paused: the date changed';
  const next = DAY_RUNGS.find((r) => r > v.today.min);
  return 'Today ' + v.today.min + ' min · ' + (next ? 'next reward at ' + next : 'done for today');
}

// ---------- the ticker ----------

/** [input window s (0 = none needed), cap per instance s (0 = none), menu-class, provisional] */
const RULES: Record<PlayCtx, readonly [number, number, number, number] | null> = {
  match: [45, 0, 0, 1],
  sim: [0, 0, 0, 1],
  draft: [30, 0, 0, 1],
  draftSim: [0, 180, 0, 1],
  menu: [20, 0, 1, 0],
  queue: [0, 120, 1, 0],
  replay: [0, 120, 0, 0],
  off: null,
};
const PENDING = 'perfect-season:playtime-pending:v1';
const LOCK = 'perfect-season:playtime-lock:v1';

interface Host {
  ctx: PlayCtx;
  act?: Activity;
  n: number;
}
interface Prov extends Activity {
  sec: number;
  age: number;
}
type Sink = (fn: (p: Profile) => Profile) => void;

const hosts: Host[] = [];
const used = new Map<string, number>();
/** activities already banked (a second call is a no-op) */
const banked: string[] = [];
/** recent inputs: time (ms), x, y */
const inputs: number[] = [];
let sink: Sink | null = null;
let prov: Prov | null = null;
let play = 0,
  menu = 0,
  raw = 0,
  acts = 0,
  hostN = 0,
  lastIn = -1e9,
  lastMove = -1e9,
  last = 0,
  flushed = 0,
  paused = false,
  parked = false,
  started = false,
  held = false,
  asked = -1e9,
  /** navigator.locks, read once (the getter is not free) */
  L: LockManager | undefined,
  free: (() => void) | null = null;
const me = Math.random();
const clock = () => performance.now();

function onInput(e: Event) {
  const t = clock(),
    pe = e as PointerEvent;
  if (e.type === 'pointermove') {
    if (t - lastMove < 250) return;
    lastMove = t;
  }
  lastIn = t;
  // keys have no point: each key is its own spot, so one key held down is one spot
  const x = e.type === 'keydown' ? -1e4 - ((e as KeyboardEvent).keyCode || 0) * 20 : pe.clientX ?? 0;
  inputs.push(t, x, e.type === 'keydown' ? 0 : pe.clientY ?? 0);
  if (inputs.length > 192) inputs.splice(0, 3);
}

/** E.1.5: enough inputs in the last 60 s of a match (1 per 10 s of it, up to 6), not all on one spot. */
function varied(t: number, age: number): boolean {
  const need = Math.min(6, Math.floor(age / 10));
  let n = 0,
    x0 = 0,
    y0 = 0,
    spread = false;
  for (let i = 0; i < inputs.length; i += 3) {
    if (t - inputs[i] > 60000) continue;
    if (!n++) (x0 = inputs[i + 1]), (y0 = inputs[i + 2]);
    else if (Math.hypot(inputs[i + 1] - x0, inputs[i + 2] - y0) > 8) spread = true;
  }
  return n >= need && (need < 2 || spread);
}

/**
 * Only one tab ticks: the visible, focused tab holds a Web Lock (no message every second, so it costs
 * nothing while held). Without Web Locks, a storage lock: a tab with something to count claims it
 * and the lowest id seen lately wins; an idle tab yields.
 */
function lead(t: number, claim: boolean): boolean {
  if (L) {
    if (!held && t - asked > 2000) {
      asked = t;
      L.request(LOCK, { ifAvailable: true }, (l) => (l ? new Promise<void>((r) => ((held = true), (free = r))) : undefined)).catch(() => {});
    }
    return held;
  }
  try {
    const now = Date.now(),
      l = JSON.parse(localStorage.getItem(LOCK) ?? 'null') as { id: number; at: number } | null;
    if (l && l.id !== me && now - l.at < 2500 && (l.id < me || !claim)) return false;
    if (claim) localStorage.setItem(LOCK, JSON.stringify({ id: me, at: now }));
  } catch {
    // storage blocked: this tab ticks alone
  }
  return true;
}
/** Hidden or unfocused: another tab may tick. */
function letGo() {
  free?.();
  free = null;
  held = false;
}

/** The screen that decides: an explicit 'off' first, then any activity context over menus, then the latest. */
const rank = (h: Host) => (h.ctx === 'off' ? 2 : h.ctx === 'menu' ? 0 : 1);
const top = (): Host | undefined => {
  let h: Host | undefined;
  for (const x of hosts) if (!h || rank(x) >= rank(h)) h = x;
  return h;
};
const live = (h?: Host) => !!(h && h.act && RULES[h.ctx]?.[3]);

function tick() {
  const t = clock(),
    dt = Math.min(2, (t - last) / 1000);
  last = t;
  if (dt <= 0 || document.visibilityState !== 'visible' || !document.hasFocus()) return letGo();
  // a finished activity's screen counts nothing more until the screen changes
  const h = top(),
    r = h && !paused ? RULES[h.ctx] : null,
    done = !!(r?.[3] && h?.act && banked.includes(h.act.id)),
    a = r?.[3] && !done ? h?.act : undefined,
    on = !!(h && r && !done && (!r[0] || t - lastIn <= r[0] * 1000));
  // the activity's age (for the 120 s forfeit rule) runs whether or not the player is touching
  if (a && prov?.id !== a.id) prov = { ...a, sec: 0, age: 0 };
  if (a && prov) prov.age += dt;
  if (!lead(t, on)) return;
  raw += dt;
  if (on && h && r) {
    const key = r[1] ? h.ctx + ':' + (h.act?.id ?? h.n) : '',
      u = (key && used.get(key)) || 0;
    if ((h.ctx !== 'match' || varied(t, prov?.age ?? 0)) && (!key || u < r[1])) {
      if (key) used.set(key, u + dt);
      if (a && prov) prov.sec += dt;
      else if (r[2] || !h.act) menu += dt;
      else play += dt;
    }
  }
  if (!live(h) && t - flushed >= 60000 && (menu + play >= 1 || raw >= 600)) flush();
}

/** Bank the buffers (and a finished activity) into the profile: one write. */
function flush(done?: Prov, complete = false) {
  if (!sink) {
    if (done) (play += done.sec), (acts += complete ? 1 : 0);
    return;
  }
  const c: Credit = {
    sec: Math.floor(play) + Math.round(done?.sec ?? 0),
    menu: Math.floor(menu),
    raw: Math.floor(raw),
    sport: done?.sport ?? SPORT,
    act: acts + (complete ? 1 : 0),
  };
  play -= Math.floor(play);
  menu -= Math.floor(menu);
  raw -= Math.floor(raw);
  acts = 0;
  flushed = clock();
  if (parked) {
    parked = false;
    try {
      localStorage.removeItem(PENDING);
    } catch {
      // storage blocked
    }
  }
  const now = Date.now();
  sink((p) => ({ ...p, playtime: credit(p.playtime, c, now, !p.playtime && !p.stats.games && !p.history.length && !(p.ut.record.w + p.ut.record.l + p.ut.record.h2hW + p.ut.record.h2hL)) }));
}

/** The page is hiding: what is not banked yet goes to the device-only pending key (no profile write). */
function park() {
  if (!prov && menu + play + raw < 1) return;
  try {
    localStorage.setItem(PENDING, JSON.stringify({ day: etDay(Date.now()), prov, play, menu, raw, acts }));
    parked = true;
  } catch {
    // storage blocked
  }
}

function start() {
  if (started || typeof document === 'undefined') return;
  started = true;
  last = flushed = clock();
  L = navigator.locks;
  try {
    const s = JSON.parse(localStorage.getItem(PENDING) ?? 'null');
    if (s && s.day === etDay(Date.now())) {
      ({ play = 0, menu = 0, raw = 0, acts = 0 } = s);
      prov = s.prov ?? null;
      parked = true;
    } else if (s) localStorage.removeItem(PENDING);
  } catch {
    // a bad pending entry is dropped
  }
  for (const type of ['pointerdown', 'pointermove', 'keydown']) document.addEventListener(type, onInput, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? (park(), letGo()) : (last = clock())));
  addEventListener('pagehide', park);
  setInterval(tick, 1000);
}

/** A screen's context, until the returned function is called (usePlaytime's body). */
export function enterPlaytime(ctx: PlayCtx, act?: Activity): () => void {
  start();
  const h: Host = { ctx, act, n: ++hostN };
  hosts.push(h);
  return () => {
    hosts.splice(hosts.indexOf(h), 1);
  };
}

/** One line in a host component: what this screen is, and the activity it belongs to. */
export function usePlaytime(ctx: PlayCtx, activity?: Activity): void {
  const id = activity?.id,
    sport = activity?.sport,
    kind = activity?.kind;
  useEffect(() => enterPlaytime(ctx, id && sport && kind ? { id, sport, kind } : undefined), [ctx, id, sport, kind]);
}

/**
 * The match or run `id` finished (or was forfeited): its seconds bank now, in one write. A completed
 * activity counts once even when nothing of it was provisional (a whole-match SIM); a forfeit banks
 * only after 120 s of the match.
 */
export function bankActivity(id: string, how: 'complete' | 'forfeit'): void {
  if (banked.includes(id)) return;
  const p = prov?.id === id ? prov : undefined;
  if (p) prov = null;
  if (how === 'complete') {
    banked.push(id);
    if (banked.length > 16) banked.shift();
    flush(p, true);
  } else if (p && p.age >= 120) flush(p);
  else if (parked) park();
}

/** A sport's pause menu: nothing counts while paused. */
export function setPlaytimePaused(v: boolean): void {
  paused = v;
}

/** App, once: where banked seconds go (the profile update). */
export function registerPlaytimeSink(update: Sink): () => void {
  sink = update;
  start();
  return () => {
    if (sink === update) sink = null;
  };
}
