// Claude, 2026-11-16 (studio overhaul, team ut; Game Design V2 E.5 and E.6; contract W5 in
// docs/studio-overhaul/ut.md): the MINUTES reward ladders, their claims and the weekly league maths.
// Pure functions over the ledger in src/lib/playtime.ts; no pool, packs or cards are imported.
//
// Daily ladder (resets midnight ET): 5 / 15 / 30 / 60 / 90 active minutes.
// Weekly ladder (ISO week): 60 / 150 / 300 / 450 / 600. Lifetime: 1 … 1,000 hours, power stops at 25.
// Time pays less than matches do (E.5): an engaged hour a day is ≈ 514 coin-equivalents, the hard
// ceiling (90 minutes every day) ≈ 750. MINUTES_TABLE is the lead's lever: 'lean' is all ladder coins
// × 0.6, the 60-minute Silver on weekdays only and a Gold for the 600 rung.
// Scout Stamps and the 25-hour Player Pick are paid by packs' APIs: until they land a claim records an
// owed receipt in `playtime.owed` (merged as a union, so it is never lost or paid twice).
import type { SportId } from '../engine/sport';
import { credit, DAY_CAP, DAY_RUNGS, ENDOWED_SEC, etDay, isoWeek, weekday, type Playtime } from '../lib/playtime';
import type { Profile } from '../lib/profile';

export type MinutesTable = 'full' | 'lean';
/** The lead's economy lever (plan §7, decision 1): 'full' by default. */
export const MINUTES_TABLE: MinutesTable = 'full';

export type Track = 'day' | 'week' | 'life';
export interface MinutesReward {
  coins?: number;
  pack?: 'silver' | 'gold' | 'premium';
  stamp?: number;
  /** a Player Pick: 1 of 3 golds, 84+ (packs' API) */
  pick?: boolean;
  /** a status mark: badge, frame, banner or week flair (cosmetic) */
  flair?: string;
  /** the 90-minute "Done for today" card */
  done?: boolean;
}
export interface Rung {
  /** minutes on this track */
  at: number;
  reward: MinutesReward;
}

const rung = (at: number, reward: MinutesReward): Rung => ({ at, reward });
const LIFE: Rung[] = [
  rung(60, { pack: 'gold', flair: 'Rookie' }),
  rung(300, { coins: 1000, flair: 'Starter' }),
  rung(600, { pack: 'premium', flair: 'Pro frame' }),
  rung(1500, { pick: true, flair: 'All-Star frame' }),
  rung(3000, { flair: 'MVP frame, banner and nameplate' }),
  rung(6000, { flair: 'Hall of Famer frame and a card finish' }),
  rung(15000, { flair: 'Legend title' }),
  rung(30000, { flair: 'Icon frame' }),
  rung(60000, { flair: 'GOAT crown' }),
];

/** The three ladders of a table (E.5; lean per F.6). */
export function ladders(table: MinutesTable): { daily: Rung[]; weekly: Rung[]; life: Rung[] } {
  const k = table === 'lean' ? 0.6 : 1,
    c = (n: number) => Math.round((n * k) / 5) * 5;
  return {
    daily: [
      rung(DAY_RUNGS[0], { coins: c(25) }),
      rung(DAY_RUNGS[1], { coins: c(50) }),
      rung(DAY_RUNGS[2], { coins: c(75), stamp: 1 }),
      rung(DAY_RUNGS[3], { pack: 'silver', coins: c(50) }),
      rung(DAY_RUNGS[4], { coins: c(50), done: true }),
    ],
    weekly: [
      rung(60, { coins: c(150) }),
      rung(150, { pack: 'silver' }),
      rung(300, { pack: 'gold' }),
      rung(450, { coins: c(400) }),
      rung(600, { pack: table === 'lean' ? 'gold' : 'premium', flair: 'Iron Man week' }),
    ],
    life: LIFE,
  };
}
export const LADDERS = ladders(MINUTES_TABLE);

