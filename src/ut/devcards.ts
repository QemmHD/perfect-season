// A stand-in card pool, until the real per-season card data (src/data/cards-<sport>.json and its
// loader, src/ut/cards.ts) lands. Same signature as that loader, so swapping is the one import in
// src/ut/pool.ts.
//
// Each draft line (a player's stint with a team in a decade) becomes one season card: a season in
// that stint, his per-game stats, and ranks worked out from his era-adjusted numbers. A few of the
// best seasons also get a promo copy, and the forty best players a legend card. Football's draft
// data has no defenders, linemen or kickers, so this makes up a full roster for every team-decade
// defense in the data: invented names (pid "dev-..."), real team, colors and decade, quality from
// that defense's real rating. None of it ships once the real data is in.
import { loadAttrs } from '../game/attrs';
import { CELLS } from '../engine/data';
import { hashString, rng } from '../engine/rng';
import { SPORT } from '../engine/sport';
import type { Player } from '../engine/types';
import { rateCard } from './rate';
import type { CardLine, UtSport } from './types';

export interface CardSet {
  lines: CardLine[];
  byId: Map<string, CardLine>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

function seasonOf(p: { id: string; from: number; to: number }): number {
  return p.from + (hashString(p.id + ':season') % (p.to - p.from + 1));
}

/** A 0-1 standing in a sorted list. */
function rankAmong(sorted: number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (sorted[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo / Math.max(1, sorted.length - 1);
}

const NBA_NUMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 40, 41, 42, 44, 45, 50, 52, 54, 55];

function nbaLines(attrsOf: (p: Player) => ReturnType<Awaited<ReturnType<typeof loadAttrs>>>): CardLine[] {
  const keep: { p: Player; c: (typeof CELLS)[number]; a: ReturnType<typeof attrsOf>; per: number; gp: number }[] = [];
  for (const c of CELLS)
    for (const p of c.players) {
      const gp = Math.round(p.g / Math.max(1, p.seasons));
      if (gp < 20) continue;
      const a = attrsOf(p);
      const mpg = a?.mpg ?? null;
      // ranks per minute, the way the real season data ranks
      const per = mpg !== null ? Math.max(0.82, Math.min(1.5, 30 / Math.max(mpg, 8))) : 1;
      keep.push({ p, c, a, per, gp });
    }
  // ranked among the pool itself, as the real data ranks within a season
  const stat = (k: string, x: (typeof keep)[number]) => (k === 'val' ? x.p.val : k === 'pts' ? (x.p.r.pts ?? 0) : (x.p.r[k] ?? 0) * x.per);
  const keys = ['pts', 'reb', 'ast', 'stl', 'blk', 'val'];
  const sorted = Object.fromEntries(keys.map((k) => [k, keep.map((x) => stat(k, x)).sort((a, b) => a - b)]));
  return keep.map((x) => {
    const { p, c, a, gp } = x;
    const season = seasonOf(p);
    return {
      id: 'nba:season:' + season + ':' + p.pid + ':' + c.fr,
      sport: 'nba',
      kind: 'season',
      pid: p.pid,
      name: p.name.replace(/\s*\([^)]*\)\s*$/, ''),
      season,
      fr: c.fr,
      abbr: c.abbr,
      teamName: c.name,
      c1: c.c1,
      c2: c.c2,
      pos: p.pos,
      ht: a?.ht ?? null,
      wt: a?.wt ?? null,
      num: NBA_NUMS[hashString(p.pid) % NBA_NUMS.length],
      games: Math.min(82, gp),
      starts: null,
      stats: {
        g: Math.min(82, gp),
        mpg: a?.mpg ?? null,
        pts: p.s.pts,
        reb: p.s.reb,
        ast: p.s.ast,
        stl: p.s.stl,
        blk: p.s.blk,
        tov: a?.tov ?? null,
        fg2: a?.fg2 ?? null,
        fg3: a?.fg3 ?? null,
        a3: a?.a3 ?? null,
        ft: a?.ft ?? null,
        fta: a?.fta ?? null,
        orb: a?.orb ?? null,
        drb: a?.drb ?? null,
        dunk: a?.dunk ?? null,
        rim: a?.rim ?? null,
      },
      rk: Object.fromEntries(keys.map((k) => [k, r2(rankAmong(sorted[k], stat(k, x)))])),
      honors: [],
    } satisfies CardLine;
  });
}

// ---------- football ----------

const NFL_SKILL = ['QB', 'RB', 'WR', 'TE'];
/** made-up players for each team-decade defense: position, how many, height, weight, numbers */
const NFL_MADE: [string, number, number, number, number[]][] = [
  ['DE', 2, 76, 265, [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 71, 75, 78]],
  ['DT', 2, 75, 300, [90, 92, 93, 94, 95, 97, 98, 99, 72, 74, 76, 77]],
  ['LB', 3, 74, 240, [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 91, 93, 98]],
  ['CB', 2, 71, 190, [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 35, 37, 39]],
  ['S', 2, 72, 205, [20, 21, 22, 24, 25, 26, 27, 29, 30, 31, 32, 36, 38, 41, 43, 47]],
  ['OT', 2, 78, 310, [70, 71, 72, 73, 74, 75, 76, 77, 78, 79]],
  ['OG', 2, 76, 310, [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 73]],
  ['C', 1, 75, 295, [50, 52, 53, 55, 56, 58, 60, 61, 63, 64, 66, 78]],
  ['K', 1, 72, 195, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19]],
];

