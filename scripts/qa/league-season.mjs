// Codex: actual season UI, normal manual controls, full runtime settlement and saved fixture continuity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, fixture, shot, artifacts } from './browser.mjs';
const browser = await launch(),
  report = [];
try {
  for (const sport of process.env.PS_LEAGUE_SPORT
    ? [process.env.PS_LEAGUE_SPORT]
    : ['nba', 'nfl']) {
    const { page, context, current, original, errors } = await fixture(
      browser,
      sport,
      'Codex Season QA'
    );
    const enter = async () => {
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
      await page
        .locator('.ut-tabs button')
        .filter({ hasText: /^PLAY$/ })
        .click();
      await page
        .locator('.hq-mode')
        .filter({ hasText: 'CLUB SEASON' })
        .click()
        .catch(async (error) => {
          console.log(
            JSON.stringify({
              sport,
              errors,
              body: (await page.locator('body').innerText()).slice(0, 1800)
            })
          );
          await shot(page, 'league-failure-' + sport);
          throw error;
        });
    };
    const section = async (name) =>
      page
        .locator('.league-tabs')
        .getByRole('button', { name, exact: true })
        .click();
    const layout = async (name) => {
      await page
        .locator('.ut-title')
        .evaluate((el) => el.getBoundingClientRect());
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const data = await page.evaluate(() => {
        const body = document.querySelector('.ut-body>.page'),
          title = document.querySelector('.ut-title'),
          back = document.querySelector('.ut-top button'),
          wallet = document.querySelector('.ut-top .coins');
        const b = back.getBoundingClientRect(),
          t = title.getBoundingClientRect(),
          w = wallet.getBoundingClientRect();
        return {
          overflow: body.scrollWidth - body.clientWidth,
          header: t.left >= b.right - 1 && t.right <= w.left + 1,
          active: document
            .querySelector('.ut-tabs [aria-current=page]')
            .textContent.trim()
        };
      });
      assert.ok(data.overflow <= 1, name + ' overflow');
      assert.ok(data.header, name + ' header collision');
      assert.equal(data.active, 'PLAY');
      await shot(page, `league-${sport}-${name}`);
      return data;
    };
    await enter();
    await page
      .getByRole('button', { name: 'START SEASON', exact: true })
      .waitFor();
    await layout('intro');
    const start = Date.now();
    await page.getByRole('radio', { name: 'All-Star', exact: true }).click();
    await page
      .getByRole('button', { name: 'START SEASON', exact: true })
      .click();
    await page.locator('.league-scorecard').waitFor();
    const startMs = Date.now() - start;
    const initial = (await current()).ut.league;
    assert.equal(initial.active.level, 'allstar');
    assert.equal(initial.active.teams.length, sport === 'nba' ? 30 : 32);
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390]
    ]) {
      await page.setViewportSize({ width, height });
      for (const name of ['Season', 'Standings', 'Schedule', 'Stats']) {
        await section(name);
        await layout(name.toLowerCase() + '-' + width);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await section('Season');
    await page
      .getByRole('button', { name: 'PLAY GAME 1', exact: true })
      .click();
    await page.locator('.utm-vs').waitFor();
    await shot(page, 'league-' + sport + '-versus');
    await page.locator('.hg2-canvas').waitFor({ timeout: 30000 });
    assert.equal(
      await page.getByRole('button', { name: /^SIM/ }).count(),
      0,
      'Season requires a played match'
    );
    if (sport === 'nfl') {
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      assert.ok(
        await page
          .locator('.fb2 .hg2-hint')
          .evaluate((el) => el.getBoundingClientRect().height < 80)
      );
    } else {
      const shoot = page.getByRole('button', {
        name: 'Shoot: hold, and let go in the green'
      });
      await shoot.focus();
      await page.keyboard.down('Space');
      await page.waitForTimeout(170);
      await page.keyboard.up('Space');
    }
    await shot(page, 'league-' + sport + '-manual');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    assert.equal((await current()).ut.league.active.id, initial.active.id);
    assert.equal(
      (await current()).ut.league.active.round,
      0,
      'Interrupted match keeps its fixture'
    );
    assert.equal((await current()).coins, original.coins);
    // Use the real App state owner; an external save writer can race its numbering updates.
    const autoUrl = new URL(page.url());
    autoUrl.searchParams.set('autoplay', '1');
    await page.goto(autoUrl.href, { waitUntil: 'domcontentloaded' });
    await enter();
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { Hoops2 } = await import('/src/game/hoops2/Hoops2.tsx'),
        { Football2 } = await import('/src/game/football2/Football2.tsx');
      const originalCreate = React.createElement;
      window.__leagueRuntime = { frames: 0 };
      React.createElement = (type, props, ...children) => {
        if (type === Hoops2 || type === Football2) {
          props = { ...props, timeScale: 8 };
          window.__leagueRuntime.frames++;
        }
        return originalCreate(type, props, ...children);
      };
    });
    await page
      .getByRole('button', { name: 'PLAY GAME 1', exact: true })
      .click();
    await page.locator('.utm-result').waitFor({ timeout: 150000 });
    assert.ok(await page.evaluate(() => window.__leagueRuntime.frames > 0));
    const won = await page.locator('.utm-verdict').innerText();
    await shot(page, 'league-' + sport + '-result');
    const afterMatch = await current(),
      s = afterMatch.ut.league.active;
    assert.equal(s.round, 1);
    assert.equal(s.results.length, sport === 'nba' ? 15 : 16);
    assert.ok(s.teams.every((t) => t.w + t.l === 1));
    assert.equal(s.teams[0].w, won === 'WIN' ? 1 : 0);
    assert.equal(afterMatch.coins, original.coins + (won === 'WIN' ? 60 : 30));
    await page.getByRole('button', { name: 'SEASON HUB', exact: true }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enter();
    assert.equal((await current()).ut.league.active.round, 1);
    await layout('after-game');
    // Midseason/playoff/finale presentation fixtures use the pure engine on this isolated account only.
    let seedNumber = 0;
    const bootSeed = async (profile) => {
      const key =
          sport === 'nba'
            ? 'perfect-season:profile:v1'
            : 'perfect-season:profile:nfl:v1',
        flag = 'league-seed-' + ++seedNumber;
      await page.addInitScript(
        ({ key, profile, flag }) => {
          if (!sessionStorage.getItem(flag)) {
            localStorage.setItem(key, JSON.stringify(profile));
            sessionStorage.setItem(flag, '1');
          }
        },
        { key, profile, flag }
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enter();
    };
    const midseason = await page.evaluate(async () => {
      const { loadProfile } = await import('/src/lib/profile.ts'),
        { settleLeague, leagueRequest } = await import('/src/ut/league.ts');
      let p = loadProfile();
      while (p.ut.league.active.round < 10)
        p.ut = settleLeague(p.ut, leagueRequest(p.ut.league.active), {
          us: 24,
          them: 10,
          won: true
        });
      return p;
    });
    const seeded = midseason.ut.league.active;
    await bootSeed(midseason);
    await section('Stats');
    await layout('midseason-stats');
    await section('Standings');
    await layout('midseason-table');
    const playoffProfile = await page.evaluate(async () => {
      const { loadProfile } = await import('/src/lib/profile.ts'),
        { settleLeague, leagueRequest } = await import('/src/ut/league.ts');
      let p = loadProfile();
      while (p.ut.league.active.phase === 'regular')
        p.ut = settleLeague(p.ut, leagueRequest(p.ut.league.active), {
          us: 24,
          them: 10,
          won: true
        });
      return p;
    });
    await bootSeed(playoffProfile);
    await page
      .getByRole('button', { name: 'PLAY PLAYOFF GAME', exact: true })
      .waitFor();
    await layout('playoffs');
    const finalProfile = await page.evaluate(async () => {
      const { loadProfile } = await import('/src/lib/profile.ts'),
        { settleLeague, leagueRequest } = await import('/src/ut/league.ts');
      let p = loadProfile(),
        n = 0;
      while (p.ut.league.active.phase !== 'complete' && n++ < 30)
        p.ut = settleLeague(p.ut, leagueRequest(p.ut.league.active), {
          us: 24,
          them: 10,
          won: true
        });
      return p;
    });
    await bootSeed(finalProfile);
    await page
      .getByRole('heading', { name: 'CHAMPIONS.', exact: true })
      .waitFor();
    await layout('champions');
    await page
      .getByRole('button', { name: 'NEXT SEASON', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'START NEXT SEASON', exact: true })
      .click();
    const final = await current();
    assert.equal(final.ut.league.active.number, 2);
    assert.equal(final.ut.league.history[0].id, seeded.id);
    assert.equal(final.ut.league.history[0].title, true);
    assert.equal(final.coins, afterMatch.coins);
    assert.deepEqual(final.ut.squad, original.ut.squad);
    for (const card of original.ut.owned) {
      const got = final.ut.owned.find((c) => c.uid === card.uid);
      assert.ok(got);
      assert.equal(got.cardId, card.cardId);
      assert.ok(got.level >= card.level);
    }
    assert.deepEqual(errors, []);
    const row = {
      sport,
      clubs: initial.active.teams.length,
      games: sport === 'nba' ? 82 : 17,
      startMs,
      totalQaMs: Date.now() - start,
      screenSizes: 3,
      layouts: 12,
      realGameOutcome: won,
      leagueRoundAfterRealMatch: s.round,
      playedSeasonStored: true,
      championshipFixture: true,
      historyRetained: true,
      originalCopies: original.ut.owned.length,
      errors
    };
    report.push(row);
    console.log(JSON.stringify(row));
    await context.close();
  }
  fs.writeFileSync(
    path.join(artifacts, 'league-season-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
} finally {
  await browser.close();
}
