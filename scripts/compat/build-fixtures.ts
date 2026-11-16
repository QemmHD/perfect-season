// Claude, 2026-11-10 (studio overhaul, team ut): writes src/ut/compat/acdf3e2-<sport>.json, an old
// save per sport with every field family a live (acdf3e2) client writes. Built with the old tree's
// own code (scripts/compat/acdf3e2.ts), then saved through its own profile code, so each fixture is
// exactly what a phone that has not updated holds in localStorage. Deterministic: fixed ids, days
// and card picks; re-running it gives the same files.
//   bash O/heavy.sh npx vite-node scripts/compat/build-fixtures.ts            (all three sports)
//   PS_SPORT=nfl PS_COMPAT_ONE=1 npx vite-node scripts/compat/build-fixtures.ts (one sport)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryStorage, oldSrc, REPO, useStorage } from './acdf3e2';

const SPORTS = ['nba', 'nfl', 'soccer'] as const;
const DAY = '2026-11-08';
const T0 = Date.parse('2026-11-08T15:00:00Z');

if (!process.env.PS_COMPAT_ONE) {
  for (const sport of SPORTS)
    execFileSync('npx', ['vite-node', 'scripts/compat/build-fixtures.ts'], { cwd: REPO, stdio: 'inherit', env: { ...process.env, PS_SPORT: sport, PS_COMPAT_ONE: '1' } });
  process.exit(0);
}

const storage = useStorage(new MemoryStorage());
const S = oldSrc();
type Mod = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const load = (p: string): Promise<Mod> => import(join(S, p));
// one at a time: parallel imports of a module graph with cycles can stall vite-node silently
const mods: Mod[] = [];
for (const f of ['engine/sport.ts', 'lib/profile.ts', 'ut/state.ts', 'ut/pool.ts', 'ut/squad.ts', 'ut/progression.ts', 'ut/league.ts', 'ut/moments.ts', 'ut/rivals.ts', 'net/leaderboard.ts'])
  mods.push(await load(f));
const [{ SPORT }, profile, state, poolMod, squadMod, prog, leagueMod, momentsMod, rivalsMod, weekMod] = mods;
const sport: 'nba' | 'nfl' | 'soccer' = SPORT;
const pool = await poolMod.getPool();
const week: string = weekMod.weekKey(DAY);
const prevWeek = '2026-W44';
const all = [...pool.base.values()].sort((a: Mod, b: Mod) => (a.line.id < b.line.id ? -1 : 1));

// ---------- the club: a full squad, a spare copy, a levelled minted copy, a locked one ----------
if (sport === 'soccer') squadMod.setSoccerFormation('4-2-3-1');
const used = new Set<string>();
const owned: Mod[] = [];
const club: Mod[] = [];
let n = 0;
const own = (rc: Mod, extra: Mod = {}) => {
  const c = { uid: 'compat-' + sport + '-' + n++, cardId: rc.line.id, level: 1, xp: 0, at: T0 - 86400000 * 30 + n * 1000, ...extra };
  owned.push(c);
  club.push({ uid: c.uid, rc });
  return c;
};
for (const slot of squadMod.slotsFor(sport)) {
  const rc = all.find((c: Mod) => squadMod.canPlay(slot, c) && !used.has(c.line.pid) && c.tier === 'gold') ?? all.find((c: Mod) => squadMod.canPlay(slot, c) && !used.has(c.line.pid));
  used.add(rc.line.pid);
  own(rc);
}
owned[0].level = 4;
owned[0].xp = 120;
owned[0].mint = { serial: 7, totalAtPull: 31, activeAtPull: 29, requestId: 'compat-request-' + sport, namespace: 'inspect' };
owned[1].level = 5;
owned[2].level = 2;
owned[2].xp = 35;
const spare = own(club[3].rc, { level: 1, xp: 10 }); // an exact duplicate: lands in duplicate storage
const goat = all.find((c: Mod) => c.tier === 'goat' || c.tier === 'legend') ?? all[all.length - 1];
own(goat, { level: 3, xp: 60 });
const squad = squadMod.autoBuild(sport, club.filter((c) => c.uid !== spare.uid));
const sq = Object.entries(squad) as [string, string][];

