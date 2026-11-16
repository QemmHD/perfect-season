// The small phones' tip-off frame (audit NBA-13, ported by Claude 2026-11-16): 375×667 and 320×568,
// the controls' boxes and whether any covers the ball handler (from the engine through the dev
// probe: his feet and head on screen).
//   node scripts/audit/nba-se.mjs [size…]
import { context, launch, needServer, openLab, rect, report, shot, wait } from './nba-lib.mjs';

const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['375', '320'];
const SEL = ['.hg2-skills', '.play-readout-toggle', '.hg2-pass', '.hg2-shoot', '.hg2-stick', '.hg2-coach', '.hg2-hint', '.hg2-bug'];
await needServer();
const browser = await launch();
const out = {};
try {
  for (const size of sizes) {
    const { ctx, page, errors } = await context(browser, size);
    await openLab(page, { seed: 'audit390' });
    await wait(400);
    await shot(page, `${size}-se-tipoff`);
    const boxes = {};
    for (const s of SEL) boxes[s] = await rect(page, s);
    const handler = await page.evaluate(() => {
      const q = window.__hg2;
      const p = q?.possession();
      const c = q?.canvas()?.getBoundingClientRect();
      if (!p || p.handler === null || !c) return null;
      const h = p.bodies[p.handler];
      const z = q.zoom();
      const f = q.screenOf(h.cx, h.cz, 0);
      const hd = q.screenOf(h.cx, h.cz, 7);
      return f && hd && { x: c.left + f.x * z, feetY: c.top + f.y * z, headY: c.top + hd.y * z, halfW: Math.max(6, f.s * 1.2) * z };
    });
    const covers = handler ? Object.entries(boxes).filter(([, b]) => b && b.x < handler.x + handler.halfW && handler.x - handler.halfW < b.x + b.w && b.y < handler.feetY && handler.headY < b.y + b.h).map(([s]) => s) : null;
    out[size] = { boxes, handler, controlsOverHandler: covers, errors };
    await ctx.close();
  }
} finally {
  await browser.close();
}
report('nba-se', out);
