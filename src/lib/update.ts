// Keeps the installed web app current. The service worker serves the newest page on every
// launch; this covers an app that iOS resumes from the background instead of relaunching.

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const enabled =
  import.meta.env.PROD &&
  import.meta.env.MODE !== 'artifact' &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost');

let registration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker(): void {
  if (!enabled) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((r) => {
      registration = r;
    })
    .catch(() => {
      // no worker (private mode, blocked storage): the game still works online
    });
}

/** Asks the server which build is live. True when it is newer than the one running. */
export async function newerVersionLive(): Promise<boolean> {
  if (!enabled || !navigator.onLine) return false;
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const live = ((await res.json()) as { version?: string }).version;
    if (!live || live === APP_VERSION) return false;
    registration?.update().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

const UPDATED = 'perfect-season:updated';

/** Reloads into the new build and leaves a note so the app can say it updated. */
export function applyUpdate(): void {
  try {
    sessionStorage.setItem(UPDATED, '1');
  } catch {
    // ignore
  }
  location.reload();
}

/** True once, right after applyUpdate() reloaded the app. */
export function justUpdated(): boolean {
  try {
    const v = sessionStorage.getItem(UPDATED);
    sessionStorage.removeItem(UPDATED);
    return v === '1';
  } catch {
    return false;
  }
}
