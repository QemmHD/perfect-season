// Codex (OpenAI): isolated integration QA. Real matches use 8x test-only autoplay; title screens are explicit seeded fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, fixture, shot, artifacts } from './browser.mjs';
const browser = await launch(),
  report = [];
try {
  for (const sport of process.env.PS_OVERHAUL_SPORT
    ? [process.env.PS_OVERHAUL_SPORT]
    : ['nba', 'nfl', 'soccer']) {
    const { page, context, current, original, errors } = await fixture(
      browser,
      sport,
      'Codex Cup QA',
    );
    const enter = async () => {
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
      await page
        .locator('.ut-tabs button')
        .filter({ hasText: /^PLAY$/ })
        .click();
      await page.locator('.play-mode').filter({ hasText: 'CLUB CUPS' }).click();
      await page.locator('.cup-page').waitFor();
    };
    const layout = async (name) => {
      const overflow = await page
        .locator('.ut-body > .page')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      assert.ok(overflow <= 1, `${sport} ${name} overflow ${overflow}`);
      const header = await page.evaluate(() => {
        const title = document
            .querySelector('.ut-title')
            .getBoundingClientRect(),
          back = document
            .querySelector('.ut-top button')
            ?.getBoundingClientRect(),
          wallet = document
            .querySelector('.ut-top .coins')
            .getBoundingClientRect();
        return (
          (!back || title.left >= back.right - 1) &&
          title.right <= wallet.left + 1
        );
      });
      assert.ok(header, `${sport} ${name} header collision`);
      await shot(page, `overhaul-${sport}-${name}`);
    };
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page
      .locator('.ut-tabs button')
      .filter({ hasText: /^PLAY$/ })
      .click();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await layout('play-' + width);
    }
    await page.getByRole('button', { name: 'QUICK PLAY', exact: true }).click();
    assert.equal(
      await page.locator('.play-mode').filter({ hasText: 'CLUB CUPS' }).count(),
      0,
    );
    await page.getByRole('button', { name: 'RUNS', exact: true }).click();
    await page.locator('.play-mode').filter({ hasText: 'CLUB CUPS' }).click();
    await page
      .getByRole('combobox', { name: 'Cup difficulty' })
      .selectOption('rookie');
    await page
      .getByRole('button', { name: 'ENTER OPEN CLUB CUP', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'PLAY QUARTERFINAL', exact: true })
      .waitFor();
    const started = await current();
    assert.equal(started.ut.cup.active.level, 'rookie');
    assert.equal(started.ut.cup.active.round, 0);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await layout('cup-' + width);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    assert.equal((await current()).ut.cup.active.id, started.ut.cup.active.id);
    assert.equal((await current()).coins, original.coins);
    const autoUrl = new URL(page.url());
    autoUrl.searchParams.set('autoplay', '1');
    await page.goto(autoUrl.href, { waitUntil: 'domcontentloaded' });
    await enter();
    await page.evaluate(async () => {
      const code = await (await fetch('/src/game/Arcade.tsx')).text(),
        reactUrl = code.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
      if (!reactUrl) throw Error('Could not find actual React import');
      const React = (await import(reactUrl)).default;
      const original = React.createElement;
      window.__cupRuntime = 0;
      React.createElement = (type, props, ...children) => {
        if (['Hoops2', 'Football2', 'Soccer2'].includes(type?.name)) {
          props = { ...props, timeScale: 8 };
          window.__cupRuntime++;
        }
        return original(type, props, ...children);
      };
    });
    await page
      .getByRole('button', { name: 'PLAY QUARTERFINAL', exact: true })
      .click();
    await page.locator('.utm-result').waitFor({ timeout: 180000 });
    await shot(page, 'overhaul-' + sport + '-real-result');
    console.log(
      JSON.stringify({
        stage: 'Cup match result',
        sport,
        testSpeedHookFrames: await page.evaluate(() => window.__cupRuntime),
      }),
    );
    assert.ok(await page.evaluate(() => window.__cupRuntime > 0));
    await page.getByRole('region', { name: 'Match breakdown' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^SIM/ }).count(), 0);
    await shot(page, 'overhaul-' + sport + '-real-result');
    const won = (await page.locator('.utm-verdict').innerText()) === 'WIN',
      afterMatch = await current();
    assert.equal(afterMatch.ut.cup.active.results.length, 1);
    assert.equal(afterMatch.ut.cup.active.round, 1);
    assert.equal(afterMatch.ut.cup.active.results[0].won, won);
    assert.equal(afterMatch.coins, original.coins + (won ? 60 : 30));
    for (const before of original.ut.owned) {
      const after = afterMatch.ut.owned.find((x) => x.uid === before.uid);
      assert.ok(after);
      assert.equal(after.cardId, before.cardId);
      assert.ok(after.level >= before.level);
      assert.ok(after.level > before.level || after.xp >= before.xp);
    }
    // A reload keeps actual settlement and the same active run; no in-progress game is silently paid.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    const resumed = await current();
    assert.equal(resumed.ut.cup.active.id, started.ut.cup.active.id);
    assert.equal(resumed.ut.cup.active.round, 1);
    assert.equal(resumed.coins, afterMatch.coins);
    // Explicit presentation fixture for the complete title/claim UI, not claimed as played achievements.
    const seeded = await page.evaluate(async (sport) => {
      const { loadProfile } = await import('/src/lib/profile.ts');
      const p = loadProfile(),
        a = p.ut.cup.active;
      const at = Date.now();
      p.ut.cup = {
        ...p.ut.cup,
        active: {
          ...a,
          round: 3,
          done: true,
          results: [0, 1, 2].map((i) => ({
            id: 'qa-presentation:' + a.id + ':' + i,
            won: true,
            us: { nba: 24, nfl: 14, soccer: 3 }[sport],
            them: { nba: 16, nfl: 7, soccer: 1 }[sport],
            at: at + i,
          })),
        },
      };
      return p;
    }, sport);
    const key = {
        nba: 'perfect-season:profile:v1',
        nfl: 'perfect-season:profile:nfl:v1',
        soccer: 'perfect-season:profile:soccer:v1',
      }[sport],
      flag = 'cup-title-' + sport;
    await page.addInitScript(
      ({ key, seeded, flag }) => {
        if (!sessionStorage.getItem(flag)) {
          localStorage.setItem(key, JSON.stringify(seeded));
          sessionStorage.setItem(flag, '1');
        }
      },
      { key, seeded, flag },
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    await page
      .getByRole('button', { name: 'COLLECT TITLE REWARD', exact: true })
      .waitFor();
    await layout('seeded-title');
    const beforeClaim = await current();
    await page
      .getByRole('button', { name: 'COLLECT TITLE REWARD', exact: true })
      .click();
    const claimed = await current();
    assert.equal(claimed.coins, beforeClaim.coins + 200);
    assert.equal(claimed.ut.packs.length, beforeClaim.ut.packs.length + 1);
    assert.equal(claimed.ut.cup.trophies.open, 1);
    assert.equal(claimed.ut.cup.active, undefined);
    assert.equal(claimed.ut.cup.claims.length, 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    assert.equal((await current()).coins, claimed.coins);
    assert.equal((await current()).ut.packs.length, claimed.ut.packs.length);
    assert.equal(
      await page
        .getByRole('button', { name: 'COLLECT TITLE REWARD', exact: true })
        .count(),
      0,
    );
    await page
      .locator('.ut-tabs button')
      .filter({ hasText: /^STORE/ })
      .click();
    await page
      .getByRole('button', { name: /Open your Gold Pack/ })
      .first()
      .waitFor();
    let rewardPackShortcut = false;
    if (sport === 'nba') {
      // Seed only ladder position, then earn the next pack through an actual played match.
      const battleSeed = await page.evaluate(async () => {
        const { loadProfile } = await import('/src/lib/profile.ts');
        const { weekOf } = await import('/src/ut/sbc.ts');
        const { easternDateKey } = await import('/src/engine/season.ts');
        const p = loadProfile();
        p.ut.battles = {
          week: weekOf(easternDateKey()),
          cleared: 3,
          best: 3,
          round: 0,
          level: 'rookie',
        };
        return p;
      });
      await page.addInitScript((p) => {
        if (!sessionStorage.getItem('qa-reward-battle')) {
          localStorage.setItem('perfect-season:profile:v1', JSON.stringify(p));
          sessionStorage.setItem('qa-reward-battle', '1');
        }
      }, battleSeed);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
      await page
        .locator('.ut-tabs button')
        .filter({ hasText: /^PLAY$/ })
        .click();
      await page
        .locator('.play-mode')
        .filter({ hasText: 'SQUAD BATTLES' })
        .click();
      await page.evaluate(async () => {
        const code = await (await fetch('/src/game/Arcade.tsx')).text(),
          reactUrl = code.match(
            /from\s+["']([^"']*\/react\.js[^"']*)["']/,
          )?.[1];
        if (!reactUrl) throw Error('Could not find actual React import');
        const React = (await import(reactUrl)).default;
        const original = React.createElement;
        React.createElement = (type, props, ...children) =>
          original(
            type,
            type?.name === 'Hoops2' ? { ...props, timeScale: 8 } : props,
            ...children,
          );
      });
      const beforeBattle = await current();
      await page.locator('.utb-rung.next').click();
      await page.locator('.utm-result').waitFor({ timeout: 180000 });
      for (
        let attempt = 0;
        attempt < 2 &&
        (await page.locator('.utm-verdict').innerText()) !== 'WIN';
        attempt++
      ) {
        await page
          .getByRole('button', { name: 'TRY AGAIN', exact: true })
          .click();
        await page.locator('.utm-result').waitFor({ state: 'hidden' });
        await page.locator('.utm-result').waitFor({ timeout: 180000 });
      }
      await page
        .getByRole('button', { name: 'VIEW REWARD PACKS', exact: true })
        .waitFor();
      await shot(page, 'overhaul-nba-earned-pack-result');
      const withReward = await current();
      assert.equal(
        withReward.ut.packs.length,
        beforeBattle.ut.packs.length + 1,
      );
      await page
        .getByRole('button', { name: 'VIEW REWARD PACKS', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Open your Bronze Pack', exact: true })
        .waitFor();
      assert.match(
        await page.locator('.ut-tabs [aria-current=page]').innerText(),
        /^STORE/,
      );
      rewardPackShortcut = true;
    }
    assert.deepEqual(errors, []);
    report.push({
      sport,
      phoneWidths: [320, 390],
      filters: true,
      cupDifficulty: 'rookie',
      realCupMatchesPlayed: 1,
      additionalEarnedPackMatch: sport === 'nba',
      autoplayTimeScale: 8,
      won,
      matchBreakdown: true,
      resume: true,
      seededTitleClaimedOnce: true,
      rewardPackShortcut,
      originalCopiesPreserved: original.ut.owned.length,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  fs.writeFileSync(
    path.join(artifacts, 'overhaul-report.json'),
    JSON.stringify(report, null, 2),
  );
} catch (error) {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .at(-1);
  if (page && !page.isClosed()) {
    console.error(
      JSON.stringify({
        diagnosticBody: await page
          .locator('body')
          .innerText()
          .catch(() => ''),
        error: String(error),
      }),
    );
    await shot(page, 'overhaul-failure').catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
