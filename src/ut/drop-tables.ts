// Claude (packs-2, 2026-11-16): the Scout Drop tier tables (Game Design V2 D.12, packs-plan D14, the
// V2.4 E contract). Pure data and maths: no pool, no state, no React, so ut's drop screen, its odds
// sheet and its tests can import it anywhere. ut owns the drop UI, the "first 3 wins a day" rule, the
// claims and the seed; this module owns what each tap can do and what each tier pays.
//
//   Drop 1   ut's Scout Reveal, its data unchanged: a Silver Pack + 100 coins. Each tap upgrades the pack
//            one step (→ Gold 35%, → Premium 25%, → Jumbo 15%) and the first miss settles it, so the
//            final odds are Silver 65.0%, Gold 26.25%, Premium 7.44%, Jumbo 1.31%.
//   Drops 2-3  start Common; each of 3 taps upgrades one tier (Common 20%, Rare 25%, Epic 30%) and a miss
//            only spends that tap. Common 25 coins, Rare 45, Epic 60 + 3 Scout Stamps, Legendary a
//            Silver Pack: final odds 51.2 / 36.05 / 11.25 / 1.5%, about 42 coin-equivalents a drop.
//
// The reveal plays the rolled `path` and nothing else: no tier is ever teased that wasn't rolled (D11).
import { hashString, rng } from '../engine/rng';
import type { UtSport } from './types';

export type DropTier = 'common' | 'rare' | 'epic' | 'legendary';
export const DROP_TIERS: readonly DropTier[] = ['common', 'rare', 'epic', 'legendary'];
export type DropIndex = 1 | 2 | 3;

export interface DropReward {
  coins?: number;
  /** reserved for ut's Career XP outcome; packs values it at 0 */
  xp?: number;
  /** Scout Stamps, granted through grantStamps(ut, n, 'drop', '<day>:<index>') */
  stamps?: number;
  /** an ordinary pending pack of this kind (its id starts `scout-drop:`; drop 1 keeps `daily-bonus:<day>`) */
  pack?: 'silver' | 'gold' | 'premium' | 'jumbo';
}

export interface DropTable {
  start: DropTier;
  /** the chance one tap upgrades from each tier (Legendary has nowhere to go) */
  up: Record<DropTier, number>;
  taps: 3;
  rewards: Record<DropTier, DropReward>;
  /** drop 1 (the Scout Reveal): the first tap that misses settles the drop (later taps do nothing) */
  stopOnMiss?: true;
}

/** The Scout Reveal (drop 1), exactly as ut planned it. */
const REVEAL: DropTable = {
  start: 'common',
  up: { common: 0.35, rare: 0.25, epic: 0.15, legendary: 0 },
  taps: 3,
  rewards: {
    common: { pack: 'silver', coins: 100 },
    rare: { pack: 'gold', coins: 100 },
    epic: { pack: 'premium', coins: 100 },
    legendary: { pack: 'jumbo', coins: 100 },
  },
  stopOnMiss: true,
};

/** Drops 2 and 3 (V2 D.12 chances; packs D14 rewards). The same coins in every sport; packs at the sport's own prices. */
const SMALL: DropTable = {
  start: 'common',
  up: { common: 0.2, rare: 0.25, epic: 0.3, legendary: 0 },
  taps: 3,
  rewards: {
    common: { coins: 25 },
    rare: { coins: 45 },
    epic: { coins: 60, stamps: 3 },
    legendary: { pack: 'silver' },
  },
};

/** A drop's table. `sport` is part of the contract for a later per-sport table; today all three match. */
export function dropTable(_sport: UtSport, index: DropIndex): DropTable {
  return index === 1 ? REVEAL : SMALL;
}

const next = (t: DropTier): DropTier => DROP_TIERS[Math.min(DROP_TIERS.length - 1, DROP_TIERS.indexOf(t) + 1)];

/** The exact final-tier odds (every tap path enumerated), shown before the first tap. They add up to 1. */
export function dropOdds(sport: UtSport, index: DropIndex): Record<DropTier, number> {
  const t = dropTable(sport, index);
  const out: Record<DropTier, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const walk = (tier: DropTier, tapsLeft: number, p: number) => {
    const up = t.up[tier];
    if (!tapsLeft || up <= 0) {
      out[tier] += p;
      return;
    }
    walk(next(tier), tapsLeft - 1, p * up);
    if (t.stopOnMiss) out[tier] += p * (1 - up);
    else walk(tier, tapsLeft - 1, p * (1 - up));
  };
  walk(t.start, t.taps, 1);
  return out;
}

/**
 * Roll a drop from the caller's seed (ut: `'scout-drop:' + playerKey + ':' + sport + ':' + day + ':' +
 * index`): the same seed always gives the same result, so a reload can't reroll. `path` is the tier after
 * each tap (always `taps` entries; after drop 1's settling miss it repeats), so the reveal animates exactly
 * what was rolled and never skips a tier.
 */
export function rollDrop(seed: string, sport: UtSport, index: DropIndex): { tier: DropTier; path: DropTier[]; reward: DropReward } {
  const t = dropTable(sport, index);
  const rand = rng(hashString('drop-roll:' + seed));
  let tier = t.start;
  let settled = false;
  const path: DropTier[] = [];
  for (let i = 0; i < t.taps; i++) {
    const roll = rand();
    if (!settled && t.up[tier] > 0) {
      if (roll < t.up[tier]) tier = next(tier);
      else if (t.stopOnMiss) settled = true;
    }
    path.push(tier);
  }
  return { tier, path, reward: t.rewards[tier] };
}

/** One Scout Stamp in coin-equivalents (packs-plan D13: 50 stamps buy an 82+ pick worth about 550). */
export const STAMP_VALUE = 11;
/**
 * Each pack's quick-sell expected value by sport (packs-2 packsim, the gold curve, 10,000 packs each),
 * to value a drop in coin-equivalents. packs-3 re-prices packs, not their contents, so these hold. The drop-tables suite checks them against real openings.
 */
export const PACK_VALUE: Record<UtSport, Record<NonNullable<DropReward['pack']>, number>> = {
  nba: { silver: 290, gold: 600, premium: 1090, jumbo: 2160 },
  nfl: { silver: 210, gold: 590, premium: 830, jumbo: 1520 },
  soccer: { silver: 260, gold: 460, premium: 850, jumbo: 1720 },
};

/** A reward in coin-equivalents: coins, stamps at STAMP_VALUE, a pack at its quick-sell value; xp 0. */
export function dropValue(sport: UtSport, r: DropReward): number {
  return (r.coins ?? 0) + (r.stamps ?? 0) * STAMP_VALUE + (r.pack ? PACK_VALUE[sport][r.pack] : 0);
}

/** A drop's expected value in coin-equivalents. */
export function dropEv(sport: UtSport, index: DropIndex): number {
  const odds = dropOdds(sport, index);
  const t = dropTable(sport, index);
  return DROP_TIERS.reduce((a, tier) => a + odds[tier] * dropValue(sport, t.rewards[tier]), 0);
}
