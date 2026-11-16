// Claude, 2026-11-16 (studio overhaul, team ut-1): the GO-chip check for audit H5. On Objectives
// (every group: DAILY, WEEKLY, CLUB/LIFETIME) and on Daily, counts the controls that only say
// "IN PROGRESS" (disabled, leading nowhere) against the GO chips that lead to where the goal is done,
// taps every GO chip once in a fresh phone and records the screen it opened. Uses ut-studio.mjs's
// isolated phone (localhost only, local relay, iPhone insets, touch).
//
//   node scripts/qa/ut-go-chips.mjs [--out DIR] [--sport nba,nfl,soccer] [--size 393,320] [--fixture audit,near-miss]
import fs from 'node:fs';
import path from 'node:path';
import { launch, openPhone, settle, socketReport, waitHome, enterUt, closeDialogs } from './ut-studio.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const OUT = arg('out', 'shots-go');
const SPORTS = arg('sport', 'nba,nfl,soccer').split(',');
const SIZES = arg('size', '393,320').split(',');
const FIXTURES = arg('fixture', 'audit,near-miss').split(',');
fs.mkdirSync(OUT, { recursive: true });

const count = (page) =>
  page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.page button')];
    const dead = buttons.filter((b) => b.disabled && /IN PROGRESS/i.test(b.textContent || '')).length;
    const go = [...document.querySelectorAll('.page .ut-k-go')];
    const small = go.filter((b) => {
      const r = b.getBoundingClientRect(),
        s = Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')) || r.width / b.offsetWidth || 1;
      const before = getComputedStyle(b, '::before');
      const t = parseFloat(before.top) || 0,
        btm = parseFloat(before.bottom) || 0;
      return b.offsetHeight - t - btm < 44 && b.offsetHeight < 44 && s > 0;
    }).length;
    return { dead, go: go.length, goLabels: go.map((b) => b.textContent.trim()), small };
  });

const tab = async (page, label) => {
  await enterUt(page);
  await closeDialogs(page);
  await page
    .locator('.ut-tabs button')
    .filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) })
    .click();
  await settle(page, 300);
};
const title = (page) => page.evaluate(() => document.querySelector('.ut-title')?.textContent?.trim() ?? '');

async function toObjectives(page) {
  await tab(page, 'CHALLENGES');
  await page.locator('.ut-segs [role=tab]').filter({ hasText: /^OBJECTIVES/ }).click();
  await settle(page, 400);
}
async function toDaily(page) {
  await tab(page, 'HOME');
  await closeDialogs(page);
  await page.locator('.ut-home-daily').click();
  await settle(page, 400);
}

const report = [];
const browser = await launch();
for (const sport of SPORTS)
  for (const size of SIZES)
    for (const fixture of FIXTURES) {
      const row = { sport, size, fixture, objectives: {}, daily: null, taps: [], errors: [] };
      const ph = await openPhone(browser, { sport, size, fixture });
      try {
        await waitHome(ph.page);
        await toObjectives(ph.page);
        row.initialGroup = await ph.page.evaluate(() => document.querySelector('.hq-filter [aria-pressed=true]')?.textContent?.trim());
        row.summary = await ph.page.evaluate(() => document.querySelector('.hq-objective-summary span')?.textContent?.trim());
        for (const g of ['DAILY', 'WEEKLY', 'LIFETIME']) {
          await ph.page.locator('.hq-filter button').filter({ hasText: new RegExp('^' + g) }).click();
          await settle(ph.page, 250);
          row.objectives[g] = await count(ph.page);
          if (g === 'DAILY' && size === '393') await ph.page.screenshot({ path: path.join(OUT, `${sport}-${size}-${fixture}-objectives.png`) });
          if (g === 'WEEKLY' && size !== '393') await ph.page.screenshot({ path: path.join(OUT, `${sport}-${size}-${fixture}-objectives-weekly.png`) });
        }
        await toDaily(ph.page);
        row.daily = await count(ph.page);
        await ph.page.screenshot({ path: path.join(OUT, `${sport}-${size}-${fixture}-daily.png`), fullPage: false });
      } catch (e) {
        row.errors.push(String(e).slice(0, 300));
      }
      row.pageErrors = ph.errors;
      await ph.context.close();
      // tap every GO chip once (fresh phone each), at the first size only
      if (size === SIZES[0] && !row.errors.length)
        for (const [where, n] of [
          ['daily', row.daily?.go ?? 0],
          ...['DAILY', 'WEEKLY', 'LIFETIME'].map((g) => [g, row.objectives[g]?.go ?? 0]),
        ])
          for (let i = 0; i < n; i++) {
            const t = await openPhone(browser, { sport, size, fixture });
            try {
              await waitHome(t.page);
              if (where === 'daily') await toDaily(t.page);
              else {
                await toObjectives(t.page);
                await t.page.locator('.hq-filter button').filter({ hasText: new RegExp('^' + where) }).click();
                await settle(t.page, 250);
              }
              const chip = t.page.locator('.page .ut-k-go').nth(i);
              const label = (await chip.textContent()).trim();
              await chip.tap();
              await settle(t.page, 500);
              await closeDialogs(t.page);
              row.taps.push({ where, label, opened: await title(t.page) });
            } catch (e) {
              row.taps.push({ where, i, error: String(e).slice(0, 200) });
            }
            await t.context.close();
          }
      report.push(row);
      console.log(JSON.stringify({ sport, size, fixture, initial: row.initialGroup, summary: row.summary, obj: Object.fromEntries(Object.entries(row.objectives).map(([k, v]) => [k, [v.dead, v.go, v.small]])), daily: row.daily && [row.daily.dead, row.daily.go, row.daily.small], taps: row.taps.map((t) => t.where + ':' + t.label + '>' + (t.opened ?? t.error)), errors: [...row.errors, ...row.pageErrors] }));
    }
await browser.close();
const total = (k) => report.reduce((n, r) => n + Object.values(r.objectives).reduce((m, v) => m + v[k], 0) + (r.daily?.[k] ?? 0), 0);
const summary = { dead: total('dead'), go: total('go'), small: total('small'), taps: report.flatMap((r) => r.taps).length, tapErrors: report.flatMap((r) => r.taps).filter((t) => t.error || !t.opened).length, sockets: socketReport() };
fs.writeFileSync(path.join(OUT, 'go-report.json'), JSON.stringify({ summary, report }, null, 2));
console.log('SUMMARY', JSON.stringify(summary));
process.exit(summary.sockets.ok ? 0 : 1);
