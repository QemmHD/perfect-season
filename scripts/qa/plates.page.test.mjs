// Claude (studio overhaul, shell-3, 2026-11-16): the status plate, the header plates and the H1
// card-detail bar in a real Chromium, on a static page built from the real CSS (src/shell/plates.css,
// the H1 rules of src/ut/nav.css and the sheet rules of src/styles.css). No app, no network: every
// request is aborted. Runs once (the NBA pass of `npm test`) and only where Playwright resolves.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deltaE2000 } from './edge-lib.mjs';

const req = createRequire(process.env.PS_QA_PACKAGE_JSON || import.meta.url);
let chromium = null;
try {
  ({ chromium } = req('playwright'));
} catch {
  chromium = null;
}
const run = !!chromium && !process.env.PS_SPORT;

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
/** The first rule whose selector list is exactly `selector`, as CSS text. */
const ruleOf = (css, selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)' + esc + '\\s*\\{[^}]*\\}'));
  if (!m) throw Error('no rule ' + selector);
  return m[0];
};
const plates = read('src/shell/plates.css');
const styles = read('src/styles.css');
const nav = read('src/ut/nav.css');
const tokens = Object.fromEntries([...plates.matchAll(/(--plate-[a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const rgbOf = (hex) => 'rgb(' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';
// index.html's own inline <style> (html/body and the status plate's base) comes first, as in the app
const indexHtml = read('index.html');
const headCss = indexHtml.slice(indexHtml.indexOf('<style>') + 7, indexHtml.indexOf('</style>'));
const plateTag = indexHtml.match(/<div class="status-plate"[^>]*><\/div>/)[0];

// the sheet as the app builds it: .scrim.bottom > .sheet.bottom > .ut-detail > … .btnrow.ut-detail-btns
const sheetCss = (h1) =>
  [ruleOf(styles, '.scrim'), ruleOf(styles, '.scrim.bottom'), ruleOf(styles, '.sheet'), ruleOf(styles, '.sheet.bottom'), ruleOf(styles, '.ut-detail'), ruleOf(nav, '.ut-detail-btns'), h1 ? ruleOf(nav, '.sheet.bottom .ut-detail-btns') : ''].join('\n');

const page0 = (body, extraCss = '') => `<!doctype html><html style="--ps-inset-top:59px"><head><style>
${headCss}
:root{--bg:#04121a;--panel:#0a1f2a;--line:#16323f}
#root{position:fixed;inset:0}
.stage{position:absolute;left:0;top:0;width:393px;height:852px;overflow:hidden;--sat:81px;--sab:34px;--inset-top:59px}
.screen{position:absolute;inset:0;display:flex;flex-direction:column;box-sizing:border-box;padding-top:var(--sat);padding-bottom:var(--sab);background:#071c24}
.topbar{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 16px;flex-shrink:0;color:#fff}
.shell{position:absolute;inset:0;background:#0c3340}
.shell-top{position:absolute;left:0;right:0;top:0;padding-top:var(--sat);z-index:2}
.shell-views{position:absolute;left:0;right:0;top:calc(var(--sat) + 56px);bottom:0}
.btnrow{display:flex}
${plates}
${extraCss}
</style></head><body>${plateTag}<div id="root"><div class="stage">${body}</div></div></body></html>`;

const mainShell = '<div class="shell"><div class="shell-top"><div class="topbar"><span>LEVEL 19</span></div></div><div class="shell-views"><p style="margin:0">first row</p></div></div>';
const utScreen = (extra = '') => `<div class="screen ut"><div class="topbar ut-top"><span>CLUB</span></div><div class="ut-body" style="flex:1">body</div>${extra}</div>`;

describe.skipIf(!run)('status plate and header plates (real Chromium, static page)', () => {
  let browser, page, rmPage;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await context.route('**/*', (r) => r.abort());
    page = await context.newPage();
    const rm = await browser.newContext({ viewport: { width: 393, height: 852 }, reducedMotion: 'reduce' });
    await rm.route('**/*', (r) => r.abort());
    rmPage = await rm.newPage();
  });
  afterAll(async () => {
    await browser?.close();
  });
  const plate = (p = page) =>
    p.evaluate(() => {
      const e = document.querySelector('.status-plate'),
        s = getComputedStyle(e),
        r = e.getBoundingClientRect();
      return { display: s.display, top: r.top, height: r.height, color: s.backgroundColor, z: s.zIndex, pe: s.pointerEvents, transition: s.transitionDuration };
    });
  const hits = (xs, ys) =>
    page.evaluate(
      ([xs, ys]) =>
        ys.flatMap((y) =>
          xs.map((x) => {
            const e = document.elementFromPoint(x, y);
            return e ? e.className : null;
          })
        ),
      [xs, ys]
    );
  const set = async (body) => {
    await page.setContent(page0(body));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };

  it('main screens: the plate is the inset tall at y = 0 in --plate-top, and the header is opaque from y = 0', async () => {
    await set(mainShell);
    const p = await plate();
    expect(p).toMatchObject({ display: 'block', top: 0, height: 59, color: rgbOf(tokens['--plate-top']), z: '2', pe: 'none' });
    // probes at y = 2, inset + edge − 2 and the header bottom − 2 land on the header (the plate is pointer-events: none)
    for (const c of await hits([20, 195, 370], [2, 79, 135])) expect(c).toMatch(/shell-top|topbar/);
    const hdr = await page.evaluate(() => {
      const h = document.querySelector('.shell-top').getBoundingClientRect(),
        v = document.querySelector('.shell-views').getBoundingClientRect();
      return { bottom: h.bottom, first: v.top, bg: getComputedStyle(document.querySelector('.shell-top')).backgroundImage };
    });
    expect(Math.abs(hdr.first - hdr.bottom)).toBeLessThanOrEqual(1);
    expect(hdr.bg).toContain(rgbOf(tokens['--plate-top']));
  });

  it('UT: the plate takes the UT plate top colour, and the UT header plate reaches y = 0 with no seam', async () => {
    await set(utScreen());
    expect((await plate()).color).toBe(rgbOf(tokens['--plate-top-ut']));
    for (const c of await hits([20, 195, 370], [2, 79, 135])) expect(c).toMatch(/ut-top/);
    // no seam across the inset line: the status plate above, the header's ::before below (CIEDE2000 ≤ 2)
    const px = await page.screenshot({ clip: { x: 0, y: 56, width: 393, height: 6 } });
    const cols = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return [1, 4].map((y) => [20, 195, 370].map((x) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]));
    }, px.toString('base64'));
    // y = 57 (status plate) against y = 60 (the header plate, just starting its fade to --plate-bot)
    for (let i = 0; i < 3; i++) expect(deltaE2000(cols[0][i], cols[1][i])).toBeLessThanOrEqual(2);
  });

  it('under an open sheet the plate is transparent (the band shows the scrim), and comes back while it closes', async () => {
    await set(utScreen('<div class="scrim bottom"></div>'));
    expect((await plate()).color).toBe('rgba(0, 0, 0, 0)');
    await set(utScreen('<div class="scrim bottom closing"></div>'));
    expect((await plate()).color).toBe(rgbOf(tokens['--plate-top-ut']));
  });

  it('screens without a header get the app background, and the immersive screens get no plate at all', async () => {
    await set('<div class="screen draft"></div>');
    expect((await plate()).color).toBe('rgb(4, 18, 26)');
    for (const cls of ['ut-open-screen', 'splash', 'vs-splash', 'screen reveal']) {
      await set(mainShell + `<div class="${cls}"></div>`);
      expect((await plate()).display, cls).toBe('none');
    }
    await set(mainShell + '<div class="screen"></div>');
    expect((await plate()).display).toBe('block');
  });

  it('adds no animation under reduced motion', async () => {
    await rmPage.setContent(page0(mainShell));
    expect((await plate(rmPage)).transition).toBe('0s');
    expect((await plate()).transition).toBe('0.22s');
  });
});

