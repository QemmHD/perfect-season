// Codex (OpenAI): production first-load/sport isolation, lazy admin loading and offline relaunch.
// Run against a built localhost copy with PS_QA_BUILD_ROOT pointing to its --manifest output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, base } from './browser.mjs';
const root = process.env.PS_QA_BUILD_ROOT;
if (!root) throw Error('Set PS_QA_BUILD_ROOT to a production build made with --manifest.');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'));
const browser = await launch();
try {
  for (const sport of ['nba', 'nfl', 'soccer']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: !!process.env.PS_QA_PROXY });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const u = new URL(base);
    u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
    await page.goto(u.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'NEXT', exact: true }).waitFor();
    const selected = manifest['src/data/' + sport + '.json'].file;
    await page.waitForFunction(async file => {
      await navigator.serviceWorker.ready;
      return !!(await caches.match(new URL(file, location.href).href));
    }, selected, { timeout: 45000 });
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map(e => new URL(e.name).pathname));
    assert.ok(loaded.some(p => p.endsWith('/' + selected)), 'selected sport fetched');
    for (const other of ['nba','nfl','soccer'].filter(s => s !== sport)) {
      const file = manifest['src/data/' + other + '.json'].file;
      assert.ok(!loaded.some(p => p.endsWith('/' + file)), 'unused sport not fetched by page');
      assert.equal(await page.evaluate(async file => !!(await caches.match(new URL(file, location.href).href)), file), false, 'unused sport not precached');
    }
    const admin = manifest['src/ui/Admin.tsx'].file;
    assert.ok(!loaded.some(p => p.endsWith('/' + admin)), 'owner UI not executed at startup');
    // The first offline draft game must not silently fall back to missing player attributes.
    const attrs = manifest['src/data/' + sport + '-attrs.json']?.file;
    if (attrs) assert.equal(await page.evaluate(async file => !!(await caches.match(new URL(file, location.href).href)), attrs), true, 'real draft attributes precached');
    await context.setOffline(true);
    if (attrs) {
      const valid = await page.evaluate(async file => {
        const data = (await import(new URL(file, location.href).href)).default;
        return Array.isArray(data.fields) && data.fields.length > 0 && Object.keys(data.lines ?? {}).length > 100;
      }, attrs);
      assert.equal(valid, true, 'first offline attribute request returns real player data');
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'NEXT', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('perfect-season:sport')), sport);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ sport, selectedOnly: true, initialAdminDeferred: true, offlineAttrs: !!attrs, offlineRelaunch: true, errors }));
    await context.close();
  }
} finally { await browser.close(); }
