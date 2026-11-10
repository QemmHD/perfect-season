import { launch, fixture, settle, shot, audit, blocked } from './lib.mjs';
const browser = await launch();
try {
  for (const dev of ['393']) {
    const { page, context, errors } = await fixture(browser, 'soccer', dev);
    await page.locator('.home .playbar').waitFor({ timeout: 60000 });
    await settle(page, 1500);
    const info = await page.evaluate(() => {
      const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { y: +r.top.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1), x: +r.left.toFixed(1), r: +r.right.toFixed(1) }; };
      return {
        standaloneMQ: matchMedia('(display-mode: standalone)').matches,
        htmlMinH: getComputedStyle(document.documentElement).minHeight,
        htmlH: document.documentElement.getBoundingClientRect().height, inner: innerHeight,
        docScroll: document.scrollingElement.scrollHeight - innerHeight,
        sat: getComputedStyle(document.querySelector('.stage')).getPropertyValue('--sat'),
        topbar: q('.topbar'), ring: q('.level-ring'), eyebrow: q('.level-text .eyebrow'), bar: q('.level-text .bar'), xp: q('.level-text .xp'), coins: q('.coins'), icon: q('.topbar .icon-btn'), logo: q('.logo'), sportswitch: q('.sportswitch'), hero: q('.hero'), play: q('.home .playbar'), tabs: q('.tabs'),
        fontLoaded: document.fonts.check('900 italic 20px Archivo'),
      };
    });
    console.log(JSON.stringify(info, null, 1));
    console.log(JSON.stringify(await audit(page), null, 1));
    await shot(page, 'proto-soccer-home-' + dev);
    console.log('errors', errors, 'blocked', [...new Set(blocked)]);
    await context.close();
  }
} finally { await browser.close(); }
