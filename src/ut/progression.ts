// Codex: connected season/objective progression. Rewards are deposited once into existing UT packs.
import type { UtState } from './state';
import {
  emptyTotals,
  freshHQ,
  type ClubHQ,
  type ClubMatch,
  type Counter,
  type Totals
} from './hq-state';
import { weekOf } from './sbc';
export interface Reward {
  coins?: number;
  pack?: string;
  sp?: number;
}
export interface Prize {
  ut: UtState;
  coins: number;
  sp: number;
  pack: string | null;
  packCount?: number;
}
export interface Objective {
  id: string;
  group: 'daily' | 'weekly' | 'lifetime';
  period: string;
  title: string;
  text: string;
  counter: Counter | 'collect';
  target: number;
  progress: number;
  reward: Reward;
  claimed: boolean;
}
export const SEASON_TIERS = 25,
  SEASON_STEP = 300;
export function seasonFor(day: string) {
  const stamp = Date.parse(day + 'T12:00:00Z'),
    epoch = Date.parse('2026-10-26T12:00:00Z'),
    n = Math.max(0, Math.floor((stamp - epoch) / (28 * 86400000)));
  const start = new Date(epoch + n * 28 * 86400000).toISOString().slice(0, 10),
    end = new Date(epoch + ((n + 1) * 28 - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    id: 'season:' + (n + 1),
    number: n + 1,
    title: 'Season ' + String(n + 1).padStart(2, '0'),
    start,
    end
  };
}
export function hqOf(ut: UtState): ClubHQ {
  if (ut.hq) return ut.hq;
  const h = freshHQ(),
    r = ut.record;
  h.totals.games = r.w + r.l + r.h2hW + r.h2hL;
  h.totals.wins = r.w + r.h2hW;
  h.totals.onlineWins = r.h2hW;
  h.totals.packs = ut.packsOpened;
  h.totals.sbcs = Object.keys(ut.sbc.done).length;
  return h;
}
export function addSeasonXP(ut: UtState, day: string, n: number): UtState {
  if (n <= 0) return ut;
  const h = hqOf(ut),
    id = seasonFor(day).id,
    s = h.seasons[id] ?? { xp: 0, claimed: [] };
  return {
    ...ut,
    hq: {
      ...h,
      seasons: {
        ...h.seasons,
        [id]: {
          ...s,
          xp: Math.min(SEASON_TIERS * SEASON_STEP, s.xp + Math.floor(n))
        }
      }
    }
  };
}
const add = (v: Totals, delta: Partial<Totals>): Totals =>
  Object.fromEntries(
    Object.keys(v).map((k) => [k, v[k as Counter] + (delta[k as Counter] ?? 0)])
  ) as Totals;
export function recordActivity(
  ut: UtState,
  id: string,
  day: string,
  delta: Partial<Totals>,
  sp = 0
): UtState {
  const h = hqOf(ut);
  if (h.journal.includes(id)) return ut;
  const week = weekOf(day);
  return addSeasonXP(
    {
      ...ut,
      hq: {
        ...h,
        totals: add(h.totals, delta),
        days: { ...h.days, [day]: add(h.days[day] ?? emptyTotals(), delta) },
        weeks: {
          ...h.weeks,
          [week]: add(h.weeks[week] ?? emptyTotals(), delta)
        },
        journal: [...h.journal, id].slice(-5000)
      }
    },
    day,
    sp
  );
}
export function recordMatchProgress(
  ut: UtState,
  r: ClubMatch & { day: string; how: 'played' | 'sim'; played: string[] }
): { ut: UtState; sp: number } {
  const h = hqOf(ut),
    id = 'match:' + r.id;
  if (h.journal.includes(id)) return { ut, sp: 0 };
  const sp =
    (h.days[r.day]?.games ?? 0) < 16
      ? (r.how === 'played' ? 80 : 30) +
        (r.won ? (r.how === 'played' ? 30 : 10) : 0) +
        (r.mode === 'online' ? 10 : 0)
      : 0;
  let next = recordActivity(
    ut,
    id,
    r.day,
    {
      games: 1,
      wins: r.won ? 1 : 0,
      points: r.us,
      onlineWins: r.mode === 'online' && r.won ? 1 : 0
    },
    sp
  );
  const q = hqOf(next),
    cardStats = { ...q.cardStats },
    owned = new Set(ut.owned.map((c) => c.uid));
  for (const uid of new Set(r.played))
    if (owned.has(uid)) {
      const c = cardStats[uid] ?? { games: 0, wins: 0 };
      cardStats[uid] = { games: c.games + 1, wins: c.wins + (r.won ? 1 : 0) };
    }
  let development = q.development;
  const active = development.active;
  if (
    active &&
    r.how === 'played' &&
    r.played.includes(active.uid) &&
    owned.has(active.uid)
  )
    development = {
      ...development,
      active: {
        ...active,
        games: active.games + 1,
        wins: active.wins + (r.won ? 1 : 0),
        points: active.points + r.us
      }
    };
  const { day, how, played, ...entry } = r;
  void day;
  void how;
  void played;
  next = {
    ...next,
    hq: {
      ...q,
      cardStats,
      development,
      history: [...q.history, entry].slice(-20)
    }
  };
  return { ut: next, sp };
}
export function seasonReward(tier: number): Reward {
  if (tier === 25) return { pack: 'spotlight', coins: 500 };
  if (tier === 20) return { pack: 'premium', coins: 300 };
  if (tier === 15 || tier === 10) return { pack: 'premium' };
  if (tier % 5 === 0) return { pack: 'gold' };
  if (tier % 3 === 0) return { pack: 'silver' };
  if (tier === 1) return { pack: 'bronze' };
  return { coins: tier < 10 ? 100 : 150 };
}
export function depositPrize(
  ut: UtState,
  id: string,
  reward: Reward,
  at: number
): Prize {
  const pack = reward.pack ?? null;
  return {
    ut:
      pack && !ut.packs.some((p) => p.id === id)
        ? { ...ut, packs: [...ut.packs, { id, kind: pack, at }] }
        : ut,
    coins: reward.coins ?? 0,
    sp: reward.sp ?? 0,
    pack
  };
}
export function claimSeason(
  ut: UtState,
  period: string,
  tier: number,
  at: number
): Prize {
  const h = hqOf(ut),
    s = h.seasons[period];
  if (
    !Number.isInteger(tier) ||
    tier < 1 ||
    tier > SEASON_TIERS ||
    !s ||
    s.xp < tier * SEASON_STEP ||
    s.claimed.includes(tier)
  )
    return { ut, coins: 0, sp: 0, pack: null };
  const next = {
    ...ut,
    hq: {
      ...h,
      seasons: {
        ...h.seasons,
        [period]: { ...s, claimed: [...s.claimed, tier] }
      }
    }
  };
  return depositPrize(next, period + ':tier:' + tier, seasonReward(tier), at);
}
/** One transactional batch for the selected season, retaining the same per-tier receipts. */
export function claimReadySeason(
  ut: UtState,
  period: string,
  at: number
): Prize {
  let next = ut,
    coins = 0;
  for (let tier = 1; tier <= SEASON_TIERS; tier++) {
    const result = claimSeason(next, period, tier, at);
    next = result.ut;
    coins += result.coins;
  }
  return {
    ut: next,
    coins,
    sp: 0,
    pack: null,
    packCount: next.packs.length - ut.packs.length
  };
}
export function seasonReady(ut: UtState, period: string): number {
  const track = hqOf(ut).seasons[period];
  if (!track) return 0;
  return Array.from({ length: SEASON_TIERS }, (_, i) => i + 1).filter(
    (tier) => track.xp >= tier * SEASON_STEP && !track.claimed.includes(tier)
  ).length;
}

const DAILY: [string, string, Counter, number, Reward][] = [
  ['show-up', 'Two games. One goal.', 'games', 2, { coins: 50, sp: 70 }],
  ['winner', 'Find a way to win.', 'wins', 1, { coins: 75, sp: 90 }],
  ['score', 'Put points on the board.', 'points', 24, { coins: 75, sp: 90 }]
];
const WEEKLY: [string, string, Counter, number, Reward][] = [
  [
    'compete',
    'Build your weekly form.',
    'games',
    10,
    { pack: 'gold', sp: 250 }
  ],
  ['wins', 'Make winning a habit.', 'wins', 5, { coins: 250, sp: 250 }],
  [
    'builder',
    'Complete two squad challenges.',
    'sbcs',
    2,
    { pack: 'silver', sp: 200 }
  ]
];
export function objectiveDeck(ut: UtState, day: string): Objective[] {
  const h = hqOf(ut),
    week = weekOf(day),
    out: Objective[] = [];
  const period = (
    group: 'daily' | 'weekly',
    key: string,
    defs: typeof DAILY,
    counts: Totals,
    current: boolean
  ) => {
    for (const [id, title, counter, target, reward] of defs) {
      const claim = group + ':' + key + ':' + id,
        progress = counts[counter],
        claimed = h.claims.includes(claim);
      if (!current && (claimed || progress < target)) continue;
      out.push({
        id: claim,
        group,
        period: key,
        title,
        text:
          (counter === 'points'
            ? 'Score '
            : counter === 'wins'
              ? 'Win '
              : counter === 'games'
                ? 'Play '
                : 'Complete ') +
          target +
          ' ' +
          (counter === 'points'
            ? 'points'
            : counter === 'wins'
              ? 'matches'
              : counter === 'games'
                ? 'UT matches'
                : 'SBCs'),
        counter,
        target,
        progress: Math.min(progress, target),
        reward,
        claimed
      });
    }
  };
  period('daily', day, DAILY, h.days[day] ?? emptyTotals(), true);
  period('weekly', week, WEEKLY, h.weeks[week] ?? emptyTotals(), true);
  const collected = new Set([
    ...(ut.collected ?? []),
    ...ut.owned.map((c) => c.cardId)
  ]).size;
  const lifetime: [string, string, Counter | 'collect', number, Reward][] = [
    [
      'club-10',
      'The collection begins.',
      'collect',
      10,
      { pack: 'silver', sp: 150 }
    ],
    [
      'club-50',
      'A club worth building.',
      'collect',
      50,
      { pack: 'gold', sp: 250 }
    ],
    ['games-10', 'Find your identity.', 'games', 10, { pack: 'gold', sp: 250 }],
    ['wins-25', 'Built to win.', 'wins', 25, { pack: 'premium', sp: 400 }],
    ['packs-10', 'The next reveal.', 'packs', 10, { coins: 250, sp: 200 }],
    [
      'moments-4',
      'Big-moment player.',
      'moments',
      4,
      { pack: 'premium', sp: 300 }
    ],
    [
      'development-1',
      'Make a club hero.',
      'development',
      1,
      { pack: 'gold', sp: 200 }
    ],
    [
      'online-5',
      'Against the world.',
      'onlineWins',
      5,
      { pack: 'premium', sp: 300 }
    ]
  ];
  for (const [id, title, counter, target, reward] of lifetime) {
    const key = 'lifetime:' + id,
      progress = counter === 'collect' ? collected : h.totals[counter];
    out.push({
      id: key,
      group: 'lifetime',
      period: 'Your club',
      title,
      text:
        (counter === 'collect'
          ? 'Collect '
          : counter === 'wins' || counter === 'onlineWins'
            ? 'Win '
            : counter === 'games'
              ? 'Play '
              : counter === 'packs'
                ? 'Open '
                : 'Complete ') +
        target +
        ' ' +
        (counter === 'collect'
          ? 'different cards'
          : counter === 'onlineWins'
            ? 'online matches'
            : counter === 'wins' || counter === 'games'
              ? 'matches'
              : counter === 'packs'
                ? 'packs'
                : counter === 'moments'
                  ? 'Moments'
                  : 'development program'),
      counter,
      target,
      progress: Math.min(progress, target),
      reward,
      claimed: h.claims.includes(key)
    });
  }
  for (const [key, value] of Object.entries(h.days))
    if (key !== day) period('daily', key, DAILY, value, false);
  for (const [key, value] of Object.entries(h.weeks))
    if (key !== week) period('weekly', key, WEEKLY, value, false);
  return out;
}
export function claimObjective(
  ut: UtState,
  id: string,
  day: string,
  at: number
): Prize {
  const o = objectiveDeck(ut, day).find((o) => o.id === id);
  if (!o || o.claimed || o.progress < o.target)
    return { ut, coins: 0, sp: 0, pack: null };
  const h = hqOf(ut),
    next = addSeasonXP(
      { ...ut, hq: { ...h, claims: [...h.claims, id] } },
      day,
      o.reward.sp ?? 0
    );
  return depositPrize(next, 'objective:' + id, o.reward, at);
}
export function rewardLabel(r: Reward): string {
  return [
    r.coins ? r.coins.toLocaleString('en-US') + ' coins' : '',
    r.pack
      ? r.pack === 'spotlight'
        ? 'Spotlight Pack'
        : r.pack[0].toUpperCase() + r.pack.slice(1) + ' Pack'
      : '',
    r.sp ? r.sp + ' SP' : ''
  ]
    .filter(Boolean)
    .join(' · ');
}
export function readyRewards(ut: UtState, day: string): number {
  const h = hqOf(ut);
  return (
    objectiveDeck(ut, day).filter((o) => !o.claimed && o.progress >= o.target)
      .length +
    Object.values(h.seasons).reduce(
      (n, s) =>
        n +
        Math.max(
          0,
          Math.min(SEASON_TIERS, Math.floor(s.xp / SEASON_STEP)) -
            s.claimed.filter((t) => t <= Math.floor(s.xp / SEASON_STEP)).length
        ),
      0
    )
  );
}
