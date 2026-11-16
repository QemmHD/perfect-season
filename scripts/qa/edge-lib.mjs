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
      // checkVisibility also catches what the style walk misses: text inside a closed <details>, under
      // content-visibility:hidden/auto skipped content, or in a display:contents subtree's hidden slot
      const invisible = (e) => {
        if (typeof e.checkVisibility === 'function' && !e.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return true;
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
        // shell-5: the visible part decides (a control scrolled up under its sheet's top edge is clipped there)
        if (vis.top < t + edge - 0.25) controlInBand.push({ label: label(e), top: r1(vis.top) });
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
          if (!(ow > 1 && oh > 1)) continue;
          // shell-5: a control scrolled under a bar (the UT tab bar, a sticky chip row, the booster tray)
          // is not an ambiguous tap: the bar's own box covers it there. Only hit areas that reach into a
          // visible neighbour count.
          const cx = (Math.max(a.hit.left, q.hit.left) + Math.min(a.hit.right, q.hit.right)) / 2,
            cy = (Math.max(a.hit.top, q.hit.top) + Math.min(a.hit.bottom, q.hit.bottom)) / 2;
          const at = document.elementFromPoint(cx, cy);
          const owner = at && (a.e === at || a.e.contains(at)) ? a : at && (q.e === at || q.e.contains(at)) ? q : null;
          const other = owner === a ? q : a;
          const inBox = (c) => cx >= c.box.left && cx <= c.box.right && cy >= c.box.top && cy <= c.box.bottom;
          const vis = clip(other.e, other.box);
          const otherShown = !!vis && cx >= vis.left && cx <= vis.right && cy >= vis.top && cy <= vis.bottom;
          if (owner && inBox(owner) && (inScroller(other.e) || !otherShown)) continue;
          overlap.push(label(a.e) + ' × ' + label(q.e) + ' ' + Math.round(ow) + 'x' + Math.round(oh));
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
    const shown = (e) => typeof e.checkVisibility !== 'function' || e.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      // text in a closed <details>, display:none, visibility:hidden or opacity 0 never shows below the bar
      if (!p || !shown(p)) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const top = Math.max(r.top, b.bottom),
          bottom = Math.min(r.bottom, s.bottom);
        if (bottom - top < 1) continue;
        // the run counts only when the point hits its own element or a descendant of it; a hit on an
        // ancestor (the sheet itself, in the empty strip under the bar) means the text is not painted there
        const hit = document.elementFromPoint((r.left + r.right) / 2, (top + bottom) / 2);
        if (hit && (hit === p || p.contains(hit))) below.push(n.textContent.trim().slice(0, 30));
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
    // a row counts only when it paints something: an empty slot (the hint row with nothing in it) is space, not a row
    const paints = (e) => e.textContent.trim() !== '' || !!e.querySelector('canvas, svg, img, button, input');
    const rowsNow = () => [...scroll.children].filter((e) => !e.classList.contains('spacer') && e.getBoundingClientRect().height > 0 && paints(e));
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
    // at rest (scrolled to the top): the mode tiles clear the fade, and which rows the fade cuts through
    const wasTop = scroll.scrollTop;
    scroll.scrollTop = 0;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const modesEl = scroll.querySelector('.modes');
    const modesBottomAtRest = modesEl ? r1(modesEl.getBoundingClientRect().bottom) : null;
    const cutAtRest = rowsNow()
      .map((e) => ({ row: name(e), ...rect(e) }))
      .filter((r) => r.top < fadeTop - 0.5 && r.bottom > fadeTop + 0.5)
      .map((r) => r.row);
    scroll.scrollTop = wasTop;
    const stage = document.querySelector('.stage');
    return {
      modesBottomAtRest,
      modesClearFadeAtRest: modesBottomAtRest === null ? null : modesBottomAtRest <= fadeTop + 0.5,
      cutAtRest,
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

// ---------- shell-3: the status plate and the header plates ----------

/** '#0b2733' / 'rgb(1, 2, 3)' / 'rgba(1, 2, 3, 0.5)' → [r, g, b, a], or null. */
export function parseColor(s) {
  if (!s) return null;
  const t = String(s).trim();
  const hex = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const m = t.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

/** Luma of a gamma-encoded sRGB colour, 0..255 (Rec. 709 weights): what "band luminance" compares. */
export const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** WCAG 2 contrast ratio of two sRGB colours. */
export function contrastRatio(a, b) {
  const L = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const x = L(a),
    y = L(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** sRGB (D65) → CIE L*a*b*. */
export function srgbToLab([r, g, b]) {
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047,
    Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B,
    Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** CIEDE2000 colour difference of two L*a*b* colours (Sharma, Wu and Dalal 2005). */
export function deltaE2000Lab([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2),
    Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1,
    ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1),
    Cp2 = Math.hypot(ap2, b2);
  const hue = (b, a) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) / rad) + 360) % 360);
  const hp1 = hue(b1, ap1),
    hp2 = hue(b2, ap2);
  const dL = L2 - L1,
    dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) dh = Math.abs(hp2 - hp1) <= 180 ? hp2 - hp1 : hp2 - hp1 > 180 ? hp2 - hp1 - 360 : hp2 - hp1 + 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2,
    Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hm = Math.abs(hp1 - hp2) <= 180 ? (hp1 + hp2) / 2 : hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2),
    Sc = 1 + 0.045 * Cpm,
    Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
export const deltaE2000 = (rgb1, rgb2) => deltaE2000Lab(srgbToLab(rgb1), srgbToLab(rgb2));

/**
 * Mean absolute per-pixel luma difference of two equally sized luma arrays, as a percentage of 255
 * (the "band luminance" comparison: A + B + C against A alone).
 */
export function meanLumaDiffPct(a, b) {
  if (!a?.length || a.length !== b?.length) return null;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return (s / a.length / 255) * 100;
}

/**
 * Real pixels of what is on screen (a viewport screenshot decoded in the page): RGB at points, and per
 * region the mean RGB, the mean luma and (with `lumas`) every pixel's luma. Coordinates in CSS px.
 */
export async function readPixels(page, { points = [], regions = [] } = {}) {
  const b64 = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ b64, points, regions }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const s = img.width / innerWidth;
      const px = (x, y) => {
        const d = g.getImageData(Math.min(img.width - 1, Math.max(0, Math.round(x * s))), Math.min(img.height - 1, Math.max(0, Math.round(y * s))), 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const region = ({ x0 = 0, y0, x1 = innerWidth, y1, lumas = false }) => {
        const X0 = Math.round(x0 * s),
          Y0 = Math.round(y0 * s),
          w = Math.max(1, Math.round(x1 * s) - X0),
          h = Math.max(1, Math.round(y1 * s) - Y0);
        const d = g.getImageData(X0, Y0, w, h).data;
        const n = d.length / 4,
          sum = [0, 0, 0],
          out = lumas ? new Array(n) : null;
        let ls = 0;
        for (let i = 0; i < n; i++) {
          const r = d[i * 4],
            gg = d[i * 4 + 1],
            b = d[i * 4 + 2];
          sum[0] += r;
          sum[1] += gg;
          sum[2] += b;
          const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
          ls += l;
          if (out) out[i] = Math.round(l * 10) / 10;
        }
        return { mean: sum.map((v) => Math.round((v / n) * 10) / 10), luma: Math.round((ls / n) * 100) / 100, n, ...(out ? { lumas: out } : {}) };
      };
      return { points: points.map(([x, y]) => px(x, y)), regions: regions.map(region) };
    },
    { b64, points, regions }
  );
}

