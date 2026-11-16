// nba-3's captures (plan task nba-3 "Screenshots"; Claude 2026-11-16), each a real lab game, isolated:
// a jump-shot release with the defender visible, the Clutch bug, the OT bug (phase forced through the
// dev probe until nba-6 plays overtime), the 320 rim area, Jokić / Dončić / a renamed same-surname
// pair on the chips, the scorer plate, 852 sideways, the reduced-motion frame and the rematch
// curtain (nba-held.mjs takes that one).
//   node scripts/audit/nba-frame-shots.mjs
import { context, launch, needServer, openLab, shot, wait } from './nba-lib.mjs';

/** wait until the probe sees a jump shot in the air, then capture */
async function atRelease(page, name, timeoutMs = 60000) {
  await page.waitForFunction(() => {
    const p = window.__hg2?.possession();
    return p?.ball?.kind === 'shot' && !['layup', 'dunk', 'contact', 'standdunk', 'oop'].includes(p.ball.shot) && p.t - p.ball.t0 < 0.12;
  }, null, { timeout: timeoutMs, polling: 'raf' });
  return shot(page, name);
}

await needServer();
const browser = await launch();
try {
  // 393: a release, the clutch bug, the OT bug, the scorer plate
  {
    const { page, errors } = await context(browser, '393');
    await openLab(page, { seed: 'shots-rel', auto: '' });
    await atRelease(page, 'nba3-393-release').catch(() => null);
    await page.waitForFunction(() => /PTS/.test(document.querySelector('.ps-toast')?.textContent ?? ''), null, { timeout: 90000, polling: 200 }).catch(() => null);
    await shot(page, 'nba3-393-scorer-plate');
    await page.evaluate(() => window.__hg2.skipTo(13));
    await page.waitForFunction(() => document.querySelector('.ps-bug.ph-clutch'), null, { timeout: 30000 });
    await wait(600);
    await shot(page, 'nba3-393-clutch-bug');
    await page.evaluate(() => window.__hg2.phase('ot'));
    await wait(300);
    await shot(page, 'nba3-393-ot-bug');
    console.log('393', errors);
  }
  // 320: the rim area, played (the controls up)
  {
    const { page, errors } = await context(browser, '320');
    await openLab(page, { seed: 'shots-320' });
    await wait(1500);
    await shot(page, 'nba3-320-rim-area');
    console.log('320', errors);
  }
  // names: Jokić, Dončić and a Johnson pair on the court (the tags the game would give them)
  {
    const { page, errors } = await context(browser, '393');
    await openLab(page, { seed: 'shots-names', auto: '' });
    await page.evaluate(async () => {
      const { uniqueTags } = await import('/src/game/hoops2/labels.ts');
      const g = window.__hg2.game();
      const names = ['Nikola Jokić', 'Luka Dončić', 'Joe Johnson', 'Magic Johnson', 'Dražen Petrović'];
      const tags = uniqueTags(names.map((n) => ({ name: n, tag: n.split(' ').slice(1).join(' ').toUpperCase() })));
      // the next possession is built from the game's five: rename them for the capture
      g.ours.forEach((h, i) => Object.assign(h, { name: names[i], tag: tags[i] }));
    });
    // wait for the next possession, then a frame with a pass target showing
    const start = await page.evaluate(() => window.__hg2.game().done);
    await page.waitForFunction((d) => window.__hg2.game().done > d && window.__hg2.possession()?.t > 1.2, start, { timeout: 60000 });
    await shot(page, 'nba3-393-name-chips');
    await wait(900);
    await shot(page, 'nba3-393-name-chips-2');
    console.log('names', errors);
  }
  // 852 sideways, and the reduced-motion frame
  {
    const { page, errors } = await context(browser, '852land');
    await openLab(page, { seed: 'shots-land' });
    await wait(1500);
    await shot(page, 'nba3-852land');
    console.log('852land', errors);
  }
  {
    const { page, errors } = await context(browser, '393', { motion: 'reduce' });
    await openLab(page, { seed: 'shots-rm' });
    await wait(1200);
    await shot(page, 'nba3-393-reduced-motion');
    console.log('reduced', errors);
  }
} finally {
  await browser.close();
}