function honorsFor(q: number): string[] {
  return q >= 0.985 ? ['ALLPRO1'] : q >= 0.96 ? ['ALLPRO2'] : q >= 0.92 ? ['PB'] : [];
}

function nflLines(attrsOf: (p: Player) => ReturnType<Awaited<ReturnType<typeof loadAttrs>>>): CardLine[] {
  const out: CardLine[] = [];
  // each skill position's era-adjusted values, to rank a line among its own position
  const sorted: Record<string, number[]> = {};
  const add = (k: string, v: number) => (sorted[k] ??= []).push(v);
  const firsts: string[] = [];
  const lasts: string[] = [];
  for (const c of CELLS)
    for (const p of c.players) {
      const pos = p.pos[0];
      if (pos === 'DEF') {
        add('DEF', p.r.def ?? 0);
        continue;
      }
      for (const k of ['pass', 'rush', 'recv']) add(pos + k, p.r[k] ?? 0);
      add(pos + 'val', p.val);
      const parts = p.name.replace(/\s*\([^)]*\)\s*$/, '').split(' ');
      if (parts.length >= 2) {
        firsts.push(parts[0]);
        lasts.push(parts[parts.length - 1]);
      }
    }
  for (const k of Object.keys(sorted)) sorted[k].sort((a, b) => a - b);
  const F = Array.from(new Set(firsts)).sort();
  const L = Array.from(new Set(lasts)).sort();
  const base = (c: (typeof CELLS)[number]) => ({ fr: c.fr, abbr: c.abbr, teamName: c.name, c1: c.c1, c2: c.c2 });
  for (const c of CELLS)
    for (const p of c.players) {
      const pos = p.pos[0];
      if (pos !== 'DEF') {
        if (!NFL_SKILL.includes(pos)) continue;
        const gp = Math.min(17, Math.round(p.g / Math.max(1, p.seasons)));
        if (gp < 6) continue;
        const a = attrsOf(p);
        const season = seasonOf(p);
        const rk: Record<string, number | null> = { val: r2(rankAmong(sorted[pos + 'val'], p.val)) };
        if (pos === 'QB') {
          rk.pass = r2(rankAmong(sorted.QBpass, p.r.pass ?? 0));
          rk.rush = r2(rankAmong(sorted.QBrush, p.r.rush ?? 0) * 0.7);
        } else if (pos === 'RB') {
          rk.rush = r2(rankAmong(sorted.RBrush, p.r.rush ?? 0));
          rk.recv = r2(rankAmong(sorted.RBrecv, p.r.recv ?? 0) * 0.85);
        } else rk.recv = r2(rankAmong(sorted[pos + 'recv'], p.r.recv ?? 0));
        const tot = (k: string) => Math.round((p.s[k] ?? 0) * gp);
        out.push({
          id: 'nfl:season:' + season + ':' + p.pid + ':' + c.fr,
          sport: 'nfl',
          kind: 'season',
          pid: p.pid,
          name: p.name.replace(/\s*\([^)]*\)\s*$/, ''),
          season,
          ...base(c),
          pos: [pos],
          ht: a?.ht ?? null,
          wt: a?.wt ?? null,
          num: a?.num ?? null,
          games: gp,
          starts: null,
          stats: { g: gp, passYds: tot('passYds'), passTd: tot('passTd'), int: tot('int'), rushYds: tot('rushYds'), rushTd: tot('rushTd'), rec: tot('rec'), recYds: tot('recYds'), recTd: tot('recTd') },
          rk,
          honors: honorsFor(rk.val ?? 0),
        });
        continue;
      }
      // the defense card: a whole made-up roster of defenders, linemen and a kicker
      const q = rankAmong(sorted.DEF, p.r.def ?? 0);
      const rand = rng(hashString('dev:' + c.id));
      const season = c.from + Math.floor(rand() * (c.to - c.from + 1));
      for (const [mp, n, ht, wt, nums] of NFL_MADE)
        for (let i = 0; i < n; i++) {
          const qual = clamp01(0.3 * q + 0.7 * Math.pow(rand(), 0.85));
          const name = F[Math.floor(rand() * F.length)] + ' ' + L[Math.floor(rand() * L.length)];
          const pid = 'dev-' + (hashString(c.id + mp + i) % 1e8).toString(36);
          const gp = Math.min(17, 10 + Math.floor(rand() * 8));
          const jit = (s: number) => Math.round((rand() - 0.5) * s);
          const near = (x: number) => r2(clamp01(x + (rand() - 0.5) * 0.25));
          const stats: Record<string, number | null> = { g: gp, gs: Math.max(0, gp - Math.floor(rand() * 4)) };
          const rk: Record<string, number | null> = { val: r2(qual) };
          if (mp === 'DE' || mp === 'DT') {
            stats.tkl = Math.round(25 + 50 * qual + jit(10));
            stats.sk = Math.round((mp === 'DE' ? 14 : 9) * Math.pow(qual, 1.6) * 10) / 10;
            rk.sk = near(qual);
            rk.tkl = near(qual);
          } else if (mp === 'LB') {
            stats.tkl = Math.round(50 + 90 * qual + jit(16));
            stats.sk = Math.round(6 * Math.pow(qual, 2) * 10) / 10;
            stats.int = Math.round(3 * qual * rand());
            rk.tkl = near(qual);
            rk.sk = near(qual * 0.8);
          } else if (mp === 'CB' || mp === 'S') {
            stats.tkl = Math.round(35 + 50 * qual + jit(12));
            stats.int = Math.round(8 * Math.pow(qual, 1.5) * (0.6 + 0.6 * rand()));
            stats.pd = Math.round(4 + 16 * qual + jit(4));
            rk.int = near(qual);
            rk.pd = near(qual);
          } else if (mp === 'K') {
            const fga = 18 + Math.floor(rand() * 18);
            stats.fga = fga;
            stats.fgm = Math.round(fga * (0.62 + 0.3 * qual));
            stats.xpm = 20 + Math.floor(rand() * 30);
            stats.lng = 44 + Math.round(14 * qual);
            rk.fgp = near(qual);
          }
          out.push({
            id: 'nfl:season:' + season + ':' + pid + ':' + c.fr,
            sport: 'nfl',
            kind: 'season',
            pid,
            name,
            season,
            ...base(c),
            pos: [mp],
            ht: ht + jit(3),
            wt: wt + jit(24),
            num: nums[Math.floor(rand() * nums.length)],
            games: gp,
            starts: stats.gs ?? null,
            stats,
            rk,
            honors: honorsFor(qual),
          });
        }
    }
  return out;
}