/** Turns the status plate (B) and the header plates (C) off, leaving Fix A: the "A alone" control. */
export const PLATES_OFF_CSS =
  '.status-plate{display:none!important}.shell-top,.evo-screen>.evo-top{background:none!important;box-shadow:none!important}' +
  ':is(.shell-top,.evo-top)::before,:is(.topbar,.draft-head,.po-head)::before,:is(.topbar,.draft-head,.po-head)::after{content:none!important}';
export async function platesOff(page, off) {
  await page.evaluate(
    ([css, off]) => {
      document.getElementById('__ps-plates-off')?.remove();
      if (off) document.head.append(Object.assign(document.createElement('style'), { id: '__ps-plates-off', textContent: css }));
    },
    [PLATES_OFF_CSS, off]
  );
}

/**
 * The status plate and the header on top (audit C1, shell-3 acceptance):
 *  - status: the fixed `.status-plate` (display, top, height, colour)
 *  - header: the visible `.shell-top` or `.topbar` (UT `.ut-top` included), or (shell-5) a sub-page
 *    header (`.draft-head`, `.po-head`, Training Camp's `.evo-top`); `probes` hit-test
 *    x = 20 / mid / W − 23 at y = 2, inset + edge − 2 and the header's bottom − 2, each `ok` when it
 *    lands on the header (its `::before` plate reports as the header); `opaque` when every colour of
 *    its plate is solid; `hairline` (the plate's bottom) against `firstRow` (the next box's top);
 *    `plateTop`/`plateBot`/`line` colours; `textContrast` (min WCAG ratio of header text drawn on
 *    the plate) and `lineContrast` (hairline against the plate bottom)
 */
