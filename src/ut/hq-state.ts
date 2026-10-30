// Codex: optional, additive Ultimate Team clubhouse progress. Never replaces owned copies.
import type { OwnedCard } from './types';
export const COUNTERS = [
  'games',
  'wins',
  'points',
  'onlineWins',
  'packs',
  'sbcs',
  'moments',
  'development'
] as const;
export type Counter = (typeof COUNTERS)[number];
export type Totals = Record<Counter, number>;
export interface ClubMatch {
  id: string;
  at: number;
  mode: 'battle' | 'online' | 'event' | 'circuit';
  won: boolean;
  us: number;
  them: number;
  opponent: string;
  coins: number;
  xp: number;
}
export interface ClubPreset {
  id: number;
  name: string;
  squad: Record<string, string>;
  at: number;
}
export interface Development {
  uid: string;
  path: 'breakout' | 'captain' | 'ironman';
  games: number;
  wins: number;
  points: number;
  at: number;
}
export interface CircuitRun {
  id: string;
  games: number;
  wins: number;
  results: boolean[];
  at: number;
}
export interface ClubHQ {
  totals: Totals;
  days: Record<string, Totals>;
  weeks: Record<string, Totals>;
  seasons: Record<string, { xp: number; claimed: number[] }>;
  claims: string[];
  journal: string[];
  history: ClubMatch[];
  cardStats: Record<string, { games: number; wins: number }>;
  presets: ClubPreset[];
  development: {
    active?: Development;
    completed: Record<string, { path: string; at: number }>;
  };
  moments: Record<
    string,
    { best: number; completedAt?: number; claimed?: boolean }
  >;
  circuit: {
    week: string;
    entries: number;
    best: number;
    claimed: number[];
    active?: CircuitRun;
  };
}
export const emptyTotals = (): Totals =>
  Object.fromEntries(COUNTERS.map((k) => [k, 0])) as Totals;
export const freshHQ = (): ClubHQ => ({
  totals: emptyTotals(),
  days: {},
  weeks: {},
  seasons: {},
  claims: [],
  journal: [],
  history: [],
  cardStats: {},
  presets: [],
  development: { completed: {} },
  moments: {},
  circuit: { week: '', entries: 0, best: 0, claimed: [] }
});
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const nat = (v: unknown, max = 2_000_000_000) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.floor(v)))
    : 0;
const timestamp = (v: unknown) => nat(v, Number.MAX_SAFE_INTEGER);
const strs = (v: unknown) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.filter((x): x is string => typeof x === 'string' && x.length < 200)
        )
      ]
    : [];
const totals = (v: unknown): Totals =>
  Object.fromEntries(COUNTERS.map((k) => [k, nat(obj(v)[k])])) as Totals;
const numbers = (v: unknown, max: number) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.filter(
            (x): x is number => Number.isInteger(x) && x >= 1 && x <= max
          )
        )
      ]
    : [];
