// Codex (OpenAI): deterministic season simulation, stable AI rosters and bounded between-game adaptation.
import { DRIVES } from '../game/football2/drive';
import { NBA_TEAMS, NFL_TEAMS } from '../data/teams';
import { hashString, rng } from '../engine/rng';
import { LEVEL, type Level } from './battles';
import type { Pool } from './pool';
import type { UtState } from './state';
import { canPlay, rateSquad, slotsFor } from './squad';
import { rateCard } from './rate';
import { withLeagueForm } from './league-form';
import {
  emptyLeagueStats,
  seasonGames,
  type LeagueSeason,
  type LeagueTeam,
  type LeaguePlayer,
  type LeagueGame,
  type LeagueArchive,
  type LeagueSeries
} from './league-state';
export { seasonGames } from './league-state';
export interface LeagueRequest {
  id: string;
  round: number;
  game: string;
}
export interface LeagueFixture {
  key: string;
  h: number;
  a: number;
}
const bound = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const teamCount = (sport: string) => (sport === 'nba' ? 30 : 32);
/** Circle schedule: 82 complete NBA matchdays, 17 complete NFL matchweeks. Same fixture on reload. */
export function leagueSchedule(sport: 'nba' | 'nfl'): [number, number][][] {
  const count = teamCount(sport),
    wheel = Array.from({ length: count }, (_, i) => i),
    rounds: [number, number][][] = [];
  for (let r = 0; r < count - 1; r++) {
    rounds.push(
      Array.from({ length: count / 2 }, (_, i) => {
        const a = wheel[i],
          b = wheel[count - 1 - i];
        return (r + i) % 2 ? [b, a] : [a, b];
      })
    );
    wheel.splice(1, 0, wheel.pop()!);
  }
  return Array.from({ length: seasonGames(sport) }, (_, i) =>
    rounds[i % (count - 1)].map(([h, a]) =>
      Math.floor(i / (count - 1)) % 2 ? [a, h] : [h, a]
    )
  );
}
export function leagueStandings(s: LeagueSeason): LeagueTeam[] {
  return s.teams
    .slice()
    .sort(
      (a, b) =>
        b.w - a.w || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf || a.id - b.id
    );
}
export function leagueBoost(
  s: LeagueSeason,
  t: LeagueTeam,
  p?: LeaguePlayer
): number {
  return bound(
    t.form +
      (p?.form ?? 0) +
      s.adaptive +
      bound((s.clubOvr - s.anchor) * 0.35, -4, 4),
    -10,
    10
  );
}
export function leagueOverall(
  s: LeagueSeason,
  t: LeagueTeam,
  pool?: Pool
): number {
  if (t.id === 0) return Math.round(s.clubOvr);
  if (pool)
    return rateSquad(
      s.sport,
      Object.fromEntries(
        t.players.map((p) => [
          p.slot,
          withLeagueForm(
            rateCard(
              pool.byId.get(p.cardId)!,
              1,
              slotsFor(s.sport).find((slot) => slot.id === p.slot)?.pos ??
                undefined
            ),
            leagueBoost(s, t, p)
          )
        ])
      )
    ).ovr;
  const slots = slotsFor(s.sport),
    weight = slots.reduce((sum, slot) => sum + slot.weight, 0);
  const form =
    t.players.reduce(
      (sum, p) =>
        sum + (slots.find((slot) => slot.id === p.slot)?.weight ?? 0) * p.form,
      0
    ) / weight;
  return Math.round(bound(t.base + leagueBoost(s, t) + form, 1, 110));
}
export function startLeague(
  ut: UtState,
  pool: Pool,
  id: string,
  at: number,
  ovr: number,
  level: Level,
  favorite?: string | null
): UtState {
  if (ut.league && ut.league.active.phase !== 'complete') return ut;
  const info = (pool.sport === 'nba' ? NBA_TEAMS : NFL_TEAMS).slice(),
    fav = info.findIndex((t) => t.abbr === favorite);
  if (fav > 0) [info[0], info[fav]] = [info[fav], info[0]];
  const rand = rng(hashString(id)),
    all = [...pool.base.values()],
    slots = slotsFor(pool.sport);
  const candidates = Object.fromEntries(
    slots.map((slot) => [slot.id, all.filter((rc) => canPlay(slot, rc))])
  );
  const teams: LeagueTeam[] = info.map((team, i) => {
    const target = bound(
        ovr + LEVEL[level].ovr[pool.sport] + (rand() - 0.5) * 12,
        55,
        105
      ),
      used = new Set<string>();
    const players: LeaguePlayer[] =
      i === 0
        ? []
        : slots.map((slot) => {
            let best: (typeof all)[number] | undefined,
              cost = Infinity;
            for (const rc of candidates[slot.id]) {
              if (used.has(rc.line.pid)) continue;
              const distance =
                Math.abs(rc.ovr - target) + (rc.line.fr === team.abbr ? 0 : 5);
              // Same selection, but avoid hashing candidates that cannot beat the current roster choice.
              if (distance > cost) continue;
              const c =
                distance +
                (hashString(id + ':' + i + ':' + slot.id + ':' + rc.line.id) %
                  100) /
                  100;
              if (c < cost) {
                cost = c;
                best = rc;
              }
            }
            if (!best)
              throw Error('This card pool cannot fill a season roster.');
            used.add(best.line.pid);
            return {
              cardId: best.line.id,
              slot: slot.id,
              name: best.line.name,
              base: rateCard(best.line, 1, slot.pos ?? undefined).ovr,
              form: 0,
              stats: emptyLeagueStats()
            };
          });
    const base =
      i === 0
        ? ovr
        : rateSquad(
            pool.sport,
            Object.fromEntries(
              players.map((p) => [
                p.slot,
                rateCard(
                  pool.byId.get(p.cardId)!,
                  1,
                  slots.find((s) => s.id === p.slot)?.pos ?? undefined
                )
              ])
            )
          ).ovr;
    return {
      id: i,
      abbr: team.abbr,
      name: i === 0 ? 'Your Club' : team.name,
      base,
      form: 0,
      players,
      w: 0,
      l: 0,
      pf: 0,
      pa: 0,
      last: []
    };
  });
  const old = ut.league,
    history = old ? [...old.history, leagueSummary(old.active)].slice(-10) : [];
  return {
    ...ut,
    league: {
      history,
      active: {
        v: 1,
        id,
        sport: pool.sport,
        number: old ? old.active.number + 1 : 1,
        level,
        at,
        anchor: ovr,
        clubOvr: ovr,
        adaptive: 0,
        round: 0,
        phase: 'regular',
        teams,
        results: [],
        seeds: [],
        bracket: [],
        playoffRound: 0
      }
    }
  };
}
const needed = (s: LeagueSeason) => (s.sport === 'nba' ? 4 : 1);
const seriesWon = (s: LeagueSeason, b: LeagueSeries) =>
  Math.max(b.hw, b.aw) >= needed(s);
