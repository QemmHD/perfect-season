// Claude, 2026-11-10 (studio overhaul, team ut): the Ultimate Team QA fixtures, three sports.
// Each fixture is a player state the UT screens must handle: a brand-new player, the audit's club,
// one per claimable reward source, runs in progress, things about to expire, a finished day, near
// misses, a draft-only player, a streak at risk and a cold start with a completed set. Game Design V2
// adds MINUTES ledgers (profile.playtime, V2 E.3; docs/studio-overhaul/ut-plan.md §2): 0, 27, 58,
// 89 and 90+ minutes today, 161 and 600 minutes this week, a rested return, a frozen clock day and a
// played club with no ledger at all. The ledger is stored where it will live once ut-2 adds it to
// the profile's cross-sport SHARED fields: in the basketball profile key, for every sport.
//
// They are built with the app's own modules (served by the dev server, never a live service) at a
// pinned clock, then saved as JSON (scripts/qa/fixtures/ut/<sport>-<name>.json): the localStorage
// profile keys plus the clock they were built for and the Rewards inbox they show. ut-studio.mjs
// loads one into a fresh, isolated browser context before the app starts.
//
//   node scripts/qa/ut-fixtures.mjs build [--sport nba|nfl|soccer] [--only name,name]
//   (needs the dev server: npx vite --port 5212 --strictPort; PS_QA_URL overrides the address)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ut');
export const SPORTS = ['nba', 'nfl', 'soccer'];
/** A Tuesday, noon Eastern: most fixtures are built for it. */
export const DEFAULT_AT = '2026-11-10T17:00:00.000Z';

/** Every fixture: its clock and what it is for. Soccer has no Moments or Club Season. */
export const FIXTURES = [
  { name: 'fresh', about: 'first launch: no profile at all' },
  { name: 'starter', about: 'named, onboarding done, Ultimate Team never opened (starter pack waiting)' },
  { name: 'new-drafter', about: 'plays the draft modes, never opened Ultimate Team' },
  { name: 'audit', about: "the audit's club: starter, 3 GOATs, 25 cards of one franchise, 2 Gold packs" },
  { name: 'claim-new-era', about: 'only the New Era bundle is ready' },
  { name: 'claim-daily', about: 'only the Daily Drop is ready' },
  { name: 'claim-calendar', about: 'only the login calendar is ready' },
  { name: 'claim-objectives', about: 'only a daily objective is ready' },
  { name: 'claim-daily-bonus', about: 'only the daily objectives bonus is ready' },
  { name: 'claim-season', about: 'only Season Pass tiers are ready' },
  { name: 'claim-sets', about: 'only a completed set is ready' },
  { name: 'claim-standout', about: 'only the Weekly Standouts objective is ready' },
  { name: 'claim-draft', about: 'only a finished UT Draft run is ready' },
  { name: 'claim-evos', about: 'only a finished Evolution is ready' },
  { name: 'claim-moments', about: 'only a Moment first-clear reward is ready', skip: ['soccer'] },
  { name: 'claim-collection', about: 'only a collection milestone is ready' },
  { name: 'claim-rivals', about: 'only Rivals division rewards are ready' },
  { name: 'claim-development', about: 'only a finished development program is ready' },
  { name: 'claim-cup', about: 'only a Club Cup title is ready' },
  { name: 'claim-picks', about: 'only a pick waits in the Store (not claimable in the inbox)' },
  { name: 'runs', about: 'runs in progress: Cup, Circuit, Club Season (not soccer) and UT Draft' },
  { name: 'expiring', about: 'Sunday noon Eastern: the week and Season Pass season end within 24 h', at: '2026-11-22T17:00:00.000Z' },
  { name: 'all-done', about: 'everything for today done and claimed' },
  { name: 'near-miss', about: 'a set 1 card away, Rivals 2 wins short, 1 game to the daily bonus' },
  { name: 'streak-risk', about: '9:30 pm Eastern: Daily Drop day 7 waiting, the streak ends at midnight', at: '2026-11-10T02:30:00.000Z' },
  { name: 'cold-set', about: 'back after 9 days away (cold start) with a completed set to claim' },
  { name: 'minutes-0', about: 'MINUTES: a ledger with 0 min today (6 h lifetime)' },
  { name: 'minutes-27', about: 'MINUTES: 27 min today, 5 and 15 claimed: 3 min to the 30 rung' },
  { name: 'minutes-58', about: 'MINUTES: 58 min today, 5/15/30 claimed: 2 min to the Silver Pack' },
  { name: 'minutes-89', about: 'MINUTES: 89 min today, up to 60 claimed: 1 min to the 90 rung' },
  { name: 'minutes-90', about: 'MINUTES: 90+ min today (2 h open), every daily rung claimed: Done for today' },
  { name: 'minutes-week-161', about: 'MINUTES: Thursday, 161 min this week, the 150 rung waiting', at: '2026-11-12T17:00:00.000Z' },
  { name: 'minutes-week-600', about: 'MINUTES: Sunday 6 pm ET, 600 min this week: the Premium rung and the daily 60 waiting', at: '2026-11-15T23:00:00.000Z' },
  { name: 'minutes-rested', about: 'MINUTES: back after 4 days away (rested bonus due), the ledger still on last week' },
  { name: 'minutes-frozen', about: "MINUTES: the clock went back a day: the ledger's day is tomorrow, accrual frozen today" },
  { name: 'minutes-absent', about: 'MINUTES: a club that has played, with profile.playtime absent (an old save)' },
];

