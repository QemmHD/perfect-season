// Codex: six-match solo competition. Entry state survives reload; milestone prizes pay once per week.
import { aiOpponent, type Rung } from './battles';
import type { Pool } from './pool';
import type { UtState } from './state';
import { depositPrize, hqOf } from './progression';
export const CIRCUIT_GAMES = 6,
  CIRCUIT_ENTRIES = 3;
export const CIRCUIT_PRIZES = [
  { wins: 2, title: 'Contender', coins: 150, pack: 'silver' },
  { wins: 4, title: 'Finalist', coins: 350, pack: 'gold' },
  { wins: 6, title: 'Champion', coins: 750, pack: 'spotlight' }
];
export function circuitOf(ut: UtState, week: string) {
  const h = hqOf(ut),
    c = h.circuit;
  const selected =
    c.week === week || c.active
      ? c
      : {
          week,
          entries: 0,
          best: 0,
          claimed: [],
          ...h.circuitHistory?.[week],
          active: undefined
        };
  // Older clients already kept prize receipts. Reflect them even without a weekly summary.
  const claimed = [
    ...new Set([
      ...selected.claimed,
      ...CIRCUIT_PRIZES.filter((p) =>
        h.claims.includes('circuit:' + selected.week + ':' + p.wins)
      ).map((p) => p.wins)
    ])
  ];
  return { ...selected, claimed, best: Math.max(selected.best, ...claimed, 0) };
}
export function startCircuit(
  ut: UtState,
  week: string,
  id: string,
  at: number
): UtState {
  const h = hqOf(ut),
    c = circuitOf(ut, week);
  if (c.active || c.entries >= CIRCUIT_ENTRIES) return ut;
  return {
    ...ut,
    hq: {
      ...h,
      ...(h.circuit.week && h.circuit.week !== c.week
        ? {
            circuitHistory: {
              ...h.circuitHistory,
              [h.circuit.week]: {
                entries: h.circuit.entries,
                best: h.circuit.best,
                claimed: h.circuit.claimed.slice()
              }
            }
          }
        : {}),
      circuit: {
        ...c,
        entries: c.entries + 1,
        active: { id, games: 0, wins: 0, results: [], at }
      }
    }
  };
}
export function abandonCircuit(ut: UtState): UtState {
  const h = hqOf(ut);
  return { ...ut, hq: { ...h, circuit: { ...h.circuit, active: undefined } } };
}
export function circuitRung(
  pool: Pool,
  ut: UtState,
  runId: string,
  round: number,
  ovr: number
): Rung | null {
  const c = hqOf(ut).circuit,
    a = c.active;
  if (!a || a.id !== runId || a.games !== round || round >= CIRCUIT_GAMES)
    return null;
  const base = aiOpponent(
    pool,
    Math.max(60, Math.min(107, ovr - 4 + round * 1.6)),
    'circuit:' + pool.sport + ':' + c.week + ':' + runId + ':' + round
  );
  return {
    ...base,
    i: -3,
    title: 'Champions Circuit · Match ' + (round + 1),
    skill: 0.56 + round * 0.065,
    pack: null
  };
}
export function settleCircuit(
  ut: UtState,
  runId: string,
  round: number,
  won: boolean,
  at: number
): { ut: UtState; coins: number; prizes: string[] } {
  const h = hqOf(ut),
    c = h.circuit,
    a = c.active;
  if (!a || a.id !== runId || a.games !== round || round >= CIRCUIT_GAMES)
    return { ut, coins: 0, prizes: [] };
  const active = {
      ...a,
      games: a.games + 1,
      wins: a.wins + (won ? 1 : 0),
      results: [...a.results, won]
    },
    claimed = c.claimed.slice();
  let coins = 0,
    next: UtState = {
      ...ut,
      hq: {
        ...h,
        circuit: {
          ...c,
          best: Math.max(c.best, active.wins),
          claimed,
          active: active.games < CIRCUIT_GAMES ? active : undefined
        }
      }
    };
  const prizes: string[] = [];
  for (const p of CIRCUIT_PRIZES)
    if (
      active.wins >= p.wins &&
      !claimed.includes(p.wins) &&
      !hqOf(next).claims.includes('circuit:' + c.week + ':' + p.wins)
    ) {
      claimed.push(p.wins);
      next = {
        ...next,
        hq: {
          ...hqOf(next),
          claims: [...hqOf(next).claims, 'circuit:' + c.week + ':' + p.wins]
        }
      };
      const result = depositPrize(
        next,
        'circuit:' + c.week + ':' + p.wins,
        p,
        at
      );
      next = result.ut;
      coins += result.coins;
      prizes.push(p.title + ' · ' + p.pack + ' pack');
    }
  return { ut: next, coins, prizes };
}
