// Players QA (studio overhaul players-4): the looks gallery (?pixel=looks) in a phone context, isolated
// from live services. Saves the whole page and one picture per section, at 393x852 (insets 59/34) and
// 320x568, checks the page has no horizontal scroll and no page errors, and reads back the owner's
// seven examples' drawn traits from the section captions.
//
//   node scripts/qa/players-looks.mjs [--out DIR] [--tag after-p4]
import fs from 'node:fs';
import path from 'node:path';
import { appUrl, emit, needServer, newContext, OUT, opts, routeLog, watchErrors, withBrowser } from './players-lib.mjs';

const tag = String(opts.tag ?? 'after-p4');

await needServer();
const report = await withBrowser(async (browser) => {
  const out = { tag, viewports: {} };
  for (const vp of ['393', '320']) {
    const context = await newContext(browser, vp, { dpr: 1 });
    const page = await context.newPage();
    const errors = watchErrors(page);
    await page.goto(appUrl({ pixel: 'looks' }), { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('[data-looks-ready]', { timeout: 180000 });
    const info = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      sections: [...document.querySelectorAll('[data-looks-section]')].map((s) => s.getAttribute('data-looks-section')),
      ready: document.querySelector('[data-looks-ready]')?.textContent,
      storage: (() => {
        try {
          return localStorage.length + sessionStorage.length;
        } catch {
          return -1;
        }
      })(),
    }));
    await page.screenshot({ path: path.join(OUT, `${tag}-gallery-looks-${vp}.png`), fullPage: false });
    if (vp === '393') {
      // each section's sheet, read straight off its canvas (a long page passes the browser's capture
      // limit, so element screenshots of the lower sections come back empty)
      const sheets = await page.evaluate(() => [...document.querySelectorAll('[data-looks-section]')].map((s) => ({ name: s.getAttribute('data-looks-section'), png: s.querySelector('canvas')?.toDataURL('image/png') ?? null })));
      for (const [i, { name, png }] of sheets.entries()) {
        if (!png) continue;
        fs.writeFileSync(path.join(OUT, `${tag}-gallery-${String(i + 1).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`), Buffer.from(png.split(',')[1], 'base64'));
      }
    }
    out.viewports[vp] = { ...info, noHorizontalScroll: info.scrollW <= info.clientW, errors };
    await context.close();
  }
  out.routes = routeLog();
  return out;
});
emit('players-looks', report);