export const platesAudit = (page, device) => {
  const d = typeof device === 'string' || typeof device === 'number' ? DEVICES[device] : device;
  return page.evaluate(
    ({ insets, edge }) => {
      const [t] = insets;
      const W = innerWidth;
      const r1 = (n) => Math.round(n * 10) / 10;
      const col = (s) => {
        const m = String(s).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
      };
      const colors = (s) => (String(s).match(/rgba?\([^)]+\)/g) || []).map(col);
      const L = ([r, g, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const cr = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
      const sp = document.querySelector('.status-plate');
      const status = sp
        ? (() => {
            const s = getComputedStyle(sp),
              r = sp.getBoundingClientRect();
            return { display: s.display, top: r1(r.top), height: r1(r.height), color: col(s.backgroundColor), z: s.zIndex, pointerEvents: s.pointerEvents };
          })()
        : null;
      const label = (e) => (e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 3).join('.') : '')) : null);
      // shell-5: the sub-page headers (Draft/Search, Playoffs) and Training Camp's bar have plates too
      const isHeader = (e) => e.matches('.shell-top, .screen > .draft-head, .screen > .po-head, .evo-screen > .evo-top') || (e.matches('.topbar') && !e.closest('.shell-top'));
      const visible = [...document.querySelectorAll('.shell-top, .topbar, .draft-head, .po-head, .evo-top')].filter(isHeader).filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 2);
        return !!hit && (hit === e || e.contains(hit));
      });
      const h = visible.pop();
      if (!h) return { status, header: null };
      const r = h.getBoundingClientRect();
      const own = getComputedStyle(h),
        pre = getComputedStyle(h, '::before');
      const plateStyle = own.backgroundImage !== 'none' ? own : pre.content !== 'none' ? pre : null;
      const stops = plateStyle ? colors(plateStyle.backgroundImage) : [];
      const shadows = plateStyle ? plateStyle.boxShadow.split(/,(?![^(]*\))/) : [];
      const line = col(shadows.find((x) => /inset/.test(x)) || '');
      const plateTop = stops[0] || null,
        plateBot = stops[stops.length - 1] || null;
      const xs = [20, Math.round((W * 195) / 393), W - 23];
      const ys = [2, t + edge - 2, r.bottom - 2].filter((y, i) => i !== 1 || y > 2);
      const probes = [];
      for (const y of ys)
        for (const x of xs) {
          const hit = document.elementFromPoint(x, y);
          probes.push({ x, y: r1(y), hit: label(hit), ok: !!hit && (hit === h || h.contains(hit)) });
        }
      let next = h.nextElementSibling;
      while (next && next.getBoundingClientRect().height < 1) next = next.nextElementSibling;
      if (h.matches('.shell-top')) next = h.parentElement.querySelector('.shell-views') || next;
      const firstRow = next ? r1(next.getBoundingClientRect().top) : null;
      // header text drawn straight on the plate (text on its own opaque chip is the chip's business)
      const onPlate = (e) => {
        for (let n = e; n && n !== h; n = n.parentElement) {
          const c = col(getComputedStyle(n).backgroundColor);
          if (c && c[3] > 0.85) return false;
        }
        return true;
      };
      const texts = [];
      const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const e = n.parentElement;
        if (!e || !plateBot || !onPlate(e)) continue;
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const c = col(s.color);
        // gradient-clipped text (the UT title) is as strong as its weakest stop
        const fills = c && c[3] > 0 ? [c] : colors(s.backgroundImage).filter((x) => x[3] > 0);
        for (const f of fills) texts.push({ text: n.textContent.trim().slice(0, 24), ratio: Math.round(cr(f, plateBot) * 100) / 100 });
      }
      texts.sort((a, b) => a.ratio - b.ratio);
      return {
        status,
        header: {
          el: label(h),
          top: r1(r.top),
          bottom: r1(r.bottom),
          opaque: stops.length > 0 && stops.every((c) => c[3] === 1),
          plateTop,
          plateBot,
          line,
          probes,
          probesOk: probes.every((p) => p.ok),
          hairline: r1(r.bottom),
          firstRow,
          hairlineOff: firstRow === null ? null : r1(firstRow - r.bottom),
          textContrast: texts[0]?.ratio ?? null,
          weakest: texts.slice(0, 3),
          lineContrast: line && plateBot ? Math.round(cr(line, plateBot) * 100) / 100 : null,
        },
      };
    },
    { insets: d.insets, edge: edgeOf(d.insets[0]) }
  );
};

