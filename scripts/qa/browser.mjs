// Implemented by Codex. Optional, isolated localhost QA; never loads a real browser profile.
// Claude (studio overhaul, shell-1, 2026-11-10): every context is now isolated from live services.
// Requests and WebSockets to any host other than localhost/127.0.0.1 are aborted (Google Fonts stay
// allowed, so text measures as on a phone) and each blocked host is recorded in `f.blocked`. An
// optional sixth `fixture` argument adds iPhone insets, standalone mode, scale, motion and a fixture
// profile (fixtures.mjs), which also works against a production build (`PS_QA_BUILD_ROOT`).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { buildFixture, inject } from './fixtures.mjs';
export const require = createRequire(process.env.PS_QA_PACKAGE_JSON || new URL('../../package.json', import.meta.url));
export const base = process.env.PS_QA_URL || 'http://localhost:5173/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
export const artifacts = process.env.PS_QA_ARTIFACTS || '/tmp/perfect-season-qa';
fs.mkdirSync(artifacts, { recursive: true });
/** A production build is being served (vite preview): fixtures come from serialized files, never /src. */
export const buildRoot = process.env.PS_QA_BUILD_ROOT || null;

export const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
export const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
/** May a QA page reach this URL? Only this machine, inline data, and the font CDN. */
export function allowedUrl(u) {
  const url = typeof u === 'string' ? new URL(u) : u;
  if (['data:', 'blob:', 'about:'].includes(url.protocol)) return true;
  return LOCAL_HOSTS.includes(url.hostname) || (FONT_HOSTS.includes(url.hostname) && url.protocol === 'https:');
}
/**
 * Abort every request and WebSocket a context makes to any other host, and list the hosts. Routes
 * only what is refused, so local traffic is never slowed by interception.
 */
export async function isolate(context, blocked = []) {
  await context.route(
    (url) => !allowedUrl(url),
    (route) => {
      blocked.push(new URL(route.request().url()).hostname);
      return route.abort('blockedbyclient');
    }
  );
  await context.routeWebSocket(
    (url) => !LOCAL_HOSTS.includes(url.hostname),
    (ws) => {
      blocked.push(new URL(ws.url()).hostname);
      return ws.close();
    }
  );
  return blocked;
}

export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  const proxy = process.env.PS_QA_PROXY;
  return chromium.launch({
    headless: true,
    ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
    args: ['--no-sandbox', ...(proxy ? ['--proxy-server=' + proxy, '--proxy-bypass-list=localhost;127.0.0.1'] : [])],
  });
}

/**
 * An isolated context and page with a fixture player, on `?sport&ns=inspect&relay=ws://localhost:7777`.
 * `options` (all optional):
 *  - insets [t,r,b,l] screen px: `window.__psInsets` before the app loads (the stage reads it)
 *  - height: viewport height (default 844)
 *  - standalone: `navigator.standalone = true`, and display-mode emulation where CDP supports it
 *  - dsf: device scale factor; motion: 'reduce' (default) or 'no-preference'
 *  - profile: 'standard' (default) | 'heavy' | 'utNoStarter' | 'checkpoint' | 'fresh'. On the dev
 *    server 'standard' is built from the source modules as before; every other profile, and every
 *    profile against a production build, comes from the serialized file (fixtures.mjs).
 *  - serialized: use the serialized file for 'standard' on the dev server too (faster, and the same
 *    player the production-build runs get)
 *  - relay: the Nostr relay URL (default ws://localhost:7777); it must be on this machine
 */
export async function fixture(browser, sport = 'nba', name = 'Codex QA', width = 390, contextOptions = {}, options = {}) {
  const { insets = null, height = 844, standalone = false, dsf = null, motion = 'reduce', profile = 'standard', serialized: useFile = false, relay = 'ws://localhost:7777' } = options;
  if (!LOCAL_HOSTS.includes(new URL(relay).hostname)) throw Error('QA relays are restricted to localhost.');
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: motion,
    ignoreHTTPSErrors: !!process.env.PS_QA_PROXY,
    ...(dsf ? { deviceScaleFactor: dsf } : {}),
    ...contextOptions,
  });
  const blocked = await isolate(context);
  if (insets || standalone)
    await context.addInitScript(
      ({ insets, standalone }) => {
        if (insets) window.__psInsets = insets;
        if (standalone) Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
      },
      { insets, standalone }
    );
  const serialized = !!buildRoot || useFile || profile !== 'standard';
  const made = serialized ? await inject(context, profile, sport, name) : null;
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let displayMode = null;
  if (standalone) {
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
      displayMode = 'emulated';
    } catch (e) {
      // Chromium's CDP has no display-mode feature: edge-lib's forceStandaloneRule stands in (L7)
      displayMode = 'unsupported: ' + e.message.split('\n')[0];
    }
  }
  const url = new URL(base);
  url.search = new URLSearchParams({ sport, ns: 'inspect', relay });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  if (!serialized) {
    await buildFixture(page, sport, 'standard', name);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  const current = () =>
    page.evaluate((sport) => {
      const p = JSON.parse(localStorage.getItem({ nba: 'perfect-season:profile:v1', nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' }[sport]));
      const shared = JSON.parse(localStorage.getItem('perfect-season:profile:v1'));
      p.coins = shared.coins;
      p.xp = shared.xp;
      p.inventory = shared.inventory;
      return p;
    }, sport);
  return { page, context, current, errors, blocked, displayMode, fixture: made && { profile, made: made.made, source: made.source }, original: profile === 'fresh' ? null : await current() };
}
export async function shot(page, name) {
  await page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled', timeout: 12000 });
}
export async function dismissPack(page) {
  for (let i = 0; i < 9 && (await page.locator('.ut-open-screen').count()); i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.isVisible().catch(() => false)) await done.click();
    else {
      const skip = page.getByRole('button', { name: 'SKIP', exact: true });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      else await page.locator('.ut-open-screen').click({ position: { x: 10, y: 60 } });
    }
    await page.waitForTimeout(220);
  }
}
