// Players QA (studio overhaul, players-1): Ultimate Team card faces at every size in use (H2, H3,
// L-4, M11, M12). Two passes per sport and viewport (393x852 with the Dynamic Island insets, 320x568):
//
// 1. Width sweep: the real `UtCard` mounted inside the app's scaled 390 frame, with the app's CSS,
//    for a fixture of tiers (bronze, silver, gold, rare, Hot Season, Legend, GOAT, Spotlight,
//    Standout, Landmark, Program where the sport has them), a 3-digit card (OVR 105, attributes 110)
//    and the longest names, at every width a screen uses (34 to 190).
// 2. Surfaces: the seeded club opened on Hub, Squad, Club grid, card detail, Store, Challenges, Pack
//    Tracker, Standouts, Sets, Evolutions, UT Draft and a pack reveal; every visible card measured.
//
// Per card: outer box (design px), the font size of each text in design px (CSS px / stage scale;
// aria-hidden text counted as decoration), truncation and overflow, team-badge ink contrast, running
// animations (document.getAnimations()), and the player art's head size from a pixel probe of the
// portrait. Badge contrast is also measured for every team colour pair in the sport's card file.
// The card detail adds: links that open a new tab, other games' brand names, the first row of
// key-attribute tiles against the action bar's top edge, and its label sizes.
//
// Last, at 393: the time to open Ultimate Team onto the club and fill its first row and every visible
// card with portraits, at 1x and 4x CPU (the portrait-fill and UT-first-open targets).
//
//   node scripts/qa/players-cards.mjs [--sport nba,nfl,soccer] [--vp 393,320] [--no-surfaces]
//        [--no-sweep] [--no-fill] [--tag before] [--out DIR]
import { appUrl, dismissDialogs, emit, listOf, needServer, newContext, openUt, opts, quantile, round, settle, shot, SPORTS, utFixture, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const vps = listOf(opts.vp, ['393', '320']);
const tag = String(opts.tag ?? 'before');
const WIDTHS = [34, 40, 44, 46, 52, 54, 56, 58, 62, 66, 70, 72, 74, 76, 80, 96, 104, 116, 132, 150, 170, 190];
const BRANDS = /2K|Madden|FIFA|EA ?(FC|Sports)|MUT|FUT|PES|eFootball|Konami/i;
// the reveal opens a gold pack first, so the Pack Tracker has a pull to show
const SURFACES = ['hub', 'squad', 'club', 'detail', 'store', 'market', 'reveal', 'tracker', 'sbc', 'standouts', 'sets', 'evolutions', 'draft'];

/** Runs in the page: measure every `.utc` under `root` (a selector). */
function measureCards({ root, brandSrc }) {
  const stage = document.querySelector('.stage');
  const k = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
  const brand = new RegExp(brandSrc, 'i');
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return false;
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    }
    return true;
  };
  const head = (img) => {
    if (!img || !img.complete || !img.naturalWidth) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const rowW = [];
    for (let y = 0; y < c.height; y++) {
      let a = -1,
        b = -1;
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 20) {
          if (a < 0) a = x;
          b = x;
        }
      rowW.push(a < 0 ? 0 : b - a + 1);
    }
    const top = rowW.findIndex((w) => w > 0);
    if (top < 0) return null;
    // the head: from the top down until a row is 1.25x wider than the median row so far (the neck and
    // shoulders), after at least three rows; its width is the median of that band's rows at 70% or
    // more of the band's widest (the round of the skull, not the crown or chin)
    const band = [];
    let y = top;
    for (; y < rowW.length; y++) {
      if (band.length >= 3) {
        const sorted = [...band].sort((a, b) => a - b);
        if (rowW[y] > 1.25 * sorted[Math.floor((sorted.length - 1) / 2)]) break;
      }
      band.push(rowW[y]);
    }
    const wide = band.filter((w) => w >= 0.7 * Math.max(...band)).sort((a, b) => a - b);
    const maxW = wide[Math.floor((wide.length - 1) / 2)] ?? 0;
    const s = img.getBoundingClientRect().height / img.naturalHeight / k;
    return { wPx: +(maxW * s).toFixed(1), hPx: +((y - top) * s).toFixed(1), figurePx: +((rowW.length - top - [...rowW].reverse().findIndex((w) => w > 0)) * s).toFixed(1) };
  };
  const running = document.getAnimations().filter((a) => a.playState === 'running');
  const cards = [...document.querySelectorAll(root + ' .utc')].filter((c) => shown(c) && Number.isFinite(parseFloat(getComputedStyle(c).getPropertyValue('--w'))));
  return cards.map((card) => {
    const r = card.getBoundingClientRect();
    const scale = r.width / card.offsetWidth || 1;
    const extra = scale / k;
    const w = parseFloat(getComputedStyle(card).getPropertyValue('--w'));
    const texts = [];
    for (const e of card.querySelectorAll('*')) {
      if (!shown(e)) continue;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const s = getComputedStyle(e);
      const er = e.getBoundingClientRect();
      texts.push({
        cls: (e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName.toLowerCase()) || e.tagName.toLowerCase(),
        text: e.textContent.trim().slice(0, 24),
        px: +(parseFloat(s.fontSize) * extra).toFixed(1),
        decor: !!e.closest('[aria-hidden="true"]'),
        truncated: e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(s.overflowX),
        escapes: er.left < r.left - 0.5 || er.right > r.right + 0.5 || er.top < r.top - 0.5 || er.bottom > r.bottom + 0.5,
      });
    }
    const pick = (c) => texts.find((t) => t.cls === c);
    const badge = card.querySelector('.utc-badge');
    let badgeContrast = null;
    if (badge && shown(badge)) {
      const fg = parse(getComputedStyle(badge).color);
      let bg = parse(getComputedStyle(badge).backgroundColor);
      if (!bg || bg.a < 0.5) bg = parse(getComputedStyle(card).getPropertyValue('--c1')) ?? null;
      if (fg && bg) badgeContrast = +cr(fg, bg).toFixed(2);
    }
    const anims = running.filter((a) => a.effect && a.effect.target && (a.effect.target === card || card.contains(a.effect.target))).length;
    const vis = texts.filter((t) => !t.decor);
    return {
      w,
      tier: [...card.classList].find((c) => c.startsWith('t-'))?.slice(2) ?? null,
      label: card.getAttribute('aria-label'),
      boxW: +(r.width / k).toFixed(2),
      boxH: +(r.height / k).toFixed(2),
      ovrPx: pick('utc-ovr')?.px ?? null,
      ovrText: pick('utc-ovr')?.text ?? null,
      posPx: pick('utc-pos')?.px ?? null,
      namePx: pick('utc-name')?.px ?? null,
      nameText: pick('utc-name')?.text ?? null,
      nameTruncated: !!pick('utc-name')?.truncated,
      minTextPx: vis.length ? Math.min(...vis.map((t) => t.px)) : null,
      minDecorPx: texts.some((t) => t.decor) ? Math.min(...texts.filter((t) => t.decor).map((t) => t.px)) : null,
      under10: vis.filter((t) => t.px < 10).map((t) => t.cls + ' ' + t.px),
      truncated: texts.filter((t) => t.truncated).map((t) => t.cls + ':' + t.text),
      escapes: texts.filter((t) => t.escapes).map((t) => t.cls + ':' + t.text),
      badgeContrast,
      animations: anims,
      head: head(card.querySelector('img.utc-px, canvas.utc-px')),
      brand: brand.test(card.textContent),
    };
  });
}