/** Pack values at quick-sell (≈ half the NBA price), for the economy table only. */
export const PACK_VALUE = { silver: 200, gold: 450, premium: 900 } as const;
export function coinValue(r: MinutesReward): number {
  return (r.coins ?? 0) + (r.pack ? PACK_VALUE[r.pack] : 0);
}

const PACK_NAME = { silver: 'Silver Pack', gold: 'Gold Pack', premium: 'Premium Pack' } as const;
/** "Silver Pack + 50 coins", "75 coins + a Scout Stamp". */
export function rewardText(r: MinutesReward): string {
  return [
    r.pack && PACK_NAME[r.pack],
    r.coins && r.coins.toLocaleString('en-US') + ' coins',
    r.stamp && (r.stamp === 1 ? 'a Scout Stamp' : r.stamp + ' Scout Stamps'),
    r.pick && 'a Player Pick (84+)',
    !r.coins && !r.pack && !r.pick && r.flair,
  ]
    .filter(Boolean)
    .join(' + ');
}

export interface RungView {
  track: Track;
  i: number;
  at: number;
  /** what claiming it pays now (rested days double the first three daily coin rewards) */
  reward: MinutesReward;
  reached: boolean;
  claimed: boolean;
  minutesLeft: number;
}
export interface TrackView {
  min: number;
  rungs: RungView[];
  next: RungView | null;
}
export interface MinutesView {
  day: TrackView & { capped: boolean };
  week: TrackView;
  life: TrackView;
  /** reached and not claimed, every track */
  ready: RungView[];
  rested: boolean;
  frozen: boolean;
}

/** Whether a profile is new enough for the endowed head start (no ledger, no game played). */
export function freshForMinutes(p: Profile): boolean {
  const r = p.ut.record;
  return !p.playtime && !p.stats.games && !p.history.length && !(r.w + r.l + r.h2hW + r.h2hL);
}

function track(t: Track, rungs: Rung[], min: number, claimed: number[], rested: boolean, lean: boolean, today: string): TrackView {
  const views = rungs.map((r, i): RungView => {
    let reward = r.reward;
    if (rested && t === 'day' && i < 3) reward = { ...reward, coins: (reward.coins ?? 0) * 2 };
    // lean: the 60-minute Silver on weekdays only (coins stay)
    if (lean && t === 'day' && reward.pack && weekday(today) > 4) reward = { coins: reward.coins };
    return { track: t, i, at: r.at, reward, reached: min >= r.at, claimed: claimed.includes(i), minutesLeft: Math.max(0, r.at - min) };
  });
  return { min, rungs: views, next: views.find((v) => !v.reached) ?? null };
}

/** The three tracks as of `now`: progress, next rung, what is ready to claim. */
export function minutesView(pt: Playtime | undefined, now: number, fresh = false, table: MinutesTable = MINUTES_TABLE): MinutesView {
  const today = etDay(now),
    week = isoWeek(today),
    L = ladders(table),
    frozen = !!pt && today < pt.day,
    onDay = !!pt && pt.day === today,
    rested = !!pt && pt.restedDay === today,
    head = (pt ? pt.endowed === today : fresh) ? ENDOWED_SEC : 0,
    daySec = Math.min(DAY_CAP, (onDay ? (pt?.daySec ?? 0) : 0) + head),
    weekSec = pt && pt.week === week ? pt.weekDays.reduce((a, b) => a + b, 0) : 0,
    weekCredit = pt?.restedDay && isoWeek(pt.restedDay) === week ? 3600 : 0,
    cl = pt?.claimed;
  const d = track('day', L.daily, frozen ? 0 : Math.floor(daySec / 60), cl?.dayKey === today ? cl.day : [], rested, table === 'lean', today),
    w = track('week', L.weekly, Math.floor((weekSec + weekCredit) / 60), cl?.weekKey === week ? cl.week : [], false, false, today),
    l = track('life', L.life, Math.floor((pt?.life ?? 0) / 60), cl?.life ?? [], false, false, today);
  return {
    day: { ...d, capped: onDay && (pt?.daySec ?? 0) >= DAY_CAP },
    week: w,
    life: l,
    ready: [d, w, l].flatMap((x) => x.rungs.filter((r) => r.reached && !r.claimed)),
    rested,
    frozen,
  };
}

