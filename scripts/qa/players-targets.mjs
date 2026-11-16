// Players QA (studio overhaul, players-1): the visual target. Renders the V2 mock-ups page
// (GAME-DESIGN-V2's companion `mockups.html`, original concept art in SVG and CSS) and saves its three
// "Broadcast Pixel" character lineups and its in-match HUD frames as
// `target-mockups-{lineup-nba,lineup-nfl,lineup-soccer,hud}.png`, so every later "after" sheet is set
// beside the target and not only beside "before". Each lineup is also saved at 4x zoom
// (`target-mockups-lineup-<sport>-4x.png`, nearest-neighbour) to compare pixel by pixel.
//
//   node scripts/qa/players-targets.mjs --mockups <path to mockups.html> [--out DIR]
// The page is opened from file://, in an isolated context: Google Fonts' Archivo is answered from the
// local copy (or aborted) like every players script; nothing else leaves the machine.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, isolate, OUT, opts, withBrowser } from './players-lib.mjs';

const src = opts.mockups ? path.resolve(String(opts.mockups)) : null;
if (!src || !fs.existsSync(src)) {
  console.error('players-targets: pass --mockups <path to design-v2/mockups.html>');
  process.exit(2);
}

const PARTS = [
  ['hud', '#hud'],
  ['lineup-nba', '#l-nba'],
  ['lineup-nfl', '#l-nfl'],
  ['lineup-soccer', '#l-soc'],
];

const results = await withBrowser(async (browser) => {
  const out = [];
  for (const scale of [1, 4]) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: scale });
    await isolate(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    await page.goto(pathToFileURL(src).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    for (const [name, sel] of PARTS) {
      if (scale === 4 && name === 'hud') continue;
      const el = page.locator(sel);
      if (!(await el.count())) {
        out.push({ name, scale, error: 'selector ' + sel + ' not found' });
        continue;
      }
      // pixel art stays crisp when zoomed
      await page.addStyleTag({ content: `${sel} canvas, ${sel} img, ${sel} svg { image-rendering: pixelated; }` });
      const file = path.join(OUT, `target-mockups-${name}${scale === 4 ? '-4x' : ''}.png`);
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: file });
      const box = await el.boundingBox();
      out.push({ name, scale, file, cssBox: box && { w: Math.round(box.width), h: Math.round(box.height) }, pageErrors: errors.slice(0, 3) });
    }
    await context.close();
  }
  return out;
});
emit('players-targets', { mockups: src, results });