export function normalizeHQ(raw: unknown, owned: OwnedCard[]): ClubHQ {
  const r = obj(raw),
    base = freshHQ(),
    uids = new Set(owned.map((c) => c.uid));
  const days = Object.fromEntries(
    Object.entries(obj(r.days))
      .filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .map(([k, v]) => [k, totals(v)])
  );
  const weeks = Object.fromEntries(
    Object.entries(obj(r.weeks))
      .filter(([k]) => k.length < 40)
      .map(([k, v]) => [k, totals(v)])
  );
  const seasons = Object.fromEntries(
    Object.entries(obj(r.seasons))
      .filter(([k]) => /^season:\d+$/.test(k))
      .map(([k, v]) => [
        k,
        { xp: nat(obj(v).xp, 7500), claimed: numbers(obj(v).claimed, 25) }
      ])
  );
  const presets = (Array.isArray(r.presets) ? r.presets : []).flatMap((v) => {
    const p = obj(v);
    if (!Number.isInteger(p.id) || Number(p.id) < 0 || Number(p.id) > 2)
      return [];
    const seen = new Set<string>();
    const squad = Object.fromEntries(
      Object.entries(obj(p.squad)).filter(([slot, uid]) => {
        if (
          !/^[A-Z0-9]{1,4}$/.test(slot) ||
          typeof uid !== 'string' ||
          !uids.has(uid) ||
          seen.has(uid)
        )
          return false;
        seen.add(uid);
        return true;
      })
    ) as Record<string, string>;
    return [
      {
        id: Number(p.id),
        name:
          typeof p.name === 'string'
            ? p.name.slice(0, 22)
            : 'Squad ' + (Number(p.id) + 1),
        squad,
        at: timestamp(p.at)
      }
    ];
  });
  const dev = obj(r.development),
    a = obj(dev.active),
    active =
      typeof a.uid === 'string' &&
      uids.has(a.uid) &&
      ['breakout', 'captain', 'ironman'].includes(String(a.path))
        ? {
            uid: a.uid,
            path: a.path as Development['path'],
            games: nat(a.games),
            wins: nat(a.wins),
            points: nat(a.points),
            at: timestamp(a.at)
          }
        : undefined;
  const completed = Object.fromEntries(
    Object.entries(obj(dev.completed))
      .filter(([uid, v]) => uids.has(uid) && typeof obj(v).path === 'string')
      .map(([uid, v]) => [
        uid,
        { path: String(obj(v).path).slice(0, 30), at: timestamp(obj(v).at) }
      ])
  );
  const circuit = obj(r.circuit),
    run = obj(circuit.active),
    results = Array.isArray(run.results)
      ? run.results
          .filter((x): x is boolean => typeof x === 'boolean')
          .slice(0, 6)
      : [];
  return {
    ...base,
    totals: totals(r.totals),
    days,
    weeks,
    seasons,
    claims: strs(r.claims),
    journal: strs(r.journal).slice(-5000),
    history: (Array.isArray(r.history) ? r.history : [])
      .flatMap((v) => {
        const h = obj(v);
        if (
          typeof h.id !== 'string' ||
          !['battle', 'online', 'event', 'circuit'].includes(String(h.mode))
        )
          return [];
        return [
          {
            id: h.id,
            at: timestamp(h.at),
            mode: h.mode as ClubMatch['mode'],
            won: h.won === true,
            us: nat(h.us),
            them: nat(h.them),
            opponent:
              typeof h.opponent === 'string'
                ? h.opponent.slice(0, 60)
                : 'Opponent',
            coins: nat(h.coins),
            xp: nat(h.xp)
          }
        ];
      })
      .slice(-20),
    cardStats: Object.fromEntries(
      Object.entries(obj(r.cardStats))
        .filter(([uid]) => uids.has(uid))
        .map(([uid, v]) => [
          uid,
          { games: nat(obj(v).games), wins: nat(obj(v).wins) }
        ])
    ),
    presets: presets.filter(
      (p, i) => presets.findIndex((x) => x.id === p.id) === i
    ),
    development: { ...(active ? { active } : {}), completed },
    moments: Object.fromEntries(
      Object.entries(obj(r.moments))
        .filter(([id]) => id.length < 80)
        .map(([id, v]) => [
          id,
          {
            best: nat(obj(v).best),
            ...(timestamp(obj(v).completedAt)
              ? { completedAt: timestamp(obj(v).completedAt) }
              : {}),
            ...(obj(v).claimed === true ? { claimed: true } : {})
          }
        ])
    ),
    circuit: {
      week: typeof circuit.week === 'string' ? circuit.week : '',
      entries: nat(circuit.entries, 3),
      best: nat(circuit.best, 6),
      claimed: numbers(circuit.claimed, 6),
      ...(typeof run.id === 'string' && results.length < 6
        ? {
            active: {
              id: run.id,
              games: results.length,
              wins: results.filter(Boolean).length,
              results,
              at: timestamp(run.at)
            }
          }
        : {})
    }
  };
}
