// Codex: presentation fixtures only. These cards/numbers are never deposited or minted.
import { launch, fixture, artifacts } from './browser.mjs';
import path from 'node:path';
const browser = await launch();
const shot = (page, name) => page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'allow', timeout: 12000 });
try {
  for (const [tier, sport, width, height, reduce] of [
    ['goat', 'nba', 390, 844, false],
    ['spotlight', 'nba', 390, 844, false],
    ['gold', 'nba', 390, 844, false],
    ['legend', 'nfl', 390, 844, false],
    ['goat', 'nba', 320, 568, false],
    ['goat', 'nfl', 844, 390, false],
    ['goat', 'nba', 320, 568, true],
  ].filter((_, i) => !process.env.PS_CINEMA_CASES || process.env.PS_CINEMA_CASES.split(',').map(Number).includes(i))) {
    const record = tier === 'goat' && width === 390;
    const f = await fixture(browser, sport, 'Codex Pack Cinema', width, {
      hasTouch: true,
      ...(record ? { recordVideo: { dir: path.join(artifacts, 'cinema-video'), size: { width, height } } } : {}),
    });
    const { page, context, errors, current } = f;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    if (width === 390)
      await page.evaluate(() => {
        window.__psInsets = [59, 0, 34, 0];
        window.dispatchEvent(new Event('resize'));
      });
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.route('**/functions/v1/card-registry?**', async (route) => {
      const u = new URL(route.request().url());
      if (u.searchParams.get('ns') !== 'packart') return route.continue();
      const ids = JSON.parse(u.searchParams.get('ids') || '[]');
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          activeCounts: Object.fromEntries(ids.map((id) => [id, 20])),
          versions: Object.fromEntries(ids.map((id) => [id, 1])),
        }),
      });
    });
    const render = () =>
      page.evaluate(
        async ({ tier }) => {
          window.__packRoot?.unmount();
          const React = (await import('/node_modules/.vite/deps/react.js')).default,
            dom = await import('/node_modules/.vite/deps/react-dom_client.js');
          const { PackOpening } = await import('/src/ut/PackOpening.tsx'),
            { getPool } = await import('/src/ut/pool.ts');
          const pool = await getPool(),
            rc = [...pool.base.values()].find((c) => c.tier === tier && (tier !== 'gold' || c.ovr >= 90));
          const host = document.createElement('div');
          host.dataset.cinemaFixture = 'true';
          host.style.cssText = 'position:absolute;inset:0;z-index:1000';
          document.querySelector('.stage').append(host);
          const root = (dom.createRoot ?? dom.default.createRoot)(host);
          window.__packRoot = root;
          root.render(
            React.createElement(PackOpening, {
              opening: {
                id: 'cinema-fixture',
                kind: tier === 'gold' ? 'gold' : 'spotlight',
                title: 'Cinema Preview Pack',
                cards: [
                  {
                    uid: 'visual-only',
                    rc,
                    mint: { serial: 8, totalAtPull: 20, activeAtPull: 20, requestId: 'visual-only', namespace: 'packart' },
                  },
                ],
                mint: { serial: 8, total: 20 },
              },
              onDone: () => {
                root.unmount();
                host.remove();
              },
            }),
          );
        },
        { tier },
      );
    await render();
    const dialog = page.getByRole('dialog', { name: 'Opening Cinema Preview Pack' });
    await dialog.waitFor();
    await page.waitForTimeout(350);
    const suffix = `${tier}-${sport}-${width}${reduce ? '-reduced' : ''}`;
    await shot(page, 'cinema-sealed-' + suffix);
    // Sealed art cannot advertise GOAT: the surprise only belongs to the actual reveal.
    if (await page.locator('.ut-cinema-limit,.ut-rare-crown').count()) throw Error('Rarity leaked before opening');
    await page.getByRole('button', { name: /BREAK THE SEAL/ }).focus();
    await page.keyboard.press('Enter');
    if (!reduce) {
      await page.locator('.st-1').waitFor({ timeout: 5000 });
      await shot(page, 'cinema-clue-' + suffix);
      if (tier === 'goat') {
        await page.locator('.is-surge.st-2 .ut-cinema-limit').waitFor({ timeout: 5000 });
        await page.waitForTimeout(180);
        await shot(page, 'cinema-breach-' + suffix);
      }
    }
    await page.locator('.st-4').waitFor({ timeout: 12000 });
    await page.waitForTimeout(180);
    const card = await page.locator('.ut-walk-card').boundingBox(),
      next = await page.getByRole('button', { name: /TAP TO CONTINUE/ }).boundingBox(),
      skip = await page.getByRole('button', { name: 'SKIP', exact: true }).boundingBox();

    if (
      !card ||
      !next ||
      !skip ||
      card.x < 0 ||
      card.y < 0 ||
      card.x + card.width > width + 1 ||
      card.y + card.height > height + 1 ||
      next.x < 0 ||
      next.x + next.width > width + 1 ||
      (card.x < next.x + next.width && card.x + card.width > next.x && card.y < next.y + next.height && card.y + card.height > next.y) ||
      next.y + next.height > height + 1
    )
      throw Error('Cinematic card/controls overflow: ' + JSON.stringify({ card, next, skip }));
    if (width === 390 && (skip.y < 59 || next.y + next.height > height - 34)) throw Error('Controls overlap phone safe areas');
    const number = await page.locator('.ut-rare-number').count() ? await page.locator('.ut-rare-number').boundingBox() : null;
    if (
      number &&
      [card, next].some(
        (b) => number.x < b.x + b.width && number.x + number.width > b.x && number.y < b.y + b.height && number.y + number.height > b.y,
      )
    )
      throw Error('Copy number overlaps card or continue: ' + JSON.stringify({ card, number, next }));
    if (reduce) {
      if (await page.locator('.ut-cinema-fx').count()) throw Error('Reduced motion started particles');
      if (await dialog.evaluate((el) => [...el.querySelectorAll('*')].some((n) => getComputedStyle(n).animationName !== 'none')))
        throw Error('Reduced motion animates');
    }
    await shot(page, 'cinema-final-' + suffix);
    await page.getByRole('button', { name: /TAP TO CONTINUE/ }).click();
    await page.getByRole('button', { name: 'DONE', exact: true }).waitFor();
    await page.getByRole('button', { name: 'DONE', exact: true }).click();
    const baseline = (await current()).ut.owned.map((c) => [c.uid, c.cardId, c.level, c.xp]);
    // Skip during the tear, and again during the walkout; no late timers or canvas may restart it.
    for (const when of ['tear', 'walkout']) {
      await render();
      await page.getByRole('button', { name: /BREAK THE SEAL/ }).click();
      await page.locator(reduce ? '.st-4' : when === 'tear' ? '.ph-tear' : '.st-1').waitFor();
      await page.getByRole('button', { name: 'SKIP', exact: true }).click();
      await page.waitForTimeout(1400);
      if (!(await page.locator(reduce ? '.ut-reveal' : '.st-4').count()) || (await page.locator('.ut-cinema-fx').count()))
        throw Error('Skip failed to cancel the cinematic');
      if (!reduce) await page.getByRole('button', { name: /TAP TO CONTINUE/ }).click();
      await page.getByRole('button', { name: 'DONE', exact: true }).waitFor();
      await page.getByRole('button', { name: 'DONE', exact: true }).click();
      if (reduce) break;
    }
    if (JSON.stringify((await current()).ut.owned.map((c) => [c.uid, c.cardId, c.level, c.xp])) !== JSON.stringify(baseline))
      throw Error('Presentation changed inventory');
    if (errors.length) throw Error(errors.join(';'));
    console.log(
      JSON.stringify({
        tier,
        sport,
        width,
        height,
        reducedMotion: reduce,
        card,
        next,
        keyboardOpen: true,
        skipCancelled: true,
        inventoryPreserved: true,
        errors,
      }),
    );
    const video = page.video();
    await context.close();
    if (record) console.log(JSON.stringify({ video: await video.path() }));
  }
} finally {
  await browser.close();
}
