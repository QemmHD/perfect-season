// Implemented by Codex. Shared aggregate cache: one fetch/channel per sport+namespace, never per tile.
import { useEffect, useState } from 'react';
import { countSnapshot, REGISTRY_BASE, REGISTRY_PUBLIC_KEY } from './registry';
import type { CardMint, UtSport } from './types';
type Snapshot = { counts: Record<string, number>; versions: Record<string, number>; fresh: boolean };
interface Entry {
  sport: UtSport;
  ns: string;
  state: Snapshot;
  listeners: Map<() => void, string>;
  busy: boolean;
  again: boolean;
  stop?: () => void;
}
const entries = new Map<string, Entry>();
const entryFor = (sport: UtSport, ns: string) => {
  const key = sport + ':' + ns;
  let e = entries.get(key);
  if (!e) {
    e = { sport, ns, state: { counts: {}, versions: {}, fresh: false }, listeners: new Map(), busy: false, again: false };
    entries.set(key, e);
  }
  return e;
};
export function mergeCounts(current: Snapshot, counts: Record<string, number>, versions: Record<string, number>): Snapshot {
  const next = { counts: { ...current.counts }, versions: { ...current.versions }, fresh: true };
  for (const [id, value] of Object.entries(counts))
    if (Number.isSafeInteger(value) && value >= 0 && (versions[id] ?? 0) >= (current.versions[id] ?? 0)) {
      next.counts[id] = value;
      next.versions[id] = versions[id] ?? 0;
    }
  return next;
}
function publish(e: Entry, counts: Record<string, number>, versions: Record<string, number>) {
  e.state = mergeCounts(e.state, counts, versions);
  e.listeners.forEach((_, fn) => fn());
}
export function receivedCount(sport: UtSport, ns: string, id: string, total: number, version: number) {
  publish(entryFor(sport, ns), { [id]: total }, { [id]: version });
}
async function refresh(e: Entry) {
  if (e.busy) {
    e.again = true;
    return;
  }
  if (!e.listeners.size || document.visibilityState === 'hidden') return;
  e.busy = true;
  try {
    const ids = [...new Set(e.listeners.values())];
    for (let i = 0; i < ids.length; i += 40) {
      const result = await countSnapshot(e.sport, e.ns, ids.slice(i, i + 40));
      publish(e, result.counts, result.versions);
    }
  } catch {
    e.state = { ...e.state, fresh: false };
    e.listeners.forEach((_, fn) => fn());
  } finally {
    e.busy = false;
    if (e.again) {
      e.again = false;
      void refresh(e);
    }
  }
}
let realtime: Promise<import('@supabase/supabase-js').SupabaseClient> | null = null;
function watch(e: Entry) {
  let cancelled = false;
  let close: () => void = () => {};
  const update = () => void refresh(e),
    visible = () => document.visibilityState === 'visible' && update();
  const timer = setInterval(update, 30000);
  window.addEventListener('focus', update);
  window.addEventListener('online', update);
  document.addEventListener('visibilitychange', visible);
  void (realtime ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(REGISTRY_BASE, REGISTRY_PUBLIC_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  ))
    .then((client) => {
      if (cancelled) return;
      const channel = client
        .channel('ps-circulation:' + e.sport + ':' + e.ns)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ps_card_totals', filter: 'sport=eq.' + e.sport },
          ({ new: row }) => {
            const r = row as Record<string, unknown>;
            if (
              r.namespace === e.ns &&
              typeof r.card_id === 'string' &&
              typeof r.active_total === 'number' &&
              typeof r.revision === 'number'
            )
              publish(e, { [r.card_id]: r.active_total }, { [r.card_id]: r.revision });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') update();
        });
      close = () => {
        void client.removeChannel(channel);
      };
    })
    .catch(() => {});
  update();
  return () => {
    cancelled = true;
    close();
    clearInterval(timer);
    window.removeEventListener('focus', update);
    window.removeEventListener('online', update);
    document.removeEventListener('visibilitychange', visible);
  };
}
export function useCirculation(mint: CardMint, cardId: string, sport: UtSport) {
  const e = entryFor(sport, mint.namespace),
    [, render] = useState(0);
  useEffect(() => {
    const fn = () => render((n) => n + 1);
    e.listeners.set(fn, cardId);
    if (!e.stop) e.stop = watch(e);
    else void refresh(e);
    return () => {
      e.listeners.delete(fn);
      if (!e.listeners.size) {
        e.stop?.();
        e.stop = undefined;
      }
    };
  }, [e, cardId]);
  return { total: e.state.counts[cardId] ?? mint.activeAtPull ?? mint.totalAtPull, fresh: e.state.fresh && cardId in e.state.counts };
}