/** The best few seasons get a promo copy (one per player), and the forty best players a legend. */
function specials(season: CardLine[]): CardLine[] {
  const best = new Map<string, CardLine>();
  for (const l of season) {
    if (l.pid.startsWith('dev-')) continue;
    const b = best.get(l.pid);
    if (!b || (l.rk.val ?? 0) > (b.rk.val ?? 0)) best.set(l.pid, l);
  }
  const ovr = new Map(Array.from(best.values()).map((l) => [l.id, rateCard(l).ovr]));
  const ranked = Array.from(best.values()).sort((a, b) => ovr.get(b.id)! - ovr.get(a.id)! || (b.rk.val ?? 0) - (a.rk.val ?? 0) || (a.id < b.id ? -1 : 1));
  const out: CardLine[] = [];
  // legends: forty from the best 200 players, so they run the whole 90-99 range
  const legends = ranked.slice(0, 200).filter((_, i) => i % 5 === 0);
  const legendPids = new Set(legends.map((l) => l.pid));
  for (const l of legends) {
    const base = ovr.get(l.id)!;
    out.push({ ...l, id: l.id.replace(':season:', ':legend:'), kind: 'legend', boost: Math.max(0, 90 - base) + (hashString(l.id) % 3), label: 'Legend' });
  }
  // promos: about 2.5% of the pool, good (not all-time) players' best seasons, +3 to +6
  const nPromo = Math.round(season.length * 0.025);
  const mid = ranked.filter((l) => !legendPids.has(l.pid) && ovr.get(l.id)! >= 76 && ovr.get(l.id)! <= 92);
  const step = Math.max(1, Math.floor(mid.length / nPromo));
  for (const l of mid.filter((_, i) => i % step === 0).slice(0, nPromo)) out.push({ ...l, id: l.id.replace(':season:', ':promo:'), kind: 'promo', boost: 3 + (hashString(l.id) % 4), label: 'Hot Season' });
  return out;
}

let cache: Promise<CardSet> | null = null;

/** The pool for this page's sport (the draft data only holds one sport per page load). */
export function loadCards(sport: UtSport): Promise<CardSet> {
  if (sport !== SPORT) return Promise.reject(new Error('dev cards: this page plays ' + SPORT));
  cache ??= loadAttrs().then((attrsOf) => {
    const season = sport === 'nba' ? nbaLines(attrsOf) : nflLines(attrsOf);
    const byId = new Map<string, CardLine>();
    for (const l of [...season, ...specials(season)]) if (!byId.has(l.id)) byId.set(l.id, l);
    return { lines: Array.from(byId.values()), byId };
  });
  return cache;
}
