// Claude, 2026-11-16 (studio overhaul, team ut-1): the light half of Ultimate Team progression.
// Codex's objectives, Season Pass track and development paths (first written in progression.ts and
// club-management.ts) moved here unchanged, so the main-app badge, the "Next up" strip and the
// One-More bar can read them without loading the card pool. Imports stay light on purpose: types,
// hq-state and the sport switch only (claimables-graph.test.ts walks this). progression.ts and
// club-management.ts re-export everything, so every existing import compiles as before; every id,
// target and reward amount is pinned by objectives.test.ts against the pre-move code.
import { SPORT } from '../engine/sport';
import { emptyTotals, freshHQ, type ClubHQ, type Counter, type Totals } from './hq-state';
import type { UtState } from './state';

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

/** ISO week of an Eastern date key ("2026-11-10" → "2026-W46"): the same algorithm as sbc.ts weekOf and leaderboard.ts weekKey. */
export function weekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

export const SEASON_TIERS = 25,
  SEASON_STEP = 300;
export function seasonFor(day: string) {
  const stamp = Date.parse(day + 'T12:00:00Z'),
    epoch = Date.parse('2026-10-26T12:00:00Z'),
    n = Math.max(0, Math.floor((stamp - epoch) / (28 * 86400000)));
  const start = new Date(epoch + n * 28 * 86400000).toISOString().slice(0, 10),
    end = new Date(epoch + ((n + 1) * 28 - 1) * 86400000).toISOString().slice(0, 10);
  return {
    id: 'season:' + (n + 1),
    number: n + 1,
    title: 'Season ' + String(n + 1).padStart(2, '0'),
    start,
    end,
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
export function seasonReward(tier: number): Reward {
  if (tier === 25) return { pack: 'spotlight', coins: 500 };
  if (tier === 20) return { pack: 'premium', coins: 300 };
  if (tier === 15 || tier === 10) return { pack: 'premium' };
  if (tier % 5 === 0) return { pack: 'gold' };
  if (tier % 3 === 0) return { pack: 'silver' };
  if (tier === 1) return { pack: 'bronze' };
  return { coins: tier < 10 ? 100 : 150 };
}
export function seasonReady(ut: UtState, period: string): number {
  const track = hqOf(ut).seasons[period];
  if (!track) return 0;
  return Array.from({ length: SEASON_TIERS }, (_, i) => i + 1).filter(
    (tier) => track.xp >= tier * SEASON_STEP && !track.claimed.includes(tier),
  ).length;
}

export type ObjectiveDef = [id: string, title: string, counter: Counter, target: number, reward: Reward];
export const DAILY: ObjectiveDef[] = [
  ['show-up', 'Two games. One goal.', 'games', 2, { coins: 50, sp: 70 }],
  ['winner', 'Find a way to win.', 'wins', 1, { coins: 75, sp: 90 }],
  ['score', 'Put points on the board.', 'points', 24, { coins: 75, sp: 90 }],
];
export const WEEKLY: ObjectiveDef[] = [
  ['compete', 'Build your weekly form.', 'games', 10, { pack: 'gold', sp: 250 }],
  ['wins', 'Make winning a habit.', 'wins', 5, { coins: 250, sp: 250 }],
  ['builder', 'Complete two squad challenges.', 'sbcs', 2, { pack: 'silver', sp: 200 }],
];
export const LIFETIME: [id: string, title: string, counter: Counter | 'collect', target: number, reward: Reward][] = [
  ['club-10', 'The collection begins.', 'collect', 10, { pack: 'silver', sp: 150 }],
  ['club-50', 'A club worth building.', 'collect', 50, { pack: 'gold', sp: 250 }],
  ['games-10', 'Find your identity.', 'games', 10, { pack: 'gold', sp: 250 }],
  ['wins-25', 'Built to win.', 'wins', 25, { pack: 'premium', sp: 400 }],
  ['packs-10', 'The next reveal.', 'packs', 10, { coins: 250, sp: 200 }],
  ['moments-4', 'Big-moment player.', 'moments', 4, { pack: 'premium', sp: 300 }],
  ['development-1', 'Make a club hero.', 'development', 1, { pack: 'gold', sp: 200 }],
  ['online-5', 'Against the world.', 'onlineWins', 5, { pack: 'premium', sp: 300 }],
];

export function objectiveDeck(ut: UtState, day: string): Objective[] {
  const h = hqOf(ut),
    week = weekKey(day),
    out: Objective[] = [],
    // a Set, not h.claims.includes per objective: a long-lived club has thousands of receipts
    claims = new Set(h.claims);
  const period = (group: 'daily' | 'weekly', key: string, defs: ObjectiveDef[], counts: Totals, current: boolean) => {
    for (const [id, title, counter, target, reward] of defs) {
      const claim = group + ':' + key + ':' + id,
        progress = counts[counter],
        claimed = claims.has(claim);
      if (!current && (claimed || progress < target)) continue;
      out.push({
        id: claim,
        group,
        period: key,
        title,
        text:
          (counter === 'points' ? 'Score ' : counter === 'wins' ? 'Win ' : counter === 'games' ? 'Play ' : 'Complete ') +
          target +
          ' ' +
          (counter === 'points'
            ? 'points'
            : counter === 'wins'
              ? target === 1
                ? 'match'
                : 'matches'
              : counter === 'games'
                ? target === 1
                  ? 'UT match'
                  : 'UT matches'
                : target === 1
                  ? 'SBC'
                  : 'SBCs'),
        counter,
        target,
        progress: Math.min(progress, target),
        reward,
        claimed,
      });
    }
  };
  period('daily', day, DAILY, h.days[day] ?? emptyTotals(), true);
  period('weekly', week, WEEKLY, h.weeks[week] ?? emptyTotals(), true);
  const collected = new Set([...(ut.collected ?? []), ...ut.owned.map((c) => c.cardId)]).size;
  for (const [id, title, counter, target, reward] of LIFETIME) {
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
      claimed: claims.has(key),
    });
  }
  for (const [key, value] of Object.entries(h.days)) if (key !== day) period('daily', key, DAILY, value, false);
  for (const [key, value] of Object.entries(h.weeks)) if (key !== week) period('weekly', key, WEEKLY, value, false);
  return out;
}
export function rewardLabel(r: Reward): string {
  return [
    r.coins ? r.coins.toLocaleString('en-US') + ' coins' : '',
    r.pack
      ? r.pack === 'spotlight'
        ? SPORT === 'soccer'
          ? 'Elite Gold Pack'
          : 'Spotlight Pack'
        : r.pack[0].toUpperCase() + r.pack.slice(1) + ' Pack'
      : '',
    r.sp ? r.sp + ' SP' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export function readyRewards(ut: UtState, day: string): number {
  const h = hqOf(ut);
  return (
    objectiveDeck(ut, day).filter((o) => !o.claimed && o.progress >= o.target).length +
    Object.values(h.seasons).reduce(
      (n, s) =>
        n +
        Math.max(
          0,
          Math.min(SEASON_TIERS, Math.floor(s.xp / SEASON_STEP)) - s.claimed.filter((t) => t <= Math.floor(s.xp / SEASON_STEP)).length,
        ),
      0,
    )
  );
}

// ---------- development (moved from club-management.ts) ----------

export const DEVELOPMENT_PATHS = [
  { id: 'breakout' as const, title: 'Breakout', text: 'Make an emerging card a regular.', games: 3, wins: 1, xp: 200, sp: 150 },
  { id: 'captain' as const, title: 'Captain', text: 'Lead your squad to three wins.', games: 5, wins: 3, xp: 350, sp: 250 },
  { id: 'ironman' as const, title: 'Ironman', text: 'Stay ready. Build your match experience.', games: 6, wins: 0, xp: 300, sp: 200 },
];
export function developmentReady(ut: UtState): boolean {
  const a = hqOf(ut).development.active,
    p = DEVELOPMENT_PATHS.find((p) => p.id === a?.path);
  return !!a && !!p && ut.owned.some((c) => c.uid === a.uid) && a.games >= p.games && a.wins >= p.wins;
}

// ---------- a card's record with your club (for the card back, players' CardDetail) ----------

/** Games and wins a copy has played for this club (from `hq.cardStats`) and when it joined. */
export function clubStatsOf(ut: UtState, uid: string): { games: number; wins: number; since?: number } {
  const s = hqOf(ut).cardStats[uid],
    copy = ut.owned.find((c) => c.uid === uid);
  return { games: s?.games ?? 0, wins: s?.wins ?? 0, ...(copy && copy.at > 0 ? { since: copy.at } : {}) };
}