/** Runs in the page: the fixture cards for the sweep, mounted at every width inside the frame. */
async function mountSweep({ widths, sport }) {
  // the app's own React instance: the dev server's pre-bundled modules, found where main.tsx imports them
  const main = await (await fetch('/src/main.tsx')).text();
  const dep = (re) => (main.match(re) ?? [])[1];
  const R = await import(dep(/from "(\/node_modules\/\.vite\/deps\/react\.js\?v=\w+)"/));
  const React = R.default ?? R;
  const RD = await import(dep(/from "(\/node_modules\/\.vite\/deps\/react-dom_client\.js\?v=\w+)"/));
  const createRoot = RD.createRoot ?? RD.default.createRoot;
  const { UtCard } = await import('/src/ut/CardArt.tsx');
  const { getPool } = await import('/src/ut/pool.ts');
  const pool = await getPool();
  const all = [...pool.base.values()];
  const byTier = (t) => [...(Object.values(pool.buckets[t] ?? {}).flat() ?? []), ...all.filter((c) => c.tier === t)].sort((a, b) => b.ovr - a.ovr)[0];
  const tiers = ['bronze', 'silver', 'gold', 'promo', 'legend', 'goat', 'spotlight', 'standout', 'landmark', 'program'];
  const fx = [];
  for (const t of tiers) {
    const c = byTier(t);
    if (c) fx.push({ id: t, rc: c });
  }
  const rare = all.find((c) => c.tier === 'gold' && c.line.rare);
  if (rare) fx.push({ id: 'rare-gold', rc: rare });
  // 3-digit: OVR 105 and attributes 110 (what packs' Spotlight and GOAT cards reach)
  const top = byTier('goat') ?? byTier('legend') ?? all[0];
  fx.push({ id: '3-digit', rc: { ...top, ovr: 105, face: (top.face ?? top.key).map(([c, n]) => [c, n, 110]), key: top.key.map(([c, n]) => [c, n, 110]) } });
  // the longest names the audits found
  for (const n of ['Giannis Antetokounmpo', 'Shai Gilgeous-Alexander', 'Pedro Rebocho']) {
    const c = all.filter((x) => x.line.name === n).sort((a, b) => b.ovr - a.ovr)[0];
    if (c) fx.push({ id: 'long:' + n, rc: c });
  }
  const stage = document.querySelector('.stage');
  let host = document.getElementById('players-sweep');
  if (!host) {
    host = document.createElement('div');
    host.id = 'players-sweep';
    host.style.cssText = 'position:absolute;inset:0;z-index:9999;overflow:auto;background:#0b1f2a;padding:6px;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start';
    stage.appendChild(host);
  }
  const root = createRoot(host);
  window.__sweepRoot = root;
  root.render(
    React.createElement(
      React.Fragment,
      null,
      widths.flatMap((w) => fx.map((f) => React.createElement('span', { key: w + f.id, 'data-fx': f.id, 'data-w': w, style: { display: 'inline-block' } }, React.createElement(UtCard, { rc: f.rc, w, attrs: w >= 120 }))))
    )
  );
  return fx.map((f) => f.id);
}