let ut: Mod = { ...state.freshUt(), owned, squad, packsOpened: 14, starterClaimed: true };
if (sport === 'soccer') ut.formation = '4-2-3-1';

// ---------- match progress through the real recorder: history, totals, days, weeks, journal, SP ----------
const played = sq.slice(0, 3).map(([, uid]) => uid);
const matches: [string, string, boolean, number, number, string][] = [
  ['2026-11-07', 'battle', true, 64, 51, 'Rung 1'],
  ['2026-11-07', 'circuit', false, 48, 55, 'Circuit 2'],
  ['2026-11-08', 'league', true, 70, 66, 'Season game'],
  ['2026-11-08', 'online', true, 61, 59, 'Rival'],
];
matches.forEach(([day, mode, won, us, them, opponent], i) => {
  ut = prog.recordMatchProgress(ut, { id: 'compat-match-' + i, at: T0 - (4 - i) * 3600000, mode, won, us, them, opponent, coins: 120, xp: 40, day, how: 'played', played }).ut;
});
const deck = prog.objectiveDeck(ut, DAY).filter((o: Mod) => o.progress >= o.target && !o.claimed);
if (deck[0]) ut = prog.claimObjective(ut, deck[0].id, DAY, T0).ut;
const season = prog.seasonFor(DAY).id;
const h = ut.hq;
ut.hq = {
  ...h,
  seasons: { ...h.seasons, [season]: { xp: Math.max(h.seasons[season]?.xp ?? 0, 1250), claimed: [1, 2, 3] }, 'season:1': { xp: 7500, claimed: [1, 2, 3, 4, 5, 10, 25] } },
  claims: [...h.claims, 'weekly:' + prevWeek + ':wins10', 'daily:2026-11-06:games3', 'season-banked:season:1'],
  presets: [
    { id: 0, name: 'Main squad', squad, at: T0 - 7200000 },
    { id: 2, name: 'Bench mob', squad: Object.fromEntries(sq.slice(0, 2)), at: T0 - 3600000 },
  ],
  development: {
    active: { uid: sq[0][1], path: 'captain', games: 2, wins: 1, points: 30, at: T0 - 7200000 },
    completed: { [sq[1][1]]: { path: 'breakout', at: T0 - 86400000 * 3 } },
  },
  moments:
    sport === 'soccer'
      ? {}
      : Object.fromEntries(momentsMod.momentsFor(sport).slice(0, 2).map((m: Mod, i: number) => [m.id, i ? { best: 1 } : { best: m.target, completedAt: T0 - 86400000, claimed: true }])),
  circuit: { week, entries: 2, best: 4, claimed: [3], active: { id: 'compat-circuit-' + sport, games: 3, wins: 2, results: [true, false, true], at: T0 - 5400000 } },
  circuitHistory: { [prevWeek]: { entries: 3, best: 5, claimed: [3, 5] } },
};