/** The H1 hit test: what is 4 pt above the bottom sheet's bottom edge (it must be the action bar). */
export const detailBarHit = (page) =>
  page.evaluate(() => {
    const bar = [...document.querySelectorAll('.sheet .ut-detail-btns')].pop();
    const sheet = bar?.closest('.sheet');
    if (!bar || !sheet) return null;
    const s = sheet.getBoundingClientRect();
    const xs = [s.left + 12, (s.left + s.right) / 2, s.right - 12];
    return xs.map((x) => {
      const e = document.elementFromPoint(x, s.bottom - 4);
      return !!e && (e === bar || bar.contains(e));
    });
  });

// ---------- shell-5: tap timing, frames, the HUD scrim's sprite check, edge states, preserve ----------

/**
 * Installed before the app loads (fixture `init`): Event Timing entries for every interaction
 * (input → next paint: the entry's duration, max per interactionId) and a ring of requestAnimationFrame
 * timestamps, so the walker can read the frames of the 600 ms after any tap.
 */
export function tapTimingInit() {
  if (window.__psTiming) return;
  const T = (window.__psTiming = { events: [], frames: new Float64Array(8192), n: 0 });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) T.events.push({ id: e.interactionId, name: e.name, start: e.startTime, dur: e.duration });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {
    T.unsupported = true;
  }
  const tick = (t) => {
    T.frames[T.n++ % 8192] = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The page clock, for marking a tap (performance.now()). */
export const pageNow = (page) => page.evaluate(() => performance.now());

/**
 * What one tap did: the slowest Event Timing entry of each interaction that started at or after `t0`
 * (input → next paint, ms; Chromium reports only those of 16 ms and up, so a missing entry means a tap
 * that painted in under 16 ms), and the frames of the `window` ms after the tap: intervals over 33 ms
 * and the average rate. Waits until the window has passed.
 */
export async function readTap(page, t0, window = 600) {
  await page.waitForFunction(([t0, w]) => performance.now() - t0 > w + 40, [t0, window], { timeout: 10000 }).catch(() => {});
  return page.evaluate(
    ([t0, w]) => {
      const T = window.__psTiming;
      if (!T) return null;
      const per = new Map();
      for (const e of T.events) if (e.start >= t0 - 1 && e.start <= t0 + w) per.set(e.id, Math.max(per.get(e.id) ?? 0, e.dur));
      const ts = [];
      const n = Math.min(T.n, 8192);
      for (let i = T.n - n; i < T.n; i++) {
        const t = T.frames[i % 8192];
        if (t >= t0 && t <= t0 + w) ts.push(t);
      }
      ts.sort((a, b) => a - b);
      const gaps = ts.slice(1).map((t, i) => t - ts[i]);
      const span = ts.length > 1 ? ts[ts.length - 1] - ts[0] : 0;
      return {
        inp: per.size ? Math.max(...per.values()) : null,
        interactions: per.size,
        frames: ts.length,
        long: gaps.filter((g) => g > 33.4).length,
        worst: gaps.length ? Math.round(Math.max(...gaps) * 10) / 10 : null,
        fps: span > 0 ? Math.round(((ts.length - 1) / span) * 1000 * 10) / 10 : null,
        unsupported: !!T.unsupported,
      };
    },
    [t0, window]
  );
}

/** p-th percentile (0..100) of a list of numbers, nearest rank; null for an empty list. */
export function percentile(list, p) {
  const v = list.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}

/**
 * Sprites under the status-bar strip of a match frame. `rgba` is the strip's pixels (w × h). The strip
 * is the arena's sky and roof: each row is nearly one colour (its mode, colours quantized to 16 levels a
 * channel), so a player, the ball or the rim drawn there is a run of pixels far from its row's mode.
 * Rows with no dominant colour (a crowd) can't be judged this way and are counted as `busyRows`.
 */
export function stripSprites(rgba, w, h, { share = 0.6, far = 48, keepMask = false } = {}) {
  let spritePx = 0,
    busyRows = 0;
  const rows = [];
  const mask = keepMask ? new Uint8Array(w * h) : null;
  for (let y = 0; y < h; y++) {
    const counts = new Map();
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const key = (rgba[i] >> 4) * 256 + (rgba[i + 1] >> 4) * 16 + (rgba[i + 2] >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let mode = 0,
      best = -1;
    for (const [k, c] of counts)
      if (c > best) {
        best = c;
        mode = k;
      }
    if (best / w < share) {
      busyRows++;
      continue;
    }
    // the mode's own mean colour, from the pixels in its bucket
    const sum = [0, 0, 0];
    let n = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if ((rgba[i] >> 4) * 256 + (rgba[i + 1] >> 4) * 16 + (rgba[i + 2] >> 4) !== mode) continue;
      sum[0] += rgba[i];
      sum[1] += rgba[i + 1];
      sum[2] += rgba[i + 2];
      n++;
    }
    const m = sum.map((s) => s / n);
    let out = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (Math.max(Math.abs(rgba[i] - m[0]), Math.abs(rgba[i + 1] - m[1]), Math.abs(rgba[i + 2] - m[2])) > far) {
        out++;
        if (mask) mask[y * w + x] = 1;
      }
    }
    spritePx += out;
    if (out) rows.push(y);
  }
  return { spritePx, busyRows, spriteRows: rows.length, firstSpriteRow: rows.length ? rows[0] : null, ...(mask ? { mask } : {}) };
}

