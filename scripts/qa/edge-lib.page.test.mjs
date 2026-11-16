// Claude (studio overhaul, shell-1 fix, 2026-11-16): edge-lib's page audits on a static page in a real
// Chromium (no app, no network). Guards the review finding that text inside a closed <details> under
// the card-detail bar was reported as "showing below the bar", and could enter auditScreen's lists.
// Runs once (the NBA pass of `npm test`) and only where Playwright resolves; it never opens a URL.
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditScreen, detailBarAudit } from './edge-lib.mjs';

const req = createRequire(process.env.PS_QA_PACKAGE_JSON || import.meta.url);
let chromium = null;
try {
  ({ chromium } = req('playwright'));
} catch {
  chromium = null;
}
const run = !!chromium && !process.env.PS_SPORT;

// A 393×852 sheet at its end: a closed <details> whose rows Chromium still lays out (unpainted) in the
// 60 px strip between a floating action bar and the sheet's bottom, where they hit-test to the sheet
// itself (the reviewed NFL card), a tiny label inside it, and optionally one visible row in the strip.
const sheet = (withVisibleRow) => `<!doctype html><html><body style="margin:0;background:#04121a;color:#fff;font:16px/20px sans-serif">
<div class="scrim"><div class="sheet" role="dialog" style="position:fixed;left:0;right:0;bottom:0;height:500px;overflow:auto;background:#0b1a22">
  <div style="height:404px">Header</div>
  <div class="ut-detail-btns" style="position:fixed;left:0;right:0;bottom:60px;height:60px;background:#123"><button style="width:120px;height:60px">QUICK SELL</button></div>
  <details><summary style="display:block;height:44px">ALL 13 ATTRIBUTES</summary>
    <div style="height:20px">Run block 31</div><div style="height:20px">Break tackle 81</div><div style="height:20px;font-size:8px">Juke move 98</div>
  </details>
  ${withVisibleRow ? '<div style="height:20px">Visible row</div>' : ''}
</div></div></body></html>`;

describe.skipIf(!run)('edge-lib page audits (real Chromium, static page)', () => {
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

  const placeRows = async () => {
    await page.evaluate(() => {
      const s = document.querySelector('.sheet');
      s.scrollTop = s.scrollHeight;
    });
    return page.evaluate(() => {
      const bar = document.querySelector('.ut-detail-btns').getBoundingClientRect();
      const sheet = document.querySelector('.sheet').getBoundingClientRect();
      const range = document.createRange();
      const out = {};
      for (const el of document.querySelectorAll('details div, .sheet > div')) {
        range.selectNodeContents(el);
        const r = [...range.getClientRects()][0];
        if (r) out[el.textContent.trim()] = { top: r.top, bottom: r.bottom, inStrip: r.bottom > bar.bottom + 1 && r.top < sheet.bottom - 1, hit: document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)?.className ?? null, visible: el.checkVisibility() };
      }
      return out;
    });
  };

  it('does not count closed <details> text under the bar, but does count a visible row', async () => {
    await page.setContent(sheet(true));
    const rows = await placeRows();
    // the scenario is the reviewed one: hidden rows sit in the strip, and one hit-tests to the sheet itself
    expect(rows['Run block 31']).toMatchObject({ visible: false, inStrip: true });
    expect(rows['Break tackle 81']).toMatchObject({ visible: false, inStrip: true, hit: 'sheet' });
    expect(rows['Visible row']).toMatchObject({ visible: true, inStrip: true });
    const a = await detailBarAudit(page);
    expect(a.gap).toBeCloseTo(60, 0);
    expect(a.textBelowBar).not.toContain('Run block 31');
    expect(a.textBelowBar).not.toContain('Break tackle 81');
    expect(a.textBelowBar).not.toContain('Juke move 98');
    expect(a.textBelowBar).toEqual(['Visible row']);
  });

  it('reports nothing below the bar when only closed <details> text is there', async () => {
    await page.setContent(sheet(false));
    const rows = await placeRows();
    expect(rows['Juke move 98']).toMatchObject({ visible: false, inStrip: true, hit: 'sheet' });
    const a = await detailBarAudit(page);
    expect(a.textBelowBar).toEqual([]);
  });

  it('keeps closed <details> text out of auditScreen (tiny, contrast, band)', async () => {
    await page.setContent(sheet(true));
    await placeRows();
    const s = await auditScreen(page, { w: 393, h: 852, insets: [59, 0, 34, 0] });
    expect(s.tiny.join('|')).not.toMatch(/Juke move/);
    expect(s.lowContrast.join('|')).not.toMatch(/Run block|Break tackle|Juke move/);
    // opening the <details> makes the same tiny label count again (the check still works)
    await page.evaluate(() => {
      document.querySelector('details').open = true;
      document.querySelector('details').scrollIntoView({ block: 'start' });
    });
    const open = await auditScreen(page, { w: 393, h: 852, insets: [59, 0, 34, 0] });
    expect(open.tiny.join('|')).toMatch(/Juke move/);
  });
});
