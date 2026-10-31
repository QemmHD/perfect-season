// Codex: real UT navigation and non-practice football hints, with isolated saved accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, fixture, shot, artifacts } from './browser.mjs';
const browser = await launch(),
  report = [];
try {
  if (!process.env.PS_FOOTBALL_BASELINE && !process.env.PS_FOOTBALL_ONLY)
    for (const sport of ['nba', 'nfl']) {
      const { page, context, current, original, errors } = await fixture(
        browser,
        sport,
        'Codex Play QA'
      );
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
      const play = page
        .locator('.ut-tabs button')
        .filter({ hasText: /^PLAY$/ });
      await play.waitFor();
      assert.equal(await page.locator('.ut-tabs button').count(), 6);
      assert.equal(
        await page
          .locator(
            '.ut-v-hub .hq-mode,.ut-v-hub .ut-play,.ut-v-hub .hq-circuit-launch'
          )
          .count(),
        0
      );
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [844, 390]
      ]) {
        await page.setViewportSize({ width, height });
        await play.click();
        await page.evaluate(() => document.fonts.ready);
        const tabs = await page.locator('.ut-tabs button').evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect(),
              label = el.querySelector('span');
            return {
              w: r.width,
              h: r.height,
              clipped: label.scrollWidth > el.clientWidth
            };
          })
        );
        assert.ok(
          tabs.every((t) => t.w >= 44 && t.h >= 44 && !t.clipped),
          JSON.stringify({ width, height, tabs })
        );
        await shot(page, `play-${sport}-${width}`);
        for (const name of [
          /CLUB SEASON/,
          /CHAMPIONS CIRCUIT/,
          /MOMENTS/,
          /SQUAD BATTLES/,
          /DIVISION RIVALS/,
          /LEGENDS SERIES/
        ]) {
          await page.locator('.hq-mode').filter({ hasText: name }).click();
          assert.equal(
            await page.locator('.ut-tabs [aria-current="page"]').innerText(),
            'PLAY'
          );
          await page
            .getByRole('button', { name: 'Back to Play', exact: true })
            .click();
          await page
            .getByRole('heading', { name: 'PLAY YOUR WAY.', exact: true })
            .waitFor();
        }
        report.push({
          sport,
          width,
          tabs: tabs.length,
          minTarget: Math.min(...tabs.map((t) => Math.min(t.w, t.h))),
          allModeParents: 'PLAY'
        });
      }
      await page
        .locator('.hq-mode')
        .filter({ hasText: /CHAMPIONS CIRCUIT/ })
        .click();
      await page
        .getByRole('button', { name: 'ENTER FREE', exact: true })
        .click();
      const active = (await current()).ut.hq.circuit.active;
      await page
        .getByRole('button', { name: 'Back to Play', exact: true })
        .click();
      await page.getByRole('button', { name: /CONTINUE YOUR CIRCUIT/ }).click();
      assert.equal((await current()).ut.hq.circuit.active.id, active.id);
      const after = await current();
      assert.equal(after.coins, original.coins);
      assert.deepEqual(after.ut.squad, original.ut.squad);
      for (const card of original.ut.owned)
        assert.ok(
          after.ut.owned.some((c) =>
            Object.entries(card).every(
              ([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v)
            )
          )
        );
      assert.deepEqual(errors, []);
      await context.close();
    }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390]
  ]) {
    const { page, context, errors, current, original } = await fixture(
      browser,
      'nfl',
      'Codex Field QA',
      width,
      { viewport: { width, height } }
    );
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { loadProfile } = await import('/src/lib/profile.ts');
      const { getPool } = await import('/src/ut/pool.ts');
      const { teamsOf } = await import('/src/ut/teams.ts');
      const { kitsFor } = await import('/src/game/uniforms.ts');
      const { Football2 } = await import('/src/game/football2/Football2.tsx');
      const p = loadProfile(),
        pool = await getPool(),
        sq = {};
      for (const [slot, uid] of Object.entries(p.ut.squad)) {
        const c = p.ut.owned.find((c) => c.uid === uid);
        if (c) sq[slot] = { line: pool.byId.get(c.cardId), level: c.level };
      }
      const t = teamsOf('nfl', sq, sq, 'hint-qa'),
        k = kitsFor(null, null, 'nfl'),
        host = document.createElement('div');
      document.body.append(host);
      (dom.createRoot ?? dom.default.createRoot)(host).render(
        React.createElement(Football2, {
          seed: 'hint-qa',
          rivalName: 'LEGEND',
          rival: null,
          defIQ: 1,
          timeScale: 0.1,
          ourKit: k.mine,
          theirKit: k.theirs,
          offense: t.offense,
          rivalDefense: t.rivalDefense,
          drives: 1,
          field: k.field,
          onDone: () => {},
          onProgress: () => {}
        })
      );
      window.__psInsets =
        innerWidth > innerHeight ? [0, 44, 21, 44] : [47, 0, 34, 0];
      window.dispatchEvent(new Event('resize'));
    });
    const check = async (state) => {
      await page.locator('.fb2 .hg2-hint').waitFor();
      // Game portals use viewport env() insets, independently of the portrait app stage.
      await page.locator('.arcade-full.fb2').evaluate((el) => {
        const inset =
          innerWidth > innerHeight ? [0, 44, 21, 44] : [47, 0, 34, 0];
        ['--sat', '--sar', '--sab', '--sal'].forEach((key, i) =>
          el.style.setProperty(key, inset[i] + 'px')
        );
      });
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r))
          )
      );
      const geometry = await page.locator('.fb2 .hg2-hint').evaluate((el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return {
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          top: s.top,
          bottom: s.bottom,
          text: el.textContent,
          viewportH: innerHeight,
          clearOfCall:
            !document.querySelector('.fb2-call') ||
            r.bottom <=
              document.querySelector('.fb2-call').getBoundingClientRect().top,
          clearOfScore:
            r.top >=
            document.querySelector('.fb2 .hg2-bug').getBoundingClientRect()
              .bottom
        };
      });
      await shot(
        page,
        `football-hint-${process.env.PS_FOOTBALL_BASELINE ? 'before' : 'after'}-${width}-${state}`
      );
      report.push({ sport: 'nfl', width, state, ...geometry });
      if (!process.env.PS_FOOTBALL_BASELINE) {
        assert.ok(geometry.h <= 80, 'Hint must have intrinsic text height');
        assert.ok(
          geometry.clearOfCall && geometry.clearOfScore,
          'Hint clear of scoreboard and play calls'
        );
        assert.ok(
          geometry.y >= 0 && geometry.y + geometry.h <= height,
          'Hint inside viewport'
        );
      }
    };
    await check('pre');
    const run = page.locator('.fb2-cards .run').first();
    if (await run.count()) await run.click();
    await page.getByRole('button', { name: 'SNAP', exact: true }).click();
    await check('snap');
    const after = await current();
    assert.equal(after.coins, original.coins);
    for (const card of original.ut.owned)
      assert.ok(
        after.ut.owned.some((c) =>
          Object.entries(card).every(
            ([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v)
          )
        )
      );
    assert.deepEqual(after.ut.squad, original.ut.squad);
    assert.deepEqual(after.ut.record, original.ut.record);
    assert.deepEqual(errors, []);
    await context.close();
  }
  fs.writeFileSync(
    path.join(artifacts, 'play-tab-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