/**
 * Splits the outlying pixels of several frames of the same strip into the backdrop's own details (the
 * stands' lights: the same pixels in every frame) and what moves (players, the ball, a rim in a moving
 * camera): `moving[i]` counts frame i's outliers that are not outliers in every frame.
 */
export function splitStatic(masks) {
  if (!masks.length) return { staticPx: 0, moving: [] };
  const n = masks[0].length,
    all = new Uint8Array(n).fill(1);
  for (const m of masks) for (let i = 0; i < n; i++) all[i] &= m[i];
  let staticPx = 0;
  for (let i = 0; i < n; i++) staticPx += all[i];
  return { staticPx, moving: masks.map((m) => m.reduce((s, v, i) => s + (v && !all[i] ? 1 : 0), 0)) };
}

/** The status-bar strip (y 0..insetTop) of what is on screen, as raw RGBA (screen px at the page's scale). */
export async function stripPixels(page, insetTop) {
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: await page.evaluate(() => innerWidth), height: insetTop } });
  const { w, h, b64 } = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let s = '';
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return { w: img.width, h: img.height, b64: btoa(s) };
  }, png.toString('base64'));
  return { w, h, rgba: Buffer.from(b64, 'base64') };
}

/** Hides the match HUD scrim (.arcade-full::after) so the sprite check sees the canvas under it. */
export async function scrimOff(page, off) {
  await page.evaluate((off) => {
    document.getElementById('__ps-scrim-off')?.remove();
    if (off) document.head.append(Object.assign(document.createElement('style'), { id: '__ps-scrim-off', textContent: '.arcade-full::after{display:none!important}' }));
  }, off);
}