export const fixturesFor = (sport) => FIXTURES.filter((f) => !f.skip?.includes(sport));
export const fixtureFile = (sport, name) => path.join(FIXTURE_DIR, sport + '-' + name + '.json');
export function readFixture(sport, name) {
  return JSON.parse(fs.readFileSync(fixtureFile(sport, name), 'utf8'));
}

/**
 * Prepare a fresh context to start with a fixture's storage (once: a reload keeps what the app
 * wrote since) and its clock. Call before the first page.goto.
 */
export async function useFixture(context, page, fixture, { clock } = {}) {
  await context.addInitScript((storage) => {
    try {
      if (sessionStorage.getItem('__ut_fixture')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      localStorage.setItem('perfect-season:fav:asked', '1');
      sessionStorage.setItem('__ut_fixture', '1');
    } catch {
      // storage blocked: the page reports it
    }
  }, fixture.storage);
  const at = clock ?? fixture.at;
  if (at) await page.clock.install({ time: new Date(at) });
}

/**
 * Runs inside a page served by the dev server (any document on its origin): builds one fixture
 * with the app's modules, saves it the way the app does and returns the profile storage and the
 * Rewards inbox it shows. Self-contained: Playwright serializes it into the page.
 */
async function buildInPage({ sport, name, at }) {
  const SPORTS_ALL = ['nba', 'nfl', 'soccer'];
  const m = {};
  const mods = {
    profile: '/src/lib/profile.ts',
    pool: '/src/ut/pool.ts',
    packs: '/src/ut/packs.ts',
    squad: '/src/ut/squad.ts',
    state: '/src/ut/state.ts',
    hq: '/src/ut/hq-state.ts',
    prog: '/src/ut/progression.ts',
    inbox: '/src/ut/inbox.ts',
    moments: '/src/ut/moments.ts',
    rivals: '/src/ut/rivals.ts',
    lb: '/src/net/leaderboard.ts',
    season: '/src/engine/season.ts',
    sets: '/src/ut/sets.ts',
    league: '/src/ut/league.ts',
    cup: '/src/ut/cup-state.ts',
  };
  for (const [k, p] of Object.entries(mods)) m[k] = await import(p);
  const day = m.season.easternDateKey(new Date(at));
  const prev = (d, n = 1) => {
    const t = new Date(d + 'T12:00:00Z');
    t.setUTCDate(t.getUTCDate() - n);
    return t.toISOString().slice(0, 10);
  };
  const week = m.lb.weekKey(day);
  const pool = await m.pool.getPool();
  const all = [...pool.base.values()].sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const goldish = new Set(['gold', 'standout', 'promo', 'landmark', 'legend', 'spotlight', 'goat']);
  const totals = (o) => ({ ...m.hq.emptyTotals(), ...o });

  const named = (p) => {
    p.name = 'UT Studio QA';
    p.firstRun = false;
    p.gifts = ['testers-2026-10'];
    p.settings.sound = false;
    p.settings.haptics = false;
    return p;
  };
  // the audit's club (scripts/qa/browser.mjs and the audit harness): what most fixtures start from
  const club = () => {
    const p = named(m.profile.freshProfile());
    p.coins = 10000;
    p.xp = 5200;
    p.rewardDay = day;
    const fr = { nba: 'CHI', nfl: 'NE', soccer: 'BAR' }[sport];
    const cards = [
      ...m.packs.openPack(pool, 'starter', 'qa'),
      ...all.filter((c) => c.tier === 'goat').slice(0, 3),
      ...all
        .filter((c) => c.line.kind === 'season' && c.line.fr === fr)
        .sort(m.pool.byValue)
        .slice(0, 25),
    ].filter((c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i);
    const owned = cards.map((rc, i) => ({ uid: 'ut-qa-' + i, cardId: rc.line.id, level: i === 0 ? 3 : 1, xp: i === 0 ? 42 : 0, at: at - (cards.length - i) * 60000 }));
    p.ut = {
      ...m.state.freshUt(),
      owned,
      squad: m.squad.autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))),
      starterClaimed: true,
      packsOpened: 1,
      packs: [
        { id: 'qa-gold', kind: 'gold', at: at - 120000 },
        { id: 'qa-gold2', kind: 'gold', at: at - 60000 },
      ],
    };
    return p;
  };
  // the club with nothing waiting: every ready reward claimed (with its real receipts), no packs
  const quiet = () => {
    const p = club();
    p.ut = { ...p.ut, packs: [], content: { ...(p.ut.content ?? {}), era: { eligible: false } } };
    const q = m.inbox.claimAll(pool, p, day, week, at).profile;
    q.coins = 10000;
    q.ut = { ...q.ut, packs: [], content: { ...q.ut.content, picks: [] } };
    return q;
  };
  const hqOf = (p) => m.prog.hqOf(p.ut);
  const withHq = (p, patch) => ({ ...p, ut: { ...p.ut, hq: { ...hqOf(p), ...patch } } });
  const content = (p, patch) => ({ ...p, ut: { ...p.ut, content: { ...p.ut.content, ...patch } } });
  const dailyIds = ['show-up', 'winner', 'score'].map((id) => 'daily:' + day + ':' + id);
  const squadUids = (p) => Object.values(p.ut.squad);
  const ids = (n, from = 0) => all.filter((c) => goldish.has(c.tier) && c.line.kind === 'season').slice(from, from + n).map((c) => c.line.id);
  /** An unclaimed era set of the club, filled to `short` cards from complete. */
  const fillSet = (p, short) => {
    const set = m.sets.setsFor(pool, p.ut).find((s) => s.kind === 'era' && !s.claimed && s.have < s.need);
    const [, fr, decade] = set.id.split(':');
    const pids = new Set();
    const add = [];
    for (const c of all)
      if (c.line.fr === fr && Math.floor(c.line.season / 10) * 10 === +decade && goldish.has(c.tier) && !pids.has(c.line.pid)) {
        pids.add(c.line.pid);
        add.push(c.line.id);
      }
    const collected = [...new Set([...(p.ut.collected ?? []), ...add.slice(0, set.need - short)])];
    return { ...p, ut: { ...p.ut, collected } };
  };
  /** Monday = 0, as the ledger's weekDays (ISO weeks, weekKey). */
  const weekday = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
  /**
   * A MINUTES ledger (V2 E.3): minutes are given per weekday of the ledger's week, today's from
   * `today`. Lifetime holds the week plus `before` earlier hours; most of it in this fixture's sport.
   */
  const ledger = ({ on = day, today = 0, week: mins = {}, rawToday, claimedDay = [], claimedWeek = [], before = 6, extra = {} }) => {
    const weekDays = [0, 0, 0, 0, 0, 0, 0];
    for (const [i, v] of Object.entries(mins)) weekDays[+i] = v * 60;
    weekDays[weekday(on)] = today * 60;
    const life = weekDays.reduce((a, b) => a + b, 0) + before * 3600;
    const mine = Math.round(life * 0.7);
    const others = SPORTS_ALL.filter((x) => x !== sport);
    const bySport = { [sport]: mine, [others[0]]: Math.floor((life - mine) / 2), [others[1]]: life - mine - Math.floor((life - mine) / 2) };
    const lifeRungs = [1, 5, 10, 25, 50, 100, 250, 500, 1000].map((hrs, i) => (life >= hrs * 3600 ? i : -1)).filter((i) => i >= 0);
    return {
      v: 1,
      life,
      rawLife: Math.round(life * 1.3),
      day: on,
      daySec: today * 60,
      dayMenuSec: Math.round(today * 60 * 0.15),
      rawDaySec: (rawToday ?? Math.round(today * 1.25)) * 60,
      week: m.lb.weekKey(on),
      weekDays,
      bySport,
      acts: Math.round(life / 360),
      weekActs: weekDays.map((x) => Math.round(x / 360)),
      claimed: { day: claimedDay, week: claimedWeek, life: lifeRungs, dayKey: on, weekKey: m.lb.weekKey(on) },
      league: { tier: 0, season: '', best: 0 },
      ...extra,
    };
  };
  const withMinutes = (o) => ({ ...quiet(), playtime: ledger(o) });
  const draftRun = (done) => {
    const pick = ids(30, 40);
    const slots = m.squad.slotsFor(sport).filter((s) => s.weight > 0);
    return {
      id: 'qa-draft-' + (done ? 'done' : 'live'),
      at: at - 3600000,
      week,
      paid: 'coins',
      captains: pick.slice(0, 5),
      squad: done ? Object.fromEntries(slots.map((s, i) => [s.id, pick[5 + i]])) : { [slots[0].id]: pick[5] },
      ...(done ? {} : { pick: { slot: slots[1].id, options: pick.slice(20, 25) } }),
      games: done ? 4 : 0,
      wins: done ? 3 : 0,
      results: done ? [true, true, true, false] : [],
      done,
    };
  };

  const build = {
    fresh: () => null,
    starter: () => named(m.profile.freshProfile()),
    'new-drafter': () => {
      const p = named(m.profile.freshProfile());
      p.coins = 1850;
      p.xp = 3400;
      p.rewardDay = day;
      p.streak = { count: 3, last: prev(day), best: 3 };
      p.stats = { ...p.stats, games: 3, titles: 1 };
      p.history = [1, 2, 3].map((i) => ({ id: 'qa-run-' + i, at: new Date(at - i * 86400000).toISOString(), mode: 'classic', wins: 40 + i * 6, rating: 80 + i, grade: 'B', tier: 'Contender', playoff: 'Second round', title: i === 3, perfect: false, lineup: [] }));
      return p;
    },
    audit: club,
    'claim-new-era': () => content(quiet(), { era: { eligible: true } }),
    'claim-daily': () => content(quiet(), { daily: { day: prev(day), streak: 2, total: 5 } }),
    'claim-calendar': () => content(quiet(), { calendar: { day: prev(day), n: 2 } }),
    'claim-objectives': () => {
      const q = quiet();
      return withHq(q, { days: { ...hqOf(q).days, [day]: totals({ games: 2 }) } });
    },
    'claim-daily-bonus': () => {
      const q = quiet();
      return withHq(q, { days: { ...hqOf(q).days, [day]: totals({ games: 3, wins: 2, points: 60 }) }, claims: [...hqOf(q).claims, ...dailyIds] });
    },
    'claim-season': () => {
      const q = quiet();
      return withHq(q, { seasons: { ...hqOf(q).seasons, [m.prog.seasonFor(day).id]: { xp: 650, claimed: [] } } });
    },
    'claim-sets': () => fillSet(quiet(), 0),
    'claim-standout': () => content(quiet(), { soWins: { week, ids: ['qa-so-1', 'qa-so-2', 'qa-so-3', 'qa-so-4', 'qa-so-5'] } }),
    'claim-draft': () => content(quiet(), { draft: { active: draftRun(true) } }),
    'claim-evos': () => {
      const q = quiet();
      return content(q, { evo: { [squadUids(q)[0]]: { done: [], active: { id: 'rising-1', games: 3, wins: 1, at: at - 7200000 } } } });
    },
    'claim-moments': () => {
      const q = quiet();
      const mo = m.moments.momentsFor(sport)[0];
      return withHq(q, { moments: { ...hqOf(q).moments, [mo.id]: { best: mo.target, completedAt: at - 3600000 } } });
    },
    'claim-collection': () => {
      const q = quiet();
      return { ...q, ut: { ...q.ut, collected: [...new Set([...(q.ut.collected ?? []), ...pool.lines.slice(0, 60).map((l) => l.id)])] } };
    },
    'claim-rivals': () => {
      const q = quiet();
      let r = m.rivals.rivalsOf(undefined, week);
      for (let i = 0; i < 4; i++) r = m.rivals.rivalsMatch(r, week, 'qa-rival-' + i, true);
      return { ...q, ut: { ...q.ut, rivals: r } };
    },
    'claim-development': () => {
      const q = quiet();
      return withHq(q, { development: { ...hqOf(q).development, active: { uid: squadUids(q)[1], path: 'breakout', games: 3, wins: 1, points: 0, at: at - 7200000 } } });
    },
    'claim-cup': () => {
      const q = quiet();
      const results = [0, 1, 2].map((n) => ({ id: 'qa-cup-match-' + n, won: true, us: 3, them: 1, at: at - (3 - n) * 600000 }));
      return { ...q, ut: { ...q.ut, cup: { ...m.cup.freshCup(), active: { id: 'qa-cup', kind: 'open', week, sport, level: 'rookie', anchor: 75, at: at - 3600000, round: 3, results, done: true } } } };
    },
    'claim-picks': () => content(quiet(), { picks: [{ id: 'qa-scout', kind: 'scout', title: "Scout's Choice", options: ids(3, 10), at: at - 60000 }] }),
    runs: () => {
      let q = quiet();
      q = { ...q, ut: { ...q.ut, cup: { ...m.cup.freshCup(), active: { id: 'qa-cup-live', kind: 'open', week, sport, level: 'pro', anchor: 78, at: at - 3600000, round: 1, results: [{ id: 'qa-cup-live-1', won: true, us: 3, them: 2, at: at - 1800000 }], done: false } } } };
      q = withHq(q, { circuit: { ...hqOf(q).circuit, week, entries: 1, active: { id: 'qa-circuit-live', games: 2, wins: 1, results: [true, false], at: at - 5400000 } } });
      q = content(q, { draft: { active: draftRun(false) } });
      if (sport !== 'soccer') {
        let ut = m.league.startLeague(q.ut, pool, 'qa-season-' + sport, at - 86400000, 80, 'pro', null);
        for (const won of [true, true, false]) ut = m.league.settleLeague(ut, m.league.leagueRequest(ut.league.active), { us: won ? 101 : 90, them: won ? 94 : 99, won });
        q = { ...q, ut };
      }
      return q;
    },
    expiring: () => {
      let q = quiet();
      const s = m.prog.seasonFor(day);
      q = withHq(q, {
        weeks: { ...hqOf(q).weeks, [week]: totals({ games: 8, wins: 5, points: 180 }) },
        seasons: { ...hqOf(q).seasons, [s.id]: { xp: 2450, claimed: [1, 2, 3, 4, 5, 6, 7, 8] } },
        circuit: { ...hqOf(q).circuit, week, entries: 2, best: 3, active: { id: 'qa-circuit-sunday', games: 3, wins: 2, results: [true, true, false], at: at - 3600000 } },
      });
      let r = m.rivals.rivalsOf(undefined, week);
      for (let i = 0; i < 2; i++) r = m.rivals.rivalsMatch(r, week, 'qa-rival-sun-' + i, true);
      return { ...q, ut: { ...q.ut, rivals: r } };
    },
    'all-done': () => {
      const q = quiet();
      const s = m.prog.seasonFor(day);
      const h = hqOf(q);
      const p = withHq(q, { days: { ...h.days, [day]: totals({ games: 3, wins: 2, points: 60 }) }, claims: [...h.claims, ...dailyIds], seasons: { ...h.seasons, [s.id]: { xp: 250, claimed: [] } } });
      return content(p, { claims: [...(p.ut.content.claims ?? []), 'daily-bonus:' + day] });
    },
    'near-miss': () => {
      let q = fillSet(quiet(), 1);
      const h = hqOf(q);
      q = withHq(q, { days: { ...h.days, [day]: totals({ games: 1, wins: 1, points: 30 }) }, claims: [...h.claims, dailyIds[1], dailyIds[2]] });
      let r = m.rivals.rivalsOf(undefined, week);
      r = m.rivals.rivalsMatch(r, week, 'qa-rival-near', true);
      return { ...q, ut: { ...q.ut, rivals: r } };
    },
    'streak-risk': () => {
      const q = content(quiet(), { daily: { day: prev(day), streak: 6, total: 20 } });
      q.streak = { count: 9, last: prev(day), best: 9 };
      return q;
    },
    'minutes-0': () => withMinutes({ today: 0 }),
    'minutes-27': () => withMinutes({ today: 27, claimedDay: [0, 1] }),
    'minutes-58': () => withMinutes({ today: 58, week: { 0: 40 }, claimedDay: [0, 1, 2], claimedWeek: [0] }),
    'minutes-89': () => withMinutes({ today: 89, week: { 0: 90 }, claimedDay: [0, 1, 2, 3], claimedWeek: [0, 1] }),
    'minutes-90': () => withMinutes({ today: 90, rawToday: 120, week: { 0: 60 }, claimedDay: [0, 1, 2, 3, 4], claimedWeek: [0, 1] }),
    'minutes-week-161': () => withMinutes({ today: 36, week: { 0: 30, 1: 45, 2: 50 }, claimedDay: [0, 1, 2], claimedWeek: [0] }),
    'minutes-week-600': () => withMinutes({ today: 60, week: { 0: 90, 1: 90, 2: 90, 3: 90, 4: 90, 5: 90 }, claimedDay: [0, 1, 2], claimedWeek: [0, 1, 2, 3] }),
    'minutes-rested': () => withMinutes({ on: prev(day, 4), today: 25, week: { 0: 20, 2: 35 }, claimedDay: [0, 1], claimedWeek: [0] }),
    'minutes-frozen': () => withMinutes({ on: prev(day, -1), today: 12, claimedDay: [0], extra: { frozenDay: day } }),
    'minutes-absent': () => {
      const q = quiet();
      delete q.playtime;
      return q;
    },
    'cold-set': () => {
      let q = fillSet(quiet(), 0);
      q = content(q, { daily: { day: prev(day, 9), streak: 3, total: 12 }, calendar: { day: prev(day, 9), n: 4 } });
      q.rewardDay = prev(day, 9);
      q.streak = { count: 0, last: prev(day, 9), best: 5 };
      return withHq(q, { history: hqOf(q).history.map((h) => ({ ...h, at: at - 9 * 86400000 })) });
    },
  }[name];
  if (!build) throw Error('unknown fixture ' + name);
  localStorage.clear();
  localStorage.setItem('perfect-season:sport', sport);
  const p = build();
  if (p) {
    p.ut = m.state.migrateUt(JSON.parse(JSON.stringify(p.ut)));
    m.profile.saveProfile(p);
    // the MINUTES ledger lives only in the basketball key (the cross-sport SHARED place, plan §2)
    for (const k of Object.values(m.profile.PROFILE_KEYS)) {
      const saved = JSON.parse(localStorage.getItem(k) ?? 'null');
      if (saved && 'playtime' in saved) localStorage.setItem(k, JSON.stringify({ ...saved, playtime: undefined }));
    }
    if (p.playtime) {
      const k = m.profile.PROFILE_KEYS.nba;
      localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) ?? '{}'), playtime: p.playtime }));
    }
  }
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('perfect-season:profile')) storage[k] = JSON.parse(localStorage.getItem(k));
    else if (k === 'perfect-season:sport') storage[k] = localStorage.getItem(k);
  }
  const loaded = p ? m.profile.loadProfile() : null;
  const inbox = loaded ? m.inbox.inboxItems(pool, loaded, day, week).map((i) => (i.claimable ? i.id : '(' + i.id + ')')) : [];
  return { storage, inbox, day, week };
}

