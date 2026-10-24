/* Perfect Season service worker. vite.config.ts fills in VERSION and PRECACHE at build time,
   so every deploy ships a new worker and installed copies pick it up on their next launch.

   - The page (index.html) comes from the network first, so a launch always gets the newest
     deploy; the cached copy is used offline or when the network takes longer than 3.5s.
   - Built files have content hashes in their names, so they are served from the cache.
   - Google Fonts are cached too, so the app looks right offline. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = 'ps-app-' + VERSION;
const FONTS = 'ps-fonts';
const PAGE = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ps-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(page());
    return;
  }
  if (url.origin === self.location.origin) {
    // the update check and the worker itself must always come from the network
    if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return;
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(staleWhileRevalidate(req));
});

function page() {
  const net = fetch(PAGE, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(PAGE, copy));
    }
    return res;
  });
  return new Promise((resolve) => {
    let done = false;
    const finish = (res) => {
      if (!done && res) {
        done = true;
        resolve(res);
      }
    };
    const cached = () => caches.open(CACHE).then((c) => c.match(PAGE));
    const slow = setTimeout(() => cached().then(finish), 3500);
    net
      .then((res) => {
        clearTimeout(slow);
        finish(res);
      })
      .catch(() => {
        clearTimeout(slow);
        cached().then((hit) => finish(hit || Response.error()));
      });
  });
}

function cacheFirst(req) {
  return caches.match(req, { ignoreSearch: true }).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
  );
}

function staleWhileRevalidate(req) {
  return caches.open(FONTS).then((c) =>
    c.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') c.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
}
