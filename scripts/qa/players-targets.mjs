// Players QA (studio overhaul, players-1): the visual target. BRIEF.md and GAME-DESIGN-V2 C name
// `design-v2/mockups-v2.html` as the visual target (the owner judged the first page, `mockups.html`,
// "too simple and boring" and "too flat"; it stays useful only for control geometry). This renders
// mockups-v2's live canvas scenes and its card ladder and saves them beside every later "after" sheet:
//
//   target-v2-nba.png, target-v2-nfl.png, target-v2-soccer.png   the gameplay hero frames (393x852)
//   target-v2-<sport>-3x.png                                     the same at 3x: sprite close-ups
//   target-v2-dunk.png, -ankle.png, -hit.png, -goal.png          replay-camera juice frames (hero sprites at 4.5-5x)
//   target-v2-walkout.png                                        the pack walkout
//   target-v2-cards.png (and -cards-2x.png)                      the card tier ladder with the bust
//
// With --superseded <path to mockups.html> it also renders the first page's lineups and HUD as
// `target-mockups-{hud,lineup-nba,lineup-nfl,lineup-soccer}.png`, labelled "superseded: control
// geometry only" in the report. Scenes animate (drift, shimmer, flashes); each capture waits 1.5 s
// after the page loads, so frames differ a little between runs.
//
//   node scripts/qa/players-targets.mjs [--mockups <path to mockups-v2.html>] [--superseded <path to mockups.html>] [--out DIR]
// Default --mockups: $PS_DESIGN_V2_DIR/mockups-v2.html, else the overhaul's design-v2 folder. The page
// is opened from file:// in an isolated context: Google Fonts' Archivo is answered from the local copy
// (or aborted) like every players script; nothing else leaves the machine.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, isolate, OUT, opts, withBrowser } from './players-lib.mjs';

const DESIGN_DIR = process.env.PS_DESIGN_V2_DIR ?? '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/design-v2';
const src = path.resolve(String(opts.mockups ?? path.join(DESIGN_DIR, 'mockups-v2.html')));
const old = opts.superseded ? path.resolve(String(opts.superseded)) : null;
if (!fs.existsSync(src)) {
  console.error('players-targets: mockups-v2.html not found at ' + src + ' (pass --mockups <path> or set PS_DESIGN_V2_DIR)');
  process.exit(2);
}
if (old && !fs.existsSync(old)) {
  console.error('players-targets: --superseded ' + old + ' not found');
  process.exit(2);
}

/**
 * mockups-v2 draws each 393x852 phone screen inside a frame scaled by CSS (`.dev`, scale .772): the
 * phone captures use a device scale of `scale / PHONE_CSS_SCALE`, so `target-v2-nba.png` is 393 px wide
 * (one design px per image px) and `-3x` is 1179. The scale actually found is in the report.
 */
const PHONE_CSS_SCALE = 0.772;
/** [name, selector, design scales] on mockups-v2.html */
const V2_PARTS = [
  ['nba', '#p-nba', [1, 3]],
  ['nfl', '#p-nfl', [1, 3]],
  ['soccer', '#p-soc', [1, 3]],
  ['dunk', '#p-dunk', [1]],
  ['ankle', '#p-ankle', [1]],
  ['hit', '#p-hit', [1]],
  ['goal', '#p-gol', [1]],
  ['walkout', '#p-pack', [1]],
  ['cards', '#cards', [1, 2]],
];
/** the first page's parts (superseded: control geometry only) */
const OLD_PARTS = [
  ['hud', '#hud'],
  ['lineup-nba', '#l-nba'],
  ['lineup-nfl', '#l-nfl'],
  ['lineup-soccer', '#l-soc'],
];

async function capture(browser, file, parts, prefix, label) {
  const out = [];
  const phone = (sel) => sel.startsWith('#p-');
  // one browser context per (scale, phone or not): phones undo the page's CSS scale
  const runs = [...new Set(parts.flatMap(([, sel, sc = [1, 4]]) => sc.map((x) => `${x}|${phone(sel) ? 1 : 0}`)))].map((k) => k.split('|').map(Number));
  for (const [scale, isPhone] of runs) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: isPhone ? scale / PHONE_CSS_SCALE : scale });
    await isolate(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    for (const [name, sel, sc = [1, 4]] of parts) {
      if (!sc.includes(scale) || +phone(sel) !== isPhone || (scale === 4 && name === 'hud')) continue;
      const el = page.locator(sel).first();
      if (!(await el.count())) {
        out.push({ name, scale, label, error: 'selector ' + sel + ' not found' });
        continue;
      }
      // pixel art stays crisp when zoomed
      await page.addStyleTag({ content: `${sel} canvas, ${sel} img, ${sel} svg { image-rendering: pixelated; }` });
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const f = path.join(OUT, `${prefix}${name}${scale === 1 ? '' : `-${scale}x`}.png`);
      await el.screenshot({ path: f });
      const box = await el.boundingBox();
      const cssScale = await el.evaluate((e) => (e.offsetWidth ? e.getBoundingClientRect().width / e.offsetWidth : 1));
      out.push({ name, scale, label, file: f, cssBox: box && { w: Math.round(box.width), h: Math.round(box.height) }, cssScale: Math.round(cssScale * 1000) / 1000, imagePx: box && { w: Math.round(box.width * (isPhone ? scale / PHONE_CSS_SCALE : scale)), h: Math.round(box.height * (isPhone ? scale / PHONE_CSS_SCALE : scale)) }, pageErrors: errors.slice(0, 3) });
    }
    await context.close();
  }
  return out;
}

const results = await withBrowser(async (browser) => [
  ...(await capture(browser, src, V2_PARTS, 'target-v2-', 'visual target (mockups-v2.html)')),
  ...(old ? await capture(browser, old, OLD_PARTS, 'target-mockups-', 'superseded: control geometry only (mockups.html)') : []),
]);
emit('players-targets', { mockups: src, superseded: old, results });
