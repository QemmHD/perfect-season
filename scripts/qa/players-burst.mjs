// Players QA (studio overhaul, players-1): slow-motion bursts of the autoplay match (port of the
// audit's burst.cjs), to see key actions as they actually play: hard cuts, stale (frozen) frames on
// near players, feet sliding. The bench runs at 0.25x (`slowmo`), frames are captured about every
// 110 ms of real time, the action band is cropped, and a contact sheet is composed per sport.
//
// It also reports how much of the band changes between consecutive captures, and how many
// consecutive captures are pixel-identical (nothing redrawn while the bench runs).
//
//   node scripts/qa/players-burst.mjs [--sport nba,nfl,soccer] [--vp 393] [--frames 48]
//        [--every 110] [--slowmo 0.25] [--tag before] [--out DIR]
import fs from 'node:fs';
import path from 'node:path';
import { emit, listOf, matchUrl, needServer, newContext, OUT, opts, SPORTS, VIEWPORTS, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const vp = String(opts.vp ?? '393');
const n = Number(opts.frames ?? 48);
const every = Number(opts.every ?? 110);
const slowmo = Number(opts.slowmo ?? 0.25);
const tag = String(opts.tag ?? 'before');
// where the action sits in each bench at the 393x852 frame (the band the audit cropped)
const BAND = { nba: [0.34, 0.9], nfl: [0.42, 0.95], soccer: [0.3, 0.85] };

await needServer();
const results = await withBrowser(async (browser) => {
  const out = [];
  for (const sport of sports) {
    const v = VIEWPORTS[vp];
    const context = await newContext(browser, vp, { dpr: 1 });
    const page = await context.newPage();
    const errors = watchErrors(page);
    await page.goto(matchUrl(sport, { seed: 'burst', slowmo }), { waitUntil: 'load' });
    await page.waitForSelector('canvas', { timeout: 90000 });
    await wait({ nba: 9000, nfl: 14000, soccer: 9000 }[sport]);
    const [a, b] = BAND[sport];
    const clip = { x: 0, y: Math.round(v.h * a), width: v.w, height: Math.round(v.h * (b - a)) };
    const files = [];
    const bufs = [];
    for (let i = 0; i < n; i++) {
      const file = path.join(OUT, `${tag}-burst-${sport}-${String(i).padStart(2, '0')}.png`);
      const buf = await page.screenshot({ path: file, clip });
      files.push(file);
      bufs.push(buf.toString('base64'));
      await wait(every);
    }
    // a contact sheet and the frozen-frame count, composed in the page
    const r = await page.evaluate(
      async ({ imgs, cols }) => {
        const load = (b64) =>
          new Promise((ok) => {
            const im = new Image();
            im.onload = () => ok(im);
            im.src = 'data:image/png;base64,' + b64;
          });
        const ims = await Promise.all(imgs.map(load));
        const w = ims[0].width,
          h = ims[0].height,
          s = 0.5;
        const c = document.createElement('canvas');
        c.width = Math.round(cols * w * s);
        c.height = Math.round(Math.ceil(ims.length / cols) * h * s);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        ims.forEach((im, i) => g.drawImage(im, (i % cols) * w * s, Math.floor(i / cols) * h * s, w * s, h * s));
        // identical consecutive captures (the whole band): the game didn't redraw anything new
        const px = ims.map((im) => {
          const k = document.createElement('canvas');
          k.width = w;
          k.height = h;
          const kg = k.getContext('2d');
          kg.drawImage(im, 0, 0);
          return kg.getImageData(0, 0, w, h).data;
        });
        let same = 0;
        const changed = [];
        for (let i = 1; i < px.length; i++) {
          let d = 0;
          for (let j = 0; j < px[i].length; j += 4) if (px[i][j] !== px[i - 1][j] || px[i][j + 1] !== px[i - 1][j + 1] || px[i][j + 2] !== px[i - 1][j + 2]) d++;
          changed.push(+((100 * d) / (w * h)).toFixed(2));
          if (d === 0) same++;
        }
        return { sheet: c.toDataURL(), identicalPairs: same, changedPct: changed };
      },
      { imgs: bufs, cols: 8 }
    );
    const sheet = path.join(OUT, `${tag}-burst-${sport}-sheet.png`);
    fs.writeFileSync(sheet, Buffer.from(r.sheet.split(',')[1], 'base64'));
    const ch = [...r.changedPct].sort((x, y) => x - y);
    out.push({ sport, vp, slowmo, frames: files.length, everyMs: every, clip, sheet, identicalConsecutive: r.identicalPairs, changedPctP10: ch[Math.floor(ch.length * 0.1)], changedPctP50: ch[Math.floor(ch.length / 2)], files: files.length, pageErrors: errors.slice(0, 3) });
    await context.close();
  }
  return out;
});
emit('players-burst-' + tag, { results });
