// Implemented by Codex. Actual match components, real rated fixture squads, isolated localhost profiles.
import { launch, fixture, shot } from './browser.mjs';
const browser = await launch();
try {
  for (const sport of ['nba', 'nfl']) {
    const { page, context, errors, original, current } = await fixture(browser, sport, 'Codex Gameplay QA');
    const mount = async (auto) =>
      page.evaluate(
        async ({ sport, auto }) => {
          const React = (await import('/node_modules/.vite/deps/react.js')).default;
          const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
          const createRoot = dom.createRoot ?? dom.default.createRoot;
          const { loadProfile } = await import('/src/lib/profile.ts');
          const { getPool } = await import('/src/ut/pool.ts');
          const { teamsOf } = await import('/src/ut/teams.ts');
          const { kitsFor } = await import('/src/game/uniforms.ts');
          const pool = await getPool(),
            profile = loadProfile(),
            sq = {};
          for (const [slot, uid] of Object.entries(profile.ut.squad)) {
            const owned = profile.ut.owned.find((c) => c.uid === uid);
            if (owned) sq[slot] = { line: pool.byId.get(owned.cardId), level: owned.level };
          }
          const teams = teamsOf(sport, sq, sq, 'gameplay-qa'),
            k = kitsFor(null, null, sport);
          window.__gameQARoot?.unmount();
          const host = document.createElement('div');
          document.body.append(host);
          const root = createRoot(host);
          window.__gameQARoot = root;
          window.__gameQA = { done: false, updates: 0 };
          const props = {
            seed: 'gameplay-qa:' + sport,
            rivalName: 'LEGEND',
            rival: null,
            defIQ: 1,
            autoplayHook: auto,
            timeScale: auto ? 6 : 1,
            ourKit: k.mine,
            theirKit: k.theirs,
            onProgress: (p) => {
              window.__gameQA.updates++;
              window.__gameQA.last = p;
            },
            onDone: (p) => {
              window.__gameQA.done = true;
              window.__gameQA.last = p;
            },
          };
          if (sport === 'nba') {
            const { Hoops2 } = await import('/src/game/hoops2/Hoops2.tsx');
            root.render(
              React.createElement(Hoops2, { ...props, five: teams.five, rivalFive: teams.rivalFive, possessions: 4, court: k.court }),
            );
          } else {
            const { Football2 } = await import('/src/game/football2/Football2.tsx');
            root.render(
              React.createElement(Football2, {
                ...props,
                offense: teams.offense,
                rivalDefense: teams.rivalDefense,
                drives: 1,
                field: k.field,
              }),
            );
          }
        },
        { sport, auto },
      );
    await mount(false);
    await page.locator('.hg2-canvas').waitFor();
    await page.locator('.fg-loading').waitFor({ state: 'detached' });
    if(sport==='nba')await page.waitForFunction(()=>/^\d+$/.test(document.querySelector('.hg2-bug .mid em')?.textContent??''));
    if (sport === 'nba') {
      const shoot = page.getByRole('button', { name: 'Shoot: hold, and let go in the green' });
      await shoot.waitFor();
      const b = await shoot.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(500);
      await shot(page, 'gameplay-nba-release');
      await page.mouse.up();
    } else {
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      await page.waitForTimeout(450);
      await page.mouse.move(190, 420);
      await page.mouse.down();
      await page.mouse.move(190, 510, { steps: 8 });
      await shot(page, 'gameplay-nfl-aim');
      await page.mouse.up();
    }
    await page.waitForTimeout(1000);
    await shot(page, 'gameplay-' + sport + '-action');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(250);
    await shot(page, 'gameplay-' + sport + '-320');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(250);
    await shot(page, 'gameplay-' + sport + '-landscape');
    await page.setViewportSize({ width: 390, height: 844 });
    const pixels = await page.locator('.hg2-canvas').evaluate((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        colors = new Set();
      for (let i = 0; i < d.length; i += 64) colors.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      return colors.size;
    });
    if (pixels < 30) throw Error('Empty gameplay canvas');
    await mount(true);
    await page.waitForFunction(() => window.__gameQA?.done, null, { timeout: 90000 });
    const result = await page.evaluate(() => window.__gameQA);
    if (!Number.isFinite(result.last?.score) || !result.updates) throw Error('Match did not finish with valid progress');
    await page.evaluate(() => window.__gameQARoot.unmount());
    const after = await current();
    if (original.ut.owned.some(card=>!after.ut.owned.some(c=>Object.entries(card).every(([k,v])=>JSON.stringify(c[k])===JSON.stringify(v))))) throw Error('Gameplay changed original owned copies');
    if (errors.length) throw Error(errors.join('; '));
    console.log(
      JSON.stringify({
        sport,
        manualPointerInput: true,
        canvasColors: pixels,
        autoplayResult: result.last,
        originalCopies: original.ut.owned.length,
        errors,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
