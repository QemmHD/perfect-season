/* Perfect Season service worker. vite.config.ts fills in VERSION and PRECACHE at build time,
   so every deploy ships a new worker and installed copies pick it up on their next launch.

   - The page (index.html) comes from the network first, so a launch always gets the newest
     deploy; the cached copy is used offline or when the network takes longer than 3.5s.
   - Built files have content hashes in their names, so they are served from the cache.
   - Google Fonts are cached too, so the app looks right offline. */
const VERSION = '20261109.2220-acdf3e2';
const PRECACHE = ["./","./assets/backboard-CA5EV4VD.mp3","./assets/buzzer-DsBbim5F.mp3","./assets/cheer-arena-BVahyW4a.mp3","./assets/cheer-stadium-DyLSn9wp.mp3","./assets/crowd-arena-GQNnD_m4.mp3","./assets/crowd-stadium-ByxrXYSs.mp3","./assets/dunk-ghFC0nok.mp3","./assets/groan-PD_ZbDO0.mp3","./assets/hit-1-CzI6hhLG.mp3","./assets/hit-2-Bj6jd9zU.mp3","./assets/hit-3-BpVUe9jf.mp3","./assets/horn-BMdZ_gWo.mp3","./assets/kick-DXkNl8dA.mp3","./assets/ooh-kKo8txVT.mp3","./assets/roar-arena-CPZWdcmm.mp3","./assets/roar-stadium-CL7uX0Qb.mp3","./assets/swish-BkcM1oS_.mp3","./assets/thud-B39yxcZH.mp3","./assets/whistle-DeTbXNJj.mp3","./assets/index-BC0n-Ozt.css","./assets/UltimateTeam-CheHnW97.css","./assets/Match-BF3lg7FK.css","./assets/Vote-BJrDjKis.css","./assets/content-progress-s91sf_kV.css","./assets/Football2-CFbTp2Dy.css","./assets/Admin-DpeKhE0Q.css","./assets/PackArt-LGZaQvGh.css","./assets/CardArt-DZ5uQo38.css","./assets/arcade-BipQX95B.css","./assets/persp-hYMmNyQh.css","./assets/index-Br4J7UAU.js","./assets/Lab-CMPDPUCw.js","./assets/Scene-C4OCVXll.js","./assets/Gallery-7MBlP8Tx.js","./assets/UltimateTeam-BQu_usxD.js","./assets/Match-OHG4VfNv.js","./assets/Vote-a5QduWLO.js","./assets/content-progress-B0N_6FRx.js","./assets/favorites-CXYDQFNV.js","./assets/Arcade-C9jmqNLt.js","./assets/Training-VCy6TLKH.js","./assets/Hero-CnyOli2N.js","./assets/teams-DCcpuG8_.js","./assets/Marks-B2PkUnY4.js","./assets/Football2-CsAt2-ZZ.js","./assets/errlog-UOTLg4p3.js","./assets/Admin-BxnNmBvL.js","./assets/gift-apply-dfvAKpqf.js","./assets/PackArt-B_5doUX4.js","./assets/match-ik1Tdgnk.js","./assets/CardArt-BTxQ8-wK.js","./assets/Card-DF3Pc-eV.js","./assets/state-1QPoFo30.js","./assets/soccer-lazy-BRk2L95Z.js","./assets/ratings-GjchP5Jx.js","./assets/rivals-net-CccZ_9Hk.js","./assets/names-Bd6rJ-in.js","./assets/rivals-Bvnp6fU9.js","./assets/numbered-nba-fsWjzbzI.js","./assets/numbered-nfl-DcL6EucY.js","./assets/index-Cvs1FVwy.js","./assets/nba-DviJ8aqN.js","./assets/nfl-B_EpJfsL.js","./assets/season-references-nba-Bzg-HacI.js","./assets/season-references-nfl-BO23FFZx.js","./assets/nfl-combine-DVgvoZvk.js","./assets/live-calendar-DBCIMbmX.js","./assets/live-editions-EoYkD0fd.js","./assets/persp-BIZ8YPqQ.js","./assets/index-ITRcDHAa.js","./assets/court-DVUx9xts.js","./assets/mocap-RC-YIXU0.js","./assets/uniforms-CS3vZgGv.js","./assets/sound-Byy6VNix.js","./assets/preload-helper-C1FmrZbK.js","./assets/poses-DHz5H5pI.js","./assets/color-CzAXAyWi.js","./assets/sport-CKm__E-o.js","./assets/nba-attrs-DKRoNbFg.js","./assets/nfl-attrs-DE7t5FmR.js","./assets/backpedal-PVlsMGIb.js","./assets/block-Bi5j-tfS.js","./assets/catch-D5l5OnTe.js","./assets/catch_run-Dqgq_2pu.js","./assets/celebrate-w6DoVLrc.js","./assets/crossover-4pV7BQoE.js","./assets/cut-DNWbD7de.js","./assets/dive-5W5Q4AMr.js","./assets/dribble-Ov7vI57q.js","./assets/fall_back-BNo-os7n.js","./assets/fall_forward-BBo6RfM2.js","./assets/getup-mcLF4BT9.js","./assets/getup_front-D5U_scM8.js","./assets/jog-Dyu_EzwS.js","./assets/jump-lKa3K-At.js","./assets/jumpshot-CE0sGWAc.js","./assets/kick-CC2O803y.js","./assets/layup-DAFT4Yuz.js","./assets/ready-BQ2bHO6l.js","./assets/run-Dck5V8Ph.js","./assets/shuffle-teI2so5o.js","./assets/slip-Crmjv0ka.js","./assets/sprint-D30qwyS_.js","./assets/stiff_arm-DXsMbVuQ.js","./assets/stumble-BHIgi8eG.js","./assets/throw-BnUJE21V.js","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png"];
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