/** The HUD scrim on screen: its box in screen px and colour stops, or null when there is none. */
export const hudScrim = (page) =>
  page.evaluate(() => {
    const a = document.querySelector('.arcade-full');
    if (!a) return null;
    const s = getComputedStyle(a, '::after');
    if (s.content === 'none' || s.display === 'none') return { shown: false };
    const r = a.getBoundingClientRect();
    return { shown: true, top: Math.round((r.top + parseFloat(s.top)) * 10) / 10, height: Math.round(parseFloat(s.height) * 10) / 10, background: s.backgroundImage.slice(0, 120), pointerEvents: s.pointerEvents };
  });

/**
 * The visual viewport as the iPhone keyboard leaves it (screen-fit.mjs's override: the layout viewport
 * stays the phone, visualViewport.height shrinks), or back to the full screen with `height` null.
 */
export async function keyboardViewport(page, height) {
  await page.evaluate((height) => {
    if (!window.__psVV) {
      window.__psVV = { height: null };
      for (const key of ['width', 'height', 'offsetLeft', 'offsetTop', 'scale'])
        Object.defineProperty(visualViewport, key, {
          configurable: true,
          get: () => ({ width: innerWidth, height: window.__psVV.height ?? innerHeight, offsetLeft: 0, offsetTop: 0, scale: 1 })[key],
        });
    }
    window.__psVV.height = height;
    window.dispatchEvent(new Event('resize'));
    visualViewport.dispatchEvent(new Event('resize'));
  }, height);
  // the stage remeasures at 100 and 350 ms, the app's keyboard reveal looks again at 420 ms
  await settle(page, 700);
}

/**
 * With the keyboard up (visual height `vh`): is the focused input inside what the player sees, and
 * which of the named primary buttons are (fully inside 0..vh, on top, not covered)?
 */
export const keyboardAudit = (page, vh, buttons) =>
  page.evaluate(
    ([vh, buttons]) => {
      const r1 = (n) => Math.round(n * 10) / 10;
      const seen = (e) => {
        if (!e) return null;
        const r = e.getBoundingClientRect();
        const inside = r.top >= -0.5 && r.bottom <= vh + 0.5 && r.width > 0 && r.height > 0;
        const hit = inside ? document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2) : null;
        return { top: r1(r.top), bottom: r1(r.bottom), visible: inside && !!hit && (hit === e || e.contains(hit) || hit.contains(e)) };
      };
      const focused = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      const all = [...document.querySelectorAll('button, [role=button]')];
      return {
        focused: focused ? { tag: focused.tagName.toLowerCase(), label: focused.getAttribute('aria-label') || focused.getAttribute('placeholder') || '', ...seen(focused) } : null,
        buttons: buttons.map((name) => {
          const e = all.find((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().toUpperCase().startsWith(name.toUpperCase()));
          return { name, found: !!e, ...(e ? seen(e) : {}) };
        }),
      };
    },
    [vh, buttons]
  );

