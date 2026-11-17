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
// key when the page hides); one when an activity banks; menu seconds at most once a minute, and only
// when they count (an idle or menu-only device writes nothing, so it never starts a cloud upload).
// This is not simulation code and never runs on a frame path: one interval and one capture input listener.
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
  /** raw visible seconds per weekday of `week` (the Profile panel; absent on ledgers before ut-3) */
  rawWeek?: number[];
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
    rawWeek: same ? p.rawWeek : zeros(),
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
    weekActs = p.weekActs.slice(),
    rawWeek = (p.rawWeek ?? zeros()).slice();
  weekDays[wd] = daySec;
  weekActs[wd] += c.act;
  rawWeek[wd] += c.raw;
  return {
    ...p, daySec, dayMenuSec: menu, weekDays, weekActs, rawWeek,
    rawDaySec: p.rawDaySec + c.raw,
    rawLife: p.rawLife + c.raw,
    life: p.life + gain,
    bySport: { ...p.bySport, [c.sport]: (p.bySport[c.sport] ?? 0) + gain },
    acts: p.acts + c.act,
  };
}

export interface PlaytimeView {
  today: { min: number; rawMin: number; menuMin: number; frozen: boolean };
  week: { min: number; rawMin: number; days: number[] };
  life: { hours: number; rawHours: number; bySport: Record<SportId, number> };
  done: boolean;
}

/** Today, this week and lifetime, counted and raw, as of `now` (a stale ledger reads as zero). */
export function playtimeView(p: Pick<Profile, 'playtime'>, now = Date.now()): PlaytimeView {
  const day = etDay(now),
    pt = p.playtime,
    t = pt && pt.day === day ? pt : undefined,
    thisWeek = !!pt && pt.week === isoWeek(day),
    w = thisWeek ? pt.weekDays : zeros(),
    sum = (a: number[]) => a.reduce((x, y) => x + y, 0),
    m = (s = 0) => Math.floor(s / 60),
    h = (s = 0) => Math.floor(s / 360) / 10;
  return {
    today: { min: m(t?.daySec), rawMin: m(t?.rawDaySec), menuMin: m(t?.dayMenuSec), frozen: !!pt && day < pt.day },
    // raw time is at least the counted time and today's raw time (a ledger from before rawWeek has only part of the week)
    week: { min: m(sum(w)), rawMin: m(Math.max(sum(w), thisWeek ? sum(pt.rawWeek ?? []) : 0, t?.rawDaySec ?? 0)), days: w.map(m) },
    life: { hours: h(pt?.life), rawHours: h(pt?.rawLife), bySport: { nba: h(pt?.bySport.nba), nfl: h(pt?.bySport.nfl), soccer: h(pt?.bySport.soccer) } },
    done: (t?.daySec ?? 0) >= DAY_CAP,
  };
}

/**
 * One line for a pause sheet: "Today 27 min · next reward at 30". It adds the play seconds this phone
 * has counted but not banked yet (`unbanked`, by default the match in progress), so a pause mid-match
 * reads the real total. They go through `credit`, so the day and week caps apply; the menu buffer is
 * left out (the 25% rule may not count it), so the line never reads above what the match banks when
 * it completes. (A forfeit under 120 s banks nothing: the line is the match's expected total.)
 */
export function playtimeLine(p: Pick<Profile, 'playtime'>, now = Date.now(), unbanked = pendingSec()): string {
  const v = playtimeView(p, now);
  if (v.today.frozen) return 'Minutes paused: the date changed';
  const q = credit(p.playtime, { sec: Math.max(0, Math.floor(unbanked)), menu: 0, raw: 0, sport: SPORT, act: 0 }, now),
    min = (q.day === etDay(now) ? q.daySec : 0) / 60 | 0,
    next = DAY_RUNGS.find((r) => r > min);
  return 'Today ' + min + ' min · ' + (next ? 'next reward at ' + next : 'done for today');
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
  /** the Eastern day it started on */
  day?: string;
}
/** What one tab parked in the device-only pending key (one entry per tab id). */
interface Pend {
  day: string;
  provs: Prov[];
  play: number;
  menu: number;
  raw: number;
  acts: number;
}
type Sink = (fn: (p: Profile) => Profile) => void;

