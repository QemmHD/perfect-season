// Codex (OpenAI): optional own-club Cup progress; preserves every existing profile/inventory field.
import type { Level } from './battles';
import type { UtSport } from './types';
export const CUP_KINDS = ['open', 'silver', 'chemistry'] as const;
export type CupKind = (typeof CUP_KINDS)[number];
export interface CupResult {
  id: string;
  won: boolean;
  us: number;
  them: number;
  at: number;
}
export interface CupRun {
  id: string;
  kind: CupKind;
  week: string;
  sport: UtSport;
  level: Level;
  anchor: number;
  /** Silver qualification is frozen at entered copy levels; earned XP never strands a run. */
  entryLevels?: Record<string, number>;
  at: number;
  round: number;
  results: CupResult[];
  done: boolean;
}
export interface CupArchive {
  id: string;
  kind: CupKind;
  week: string;
  sport: UtSport;
  level: Level;
  at: number;
  wins: number;
  outcome: 'champion' | 'eliminated' | 'retired';
}
export interface CupState {
  active?: CupRun;
  /** Permanent first-title receipts. Never prune them when trimming visual history. */
  claims: string[];
  trophies: Record<CupKind, number>;
  history: CupArchive[];
}
export const freshCup = (): CupState => ({
  claims: [],
  trophies: { open: 0, silver: 0, chemistry: 0 },
  history: [],
});
const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const nat = (x: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof x === 'number' && Number.isFinite(x)
    ? Math.min(max, Math.max(0, Math.floor(x)))
    : 0;
const key = (x: unknown) =>
  typeof x === 'string' && x.length > 0 && x.length <= 180;
const sport = (x: unknown): x is UtSport =>
  ['nba', 'nfl', 'soccer'].includes(String(x));
const kind = (x: unknown): x is CupKind => CUP_KINDS.includes(x as CupKind);
const level = (x: unknown): Level =>
  ['rookie', 'pro', 'allstar', 'legend'].includes(String(x))
    ? (x as Level)
    : 'pro';
const week = (x: unknown) => typeof x === 'string' && /^\d{4}-W\d{2}$/.test(x);
export function normalizeCup(raw: unknown): CupState | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = obj(raw),
    out = freshCup(),
    a = obj(r.active);
  if (Array.isArray(r.claims))
    out.claims = [
      ...new Set(
        r.claims.filter(
          (v): v is string =>
            typeof v === 'string' &&
            /^cup:(nba|nfl|soccer):\d{4}-W\d{2}:(open|silver|chemistry)$/.test(
              v,
            ),
        ),
      ),
    ];
  const trophies = obj(r.trophies);
  for (const k of CUP_KINDS) out.trophies[k] = nat(trophies[k], 1000000);
  if (Array.isArray(r.history))
    out.history = r.history
      .flatMap((v) => {
        const x = obj(v);
        return key(x.id) &&
          kind(x.kind) &&
          sport(x.sport) &&
          week(x.week) &&
          ['champion', 'eliminated', 'retired'].includes(String(x.outcome))
          ? [
              {
                id: String(x.id),
                kind: x.kind,
                sport: x.sport,
                week: String(x.week),
                level: level(x.level),
                at: nat(x.at),
                wins: nat(x.wins, 3),
                outcome: x.outcome as CupArchive['outcome'],
              },
            ]
          : [];
      })
      .slice(-20);
  if (
    key(a.id) &&
    kind(a.kind) &&
    sport(a.sport) &&
    week(a.week) &&
    Array.isArray(a.results)
  ) {
    const results: CupResult[] = [];
    const seen = new Set<string>();
    for (const value of a.results.slice(0, 3)) {
      const x = obj(value);
      if (
        !key(x.id) ||
        typeof x.won !== 'boolean' ||
        !Number.isInteger(x.us) ||
        !Number.isInteger(x.them) ||
        Number(x.us) < 0 ||
        Number(x.them) < 0 ||
        Number(x.us) > 1000 ||
        Number(x.them) > 1000 ||
        seen.has(String(x.id)) ||
        (x.us !== x.them && x.won !== Number(x.us) > Number(x.them))
      )
        break;
      results.push({
        id: String(x.id),
        won: x.won,
        us: Number(x.us),
        them: Number(x.them),
        at: nat(x.at),
      });
      seen.add(String(x.id));
      if (!x.won) break;
    }
    out.active = {
      id: String(a.id),
      kind: a.kind,
      week: String(a.week),
      sport: a.sport,
      level: level(a.level),
      anchor: Math.max(1, nat(a.anchor, 110)),
      ...(a.entryLevels && typeof a.entryLevels === 'object'
        ? {
            entryLevels: Object.fromEntries(
              Object.entries(obj(a.entryLevels)).filter(
                ([uid, value]) =>
                  key(uid) &&
                  Number.isInteger(value) &&
                  Number(value) >= 1 &&
                  Number(value) <= 5,
              ),
            ) as Record<string, number>,
          }
        : {}),
      at: nat(a.at),
      round: results.length,
      results,
      done: results.some((x) => !x.won) || results.length === 3,
    };
  }
  return out;
}
