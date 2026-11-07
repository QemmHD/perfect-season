// Codex (OpenAI): rotating own-club knockout Cups; no roster consumption, entry fee or new currency.
import { hashString } from '../engine/rng';
import {
  aiOpponent,
  LEVEL,
  LEVELS,
  LEVEL_NAME,
  type Level,
  type Rung,
} from './battles';
import {
  freshCup,
  CUP_KINDS,
  type CupArchive,
  type CupKind,
  type CupRun,
} from './cup-state';
import { playId } from './evolutions';
import { ratedOf, type Pool } from './pool';
import { addSeasonXP } from './progression';
import { TIER_CUTS } from './rate';
import {
  canPlay,
  playsIn,
  rateSquad,
  setSoccerFormation,
  slotsFor,
} from './squad';
import type { UtState } from './state';
import type { RatedCard, UtSport } from './types';
export type { CupKind, CupRun } from './cup-state';
export interface CupRequest {
  runId: string;
  round: number;
}
export const CUP_ROUNDS = ['Quarterfinal', 'Semifinal', 'Final'];
export const CUP_NAMES: Record<CupKind, string> = {
  open: 'Open Club Cup',
  silver: 'Silver Cup',
  chemistry: 'Chemistry Cup',
};
export const CUP_PRIZES: Record<
  CupKind,
  { coins: number; pack: string; sp: number }
> = {
  open: { coins: 200, pack: 'gold', sp: 200 },
  silver: { coins: 300, pack: 'premium', sp: 250 },
  chemistry: { coins: 300, pack: 'premium', sp: 250 },
};
export const cupOf = (ut: UtState) => ut.cup ?? freshCup();
export const cupClaimId = (sport: UtSport, week: string, kind: CupKind) =>
  'cup:' + sport + ':' + week + ':' + kind;