const hosts: Host[] = [];
const used = new Map<string, number>();
/** activities already banked (a second call is a no-op) */
const banked: string[] = [];
/** recent inputs: time (ms), x, y */
const inputs: number[] = [];
/** provisional activities by id, oldest first: a run left for a match and resumed later keeps its seconds */
const provs = new Map<string, Prov>();
let sink: Sink | null = null,
  /** the profile's ledger as it is now (App's ref), so a flush happens only when it changes what counts */
  read: (() => Playtime | undefined) | undefined,
  /** the provisional activity on screen */
  cur: Prov | undefined,
  /** this tab's entry in the pending key, as last written */
  pk: Pend | null = null,
  /** the Eastern day the menu and raw buffers belong to */
  bufDay = '';
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
  started = false,
  held = false,
  asked = -1e9,
  /** navigator.locks, read once (the getter is not free) */
  L: LockManager | undefined,
  free: (() => void) | null = null;
const me = Math.random(),
  ME = String(me);
/** the break reminder's watcher: each counting tick, the seconds counted and the screen's context */
let watcher: ((sec: number, ctx: PlayCtx | undefined, t: number) => void) | null = null;
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

/** The activity's provisional record. A new one drops those of an earlier day, and the oldest past 4. */
function provOf(a: Activity): Prov {
  let p = provs.get(a.id);
  if (!p) {
    const day = etDay(Date.now());
    for (const [k, q] of provs) if (q.day !== day || provs.size >= 4) provs.delete(k);
    provs.set(a.id, (p = { id: a.id, sport: a.sport, kind: a.kind, sec: 0, age: 0, day }));
  }
  return p;
}

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
  cur = a && (cur?.id === a.id ? cur : provOf(a));
  if (cur) cur.age += dt;
  if (!lead(t, on)) return;
  raw += dt;
  let counted = 0;
  if (on && h && r) {
    const key = r[1] ? h.ctx + ':' + (h.act?.id ?? h.n) : '',
      u = (key && used.get(key)) || 0;
    if ((h.ctx !== 'match' || varied(t, cur?.age ?? 0)) && (!key || u < r[1])) {
      counted = dt;
      if (key) used.set(key, u + dt);
      if (cur) cur.sec += dt;
      else if (r[2] || !h.act) menu += dt;
      else play += dt;
    }
  }
  watcher?.(counted, h?.ctx, t);
  // menus bank at most once a minute, and only when that changes what counts: raw time and menu
  // seconds with no room under the 25% rule wait in memory (and the pending key) for the next real bank
  if (!live(h) && t - flushed >= 60000) {
    flushed = t;
    if (gains()) flush();
  }
}

/** Would banking the buffers now count a second or a completed activity? (Raw time alone never writes.) */
function gains(): boolean {
  const now = Date.now(),
    day = etDay(now);
  // menu and raw seconds of a day that has ended never count on the next one
  if (bufDay !== day) {
    if (bufDay) menu = raw = 0;
    bufDay = day;
  }
  if (acts) return true;
  if (play + menu < 1) return false;
  const p = read?.(),
    q = credit(p, { sec: Math.floor(play), menu: Math.floor(menu), raw: 0, sport: SPORT, act: 0 }, now);
  return q.daySec > (p?.day === q.day ? p.daySec : 0);
}

/** Bank the buffers (and a finished activity) into the profile: one write. */
function flush(done?: Prov, complete = false) {
  if (!sink) {
    if (done) (play += done.sec), (acts += complete ? 1 : 0);
    return;
  }
  reclaim();
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
  const now = Date.now();
  sink((p) => ({ ...p, playtime: credit(p.playtime, c, now, !p.playtime && !p.stats.games && !p.history.length && !(p.ut.record.w + p.ut.record.l + p.ut.record.h2hW + p.ut.record.h2hL)) }));
}

