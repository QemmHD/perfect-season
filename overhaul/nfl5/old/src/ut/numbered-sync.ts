// Implemented by Codex. Additive numbering/retirement retries; no owned-copy, coin or XP reset.
import { SAVE_CHANGED } from '../lib/save-events';
import { receivedCount } from './circulation';
import { registryNamespace, syncCopies, type CopyReply, type CopyRequest } from './registry';
import type { UtState } from './state';
import type { UtSport } from './types';
const FILES = import.meta.glob<{ default: Record<string, number> }>('../data/numbered-*.json');
export const numberedEligibility = (sport: UtSport) => FILES[`../data/numbered-${sport}.json`]().then((m) => m.default);
export function applyCopyReplies(ut: UtState, replies: CopyReply[]): UtState {
  const minted = new Map(replies.map((r) => [r.uid, r]));
  const retired = new Set(replies.filter((r) => r.retired).map((r) => r.uid));
  return {
    ...ut,
    owned: ut.owned.map((c) => {
      const r = minted.get(c.uid);
      return r && r.cardId === c.cardId && !c.mint ? { ...c, mint: r.mint } : c;
    }),
    retirements: (ut.retirements ?? []).filter((c) => !retired.has(c.uid)),
  };
}
export function startNumberedSync(sport: UtSport, read: () => UtState, write: (fn: (ut: UtState) => UtState) => void) {
  let live = true,
    busy = false,
    retry = false,
    eligibility: Record<string, number> | null = null;
  const flush = async () => {
    if (!live || document.visibilityState === 'hidden' || !navigator.onLine) return;
    if (busy) {
      retry = true;
      return;
    }
    busy = true;
    let failed = false;
    try {
      const ut = read();
      if (!ut.owned.length && !ut.retirements?.length) return;
      eligibility ??= await numberedEligibility(sport);
      if (!live) return;
      const eligible = (c: { cardId: string; level: number }) => c.level >= (eligibility![c.cardId] ?? 99);
      const ignored = (ut.retirements ?? []).filter((c) => !eligible(c) && !c.mint);
      if (ignored.length) {
        const ids = new Set(ignored.map((c) => c.uid));
        write((u) => ({ ...u, retirements: (u.retirements ?? []).filter((c) => !ids.has(c.uid)) }));
      }
      const pending = (ut.retirements ?? []).filter((c) => eligible(c) || c.mint);
      const registrations = ut.owned.filter((c) => !c.mint && eligible(c) && !/^\w+:(goat|spotlight):/.test(c.cardId));
      // Each receipt namespace stays isolated, including older saves opened in a preview.
      const first = pending[0];
      const ns = first?.mint?.namespace ?? registryNamespace();
      const tasks: CopyRequest[] = pending
        .filter((c) => (c.mint?.namespace ?? registryNamespace()) === ns)
        .map((c) => ({ uid: c.uid, cardId: c.cardId, level: c.level, reason: c.reason }));
      if (ns === registryNamespace()) tasks.push(...registrations.map((c) => ({ uid: c.uid, cardId: c.cardId, level: c.level })));
      if (!tasks.length) return;
      const replies = await syncCopies(sport, tasks.slice(0, 25), ns);
      if (!live) return;
      write((u) => applyCopyReplies(u, replies));
      for (const r of replies) receivedCount(sport, ns, r.cardId, r.active, r.revision);
      if (tasks.length > 25) retry = true;
    } catch {
      failed = true;
    } finally {
      busy = false;
      if (retry && live) {
        retry = false;
        setTimeout(() => void flush(), failed ? 15000 : 100);
      }
    }
  };
  const changed = () => void flush();
  const timer = setInterval(changed, 30000);
  window.addEventListener(SAVE_CHANGED, changed);
  window.addEventListener('online', changed);
  window.addEventListener('focus', changed);
  const visible = () => document.visibilityState === 'visible' && changed();
  document.addEventListener('visibilitychange', visible);
  changed();
  return () => {
    live = false;
    clearInterval(timer);
    window.removeEventListener(SAVE_CHANGED, changed);
    window.removeEventListener('online', changed);
    window.removeEventListener('focus', changed);
    document.removeEventListener('visibilitychange', visible);
  };
}