/** Build fixtures through the dev server and write them to FIXTURE_DIR. */
export async function buildFixtures({ base, sports = SPORTS, only = null, log = console.log }) {
  const { launch, isolate } = await import('./ut-studio.mjs');
  const browser = await launch();
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const written = [];
  try {
    for (const sport of sports)
      for (const f of fixturesFor(sport)) {
        if (only && !only.includes(f.name)) continue;
        const at = f.at ?? DEFAULT_AT;
        const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
        await isolate(context);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.clock.install({ time: new Date(at) });
        // a plain document on the dev server's origin, so nothing of the app boots while building
        const url = new URL('icon-192.png', base);
        url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
        await page.goto(url.href);
        const out = await page.evaluate(buildInPage, { sport, name: f.name, at: Date.parse(at) });
        await context.close();
        if (errors.length) throw Error(sport + '/' + f.name + ': ' + errors.join(' | '));
        const fixture = { name: f.name, sport, about: f.about, at, day: out.day, week: out.week, inbox: out.inbox, storage: out.storage };
        fs.writeFileSync(fixtureFile(sport, f.name), JSON.stringify(fixture) + '\n');
        written.push(fixture);
        log(sport.padEnd(6) + f.name.padEnd(20) + ' inbox: ' + (out.inbox.join(', ') || '(empty)'));
      }
  } finally {
    await browser.close();
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  if (args[0] !== 'build') {
    console.log('usage: node scripts/qa/ut-fixtures.mjs build [--sport nba|nfl|soccer] [--only a,b]');
    process.exit(1);
  }
  const base = process.env.PS_QA_URL || 'http://localhost:5212/';
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
  // no top-level await here: ut-studio.mjs imports this module back, and a module still awaiting
  // at its top level would never finish loading for it
  buildFixtures({ base, sports: opt('--sport') ? [opt('--sport')] : SPORTS, only: opt('--only')?.split(',') ?? null }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
