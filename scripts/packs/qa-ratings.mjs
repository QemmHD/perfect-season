// Claude (packs-5, 2026-11-16): isolated localhost QA for the ratings truth re-rate (docs/studio-overhaul/
// packs.md, "packs-5"). Every request whose host isn't localhost (or the font CDN) is aborted, the page runs
// in the `inspect` namespace against a local relay, and the save is a local fixture: nothing reaches a live
// service, and no 90+ copy is ever registered (numbered sync is aborted with every other outside host).
// It owns one copy of each named card, opens Club → Players → the card's detail, prints the overall and the
// six face numbers next to the attributes the match plays, and screenshots the detail. The same script runs
// against an older tree (it only uses exports that predate packs-5), which gives the before shots.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> LABEL=after node scripts/packs/qa-ratings.mjs nba 393
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const base = process.env.PS_QA_URL || 'http://localhost:5213/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
const out = process.env.OUT || '/tmp/packs-qa';
const label = process.env.LABEL || 'after';
fs.mkdirSync(out, { recursive: true });
const [sport = 'nba', width = '393'] = process.argv.slice(2);
const DEV = { 393: { w: 393, h: 852, insets: [59, 0, 34, 0] }, 320: { w: 320, h: 568, insets: [20, 0, 0, 0] } }[width];
const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];
/** [kind, name part, season] per sport: the audit's examples (packs plan, packs-5 screenshots) */
const CARDS = {
  nba: [['promo', 'Nate McMillan', 1994], ['legend', 'Michael Cooper', 1981], ['goat', 'Kareem', 0]],
  nfl: [['promo', 'Joe Ferguson', 1977], ['goat', 'Tom Brady', 0]],
}[sport];

const { chromium } = require('playwright');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: DEV.w, height: DEV.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const blocked = [];
await context.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (ALLOWED.includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
  blocked.push(u.hostname);
  return route.abort();
});
await context.addInitScript((ins) => (window.__psInsets = ins), DEV.insets);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = new URL(base);
url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
await page.goto(url.href, { waitUntil: 'domcontentloaded' });
const picked = await page.evaluate(
  async ({ sport, cards }) => {
    const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
    const { getPool } = await import('/src/ut/pool.ts');
    const { openPack } = await import('/src/ut/packs.ts');
    const { autoBuild } = await import('/src/ut/squad.ts');
    const { freshUt } = await import('/src/ut/state.ts');
    const { faceOf } = await import('/src/ut/card-face.ts');
    const { toDisplay } = await import('/src/ut/ut-scale.ts');
    // what the match plays, printed the way the face prints it: the six face numbers from the played
    // attributes (on the displayed scale below Spotlight; a Spotlight or GOAT prints its rating scale)
    const played = (rc) => {
      const special = rc.tier === 'spotlight' || rc.tier === 'goat';
      const pos = sport === 'nba' ? (['PG', 'SG', 'SF', 'PF', 'C'].includes(rc.line.pos[0]) ? rc.line.pos[0] : 'SF') : rc.pos;
      return faceOf(sport, pos, rc.attrs, special ? (rc.tier === 'goat' ? 110 : 105) : 99).map(([c, , v]) => c + ' ' + (special ? v : Math.round(toDisplay(sport, v)))).join(', ');
    };
    const pool = await getPool();
    const p = freshProfile();
    p.name = 'Packs QA';
    p.coins = 10000;
    p.firstRun = false;
    p.gifts = ['testers-2026-10'];
    p.settings.sound = false;
    p.settings.haptics = false;
    p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const starter = openPack(pool, 'starter', 'qa');
    const wanted = cards.map(([kind, name, season]) => Object.values(pool.buckets[kind]).flat().find((rc) => rc.line.name.includes(name) && (!season || rc.line.season === season)));
    const all = [...starter, ...wanted.filter(Boolean)];
    const owned = all.map((rc, i) => ({ uid: 'packs-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
    const squad = autoBuild(sport, owned.slice(0, starter.length).map((c, i) => ({ uid: c.uid, rc: all[i] })));
    p.ut = { ...freshUt(), owned, squad, starterClaimed: true, packsOpened: 1 };
    localStorage.setItem('perfect-season:fav:asked', '1');
    saveProfile(p);
    return wanted.map((rc) =>
      rc
        ? { id: rc.line.id, name: rc.line.name, season: rc.line.season, tier: rc.tier, ovr: rc.ovr, raw: rc.rawOvr, face: (rc.face ?? rc.key).map(([c, , v]) => c + ' ' + v).join(', '), played: played(rc) }
        : null,
    );
  },
  { sport, cards: CARDS },
);
await page.reload({ waitUntil: 'domcontentloaded' });
const settle = (ms = 500) => page.waitForTimeout(ms);
const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();
await page.locator('.ut-tabs button').filter({ hasText: /^CLUB[0-9]*$/ }).click();
await page.getByRole('button', { name: 'PLAYERS', exact: true }).first().click().catch(() => {});
await page.locator('.ut-gridcard').first().waitFor({ timeout: 20000 });
await settle();
for (const [i, rc] of picked.entries()) {
  if (!rc) {
    console.log('missing', CARDS[i].join(' '));
    continue;
  }
  console.log(label, JSON.stringify(rc));
  const card = page.locator('.ut-gridcard').filter({ hasText: rc.name.split(' ').pop().toUpperCase() }).filter({ hasText: String(rc.ovr) }).first();
  const target = (await card.count()) ? card : page.locator('.ut-gridcard').filter({ hasText: new RegExp(rc.name.split(' ').pop(), 'i') }).first();
  await target.scrollIntoViewIfNeeded();
  await target.click();
  const detail = page.getByRole('dialog').last();
  await detail.waitFor();
  await settle(900);
  const shown = await detail.locator('.ut-key').evaluateAll((els) => els.map((el) => el.innerText.replace(/\s+/g, ' ').trim()));
  console.log('  detail keys:', shown.join(' | '));
  const slug = CARDS[i][0] + '-' + rc.name.split(' ').pop().toLowerCase();
  await page.screenshot({ path: path.join(out, sport + '-' + width + '-' + label + '-' + slug + '.png'), animations: 'disabled' });
  await detail.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await detail.waitFor({ state: 'detached' });
  await settle(300);
}
console.log('errors:', errors.length ? errors : 'none', 'blocked hosts:', [...new Set(blocked)].join(',') || 'none');
await browser.close();
