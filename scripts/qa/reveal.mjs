// Implemented by Codex. Motion preview fixtures; these are not real pulls or global mint claims.
import { launch, fixture, artifacts } from './browser.mjs';
import path from 'node:path';
const browser = await launch();
try {
  for (const [tier, width, height, reduce] of [
    ['goat', 390, 844, false],
    ['spotlight', 390, 844, false],
    ['goat', 320, 568, true],
  ]) {
    const { page, context, errors } = await fixture(browser, 'nba', 'Codex Reveal QA', width);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    if (width === 390) {
      await page.evaluate(() => {
        window.__psInsets = [59, 0, 34, 0];
        window.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(120);
    }
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.getByRole('button', { name: /Take on the greats/ }).waitFor();
    const render = () =>
      page.evaluate(async (tier) => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
        const createRoot = dom.createRoot ?? dom.default.createRoot;
        const { PackOpening } = await import('/src/ut/PackOpening.tsx');
        const { getPool } = await import('/src/ut/pool.ts');
        const pool = await getPool(),
          rc = [...pool.base.values()].find((c) => c.tier === tier && c.line.name === 'Michael Jordan');
        const host = document.createElement('div');
        host.className = 'ut-qa-preview';
        host.style.cssText = 'position:absolute;inset:0;z-index:1000';
        document.querySelector('.stage').append(host);
        const root = createRoot(host);
        root.render(
          React.createElement(PackOpening, {
            opening: { id: 'qa-preview', kind: 'spotlight', title: 'Spotlight Pack', cards: [{ uid: 'qa-preview', rc }], mint: { serial: 8, total: 20 } },
            onDone: () => {
              root.unmount();
              host.remove();
            },
          })
        );
      }, tier);
    await render();
    const dialog = page.getByRole('dialog', { name: 'Opening Spotlight Pack', exact: true });
    await dialog.waitFor();
    await page.screenshot({ path: path.join(artifacts, `qa-${tier}-pack-${width}.png`), timeout: 12000, animations: 'allow' });
    await dialog.click({ position: { x: 20, y: 100 } });
    if (!reduce) {
      await page.locator('.ut-open-screen.st-1').waitFor();
      await page.screenshot({ path: path.join(artifacts, `qa-${tier}-position-${width}.png`), timeout: 12000, animations: 'allow' });
    }
    await page.locator('.ut-open-screen.st-4').waitFor({ timeout: 12000 });
    await page.waitForTimeout(reduce ? 0 : 150);
    const card = await page.locator('.ut-walk-card').boundingBox(),
      number = await page.locator('.ut-rare-number').boundingBox(),
      hint = await page.locator('.ut-walk .ut-tear-hint').boundingBox();
    await page.screenshot({ path: path.join(artifacts, `qa-${tier}-layout-${width}.png`), timeout: 12000, animations: 'allow' });
    console.log(JSON.stringify({ tier, width, height, card, number, hint }));
    if (!card || !number || !hint || card.y < 0 || number.y + number.height > hint.y || card.x < 0 || card.x + card.width > width)
      throw Error('Rare reveal overflows or overlaps its continue hint');
    const skipBox = await page.getByRole('button', { name: 'SKIP', exact: true }).boundingBox();
    if (width === 390 && (!skipBox || skipBox.y < 59 || hint.y + hint.height > height - 34)) throw Error('Reveal controls intrude into simulated safe areas');
    if (reduce) {
      const animated = await page.locator('.ut-rare-reveal').evaluate((el) => [...el.querySelectorAll('*')].some((e) => getComputedStyle(e).animationName !== 'none'));
      if (animated) throw Error('Reduced-motion reveal still animates');
    }
    await page.screenshot({ path: path.join(artifacts, `qa-${tier}-reveal-${width}.png`), timeout: 12000, animations: 'allow' });
    await dialog.click({ position: { x: 20, y: 100 } });
    await page.getByRole('button', { name: 'DONE', exact: true }).waitFor({ timeout: 7000 });
    await page.getByRole('button', { name: 'DONE', exact: true }).click();
    // An early tear skip must remain on the final card rather than restarting the timer at position.
    await render();
    await dialog.waitFor();
    await dialog.click({ position: { x: 20, y: 100 } });
    await page.getByRole('button', { name: 'SKIP', exact: true }).click();
    await page.waitForTimeout(1500);
    if (!reduce && !(await page.locator('.ut-open-screen.st-4 .ut-walk-card').count())) throw Error('Early skip restarted the reveal');
    if (reduce && !(await page.locator('.ut-reveal').count())) throw Error('Reduced-motion skip did not finish');
    if (errors.length) throw Error(errors.join(';'));
    console.log(JSON.stringify({ tier, width, height, reducedMotion: reduce, copyNumberShown: true, skipStable: true, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
