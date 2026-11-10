// AUDIT ONLY: draw real star players exactly as the app does (CardArt.lookOf + portraitUrl for the
// card, drawBody with the mocap 'ready' clip at in-match sizes) and lay them side by side, so we can
// SEE whether Shaq / Curry / Rodman (etc.) are distinguishable. Dev server on 5206, localhost only.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
const SETS = {
  nba: ["Shaquille O'Neal", 'Stephen Curry', 'Dennis Rodman', 'Allen Iverson', 'Michael Jordan', 'LeBron James', 'Muggsy Bogues', 'Manute Bol', 'Nikola Jokić', 'Kareem Abdul-Jabbar', 'Yao Ming', 'Giannis Antetokounmpo'],
  nfl: ['Patrick Mahomes', 'Derrick Henry', 'Tom Brady', 'Aaron Donald', 'Jerry Rice', 'Travis Kelce', 'Barry Sanders', 'William Perry', 'Randy Moss', 'Ray Lewis', 'Justin Tucker', 'Tyreek Hill'],
  soccer: ['Lionel Messi', 'Erling Haaland', 'Cristiano Ronaldo', 'Pelé', 'Diego Maradona', 'Peter Crouch', 'Zlatan Ibrahimović', 'Ronaldinho', 'Paul Pogba', 'Manuel Neuer', 'Kylian Mbappé', "N'Golo Kanté"],
};
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const sport of ['nba', 'nfl', 'soccer']) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(`http://localhost:5206/?pixel=x&sport=${sport}&ns=inspect&relay=ws://localhost:7777`, { waitUntil: 'load' });
    const res = await page.evaluate(
      async ({ names, sport }) => {
        const { getPool } = await import('/src/ut/pool.ts');
        const { lookOf, portraitUrl } = await import('/src/ut/CardArt.tsx');
        const body = await import('/src/game/pixel/body.ts');
        const mocap = await import('/src/game/pixel/mocap.ts');
        await mocap.loadClips(['ready', 'run']);
        const pool = await getPool();
        const found = [];
        for (const n of names) {
          let best = null;
          for (const rc of pool.base.values()) if (rc.line.name === n && rc.line.kind === 'season' && (!best || rc.ovr > best.ovr)) best = rc;
          if (best) found.push(best);
        }
        // a sheet: row 1 card portraits (x4), row 2 in-match sprite ~34px (x3), row 3 ~22px (x3); also all in ONE kit (row 4)
        const W = 1380, H = 880;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = sport === 'nba' ? '#c98d55' : '#3f7d3a';
        g.fillRect(0, 0, W, H);
        g.font = 'bold 11px sans-serif';
        const info = [];
        const colW = Math.floor(W / found.length);
        const loads = found.map((rc) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = portraitUrl(rc.line, 'stand'); }));
        const imgs = await Promise.all(loads);
        found.forEach((rc, i) => {
          const x0 = i * colW;
          const im = imgs[i];
          if (im) g.drawImage(im, x0 + (colW - 72 * 1.5) / 2, 4, 72 * 1.5, 78 * 1.5);
          const look = lookOf(rc.line);
          const one = { ...look, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', helmet: '#1d428a', stripe: '#ffc72c', socks: sport === 'nfl' ? '#1d428a' : '#f2f2f2', pants: '#f2f2f2' };
          for (const [row, px, scale, lk] of [[0, 40, 3, look], [1, 24, 3, look], [2, 40, 3, one]]) {
            const j = mocap.mocapJoints('ready', 10, lk, { ground: 'clip' });
            const sp = body.drawBody(lk, j, { facing: 0.9, pitch: 0.45 }, Math.round((px * lk.ht) / 78));
            const y = 130 + row * 240;
            g.drawImage(sp.canvas, x0 + colW / 2 - sp.ax * scale, y + 220 - sp.ay * scale, sp.canvas.width * scale, sp.canvas.height * scale);
          }
          g.fillStyle = '#fff';
          g.fillText(rc.line.name.slice(0, 18), x0 + 4, 868);
          g.fillText(`${rc.line.ht}${sport === 'soccer' ? 'cm' : 'in'} ${rc.line.wt ?? '-'}lb #${rc.line.num ?? '-'}`, x0 + 4, 856);
          info.push({ name: rc.line.name, season: rc.line.season, team: rc.line.abbr, ovr: rc.ovr, ht: rc.line.ht, wt: rc.line.wt, num: rc.line.num, hair: look.hair, beard: !!look.beard, skin: look.skin, hairColor: look.hairColor, lookHt: look.ht, lookWt: look.wt });
        });
        return { url: c.toDataURL(), info, missing: names.filter((n) => !found.some((rc) => rc.line.name === n)) };
      },
      { names: SETS[sport], sport }
    );
    const buf = Buffer.from(res.url.split(',')[1], 'base64');
    require('fs').writeFileSync(OUT + `lineup-${sport}.png`, buf);
    console.log(sport, 'missing', res.missing);
    for (const r of res.info) console.log(' ', JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
