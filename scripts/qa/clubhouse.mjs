// Codex: isolated localhost end-to-end checks for the connected Ultimate Team overhaul.
import assert from 'node:assert/strict';
import { launch, fixture, shot } from './browser.mjs';
const browser = await launch();
try {
  for (const sport of ['nba', 'nfl']) {
    const { page, context, current, original, errors } = await fixture(
      browser,
      sport,
      'Codex Clubhouse'
    );
    const enter = async () => {
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
      await page
        .getByRole('button', { name: 'PLAY HQ', exact: true })
        .waitFor();
    };
    const capture = async (_page, name) => {
      await page.waitForTimeout(400);
      await shot(page, name);
    };
    const home = () =>
      page.locator('.ut-tabs button').filter({ hasText: 'HOME' }).click();
    await enter();
    await page.waitForTimeout(500);
    await capture(page, 'clubhouse-' + sport + '-home');
    await page.getByRole('button', { name: 'PLAY HQ', exact: true }).click();
    assert.equal(
      (await current()).coins,
      original.coins,
      'Navigation must preserve wallet'
    );
    await page.waitForTimeout(400);
    await capture(page, 'clubhouse-' + sport + '-play');
    await page.getByRole('button', { name: /CHAMPIONS CIRCUIT/ }).click();
    await page.getByRole('button', { name: 'ENTER FREE', exact: true }).click();
    await page
      .getByRole('button', { name: 'PLAY MATCH 1', exact: true })
      .waitFor();
    const active = (await current()).ut.hq.circuit.active;
    assert.equal((await current()).ut.hq.circuit.entries, 1);
    await capture(page, 'clubhouse-' + sport + '-circuit');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    await page.locator('.ut-tabs button').filter({hasText:/^PLAY$/}).click();
    await page.getByRole('button', { name: /CONTINUE YOUR CIRCUIT/ }).click();
    assert.equal((await current()).ut.hq.circuit.active.id, active.id);
    await home();
    await page.getByRole('button', { name: /DEVELOPMENT/ }).click();
    await page
      .getByRole('button', { name: /^Develop / })
      .first()
      .click();
    await page.getByRole('button', { name: /^START WITH / }).click();
    await page
      .getByRole('button', { name: 'MANAGE SQUAD', exact: true })
      .waitFor();
    const developing = (await current()).ut.hq.development.active.uid;
    await capture(page, 'clubhouse-' + sport + '-development');
    await page
      .getByRole('button', { name: 'MANAGE SQUAD', exact: true })
      .click();
    await page.getByRole('button', { name: 'LINEUPS', exact: true }).click();
    await page.locator('.hq-preset input').first().fill('Road Team');
    await page
      .getByRole('button', { name: 'SAVE CURRENT', exact: true })
      .first()
      .click();
    await capture(page, 'clubhouse-' + sport + '-lineups');
    const saved = (await current()).ut.hq.presets[0];
    assert.deepEqual(saved.squad, original.ut.squad);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    assert.equal((await current()).ut.hq.development.active.uid, developing);
    await page.locator('.ut-tabs button').filter({ hasText: 'SQUAD' }).click();
    await page.getByRole('button', { name: 'LINEUPS', exact: true }).click();
    await page
      .getByRole('button', { name: 'LOAD', exact: true })
      .first()
      .click();
    assert.deepEqual((await current()).ut.squad, saved.squad);
    await home();
    await page.getByRole('button', { name: /OBJECTIVES/ }).click();
    await page.getByRole('button', { name: 'LIFETIME', exact: true }).click();
    await capture(page, 'clubhouse-' + sport + '-objectives');
    const beforeClaim = await current();
    await page
      .getByRole('button', { name: 'CLAIM READY', exact: true })
      .click();
    const claimed = await current();
    assert.ok(claimed.ut.hq.claims.length > 0);
    assert.ok(claimed.ut.packs.length > beforeClaim.ut.packs.length);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    await page.getByRole('button', { name: /OBJECTIVES/ }).click();
    assert.equal(
      (await current()).ut.hq.claims.length,
      claimed.ut.hq.claims.length
    );
    assert.ok(
      await page
        .getByRole('button', { name: 'CLAIM READY', exact: true })
        .isDisabled()
    );
    await home();
    await page.getByRole('button', { name: /SEASON PASS/ }).click();
    await capture(page, 'clubhouse-' + sport + '-season');
    await page
      .getByRole('button', { name: 'CLAIM', exact: true })
      .first()
      .click();
    const seasonClaim = await current();
    assert.equal(seasonClaim.ut.hq.seasons['season:1'].claimed.length, 1);
    await page.locator('.ut-tabs button').filter({hasText:/^PLAY$/}).click();
    await page.getByRole('button', { name: /MOMENTS/ }).click();
    await capture(page, 'clubhouse-' + sport + '-moments');
    await page.locator('.hq-moment-tile').first().click();
    await page
      .getByRole('button', { name: 'PLAY MOMENT', exact: true })
      .click();
    await page.locator('.hg2-canvas').waitFor();
    await page.waitForTimeout(1000);
    if (sport === 'nba') {
      await page
        .getByRole('button', { name: 'Call a screen and roll', exact: true })
        .click();
      await page.getByText('SCREEN & ROLL', { exact: true }).waitFor();
      await capture(page, 'clubhouse-nba-coach-call');
      await page
        .getByRole('button', { name: 'Space the floor', exact: true })
        .click();
      await page.getByText('SPREAD THE FLOOR', { exact: true }).waitFor();
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.waitForTimeout(1700);
        const box = await page
          .getByRole('button', { name: 'Shoot: hold, and let go in the green' })
          .boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(540);
        await page.mouse.up();
        await page.waitForFunction(
          (n) =>
            !document.querySelector('.hq-moment-overlay') ||
            Number(
              document
                .querySelector('.hq-moment-overlay small')
                ?.textContent.trim()
                .split(' ')[0]
            ) >= n,
          attempt + 1,
          { timeout: 20000 }
        );
      }
    } else {
      await page.getByRole('button', { name: /FULL PLAYBOOK/ }).click();
      assert.equal(
        await page.locator('.fb2-book-grid .fb2-card').count(),
        3,
        'A rushing Moment must only offer running plays'
      );
      await capture(page, 'clubhouse-nfl-moment-playbook');
      await page
        .locator('.fb2-book-grid .fb2-card')
        .filter({ hasText: 'OUTSIDE' })
        .click();
      await page.getByRole('button', { name: /FLIP PLAY/ }).click();
      assert.equal(
        await page
          .getByRole('button', { name: /FLIP PLAY/ })
          .getAttribute('aria-pressed'),
        'true'
      );
      await capture(page, 'clubhouse-nfl-flipped-run');
      for (let attempt = 0; attempt < 3; attempt++) {
        await page
          .getByRole('button', { name: 'SNAP', exact: true })
          .waitFor({ timeout: 20000 });
        await page.getByRole('button', { name: 'SNAP', exact: true }).click();
        await page.waitForFunction(
          (n) =>
            !document.querySelector('.hq-moment-overlay') ||
            Number(
              document
                .querySelector('.hq-moment-overlay small')
                ?.textContent.trim()
                .split(' ')[0]
            ) >= n,
          attempt + 1,
          { timeout: 25000 }
        );
      }
    }
    await page.locator('.hq-moment-brief').waitFor({ timeout: 10000 });
    await capture(page, 'clubhouse-' + sport + '-moment-result');
    assert.ok(
      (await current()).ut.hq.moments[
        sport === 'nba' ? 'nba:first-light' : 'nfl:first-down'
      ]
    );
    // Seed a completed first clear only on localhost to exercise the exact UI/reload claim path.
    await page.evaluate(async () => {
      const { loadProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { getPool } = await import('/src/ut/pool.ts');
      const { momentsFor, finishMoment } = await import('/src/ut/moments.ts');
      const p = loadProfile(),
        pool = await getPool(),
        m = momentsFor(pool.sport)[0];
      p.ut = finishMoment(
        p.ut,
        m,
        Array.from({ length: m.attempts }, () => ({
          success: true,
          points: 3,
          yards: 10,
          green: true,
          detail: 'LOCAL QA'
        })),
        Date.now()
      );
      saveProfile(p);
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    await page.locator('.ut-tabs button').filter({hasText:/^PLAY$/}).click();
    await page.getByRole('button', { name: /MOMENTS/ }).click();
    await page.locator('.hq-moment-tile').first().click();
    const beforeMoment = (await current()).coins;
    await page.getByRole('button', { name: /CLAIM REWARD/ }).click();
    assert.equal((await current()).coins, beforeMoment + 100);
    assert.ok(
      await page
        .getByText('FIRST-CLEAR REWARD CLAIMED', { exact: true })
        .isVisible()
    );
    await home();
    await page.locator('.ut-tabs button').filter({hasText:/^PLAY$/}).click();
    await page.getByRole('button', { name: /CONTINUE YOUR CIRCUIT/ }).click();
    await page
      .getByRole('button', { name: 'PLAY MATCH 1', exact: true })
      .click();
    await page.locator('.hg2-canvas').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1000);
    assert.equal(
      await page.getByRole('button', { name: /^SIM/ }).count(),
      0,
      'Circuit must require a played match'
    );
    if (sport === 'nfl') {
      await page.getByRole('button', { name: /FULL PLAYBOOK/ }).click();
      assert.equal(await page.locator('.fb2-book-grid .fb2-card').count(), 11);
      await capture(page, 'clubhouse-nfl-full-playbook');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(250);
      await capture(page, 'clubhouse-nfl-playbook-landscape');
      await page
        .getByRole('button', { name: 'Close playbook', exact: true })
        .click();
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(250);
      await capture(page, 'clubhouse-nfl-controls-320');
    } else {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(250);
      await capture(page, 'clubhouse-nba-controls-320');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(250);
      await capture(page, 'clubhouse-nba-controls-landscape');
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    await capture(page, 'clubhouse-' + sport + '-home-320');
    const after = await current();
    assert.equal(after.ut.hq.circuit.entries, 1);
    assert.equal(after.ut.hq.circuit.active.id, active.id);
    for (const card of original.ut.owned)
      assert.ok(
        after.ut.owned.some((c) =>
          Object.entries(card).every(
            ([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v)
          )
        ),
        'Original copy changed'
      );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        sport,
        originalCopies: original.ut.owned.length,
        originalWalletPreservedAcrossNavigation: true,
        claimsRetained: after.ut.hq.claims.length,
        circuitResumed: true,
        manualMomentAttempts: sport === 'nba' ? 5 : 3,
        developmentRetained: true,
        presetLoaded: true,
        errors
      })
    );
    await context.close();
  }
} finally {
  await browser.close();
}
