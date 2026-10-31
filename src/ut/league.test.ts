// Codex: complete seasons, league bookkeeping, real AI attributes and existing-save preservation.
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { freshProfile } from '../lib/profile';
import {
  applyProgress,
  captureProgress,
  CLOUD_KEYS,
  decryptProgress,
  encryptProgress
} from '../lib/cloud-data';
import { getPool, type Pool } from './pool';
import { freshUt, migrateUt, type UtState } from './state';
import {
  leagueSchedule,
  leagueRequest,
  leagueStandings,
  leagueOpponent,
  leagueOverall,
  settleLeague,
  startLeague,
  validLeagueRequest,
  seasonGames
} from './league';
import { normalizeLeague } from './league-state';
import { withLeagueForm } from './league-form';
import { applyLeagueTeams } from './league-match';
import { teamsOf, squadFromWire } from './teams';
import { settle } from './play';
let pool: Pool, started: UtState;
beforeAll(async () => {
  pool = await getPool();
  const ut = freshUt();
  const rc = [...pool.base.values()][0];
  ut.owned = [
    {
      uid: 'original',
      cardId: rc.line.id,
      level: 4,
      xp: 31,
      at: 1,
      mint: {
        serial: 8,
        totalAtPull: 20,
        requestId: 'original-pull',
        namespace: 'inspect'
      }
    }
  ];
  ut.squad = { [SPORT === 'nba' ? 'PG' : 'QB']: 'original' };
  ut.packs = [{ id: 'old-pack', kind: 'gold', at: 2 }];
  started = startLeague(ut, pool, 'test-season-' + SPORT, 100, 85, 'pro');
}, 60000);
const advance = (ut: UtState, won: boolean) =>
  settleLeague(ut, leagueRequest(ut.league!.active)!, {
    us: won ? 24 : 10,
    them: won ? 10 : 24,
    won
  });