/** The nearest rung still to reach (any minute counts on all three tracks); the day wins a tie. */
export function nextRung(pt: Playtime | undefined, now: number, fresh = false): { track: Track; atMin: number; minutesLeft: number; reward: MinutesReward } | null {
  const v = minutesView(pt, now, fresh);
  let best: RungView | null = null;
  for (const n of [v.day.capped ? null : v.day.next, v.week.next, v.life.next]) if (n && (!best || n.minutesLeft < best.minutesLeft)) best = n;
  return best && { track: best.track, atMin: best.at, minutesLeft: best.minutesLeft, reward: best.reward };
}

/** The short form for a chip: "75 coins + stamp", "Silver Pack", "Player Pick" (a pack names itself). */
export function shortReward(r: MinutesReward): string {
  const head = r.pack ? PACK_NAME[r.pack] : r.pick ? 'Player Pick' : r.coins ? r.coins.toLocaleString('en-US') + ' coins' : (r.flair ?? '');
  return r.stamp && !r.pack ? head + ' + stamp' : head;
}

export interface MinutesChip {
  /** 'next': counting toward a rung; 'ready': a reached rung waits; 'done': 90 today, nothing waiting */
  state: 'next' | 'ready' | 'done';
  /** today's counted minutes (with a new player's head start), and the rung the ring fills toward */
  minutes: number;
  target: number;
  /** "75 coins + stamp next", "Silver Pack ready", "Great session." */
  reward: string;
  /** reached rungs waiting, every track */
  ready: number;
  frozen: boolean;
  rested: boolean;
}

/**
 * The Minutes ring chip (V2 E.9.1), for main Home and UT Home: "23 / 30 min · 75 coins + stamp next",
 * "Silver Pack ready", and at 90 "Done for today · Great session." once nothing waits.
 */
export function minutesChip(pt: Playtime | undefined, now: number, fresh = false): MinutesChip {
  const v = minutesView(pt, now, fresh),
    min = v.day.min,
    one = v.ready.find((r) => r.track === 'day') ?? v.ready[0],
    base = { minutes: min, ready: v.ready.length, frozen: v.frozen, rested: v.rested };
  // ready: today's real minutes toward the next rung not reached yet (75 with the 30 and 60 waiting
  // reads "75 / 90", not a ring clamped to "30 / 30"); the gold dot and the line say what waits
  if (one)
    return {
      ...base,
      state: 'ready',
      target: v.day.next?.at ?? DAY_RUNGS[DAY_RUNGS.length - 1],
      reward: v.ready.length === 1 ? shortReward(one.reward) + ' ready' : v.ready.length + ' rewards ready',
    };
  const next = v.day.capped ? null : v.day.next;
  if (!next) return { ...base, state: 'done', minutes: DAY_RUNGS[DAY_RUNGS.length - 1], target: DAY_RUNGS[DAY_RUNGS.length - 1], reward: 'Great session.' };
  return {
    ...base,
    state: 'next',
    target: next.at,
    reward: v.frozen ? 'Paused today: the date changed' : (v.rested && next.i < 3 ? 'Rested ×2: ' : '') + shortReward(next.reward) + ' next',
  };
}

/** Lifetime badge tiers, one per lifetime rung (E.5): Rookie at 1 hour … GOAT at 1,000. */
export const LIFE_BADGES = ['Rookie', 'Starter', 'Pro', 'All-Star', 'MVP', 'Hall of Famer', 'Legend', 'Icon', 'GOAT'] as const;
/** The badge earned so far (null before the first hour) and the next one with the hours to it. */
export function lifeBadge(pt: Playtime | undefined): { badge: string | null; next: string | null; hoursToNext: number } {
  const min = Math.floor((pt?.life ?? 0) / 60),
    i = LIFE.filter((r) => min >= r.at).length,
    nx = LIFE[i];
  return { badge: i ? LIFE_BADGES[i - 1] : null, next: nx ? LIFE_BADGES[i] : null, hoursToNext: nx ? Math.ceil(((nx.at - min) / 60) * 10) / 10 : 0 };
}

