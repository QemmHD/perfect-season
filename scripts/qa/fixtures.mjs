// Claude (studio overhaul, shell-1, 2026-11-10): QA fixture profiles that work on the dev server
// and on production builds.
//
// `make` (dev server only) builds each profile through the app's own source modules, lets the app
// load and re-save it, and serializes the app's own existing localStorage keys to
// `<PS_QA_FIXTURES>/<profile>-<sport>.json`. `inject` replays such a file into a fresh, isolated
// browser context with `addInitScript`, so a `vite preview` of a production build (no /src modules)
// gets the same players. Writes happen only on localhost/127.0.0.1, only into empty storage, and only
// for the keys in FIXTURE_KEYS (the app's recovery keys minus the signing key).
//
//   node scripts/qa/fixtures.mjs make  [--sports nba,nfl,soccer] [--profiles standard,heavy,…]
//   node scripts/qa/fixtures.mjs check [--sports …] [--profiles …]       (dev server or a build)
//
// Profiles:
//   fresh        nothing stored: first launch (onboarding)
//   standard     the original browser.mjs player: 10,000 coins, the starter, every GOAT, 25 cards
//                of one franchise and one unopened pack
//   heavy        a long-time player: ~2,000 owned copies (30%+ levelled 2–5), evolved copies, a full
//                300-entry Pack Tracker log, a full ut.hq (seasons, objectives, circuit history,
//                saved squads, development, moments, match history) and two unopened Gold packs
//   utNoStarter  Ultimate Team opened once, starter pack not claimed, no cards
//   checkpoint   the standard player with a saved draft run waiting on Home
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { artifacts, base, isolate, launch } from './browser.mjs';

export const PROFILES = ['fresh', 'standard', 'heavy', 'utNoStarter', 'checkpoint'];
export const SPORTS = ['nba', 'nfl', 'soccer'];
export const FIXTURE_DIR = process.env.PS_QA_FIXTURES || path.join(artifacts, 'fixtures');

/**
 * The only keys a fixture may hold or write: `RECOVERY_KEYS` in src/lib/recovery.ts without
 * `perfect-season:key:v1` (each context makes its own signing identity). fixtures.test.mjs keeps the
 * two lists in step.
 */
export const FIXTURE_KEYS = [
  'perfect-season:profile:v1',
  'perfect-season:profile:nfl:v1',
  'perfect-season:fav',
  'perfect-season:fav:asked',
  'perfect-season:sport',
  'perfect-season:checkpoint:nba',
  'perfect-season:checkpoint:nfl',
  'perfect-season:training:nba',
  'perfect-season:training:nfl',
  'perfect-season:profile:soccer:v1',
  'perfect-season:checkpoint:soccer',
  'perfect-season:training:soccer',
];
const SHARED_KEY = 'perfect-season:profile:v1';
const PROFILE_KEY = { nba: SHARED_KEY, nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' };

export const fixtureFile = (profile, sport) => path.join(FIXTURE_DIR, profile + '-' + sport + '.json');

/**
 * The init script `inject` installs (exported for its unit test; it must stay self-contained because
 * Playwright serializes it). Writes nothing off localhost or into storage that already holds a
 * profile, so the app's own later writes survive reloads. The shared profile's daily-chest day is set
 * to today and its name to the caller's, so a fixture made on another day opens without the daily
 * reward modal.
 */
export function applyFixture({ keys, allowed, name, today }, env) {
  const { location, localStorage } = env ?? globalThis;
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return 'skipped:host';
  try {
    if (localStorage.getItem('perfect-season:profile:v1') !== null) return 'skipped:present';
    const day = today || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    for (const [k, v] of Object.entries(keys)) {
      if (!allowed.includes(k) || typeof v !== 'string') continue;
      let value = v;
      if (k === 'perfect-season:profile:v1') {
        const p = JSON.parse(v);
        p.rewardDay = day;
        if (name) p.name = name;
        value = JSON.stringify(p);
      }
      localStorage.setItem(k, value);
    }
    return 'written';
  } catch {
    return 'skipped:storage';
  }
}

/** A serialized fixture, or a clear error naming the command that makes it. */
export function loadFixture(profile, sport) {
  const file = fixtureFile(profile, sport);
  if (!fs.existsSync(file)) throw Error(`Fixture ${profile}/${sport} is missing (${file}). Make it on the dev server: node scripts/qa/fixtures.mjs make --sports ${sport} --profiles ${profile}`);
  const f = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of Object.keys(f.keys)) if (!FIXTURE_KEYS.includes(k)) throw Error(`${file} holds ${k}, which is not a fixture key.`);
  return f;
}