describe('full club season ' + SPORT, () => {
  it('schedules the full league with one game per club per round and no self matches', () => {
    for (const sport of ['nba', 'nfl'] as const) {
      const n = sport === 'nba' ? 30 : 32,
        rounds = leagueSchedule(sport);
      expect(rounds).toHaveLength(seasonGames(sport));
      for (const round of rounds) {
        expect(round).toHaveLength(n / 2);
        expect(new Set(round.flat()).size).toBe(n);
        expect(round.every(([a, b]) => a !== b)).toBe(true);
      }
      if (sport === 'nfl')
        for (let i = 0; i < n; i++)
          expect(
            new Set(
              rounds
                .flat()
                .filter((g) => g.includes(i))
                .map((g) => (g[0] === i ? g[1] : g[0]))
            ).size
          ).toBe(17);
    }
  });
  it('uses deterministic, complete AI rosters without duplicating a player within a club', () => {
    const again = startLeague(
      { ...started, league: undefined },
      pool,
      'test-season-' + SPORT,
      100,
      85,
      'pro'
    );
    expect(again.league).toEqual(started.league);
    const s = started.league!.active;
    for (const t of s.teams.slice(1)) {
      expect(t.players).toHaveLength(SPORT === 'nba' ? 10 : 23);
      expect(
        new Set(t.players.map((p) => pool.byId.get(p.cardId)!.pid)).size
      ).toBe(t.players.length);
    }
    expect(leagueRequest(s)).toEqual(
      leagueRequest(JSON.parse(JSON.stringify(s)))
    );
  });
  it('simulates every other game exactly once, with conserved team records and player scoring', () => {
    const ut = advance(started, true),
      s = ut.league!.active;
    expect(s.round).toBe(1);
    expect(s.results).toHaveLength(s.teams.length / 2);
    expect(s.teams.every((t) => t.w + t.l === 1)).toBe(true);
    expect(s.teams.reduce((sum, t) => sum + t.w, 0)).toBe(
      s.teams.reduce((sum, t) => sum + t.l, 0)
    );
    expect(s.teams.reduce((sum, t) => sum + t.pf, 0)).toBe(
      s.teams.reduce((sum, t) => sum + t.pa, 0)
    );
    for (const t of s.teams.slice(1)) {
      expect(t.players.every((p) => p.stats.games === 1)).toBe(true);
      if (SPORT === 'nba')
        expect(t.players.reduce((sum, p) => sum + p.stats.points, 0)).toBe(
          t.pf
        );
    }
    expect(validLeagueRequest(ut, leagueRequest(started.league!.active)!)).toBe(
      false
    );
    expect(
      settleLeague(ut, leagueRequest(started.league!.active)!, {
        us: 24,
        them: 10,
        won: true
      })
    ).toBe(ut);
  });
  it('completes an undefeated season and every playoff round, with stable rosters and bounded adaptation', () => {
    let ut = started,
      n = 0;
    while (ut.league!.active.phase !== 'complete' && n < 120) {
      ut = advance(ut, true);
      n++;
    }
    const s = ut.league!.active;
    expect(s.phase).toBe('complete');
    expect(s.champion).toBe(0);
    expect(n).toBe(seasonGames(SPORT) + (SPORT === 'nba' ? 12 : 3));
    expect(s.teams.every((t) => t.w + t.l === seasonGames(SPORT))).toBe(true);
    expect(s.results.filter((g) => g.phase === 'regular')).toHaveLength(
      (seasonGames(SPORT) * s.teams.length) / 2
    );
    expect(new Set(s.results.map((g) => g.key)).size).toBe(s.results.length);
    expect(s.teams.reduce((sum, t) => sum + t.w, 0)).toBe(
      s.teams.reduce((sum, t) => sum + t.l, 0)
    );
    expect(leagueStandings(s)[0].id).toBe(0);
    expect(s.adaptive).toBeGreaterThan(0);
    expect(s.adaptive).toBeLessThanOrEqual(5);
    for (const t of s.teams.slice(1)) {
      expect(Math.abs(t.form)).toBeLessThanOrEqual(6);
      expect(t.players.map((p) => p.cardId)).toEqual(
        started.league!.active.teams[t.id].players.map((p) => p.cardId)
      );
      for (const p of t.players)
        expect(Math.abs(p.form)).toBeLessThanOrEqual(6);
      if (SPORT === 'nba')
        expect(t.players.reduce((sum, p) => sum + p.stats.points, 0)).toBe(
          t.pf
        );
    }
    expect(normalizeLeague(s && ut.league)).toEqual(ut.league);
    expect(migrateUt(ut).league).toEqual(ut.league);
    const next = startLeague(ut, pool, 'season-two', 200, 88, 'legend');
    expect(next.league!.active.number).toBe(2);
    expect(next.league!.history[0]).toMatchObject({
      title: true,
      w: seasonGames(SPORT),
      l: 0,
      rank: 1
    });
    expect(next.owned).toEqual(started.owned);
    expect(next.packs).toEqual(started.packs);
    expect(JSON.stringify(ut.league).length).toBeLessThan(500000);
  }, 30000);
  it('finishes the AI championship when the club misses the playoffs', () => {
    let ut = started;
    for (let i = 0; i < seasonGames(SPORT); i++) ut = advance(ut, false);
    const s = ut.league!.active;
    expect(s.phase).toBe('complete');
    expect(s.champion).toBeGreaterThan(0);
    expect(s.teams[0].l).toBe(seasonGames(SPORT));
    expect(s.adaptive).toBeGreaterThanOrEqual(-5);
    expect(s.adaptive).toBeLessThan(0);
  });
  it('handles a playoff sweep loss and finishes remaining AI series without another human fixture', () => {
    let ut = started;
    for (let i = 0; i < seasonGames(SPORT); i++) ut = advance(ut, true);
    expect(ut.league!.active.phase).toBe('playoffs');
    for (let i = 0; i < (SPORT === 'nba' ? 4 : 1); i++) ut = advance(ut, false);
    expect(ut.league!.active.phase).toBe('complete');
    expect(ut.league!.active.champion).not.toBe(0);
    expect(leagueRequest(ut.league!.active)).toBeNull();
  });
  it('changes actual AI attributes and displayed team ratings without editing canonical or owned cards', () => {
    const ut = advance(started, true),
      s = ut.league!.active,
      req = leagueRequest(s)!;
    s.adaptive = 3;
    const opp = leagueOpponent(pool, ut, req)!;
    const p = opp.team.players[0],
      rc = pool.base.get(p.cardId)!,
      before = JSON.stringify(rc);
    const rated = withLeagueForm(rc, 4);
    expect(
      Object.values(rated.attrs).some((v, i) => v > Object.values(rc.attrs)[i])
    ).toBe(true);
    expect(rated.ovr).toBeGreaterThan(rc.ovr);
    expect(JSON.stringify(rc)).toBe(before);
    expect(leagueOverall(s, opp.team, pool)).toBe(opp.rating.ovr);
    const sq = squadFromWire(pool, opp.squad),
      base = teamsOf(SPORT, sq, sq, 'attribute-test'),
      live = applyLeagueTeams(base, pool, opp.form);
    if (SPORT === 'nba') {
      expect(live.rivalFive![0].ovr).not.toBe(base.rivalFive![0].ovr);
      expect(live.rivalFive![0].spd).toBeGreaterThan(base.rivalFive![0].spd);
    } else {
      expect(live.rivalOffense!.qb.ovr).toBeGreaterThan(
        base.rivalOffense!.qb.ovr
      );
      expect(live.rivalDefense!.dl[0].a).not.toEqual(
        base.rivalDefense!.dl[0].a
      );
    }
    expect(live.five ?? live.offense).toBe(base.five ?? base.offense);
    expect(ut.owned).toEqual(started.owned);
  });
  it('settles one played match with existing limits and rejects stale, simulated or malformed season rewards', () => {
    const req = leagueRequest(started.league!.active)!,
      input = {
        league: req,
        matchId: 'played-season',
        us: 24,
        them: 10,
        won: true,
        online: false,
        rung: null,
        played: ['original'],
        week: '2026-10-26',
        day: '2026-10-31',
        packId: 'reward',
        at: 300,
        how: 'played' as const
      };
    for (const bad of [
      { ...input, how: 'sim' as const },
      { ...input, online: true },
      { ...input, us: NaN },
      { ...input, won: false },
      { ...input, league: { ...req, game: 'stale' } }
    ]) {
      const r = settle(started, bad);
      expect(r.ut).toBe(started);
      expect(r.coins).toBe(0);
    }
    const result = settle(started, input);
    expect(result.ut.league!.active.round).toBe(1);
    expect(result.coins).toBe(60);
    expect(result.ut.hq!.history[result.ut.hq!.history.length - 1]?.mode).toBe(
      'league'
    );
    expect(result.ut.owned[0].uid).toBe('original');
    expect(result.ut.owned[0].mint).toEqual(started.owned[0].mint);
    expect(settle(result.ut, input).coins).toBe(0);
    expect(settle(result.ut, { ...input, matchId: 'different-retry' }).ut).toBe(
      result.ut
    );
    const capped = settle(
      { ...started, paid: { day: input.day, n: 8 } },
      input
    );
    expect(capped.coins).toBe(0);
    expect(capped.xp).toBe(0);
    expect(capped.ut.league!.active.round).toBe(1);
  });
  it('preserves the complete season through profile migration and encrypted server snapshot restore', async () => {
    const ut = advance(advance(started, true), false),
      p = { ...freshProfile(), ut, coins: 9750 },
      values = new Map<string, string>();
    values.set(CLOUD_KEYS[0], JSON.stringify(p));
    if (SPORT === 'nfl') values.set(CLOUD_KEYS[1], JSON.stringify(p));
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        values.delete(k);
      }
    };
    const snapshot = captureProgress(storage),
      cipher = await encryptProgress(
        snapshot,
        '11'.repeat(32),
        'inspect',
        'season-test'
      ),
      restored = await decryptProgress(
        cipher,
        '11'.repeat(32),
        'inspect',
        'season-test'
      );
    values.clear();
    applyProgress(storage, restored);
    const got = JSON.parse(values.get(CLOUD_KEYS[0])!);
    expect(migrateUt(got.ut).league).toEqual(ut.league);
    expect(got.coins).toBe(9750);
    expect(got.ut.owned).toEqual(started.owned);
    expect(got.ut.squad).toEqual(started.squad);
    expect(migrateUt({ ...started, league: { active: null } }).owned).toEqual(
      started.owned
    );
    expect(startLeague(ut, pool, 'overwrite', 500, 90, 'pro')).toBe(ut);
  });
});