/** The pending key: one entry per tab id. (ut-2's first shape was one record, read as one entry.) */
function pend(): Record<string, Pend> {
  try {
    const s = JSON.parse(localStorage.getItem(PENDING) ?? 'null');
    return !s ? {} : s.tabs ?? { old: { ...s, provs: s.prov ? [s.prov] : [] } };
  } catch {
    return {};
  }
}
function keep(tabs: Record<string, Pend>): boolean {
  try {
    if (Object.keys(tabs).length) localStorage.setItem(PENDING, JSON.stringify({ tabs }));
    else localStorage.removeItem(PENDING);
    return true;
  } catch {
    return false; // storage blocked
  }
}

/**
 * This tab's parked seconds come back to memory only. If another tab started meanwhile and took
 * them (its entry is gone), they are that tab's now, so they leave this one: counted once.
 */
function reclaim() {
  if (!pk) return;
  const tabs = pend();
  if (tabs[ME]) {
    delete tabs[ME];
    keep(tabs);
  } else {
    play = Math.max(0, play - pk.play);
    menu = Math.max(0, menu - pk.menu);
    raw = Math.max(0, raw - pk.raw);
    acts = Math.max(0, acts - pk.acts);
    for (const q of pk.provs) {
      const p = provs.get(q.id);
      if (p) p.sec = Math.max(0, p.sec - q.sec);
    }
  }
  pk = null;
}

/** The page is hiding: what is not banked yet goes to this tab's entry in the device-only pending key (no profile write). */
function park() {
  reclaim();
  if (!provs.size && menu + play + raw < 1) return;
  const tabs = pend(),
    e: Pend = { day: etDay(Date.now()), provs: [...provs.values()].map((p) => ({ ...p })), play, menu, raw, acts };
  tabs[ME] = e;
  if (keep(tabs)) pk = e;
}

function start() {
  if (started || typeof document === 'undefined') return;
  started = true;
  last = flushed = clock();
  L = navigator.locks;
  // a relaunch the same day takes what earlier pages parked (ut-6 settles a killed match); older days are dropped
  const day = (bufDay = etDay(Date.now())),
    tabs = pend();
  let took = false;
  for (const [k, s] of Object.entries(tabs)) {
    delete tabs[k];
    if (s?.day !== day) continue;
    took = true;
    play += s.play || 0;
    menu += s.menu || 0;
    raw += s.raw || 0;
    acts += s.acts || 0;
    for (const q of s.provs ?? []) if (q?.id) provs.set(q.id, { ...q, day: q.day ?? day });
  }
  if (took) tabs[ME] = { day, provs: [...provs.values()].map((p) => ({ ...p })), play, menu, raw, acts };
  if (keep(tabs) && took) pk = tabs[ME];
  for (const type of ['pointerdown', 'pointermove', 'keydown']) document.addEventListener(type, onInput, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? (park(), letGo()) : ((last = clock()), reclaim())));
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
  const had = !!pk;
  reclaim();
  const p = provs.get(id);
  provs.delete(id);
  if (cur?.id === id) cur = undefined;
  if (how === 'complete') {
    banked.push(id);
    if (banked.length > 16) banked.shift();
    flush(p, true);
  } else if (p && p.age >= 120) flush(p);
  else if (had) park();
}

/**
 * Counted play seconds not in the profile yet: the activity on screen and the play buffer. The menu
 * buffer is left out: the 25% menu rule decides at the bank how much of it counts.
 */
export function pendingSec(): number {
  return Math.floor((cur?.sec ?? 0) + play);
}

/** The break reminder (src/ui/BreakReminder.tsx): told every second this tab ticks. One watcher. */
export function watchPlaytime(fn: typeof watcher): () => void {
  watcher = fn;
  start();
  return () => {
    if (watcher === fn) watcher = null;
  };
}

/** A sport's pause menu: nothing counts while paused. */
export function setPlaytimePaused(v: boolean): void {
  paused = v;
}

/**
 * App, once: where banked seconds go (the profile update), and how to read the ledger as it is now
 * (so menus write only when the 25% rule lets their seconds count).
 */
export function registerPlaytimeSink(update: Sink, ledger?: () => Playtime | undefined): () => void {
  sink = update;
  read = ledger;
  start();
  return () => {
    if (sink === update) (sink = null), (read = undefined);
  };
}
