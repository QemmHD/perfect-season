// Reproduce the owner's iPhone header look by simulating iOS 26's top scroll-edge effect
// (blur + dim from 0 to sat+24pt, fading over the last 24pt), then show a candidate fix
// (injected CSS only; nothing in the repo changes).
import { launch, fixture, settle, shot } from './lib.mjs';
const browser = await launch();
const EDGE_CSS = (sat) => `#__edge{position:fixed;left:0;right:0;top:0;height:${sat + 26}px;z-index:99999;pointer-events:none;
  backdrop-filter:blur(2.6px) brightness(.66);-webkit-backdrop-filter:blur(2.6px) brightness(.66);
  -webkit-mask-image:linear-gradient(180deg,#000 0,#000 ${sat + 12}px,transparent ${sat + 26}px);mask-image:linear-gradient(180deg,#000 0,#000 ${sat + 12}px,transparent ${sat + 26}px)}`;
const FIX_CSS = `.stage{--edge:22px}
.shell-top{padding-top:calc(var(--sat) + var(--edge))!important}
.shell-views{top:calc(var(--sat) + var(--edge) + var(--top-h))!important}
.screen{padding-top:calc(var(--sat) + var(--edge))!important}`;
try {
  for (const [sport, dev] of [['soccer', '393'], ['nba', '430'], ['nfl', '393']]) {
    const { page, context } = await fixture(browser, sport, dev);
    await page.locator('.home .playbar').waitFor({ timeout: 60000 });
    await settle(page, 1200);
    const sat = await page.evaluate(() => window.__psInsets[0]);
    await shot(page, `edge-${sport}-${dev}-1-chromium`);
    await page.evaluate((css) => { const s = document.createElement('style'); s.id = '__edgecss'; s.textContent = css; document.head.append(s); const d = document.createElement('div'); d.id = '__edge'; document.body.append(d); }, EDGE_CSS(sat));
    await settle(page, 300);
    await shot(page, `edge-${sport}-${dev}-2-ios26-sim`);
    await page.evaluate((css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); window.dispatchEvent(new Event('resize')); }, FIX_CSS);
    await settle(page, 500);
    const geo = await page.evaluate(() => { const q = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && [Math.round(r.top), Math.round(r.bottom)]; }; return { ring: q('.level-ring'), eyebrow: q('.level-text .eyebrow'), play: q('.home .playbar'), tabs: q('.tabs'), hero: q('.hero'), modes: q('.modes') }; });
    console.log(sport, dev, 'with fix', JSON.stringify(geo));
    await shot(page, `edge-${sport}-${dev}-3-fix-sim`);
    // UT home with the effect and the fix
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
    await settle(page, 1200);
    await shot(page, `edge-${sport}-${dev}-4-ut-fix-sim`);
    await page.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('--edge:22px')) s.remove(); }));
    await settle(page, 400);
    await shot(page, `edge-${sport}-${dev}-5-ut-ios26-sim`);
    await context.close();
  }
} finally { await browser.close(); }