/** Install a serialized fixture into a context (before its first page loads). */
export async function inject(context, profile, sport, name) {
  if (profile === 'fresh') return null;
  const f = loadFixture(profile, sport);
  await context.addInitScript(applyFixture, { keys: f.keys, allowed: FIXTURE_KEYS, name: name ?? null, today: null });
  return f;
}

/**
 * Builds a profile inside a dev-server page through the app's own modules and saves it with the
 * app's saveProfile. Runs in the browser: self-contained, no closures.
 */
async function pageBuild({ sport, profile, name }) {
  const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
  const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
  const { getPool, byValue, ratedOf } = await import('/src/ut/pool.ts');
  const { openPack, packDefs, currentWeek } = await import('/src/ut/packs.ts');
  const { autoBuild } = await import('/src/ut/squad.ts');
  const { freshUt } = await import('/src/ut/state.ts');
  const pool = await getPool(),
    p = freshProfile();
  p.name = name;
  p.coins = 10000;
  p.firstRun = false;
  p.gifts = ['testers-2026-10'];
  p.settings.sound = false;
  p.settings.haptics = false;
  p.rewardDay = day(new Date());
  localStorage.setItem('perfect-season:fav:asked', '1');
  if (profile === 'utNoStarter') {
    saveProfile(p);
    return;
  }
  if (profile !== 'heavy') {
    // the original browser.mjs fixture, unchanged (standard and checkpoint)
    const cards = [
      ...openPack(pool, 'starter', 'qa'),
      ...[...pool.base.values()].filter((c) => c.tier === 'goat'),
      ...[...pool.base.values()]
        .filter((c) => c.line.kind === 'season' && c.line.fr === { nba: 'CHI', nfl: 'NE', soccer: 'BAR' }[sport])
        .sort(byValue)
        .slice(0, 25),
    ].filter((c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i);
    const owned = cards.map((rc, i) => ({ uid: 'original-qa-' + i, cardId: rc.line.id, level: i === 0 ? 3 : 1, xp: i === 0 ? 42 : 0, at: i + 1 }));
    p.ut = {
      ...freshUt(),
      owned,
      squad: autoBuild(
        sport,
        owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))
      ),
      starterClaimed: true,
      packsOpened: 1,
      // soccer has no Spotlight editions: its fixture gets a gold pack instead
      packs: sport === 'soccer' ? [{ id: 'qa-gold', kind: 'gold', at: 2 }] : [{ id: 'event:immortals:2', kind: 'event-spotlight:immortals', at: 2 }],
    };
    saveProfile(p);
    return;
  }

  // ---------- heavy: ~150 days of play, every step through the app's own state functions ----------
  const { ownedCardsForPack } = await import('/src/ut/acquisition.ts');
  const { recordPull } = await import('/src/ut/pull-log.ts');
  const { organizeStorage } = await import('/src/ut/storage.ts');
  const prog = await import('/src/ut/progression.ts');
  const { savePreset, startDevelopment } = await import('/src/ut/club-management.ts');
  const { startCircuit, settleCircuit } = await import('/src/ut/circuit.ts');
  const { evoBlock, evoById } = await import('/src/ut/evolutions.ts');
  const { withClaim } = await import('/src/ut/content-state.ts');
  const { sbcsFor, weekOf } = await import('/src/ut/sbc.ts');
  const { momentsFor } = await import('/src/ut/moments.ts');
  const DAY = 86400000,
    now = Date.now(),
    T0 = now - 150 * DAY;
  // a small deterministic hash, so the same fixture comes out every time
  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h;
  };
  const defs = packDefs(sport);
  // Recent entries (kept in the Pack Tracker's 300-pack / 1,500-card list) and the bigger packs before
  // them, which age out of the list but stay in the per-type totals and the club.
  const plan = {
    nba: { early: 'premium', recent: (i) => (i % 2 ? 'daily' : 'gold') },
    nfl: { early: 'gold', recent: (i) => (i % 2 ? 'daily' : 'pick') },
    soccer: { early: 'premium', recent: (i) => (i % 15 < 7 ? 'gold' : 'daily') },
  }[sport];
  let ut = { ...freshUt(), starterClaimed: true };
  const deposit = (kind, seed, t, nm, price, source) => {
    const cards = openPack(pool, kind, seed);
    ut = recordPull(ut, { id: seed, kind, name: nm, price, source, at: t, uid: 'pack:' + seed + ':', cards });
    ut = organizeStorage(prog.recordActivity(ut, 'pack:' + seed, day(new Date(t)), { packs: 1 }), ownedCardsForPack(cards, seed, t));
    ut = { ...ut, packsOpened: ut.packsOpened + 1 };
    return cards.length;
  };
  const keepPick = (seed, t) => {
    // a Scout's Choice from the Store: the best gold of three, logged as a one-card pick
    const rc = openPack(pool, 'gold', seed).sort(byValue)[0];
    const uid = 'pick:' + seed;
    ut = recordPull(ut, { id: uid, kind: 'scout', name: "Scout's Choice", price: 0, source: 'store', at: t, uid, cards: [rc] });
    ut = organizeStorage(withClaim(ut, uid), [{ uid, cardId: rc.line.id, level: 1, xp: 0, at: t }]);
    return 1;
  };
  let total = deposit('starter', 'qa-heavy-starter', T0, 'Starter Pack', 0, 'starter');
  // the recent 300: opened over the last 100 days
  const recent = Array.from({ length: 300 }, (_, i) => ({ kind: plan.recent(i), seed: 'qa-heavy-' + sport + '-r' + i, t: now - 100 * DAY + Math.round((i * 100 * DAY) / 300) }));
  const recentCards = recent.reduce((s, r) => s + (r.kind === 'pick' ? 1 : openPack(pool, r.kind, r.seed).length), 0);
  // the early packs fill the club up to ~2,000 copies
  const earlySize = openPack(pool, plan.early, 'qa-size').length;
  const early = Math.max(0, Math.round((2000 - total - recentCards) / earlySize));
  for (let i = 0; i < early; i++) total += deposit(plan.early, 'qa-heavy-' + sport + '-e' + i, T0 + DAY + Math.round((i * 45 * DAY) / Math.max(1, early)), defs[plan.early].name, defs[plan.early].price, 'store');
  for (const r of recent) total += r.kind === 'pick' ? keepPick(r.seed, r.t) : deposit(r.kind, r.seed, r.t, defs[r.kind].name, r.kind === 'daily' ? 0 : defs[r.kind].price, r.kind === 'daily' ? 'daily' : 'store');
  // levels: a third of the club played up to level 2–5
  ut = { ...ut, owned: ut.owned.map((c) => (hash(c.uid) % 100 < 33 ? { ...c, level: 2 + (hash(c.uid + ':l') % 4), xp: hash(c.uid + ':x') % 120 } : c)) };
  // the squad: the best club cards (spares stay in duplicate storage)
  const stored = new Set(ut.duplicateStorage ?? []);
  const club = ut.owned.filter((c) => !stored.has(c.uid)).flatMap((c) => {
    const rc = ratedOf(pool, c);
    return rc ? [{ uid: c.uid, rc }] : [];
  });
  ut = { ...ut, squad: autoBuild(sport, club) };
  const squadUids = Object.values(ut.squad);
  // evolutions: 60 finished Rising Star I copies (some also II), two in progress
  const evo = {};
  const rising1 = evoById('rising-1'),
    rising2 = evoById('rising-2');
  for (const c of club) {
    if (Object.keys(evo).length >= 62) break;
    if (evoBlock(ut, c.uid, c.rc, rising1, sport)) continue;
    const n = Object.keys(evo).length;
    if (n >= 60) evo[c.uid] = { done: [], active: { id: 'rising-1', games: 1, wins: 1, at: now - 2 * DAY } };
    else evo[c.uid] = { done: n % 4 === 0 && !evoBlock(ut, c.uid, c.rc, { ...rising2, needs: undefined }, sport) ? ['rising-1', 'rising-2'] : ['rising-1'] };
  }
  ut = { ...ut, content: { ...(ut.content ?? {}), evo } };
  // 160 matches across the modes
  const modes = sport === 'soccer' ? ['battle', 'online', 'circuit', 'cup'] : ['battle', 'online', 'circuit', 'cup', 'league', 'event'];
  const score = (i, won) => {
    const [lo, hi] = { nba: [88, 124], nfl: [10, 38], soccer: [0, 4] }[sport];
    const a = lo + (hash('s' + i) % (hi - lo + 1)),
      b = lo + (hash('t' + i) % (hi - lo + 1));
    const [x, y] = [Math.max(a, b), Math.min(a, b)];
    return won ? [x === y ? x + 1 : x, y] : [y, x === y ? x + 1 : x];
  };
  const record = { w: 0, l: 0, h2hW: 0, h2hL: 0 };
  for (let i = 0; i < 160; i++) {
    const t = T0 + 5 * DAY + Math.round((i * 144 * DAY) / 160),
      mode = modes[i % modes.length],
      won = hash('w' + i) % 100 < 58,
      [us, them] = score(i, won);
    if (mode === 'online') won ? record.h2hW++ : record.h2hL++;
    else won ? record.w++ : record.l++;
    ut = prog.recordMatchProgress(ut, { id: 'qa-heavy-m' + i, at: t, mode, won, us, them, opponent: mode === 'online' ? 'Rival ' + (i % 17) : 'AI Club ' + (i % 9), coins: won ? 120 : 60, xp: won ? 40 : 20, day: day(new Date(t)), how: i % 5 === 4 ? 'sim' : 'played', played: squadUids }).ut;
  }
  ut = { ...ut, record };
  // every finished season's track claimed, the current one up to where it is
  for (const period of Object.keys(prog.hqOf(ut).seasons)) ut = prog.claimReadySeason(ut, period, now - DAY).ut;
  // today's objectives that are complete, claimed
  const today = day(new Date(now));
  for (const o of prog.objectiveDeck(ut, today)) if (o.progress >= o.target && !o.claimed) ut = prog.claimObjective(ut, o.id, today, now).ut;
  // the Champions Circuit: six weeks of history and a run in progress this week
  for (let w = 6; w >= 0; w--) {
    const t = now - w * 7 * DAY,
      week = weekOf(day(new Date(t)));
    ut = startCircuit(ut, week, 'qa-heavy-circuit-' + w, t);
    for (let g = 0; g < (w ? 6 : 3); g++) ut = settleCircuit(ut, 'qa-heavy-circuit-' + w, g, hash('c' + w + ':' + g) % 100 < 60, t + g * 3600000).ut;
  }
  // three saved squads, eight finished development programs and one running
  ut = savePreset(ut, 0, 'Main Five', now - 20 * DAY);
  ut = savePreset(ut, 1, 'Chemistry', now - 9 * DAY);
  ut = savePreset(ut, 2, 'Weekend League', now - 2 * DAY);
  const hq = prog.hqOf(ut),
    completed = {};
  club.slice(0, 8).forEach((c, i) => (completed[c.uid] = { path: ['breakout', 'captain', 'ironman'][i % 3], at: now - (30 - i) * DAY }));
  ut = { ...ut, hq: { ...hq, development: { completed }, moments: Object.fromEntries(momentsFor(sport).map((m, i) => [m.id, i < 3 ? { best: m.target, completedAt: now - (12 - i) * DAY, claimed: true } : { best: Math.max(0, m.target - 1) }])) } };
  const dev = club.find((c) => !completed[c.uid] && (ut.owned.find((o) => o.uid === c.uid)?.level ?? 5) < 5);
  if (dev) ut = startDevelopment(ut, dev.uid, 'breakout', now - DAY);
  // squad battles this week, six SBCs done, and two Gold packs waiting
  ut = { ...ut, battles: { week: currentWeek(), cleared: 5, best: 8, level: 'allstar' } };
  ut = { ...ut, sbc: { done: Object.fromEntries(sbcsFor(pool, today).slice(0, 6).map((s, i) => [s.id, now - (i + 1) * DAY])) } };
  ut = { ...ut, packs: [{ id: 'qa-heavy-gold-1', kind: 'gold', at: now - 3600000 }, { id: 'qa-heavy-gold-2', kind: 'gold', at: now - 1800000 }] };
  // the owner's own wallet and level: 59,672 coins, Level 19 at 510/620 XP
  p.coins = 59672;
  p.xp = 6530;
  p.ut = ut;
  saveProfile(p);
}