const UNIT: Record<Track, string> = { day: 'today', week: 'this week', life: 'played' };
/** What next-action.ts reads (NextExtras): the claimable rungs, the cap, and a rung ≤ 5 minutes away. */
export function minutesExtras(pt: Playtime | undefined, now: number, fresh = false) {
  const v = minutesView(pt, now, fresh),
    n = nextRung(pt, now, fresh),
    one = v.ready[0];
  return {
    minutes: v.ready.length
      ? { n: v.ready.length, line: v.ready.length === 1 ? one.at + ' min ' + UNIT[one.track] + ': ' + rewardText(one.reward) + ' to claim' : v.ready.length + ' Minutes rewards to claim' }
      : null,
    minutesCapped: v.day.capped,
    milestones:
      n && n.minutesLeft <= 5 && n.minutesLeft > 0
        ? [{ id: 'minutes:' + n.track + ':' + n.atMin, steps: n.minutesLeft <= 2 ? 1 : 2, line: n.minutesLeft + ' min to ' + rewardText(n.reward), target: { app: 'minutes' as const } }]
        : [],
  };
}

/**
 * Claim every reached rung once: coins to the shared wallet, packs into this sport's club, stamps and
 * picks as owed receipts. Pure and idempotent: a second claim grants nothing and returns `p` itself.
 */
export function claimMinutes(p: Profile, now: number, sport: SportId, table: MinutesTable = MINUTES_TABLE): { profile: Profile; granted: MinutesReward[] } {
  const fresh = freshForMinutes(p),
    v = minutesView(p.playtime, now, fresh, table);
  if (!v.ready.length) return { profile: p, granted: [] };
  // roll the ledger to today first, so the claims are recorded against today's day and week
  let pt = credit(p.playtime, { sec: 0, menu: 0, raw: 0, sport, act: 0 }, now, fresh);
  const today = etDay(now),
    period: Record<Track, string> = { day: today, week: isoWeek(today), life: 'life' },
    claimed = { ...pt.claimed, day: [...pt.claimed.day], week: [...pt.claimed.week], life: [...pt.claimed.life] },
    owed = [...(pt.owed ?? [])],
    packs = [...p.ut.packs];
  let coins = 0;
  for (const r of v.ready) {
    claimed[r.track].push(r.i);
    coins += r.reward.coins ?? 0;
    const id = r.track + ':' + period[r.track] + ':' + r.at;
    if (r.reward.pack) packs.push({ id: 'minutes:' + id + ':' + sport + ':' + now.toString(36), kind: r.reward.pack, at: now });
    for (let s = 0; s < (r.reward.stamp ?? 0); s++) owed.push('stamp:' + id + ':' + s);
    if (r.reward.pick) owed.push('pick:' + id);
  }
  pt = { ...pt, claimed, ...(owed.length ? { owed } : {}) };
  return { profile: { ...p, coins: p.coins + coins, playtime: pt, ut: { ...p.ut, packs } }, granted: v.ready.map((r) => r.reward) };
}

// ---------- the weekly league (E.6) ----------

export const LEAGUE_TIERS = ['Rookie', 'Starter', 'Pro', 'All-Star', 'MVP', 'Hall of Fame'] as const;
export const DIVISION = 30;
/** Fewer active entries than this in a tier: movement by threshold, not rank. */
export const SMALL_TIER = 10;
export const PROMOTE_AM = 300;
export const RELEGATE_AM = 60;
export const SEASON_WEEKS = 6;

/** One player's week on the minutes board (already validated by the reader). */
export interface WeekEntry {
  key: string;
  name: string;
  tier: number;
  /** counted minutes this week (≤ 630) */
  am: number;
  days: number;
  acts: number;
  /** when the score was reached (ms) */
  at: number;
}
export interface LeagueResult {
  mode: 'rank' | 'threshold';
  division: WeekEntry[];
  /** 1-based; 0 when you have no minutes this week */
  rank: number;
  moved: -1 | 0 | 1;
  /** minutes to the promotion line (0 when on or above it; null at the top tier) */
  toPromote: number | null;
  rival: { name: string; gap: number } | null;
}

