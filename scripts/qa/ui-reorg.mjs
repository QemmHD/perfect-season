// Claude, 2026-11-01: UI reorganisation QA (docs/UI-NAVIGATION.md). Visits every main-app tab and
// every Ultimate Team tab, segment and sub-screen at 430x932, 390x844 and 320x568 in both sports,
// screenshots each (plus scrolled pages) and checks, per screen:
//   - horizontal overflow: anything past the frame's right edge that isn't inside a scroller
//   - clipped text: text cut by overflow (truncation with an ellipsis is listed separately)
//   - tap targets under 44 design px (the app draws a 390px frame scaled to the phone; the real
//     on-screen size is reported too)
//   - squeezed flex items in a scrolling column (the START SEASON bug)
//   - the tab bar highlight and back label each screen should have
//   - zero page errors
// Usage: PS_QA_URL=http://localhost:5191/ node scripts/qa/ui-reorg.mjs [nba|nfl|all] [430|390|320|all]
// Writes screenshots and report.json to PS_QA_ARTIFACTS (default /tmp/perfect-season-qa/ui-reorg).
import fs from 'node:fs';
import path from 'node:path';
process.env.PS_QA_ARTIFACTS ||= '/tmp/perfect-season-qa/ui-reorg';
const { launch, fixture, artifacts } = await import('./browser.mjs');
const [sportArg = 'all', widthArg = 'all'] = process.argv.slice(2);
const SIZES = { 430: 932, 390: 844, 320: 568 };
const sports = sportArg === 'all' ? ['nba', 'nfl'] : [sportArg];
const widths = widthArg === 'all' ? [430, 390, 320] : [+widthArg];
fs.mkdirSync(artifacts, { recursive: true });
const browser = await launch();
const report = [];
let failures = 0;

const audit = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('.stage');
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth || 1;
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      for (let n = e; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      }
      return r.bottom > sr.top + 1 && r.top < sr.bottom - 1;
    };
    const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 48);
    const scroller = (e) => {
      for (let n = e.parentElement; n && n !== stage; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return n;
      }
      return null;
    };
    // the topmost layer: a dialog if one is open, otherwise the screen
    const dialog = [...document.querySelectorAll('[role=dialog]')].filter(visible).pop();
    const root = dialog || stage;
    const offscreen = [];
    const truncated = [];
    const clipped = [];
    for (const e of root.querySelectorAll('*')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      const hasText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if ((r.right > sr.right + 1 || r.left < sr.left - 1) && !scroller(e)) offscreen.push(label(e) + ' @' + Math.round((r.right - sr.left) / k));
      if (!hasText) continue;
      const s = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(s.overflowX)) (s.textOverflow === 'ellipsis' ? truncated : clipped).push(label(e));
      else if (e.scrollHeight > e.clientHeight + 2 && /(hidden|clip)/.test(s.overflowY) && !s.webkitLineClamp?.match(/\d/)) clipped.push('V:' + label(e));
    }
    const small = [];
    for (const e of root.querySelectorAll('button, a[href], input, select, [role=switch], [role=tab], [role=radio], summary')) {
      if (!visible(e) || e.disabled || e.closest('[aria-hidden=true],[inert]')) continue;
      const box = e.getBoundingClientRect();
      // a compact control may extend its tap area with an invisible absolutely-positioned ::before
      // (styles.css "44pt hit areas"): measure that area
      const pb = getComputedStyle(e, '::before');
      const px = (v) => (v.endsWith('px') ? parseFloat(v) : 0);
      const r =
        pb.content !== 'none' && pb.position === 'absolute' && pb.visibility !== 'hidden'
          ? { left: box.left + Math.min(0, px(pb.left)) * k, right: box.right - Math.min(0, px(pb.right)) * k, top: box.top + Math.min(0, px(pb.top)) * k, bottom: box.bottom - Math.min(0, px(pb.bottom)) * k }
          : box;
      r.width = r.right - r.left;
      r.height = r.bottom - r.top;
      // fully scrolled out of its scroller: not tappable now
      const sc = scroller(e);
      if (sc) {
        const q = sc.getBoundingClientRect();
        if (r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom) continue;
      }
      const w = r.width / k,
        h = r.height / k;
      if (w < 43.5 || h < 43.5) small.push(label(e) + ' ' + Math.round(w) + 'x' + Math.round(h) + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + 'px)');
    }
    const squeezed = [];
    for (const el of document.querySelectorAll('.stage *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || ['visible', 'auto', 'scroll'].includes(cs.overflowY)) continue;
      const p = el.parentElement;
      if (!p) continue;
      const ps = getComputedStyle(p);
      if (!ps.display.includes('flex') || !ps.flexDirection.startsWith('column')) continue;
      if (!['auto', 'scroll'].includes(ps.overflowY) || parseFloat(cs.flexShrink) === 0) continue;
      if (el.scrollHeight > el.clientHeight + 2) squeezed.push(String(el.className).slice(0, 50) + ' ' + el.clientHeight + '/' + el.scrollHeight);
    }
    return {
      k: +k.toFixed(3),
      title: document.querySelector('.ut-title')?.textContent ?? document.querySelector('[role=dialog] h2, .page h1')?.textContent ?? '',
      tab: document.querySelector('.ut-tabs [aria-current=page] span, nav.tabs [aria-current=page] span')?.textContent ?? '',
      back: document.querySelector('.ut-back')?.textContent?.trim() ?? '',
      backTo: document.querySelector('.ut-back')?.getAttribute('aria-label') ?? '',
      hOverflow: document.documentElement.scrollWidth - innerWidth,
      offscreen: [...new Set(offscreen)].slice(0, 12),
      clipped: [...new Set(clipped)].slice(0, 12),
      truncated: [...new Set(truncated)].slice(0, 12),
      small: [...new Set(small)].slice(0, 20),
      squeezed,
    };
  });

