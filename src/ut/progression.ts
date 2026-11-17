// Codex: connected season/objective progression. Rewards are deposited once into existing UT packs.
// Claude, 2026-11-16 (studio overhaul, ut-1): the light half (objectives, the Season Pass track,
// rewards) moved to objectives.ts unchanged and is re-exported here, so every import still works and
// this module no longer reaches sbc.ts and the card pool.
import { SPORT } from '../engine/sport';
import type { UtState } from './state';
import { emptyTotals, type ClubMatch, type Counter, type Totals } from './hq-state';
import {
  hqOf,
  objectiveDeck,
  seasonFor,
  seasonReward,
  SEASON_STEP,
  SEASON_TIERS,
  weekKey,
  type Prize,
  type Reward,
} from './objectives';
export {
  DAILY,
  hqOf,
  LIFETIME,
  objectiveDeck,
  readyRewards,
  rewardLabel,
  seasonFor,
  seasonReady,
  seasonReward,
  SEASON_STEP,
  SEASON_TIERS,
  WEEKLY,
  weekKey,
} from './objectives';
export type { Objective, ObjectiveDef, Prize, Reward } from './objectives';
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
  const week = weekKey(day);
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
        // Claude ut-5: the dormant soccer draw branch (play.ts): played 80 + 15
        (r.draw ? (r.how === 'played' ? 15 : 5) : 0) +
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
export function depositPrize(
  ut: UtState,
  id: string,
  reward: Reward,
  at: number
): Prize {
  // soccer has no Spotlight editions (no registered serials): its Spotlight prizes are Elite Gold packs
  const pack = reward.pack === 'spotlight' && SPORT === 'soccer' ? 'elite' : (reward.pack ?? null);
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