describe.skipIf(!run)('H1: the card-detail bar in a bottom sheet (real Chromium, static page)', () => {
  let browser, page;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await context.route('**/*', (r) => r.abort());
    page = await context.newPage();
  });
  afterAll(async () => {
    await browser?.close();
  });
  const sheet = '<div class="scrim bottom"><div class="sheet bottom" role="dialog"><div class="ut-detail"><div style="height:1400px">stats</div><div class="btnrow ut-detail-btns"><button style="height:44px">CLOSE</button></div></div></div></div>';
  const measure = (sab) =>
    page.evaluate(async (sab) => {
      document.querySelector('.stage').style.setProperty('--sab', sab + 'px');
      const s = document.querySelector('.sheet'),
        bar = document.querySelector('.ut-detail-btns');
      const out = [];
      for (const at of [0, 0.5, 1]) {
        s.scrollTop = (s.scrollHeight - s.clientHeight) * at;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const sr = s.getBoundingClientRect(),
          br = bar.getBoundingClientRect();
        const hit = document.elementFromPoint(sr.left + sr.width / 2, sr.bottom - 4);
        out.push({ gap: Math.round((sr.bottom - br.bottom) * 10) / 10, onBar: !!hit && bar.contains(hit) });
      }
      return out;
    }, sab);

  it('sits flush with the sheet bottom at its top, middle and end on a phone with a home indicator', async () => {
    await page.setContent(page0(sheet, sheetCss(true)));
    for (const r of await measure(34)) {
      expect(Math.abs(r.gap)).toBeLessThanOrEqual(1);
      expect(r.onBar).toBe(true);
    }
  });

  it('is unchanged where there is no home indicator (sab 0)', async () => {
    await page.setContent(page0(sheet, sheetCss(true)));
    const fixed = await measure(0);
    await page.setContent(page0(sheet, sheetCss(false)));
    expect(await measure(0)).toEqual(fixed);
  });

  it('floated 34 pt above the edge without the rule (the bug this guards)', async () => {
    await page.setContent(page0(sheet, sheetCss(false)));
    const [top] = await measure(34);
    expect(top.gap).toBeGreaterThan(30);
    expect(top.onBar).toBe(false);
  });
});
