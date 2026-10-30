// Codex: evidence-based interruption, modality, reward and exact-copy browser regressions.
import assert from 'node:assert/strict';
import { launch, fixture, shot, dismissPack } from './browser.mjs';
const browser = await launch();
try {
  for (const sport of process.env.PS_POLISH_ARCHIVE_ONLY
    ? []
    : process.env.PS_POLISH_SPORT
      ? [process.env.PS_POLISH_SPORT]
      : ['nba', 'nfl']) {
    const { page, context, current, errors, original } = await fixture(
      browser,
      sport,
      'Codex Polish'
    );
    const seeded = await page.evaluate(async () => {
      const { loadProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { addSeasonXP, seasonFor } = await import('/src/ut/progression.ts');
      const { startDevelopment } = await import('/src/ut/club-management.ts');
      const { organizeStorage, useStoredCopy } =
        await import('/src/ut/storage.ts');
      const { getPool } = await import('/src/ut/pool.ts');
      const p = loadProfile(),
        pool = await getPool();
      const uid = Object.values(p.ut.squad).find(
          (uid) => p.ut.owned.find((c) => c.uid === uid)?.level < 5
        ),
        card = p.ut.owned.find((c) => c.uid === uid);
      p.ut = organizeStorage(p.ut, [
        { ...card, uid: 'polish-spare', level: 1, xp: 0, mint: undefined }
      ]);
      p.ut = startDevelopment(p.ut, uid, 'breakout', Date.now());
      p.ut = organizeStorage(useStoredCopy(p.ut, 'polish-spare'));
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York'
      }).format(new Date());
      p.ut = addSeasonXP(p.ut, day, 1800);
      saveProfile(p);
      return {
        uid,
        name: pool.byId.get(card.cardId).name,
        season: seasonFor(day).id
      };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.getByRole('button', { name: /SEASON PASS/ }).click();
    await page
      .getByRole('progressbar', { name: 'Season reward track' })
      .waitFor();
    await shot(page, 'polish-' + sport + '-season-ready');
    const before = await current();
    await page
      .getByRole('button', { name: 'CLAIM READY (6)', exact: true })
      .click();
    const claimed = await current();
    assert.equal(claimed.coins, before.coins + 200);
    assert.equal(claimed.ut.packs.length, before.ut.packs.length + 4);
    assert.equal(claimed.ut.hq.seasons[seeded.season].claimed.length, 6);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.getByRole('button', { name: /SEASON PASS/ }).click();
    assert.equal(
      await page.getByRole('button', { name: /^CLAIM READY/ }).count(),
      0
    );
    await page.getByRole('button', { name: 'YOUR PACKS', exact: true }).click();
    await page
      .getByRole('button', { name: 'Open your Bronze Pack', exact: true })
      .click();
    const pack = page.getByRole('dialog', {
      name: 'Opening Bronze Pack',
      exact: true
    });
    await pack.waitFor();
    assert.equal(
      await page
        .locator('.ut-body[inert],.ut-tabs[inert],.ut-top[inert]')
        .count(),
      3
    );
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement.closest('.ut-open-screen')
        )
      );
    }
    await page
      .locator('.ut-buy')
      .first()
      .evaluate((e) => e.focus());
    assert.ok(
      await page.evaluate(
        () => !!document.activeElement.closest('.ut-open-screen')
      )
    );
    await page.keyboard.press('Escape');
    await dismissPack(page);
    assert.equal((await current()).coins, claimed.coins);
    await page.locator('.ut-tabs button').filter({ hasText: 'HOME' }).click();
    await page.getByRole('button', { name: /DEVELOPMENT/ }).click();
    await page
      .getByRole('heading', { name: seeded.name, exact: true })
      .waitFor();
    assert.ok(
      await page
        .getByText('COPY IN DUPLICATE STORAGE', { exact: true })
        .isVisible()
    );
    await shot(page, 'polish-' + sport + '-development-copy');
    await page
      .getByRole('button', { name: 'RETURN THIS COPY TO CLUB', exact: true })
      .click();
    const swapped = await current();
    assert.equal(swapped.ut.hq.development.active.uid, seeded.uid);
    assert.ok(!swapped.ut.duplicateStorage.includes(seeded.uid));
    assert.ok(Object.values(swapped.ut.squad).includes(seeded.uid));
    assert.ok(
      await page.getByText('IN YOUR MATCH SQUAD', { exact: true }).isVisible()
    );
    await page.locator('.ut-tabs button').filter({ hasText: 'HOME' }).click();
    await page.getByRole('button', { name: /MOMENTS/ }).click();
    await page
      .locator('.hq-moment-tile')
      .nth(sport === 'nba' ? 3 : 1)
      .click();
    assert.ok(
      await page
        .getByText(
          sport === 'nba' ? /5 attempts · All-Star/ : /TARGET · COMPLETIONS/
        )
        .isVisible()
    );

    const mount = async () =>
      page.evaluate(async (sport) => {
        const React = (await import('/node_modules/.vite/deps/react.js'))
          .default;
        const dom =
          await import('/node_modules/.vite/deps/react-dom_client.js');
        const createRoot = dom.createRoot ?? dom.default.createRoot;
        const { loadProfile } = await import('/src/lib/profile.ts');
        const { getPool } = await import('/src/ut/pool.ts');
        const { teamsOf } = await import('/src/ut/teams.ts');
        const { kitsFor } = await import('/src/game/uniforms.ts');
        const p = loadProfile(),
          pool = await getPool(),
          squad = {};
        for (const [slot, uid] of Object.entries(p.ut.squad)) {
          const c = p.ut.owned.find((c) => c.uid === uid);
          if (c)
            squad[slot] = { line: pool.byId.get(c.cardId), level: c.level };
        }
        const t = teamsOf(sport, squad, squad, 'polish-input'),
          k = kitsFor(null, null, sport);
        // Synthetic weak defense isolates interruption behavior from random steals/sacks.
        if (sport === 'nba')
          t.rivalFive = t.rivalFive.map((p) => ({
            ...p,
            spd: 25,
            acc: 25,
            stl: 0,
            blk: 0,
            prd: 20,
            reb: 20
          }));
        else
          for (const p of [
            ...t.rivalDefense.dl,
            ...t.rivalDefense.lb,
            ...t.rivalDefense.cb,
            ...t.rivalDefense.s
          ])
            for (const key of ['SPD', 'ACC', 'PMV', 'FMV', 'PRC', 'MCV', 'ZCV'])
              p.a[key] = 20;
        const host = document.createElement('div');
        document.body.append(host);
        window.__polishRoot = createRoot(host);
        window.__polishAttempts = [];
        const props = {
          seed: 'polish-input:' + sport,
          rival: null,
          rivalName: 'QA',
          defIQ: -0.5,
          ourKit: k.mine,
          theirKit: k.theirs,
          practice: {
            drill: sport === 'nba' ? 'shoot' : 'throw',
            onAttempt: (a) => window.__polishAttempts.push(a)
          },
          onProgress: () => {},
          onDone: () => {}
        };
        if (sport === 'nba') {
          const { Hoops2 } = await import('/src/game/hoops2/Hoops2.tsx');
          window.__polishRoot.render(
            React.createElement(Hoops2, {
              ...props,
              five: t.five,
              rivalFive: t.rivalFive,
              possessions: 4,
              court: k.court
            })
          );
        } else {
          const { Football2 } =
            await import('/src/game/football2/Football2.tsx');
          window.__polishRoot.render(
            React.createElement(Football2, {
              ...props,
              offense: t.offense,
              rivalDefense: t.rivalDefense,
              drives: 4,
              field: k.field
            })
          );
        }
      }, sport);
    await mount();
    await page.locator('.hg2-canvas').waitFor();
    await page.waitForTimeout(1000);
    if (sport === 'nba') {
      await page.waitForFunction(
        () =>
          /^\d+$/.test(
            document.querySelector('.hg2-bug .mid em')?.textContent ?? ''
          ),
        null,
        { timeout: 10000 }
      );
      const shoot = page.getByRole('button', {
        name: 'Shoot: hold, and let go in the green'
      });
      const b = await shoot.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(150);
      assert.ok(await shoot.evaluate((e) => e.hasPointerCapture(1)));
      await shoot.dispatchEvent('pointercancel', { pointerId: 1 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      assert.ok(
        !/EARLY|LATE|PERFECT/.test(
          await page
            .locator('.hg2-pop')
            .allTextContents()
            .then((a) => a.join(' '))
        )
      );
      const stick = page.locator('.hg2-stick'),
        s = await stick.boundingBox();
      await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
      await page.mouse.down();
      await page.mouse.move(s.x + s.width / 2 + 35, s.y + s.height / 2);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.mouse.up();
      assert.match(
        await page.locator('.hg2-stick i').getAttribute('style'),
        /translate\(0px,\s*0px\)/
      );
      await page.waitForTimeout(650);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(180);
      await page.mouse.move(b.x - 65, b.y + b.height / 2);
      await page.mouse.up();
      await page.waitForFunction(
        () =>
          /EARLY/.test(document.querySelector('.hg2-pop')?.textContent ?? ''),
        null,
        { timeout: 2000 }
      );
      await page.waitForFunction(
        () => window.__polishAttempts.length > 0,
        null,
        { timeout: 25000 }
      );
      assert.ok(
        (await page.evaluate(() => window.__polishAttempts[0].offset)) < 0,
        'Dragged release became an automatic late release'
      );
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(200);
      await shot(page, 'polish-nba-controls-320');
    } else {
      const trigger = page.getByRole('button', { name: /FULL PLAYBOOK/ });
      await trigger.click();
      const dialog = page.getByRole('dialog', {
        name: 'Full playbook',
        exact: true
      });
      await dialog.waitFor();
      assert.ok(await dialog.evaluate((e) => e.matches(':modal')));
      const close = page.getByRole('button', {
        name: 'Close playbook',
        exact: true
      });
      await close.focus();
      await page.keyboard.press('Shift+Tab');
      assert.ok(
        await page.evaluate(() => !!document.activeElement.closest('dialog'))
      );
      await page.keyboard.press('Tab');
      assert.ok(await close.evaluate((e) => document.activeElement === e));
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.ok(await trigger.evaluate((e) => document.activeElement === e));
      await trigger.click();
      await page
        .locator('.fb2-book-grid .fb2-card')
        .filter({ hasText: 'Slants' })
        .click();
      const points = () =>
        page
          .locator('.fb2-cards .fb2-card.on polyline')
          .first()
          .getAttribute('points');
      const right = await points();
      await page.getByRole('button', { name: /FLIP PLAY/ }).click();
      const left = await points();
      const xs = (s) => s.split(' ').map((p) => Number(p.split(',')[0]));
      xs(right).forEach((x, i) =>
        assert.ok(Math.abs(x + xs(left)[i] - 100) < 1e-6)
      );
      await trigger.click();
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(250);
      await shot(page, 'polish-nfl-modal-landscape');
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      const resetEvents = ['cancel', 'blur', 'orientationchange', 'hidden'];
      for (const kind of resetEvents) {
        await page.mouse.move(190, 430);
        await page.mouse.down();
        await page.mouse.move(190, 505, { steps: 3 });
        if (kind === 'cancel')
          await page
            .locator('.hg2-canvas')
            .dispatchEvent('pointercancel', { pointerId: 1 });
        else
          await page.evaluate((kind) => {
            if (kind === 'hidden') {
              Object.defineProperty(document, 'hidden', {
                configurable: true,
                value: true
              });
              document.dispatchEvent(new Event('visibilitychange'));
              delete document.hidden;
            } else window.dispatchEvent(new Event(kind));
          }, kind);
        await page.mouse.up();
        assert.ok(
          await page
            .getByRole('button', {
              name: 'Scramble: the quarterback runs',
              exact: true
            })
            .isVisible(),
          kind + ' threw the ball'
        );
      }
      await page.mouse.move(190, 430);
      await page.mouse.down();
      await page.mouse.move(190, 530, { steps: 5 });
      await page.mouse.up();
      await page.waitForFunction(
        () => window.__polishAttempts.length > 0,
        null,
        { timeout: 30000 }
      );
    }
    await page.evaluate(() => window.__polishRoot.unmount());
    const after = await current();
    assert.equal(after.coins, before.coins + 200);
    for (const c of original.ut.owned)
      assert.ok(
        after.ut.owned.some((x) =>
          Object.entries(c).every(
            ([k, v]) => JSON.stringify(x[k]) === JSON.stringify(v)
          )
        )
      );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        sport,
        batchClaimsOnce: true,
        developmentCopyRecovered: true,
        interruptionsChecked: true,
        originalCopies: original.ut.owned.length,
        errors
      })
    );
    await context.close();
  }
  // Future-season UI coverage uses the real component with an explicit date, never a fake OS/server clock.
  const f = await fixture(browser, 'nba', 'Codex Archive');
  await f.page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default,
      dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { SeasonView } = await import('/src/ut/Clubhouse.tsx');
    await import('/src/ut/clubhouse.css');
    const { addSeasonXP, claimReadySeason } =
      await import('/src/ut/progression.ts');
    const { loadProfile } = await import('/src/lib/profile.ts');
    let initial = addSeasonXP(loadProfile().ut, '2026-10-30', 600);
    const host = document.createElement('div');
    host.className = 'screen ut';
    Object.assign(host.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '50',
      background: '#04121a'
    });
    document.querySelector('.stage').append(host);
    const root = (dom.createRoot ?? dom.default.createRoot)(host);
    window.__archiveRoot = root;
    function Archive() {
      const [ut, setUt] = React.useState(initial);
      window.__archiveState = ut;
      return React.createElement(SeasonView, {
        ut,
        day: '2026-11-25',
        sport: 'nba',
        onClaim: () => {},
        onStore: () => {},
        onClaimReady: (period) =>
          setUt((old) => claimReadySeason(old, period, 1).ut)
      });
    }
    root.render(React.createElement(Archive));
  });
  await f.page.getByRole('button', { name: /EARNED REWARDS WAITING/ }).click();
  await f.page
    .getByRole('button', { name: 'CLAIM READY (2)', exact: true })
    .waitFor();
  await shot(f.page, 'polish-saved-season');
  await f.page
    .getByRole('button', { name: 'CLAIM READY (2)', exact: true })
    .click();
  assert.deepEqual(
    await f.page.evaluate(
      () => window.__archiveState.hq.seasons['season:1'].claimed
    ),
    [1, 2]
  );
  assert.deepEqual(f.errors, []);
  await f.page.evaluate(() => window.__archiveRoot.unmount());
  await f.context.close();
  console.log(
    JSON.stringify({ archivedRewardNavigation: true, archivedBatchClaim: true })
  );
} finally {
  await browser.close();
}
