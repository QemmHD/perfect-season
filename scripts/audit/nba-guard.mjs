// The nba team's network guard for browser QA (Claude 2026-11-16, after review): nothing a QA run
// does may reach a host other than localhost / 127.0.0.1 (Google Fonts excepted). nba-lib.mjs and
// nba-qa-preload.mjs both install it; nba-qa-selftest.mjs proves it on every nba-qa-run.
//
// Why more than a context route: in Playwright a page.route handler runs before the context's, and
// its route.continue() (or route.fetch()) sends the request to the network without asking the next
// handler. A shared QA script that continue()s a request it routed itself (content.mjs does it to
// the card registry) would walk straight past an abort-everything context route. So the guard sits
// on the Route itself:
//  - every route handler registered on any page or context (route, routeFromHAR, routeWebSocket) is
//    wrapped, and the first route a wrapped handler sees patches the Route class once: continue() and
//    fetch() to a host that isn't allowed abort the request instead (fetch then throws), whatever
//    URL override they carry; the HAR redirect too. fulfill/abort/fallback are untouched, and a
//    fallback ends at the context's abort-everything route.
//  - a page-level WebSocket route's connectToServer() to such a host closes the page's socket and
//    hands back a dead server end.
//  - APIRequestContext (context.request, page.request, playwright.request.newContext, route.fetch)
//    refuses such hosts before anything is sent.
//  - removing the context's guard route (unroute / unrouteAll) puts it straight back.
//  - every new context blocks service workers (their fetches never pass through routes), and a
//    baseURL that isn't allowed is refused.
//  - CDP: the Fetch domain and request interception (which could continue requests behind
//    Playwright's back) are refused; so is a browser-level CDP session (it could make an unrouted
//    context); persistent profiles and connecting to an outside browser are refused.
//  - in node: fetch, WebSocket and http(s).request/get to such a host throw.
// Everything refused is recorded in `blocked` (the probes print it at the end of each run).
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

export const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];
/** node-side hosts also allowed (the loopback spellings) */
const NODE_ALLOWED = [...ALLOWED, '::1', '[::1]'];
export const blocked = [];

const LOCAL_PROTOCOLS = new Set(['data:', 'blob:', 'about:']);
const DONE = Symbol.for('nba-qa-guard.patched');
const ISO = Symbol.for('nba-qa-guard.isolation');
/** user handler → the wrapped one Playwright holds (so unroute(url, handler) still finds it) */
const WRAPPED = new WeakMap();

/** Is this URL one a QA run may reach? (relative URLs resolve against localhost: baseURLs are checked separately) */
export function allowedUrl(raw, hosts = ALLOWED) {
  if (raw === undefined || raw === null) return false;
  let u;
  try {
    u = new URL(String(raw), 'http://localhost/');
  } catch {
    return false;
  }
  return LOCAL_PROTOCOLS.has(u.protocol) || hosts.includes(u.hostname);
}

const hostOf = (raw) => {
  try {
    return new URL(String(raw)).hostname || String(raw);
  } catch {
    return String(raw);
  }
};
const note = (kind, raw) => blocked.push((kind ? kind + ':' : '') + hostOf(raw));
const refusal = (what, raw) => Error(`nba-qa guard: ${what} to ${hostOf(raw)} refused (QA never leaves localhost)`);

// ---------- the Route, WebSocketRoute and APIRequestContext classes (patched once each) ----------

function guardRouteClass(route) {
  const P = Object.getPrototypeOf(route);
  if (Object.prototype.hasOwnProperty.call(P, DONE)) return;
  const { continue: cont, fetch } = P;
  const redirect = P._redirectNavigationRequest;
  if (typeof cont !== 'function' || typeof fetch !== 'function') throw Error('nba-qa guard: this playwright Route has no continue/fetch; refusing');
  P.continue = async function (options = {}) {
    const target = options?.url ?? this.request().url();
    if (!allowedUrl(target)) {
      note('', target);
      return this.abort();
    }
    return cont.call(this, options);
  };
  P.fetch = async function (options = {}) {
    const target = options?.url ?? this.request().url();
    if (!allowedUrl(target)) {
      note('', target);
      await this.abort().catch(() => {});
      throw refusal('route.fetch', target);
    }
    return fetch.call(this, options);
  };
  if (typeof redirect === 'function')
    P._redirectNavigationRequest = async function (url) {
      if (!allowedUrl(url)) {
        note('', url);
        return this.abort();
      }
      return redirect.call(this, url);
    };
  Object.defineProperty(P, DONE, { value: true });
}

const deadServer = (url) => ({
  onMessage() {},
  onClose() {},
  connectToServer() {
    throw refusal('WebSocket', url);
  },
  url: () => url,
  protocols: () => [],
  close: async () => {},
  send() {},
  async [Symbol.asyncDispose]() {},
});