/** Runs in the page: every team colour pair in the card file, one real card each, mounted at w=44
 * in the frame; each badge's ink measured against its own background (or the team colour). */
async function badgeSweep() {
  const main = await (await fetch('/src/main.tsx')).text();
  const dep = (re) => (main.match(re) ?? [])[1];
  const R = await import(dep(/from "(\/node_modules\/\.vite\/deps\/react\.js\?v=\w+)"/));
  const React = R.default ?? R;
  const RD = await import(dep(/from "(\/node_modules\/\.vite\/deps\/react-dom_client\.js\?v=\w+)"/));
  const createRoot = RD.createRoot ?? RD.default.createRoot;
  const { UtCard } = await import('/src/ut/CardArt.tsx');
  const { getPool } = await import('/src/ut/pool.ts');
  const pool = await getPool();
  const seen = new Map();
  for (const rc of pool.base.values()) {
    const k = rc.line.abbr + '|' + rc.line.c1 + '|' + rc.line.c2;
    if (!seen.has(k)) seen.set(k, rc);
  }
  const teams = [...seen.values()];
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0;z-index:9999;overflow:hidden;display:flex;flex-wrap:wrap;gap:2px;background:#0b1f2a';
  document.querySelector('.stage').appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(React.Fragment, null, teams.map((rc, i) => React.createElement('span', { key: i, 'data-i': i }, React.createElement(UtCard, { rc, w: 44 })))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hexRgb = (h) => {
    const x = String(h).trim().replace('#', '');
    return x.length >= 6 ? { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const out = [];
  for (const span of host.children) {
    const rc = teams[+span.dataset.i];
    const badge = span.querySelector('.utc-badge');
    if (!badge) continue;
    const fg = parse(getComputedStyle(badge).color);
    let bg = parse(getComputedStyle(badge).backgroundColor);
    if (!bg || bg.a < 0.5) bg = hexRgb(rc.line.c1);
    if (!fg || !bg) continue;
    const a = lum(fg),
      b = lum(bg);
    out.push({ abbr: rc.line.abbr, team: rc.line.teamName, c1: rc.line.c1, contrast: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2) });
  }
  root.unmount();
  host.remove();
  return out;
}

async function waitArt(page) {
  // small cards' portraits come in a few a frame: give them time to arrive
  await page
    .waitForFunction(() => [...document.querySelectorAll('.utc')].every((c) => c.querySelector('img.utc-px, canvas.utc-px')), null, { timeout: 6000 })
    .catch(() => {});
  await settle(page, 300);
}

const summarise = (cards) => {
  const ws = [...new Set(cards.map((c) => c.w))].sort((a, b) => a - b);
  const byW = {};
  for (const w of ws) {
    const cs = cards.filter((c) => c.w === w);
    const min = (k) => {
      const xs = cs.map((c) => c[k]).filter((x) => x !== null && x !== undefined);
      return xs.length ? round(Math.min(...xs), 1) : null;
    };
    byW[w] = {
      cards: cs.length,
      boxW: round(quantile(cs.map((c) => c.boxW), 0.5), 2),
      boxH: round(quantile(cs.map((c) => c.boxH), 0.5), 2),
      ovrPxMin: min('ovrPx'),
      posPxMin: min('posPx'),
      namePxMin: min('namePx'),
      minTextPx: min('minTextPx'),
      minDecorPx: min('minDecorPx'),
      under10: [...new Set(cs.flatMap((c) => c.under10.map((x) => x.split(' ')[0])))],
      truncated: cs.filter((c) => c.truncated.length).length,
      overflow: cs.filter((c) => c.escapes.length).length,
      animations: cs.reduce((n, c) => n + c.animations, 0),
      headWMin: (() => {
        const xs = cs.map((c) => c.head?.wPx).filter((x) => x !== null && x !== undefined);
        return xs.length ? round(Math.min(...xs), 1) : null;
      })(),
      figureHMin: (() => {
        const xs = cs.map((c) => c.head?.figurePx).filter((x) => x !== null && x !== undefined);
        return xs.length ? round(Math.min(...xs), 1) : null;
      })(),
      badgeContrastMin: min('badgeContrast'),
    };
  }
  return byW;
};

await needServer();
const results = await withBrowser(async (browser) => {
  const out = [];
  for (const sport of sports)
    for (const vp of vps) {
      const context = await newContext(browser, vp, { dpr: 1, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      const errors = watchErrors(page);
      await utFixture(page, sport);
      const res = { sport, vp, sweep: null, longNames: null, badges: null, surfaces: {}, detail: null };
      if (!opts['no-sweep']) {
        await page.goto(appUrl({ sport }), { waitUntil: 'domcontentloaded' });
        await page.locator('nav.tabs').waitFor({ timeout: 60000 });
        await dismissDialogs(page);
        const ids = await page.evaluate(mountSweep, { widths: WIDTHS, sport });
        await waitArt(page);
        await page.waitForTimeout(1500);
        const cards = await page.evaluate(measureCards, { root: '#players-sweep', brandSrc: BRANDS.source });
        // a sheet per size band, looked at by eye
        for (const [band, lo, hi] of [
          ['xs', 34, 58],
          ['md', 62, 104],
          ['lg', 116, 190],
        ]) {
          await page.evaluate(
            ({ lo, hi }) => {
              for (const e of document.querySelectorAll('#players-sweep > span')) e.style.display = +e.dataset.w >= lo && +e.dataset.w <= hi ? 'inline-block' : 'none';
              document.getElementById('players-sweep').scrollTop = 0;
            },
            { lo, hi }
          );
          await settle(page, 200);
          await shot(page, `${tag}-cards-widths-${sport}-${vp}-${band}`);
        }
        res.sweep = { fixtures: ids, byWidth: summarise(cards) };
        res.longNames = cards.filter((c) => /Antetokounmpo|Gilgeous|Rebocho/.test(c.label ?? '') && [44, 80, 170].includes(c.w)).map((c) => ({ w: c.w, name: c.nameText, truncated: c.nameTruncated, namePx: c.namePx }));
        res.threeDigit = cards.filter((c) => c.ovrText === '105' && [44, 80, 150, 190].includes(c.w)).map((c) => ({ w: c.w, ovrPx: c.ovrPx, overflow: c.escapes, truncated: c.truncated }));
        await page.evaluate(() => {
          window.__sweepRoot?.unmount();
          document.getElementById('players-sweep')?.remove();
        });
        const sorted = (await page.evaluate(badgeSweep)).sort((a, b) => a.contrast - b.contrast);
        res.badges = { teams: sorted.length, under45: sorted.filter((p) => p.contrast < 4.5).length, under3: sorted.filter((p) => p.contrast < 3).length, worst: sorted.slice(0, 10).map((p) => `${p.abbr} ${p.contrast}`), min: sorted[0]?.contrast ?? null };
      }
      if (!opts['no-surfaces'])
        for (const s of SURFACES) {
          try {
            await page.goto(appUrl({ sport }), { waitUntil: 'domcontentloaded' });
            await dismissDialogs(page, 3);
            if (s === 'detail') {
              await openUt(page, 'club');
              await dismissDialogs(page, 3);
              await page.locator('.utc').first().click();
              await page.locator('.ut-detail .utc.big').waitFor({ timeout: 15000 });
            } else if (s === 'reveal') {
              await openUt(page, 'store');
              await dismissDialogs(page, 3);
              await page.getByRole('button', { name: /Open your Gold Pack/ }).first().click();
              // through the reveal to the cards
              for (let i = 0; i < 12 && !(await page.locator('.ut-open-screen .utc').count()); i++) {
                await page.waitForTimeout(700);
                const skip = page.getByRole('button', { name: /^SKIP$/ });
                if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
                else await page.mouse.click(10, 200).catch(() => {});
              }
              await page.waitForTimeout(1200);
            } else if (s === 'market') {
              await openUt(page, 'store');
              await dismissDialogs(page, 3);
              await page.getByRole('button', { name: /^SCOUT MARKET$/ }).first().click();
              await settle(page, 600);
            } else {
              await openUt(page, s);
              await dismissDialogs(page, 3);
            }
            await waitArt(page);
            const cards = await page.evaluate(measureCards, { root: 'body', brandSrc: BRANDS.source });
            const file = await shot(page, `${tag}-cards-${sport}-${vp}-${s}`);
            res.surfaces[s] = { reached: true, widths: [...new Set(cards.map((c) => c.w))].sort((a, b) => a - b), byWidth: summarise(cards), shot: file };
            if (s === 'detail') {
              res.detail = await page.evaluate(
                ({ brandSrc }) => {
                  const stage = document.querySelector('.stage');
                  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
                  const d = document.querySelector('.ut-detail');
                  const sheet = d.closest('[role=dialog]') ?? d;
                  const keys = [...d.querySelectorAll('.ut-keys .ut-key')];
                  const firstRowBottom = keys.length ? Math.max(...keys.filter((e) => Math.abs(e.getBoundingClientRect().top - keys[0].getBoundingClientRect().top) < 2).map((e) => e.getBoundingClientRect().bottom)) : null;
                  const bar = d.querySelector('.ut-detail-btns');
                  const barTop = bar ? bar.getBoundingClientRect().top : null;
                  const labels = keys.map((e) => e.querySelector('i')).filter(Boolean);
                  return {
                    cardW: parseFloat(getComputedStyle(d.querySelector('.utc.big')).getPropertyValue('--w')),
                    targetLinks: sheet.querySelectorAll('a[target]').length,
                    externalLinks: [...sheet.querySelectorAll('a[href]')].filter((a) => /^https?:/.test(a.getAttribute('href'))).length,
                    brandNames: (sheet.innerText.match(new RegExp(brandSrc, 'gi')) ?? []).slice(0, 6),
                    keyTiles: keys.length,
                    firstRowBottom: firstRowBottom === null ? null : Math.round((firstRowBottom - stage.getBoundingClientRect().top) / k),
                    barTop: barTop === null ? null : Math.round((barTop - stage.getBoundingClientRect().top) / k),
                    viewportBottom: Math.round(stage.offsetHeight),
                    firstRowVisible: firstRowBottom !== null && firstRowBottom <= Math.min(barTop ?? innerHeight, innerHeight),
                    labelPxMin: labels.length ? Math.min(...labels.map((e) => parseFloat(getComputedStyle(e).fontSize))) : null,
                  };
                },
                { brandSrc: BRANDS.source }
              );
            }
          } catch (e) {
            res.surfaces[s] = { reached: false, error: String(e.message).split('\n')[0].slice(0, 160) };
          }
        }
      // opening Ultimate Team and filling the club's portraits, at 1x and 4x CPU (393 only)
      if (!opts['no-fill'] && vp === vps[0]) {
        res.fill = {};
        for (const rate of [1, 4]) {
          await page.goto(appUrl({ sport }), { waitUntil: 'domcontentloaded' });
          await page.locator('nav.tabs').waitFor({ timeout: 60000 });
          await dismissDialogs(page, 3);
          await page.evaluate(async () => {
            const { rememberUtReturn } = await import('/src/ut/return-view.ts');
            rememberUtReturn('club');
          });
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          const t = await page.evaluate(
            () =>
              new Promise((done) => {
                const t0 = performance.now();
                let open = null,
                  row = null;
                document.querySelector('.tab-ut').click();
                const tick = () => {
                  const now = performance.now() - t0;
                  if (open === null && document.querySelector('.ut-tabs') && !document.querySelector('.ut-loading')) open = now;
                  const cards = [...document.querySelectorAll('.ut-grid .utc, .utc')];
                  if (open !== null && cards.length) {
                    const top = cards[0].getBoundingClientRect().top;
                    const first = cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2);
                    if (row === null && first.every((c) => c.querySelector('img.utc-px'))) row = now;
                    const visible = cards.filter((c) => c.getBoundingClientRect().top < innerHeight);
                    if (row !== null && visible.every((c) => c.querySelector('img.utc-px'))) return done({ utOpenMs: Math.round(open), firstRowArtMs: Math.round(row - open), visibleArtMs: Math.round(now - open), cards: cards.length });
                  }
                  if (now > 60000) return done({ utOpenMs: open, firstRowArtMs: row, visibleArtMs: null, cards: cards.length, timeout: true });
                  requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
              })
          );
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
          await cdp.detach().catch(() => {});
          res.fill[rate + 'x'] = t;
        }
      }
      res.pageErrors = errors.slice(0, 5);
      out.push(res);
      await context.close();
    }
  return out;
});
emit('players-cards-' + tag, { widths: WIDTHS, results });
