// Claude (studio overhaul, shell-4, 2026-11-16): Settings → Advanced → Erase all progress (audit M8),
// in the real app. Isolated like every shell run: ?ns=inspect, the local relay, every other host
// aborted, serialized fixture players only. It NEVER taps ERASE EVERYTHING or SAVE NOW: it proves the
// erase can't happen by accident, and that looking at it changes nothing.
//
//   node scripts/qa/settings-danger.mjs [--sports nba,nfl,soccer]
//
// Per sport (393 × 852, insets 59/34): every localStorage write (setItem/removeItem/clear) and every
// request off this machine while the panel is open is counted, and both must be 0 (the cloud save's
// periodic offline retry, which runs on every screen, is reported apart); the panel's
// amounts must equal the stored saves (coins, level, cards and draft runs per sport); ERASE stays
// aria-disabled after any 2 of the 3 actions and only unlocks after all 3; with a 310 px visual
// viewport (the keyboard up) the word field, the tick and both buttons are on screen; KEEP closes the
// panel with the profile deep-equal; every control is ≥ 44 px. Screenshots: collapsed, open, typed,
// ticked, keyboard, and the open panel at 320 × 568.
// Output: <PS_QA_SHOTS>/shell-4/danger/danger.json and the screenshots there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, fixture, launch } from './browser.mjs';
import { loadFixture, waitForHome } from './fixtures.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const sports = opt('sports', 'nba,nfl,soccer').split(',');
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), 'shell-4', 'danger');
fs.mkdirSync(OUT, { recursive: true });
const KEYS = { nba: 'perfect-season:profile:v1', nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' };
const LABEL = { nba: 'NBA', nfl: 'NFL', soccer: 'SOCCER' };

/** Counts every storage write from now on, by key. */
const watchWrites = (page) =>
  page.evaluate(() => {
    const w = (window.__psWrites = []);
    const P = Storage.prototype;
    for (const m of ['setItem', 'removeItem', 'clear']) {
      const orig = P[m];
      P[m] = function (...a) {
        if (this === localStorage) w.push(m + ':' + (a[0] ?? ''));
        return orig.apply(this, a);
      };
    }
  });
const writes = (page) => page.evaluate(() => window.__psWrites.slice());
const rect = (loc) => loc.evaluate((e) => ({ y: Math.round(e.getBoundingClientRect().top), b: Math.round(e.getBoundingClientRect().bottom), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }));
const eraseOff = (page) => page.getByRole('button', { name: 'ERASE EVERYTHING' }).getAttribute('aria-disabled');

async function run(browser, sport, width = 393, height = 852) {
  const f = await fixture(browser, sport, 'Shell QA', width, { isMobile: true, hasTouch: true }, { insets: width === 393 ? [59, 0, 34, 0] : [20, 0, 0, 0], height, serialized: true });
  const { page } = f;
  const out = { sport, width, height };
  try {
    // the other sports' own saves too, so the panel has something to list for each (before anything is watched)
    await page.evaluate(
      ({ keys }) => {
        for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      },
      { keys: Object.fromEntries(Object.keys(KEYS).filter((s) => s !== sport && s !== 'nba').map((s) => [KEYS[s], loadFixture('standard', s).keys[KEYS[s]]])) }
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHome(page);
    const before = await f.current();
    const tag = sport + (width === 393 ? '' : '-' + width);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const sheet = page.locator('.sheet');
    await sheet.waitFor();
    await page.waitForTimeout(400);
    const toggle = page.getByRole('button', { name: 'ADVANCED' });
    await toggle.scrollIntoViewIfNeeded();
    if (width !== 393) {
      await toggle.click();
      await page.locator('.danger-panel').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `danger-${tag}-open.png`) });
      out.shots = 1;
      out.pass = true;
      return out;
    }
    await page.screenshot({ path: path.join(OUT, `danger-${tag}-collapsed.png`) });
    out.toggle = await rect(toggle);
    // from here on nothing may be written or sent
    await watchWrites(page);
    const blocked0 = f.blocked.length;
    const offHost = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (['localhost', '127.0.0.1'].includes(u.hostname) || !u.protocol.startsWith('http')) return;
      // the cloud save's op is inside the signed event's content
      let op = null;
      try {
        op = JSON.parse(JSON.parse(r.postData() || '{}').event?.content ?? '{}').op ?? null;
      } catch {}
      offHost.push({ at: Date.now(), host: u.hostname, path: u.pathname, op });
    });
    await toggle.click();
    const panel = page.locator('.danger-panel');
    await panel.waitFor();
    out.expanded = await toggle.getAttribute('aria-expanded');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `danger-${tag}-open.png`) });
    // the amounts: as stored, read the same raw way
    const stored = await page.evaluate(
      ({ KEYS, sport }) =>
        Object.fromEntries(
          Object.entries(KEYS)
            .map(([s, k]) => [s, localStorage.getItem(k)])
            .filter(([s, v]) => s === sport || v)
            .map(([s, v]) => {
              const p = JSON.parse(v);
              return [s, { cards: p?.ut?.owned?.length ?? 0, runs: p?.history?.length ?? 0 }];
            })
        ),
      { KEYS, sport }
    );
    out.panelText = (await panel.innerText()).replace(/\s+/g, ' ');
    const fmt = (n) => n.toLocaleString('en-US');
    out.amounts = { coins: before.coins, xp: before.xp, stored };
    assert.ok(out.panelText.includes(fmt(before.coins) + ' coins'), 'coins');
    assert.ok(out.panelText.includes('(' + fmt(before.xp) + ' XP)'), 'xp');
    for (const [s, v] of Object.entries(stored)) assert.ok(new RegExp(LABEL[s] + ' ' + fmt(v.cards) + ' cards? · ' + fmt(v.runs) + ' draft runs?').test(out.panelText), 'cards for ' + s);
    out.amountsMatch = true;
    // the three deliberate actions: any two leave ERASE locked
    const input = page.getByRole('textbox', { name: /Type ERASE/ });
    const tick = page.locator('.danger-tick');
    out.locked = { opened: await eraseOff(page) };
    await input.fill('eras');
    out.locked.partialWord = await eraseOff(page);
    await input.fill('erase');
    out.locked.wordOnly = await eraseOff(page);
    await page.screenshot({ path: path.join(OUT, `danger-${tag}-typed.png`) });
    await input.fill('');
    await tick.click();
    out.locked.tickOnly = await eraseOff(page);
    await input.fill('ERASE');
    out.locked.all3 = await eraseOff(page);
    await page.screenshot({ path: path.join(OUT, `danger-${tag}-ticked.png`) });
    // the keyboard: the layout viewport stays 393 × 852 and the visual viewport drops to 310 px, as on
    // an iPhone (a smaller window would read as landscape); the word field is focused
    await input.focus();
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => 310 });
      vv.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(700);
    const controls = { input, tick, keep: page.getByRole('button', { name: 'KEEP MY PROGRESS' }), erase: page.getByRole('button', { name: 'ERASE EVERYTHING' }) };
    out.keyboard = {};
    for (const [k, loc] of Object.entries(controls)) out.keyboard[k] = await rect(loc);
    out.keyboardVisible = Object.values(out.keyboard).every((r) => r.y >= 0 && r.b <= 310);
    await page.screenshot({ path: path.join(OUT, `danger-${tag}-keyboard.png`), clip: { x: 0, y: 0, width: 393, height: 310 } });
    await page.evaluate(() => {
      delete window.visualViewport.height;
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(400);
    out.targets = { toggle: out.toggle };
    for (const [k, loc] of Object.entries(controls)) out.targets[k] = await rect(loc);
    out.minTarget = Math.min(...Object.values(out.targets).map((r) => r.h));
    // KEEP: closes the panel, nothing changed
    await controls.keep.click();
    await panel.waitFor({ state: 'detached' });
    out.keepClosed = (await toggle.getAttribute('aria-expanded')) === 'false';
    out.writes = await writes(page);
    // every request that tried to leave this machine (all were aborted by the isolation). The cloud
    // save's own offline retry (a `load` every 15 s while the server can't be reached, cloud-save.ts)
    // runs whatever is on screen, so it is listed apart; anything else would come from the panel.
    out.offHost = offHost;
    out.cloudRetries = offHost.filter((r) => r.op === 'load').length;
    out.requestsOff = offHost.length - out.cloudRetries;
    out.blockedDuringPanel = f.blocked.length - blocked0;
    const after = await f.current();
    assert.deepEqual(after, before, 'profile changed');
    out.profileEqual = true;
    out.errors = f.errors;
    out.pass =
      out.expanded === 'true' &&
      out.amountsMatch &&
      ['opened', 'partialWord', 'wordOnly', 'tickOnly'].every((k) => out.locked[k] === 'true') &&
      out.locked.all3 === 'false' &&
      out.keyboardVisible &&
      out.minTarget >= 44 &&
      out.keepClosed &&
      out.writes.length === 0 &&
      out.requestsOff === 0 &&
      out.errors.length === 0;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-danger-${sport}-${width}.png`) }).catch(() => {});
  } finally {
    await f.context.close();
  }
  return out;
}

const browser = await launch();
const report = { at: new Date().toISOString(), runs: [] };
try {
  for (const sport of sports) {
    for (const [w, h] of [
      [393, 852],
      [320, 568],
    ]) {
      const r = await run(browser, sport, w, h);
      report.runs.push(r);
      console.log(JSON.stringify({ sport, w, pass: r.pass, fail: r.fail, writes: r.writes?.length, off: r.requestsOff, locked: r.locked, kb: r.keyboardVisible, min: r.minTarget }));
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'danger.json'), JSON.stringify(report, null, 1));
if (report.runs.some((r) => !r.pass)) process.exitCode = 1;