function guardWebSocketRouteClass(ws) {
  const P = Object.getPrototypeOf(ws);
  if (Object.prototype.hasOwnProperty.call(P, DONE)) return;
  const connect = P.connectToServer;
  if (typeof connect !== 'function') throw Error('nba-qa guard: this playwright WebSocketRoute has no connectToServer; refusing');
  P.connectToServer = function () {
    const url = this.url();
    if (!allowedUrl(url)) {
      note('ws', url);
      Promise.resolve(this.close()).catch(() => {});
      return deadServer(url);
    }
    return connect.call(this);
  };
  Object.defineProperty(P, DONE, { value: true });
}

function guardApiClass(api) {
  const P = Object.getPrototypeOf(api);
  if (Object.prototype.hasOwnProperty.call(P, DONE)) return;
  const inner = P._innerFetch;
  // every request method (get/post/…/fetch) and route.fetch() go through _innerFetch; without it we can't guard: refuse
  if (typeof inner !== 'function') throw Error('nba-qa guard: this playwright APIRequestContext has no _innerFetch; refusing');
  P._innerFetch = async function (options = {}) {
    const target = options.url !== undefined ? options.url : options.request?.url();
    if (!allowedUrl(target)) {
      note('api', target);
      throw refusal('API request', target);
    }
    return inner.call(this, options);
  };
  Object.defineProperty(P, DONE, { value: true });
}

const CDP_REFUSED = /^(Fetch\.|Network\.(setRequestInterception|continueInterceptedRequest)$|Target\.(createBrowserContext|createTarget|setDiscoverTargets|attachToBrowserTarget)$)/;
function guardCdpClass(session) {
  const P = Object.getPrototypeOf(session);
  if (Object.prototype.hasOwnProperty.call(P, DONE)) return;
  const send = P.send;
  P.send = async function (method, params) {
    if (CDP_REFUSED.test(String(method))) throw Error(`nba-qa guard: CDP ${method} refused (it could take requests past the route guard)`);
    return send.call(this, method, params);
  };
  Object.defineProperty(P, DONE, { value: true });
}

// ---------- route registration on pages and contexts ----------

const wrapRoute = (handler) => {
  if (typeof handler !== 'function') return handler;
  const w = function (route, request) {
    guardRouteClass(route);
    return handler.call(this, route, request);
  };
  WRAPPED.set(handler, w);
  return w;
};
const wrapWs = (handler) => {
  if (typeof handler !== 'function') return handler;
  const w = function (ws) {
    guardWebSocketRouteClass(ws);
    return handler.call(this, ws);
  };
  WRAPPED.set(handler, w);
  return w;
};

/** Patch route / routeWebSocket / unroute on a Page or BrowserContext class. */
function guardRouting(P) {
  const { route, routeWebSocket, unroute } = P;
  if (typeof route !== 'function' || typeof routeWebSocket !== 'function') throw Error('nba-qa guard: this playwright has no route/routeWebSocket; refusing');
  P.route = function (url, handler, options) {
    return route.call(this, url, wrapRoute(handler), options);
  };
  P.routeWebSocket = function (url, handler) {
    return routeWebSocket.call(this, url, wrapWs(handler));
  };
  if (typeof unroute === 'function')
    P.unroute = function (url, handler) {
      return unroute.call(this, url, handler ? (WRAPPED.get(handler) ?? handler) : handler);
    };
}

function guardPageClass(page) {
  const P = Object.getPrototypeOf(page);
  if (Object.prototype.hasOwnProperty.call(P, DONE)) return;
  guardRouting(P);
  Object.defineProperty(P, DONE, { value: true });
}

/** Put the context's abort-everything route back if a script removed it. */
async function reinstall(ctx) {
  const iso = ctx[ISO];
  if (!iso) return;
  const held = WRAPPED.get(iso) ?? iso;
  if (Array.isArray(ctx._routes) && ctx._routes.some((r) => r.handler === held)) return;
  await ctx.route('**/*', iso);
}

function guardContextClass(ctx) {
  const P = Object.getPrototypeOf(ctx);
  if (Object.prototype.hasOwnProperty.call(P, DONE)) return;
  guardRouting(P);
  const { unroute, unrouteAll, newPage, newCDPSession } = P;
  P.unroute = async function (url, handler) {
    await unroute.call(this, url, handler);
    await reinstall(this);
  };
  if (typeof unrouteAll === 'function')
    P.unrouteAll = async function (options) {
      await unrouteAll.call(this, options);
      await reinstall(this);
    };
  P.newPage = async function (...a) {
    const page = await newPage.apply(this, a);
    guardPageClass(page);
    return page;
  };
  if (typeof newCDPSession === 'function')
    P.newCDPSession = async function (...a) {
      const s = await newCDPSession.apply(this, a);
      guardCdpClass(s);
      return s;
    };
  Object.defineProperty(P, DONE, { value: true });
}