for (const sport of sports)
  for (const width of widths) {
    const height = SIZES[width];
    const tag = sport + '-' + width;
    const { page, context, errors } = await fixture(browser, sport, 'Claude QA', width, { viewport: { width, height }, deviceScaleFactor: 2 });
    let n = 0;
    const settle = async (ms = 450) => {
      await page.waitForTimeout(ms);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    };
    const closeDialogs = async () => {
      for (let i = 0; i < 4 && (await page.locator('[role=dialog]').count()); i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(350);
      }
    };
    const mainScroller = () =>
      page.evaluateHandle(() => {
        const d = [...document.querySelectorAll('[role=dialog]')].pop();
        const root = d || document.querySelector('.stage');
        const list = [...root.querySelectorAll('*')].filter((e) => {
          const s = getComputedStyle(e);
          return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 150;
        });
        return list.sort((a, b) => b.clientHeight - a.clientHeight)[0] || null;
      });
    const cap = async (name, expect = {}, pages = 3) => {
      await settle();
      await page.locator('.toast').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      const file = tag + '-' + String(++n).padStart(2, '0') + '-' + name;
      const m = await audit(page);
      await page.screenshot({ path: path.join(artifacts, file + '.png') });
      const shots = [file];
      const el = (await mainScroller()).asElement();
      if (el && pages > 1) {
        for (let i = 1; i < pages; i++) {
          const more = await el.evaluate((e) => {
            if (e.scrollTop + e.clientHeight >= e.scrollHeight - 4) return false;
            e.scrollTop += e.clientHeight * 0.8;
            return true;
          });
          if (!more) break;
          await settle(300);
          const extra = await audit(page);
          for (const k of ['offscreen', 'clipped', 'small', 'squeezed', 'truncated']) m[k] = [...new Set([...m[k], ...extra[k]])];
          await page.screenshot({ path: path.join(artifacts, file + '-s' + i + '.png') });
          shots.push(file + '-s' + i);
        }
        await el.evaluate((e) => (e.scrollTop = 0));
      }
      const bad = [];
      if (m.hOverflow > 0) bad.push('page overflows horizontally by ' + m.hOverflow + 'px');
      if (m.offscreen.length) bad.push('offscreen: ' + m.offscreen.join(' | '));
      if (m.clipped.length) bad.push('clipped: ' + m.clipped.join(' | '));
      if (m.small.length) bad.push('small targets: ' + m.small.join(' | '));
      if (m.squeezed.length) bad.push('squeezed: ' + m.squeezed.join(' | '));
      if (expect.tab && m.tab !== expect.tab) bad.push('tab ' + JSON.stringify(m.tab) + ' expected ' + expect.tab);
      // a sub-screen's back button names its parent tab (the label may fold to just the chevron when a long title needs the room)
      const wantTo = expect.back ? 'Back to ' + expect.back[0] + expect.back.slice(1).toLowerCase() : '';
      if (expect.back !== undefined && (expect.back === 'EXIT' ? m.back !== 'EXIT' : expect.back === '' ? m.backTo !== '' : m.backTo !== wantTo || (m.back && m.back !== expect.back)))
        bad.push('back ' + JSON.stringify(m.back || m.backTo) + ' expected ' + JSON.stringify(expect.back));
      if (expect.title && m.title !== expect.title) bad.push('title ' + JSON.stringify(m.title) + ' expected ' + expect.title);
      failures += bad.length;
      report.push({ screen: file, ...m, shots, problems: bad });
      console.log((bad.length ? 'FAIL ' : 'ok   ') + file + (bad.length ? '\n     ' + bad.join('\n     ') : ''));
    };
    const step = async (name, fn, expect, pages) => {
      try {
        await fn();
        await cap(name, expect, pages);
      } catch (e) {
        failures++;
        console.log('FAIL ' + tag + ' ' + name + ': ' + e.message.split('\n')[0]);
        report.push({ screen: tag + '-' + name, problems: ['step failed: ' + e.message.split('\n')[0]] });
        await closeDialogs();
      }
    };
    const btn = (name) => page.getByRole('button', { name }).first();
    const mainTab = (label) => page.locator('nav.tabs button').filter({ hasText: new RegExp('^\\s*' + label + '\\s*$', 'i') }).first().click();
    const utTab = (label) => page.locator('.ut-tabs button').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).click();
    const seg = (label) => page.locator('.ut-segs [role=tab]').filter({ hasText: new RegExp('^' + label) }).click();
    const back = () => page.locator('.ut-back').click();

    await settle(1200);
    await closeDialogs();
    // ---------- main app ----------
    await step('main-home', async () => {}, { tab: 'HOME' }, 2);
    await step('main-missions', async () => {
      await page.locator('.statchip.quests').click();
      await page.getByRole('dialog').waitFor();
    }, {}, 1);
    await closeDialogs();
    await step('main-gauntlet', async () => {
      await page.locator('.statchip.gauntlet-chip').click();
      await page.getByRole('dialog').waitFor();
    }, {}, 1);
    await closeDialogs();
    await step('main-ranks', () => mainTab('RANKS'), { tab: 'RANKS' });
    await step('main-profile', () => mainTab('PROFILE'), { tab: 'PROFILE' }, 4);
    await step('main-settings', async () => {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('dialog').waitFor();
    }, {}, 2);
    await closeDialogs();
    await mainTab('HOME');
    await settle(300);

    // ---------- Ultimate Team ----------
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs').waitFor();
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
    await closeDialogs();
    await step('ut-home', async () => {}, { tab: 'HOME', back: 'EXIT', title: 'Ultimate Team' }, 4);
    await step('ut-rewards', () => page.locator('.ut-home-inbox').click(), { tab: 'HOME', back: 'HOME', title: 'Rewards' });
    await step('ut-daily', async () => (await back(), page.locator('.ut-home-daily').click()), { tab: 'HOME', back: 'HOME', title: 'Daily' }, 3);
    await step('ut-records', async () => (await back(), page.locator('.uh-form').click()), { tab: 'HOME', back: 'HOME', title: 'Club Records' });
    await back();

    await step('ut-play', () => utTab('PLAY'), { tab: 'PLAY', back: '', title: 'Play' }, 2);
    for (const [row, title] of [
      ['CLUB SEASON', 'Club Season'],
      ['SQUAD BATTLES', 'Squad Battles'],
      ['CHAMPIONS CIRCUIT', 'Champions Circuit'],
      ['LEGENDS EVENTS', 'Legends Events'],
      ['MOMENTS', 'Moments'],
      ['UT DRAFT', 'UT Draft'],
    ])
      await step('ut-play-' + title.toLowerCase().replace(/\s+/g, '-'), async () => {
        await page.locator('.ut-row').filter({ hasText: row }).first().click();
      }, { tab: 'PLAY', back: 'PLAY', title }, 3).then(() => back().catch(() => {}));
    await step('ut-play-rivals', () => page.locator('.up-rivals-top').click(), { tab: 'PLAY', back: 'PLAY', title: 'Rivals' }, 3);
    await back().catch(() => {});

    await step('ut-squad', () => utTab('SQUAD'), { tab: 'SQUAD', back: '', title: 'Squad' }, 2);

    await step('ut-club-players', () => utTab('CLUB'), { tab: 'CLUB', back: '', title: 'Club' }, 2);
    await step('ut-club-filter', async () => {
      await page.locator('.ut-filter-btn').click();
      await page.getByRole('dialog').waitFor();
    }, {}, 2);
    await closeDialogs();
    await step('ut-card-detail', async () => {
      await page.locator('.ut-gridcard').first().click();
      await page.getByRole('dialog').waitFor();
    }, {}, 3);
    await closeDialogs();
    await step('ut-club-storage', () => seg('STORAGE'), { tab: 'CLUB', back: '' });
    await step('ut-club-collection', () => seg('COLLECTION'), { tab: 'CLUB', back: '' }, 3);
    await step('ut-club-sets', () => page.locator('.ut-so-link').filter({ hasText: 'Sets' }).first().click(), { tab: 'CLUB', back: 'CLUB', title: 'Sets' }, 3);
    await back().catch(() => {});
    await step('ut-club-development', () => seg('DEVELOPMENT'), { tab: 'CLUB', back: '' }, 3);
    await step('ut-club-evolutions', () => btn(/EVOLUTIONS LAB/).click(), { tab: 'CLUB', back: 'CLUB', title: 'Evolutions' }, 3);
    await back().catch(() => {});

    await step('ut-challenges-sbc', async () => (await utTab('CHALLENGES'), await seg('SBCs')), { tab: 'CHALLENGES', back: '', title: 'Challenges' }, 4);
    await step('ut-challenges-standouts', () => page.locator('.ut-so-link').filter({ hasText: 'Weekly Standouts' }).first().click(), { tab: 'CHALLENGES', back: 'CHALLENGES', title: 'Weekly Standouts' }, 3);
    await back().catch(() => {});
    await step('ut-challenges-objectives', () => seg('OBJECTIVES'), { tab: 'CHALLENGES', back: '' }, 3);
    await step('ut-challenges-season-pass', () => seg('SEASON PASS'), { tab: 'CHALLENGES', back: '' }, 2);

    await step('ut-store', () => utTab('STORE'), { tab: 'STORE', back: '', title: 'Store' }, 6);
    await step('ut-store-market', () => page.getByRole('tab', { name: 'SCOUT MARKET' }).click(), { tab: 'STORE' }, 3);
    await step('ut-exit', async () => {
      await utTab('HOME');
      await page.locator('.ut-back').click();
      await page.locator('nav.tabs').waitFor();
    }, { tab: 'HOME' }, 1);

    if (errors.length) {
      failures += errors.length;
      console.log('FAIL ' + tag + ' page errors: ' + errors.join(' | '));
    }
    report.push({ screen: tag + '-errors', errors });
    await context.close();
  }
await browser.close();
fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 1));
console.log(failures ? failures + ' problems' : 'all screens clean', '·', report.filter((r) => r.shots).length, 'screens ·', artifacts);
process.exit(failures ? 1 : 0);