// ---------- the rest of `ut` ----------
const ids = all.slice(40, 60).map((c: Mod) => c.line.id);
ut = {
  ...ut,
  sbc: { done: { 'starter-five': T0 - 86400000 * 9, ['weekly:' + prevWeek]: T0 - 86400000 * 4 } },
  packs: [
    { id: 'compat-gold-' + sport, kind: 'gold', at: T0 - 600000 },
    { id: 'compat-gift-' + sport, kind: 'jumbo', at: T0 - 300000, voucher: { index: 0, event: { id: 'f'.repeat(64), pubkey: 'e'.repeat(64), created_at: 1762600000, kind: 1, tags: [], content: '', sig: 'd'.repeat(128) } } },
  ],
  sold: { cards: 37, coins: 4210 },
  battles: { week, cleared: 3, best: 6, round: 2, level: 'allstar' },
  record: { w: 41, l: 17, h2hW: 9, h2hL: 6 },
  paid: { day: DAY, n: 3 },
  content: {
    daily: { day: DAY, streak: 4, total: 23 },
    buys: { ['elite:' + DAY]: 1, ['scout:' + week]: 2 },
    picks: [{ id: 'compat-scout-' + sport, kind: 'scout', title: "Scout's Choice", options: ids.slice(0, 3), at: T0 - 120000 }],
    claims: ['pick:compat-old-pick', 'set:compat-set', 'daily-bonus:2026-11-07', 'draft:compat-old-draft', 'new-era:' + sport],
    market: { day: DAY, bought: [0, 2] },
    soWins: { week, ids: ['compat-match-0', 'compat-match-2'] },
    draft: {
      active: {
        id: 'compat-draft-' + sport,
        at: T0 - 3000000,
        week,
        paid: 'token',
        captains: ids.slice(3, 8),
        squad: Object.fromEntries(sq.slice(0, 3).map(([slot], i) => [slot, ids[8 + i]])),
        pick: { slot: sq[3][0], options: ids.slice(11, 16) },
        games: 1,
        wins: 1,
        results: [true],
        done: false,
      },
      tokenWeek: week,
      history: [{ id: 'compat-old-draft', wins: 3, at: T0 - 86400000 * 6 }],
    },
    era: { eligible: true },
    locked: [owned[0].uid],
    evo: { [sq[2][1]]: { done: ['rising-1'], active: { id: 'rising-2', games: 2, wins: 1, at: T0 - 7000000 } } },
    evoSeen: ['rising-1', 'rising-2'],
    streams: { 'compat-stream': 140 },
    calendar: { day: '2026-11-07', n: 3 },
    preview: { seed: 'compat-seed-' + sport, n: 2, until: T0 + 3600000 },
    pulls: {
      since: T0 - 86400000 * 20,
      r: [{ id: 'compat-gold-old', k: 'gold', n: 'Gold Pack', c: 7500, s: 'store', at: T0 - 86400000, u: 'compat-pull:', cs: [[ids[16], 81, 'gold'], [ids[17], 77, 'gold']] }],
      a: { gold: { nm: 'Gold Pack', n: 1, pd: 1, c: 7500, q: 640, qp: 640, k: 2, t: { gold: 2 }, o: [0, 1, 1, 0, 0, 0], sp: 0, lg: 0, w: 0, h86: 0, h90: 0, hs: 0, b: [ids[16], 81, 'gold', T0 - 86400000], f: T0 - 86400000, l: T0 - 86400000 } },
    },
  },
  cup: {
    claims: ['cup:' + sport + ':' + prevWeek + ':open'],
    trophies: { open: 1, silver: 0, chemistry: 0 },
    history: [{ id: 'compat-cup-old-' + sport, kind: 'open', week: prevWeek, sport, level: 'pro', at: T0 - 86400000 * 7, wins: 3, outcome: 'champion' }],
    active: { id: 'compat-cup-' + sport, kind: 'silver', week, sport, level: 'pro', anchor: 78, entryLevels: { [sq[0][1]]: 4 }, at: T0 - 900000, round: 1, results: [{ id: 'compat-cup-m1', won: true, us: 3, them: 1, at: T0 - 600000 }], done: false },
  },
  rivals: {
    ...rivalsMod.rivalsOf(undefined, week),
    points: 42,
    best: 42,
    peak: 160,
    w: 5,
    l: 2,
    seen: ['compat-opponent-1', 'compat-opponent-2'],
    rewards: [{ id: prevWeek + ':1', week: prevWeek, division: 1, pack: 'bronze', coins: 50 }],
    claimed: [prevWeek + ':1'],
  },
  settled: ['compat-match-0', 'compat-match-1', 'cup:compat-cup-m1'],
  collected: ids.slice(0, 12),
  collectionClaims: ['editions:25'],
  registeredOpenings: ['compat-registered-' + sport],
  events: sport === 'soccer' ? {} : { immortals: 2 },
  pendingPromo: { id: 'compat-promo-' + sport, kind: 'event-spotlight:immortals', price: 0, packId: 'compat-promo-pack', at: T0 - 60000 },
  retirements: [{ uid: 'compat-sold-' + sport, cardId: ids[18], level: 2, reason: 'sold', mint: { serial: 3, totalAtPull: 9, requestId: 'compat-sold-request', namespace: 'inspect' } }],
};
// Club Season exists in basketball and football only (docs/SOCCER.md): two games into a real season
if (sport !== 'soccer') {
  ut = leagueMod.startLeague(ut, pool, 'compat-season-' + sport, T0 - 86400000, 82, 'pro', null);
  for (const won of [true, false]) ut = leagueMod.settleLeague(ut, leagueMod.leagueRequest(ut.league.active), { us: won ? 101 : 88, them: won ? 92 : 97, won });
}