/** Abort every request and socket that would leave the machine (idempotent per context). */
export async function isolate(context) {
  if (context[ISO]) return;
  guardContextClass(context);
  guardApiClass(context.request);
  for (const p of context.pages()) guardPageClass(p);
  context.on('page', guardPageClass);
  const iso = (route) => {
    const u = route.request().url();
    if (allowedUrl(u)) return route.continue();
    note('', u);
    return route.abort();
  };
  context[ISO] = iso;
  await context.route('**/*', iso);
  await context.routeWebSocket(/.*/, (ws) => {
    if (allowedUrl(ws.url())) return ws.connectToServer();
    note('ws', ws.url());
    return ws.close();
  });
}

const checkBase = (opts) => {
  if (opts?.baseURL !== undefined && !allowedUrl(opts.baseURL)) throw refusal('baseURL', opts.baseURL);
};

/**
 * Guard a playwright module: every browser it launches makes isolated contexts only (browser.newPage
 * included), with service workers blocked; persistent profiles, launchServer, connecting to an
 * outside browser and browser-level CDP sessions are refused. Idempotent.
 */
export function guardPlaywright(pw) {
  if (pw[DONE]) return pw;
  const types = ['chromium', 'webkit', 'firefox'].map((n) => pw[n]).filter(Boolean);
  if (!types.length) throw Error('nba-qa guard: no browser types in this playwright; refusing');
  const browsers = new Set();
  const guardBrowserClass = (browser) => {
    const P = Object.getPrototypeOf(browser);
    if (browsers.has(P)) return;
    browsers.add(P);
    const newContext = P.newContext;
    P.newContext = async function (opts = {}) {
      checkBase(opts);
      const ctx = await newContext.call(this, { ...opts, serviceWorkers: 'block' });
      await isolate(ctx);
      return ctx;
    };
    // Browser.newPage makes its context with this.newContext (the guarded one above)
    P.newBrowserCDPSession = async () => {
      throw Error('nba-qa guard: a browser-level CDP session is refused (it could make an unrouted context)');
    };
  };
  for (const type of new Set(types.map((t) => Object.getPrototypeOf(t)))) {
    const launch = type.launch;
    type.launch = async function (opts) {
      const browser = await launch.call(this, opts);
      guardBrowserClass(browser);
      return browser;
    };
    type.launch.nbaGuarded = true;
    type.launchPersistentContext = async () => {
      throw Error('nba-qa guard: a persistent browser profile is refused (QA never loads a real profile)');
    };
    type.launchServer = async () => {
      throw Error('nba-qa guard: launchServer is refused');
    };
    type.connect = type.connectOverCDP = async () => {
      throw Error('nba-qa guard: connecting to an outside browser is refused');
    };
  }
  // instances must not shadow the guarded prototype methods
  for (const t of types)
    for (const m of ['launch', 'launchPersistentContext', 'launchServer', 'connect', 'connectOverCDP'])
      if (Object.prototype.hasOwnProperty.call(t, m)) delete t[m];
  if (pw.request?.newContext) {
    const newApi = pw.request.newContext.bind(pw.request);
    pw.request.newContext = async (opts = {}) => {
      checkBase(opts);
      const api = await newApi(opts);
      guardApiClass(api);
      return api;
    };
  }
  if (!types.every((t) => t.launch.nbaGuarded)) throw Error('nba-qa guard: could not guard playwright; refusing');
  Object.defineProperty(pw, DONE, { value: true });
  return pw;
}

/** The host an http(s).request / get call is for. */
function nodeTarget(args) {
  const [a, b] = args;
  if (typeof a === 'string' || a instanceof URL) return String(a);
  const o = a && typeof a === 'object' ? a : b && typeof b === 'object' ? b : {};
  if (o.socketPath) return 'http://localhost/';
  const host = o.hostname ?? (o.host ? String(o.host).replace(/:\d+$/, '') : 'localhost');
  return `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}/`;
}

/** Node-side: fetch, WebSocket and http(s) requests from the QA script itself stay on this machine. */
export function guardNode() {
  if (globalThis[DONE]) return;
  const f = globalThis.fetch;
  if (typeof f === 'function')
    globalThis.fetch = function (input, init) {
      const target = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
      if (!allowedUrl(target, NODE_ALLOWED)) {
        note('node', target);
        return Promise.reject(refusal('fetch', target));
      }
      return f.call(this, input, init);
    };
  const WS = globalThis.WebSocket;
  if (typeof WS === 'function')
    globalThis.WebSocket = class extends WS {
      constructor(url, protocols) {
        if (!allowedUrl(url, NODE_ALLOWED)) {
          note('node-ws', url);
          throw refusal('WebSocket', url);
        }
        super(url, protocols);
      }
    };
  for (const mod of [http, https])
    for (const m of ['request', 'get']) {
      const orig = mod[m];
      mod[m] = function (...args) {
        const target = nodeTarget(args);
        if (!allowedUrl(target, NODE_ALLOWED)) {
          note('node', target);
          throw refusal(`http ${m}`, target);
        }
        return orig.apply(this, args);
      };
    }
  syncBuiltinESMExports();
  Object.defineProperty(globalThis, DONE, { value: true });
}