function fixtures(s: LeagueSeason): LeagueFixture[] {
  if (s.phase === 'complete') return [];
  if (s.phase === 'regular')
    return (leagueSchedule(s.sport)[s.round] ?? []).map(([h, a]) => ({
      h,
      a,
      key: s.id + ':r:' + s.round + ':' + h + ':' + a
    }));
  return s.bracket.flatMap((b, i) => {
    if (seriesWon(s, b)) return [];
    const game = b.hw + b.aw,
      flip = s.sport === 'nba' ? [2, 3, 5].includes(game) : false;
    return [
      {
        h: flip ? b.a : b.h,
        a: flip ? b.h : b.a,
        key: s.id + ':p:' + s.playoffRound + ':' + i + ':' + game
      }
    ];
  });
}
export function nextLeagueGame(s: LeagueSeason): LeagueFixture | null {
  return fixtures(s).find((g) => g.h === 0 || g.a === 0) ?? null;
}
export function leagueRequest(s: LeagueSeason): LeagueRequest | null {
  const game = nextLeagueGame(s);
  return game ? { id: s.id, round: s.round, game: game.key } : null;
}
export function validLeagueRequest(ut: UtState, req: LeagueRequest): boolean {
  const s = ut.league?.active,
    g = s && nextLeagueGame(s);
  return !!s && s.id === req.id && s.round === req.round && g?.key === req.game;
}
export function leagueOpponent(pool: Pool, ut: UtState, req: LeagueRequest) {
  if (!validLeagueRequest(ut, req) || ut.league?.active.sport !== pool.sport)
    return null;
  const s = ut.league!.active,
    g = nextLeagueGame(s)!,
    t = s.teams[g.h === 0 ? g.a : g.h];
  if (t.players.some((p) => !pool.byId.has(p.cardId))) return null;
  const form = Object.fromEntries(
    t.players.map((p) => [p.cardId, leagueBoost(s, t, p)])
  );
  const lineup = Object.fromEntries(
    t.players.map((p) => [
      p.slot,
      withLeagueForm(
        rateCard(
          pool.byId.get(p.cardId)!,
          1,
          slotsFor(pool.sport).find((slot) => slot.id === p.slot)?.pos ??
            undefined
        ),
        form[p.cardId]
      )
    ])
  );
  return {
    team: t,
    form,
    rating: rateSquad(s.sport, lineup),
    squad: t.players.map(
      (p) => [p.slot, p.cardId, 1] as [string, string, number]
    ),
    skill: bound(
      0.66 + LEVEL[s.level].skill + s.adaptive * 0.012 + t.form * 0.008,
      0.42,
      0.94
    ),
    def: bound(LEVEL[s.level].def + s.adaptive * 0.045, -0.6, 1)
  };
}
/** AI-only box scores use arcade-length scoring, not invented full-length user statistics. */
function box(
  s: LeagueSeason,
  t: LeagueTeam,
  points: number,
  rand: () => number,
  win: boolean
) {
  const ps = t.players;
  for (const p of ps) {
    p.stats.games++;
    p.form = bound(
      p.form * 0.92 + (win ? 0.17 : -0.17) + (rand() - 0.5) * 0.7,
      -6,
      6
    );
  }
  if (s.sport === 'nba') {
    const starters = ps.filter((p) => !p.slot.startsWith('B'));
    const weights = starters.map((p) =>
      Math.max(1, p.base + 30 + (rand() - 0.5) * 50)
    );
    let remain = points,
      total = weights.reduce((a, b) => a + b, 0);
    starters.forEach((p, i) => {
      const scored =
        i === starters.length - 1
          ? remain
          : Math.min(remain, Math.round((points * weights[i]) / total));
      remain -= scored;
      p.stats.points += scored;
      p.stats.rebounds += Math.floor(rand() * 4);
      p.stats.assists += Math.floor((scored / 2) * rand() * 0.8);
      p.form = bound(
        p.form +
          bound(
            ((scored - points / 5) / Math.max(1, points / 5)) * 0.18,
            -0.25,
            0.25
          ),
        -6,
        6
      );
    });
  } else {
    const yards = Math.round(60 + points * 8 + rand() * 65),
      pass = Math.round(yards * (0.45 + rand() * 0.3)),
      td =
        Array.from({ length: DRIVES + 1 }, (_, n) => n)
          .filter(
            (n) =>
              points >= n * 7 &&
              (points - n * 7) % 3 === 0 &&
              n + (points - n * 7) / 3 <= DRIVES
          )
          .pop() ?? Math.floor(points / 7);
    const qb = ps.find((p) => p.slot === 'QB'),
      rb = ps.find((p) => p.slot === 'RB'),
      wr = ps.filter((p) => /^(WR|TE)/.test(p.slot));
    if (qb) {
      qb.stats.yards += pass;
      qb.stats.touchdowns += Math.ceil(td * 0.6);
    }
    if (rb) {
      rb.stats.yards += yards - pass;
      rb.stats.touchdowns += Math.floor(td * 0.4);
    }
    const kicker = ps.find((p) => p.slot === 'K');
    if (kicker) kicker.stats.points += Math.max(0, points - td * 6);
    let passingTds = Math.ceil(td * 0.6);
    let left = pass;
    wr.forEach((p, i) => {
      const y =
        i === wr.length - 1
          ? left
          : Math.min(left, Math.floor((pass / wr.length) * (0.5 + rand())));
      left -= y;
      p.stats.yards += y;
      const receivedTd =
        i === wr.length - 1
          ? passingTds
          : Math.min(passingTds, rand() < 0.5 ? 1 : 0);
      passingTds -= receivedTd;
      p.stats.touchdowns += receivedTd;
      p.form = bound(p.form + bound((y - 45) / 150, -0.25, 0.25), -6, 6);
    });
    for (const p of ps.filter((p) => /^(CB|FS|SS|LB|DE|DT)/.test(p.slot))) {
      p.stats.tackles += Math.floor(1 + rand() * 5);
      p.stats.sacks += rand() < 0.12 ? 1 : 0;
    }
  }
}
function playRound(
  s: LeagueSeason,
  human?: { us: number; them: number; won: boolean }
): LeagueSeason {
  const next: LeagueSeason = JSON.parse(JSON.stringify(s)),
    games = fixtures(s);
  for (const f of games) {
    const h = next.teams[f.h],
      a = next.teams[f.a],
      random = rng(hashString(f.key)),
      hr = leagueOverall(s, h),
      ar = leagueOverall(s, a),
      expect = 1 / (1 + Math.exp(-(hr - ar + 1.4) / 10));
    let hs: number, as: number, winner: number;
    if (human && (f.h === 0 || f.a === 0)) {
      hs = f.h === 0 ? human.us : human.them;
      as = f.a === 0 ? human.us : human.them;
      winner = human.won ? 0 : f.h === 0 ? f.a : f.h;
    } else {
      const homeWin = random() < expect,
        pace = s.sport === 'nba' ? 14 : 17;
      const low = Math.max(
          0,
          Math.round(pace + (random() - 0.5) * (s.sport === 'nba' ? 16 : 24))
        ),
        margin = 1 + Math.floor(random() * (s.sport === 'nba' ? 9 : 14));
      hs = homeWin ? low + margin : low;
      as = homeWin ? low : low + margin;
      if (s.sport === 'nfl') {
        const score = () =>
          Array.from({ length: DRIVES }, () => {
            const roll = random();
            return roll < 0.43 ? 7 : roll < 0.64 ? 3 : 0;
          }).reduce((sum: number, p) => sum + p, 0);
        const scores = [score(), score()].sort((a, b) => a - b);
        hs = homeWin ? scores[1] : scores[0];
        as = homeWin ? scores[0] : scores[1];
      }
      winner = homeWin ? f.h : f.a;
    }
    const result: LeagueGame = {
      ...f,
      phase: s.phase === 'regular' ? 'regular' : 'playoffs',
      round: s.phase === 'regular' ? s.round : s.playoffRound,
      hs,
      as,
      winner
    };
    next.results.push(result);
    if (s.phase === 'regular') {
      for (const [t, score, against] of [
        [h, hs, as],
        [a, as, hs]
      ] as const) {
        const won = t.id === winner;
        t.w += won ? 1 : 0;
        t.l += won ? 0 : 1;
        t.pf += score;
        t.pa += against;
        t.last = [...t.last, won].slice(-10);
      }
      if (h.id) box(next, h, hs, random, winner === h.id);
      if (a.id) box(next, a, as, random, winner === a.id);
    }
    for (const [t, expected] of [
      [h, expect],
      [a, 1 - expect]
    ] as const)
      if (t.id) {
        const won = t.id === winner;
        t.form = bound(
          t.form * 0.92 + ((won ? 1 : 0) - expected) * 0.75,
          -6,
          6
        );
      }
    if (s.phase === 'playoffs') {
      const b = next.bracket.find(
        (b) => (b.h === h.id && b.a === a.id) || (b.h === a.id && b.a === h.id)
      )!;
      if (winner === b.h) b.hw++;
      else b.aw++;
    }
  }
  if (human) {
    const margin =
      (human.us - human.them) /
      Math.max(s.sport === 'nba' ? 12 : 17, human.us + human.them);
    const signal = (human.won ? 1 : -1) * 0.38 + bound(margin, -1, 1) * 0.4;
    next.adaptive = bound(next.adaptive * 0.96 + signal, -5, 5);
  }
  if (s.phase === 'regular') {
    next.round++;
    if (next.round === seasonGames(s.sport)) {
      next.phase = 'playoffs';
      next.seeds = leagueStandings(next)
        .slice(0, 8)
        .map((t) => t.id);
      next.bracket = [
        [0, 7],
        [3, 4],
        [1, 6],
        [2, 5]
      ].map(([h, a]) => ({ h: next.seeds[h], a: next.seeds[a], hw: 0, aw: 0 }));
    }
  } else if (next.bracket.every((b) => seriesWon(next, b))) {
    const winners = next.bracket.map((b) => (b.hw > b.aw ? b.h : b.a));
    next.playoffRound++;
    if (winners.length === 1) {
      next.phase = 'complete';
      next.champion = winners[0];
    } else
      next.bracket = Array.from({ length: winners.length / 2 }, (_, i) => ({
        h: winners[i * 2],
        a: winners[i * 2 + 1],
        hw: 0,
        aw: 0
      }));
  }
  return next;
}
export function settleLeague(
  ut: UtState,
  req: LeagueRequest,
  r: { us: number; them: number; won: boolean; clubOvr?: number }
): UtState {
  if (
    !validLeagueRequest(ut, req) ||
    (r.us !== r.them && r.won !== r.us > r.them) ||
    ![r.us, r.them].every((x) => Number.isInteger(x) && x >= 0 && x <= 1000)
  )
    return ut;
  const state = ut.league!;
  let active = playRound(state.active, r);
  active.clubOvr = bound(r.clubOvr ?? active.clubOvr, 1, 110);
  // Finish AI-only playoff matchdays until the club has an opponent or a champion is crowned.
  for (
    let i = 0;
    i < 30 && active.phase === 'playoffs' && !nextLeagueGame(active);
    i++
  )
    active = playRound(active);
  return { ...ut, league: { ...state, active } };
}
export function leagueSummary(s: LeagueSeason): LeagueArchive {
  const t = s.teams[0];
  return {
    id: s.id,
    number: s.number,
    w: t.w,
    l: t.l,
    rank: leagueStandings(s).findIndex((t) => t.id === 0) + 1,
    champion:
      s.champion !== undefined ? s.teams[s.champion].name : 'Unfinished',
    title: s.champion === 0
  };
}
