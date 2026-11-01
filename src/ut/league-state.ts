// Codex (OpenAI): additive, sport-specific season saves. No owned-card data is replaced.
import type { Level } from './battles';
import type { UtSport } from './types';
export interface LeagueStats {
  games: number;
  points: number;
  rebounds: number;
  assists: number;
  yards: number;
  touchdowns: number;
  tackles: number;
  sacks: number;
}
export interface LeaguePlayer {
  cardId: string;
  slot: string;
  name: string;
  base: number;
  form: number;
  stats: LeagueStats;
}
export interface LeagueTeam {
  id: number;
  abbr: string;
  name: string;
  base: number;
  form: number;
  players: LeaguePlayer[];
  w: number;
  l: number;
  pf: number;
  pa: number;
  last: boolean[];
}
export interface LeagueGame {
  key: string;
  phase: 'regular' | 'playoffs';
  round: number;
  h: number;
  a: number;
  hs: number;
  as: number;
  winner: number;
}
export interface LeagueSeries {
  h: number;
  a: number;
  hw: number;
  aw: number;
}
export interface LeagueSeason {
  v: 1;
  id: string;
  sport: UtSport;
  number: number;
  level: Level;
  at: number;
  anchor: number;
  clubOvr: number;
  adaptive: number;
  round: number;
  phase: 'regular' | 'playoffs' | 'complete';
  teams: LeagueTeam[];
  results: LeagueGame[];
  seeds: number[];
  bracket: LeagueSeries[];
  playoffRound: number;
  champion?: number;
}
export interface LeagueArchive {
  id: string;
  number: number;
  w: number;
  l: number;
  rank: number;
  champion: string;
  title: boolean;
}
export interface LeagueState {
  active: LeagueSeason;
  history: LeagueArchive[];
}
export const seasonGames = (sport: UtSport) => (sport === 'nba' ? 82 : 17);
export const emptyLeagueStats = (): LeagueStats => ({
  games: 0,
  points: 0,
  rebounds: 0,
  assists: 0,
  yards: 0,
  touchdowns: 0,
  tackles: 0,
  sacks: 0
});
const object = (v: unknown): Record<string, any> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
const n = (v: unknown, lo = 0, hi = 1e7) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(lo, Math.min(hi, v))
    : Math.max(0, lo);
const str = (v: unknown, max = 100) =>
  typeof v === 'string' ? v.slice(0, max) : '';
/** Invalid optional season data is isolated from every existing inventory/progress field. */
export function normalizeLeague(raw: unknown): LeagueState | undefined {
  const r = object(raw),
    s = object(r.active),
    sport = s.sport;
  if (
    s.v !== 1 ||
    !['nba', 'nfl'].includes(sport) ||
    typeof s.id !== 'string' ||
    !s.id.length ||
    !['regular', 'playoffs', 'complete'].includes(s.phase) ||
    !['rookie', 'pro', 'allstar', 'legend'].includes(s.level) ||
    !Array.isArray(s.teams) ||
    s.teams.length !== (sport === 'nba' ? 30 : 32)
  )
    return;
  const teams: LeagueTeam[] = s.teams.map((value: any, i: number) => {
    const t = object(value);
    return {
      id: i,
      abbr: str(t.abbr, 5),
      name: str(t.name, 60),
      base: n(t.base, 1, 110),
      form: n(t.form, -6, 6),
      w: Math.floor(n(t.w, 0, 82)),
      l: Math.floor(n(t.l, 0, 82)),
      pf: Math.floor(n(t.pf)),
      pa: Math.floor(n(t.pa)),
      last: Array.isArray(t.last)
        ? t.last.filter((x: unknown) => typeof x === 'boolean').slice(-10)
        : [],
      players: (Array.isArray(t.players) ? t.players : [])
        .slice(0, 23)
        .flatMap((v: any) => {
          const p = object(v);
          if (typeof p.cardId !== 'string' || typeof p.slot !== 'string')
            return [];
          const stats = Object.fromEntries(
            Object.keys(emptyLeagueStats()).map((k) => [
              k,
              Math.floor(n(object(p.stats)[k]))
            ])
          ) as unknown as LeagueStats;
          return [
            {
              cardId: str(p.cardId, 180),
              slot: str(p.slot, 4),
              name: str(p.name, 60),
              base: n(p.base, 1, 110),
              form: n(p.form, -6, 6),
              stats
            }
          ];
        })
    };
  });
  if (teams.some((t) => !t.abbr || !t.name)) return;
  const validId = (x: unknown): x is number =>
    Number.isInteger(x) && Number(x) >= 0 && Number(x) < teams.length;
  const keys = new Set<string>();
  const results: LeagueGame[] = (Array.isArray(s.results) ? s.results : [])
    .slice(0, 1500)
    .flatMap((value: any) => {
      const g = object(value);
      if (
        typeof g.key !== 'string' ||
        keys.has(g.key) ||
        !validId(g.h) ||
        !validId(g.a) ||
        g.h === g.a ||
        ![g.h, g.a].includes(g.winner) ||
        !['regular', 'playoffs'].includes(g.phase)
      )
        return [];
      keys.add(g.key);
      return [
        {
          key: str(g.key, 180),
          phase: g.phase,
          round: Math.floor(n(g.round, 0, 82)),
          h: g.h,
          a: g.a,
          hs: Math.floor(n(g.hs, 0, 1000)),
          as: Math.floor(n(g.as, 0, 1000)),
          winner: g.winner
        }
      ];
    });
  const bracket: LeagueSeries[] = (Array.isArray(s.bracket) ? s.bracket : [])
    .slice(0, 4)
    .flatMap((v: any) =>
      validId(v?.h) && validId(v?.a) && v.h !== v.a
        ? [
            {
              h: v.h,
              a: v.a,
              hw: Math.floor(n(v.hw, 0, 4)),
              aw: Math.floor(n(v.aw, 0, 4))
            }
          ]
        : []
    );
  if (s.phase === 'playoffs' && !bracket.length) return;
  return {
    active: {
      v: 1,
      id: str(s.id, 80),
      sport,
      number: Math.floor(n(s.number, 1, 1e6)),
      level: s.level,
      at: n(s.at, 0, Number.MAX_SAFE_INTEGER),
      anchor: n(s.anchor, 1, 110),
      clubOvr: n(s.clubOvr, 1, 110),
      adaptive: n(s.adaptive, -5, 5),
      round: Math.floor(n(s.round, 0, seasonGames(sport))),
      phase: s.phase,
      teams,
      results,
      seeds: Array.isArray(s.seeds) ? s.seeds.filter(validId).slice(0, 8) : [],
      bracket,
      playoffRound: Math.floor(n(s.playoffRound, 0, 3)),
      ...(validId(s.champion) ? { champion: s.champion } : {})
    },
    history: (Array.isArray(r.history) ? r.history : [])
      .slice(-10)
      .flatMap((v: any) =>
        typeof v?.id === 'string'
          ? [
              {
                id: str(v.id, 80),
                number: Math.floor(n(v.number, 1)),
                w: Math.floor(n(v.w, 0, 82)),
                l: Math.floor(n(v.l, 0, 82)),
                rank: Math.floor(n(v.rank, 1, 32)),
                champion: str(v.champion, 60),
                title: v.title === true
              }
            ]
          : []
      )
  };
}
