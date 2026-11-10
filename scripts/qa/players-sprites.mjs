// Players QA (studio overhaul, players-1): sprite freshness in autoplay matches, all three sports.
// Port of the audit's spritestats.cjs + stalebypx.cjs (A-1), plus stale by frames since the play
// started (snap, kickoff, inbound) and per-body effective animation rates.
//
// A STALE draw is a body shown last frame's drawing because the renderer's per-frame drawing budget
// was spent. Effective animation fps is the number of distinct poses a body is SHOWN per second
// (stale frames hold the old pose), against the poses the renderer asked for.
//
//   node scripts/qa/players-sprites.mjs [--sport nba,nfl,soccer] [--vp 393] [--secs 18] [--warm 5]
//        [--seed spr] [--shots] [--tag before] [--out DIR] [--port 5214]
// Prints one JSON line (and writes OUT/players-sprites[-tag].json). Isolated: localhost only.
import { emit, installProbe, listOf, matchUrl, needServer, newContext, opts, readProbe, resetProbe, shot, summariseProbe, SPORTS, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const vps = listOf(opts.vp, ['393']);
const secs = Number(opts.secs ?? 18);
const warm = Number(opts.warm ?? 5);
const seed = String(opts.seed ?? 'spr');
const tag = String(opts.tag ?? 'before');

await needServer();
const runs = await withBrowser(async (browser) => {
  const out = [];
  for (const vp of vps)
    for (const sport of sports) {
      const context = await newContext(browser, vp, { dpr: 1 });
      const page = await context.newPage();
      const errors = watchErrors(page);
      await page.goto(matchUrl(sport, { seed }), { waitUntil: 'load' });
      await installProbe(page, sport);
      await wait(warm * 1000);
      await resetProbe(page);
      const shots = [];
      const every = 3000;
      for (let t = 0; t < secs * 1000; t += every) {
        await wait(Math.min(every, secs * 1000 - t));
        if (opts.shots) shots.push(await shot(page, `${tag}-ingame-${sport}-${vp}-${shots.length}`));
      }
      const raw = await readProbe(page);
      out.push({ sport, vp, seed, ...summariseProbe(raw), shots, pageErrors: errors.slice(0, 5) });
      await context.close();
    }
  return out;
});
emit('players-sprites-' + tag, { runs });