/** FNV-1a with a final avalanche, so a new week reshuffles every division. */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};
/** Ranking: minutes, then more active days, then more activities, then earliest to the score. */
export const byStanding = (a: WeekEntry, b: WeekEntry) => b.am - a.am || b.days - a.days || b.acts - a.acts || a.at - b.at || (a.key < b.key ? -1 : 1);

/**
 * The same on every phone, with no server: a tier's entries with minutes, shuffled by key and week,
 * cut into divisions of about 30; top and bottom 20% move (never down from Rookie). A tier with fewer
 * than 10 active entries moves by threshold (≥ 300 up, < 60 down) and shows everyone in it.
 */
export function leagueResult(entries: WeekEntry[], me: WeekEntry | string, tier: number, week: string): LeagueResult {
  const mine = typeof me === 'string' ? null : me,
    key = typeof me === 'string' ? me : me.key,
    others = entries.filter((e) => e.key !== key),
    pool = [...others, ...(mine ? [mine] : entries.filter((e) => e.key === key))].filter((e) => e.tier === tier && e.am > 0),
    top = tier >= LEAGUE_TIERS.length - 1;
  pool.sort((a, b) => hash(week + ':' + a.key) - hash(week + ':' + b.key) || (a.key < b.key ? -1 : 1));
  const small = pool.length < SMALL_TIER,
    k = Math.max(1, Math.round(pool.length / DIVISION)),
    at = pool.findIndex((e) => e.key === key),
    group = small || at < 0 ? pool : pool.filter((_, j) => Math.floor((j * k) / pool.length) === Math.floor((at * k) / pool.length)),
    division = group.slice().sort(byStanding),
    rank = division.findIndex((e) => e.key === key) + 1,
    my = division[rank - 1],
    am = my?.am ?? 0,
    above = rank > 1 ? division[rank - 2] : null;
  let moved: -1 | 0 | 1,
    toPromote: number | null;
  if (small) {
    moved = am >= PROMOTE_AM && !top ? 1 : am < RELEGATE_AM && tier > 0 ? -1 : 0;
    toPromote = top ? null : Math.max(0, PROMOTE_AM - am);
  } else {
    const n = Math.max(1, Math.floor(division.length * 0.2)),
      line = division[n - 1];
    moved = rank && rank <= n && !top ? 1 : (!rank || rank > division.length - n) && tier > 0 ? -1 : 0;
    toPromote = top ? null : rank && rank <= n ? 0 : line.am - am + 1;
  }
  return { mode: small ? 'threshold' : 'rank', division, rank, moved, toPromote, rival: above ? { name: above.name, gap: above.am - am } : null };
}

/** Week-end pay (E.6): promote = Silver (Gold into All-Star and up), stay = 100 coins, first = crown. */
export function leagueReward(r: LeagueResult, tier: number): MinutesReward {
  const crown = r.rank === 1 && r.division.length > 1 ? { flair: 'Crown of the week' } : {};
  if (r.moved === 1) return { pack: tier + 1 >= 3 ? 'gold' : 'silver', ...crown };
  return r.moved === 0 && r.rank ? { coins: 100, ...crown } : {};
}

/** Monday of an ISO week ("2026-W47" → its Monday as epoch days). */
function weekDay0(week: string): number {
  const y = +week.slice(0, 4),
    w = +week.slice(6),
    jan4 = Date.UTC(y, 0, 4) / 864e5;
  return jan4 - ((new Date(Date.UTC(y, 0, 4)).getUTCDay() + 6) % 7) + (w - 1) * 7;
}
/** League seasons are 6 weeks from the week MINUTES launched (2026-W47). */
export function leagueSeason(week: string): { season: string; week: number } {
  const n = Math.max(0, Math.round((weekDay0(week) - weekDay0('2026-W47')) / 7));
  return { season: 'S' + (Math.floor(n / SEASON_WEEKS) + 1), week: (n % SEASON_WEEKS) + 1 };
}
/** At a season's end everyone above Pro drops one tier. */
export const seasonEndTier = (tier: number) => (tier > 2 ? tier - 1 : tier);
