// AUDIT ONLY: measure how much the drawn silhouette actually changes with weight/height (the only
// identity data the renderer uses). Same kit, same pose, same view; report bbox and widest torso run.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  await page.goto('http://localhost:5206/?pixel=x&sport=nba&ns=inspect&relay=ws://localhost:7777', { waitUntil: 'load' });
  const out = await page.evaluate(async () => {
    const body = await import('/src/game/pixel/body.ts');
    const mocap = await import('/src/game/pixel/mocap.ts');
    await mocap.loadClips(['ready', 'run']);
    const base = { sport: 'nba', num: 30, hair: 0, skin: body.DEFAULT_SKIN, hairColor: body.DEFAULT_HAIR, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
    const who = [
      ['Curry 74/185', 74, 185],
      ['Shaq 85/325', 85, 325],
      ['Rodman 79/210', 79, 210],
      ['Manute 91/200', 91, 200],
      ['Yao 90/310', 90, 310],
      ['Bogues 63/136', 63, 136],
      ['Jokic 83/284', 83, 284],
      ['Giannis 83/243', 83, 243],
    ];
    const res = [];
    for (const [label, ht, wt] of who) {
      for (const pxAt78 of [24, 40, 60]) {
        const look = { ...base, ht, wt };
        const px = Math.round((pxAt78 * ht) / 78);
        const sp = body.drawBody(look, mocap.mocapJoints('ready', 10, look, { ground: 'clip' }), { facing: Math.PI / 2, pitch: 0.45 }, px);
        const c = sp.canvas;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
        const rowW = [];
        for (let y = 0; y < c.height; y++) {
          let a = -1, b = -1;
          for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { if (a < 0) a = x; b = x; }
          rowW.push(a < 0 ? 0 : b - a + 1);
          if (a >= 0) { minx = Math.min(minx, a); maxx = Math.max(maxx, b); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
        }
        const h = maxy - miny + 1;
        // torso band: 30%-45% down from the top of the figure (chest to waist), front-on
        const band = rowW.slice(miny + Math.round(h * 0.3), miny + Math.round(h * 0.45));
        // count skin-coloured head pixels (top 15%)
        res.push({ label, pxAt78, px, bboxW: maxx - minx + 1, bboxH: h, torsoW: Math.max(...band) });
      }
    }
    return res;
  });
  for (const r of out) console.log(JSON.stringify(r));
  await browser.close();
})();