/** Build a profile in an open dev-server page (the caller reloads it afterwards). */
export const buildFixture = (page, sport, profile, name = 'Codex QA') => page.evaluate(pageBuild, { sport, profile, name });

/** Wait for Home (or the welcome screen for a fresh profile) and close any launch dialogs. */
export async function waitForHome(page, profile = 'standard') {
  if (profile === 'fresh') {
    await page.getByRole('button', { name: 'NEXT', exact: true }).waitFor({ timeout: 90000 });
    return;
  }
  await page.locator('.home .playbar').waitFor({ timeout: 90000 });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(350);
    if (!(await page.locator('[role=dialog]').count())) break;
    await page.keyboard.press('Escape');
  }
}

/** The app's fixture keys, read back exactly as it stored them. */
const readKeys = (page) =>
  page.evaluate((allowed) => {
    const out = {};
    for (const k of allowed) {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
    return out;
  }, FIXTURE_KEYS);

/** What a serialized fixture holds, for the acceptance numbers and the team doc. */
export function summarize(keys, sport) {
  const raw = keys[PROFILE_KEY[sport]];
  const p = raw ? JSON.parse(raw) : null,
    shared = keys[SHARED_KEY] ? JSON.parse(keys[SHARED_KEY]) : null,
    ut = p?.ut;
  if (!ut) return { keys: Object.keys(keys), checkpoint: !!keys['perfect-season:checkpoint:' + sport] };
  const owned = ut.owned ?? [],
    hq = ut.hq ?? {},
    pulls = ut.content?.pulls;
  return {
    keys: Object.keys(keys),
    coins: shared?.coins,
    xp: shared?.xp,
    owned: owned.length,
    levelled: owned.filter((c) => c.level > 1).length,
    levelledShare: owned.length ? +(owned.filter((c) => c.level > 1).length / owned.length).toFixed(3) : 0,
    inStorage: (ut.duplicateStorage ?? []).length,
    squad: Object.keys(ut.squad ?? {}).length,
    evolved: Object.values(ut.content?.evo ?? {}).filter((e) => e.done?.length).length,
    evolving: Object.values(ut.content?.evo ?? {}).filter((e) => e.active).length,
    pullLogPacks: pulls?.r?.length ?? 0,
    pullLogCards: pulls?.r?.reduce((s, e) => s + e.cs.length, 0) ?? 0,
    pullLogTypes: Object.keys(pulls?.a ?? {}).length,
    packsOpened: ut.packsOpened,
    pendingPacks: (ut.packs ?? []).length,
    starterClaimed: !!ut.starterClaimed,
    hq: {
      seasons: Object.keys(hq.seasons ?? {}).length,
      seasonTiersClaimed: Object.values(hq.seasons ?? {}).reduce((s, x) => s + x.claimed.length, 0),
      claims: (hq.claims ?? []).length,
      journal: (hq.journal ?? []).length,
      history: (hq.history ?? []).length,
      days: Object.keys(hq.days ?? {}).length,
      weeks: Object.keys(hq.weeks ?? {}).length,
      cardStats: Object.keys(hq.cardStats ?? {}).length,
      presets: (hq.presets ?? []).length,
      developmentDone: Object.keys(hq.development?.completed ?? {}).length,
      developmentActive: !!hq.development?.active,
      moments: Object.keys(hq.moments ?? {}).length,
      circuitHistory: Object.keys(hq.circuitHistory ?? {}).length,
      circuitActive: !!hq.circuit?.active,
    },
    sbcDone: Object.keys(ut.sbc?.done ?? {}).length,
    record: ut.record,
    checkpoint: !!keys['perfect-season:checkpoint:' + sport],
  };
}

const appUrl = (sport) => {
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  return u.href;
};

/** Open Ultimate Team from Home and wait until it has loaded. */
export async function openUt(page) {
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.waitForFunction(() => !document.querySelector('.ut-loading') && document.querySelector('.ut-top, .ut-tabs'), null, { timeout: 120000 });
}

/** Build one profile on the dev server and write its serialized keys. Returns the file and summary. */
export async function make(browser, sport, profile, name = 'Codex QA') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const blocked = await isolate(context);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(appUrl(sport), { waitUntil: 'domcontentloaded' });
    if (profile !== 'fresh') {
      if (!(await page.evaluate(async () => !!(await import('/src/lib/profile.ts').catch(() => null)))))
        throw Error('fixtures.mjs make needs the dev server (PS_QA_URL), not a production build.');
      await buildFixture(page, sport, profile, name);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHome(page, profile);
    if (profile === 'utNoStarter') {
      await openUt(page);
      await page.waitForTimeout(800);
    } else if (profile === 'checkpoint') {
      await page.locator('.mode').filter({ hasText: /CLASSIC/i }).first().click();
      await page.locator('.home .playbar button').click();
      await page.locator('.screen.draft').waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: 'SPIN', exact: true }).click();
      await page.waitForTimeout(3500);
      await page.waitForFunction((k) => localStorage.getItem(k) !== null, 'perfect-season:checkpoint:' + sport, { timeout: 15000 });
    }
    // reload once more: the app re-reads and re-saves what it stored
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHome(page, profile);
    await page.waitForTimeout(1200);
    const keys = await readKeys(page);
    if (errors.length) throw Error(`${profile}/${sport}: page errors while making: ${errors.join(' | ')}`);
    let sha = 'unknown';
    try {
      sha = execSync('git rev-parse --short HEAD', { cwd: new URL('../..', import.meta.url), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      // not a git checkout
    }
    const out = { v: 1, profile, sport, made: new Date().toISOString(), source: sha, summary: summarize(keys, sport), blocked: [...new Set(blocked)], keys };
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(fixtureFile(profile, sport), JSON.stringify(out));
    return { file: fixtureFile(profile, sport), summary: out.summary, blocked: out.blocked };
  } finally {
    await context.close();
  }
}

