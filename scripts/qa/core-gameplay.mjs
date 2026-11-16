// Codex: real pointer/keyboard input, responsive bounds and profile preservation for the core overhaul.
import assert from 'node:assert/strict';
import { launch, fixture, shot, artifacts } from './browser.mjs';
const browser = await launch();
try {
  for (const [sport, mode] of [
    ['nba', 'court'],
    ['nfl', 'pass'],
    ['nfl', 'run']
  ]) {
    const { page, context, errors, original, current } = await fixture(browser, sport, 'Codex Core QA', 390, {
      reducedMotion: 'no-preference',
      recordVideo: { dir: artifacts, size: { width: 390, height: 844 } }
    });
    const mount = async (auto) =>
      page.evaluate(
        async ({ sport, auto, mode }) => {
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
          // Claude (nfl-2 review fix): the run check holds BURST on D, which needs the Burst-button preference
          try {
            if (sport === 'nfl' && mode === 'run') localStorage.setItem('perfect-season:fb2-burst-button', '1');
            else localStorage.removeItem('perfect-season:fb2-burst-button');
          } catch {}
          const host = document.createElement('div');
          document.body.append(host);
          const root = createRoot(host);
          window.__gameQARoot = root;
          window.__gameQA = { done: false, updates: 0 };
          const props = {
            ...(sport === 'nfl'
              ? {
                  practice: {
                    drill: mode === 'run' ? 'run' : 'throw',
                    onAttempt: (a) => {
                      window.__gameQA.attempt = a;
                    }
                  }
                }
              : {}),
            seed: 'gameplay-qa:' + sport,
            rivalName: 'LEGEND',
            rival: null,
            defIQ: 1,
            autoplayHook: auto,
            timeScale: auto ? 6 : 0.5,
            ourKit: k.mine,
            theirKit: k.theirs,
            onProgress: (p) => {
              window.__gameQA.updates++;
              window.__gameQA.last = p;
            },
            onDone: (p) => {
              window.__gameQA.done = true;
              window.__gameQA.last = p;
            }
          };
          if (sport === 'nba') {
            const { Hoops2 } = await import('/src/game/hoops2/Hoops2.tsx');
            root.render(React.createElement(Hoops2, { ...props, five: teams.five, rivalFive: teams.rivalFive, possessions: 4, court: k.court }));
          } else {
            const { Football2 } = await import('/src/game/football2/Football2.tsx');
            root.render(
              React.createElement(Football2, {
                ...props,
                offense: teams.offense,
                rivalDefense: teams.rivalDefense,
                drives: 1,
                field: k.field
              })
            );
          }
        },
        { sport, auto, mode }
      );

    await mount(false);
    await page.locator('.fg-loading').waitFor({ state: 'detached' });
    if (sport === 'nba') {
      await page.waitForFunction(() => /^\d+$/.test(document.querySelector('.hg2-bug .mid em')?.textContent ?? ''));
      await page.getByRole('button', { name: /screen and roll/i }).click();
      const shoot = page.getByRole('button', { name: 'Shoot: hold, and let go in the green' });
      await shoot.focus();
      await page.keyboard.down('Space');
      await page.waitForTimeout(180);
      await page.keyboard.up('Space');
      await shot(page, 'core-nba-live');
      // A canceled pointer is not a teammate tap or a shot release.
      await page.mouse.move(180, 300);
      await page.mouse.down();
      await page.locator('.hg2-swipe').dispatchEvent('pointercancel', { pointerId: 1, clientX: 180, clientY: 300 });
      await page.mouse.up();
    } else if (mode === 'pass') {
      // Claude (nfl-2 review fix): the V2 pocket. C cycles TOUCH → BULLET → LOB; the receivers are
      // name chips over their heads (thrown on touch-down); A is RUN IT / THROW AWAY.
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      const c = page.locator('[data-ctl="C"]');
      for (let i = 0; i < 3 && (await c.getAttribute('data-type')) !== 'lob'; i++) await c.click();
      assert.equal(await c.getAttribute('data-type'), 'lob');
      for (const size of [
        { width: 320, height: 568 },
        { width: 844, height: 390 },
        { width: 390, height: 844 }
      ]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(80);
        const box = (sel) =>
          page.locator(sel).evaluateAll((els) =>
            els
              .filter((e) => getComputedStyle(e).visibility !== 'hidden')
              .map((e) => {
                const r = e.getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
              })
          );
        const ctls = await box('[data-ctl]'),
          chips = await box('.fb2-icon');
        assert.ok(ctls.length >= 2 && chips.length >= 3, JSON.stringify({ ctls: ctls.length, chips: chips.length }));
        assert.ok([...ctls, ...chips].every((b) => b.w >= 44 && b.h >= 44));
        for (let i = 0; i < ctls.length; i++)
          for (let j = i + 1; j < ctls.length; j++) {
            const a = ctls[i],
              b = ctls[j];
            assert.ok(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) < 1 || Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) < 1, 'Overlapping passing controls');
          }
        assert.ok(ctls.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= size.width + 1 && b.y + b.h <= size.height + 1));
        await shot(page, 'core-nfl-pass-' + size.width);
      }
      const chip = page.locator('.fb2-icon').filter({ has: page.locator('span') });
      let thrown = false;
      for (let i = 0; i < (await chip.count()) && !thrown; i++) {
        const b = await chip.nth(i).boundingBox();
        if (!b || (await chip.nth(i).evaluate((e) => getComputedStyle(e).visibility === 'hidden'))) continue;
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        thrown = await c.waitFor({ state: 'detached', timeout: 1500 }).then(() => true, () => false);
      }
      assert.ok(thrown, 'a touch on a name chip throws');
      await page.waitForTimeout(300);
      await shot(page, 'core-nfl-flight');
    } else {
      // the Burst-button preference puts a hold-BURST on D (the default bursts past the stick's ring)
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      const burst = page.getByRole('button', { name: 'Burst: hold to sprint' });
      await burst.waitFor();
      const pressed = (v) => page.waitForFunction((v) => document.querySelector('[data-ctl="D"]')?.getAttribute('aria-pressed') === v, v, { timeout: 2000 });
      const b = await burst.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await pressed('true');
      await page.getByRole('button', { name: /^Juke/ }).waitFor();
      await page.waitForTimeout(100);
      await shot(page, 'core-nfl-burst');
      // Release outside remains captured; OS interruption also clears a held burst.
      await page.mouse.move(150, 400);
      await page.mouse.up();
      await pressed('false');
      await burst.focus();
      await page.keyboard.down('Space');
      await pressed('true');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await pressed('false');
      await page.keyboard.up('Space');
      await page.setViewportSize({ width: 844, height: 390 });
      await shot(page, 'core-nfl-run-landscape');
    }
    await page.evaluate(() => window.__gameQARoot.unmount());
    const after = await current();
    for (const card of original.ut.owned) assert.ok(after.ut.owned.some((c) => Object.entries(card).every(([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v))));
    assert.equal(after.coins, original.coins);
    assert.deepEqual(after.ut.squad, original.ut.squad);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ sport, mode, manualInput: true, captureTimeScale: 0.5, ownedPreserved: original.ut.owned.length, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
