// Implemented by Codex. Optional, isolated localhost QA; never loads a real browser profile.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
export const require = createRequire(process.env.PS_QA_PACKAGE_JSON || new URL('../../package.json', import.meta.url));
export const base = process.env.PS_QA_URL || 'http://localhost:5173/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
export const artifacts = process.env.PS_QA_ARTIFACTS || '/tmp/perfect-season-qa';
fs.mkdirSync(artifacts, { recursive: true });
export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  const proxy = process.env.PS_QA_PROXY;
  return chromium.launch({
    headless: true,
    ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
    args: ['--no-sandbox', ...(proxy ? ['--proxy-server=' + proxy, '--proxy-bypass-list=localhost;127.0.0.1'] : [])],
  });
}
export async function fixture(browser, sport = 'nba', name = 'Codex QA', width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', ignoreHTTPSErrors: !!process.env.PS_QA_PROXY });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = new URL(base);
  url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    async ({ sport, name }) => {
      const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { getPool, byValue } = await import('/src/ut/pool.ts');
      const { openPack } = await import('/src/ut/packs.ts');
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
      p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      const cards = [
        ...openPack(pool, 'starter', 'qa'),
        ...[...pool.base.values()].filter((c) => c.tier === 'goat'),
        ...[...pool.base.values()]
          .filter((c) => c.line.kind === 'season' && c.line.fr === (sport === 'nba' ? 'CHI' : 'NE'))
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
        packs: [{ id: 'event:immortals:2', kind: 'event-spotlight:immortals', at: 2 }],
      };
      localStorage.setItem('perfect-season:fav:asked', '1');
      saveProfile(p);
    },
    { sport, name }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  const current = () =>
    page.evaluate((sport) => {
      const p = JSON.parse(localStorage.getItem(sport === 'nba' ? 'perfect-season:profile:v1' : 'perfect-season:profile:nfl:v1'));
      p.coins = JSON.parse(localStorage.getItem('perfect-season:profile:v1')).coins;
      return p;
    }, sport);
  return { page, context, current, errors, original: await current() };
}
export async function shot(page, name) {
  await page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled', timeout: 12000 });
}
export async function dismissPack(page) {
  for (let i = 0; i < 9 && (await page.locator('.ut-open-screen').count()); i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.isVisible().catch(() => false)) await done.click();
    else {
      const skip = page.getByRole('button', { name: 'SKIP', exact: true });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      else await page.locator('.ut-open-screen').click({ position: { x: 10, y: 60 } });
    }
    await page.waitForTimeout(220);
  }
}
