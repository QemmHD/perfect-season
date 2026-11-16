// Claude (studio overhaul, shell-1, 2026-11-10): iPhone top-edge and screen-fit measurement for QA.
// Every number is in screen points (CSS px of the viewport, which equal iOS points) unless it says
// "frame px" (the app's 390-wide design frame). Pure helpers at the top have unit tests in
// edge-lib.test.mjs; the page helpers take a Playwright page and never import Playwright.
import fs from 'node:fs';
import path from 'node:path';

/**
 * The nine phones the edge work is checked on: [top, right, bottom, left] safe-area insets in pt.
 * 420×912's top inset is an estimate until it is read on a device (Settings → diagnostics).
 */
export const DEVICES = {
  393: { w: 393, h: 852, insets: [59, 0, 34, 0], name: 'iPhone 15/16 Pro (the owner’s phone)' },
  402: { w: 402, h: 874, insets: [62, 0, 34, 0], name: 'iPhone 16/17 Pro' },
  420: { w: 420, h: 912, insets: [68, 0, 34, 0], name: 'iPhone Air (top inset to confirm)' },
  440: { w: 440, h: 956, insets: [62, 0, 34, 0], name: 'iPhone 16/17 Pro Max' },
  430: { w: 430, h: 932, insets: [59, 0, 34, 0], name: 'iPhone 15 Pro Max / 16 Plus' },
  390: { w: 390, h: 844, insets: [47, 0, 34, 0], name: 'iPhone 12–14 (notch)' },
  '375x812': { w: 375, h: 812, insets: [50, 0, 34, 0], name: 'iPhone X–13 mini (notch)' },
  375: { w: 375, h: 667, insets: [20, 0, 0, 0], name: 'iPhone SE 2/3' },
  320: { w: 320, h: 568, insets: [20, 0, 0, 0], name: 'iPhone SE (1st gen), regression only' },
};
export const DEVICE_IDS = ['393', '402', '420', '440', '430', '390', '375x812', '375', '320'];
export const DESIGN_W = 390;

/**
 * The clearance below the status bar that iOS 26 blurs and dims (audit-ut-ui §1): 22 pt on island
 * phones, 19 on a 47-pt notch, 8 under a 20-pt status bar. Mirrors `topEdge` in src/stage-layout.ts
 * (added by shell-2); edge-lib.test.mjs holds the table both must give.
 */
export const edgeOf = (insetTop) => Math.min(22, Math.round(Math.max(0, insetTop) * 0.4));

/**
 * How far below the inset text must start to be clear of the band's fade, in pt. The simulated band
 * is opaque to inset + 12 and fades out at inset + 26 on island phones, so text between inset + edge
 * and inset + 26 still reads slightly soft.
 */
export const TEXT_CLEAR = { 59: 26, 62: 26, 68: 26, 50: 24, 47: 24, 20: 10 };
export const textClearOf = (insetTop) => TEXT_CLEAR[insetTop] ?? (insetTop >= 55 ? 26 : insetTop >= 40 ? 24 : insetTop > 0 ? 10 : 0);

/** Stage fit classes (src/stage-layout.ts fitFor) and Home's own classes (src/ui/Pages.tsx HomePage). */
export const fitFor = (content) => (content < 650 ? 'compact' : content < 730 ? 'tight' : content < 800 ? 'normal' : 'roomy');
export const homeClassFor = (content) => [content < 620 ? 'short' : content < 730 ? 'snug' : '', content >= 816 ? 'tall' : ''].filter(Boolean).join(' ');

/**
 * What the stage computes for a phone (stageBox's phone branch, portrait): frame scale, frame height,
 * insets and the room between them in frame px, with today's classes and the room left after the edge.
 */
export function expectedLayout(device) {
  const d = typeof device === 'string' || typeof device === 'number' ? DEVICES[device] : device;
  const [t, , b] = d.insets;
  const k = d.w / DESIGN_W,
    h = d.h / k,
    sat = Math.min(t, d.h) / k,
    sab = Math.min(b, Math.max(0, d.h - t)) / k,
    room = Math.max(0, h - sat - sab),
    edge = edgeOf(t) / k;
  const r1 = (n) => Math.round(n * 10) / 10;
  return { k: +k.toFixed(5), h: r1(h), sat: r1(sat), sab: r1(sab), room: r1(room), fit: fitFor(room), homeClass: homeClassFor(room), edge: r1(edge), roomAfterEdge: r1(room - edge), marginToSnug: r1(room - edge - 730) };
}

const settleFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
export async function settle(page, ms = 400) {
  await page.waitForTimeout(ms);
  await settleFrames(page);
}

/** Close whatever dialogs are open (Escape is the shared Sheet's close key). */
export async function closeDialogs(page) {
  for (let i = 0; i < 4 && (await page.locator('[role=dialog]').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
  }
}

/**
 * The owner's iOS 26 status-bar effect, simulated for screenshots only (audit edge.mjs): a 2.6 px
 * blur and 0.66 brightness from the top to inset + 26 pt, fading out from inset + 12. It ignores
 * pointer events, so it never changes what a measurement or a tap hits.
 */
export async function simulateBand(page, insetTop) {
  await page.evaluate((t) => {
    document.getElementById('__ps-band')?.remove();
    const d = document.createElement('div');
    d.id = '__ps-band';
    const mask = `linear-gradient(180deg,#000 0,#000 ${t + 12}px,transparent ${t + 26}px)`;
    Object.assign(d.style, { position: 'fixed', left: '0', right: '0', top: '0', height: t + 26 + 'px', zIndex: '2147483647', pointerEvents: 'none', backdropFilter: 'blur(2.6px) brightness(.66)', webkitBackdropFilter: 'blur(2.6px) brightness(.66)', maskImage: mask, webkitMaskImage: mask });
    document.documentElement.append(d);
  }, insetTop);
}
export const clearBand = (page) => page.evaluate(() => document.getElementById('__ps-band')?.remove());

/**
 * index.html's standalone height rule without its media query: CDP cannot emulate `display-mode`,
 * so Chromium never applies it (audit L7). The simulated inset stands in for env().
 */
export async function forceStandaloneRule(page, insetTop) {
  await page.evaluate((t) => {
    let s = document.getElementById('__ps-standalone');
    if (!s) document.head.append((s = Object.assign(document.createElement('style'), { id: '__ps-standalone' })));
    s.textContent = `html{min-height:min(100lvh, calc(100% + ${t}px))}`;
    window.dispatchEvent(new Event('resize'));
  }, insetTop);
}

/** A custom property's resolved length inside an element (a probe child, so env() and var() resolve). */
export const resolvedLength = (page, selector, prop) =>
  page.evaluate(
    ([selector, prop]) => {
      const host = document.querySelector(selector);
      if (!host) return null;
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;left:0;top:0;width:0;visibility:hidden;height:var(${prop},0px)`;
      host.append(probe);
      const h = probe.getBoundingClientRect().height;
      probe.remove();
      return Math.round(h * 100) / 100;
    },
    [selector, prop]
  );

/**
 * The match screens read the real env() insets, which Chromium reports as 0, so their HUD would sit
 * 59 pt higher than on the phone. When `.arcade-full` resolves no top inset, give it the device's raw
 * insets (what env() is on a real iPhone today). Returns how the insets were obtained.
 */
export async function arcadeInsets(page, insets) {
  const [t, r, b, l] = insets;
  const before = await resolvedLength(page, '.arcade-full', '--sat');
  if (before === null) return { mode: 'no arena', sat: null };
  if (t === 0 || before > 0) return { mode: 'app', sat: before };
  await page.addStyleTag({ content: `.arcade-full{--sat:${t}px!important;--sab:${b}px!important;--sal:${l}px!important;--sar:${r}px!important}` });
  return { mode: 'env emulated', sat: await resolvedLength(page, '.arcade-full', '--sat') };
}

/**
 * Geometry audit of what is actually on screen (elementFromPoint decides what is on top, so covered
 * headers behind a sheet, a pack opening or a match don't count):
 *  - textInBand: text whose cap top (from the font's own metrics) is above inset + TEXT_CLEAR
 *  - controlInBand: controls whose box starts above inset + edge
 *  - bottomCut: text or controls below H − bottom inset (outside scrollers), and bars past the screen
 *  - small (< 44 design px, counting a ::before hit area), overlap (intersecting hit areas)
 *  - tiny (< 10 px), lowContrast (WCAG against the nearest solid background), docScroll, hOverflow,
 *    offscreen; topMost/capTopMost: the first text or control from the top
 */
export async function auditScreen(page, device) {
  const d = typeof device === 'string' || typeof device === 'number' ? DEVICES[device] : device;
  // every element takes part in hit testing while the audit runs (see onTop below); pseudo-elements
  // keep their own pointer-events, so a decorative ::before is never counted as a hit area
  const force = await page.addStyleTag({ content: '*{pointer-events:auto!important}' });
  try {
    return await measureScreen(page, d);
  } finally {
    await force.evaluate((e) => e.remove());
  }
}
const measureScreen = (page, d) =>
  page.evaluate(
    ({ insets, edge, clear }) => {
      const [t, , b] = insets;
      const W = innerWidth,
        H = innerHeight;
      const stage = document.querySelector('.stage');
      const k = stage ? stage.getBoundingClientRect().width / stage.offsetWidth || 1 : 1;
      const r1 = (n) => Math.round(n * 10) / 10;
      const styles = new Map();
      const cs = (e) => {
        let s = styles.get(e);
        if (!s) styles.set(e, (s = getComputedStyle(e)));
        return s;
      };
      const invisible = (e) => {
        for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
          const s = cs(n);
          if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return true;
        }
        return false;
      };
      const ignored = (e) => !!e.closest('#__ps-band, .inset-probe, [inert]');
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      // What paints at a point, in paint order: hit testing with every element's pointer events on (a
      // HUD or label with pointer-events:none still covers what is under it), skipping boxes that
      // draw nothing themselves (their children are listed on their own).
      const paints = (e) => {
        if (/^(canvas|img|video|svg)$/i.test(e.tagName)) return true;
        const s = cs(e),
          c = parse(s.backgroundColor);
        return (!!c && c.a >= 0.5) || s.backgroundImage !== 'none';
      };
      const onTop = (el, r) => {
        const x = Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)),
          y = Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2));
        for (const e of document.elementsFromPoint(x, y)) {
          if (e === el || el.contains(e) || e.contains(el)) return true;
          if (paints(e)) return false;
        }
        return false;
      };
      // the part of a box its clipping ancestors (and the screen) let through
      const clips = new Map();
      const clipOf = (el) => {
        if (clips.has(el)) return clips.get(el);
        let box = { left: 0, top: 0, right: W, bottom: H };
        let pos = cs(el).position,
          skip = pos === 'fixed' ? 'fixed' : pos === 'absolute' ? 'absolute' : null;
        for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
          const s = cs(n);
          if (skip === 'fixed') {
            if (s.transform === 'none' && s.filter === 'none' && s.contain.indexOf('paint') < 0) continue;
            skip = null;
          } else if (skip === 'absolute') {
            if (s.position === 'static' && s.transform === 'none') continue;
            skip = null;
          }
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
            const q = n.getBoundingClientRect();
            box = { left: Math.max(box.left, q.left), top: Math.max(box.top, q.top), right: Math.min(box.right, q.right), bottom: Math.min(box.bottom, q.bottom) };
          }
          if (s.position === 'fixed') skip = 'fixed';
          else if (s.position === 'absolute') skip = 'absolute';
        }
        clips.set(el, box);
        return box;
      };
      const clip = (el, r) => {
        const c = clipOf(el);
        const out = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) };
        return out.right - out.left > 0.5 && out.bottom - out.top > 0.5 ? out : null;
      };
      const hClipped = (e) => {
        for (let n = e.parentElement; n && n !== document.documentElement; n = n.parentElement) if (cs(n).overflowX !== 'visible') return true;
        return false;
      };
      const inScroller = (e) => {
        for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) if (/(auto|scroll)/.test(cs(n).overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
        return false;
      };
      const label = (e) => (e.getAttribute?.('aria-label') || e.innerText || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
      // cap height and content-area metrics of each font, from canvas
      const ctx = document.createElement('canvas').getContext('2d');
      const metrics = new Map();
      const capRatio = (s) => {
        const font = `${s.fontStyle} ${s.fontWeight} 100px ${s.fontFamily}`;
        let m = metrics.get(font);
        if (!m) {
          ctx.font = font;
          const x = ctx.measureText('H');
          const asc = x.fontBoundingBoxAscent,
            desc = x.fontBoundingBoxDescent;
          m = asc + desc > 0 ? (asc - x.actualBoundingBoxAscent) / (asc + desc) : 0.12;
          metrics.set(font, m);
        }
        return m;
      };
      const textInBand = [],
        controlInBand = [],
        bottomCut = [],
        tiny = [],
        lowContrast = [],
        offscreen = [];
      let topMost = { y: Infinity, label: '' },
        capTopMost = { y: Infinity, label: '' };
      const lum = ({ r, g, b }) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (e) => {
        for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
          const s = cs(n),
            c = parse(s.backgroundColor);
          if (c && c.a > 0.85) return c;
          if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.includes('url')) return null;
        }
        return { r: 4, g: 18, b: 26, a: 1 };
      };
      const textEls = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      const range = document.createRange();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || ignored(el) || invisible(el)) continue;
        range.selectNodeContents(n);
        const s = cs(el);
        const ratio = capRatio(s);
        for (const raw of range.getClientRects()) {
          const r = clip(el, raw);
          if (!r || !onTop(el, r)) continue;
          textEls.add(el);
          const capTop = raw.top + raw.height * ratio;
          if (capTop < capTopMost.y) capTopMost = { y: capTop, label: label(el) };
          if (capTop < t + clear - 0.25 && r.bottom > capTop) textInBand.push({ label: label(el), capTop: r1(capTop), top: r1(r.top) });
        }
      }
      for (const el of textEls) {
        const r = el.getBoundingClientRect(),
          s = cs(el);
        if (!inScroller(el)) {
          if (r.top < topMost.y) topMost = { y: r.top, label: label(el) };
          if (r.bottom > H - b + 0.5 && r.top < H) bottomCut.push({ label: label(el), bottom: r1(r.bottom) });
        }
        if ((r.right > W + 1 || r.left < -1) && !hClipped(el)) offscreen.push(label(el));
        const fs = parseFloat(s.fontSize);
        if (fs < 10) tiny.push(label(el) + ' ' + fs + 'px');
        const fg = parse(s.color),
          bg = bgOf(el);
        if (fg && bg) {
          const op = +s.opacity,
            a = fg.a * (isNaN(op) ? 1 : op);
          const mix = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
          const L1 = lum(mix),
            L2 = lum(bg),
            cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const big = fs >= 18 || (fs >= 14 && +s.fontWeight >= 700);
          if (cr < (big ? 3 : 4.5)) lowContrast.push(label(el) + ' ' + cr.toFixed(2));
        }
      }
      // controls: visual box for the band, effective hit area (::before included) for size and overlap
      const controls = [];
      const px = (v) => (v && v.endsWith('px') ? parseFloat(v) : 0);
      for (const e of document.querySelectorAll('button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox]')) {
        if (ignored(e) || invisible(e) || e.disabled || e.closest('[aria-hidden=true]')) continue;
        const box = e.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) continue;
        const vis = clip(e, box);
        if (!vis || !onTop(e, vis)) continue;
        const sc = e.closest('.stage') ? k : 1;
        const pb = getComputedStyle(e, '::before');
        const hit =
          pb.content !== 'none' && pb.position === 'absolute' && pb.visibility !== 'hidden' && pb.pointerEvents !== 'none'
            ? { left: box.left + Math.min(0, px(pb.left)) * sc, right: box.right - Math.min(0, px(pb.right)) * sc, top: box.top + Math.min(0, px(pb.top)) * sc, bottom: box.bottom - Math.min(0, px(pb.bottom)) * sc }
            : { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        controls.push({ e, box, hit, sc });
        if (box.top < t + edge - 0.25) controlInBand.push({ label: label(e), top: r1(box.top) });
        if (!inScroller(e)) {
          if (box.top < topMost.y) topMost = { y: box.top, label: label(e) };
          if (box.bottom > H - b + 0.5 && box.top < H) bottomCut.push({ label: label(e), bottom: r1(box.bottom) });
        }
      }
      const small = [];
      for (const c of controls) {
        const w = (c.hit.right - c.hit.left) / c.sc,
          h = (c.hit.bottom - c.hit.top) / c.sc;
        if (w < 43.5 || h < 43.5) small.push(label(c.e) + ' ' + Math.round(w) + 'x' + Math.round(h));
      }
      const overlap = [];
      for (let i = 0; i < controls.length; i++)
        for (let j = i + 1; j < controls.length; j++) {
          const a = controls[i],
            q = controls[j];
          if (a.e.contains(q.e) || q.e.contains(a.e)) continue;
          const ow = Math.min(a.hit.right, q.hit.right) - Math.max(a.hit.left, q.hit.left),
            oh = Math.min(a.hit.bottom, q.hit.bottom) - Math.max(a.hit.top, q.hit.top);
          if (ow > 1 && oh > 1) overlap.push(label(a.e) + ' × ' + label(q.e) + ' ' + Math.round(ow) + 'x' + Math.round(oh));
        }
      const bar = (sel) => {
        const e = document.querySelector(sel);
        if (!e || invisible(e)) return null;
        const r = e.getBoundingClientRect();
        return { top: r1(r.top), bottom: r1(r.bottom), cut: r.bottom > H + 0.5 };
      };
      const uniq = (list, n = 16) => [...new Map(list.map((x) => [typeof x === 'string' ? x : x.label, x])).values()].slice(0, n);
      return {
        W,
        H,
        k: +k.toFixed(4),
        insets,
        edge,
        lines: { control: t + edge, text: t + clear, bottom: H - b },
        title: document.querySelector('.ut-title')?.textContent ?? '',
        topMost: { y: r1(topMost.y), label: topMost.label },
        capTopMost: { y: r1(capTopMost.y), label: capTopMost.label },
        textInBand: uniq(textInBand.sort((x, y) => x.capTop - y.capTop)),
        controlInBand: uniq(controlInBand.sort((x, y) => x.top - y.top)),
        bottomCut: uniq(bottomCut),
        bars: { play: bar('.home .playbar'), tabs: bar('nav.tabs'), utTabs: bar('.ut-tabs') },
        small: uniq(small),
        overlap: uniq(overlap),
        tiny: uniq(tiny),
        lowContrast: uniq(lowContrast),
        offscreen: uniq(offscreen),
        docScroll: document.scrollingElement.scrollHeight - innerHeight,
        hOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    },
    { insets: d.insets, edge: edgeOf(d.insets[0]), clear: textClearOf(d.insets[0]) }
  );

/**
 * The card-detail sheet's sticky action bar (audit H1): where it sits against the sheet's bottom
 * edge, and which text shows in the strip between them (content scrolling under a floating bar).
 */
export const detailBarAudit = (page) =>
  page.evaluate(() => {
    const bar = [...document.querySelectorAll('.sheet .ut-detail-btns')].pop();
    const sheet = bar?.closest('.sheet');
    if (!bar || !sheet) return null;
    const r1 = (n) => Math.round(n * 10) / 10;
    const b = bar.getBoundingClientRect(),
      s = sheet.getBoundingClientRect();
    const below = [];
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() && !bar.contains(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const top = Math.max(r.top, b.bottom),
          bottom = Math.min(r.bottom, s.bottom);
        if (bottom - top < 1) continue;
        const hit = document.elementFromPoint((r.left + r.right) / 2, (top + bottom) / 2);
        if (hit && (hit === n.parentElement || n.parentElement.contains(hit) || hit.contains(n.parentElement))) below.push(n.textContent.trim().slice(0, 30));
      }
    }
    return { sheetBottom: r1(s.bottom), barTop: r1(b.top), barBottom: r1(b.bottom), gap: r1(s.bottom - b.bottom), scrollTop: Math.round(sheet.scrollTop), scrollMax: Math.round(sheet.scrollHeight - sheet.clientHeight), textBelowBar: [...new Set(below)].slice(0, 8) };
  });

/**
 * Home's vertical budget: its classes, every row of the scrolling column, the PLAY bar and the fade
 * above it, the gap from the last row to PLAY, and whether the column overflows and its last row
 * clears the fade once scrolled to the end.
 */
export const homeAudit = (page) =>
  page.evaluate(async () => {
    const home = document.querySelector('.page-view.home');
    if (!home) return null;
    const r1 = (n) => Math.round(n * 10) / 10;
    const scroll = home.querySelector('.home-scroll'),
      play = home.querySelector('.playbar');
    const rect = (e) => {
      const r = e.getBoundingClientRect();
      return { top: r1(r.top), bottom: r1(r.bottom), h: r1(r.height) };
    };
    const name = (e) => [...e.classList].filter((c) => !/^(rise|in|intro)/.test(c)).join('.') || e.tagName.toLowerCase();
    const rowsNow = () => [...scroll.children].filter((e) => !e.classList.contains('spacer') && e.getBoundingClientRect().height > 0);
    // the fade over the content above PLAY: a ::before band, or the bar's own upward shadow
    const pr = play.getBoundingClientRect(),
      before = getComputedStyle(play, '::before'),
      k = document.querySelector('.stage').getBoundingClientRect().width / document.querySelector('.stage').offsetWidth;
    let fadeTop = pr.top;
    if (before.content !== 'none' && before.position === 'absolute') {
      const h = parseFloat(before.height) || 0,
        top = parseFloat(before.top);
      fadeTop = Math.min(fadeTop, pr.top + (Number.isFinite(top) ? top : -h) * k);
    }
    for (const sh of getComputedStyle(play).boxShadow.split(/,(?![^(]*\))/)) {
      const nums = (sh.replace(/rgba?\([^)]*\)/, '').match(/-?\d+(\.\d+)?px/g) || []).map(parseFloat);
      if (nums.length < 2 || /inset/.test(sh)) continue;
      const [, oy, blur = 0, spread = 0] = nums;
      if (oy < 0) fadeTop = Math.min(fadeTop, pr.top + (oy - spread - blur) * k);
    }
    const rows = rowsNow().map((e) => ({ row: name(e), ...rect(e) }));
    const last = rows[rows.length - 1];
    const overflows = scroll.scrollHeight > scroll.clientHeight + 1;
    let endBottom = last?.bottom ?? null;
    if (overflows) {
      const was = scroll.scrollTop;
      scroll.scrollTop = scroll.scrollHeight;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const l = rowsNow().pop();
      endBottom = l ? r1(l.getBoundingClientRect().bottom) : null;
      scroll.scrollTop = was;
    }
    const stage = document.querySelector('.stage');
    return {
      homeClass: ['short', 'snug', 'tall'].filter((c) => home.classList.contains(c)).join(' '),
      fit: [...stage.classList].find((c) => c.startsWith('fit-'))?.slice(4) ?? '',
      rows,
      play: rect(play),
      fadeTop: r1(fadeTop),
      tabs: document.querySelector('nav.tabs') ? rect(document.querySelector('nav.tabs')) : null,
      gapToPlay: last ? r1(pr.top - last.bottom) : null,
      gapToFade: last ? r1(fadeTop - last.bottom) : null,
      overflows,
      scrollRange: Math.round(scroll.scrollHeight - scroll.clientHeight),
      lastRowClearsFadeAtEnd: endBottom === null ? null : endBottom <= fadeTop + 0.5,
    };
  });

/** Grid screenshots into one contact sheet (no Python): a labelled tile per file. */
export async function contactSheet(browser, files, out, { cols = 6, tile = 220, title = '' } = {}) {
  const list = files.filter((f) => fs.existsSync(f));
  if (!list.length) return null;
  const context = await browser.newContext({ viewport: { width: cols * (tile + 8) + 8, height: 400 } });
  await context.route((url) => !['data:', 'about:'].includes(url.protocol), (r) => r.abort());
  const page = await context.newPage();
  const cells = list
    .map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(path.dirname(f))}/${path.basename(f, '.png')}</figcaption></figure>`)
    .join('');
  await page.setContent(
    `<style>body{margin:0;background:#0b1419;color:#cfe;font:11px/1.3 system-ui;padding:8px}h1{font-size:13px;margin:0 0 8px}main{display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:8px}figure{margin:0}img{width:${tile}px;display:block;border:1px solid #234}figcaption{padding:2px 0;word-break:break-all}</style><h1>${title}</h1><main>${cells}</main>`
  );
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  await context.close();
  return out;
}