/**
 * Load an injected fixture (dev server or a production build): Home, then Ultimate Team, with zero
 * page errors and nothing written outside the app's own keys.
 */
export async function check(browser, sport, profile) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const blocked = await isolate(context);
  await inject(context, profile, sport);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  try {
    await page.goto(appUrl(sport), { waitUntil: 'domcontentloaded' });
    await waitForHome(page, profile);
    const home = Date.now() - t0;
    const loaded = summarize(await readKeys(page), sport);
    let ut = null;
    if (profile !== 'fresh') {
      const u0 = Date.now();
      await openUt(page);
      ut = Date.now() - u0;
    }
    const all = await page.evaluate(() => Object.keys(localStorage));
    // keys besides the fixture's may only be the app's own: its signing key and cloud-save bookkeeping
    const foreign = all.filter((k) => !FIXTURE_KEYS.includes(k) && k !== 'perfect-season:key:v1' && !k.startsWith('perfect-season:cloud:') && k !== 'perfect-season:updated' && k !== 'perfect-season:missing-files');
    const made = profile === 'fresh' ? null : loadFixture(profile, sport).summary;
    const same = !made || ['owned', 'levelled', 'evolved', 'pullLogPacks', 'starterClaimed', 'checkpoint'].every((k) => JSON.stringify(made[k]) === JSON.stringify(loaded[k]));
    return { sport, profile, errors, homeMs: home, utMs: ut, sameAsMade: same, summary: loaded, foreignKeys: foreign, blocked: [...new Set(blocked)] };
  } finally {
    await context.close();
  }
}

const argOf = (args, name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1].split(',') : fallback;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!['make', 'check'].includes(cmd)) throw Error('Usage: node scripts/qa/fixtures.mjs make|check [--sports nba,nfl,soccer] [--profiles ' + PROFILES.join(',') + ']');
  const sports = argOf(args, 'sports', SPORTS),
    profiles = argOf(args, 'profiles', cmd === 'make' ? PROFILES.filter((p) => p !== 'fresh') : PROFILES);
  const browser = await launch();
  let failed = 0;
  try {
    for (const sport of sports)
      for (const profile of profiles) {
        const r = cmd === 'make' ? await make(browser, sport, profile) : await check(browser, sport, profile);
        if (cmd === 'check' && (r.errors.length || r.foreignKeys.length || !r.sameAsMade)) failed++;
        console.log(JSON.stringify({ cmd, sport, profile, ...r }));
      }
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}
