// Loaded by nba-qa-run.mjs into a shared QA script (node --import): before the script runs, every
// playwright browser it launches is isolated the nba-lib way (Claude 2026-11-16):
//  - each new context aborts requests and WebSockets to any host but localhost/127.0.0.1 (fonts
//    excepted), so a shared script can't reach live Supabase, relays or boards
//  - page.goto moves the shared relay (ws://localhost:7777) to the team's own 7795, unless the runner
//    holds the 7777 lock for online.mjs (NBA_QA_KEEP_RELAY=1)
//  - persistent profiles and connecting to an outside browser are refused
// If anything here fails, the child stops before the script's first line.
import { blocked, isolate, RELAY, require } from './nba-lib.mjs';

const keepRelay = process.env.NBA_QA_KEEP_RELAY === '1';
const pw = require('playwright');

function patchPage(page) {
  const goto = page.goto.bind(page);
  page.goto = (u, opts) => goto(keepRelay ? u : String(u).replace(/relay=ws(%3A|:)(%2F%2F|\/\/)localhost(%3A|:)7777/g, 'relay=' + encodeURIComponent(RELAY)), opts);
  return page;
}

function patchContext(ctx) {
  const newPage = ctx.newPage.bind(ctx);
  ctx.newPage = async () => patchPage(await newPage());
  return ctx;
}

function patchBrowser(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts = {}) => {
    const ctx = await newContext(opts);
    await isolate(ctx);
    return patchContext(ctx);
  };
  browser.newPage = async (opts = {}) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.once('close', () => ctx.close().catch(() => {}));
    return page;
  };
  return browser;
}

for (const name of ['chromium', 'webkit', 'firefox']) {
  const type = pw[name];
  if (!type) continue;
  const launch = type.launch.bind(type);
  type.launch = async (opts) => patchBrowser(await launch(opts));
  type.launch.nbaIsolated = true;
  type.launchPersistentContext = async () => {
    throw Error('nba-qa-run: a persistent browser profile is refused (QA never loads a real profile)');
  };
  type.connect = type.connectOverCDP = async () => {
    throw Error('nba-qa-run: connecting to an outside browser is refused');
  };
}
if (!pw.chromium?.launch?.nbaIsolated) throw Error('nba-qa-run: could not isolate playwright; refusing to run');

process.on('exit', () => {
  const hosts = [...new Set(blocked)];
  console.log(`\nnba-qa-run: requests to other hosts aborted: ${hosts.length ? hosts.join(', ') : 'none'}`);
});