/** Rotates the phone as screen-fit.mjs does (the portrait lock's counter-rotation), or back to portrait. */
export async function rotate(page, device, sideways) {
  const d = typeof device === 'string' || typeof device === 'number' ? DEVICES[device] : device;
  const [t, , b] = d.insets;
  if (sideways) await page.setViewportSize({ width: d.h, height: d.w });
  else await page.setViewportSize({ width: d.w, height: d.h });
  await page.evaluate(
    ({ sideways, w, h, insets }) => {
      if (!window.__psRot) {
        window.__psRot = true;
        Object.defineProperty(window, 'orientation', { configurable: true, get: () => window.__fitAngle ?? 0 });
      }
      window.__fitAngle = sideways ? 90 : 0;
      window.__psInsets = insets;
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));
      visualViewport.dispatchEvent(new Event('resize'));
    },
    { sideways, w: d.w, h: d.h, insets: sideways ? [0, b, 0, t] : d.insets }
  );
  await settle(page, 500);
}

/** Sideways: the stage's rotation, the published edge (0 sideways) and whether the frame and bars fit the screen. */
export const rotatedAudit = (page) =>
  page.evaluate(() => {
    const st = document.querySelector('.stage');
    const r = st.getBoundingClientRect();
    const W = innerWidth,
      H = innerHeight;
    const within = (e) => {
      if (!e) return null;
      const q = e.getBoundingClientRect();
      return q.left >= -0.5 && q.top >= -0.5 && q.right <= W + 0.5 && q.bottom <= H + 0.5;
    };
    return {
      rot: st.dataset.rot ?? null,
      edge: getComputedStyle(document.documentElement).getPropertyValue('--ps-edge').trim(),
      stage: { w: Math.round(r.width), h: Math.round(r.height) },
      stageFits: within(st),
      playFits: within(document.querySelector('.home .playbar')),
      tabsFit: within(document.querySelector('nav.tabs')),
      docScroll: document.scrollingElement.scrollHeight - H,
      hOverflow: document.documentElement.scrollWidth - W,
    };
  });

/**
 * Preserve checks on the current screen (audit §6): children of a scrolling `.page` (or sheet) that
 * clip their own content (squeezed: overflow hidden and shorter than what they hold), the UT back label
 * and EXIT text, and the PLAY bar's rect.
 */
export const preserveAudit = (page) =>
  page.evaluate(() => {
    const r1 = (n) => Math.round(n * 10) / 10;
    const squeezed = [];
    for (const col of document.querySelectorAll('.page, .sheet, .page-view')) {
      for (const c of col.children) {
        const s = getComputedStyle(c);
        if (s.display === 'none' || !/(hidden|clip)/.test(s.overflowY)) continue;
        if (c.scrollHeight > c.clientHeight + 1 && c.clientHeight > 0) squeezed.push(((c.className && String(c.className)) || c.tagName).slice(0, 40) + ' ' + c.clientHeight + '/' + c.scrollHeight);
      }
    }
    const back = document.querySelector('.ut-back');
    const play = document.querySelector('.home .playbar');
    const pr = play?.getBoundingClientRect();
    return {
      squeezed: squeezed.slice(0, 8),
      back: back ? back.textContent.trim().replace(/\s+/g, ' ') : null,
      play: pr ? { top: r1(pr.top), bottom: r1(pr.bottom), left: r1(pr.left), right: r1(pr.right) } : null,
    };
  });

/** A sticky call to action (Cups' GO bar, the card detail's action bar): its position and whether it is on screen. */
export const stickyAudit = (page, selector) =>
  page.evaluate((selector) => {
    const e = [...document.querySelectorAll(selector)].pop();
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { position: getComputedStyle(e).position, top: Math.round(r.top), bottom: Math.round(r.bottom), onScreen: r.top >= 0 && r.bottom <= innerHeight + 0.5 };
  }, selector);
