// Walk every main + UT screen for one sport and one device, screenshot + audit each.
import fs from 'node:fs';
import path from 'node:path';
import { launch, fixture, settle, audit, SHOTS, blocked } from './lib.mjs';
const [sport = 'nba', dev = '393', pagesArg = '2'] = process.argv.slice(2);
const MAXP = +pagesArg;
const browser = await launch();
const report = [];
const dir = path.join(SHOTS, sport + '-' + dev);
fs.mkdirSync(dir, { recursive: true });
try {
  const { page, context, errors } = await fixture(browser, sport, dev);
  let n = 0;
  const closeDialogs = async () => { for (let i = 0; i < 4 && (await page.locator('[role=dialog]').count()); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); } };
  const mainScroller = () => page.evaluateHandle(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].pop();
    const root = d || document.querySelector('.stage');
    const list = [...root.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 150; });
    return list.sort((a, b) => b.clientHeight - a.clientHeight)[0] || null;
  });
  const cap = async (name, pages = MAXP) => {
    await settle(page, 500);
    await page.locator('.toast').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
    const file = String(++n).padStart(2, '0') + '-' + name;
    const m = await audit(page);
    await page.screenshot({ path: path.join(dir, file + '.png') });
    const el = (await mainScroller()).asElement();
    let scrollInfo = null;
    if (el) {
      scrollInfo = await el.evaluate((e) => ({ h: e.scrollHeight, c: e.clientHeight, cls: String(e.className).slice(0, 40) }));
      for (let i = 1; i < pages; i++) {
        const more = await el.evaluate((e) => { if (e.scrollTop + e.clientHeight >= e.scrollHeight - 4) return false; e.scrollTop += e.clientHeight * 0.85; return true; });
        if (!more) break;
        await settle(page, 300);
        const extra = await audit(page);
        for (const k of ['offscreen', 'clipped', 'small', 'tiny', 'truncated', 'lowContrast']) m[k] = [...new Set([...(m[k] || []), ...(extra[k] || [])])];
        await page.screenshot({ path: path.join(dir, file + '-s' + i + '.png') });
      }
      await el.evaluate((e) => (e.scrollTop = 0));
    }
    report.push({ screen: file, scroll: scrollInfo, ...m });
    console.log(file, JSON.stringify({ title: m.title, tab: m.tab, top: m.topMost, small: m.small?.length, clipped: m.clipped, trunc: m.truncated?.length, lowc: m.lowContrast?.length, scroll: scrollInfo && Math.round(scrollInfo.h / scrollInfo.c * 10) / 10 }));
  };
  const step = async (name, fn, pages) => {
    try { await fn(); await cap(name, pages); }
    catch (e) { console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); report.push({ screen: name, fail: e.message.split('\n')[0] }); await closeDialogs(); }
  };
  const mainTab = (label) => page.locator('nav.tabs button').filter({ hasText: new RegExp('^\\s*' + label + '\\s*$', 'i') }).first().click();
  const utTab = (label) => page.locator('.ut-tabs button').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).click();
  const seg = (label) => page.locator('.ut-segs [role=tab]').filter({ hasText: new RegExp('^' + label) }).click();
  const back = () => page.locator('.ut-back').click();

  await page.locator('.home .playbar').waitFor({ timeout: 60000 });
  await settle(page, 1500);
  await closeDialogs();
  await step('main-home', async () => {}, 2);
  await step('main-howto', async () => { await page.getByRole('button', { name: 'How to play' }).click(); await page.getByRole('dialog').waitFor(); }, 2);
  await closeDialogs();
  await step('main-missions', async () => { await page.locator('.statchip.quests').click(); await page.getByRole('dialog').waitFor(); }, 1);
  await closeDialogs();
  await step('main-gauntlet', async () => { await page.locator('.statchip.gauntlet-chip').click(); await page.getByRole('dialog').waitFor(); }, 1);
  await closeDialogs();
  await step('main-mode-blind', async () => { await page.locator('.mode').filter({ hasText: 'BLIND' }).first().click(); }, 1);
  await step('main-mode-daily', async () => { await page.locator('.mode').filter({ hasText: 'DAILY' }).first().click(); }, 1);
  await step('main-mode-h2h', async () => { await page.locator('.mode').filter({ hasText: 'HEAD TO HEAD' }).first().click(); }, 1);
  await step('main-mode-classic-play', async () => { await page.locator('.mode').filter({ hasText: 'CLASSIC' }).first().click(); await page.locator('.home .playbar button, .home .playbar').first().click(); await page.waitForTimeout(1500); }, 1);
  await step('main-draft-after-spin', async () => { await page.waitForTimeout(3500); }, 2);
  // leave the draft
  try { for (let i = 0; i < 3 && !(await page.locator('nav.tabs').count()); i++) { const b = page.getByRole('button', { name: /back|close|exit|quit|leave/i }).first(); await b.click({ timeout: 3000 }); await page.waitForTimeout(600); const conf = page.getByRole('button', { name: /LEAVE|QUIT|YES|END/ }).first(); if (await conf.isVisible().catch(() => false)) await conf.click(); await page.waitForTimeout(600); } } catch (e) { console.log('leave draft: ' + e.message.split('\n')[0]); }
  await step('main-ranks', () => mainTab('RANKS'), 2);
  await step('main-profile', () => mainTab('PROFILE'), 4);
  await step('main-settings', async () => { await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('dialog').waitFor(); }, 3);
  await closeDialogs();
  await mainTab('HOME'); await settle(page, 400);

  // ---------- Ultimate Team ----------
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
  await settle(page, 1200);
  await step('ut-home-first', async () => {}, 1);
  await closeDialogs();
  await step('ut-home', async () => {}, 5);
  await step('ut-rewards', () => page.locator('.ut-home-inbox').click(), 2);
  await step('ut-daily', async () => { await back(); await page.locator('.ut-home-daily').click(); }, 3);
  await step('ut-records', async () => { await back(); await page.locator('.uh-form').click(); }, 2);
  await back().catch(() => {});
  await step('ut-play', () => utTab('PLAY'), 4);
  const rows = { nba: ['CLUB CUPS', 'CLUB SEASON', 'SQUAD BATTLES', 'CHAMPIONS CIRCUIT', 'LEGENDS EVENTS', 'MOMENTS', 'UT DRAFT'], nfl: ['CLUB CUPS', 'CLUB SEASON', 'SQUAD BATTLES', 'CHAMPIONS CIRCUIT', 'LEGENDS EVENTS', 'MOMENTS', 'UT DRAFT'], soccer: ['CLUB CUPS', 'SQUAD BATTLES', 'CHAMPIONS CIRCUIT', 'UT DRAFT'] }[sport];
  for (const row of rows) {
    await step('ut-play-' + row.toLowerCase().replace(/\s+/g, '-'), async () => { await page.locator('.play-mode').filter({ hasText: row }).first().click(); }, 3);
    await back().catch(() => {});
    await settle(page, 300);
  }
  await step('ut-play-rivals', () => page.locator('.up-rivals-top').click(), 3);
  await back().catch(() => {});
  await step('ut-squad', () => utTab('SQUAD'), 2);
  await step('ut-club-players', () => utTab('CLUB'), 2);
  await step('ut-club-filter', async () => { await page.locator('.ut-filter-btn').click(); await page.getByRole('dialog').waitFor(); }, 2);
  await closeDialogs();
  await step('ut-card-detail', async () => { await page.locator('.ut-gridcard').first().click(); await page.getByRole('dialog').waitFor(); }, 3);
  await closeDialogs();
  await step('ut-card-detail-top', async () => { await page.locator('.ut-gridcard').nth(0).click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(800); }, 1);
  await closeDialogs();
  await step('ut-club-tracker', async () => { await page.locator('.ut-tracker-link').click(); }, 3);
  await back().catch(() => {});
  await step('ut-club-storage', () => seg('STORAGE'), 1);
  await step('ut-club-collection', () => seg('COLLECTION'), 3);
  await step('ut-club-sets', () => page.locator('.ut-so-link').filter({ hasText: 'Sets' }).first().click(), 3);
  await back().catch(() => {});
  await step('ut-club-development', () => seg('DEVELOPMENT'), 3);
  await step('ut-club-evolutions', () => page.getByRole('button', { name: /EVOLUTIONS LAB/ }).first().click(), 3);
  await back().catch(() => {});
  await step('ut-ch-sbc', async () => { await utTab('CHALLENGES'); await seg('SBCs'); }, 5);
  await step('ut-ch-sbc-detail', async () => { await page.locator('button.ut-sbc:not([disabled])').first().click(); await page.waitForTimeout(600); }, 2);
  await closeDialogs();
  await back().catch(() => {});
  await step('ut-ch-standouts', async () => { await utTab('CHALLENGES'); await seg('SBCs'); await page.locator('.ut-so-link').filter({ hasText: 'Weekly Standouts' }).first().click(); }, 3);
  await back().catch(() => {});
  await step('ut-ch-objectives', () => seg('OBJECTIVES'), 3);
  await step('ut-ch-season-pass', () => seg('SEASON PASS'), 2);
  await step('ut-store', () => utTab('STORE'), 6);
  await step('ut-store-odds', async () => { await page.locator('.ut-oddsbtn').first().click(); await page.getByRole('dialog').waitFor(); }, 2);
  await closeDialogs();
  await step('ut-store-market', () => page.getByRole('tab', { name: 'SCOUT MARKET' }).click(), 3);
  await page.getByRole('tab', { name: 'PACKS' }).click().catch(() => {});
  await step('ut-pack-open-0', async () => { await page.locator('.ut-mine-pack').filter({ hasText: /Gold|GOLD/ }).first().click(); await page.waitForTimeout(400); }, 1);
  await step('ut-pack-open-1', async () => { await page.waitForTimeout(1500); }, 1);
  await step('ut-pack-open-2', async () => { await page.locator('.ut-open-screen').click({ position: { x: 30, y: 300 } }).catch(() => {}); await page.waitForTimeout(1500); }, 1);
  for (let i = 0; i < 10 && (await page.locator('.ut-open-screen').count()); i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.isVisible().catch(() => false)) { await cap('ut-pack-open-done', 2); await done.click(); }
    else { const skip = page.getByRole('button', { name: 'SKIP', exact: true }); if (await skip.isVisible().catch(() => false)) await skip.click(); else await page.locator('.ut-open-screen').click({ position: { x: 30, y: 300 } }); }
    await page.waitForTimeout(600);
  }
  await step('ut-after-pack', async () => {}, 1);
  await step('ut-exit', async () => { await utTab('HOME'); await page.locator('.ut-back').click(); await page.locator('nav.tabs').waitFor(); }, 1);
  report.push({ errors, blocked: [...new Set(blocked)] });
  console.log('errors', errors, 'blocked', [...new Set(blocked)]);
  await context.close();
} finally {
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
}
