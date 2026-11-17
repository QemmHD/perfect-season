// The last few things that went wrong on this phone, kept on it (never sent anywhere), so Settings
// can show them when something breaks that can't be reproduced from here.
import { APP_VERSION } from './update';

const KEY = 'ps-errors';
const KEEP = 8;

export interface LoggedError {
  /** when it last happened (ms) */
  at: number;
  where: string;
  msg: string;
  /** how many times in a row */
  n: number;
  v: string;
}

let lastWrite = 0;

/** "message @ file:line:col, file:line:col": the top of the stack, short. */
function describe(e: unknown): string {
  const err = e as { message?: unknown; stack?: unknown } | null;
  const msg = typeof err?.message === 'string' ? err.message : String(e);
  const stack = typeof err?.stack === 'string' ? err.stack : '';
  const frames = stack
    .split('\n')
    .map((l) => l.match(/([\w.-]+\.js):(\d+):(\d+)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .slice(0, 3)
    .map((m) => m[1].replace(/-[\w-]{8}\.js$/, '.js') + ':' + m[2] + ':' + m[3]);
  return (msg + (frames.length ? ' @ ' + frames.join(', ') : '')).slice(0, 400);
}

export function loggedErrors(): LoggedError[] {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

export function logError(where: string, e: unknown): void {
  try {
    const msg = describe(e);
    const list = loggedErrors();
    const now = Date.now();
    const top = list[0];
    if (top && top.where === where && top.msg === msg) {
      // the same thing again (a frame that fails every frame): count it, and write at most once a second
      top.n += 1;
      top.at = now;
      if (now - lastWrite < 1000) return;
    } else list.unshift({ at: now, where, msg, n: 1, v: APP_VERSION });
    lastWrite = now;
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, KEEP)));
  } catch {
    // no storage: nothing to keep it in
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** Keeps what the page itself throws and doesn't catch. */
export function watchErrors(): void {
  window.addEventListener('error', (e) => logError('page', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError('promise', e.reason));
}
