// AUDIT ONLY: jersey number legibility by sprite size and facing (body.ts number(): 4x7 font only when
// the chest is >=13 px wide and the number has <=2 digits; columns dropped as the chest turns).
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
  await page.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  await page.goto('http://localhost:5206/?pixel=x&sport=nba&ns=inspect&relay=ws://localhost:7777', { waitUntil: 'load' });
  const url = await page.evaluate(async () => {
    const body = await import('/src/game/pixel/body.ts');
    const P = await import('/src/game/pixel/poses.ts');
    const nums = [23, 80, 88, 12, 99, 7];
    const facings = [[Math.PI / 2, 'front'], [1.2, 'card 1.2'], [0.9, '0.9'], [0.6, '0.6'], [0.35, '0.35']];
    const sizes = [26, 40, 56, 80];
    const sc = 3, cw = 92, rh = 100;
    const c = document.createElement('canvas');
    c.width = 120 + facings.length * sizes.length * 0 + nums.length * cw;
    c.height = facings.length * sizes.length * rh / 2 + 40;
    c.height = sizes.length * facings.length * 60 + 40;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#c98d55'; g.fillRect(0, 0, c.width, c.height);
    g.font = 'bold 11px sans-serif'; g.fillStyle = '#000';
    let row = 0;
    for (const px of sizes) for (const [f, lab] of facings) {
      const y = 20 + row * 60;
      g.fillStyle = '#000'; g.fillText(px + 'px ' + lab, 4, y + 30);
      nums.forEach((n, i) => {
        const look = { sport: 'nba', ht: 78, wt: 215, num: n, hair: 0, skin: body.DEFAULT_SKIN, hairColor: body.DEFAULT_HAIR, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
        const sp = body.drawBody(look, P.idle(0.15), { facing: f, pitch: 0.3 }, px);
        // crop the chest region and scale so the number is visible
        const k = px >= 56 ? 1.2 : 2;
        const top = sp.top, hh = Math.round(px * 0.55); const kk = 52 / hh; g.drawImage(sp.canvas, 0, top, sp.canvas.width, hh, 110 + i * cw, y - 2, sp.canvas.width * kk, hh * kk);
      });
      row++;
    }
    return c.toDataURL();
  });
  require('fs').writeFileSync(OUT + 'numbers-legibility.png', Buffer.from(url.split(',')[1], 'base64'));
  await browser.close();
})();
