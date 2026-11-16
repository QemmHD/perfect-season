// Claude (studio overhaul, shell-4, 2026-11-16): the facts behind Settings → Advanced → Erase all
// progress (audit M8). Pure and read-only: the other sports' saves are read with a raw getItem +
// JSON.parse (never loadProfile, which migrates and may write), and nothing here writes storage.
import { levelInfo } from '../engine/economy';
import { SPORTS, type SportId } from '../engine/sport';
import type { CloudStatus } from '../lib/cloud-sync';
import { PROFILE_KEYS, type Profile } from '../lib/profile';

/** The confirmation word, typed in full (any case, spaces around it ignored). */
export const ERASE_WORD = 'ERASE';
export const canErase = (text: string): boolean => text.trim().toUpperCase() === ERASE_WORD;

export interface SportLoss {
  sport: SportId;
  /** Ultimate Team copies owned (`ut.owned`) */
  cards: number;
  /** finished draft runs (`history`) */
  runs: number;
}
export interface EraseSummary {
  coins: number;
  level: number;
  xp: number;
  boosters: number;
  /** this sport first, then every other sport that has a save on this phone */
  sports: SportLoss[];
}

const count = (x: unknown) => (Array.isArray(x) ? x.length : 0);

/** What an erase takes away, in real numbers. `read` is the raw storage getter (localStorage's by default). */
export function eraseSummary(profile: Profile, current: SportId, read: (key: string) => string | null = (k) => localStorage.getItem(k)): EraseSummary {
  const sports: SportLoss[] = [{ sport: current, cards: count(profile.ut?.owned), runs: count(profile.history) }];
  for (const sport of SPORTS) {
    if (sport === current) continue;
    let raw: string | null = null;
    try {
      raw = read(PROFILE_KEYS[sport]);
    } catch {
      continue;
    }
    if (!raw) continue;
    try {
      const p = JSON.parse(raw) as { ut?: { owned?: unknown }; history?: unknown } | null;
      sports.push({ sport, cards: count(p?.ut?.owned), runs: count(p?.history) });
    } catch {
      // an unreadable save: there is nothing an erase could take from it
      sports.push({ sport, cards: 0, runs: 0 });
    }
  }
  const inv = profile.inventory ?? {};
  return {
    coins: profile.coins,
    level: levelInfo(profile.xp).level,
    xp: profile.xp,
    boosters: Object.values(inv).reduce((a: number, n) => a + (Number.isFinite(n) ? Number(n) : 0), 0),
    sports,
  };
}

export interface CloudLine {
  /** this phone has (or is about to have) a copy on the server, which the erase will replace */
  on: boolean;
  /** the live state, one sentence */
  text: string;
  /** the acknowledgement the player ticks, worded for that state */
  tick: string;
}

/** "just now", "4 min ago", "3 h ago", "2 days ago" */
export function ago(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  const d = Math.floor(s / 86400);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

const REPLACED = 'I understand my cloud save will be replaced too.';
const NO_COPY = 'I understand this phone isn’t cloud-saving, so there is no other copy.';

/** The cloud save's state, as the danger zone says it. */
export function cloudLine(status: CloudStatus, now: number): CloudLine {
  const when = ago(status.updatedAt, now);
  switch (status.phase) {
    case 'saved':
      return { on: true, text: 'Cloud save is on' + (when ? ', last saved ' + when : '') + '. Erasing replaces it with the empty profile.', tick: REPLACED };
    case 'starting':
    case 'pending':
    case 'saving':
    case 'restoring':
      return { on: true, text: 'Cloud save is on and syncing now. Erasing replaces your server copy too.', tick: REPLACED };
    case 'offline':
      return { on: true, text: 'Cloud save is on, but the server can’t be reached. Your server copy is replaced the next time this phone connects.', tick: REPLACED };
    case 'conflict':
      return { on: true, text: 'Cloud save is waiting for you to choose between two copies. Settle that in Cloud Save first if you want to keep one.', tick: REPLACED };
    case 'blocked':
    default:
      return { on: false, text: 'This phone isn’t cloud-saving. There is no other copy of your progress.', tick: NO_COPY };
  }
}
