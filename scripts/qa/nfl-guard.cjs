// Team nfl preload for the legacy QA scripts (Claude, studio overhaul), which use browser.mjs: no
// route-abort, reduced motion on by default and port 5173. Run them through this guard:
//
//   NFL_RM=reduce node -r ./scripts/qa/nfl-guard.cjs scripts/qa/joystick.mjs
//
// It points them at the team's dev server (port 5216), wraps Playwright so every new context aborts
// requests to any host but localhost, 127.0.0.1 and the two font hosts, takes reduced motion from
// NFL_RM (required, so a motion check is never run against an unstated default), and fails the run
// if any non-local request was attempted.
const { createRequire } = require('node:module');
const path = require('node:path');

process.env.PS_QA_URL = 'http://localhost:5216/';
const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const blocked = [];
const motion = process.env.NFL_RM;
if (motion !== 'reduce' && motion !== 'no-preference') {
  console.error('nfl-guard: set NFL_RM=reduce or NFL_RM=no-preference');
  process.exit(2);
}

// the same Playwright the scripts load (browser.mjs resolves it from the repo's package.json)
const pw = createRequire(path.join(__dirname, '..', '..', 'package.json'))('playwright');

async function isolate(context) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || ALLOWED.includes(u.hostname)) return route.continue();
    blocked.push(u.hostname);
    return route.abort();
  });
  await context.addInitScript((allowed) => {
    const Native = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      const host = new URL(url, location.href).hostname;
      if (!allowed.includes(host)) throw new Error('QA isolation: WebSocket to ' + host + ' blocked');
      return new Native(url, protocols);
    };
    window.WebSocket.prototype = Native.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  }, ALLOWED);
  return context;
}

for (const type of [pw.chromium, pw.firefox, pw.webkit]) {
  const launch = type.launch.bind(type);
  type.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (options = {}) => isolate(await newContext({ ...options, reducedMotion: motion }));
    // a bare newPage() makes its own context: route it the same way
    browser.newPage = async (options = {}) => (await browser.newContext(options)).newPage();
    return browser;
  };
  type.launchPersistentContext = async () => {
    throw new Error('nfl-guard: persistent browser profiles are not allowed in QA');
  };
}

process.on('exit', () => {
  if (blocked.length) {
    console.error('nfl-guard: BLOCKED ' + blocked.length + ' non-local request(s): ' + [...new Set(blocked)].join(', '));
    process.exitCode = 1;
  } else console.error('nfl-guard: no non-local requests (reduced motion: ' + motion + ')');
});

module.exports = { blocked };
