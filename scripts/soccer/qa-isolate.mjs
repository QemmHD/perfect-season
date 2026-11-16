// Soccer browser QA isolation, insets and device presets (studio overhaul soccer-1, Claude
// 2026-11-10). Every soccer QA script (scripts/qa/soccer-lab.mjs, soccer-app.mjs) runs through it:
//  - isolate(context): one route handler per context. localhost, 127.0.0.1 and the two font hosts go
//    on with route.fallback() (so a handler scripts/qa/browser.mjs adds later still runs: both keep
//    the same allowlist); every other request is aborted and counted, WebSockets included (a page
//    can never reach a live Nostr relay, Supabase or a leaderboard). The count is logged.
//  - insets(context, [t, r, b, l]): window.__psInsets for the app's stage, plus the matching --sat /
//    --sab / --sal / --sar on .arcade-full, which reads env() directly (Chromium has no safe areas).
//    If the app already computes --sat from __psInsets (shell's Fix A), nothing is injected.
//  - PRESETS: the six phones every soccer layout check runs at, insets [top, right, bottom, left].
// Pages open with ?ns=inspect&relay=ws://localhost:7777 (urlFor).
const ALLOW = new Set(['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const guarded = new WeakSet();
/** requests aborted, by host */
export const blocked = { count: 0, hosts: {} };
const count = (host) => {
  blocked.count++;
  blocked.hosts[host] = (blocked.hosts[host] ?? 0) + 1;
};
const local = (u) => u.protocol === 'data:' || u.protocol === 'blob:' || ALLOW.has(u.hostname);

/** Abort every request (and WebSocket) to a host off the allowlist; count it. Once per context. */
export async function isolate(context) {
  if (guarded.has(context)) return context;
  guarded.add(context);
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (local(u)) return route.fallback();
    count(u.hostname);
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(/.*/, (ws) => {
    const u = new URL(ws.url());
    if (ALLOW.has(u.hostname)) return ws.connectToServer();
    count(u.hostname);
    return ws.close({ code: 1008, reason: 'QA isolation: live host blocked' });
  });
  return context;
}

/** Every context this browser makes is isolated before its first page opens (for helpers that make
 * their own contexts, like browser.mjs fixture). */
export function isolateBrowser(browser) {
  const make = browser.newContext.bind(browser);
  browser.newContext = async (options) => isolate(await make(options));
  return browser;
}

/** Safe-area insets [top, right, bottom, left] for the stage and the full-screen games. */
export async function insets(context, ins) {
  const [t, r, b, l] = ins;
  await context.addInitScript(
    ([t, r, b, l]) => {
      window.__psInsets = [t, r, b, l];
      const apply = () => {
        const probe = document.createElement('div');
        probe.className = 'arcade-full';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        const has = parseFloat(getComputedStyle(probe).getPropertyValue('--sat')) === t;
        probe.remove();
        if (has) return;
        const st = document.createElement('style');
        st.dataset.qaInsets = '1';
        st.textContent = `.arcade-full{--sat:${t}px!important;--sab:${b}px!important;--sal:${l}px!important;--sar:${r}px!important}`;
        document.head.appendChild(st);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
      else apply();
    },
    [t, r, b, l]
  );
}

/** The computed --sat on the full-screen game (px), for the check that the insets took. */
export const computedSat = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.arcade-full');
    return el ? parseFloat(getComputedStyle(el).getPropertyValue('--sat')) : null;
  });

/** The six phones: the owner's (Dynamic Island, raw and with shell's 22 px edge), a notch, a Pro
 * Max, a home-button phone and the smallest. */
export const PRESETS = [
  { tag: '393x852-sat59', w: 393, h: 852, insets: [59, 0, 34, 0] },
  { tag: '393x852-sat81', w: 393, h: 852, insets: [81, 0, 34, 0] },
  { tag: '390x844', w: 390, h: 844, insets: [47, 0, 34, 0] },
  { tag: '430x932', w: 430, h: 932, insets: [59, 0, 34, 0] },
  { tag: '375x667', w: 375, h: 667, insets: [20, 0, 0, 0] },
  { tag: '320x568', w: 320, h: 568, insets: [0, 0, 0, 0] },
];

/** A touch phone context for a preset: isolated, its insets set. dpr 1 for checks, 3 for the
 * screenshots the owner sees. */
export async function phone(browser, preset, { dpr = 1, reducedMotion = 'no-preference' } = {}) {
  const context = await isolate(await browser.newContext({ viewport: { width: preset.w, height: preset.h }, hasTouch: true, isMobile: true, deviceScaleFactor: dpr, reducedMotion }));
  await insets(context, preset.insets);
  return context;
}

/** The app's URL on the QA base with the isolated namespace and the local relay, plus `params`. */
export function urlFor(base, params = {}) {
  const url = new URL(base);
  url.search = new URLSearchParams({ ns: 'inspect', relay: 'ws://localhost:7777', ...params }).toString();
  return url.href;
}

/** One line for the log: how much was kept off the network. */
export const blockedLine = () => 'QA isolation: blocked ' + blocked.count + ' request(s) to live hosts ' + JSON.stringify(blocked.hosts);