// ---------- the profile around it, saved by the old profile code (the shared wallet in nba's key) ----------
const p = profile.freshProfile();
Object.assign(p, {
  coins: 48210,
  xp: 23150,
  inventory: { double: 2, trade: 1, prime: 3 },
  settings: { sound: false, haptics: true, hints: false },
  firstRun: false,
  name: 'Compat Fixture',
  streak: { count: 6, last: '2026-11-08', best: 12 },
  rewardDay: '2026-11-08',
  gifts: ['testers-2026-10', 'new-era-2026-11'],
  mode: 'blind',
  botLevel: 'allstar',
  history: [{ id: 'compat-run-1', at: '2026-11-07T20:00:00.000Z', mode: 'classic', wins: 61, rating: 88.2, grade: 'A', tier: 'Contender', playoff: 'Finals', series: 3, title: false, perfect: false, lineup: [] }],
  daily: null,
  stats: { games: 31, titles: 4, perfect: 1, undefeated: 0, vsWins: 9, legends: 2, h2hGames: 15 },
  lb: { entries: {}, dirty: [] },
  collection: Object.fromEntries(ids.slice(0, 5).map((id: string, i: number) => [id, i + 1])),
  gauntlet: { week, best: 4, allBest: 7, clears: 1 },
  h2h: { w: 9, l: 6, streak: 2, best: 5, week, ww: 2, wl: 1, wstreak: 2 },
  missions: { day: DAY, progress: [2, 1, 0], claimed: [true, false, false] },
  activeMatch: null,
  vs: { 'compat-rival-key': { name: 'Rival', w: 3, l: 2 } },
  ut: state.migrateUt(JSON.parse(JSON.stringify(ut))),
});
profile.saveProfile(p);
const saved = storage.dump();
const sharedKey = 'perfect-season:profile:v1';
const fixture = {
  about:
    'An old (acdf3e2, live on 2026-11-08) ' +
    sport +
    ' save with every field family, as localStorage holds it. Built by scripts/compat/build-fixtures.ts with the old tree; never edit by hand.',
  sport,
  source: 'acdf3e2',
  day: DAY,
  storage: Object.fromEntries(Object.entries(saved).filter(([k]) => k.startsWith('perfect-season:profile'))),
};
if (!fixture.storage[sharedKey]) throw Error('no shared profile written');
const out = join(REPO, 'src/ut/compat/acdf3e2-' + sport + '.json');
writeFileSync(out, JSON.stringify(fixture, null, 1) + '\n');
console.log('wrote', out, Math.round(JSON.stringify(fixture).length / 1024) + ' KB', 'keys', Object.keys(fixture.storage).join(', '));
