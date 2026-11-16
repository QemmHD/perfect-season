// Loaded by nba-qa-run.mjs into a shared QA script (node --import): before the script runs, the
// playwright it will load is guarded the nba-lib way (Claude 2026-11-16; route guard after review):
//  - nba-guard.mjs: every context a launched browser makes aborts requests and WebSockets to any
//    host but localhost/127.0.0.1 (fonts excepted), and the guard sits on the Route itself, so a
//    script's own page.route(...).continue() / fetch() to such a host is aborted too (scripts/qa
//    content.mjs and pack-cinema.mjs continue() card-registry requests); APIRequestContext, CDP
//    interception, service workers, persistent profiles, outside browsers and node's own
//    fetch/WebSocket/http(s) are covered as nba-guard.mjs describes
//  - page.goto moves the shared relay (ws://localhost:7777) to the team's own 7795, unless the runner
//    holds the 7777 lock for online.mjs (NBA_QA_KEEP_RELAY=1)
// If anything here fails, the child stops before the script's first line.
import { blocked, guardNode, guardPlaywright } from './nba-guard.mjs';
import { RELAY, require } from './nba-lib.mjs';

const keepRelay = process.env.NBA_QA_KEEP_RELAY === '1';
const pw = guardPlaywright(require('playwright'));
guardNode();

if (!keepRelay) {
  // the relay move, on every page however it was made (newPage, browser.newPage, popups)
  const seen = new WeakSet();
  const moveRelay = (page) => {
    const P = Object.getPrototypeOf(page);
    if (seen.has(P)) return;
    seen.add(P);
    const goto = P.goto;
    P.goto = function (u, opts) {
      return goto.call(this, String(u).replace(/relay=ws(%3A|:)(%2F%2F|\/\/)localhost(%3A|:)7777/g, 'relay=' + encodeURIComponent(RELAY)), opts);
    };
  };
  for (const type of ['chromium', 'webkit', 'firefox'].map((n) => pw[n]).filter(Boolean)) {
    const launch = type.launch.bind(type);
    type.launch = async (opts) => {
      const browser = await launch(opts);
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (o) => {
        const ctx = await newContext(o);
        ctx.on('page', moveRelay);
        return ctx;
      };
      return browser;
    };
    type.launch.nbaGuarded = true;
  }
}
if (!pw.chromium?.launch?.nbaGuarded) throw Error('nba-qa-run: could not guard playwright; refusing to run');

process.on('exit', () => {
  const hosts = [...new Set(blocked)];
  console.log(`\nnba-qa-run: requests to other hosts aborted: ${hosts.length ? hosts.join(', ') : 'none'}`);
});
