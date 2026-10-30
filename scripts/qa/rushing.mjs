// Codex: real NFL component/input checks in isolated localhost profiles. No player saves are loaded.
import { launch, fixture, shot } from './browser.mjs';
const browser = await launch();
try {
  for (const [width, height] of [
    [390, 844],
    [320, 568],
    [844, 390],
  ].filter(([w]) => !process.env.PS_RUSHING_WIDTH || w === Number(process.env.PS_RUSHING_WIDTH))) {
    const { page, context, current, original, errors } = await fixture(browser, 'nfl', 'Codex Rushing QA', width, { hasTouch: true });
    await page.setViewportSize({ width, height });
    const mount = () =>
      page.evaluate(async () => {
        window.__rushRoot?.unmount();
        const React = (await import('/node_modules/.vite/deps/react.js')).default,
          dom = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { getPool } = await import('/src/ut/pool.ts'),
          { NFL_SLOTS } = await import('/src/ut/squad.ts'),
          { teamsOf } = await import('/src/ut/teams.ts'),
          { newGame } = await import('/src/game/football2/drive.ts'),
          { Football2 } = await import('/src/game/football2/Football2.tsx'),
          { kitsFor } = await import('/src/game/uniforms.ts');
        const pool = await getPool(),
          sq = {},
          used = new Set();
        for (const s of NFL_SLOTS) {
          const options = [...pool.base.values()]
            .filter((c) => c.tier === 'gold' && c.line.pos.includes(s.pos) && !used.has(c.line.name))
            .sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id));
          const c = options[Math.floor(options.length * 0.6)];
          sq[s.id] = { line: c.line, level: 1 };
          used.add(c.line.name);
        }
        const teams = teamsOf('nfl', sq, sq, 'run-audit'),
          k = kitsFor(null, null, 'nfl');
        let seed;
        for (let i = 0; i < 100; i++) {
          const s = 'rushing-ui:' + i;
          if (newGame(teams.offense, teams.rivalDefense, s).run === 'outside') {
            seed = s;
            break;
          }
        }
        if (!seed) throw Error('No outside-run fixture');
        const host = document.createElement('div');
        document.body.append(host);
        const root = (dom.createRoot ?? dom.default.createRoot)(host);
        window.__rushRoot = root;
        window.__rushQA = { attempts: [], progress: [], seed };
        root.render(
          React.createElement(Football2, {
            offense: teams.offense,
            rivalDefense: teams.rivalDefense,
            rivalName: 'LEGEND',
            seed,
            drives: 1,
            practice: { drill: 'run', onAttempt: (a) => window.__rushQA.attempts.push(a) },
            defIQ: 1,
            rival: null,
            ourKit: k.mine,
            theirKit: k.theirs,
            field: k.field,
            timeScale: 0.7,
            onProgress: (p) => window.__rushQA.progress.push(p),
            onDone: (p) => (window.__rushQA.done = p),
          }),
        );
      });
    const start = async () => {
      await mount();
      await page.getByRole('button', { name: 'SNAP', exact: true }).waitFor();
      if (width === 390)
        await page.locator('.arcade-full').evaluate((el) => {
          el.style.setProperty('--sat', '59px');
          el.style.setProperty('--sab', '34px');
        });
      await page.getByRole('radio', { name: /Outside Zone/ }).waitFor();
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      await page.getByRole('button', { name: /Juke: evade/ }).waitFor();
    };
    const finish = async () => {
      await page.waitForFunction(() => window.__rushQA.attempts.length > 0, null, { timeout: 25000 });
      return page.evaluate(() => window.__rushQA.attempts[0]);
    };
    await start();
    const baseline = await finish();
    await start();
    // A full normal stick push after the handoff must steer without triggering a spin, then hold
    // the called lane exactly as no-input running does. The old 46px flick threshold failed this.
    const x = width > 600 ? width * 0.35 : 65,
      y = height * 0.7;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(width > 600 ? x + 50 : x, width > 600 ? y : y - 50, { steps: 2 });
    await page.waitForTimeout(150);
    if (await page.getByText('SPIN MOVE!', { exact: true }).count()) throw Error('Normal thumb-stick push triggered a spin');
    for (const name of [/Juke: evade/, /Spin: evade/, /Power: truck/]) {
      const b = await page.getByRole('button', { name }).boundingBox();
      if (!b || b.x < 0 || b.y < 0 || b.x + b.width > width + 1 || b.y + b.height > height + 1) throw Error('Move control outside screen');
      if (width === 390 && b.y + b.height > height - 34) throw Error('Move control inside phone home-indicator strip');
    }
    await shot(page, 'rushing-controls-' + width);
    const straight = await finish();
    await page.mouse.up();
    if (straight.yards !== baseline.yards || straight.detail !== baseline.detail)
      throw Error('Neutral forward stick overrides called lane');
    if (width === 390) {
      for (const button of [/Juke: evade/, /Spin: evade/, /Power: truck/]) {
        await start();
        await page
          .getByRole('button', { name: button })
          .dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 330, clientY: 640, buttons: 1 });
        await page.waitForTimeout(180);
        await shot(page, 'rushing-move-' + String(button).split(':')[0].replace(/\W/g, ''));
        const result = await finish();
        console.log(JSON.stringify({ move: String(button), attempt: result }));
      }
    }
    const pixels = await page.locator('.hg2-canvas').evaluate((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        s = new Set();
      for (let i = 0; i < d.length; i += 64) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      return s.size;
    });
    await page.evaluate(() => window.__rushRoot.unmount());
    const after = await current();
    if (
      original.ut.owned.some(
        (card) => !after.ut.owned.some((c) => Object.entries(card).every(([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v))),
      )
    )
      throw Error('Running QA altered original progression');
    if (errors.length) throw Error(errors.join(';'));
    if (pixels < 30) throw Error('Empty football canvas');
    console.log(
      JSON.stringify({
        width,
        height,
        baseline,
        normalStick: straight,
        normalStickDoesNotSpin: true,
        moveControls: true,
        canvasColors: pixels,
        originalCards: original.ut.owned.length,
        errors,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