export function cupRule(
  sport: UtSport,
  week: string,
  kind: CupKind,
): {
  text: string;
  type: 'open' | 'silver' | 'franchise' | 'era';
  need: number;
  cap?: number;
} {
  if (kind === 'open')
    return {
      type: 'open',
      need: 0,
      text: 'Any complete club squad. A welcoming first knockout run.',
    };
  if (kind === 'silver') {
    const cap = TIER_CUTS[sport].gold - 1;
    return {
      type: 'silver',
      need: 0,
      cap,
      text:
        'Every playing card must be ' +
        cap +
        ' OVR or lower at entry, including the NBA playing bench. Entered cards keep eligibility as they earn XP.',
    };
  }
  const type = (
    hashString('cup-rule:' + sport + ':' + week) % 2 ? 'franchise' : 'era'
  ) as 'franchise' | 'era';
  const need =
    type === 'franchise'
      ? { nba: 3, nfl: 8, soccer: 4 }[sport]
      : { nba: 3, nfl: 12, soccer: 6 }[sport];
  return {
    type,
    need,
    text:
      'Start at least ' +
      need +
      ' players from ' +
      (type === 'franchise'
        ? 'one ' + (sport === 'soccer' ? 'club' : 'franchise')
        : 'one decade') +
      '. You choose the ' +
      (type === 'franchise' ? 'team' : 'era') +
      '.',
  };
}
function lineupFor(pool: Pool, ut: UtState) {
  setSoccerFormation(ut.formation);
  const owned = new Map(ut.owned.map((c) => [c.uid, c]));
  const lineup: Record<string, RatedCard | null> = {};
  const playing: RatedCard[] = [];
  const playingUids: string[] = [];
  const starters: RatedCard[] = [];
  const used = new Set<string>();
  let invalid = false;
  for (const slot of slotsFor(pool.sport)) {
    const c = owned.get(ut.squad[slot.id]);
    const rc = c ? ratedOf(pool, { ...c, cardId: playId(ut, c) }) : null;
    lineup[slot.id] = rc;
    if (rc && playsIn(pool.sport, slot.id)) {
      if (!canPlay(slot, rc) || used.has(rc.line.pid)) invalid = true;
      used.add(rc.line.pid);
      playing.push(rc);
      playingUids.push(c!.uid);
      if (slot.weight > 0) starters.push(rc);
    }
    if (slot.weight > 0 && (!rc || !canPlay(slot, rc))) invalid = true;
  }
  return { lineup, playing, playingUids, starters, invalid };
}
export function cupEligibility(
  pool: Pool,
  ut: UtState,
  kind: CupKind,
  week: string,
): { ok: boolean; reason: string; progress: number; need: number } {
  const squad = lineupFor(pool, ut),
    rule = cupRule(pool.sport, week, kind);
  if (squad.invalid)
    return {
      ok: false,
      reason: 'Fill each starting position with a different eligible player.',
      progress: squad.starters.length,
      need: slotsFor(pool.sport).filter((s) => s.weight > 0).length,
    };
  if (rule.type === 'silver') {
    const active = cupOf(ut).active;
    const entry =
      active?.kind === kind &&
      active.week === week &&
      active.sport === pool.sport
        ? active.entryLevels
        : undefined;
    const owned = new Map(ut.owned.map((c) => [c.uid, c]));
    const rated = squad.playing.map((rc, i) => {
      const uid = squad.playingUids[i],
        c = owned.get(uid)!;
      return entry?.[uid]
        ? (ratedOf(pool, {
            cardId: playId(ut, c),
            level: Math.min(c.level, entry[uid]),
          }) ?? rc)
        : rc;
    });
    const over = rated.filter((c) => c.ovr > rule.cap!);
    return {
      ok: !over.length,
      reason: over.length
        ? over.length +
          ' playing ' +
          (over.length === 1 ? 'card is' : 'cards are') +
          ' above ' +
          rule.cap +
          ' OVR.'
        : 'Every playing card meets the entry rating cap.',
      progress: squad.playing.length - over.length,
      need: squad.playing.length,
    };
  }
  if (rule.type === 'franchise' || rule.type === 'era') {
    const counts: Record<string, number> = {};
    for (const c of squad.starters) {
      const k =
        rule.type === 'franchise'
          ? c.line.fr
          : String(Math.floor(c.line.season / 10) * 10);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const progress = Math.max(0, ...Object.values(counts));
    return {
      ok: progress >= rule.need,
      reason:
        progress +
        ' / ' +
        rule.need +
        ' starters share ' +
        (rule.type === 'franchise' ? 'a team.' : 'a decade.'),
      progress,
      need: rule.need,
    };
  }
  return {
    ok: true,
    reason: 'Your squad is eligible.',
    progress: squad.starters.length,
    need: squad.starters.length,
  };
}
export function startCup(
  ut: UtState,
  pool: Pool,
  kind: CupKind,
  id: string,
  at: number,
  week: string,
  level: Level,
): UtState {
  if (cupOf(ut).active) throw Error('Finish or retire your current Cup first.');
  if (
    !CUP_KINDS.includes(kind) ||
    !LEVELS.includes(level) ||
    !/^\d{4}-W\d{2}$/.test(week) ||
    !id ||
    id.length > 180 ||
    !Number.isSafeInteger(at) ||
    at < 0
  )
    throw Error('Invalid Cup entry.');
  const eligible = cupEligibility(pool, ut, kind, week);
  if (!eligible.ok) throw Error(eligible.reason);
  const anchor = rateSquad(pool.sport, lineupFor(pool, ut).lineup).ovr;
  return {
    ...ut,
    cup: {
      ...cupOf(ut),
      active: {
        id,
        kind,
        week,
        sport: pool.sport,
        level,
        anchor,
        entryLevels: Object.fromEntries(
          lineupFor(pool, ut).playingUids.map((uid) => [
            uid,
            ut.owned.find((c) => c.uid === uid)!.level,
          ]),
        ),
        at,
        round: 0,
        results: [],
        done: false,
      },
    },
  };
}
export function validCupRequest(ut: UtState, req: CupRequest): boolean {
  if (!req || typeof req.runId !== 'string') return false;
  const a = cupOf(ut).active;
  return (
    !!a &&
    !a.done &&
    a.id === req.runId &&
    Number.isInteger(req.round) &&
    req.round === a.round &&
    req.round >= 0 &&
    req.round < 3
  );
}
export function cupOpponent(
  pool: Pool,
  ut: UtState,
  req: CupRequest,
): { rung: Rung; def: number; name: string } | null {
  const a = cupOf(ut).active;
  if (
    !a ||
    a.sport !== pool.sport ||
    !validCupRequest(ut, req) ||
    !cupEligibility(pool, ut, a.kind, a.week).ok
  )
    return null;
  const caps = { nba: 107, nfl: 107, soccer: 97 };
  const low = TIER_CUTS[pool.sport].silver;
  const target = Math.max(
    low,
    Math.min(
      caps[pool.sport],
      a.anchor + LEVEL[a.level].ovr[pool.sport] - 4 + req.round * 3,
    ),
  );
  const rung = aiOpponent(
    pool,
    target,
    'cup:' +
      pool.sport +
      ':' +
      a.week +
      ':' +
      a.kind +
      ':' +
      a.id +
      ':' +
      req.round +
      ':' +
      (ut.formation ?? ''),
  );
  return {
    rung: {
      ...rung,
      i: -6,
      title: CUP_NAMES[a.kind] + ' · ' + CUP_ROUNDS[req.round],
      skill: Math.max(
        0.25,
        Math.min(0.98, 0.53 + req.round * 0.09 + LEVEL[a.level].skill),
      ),
      pack: null,
    },
    def: Math.max(-0.6, Math.min(1, LEVEL[a.level].def + req.round * 0.05)),
    name: LEVEL_NAME[a.level] + ' · ' + CUP_ROUNDS[req.round],
  };
}
export function settleCup(
  ut: UtState,
  req: CupRequest,
  r: {
    won: boolean;
    us: number;
    them: number;
    at: number;
    how: 'played' | 'sim';
    matchId: string;
  },
): UtState {
  const a = cupOf(ut).active;
  if (
    !a ||
    !validCupRequest(ut, req) ||
    r.how !== 'played' ||
    typeof r.won !== 'boolean' ||
    !Number.isSafeInteger(r.at) ||
    r.at < 0 ||
    !r.matchId ||
    a.results.some((x) => x.id === r.matchId) ||
    ![r.us, r.them].every((x) => Number.isInteger(x) && x >= 0 && x <= 1000) ||
    (r.us !== r.them && r.won !== r.us > r.them)
  )
    return ut;
  const results = [
    ...a.results,
    { id: r.matchId, won: r.won, us: r.us, them: r.them, at: r.at },
  ];
  return {
    ...ut,
    cup: {
      ...cupOf(ut),
      active: {
        ...a,
        round: results.length,
        results,
        done: !r.won || results.length === 3,
      },
    },
  };
}
function archive(
  ut: UtState,
  a: CupRun,
  outcome: CupArchive['outcome'],
  at: number,
): UtState {
  const c = cupOf(ut),
    history = [
      ...c.history.filter((x) => x.id !== a.id),
      {
        id: a.id,
        kind: a.kind,
        week: a.week,
        sport: a.sport,
        level: a.level,
        at,
        wins: a.results.filter((x) => x.won).length,
        outcome,
      },
    ].slice(-20);
  return { ...ut, cup: { ...c, active: undefined, history } };
}
export function retireCup(ut: UtState, at: number): UtState {
  const a = cupOf(ut).active;
  if (!a || a.done) return ut;
  return archive(ut, a, 'retired', at);
}
export function claimCup(
  ut: UtState,
  pool: Pool,
  day: string,
  at: number,
): { ut: UtState; coins: number; sp: number; pack: string | null } | null {
  const a = cupOf(ut).active;
  if (!a || !a.done || a.sport !== pool.sport) return null;
  const champion = a.results.length === 3 && a.results.every((x) => x.won),
    id = cupClaimId(a.sport, a.week, a.kind);
  let next = archive(ut, a, champion ? 'champion' : 'eliminated', at);
  if (!champion || cupOf(next).claims.includes(id))
    return { ut: next, coins: 0, sp: 0, pack: null };
  const c = cupOf(next),
    prize = CUP_PRIZES[a.kind];
  next = {
    ...next,
    cup: {
      ...c,
      claims: [...c.claims, id],
      trophies: { ...c.trophies, [a.kind]: c.trophies[a.kind] + 1 },
    },
    packs: next.packs.some((p) => p.id === id)
      ? next.packs
      : [...next.packs, { id, kind: prize.pack, at }],
  };
  next = addSeasonXP(next, day, prize.sp);
  return { ut: next, coins: prize.coins, sp: prize.sp, pack: prize.pack };
}
export function cupStatus(
  ut: UtState,
  week: string,
): { line: string; live: boolean; ready: boolean; lastPlayedAt?: number } {
  const c = cupOf(ut),
    a = c.active;
  return a
    ? {
        lastPlayedAt: a.results[a.results.length - 1]?.at ?? a.at,
        line: a.done
          ? a.results.every((r) => r.won)
            ? 'Title won · collect rewards'
            : 'Run complete · see your result'
          : CUP_NAMES[a.kind] +
            ' · ' +
            CUP_ROUNDS[a.round] +
            ' · ' +
            a.results.filter((x) => x.won).length +
            ' wins',
        live: !a.done,
        ready: a.done,
      }
    : {
        line:
          'Three knockout Cups · weekly rewards · ' +
          Object.values(c.trophies).reduce((n, x) => n + x, 0) +
          ' trophies' +
          (c.claims.some((id) => id.includes(week)) ? '' : ' · fresh rewards'),
        live: false,
        ready: false,
      };
}
