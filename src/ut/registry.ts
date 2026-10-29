// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import { NS_SUFFIX, sign } from '../net/nostr';
import type { UtSport } from './types';
export const REGISTRY_URL = 'https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/card-registry';
// Public publishable key only. Service credentials exist solely in the function's environment.
const PUBLISHABLE = 'sb_publishable_Zl7MIzwPXVO_2azYNqh0Bw_DYZvQRbo';
export const registryNamespace = () => NS_SUFFIX.replace(/^-/, '');
export interface RegistryReceipt {
  id: string;
  kind: string;
  sport: UtSport;
  namespace: string;
  tier: string;
  cardId: string | null;
  seed: string;
  serial: number | null;
  totalAtPull: number | null;
}
async function request(query: string, body?: unknown): Promise<any> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(REGISTRY_URL + query, {
      method: body ? 'POST' : 'GET',
      headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Card registry unavailable. Retry your pack.');
    return data;
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError') throw e;
    throw new Error('Card registry took too long. Retry to recover the same pack.');
  } finally {
    clearTimeout(timer);
  }
}
export async function openRegisteredPack(sport: UtSport, id: string, kind: string): Promise<RegistryReceipt> {
  const content = JSON.stringify({ v: 1, sport, requestId: id, kind, namespace: registryNamespace() });
  return request('', {
    event: sign(
      27235,
      [
        ['u', REGISTRY_URL],
        ['method', 'POST'],
      ],
      content
    ),
  });
}
export async function cardCounts(sport: UtSport, namespace = registryNamespace()): Promise<Record<string, number>> {
  const result = await request('?sport=' + sport + '&ns=' + encodeURIComponent(namespace));
  return Object.fromEntries(Object.entries(result.counts ?? {}).filter(([, v]) => Number.isSafeInteger(v) && Number(v) > 0)) as Record<string, number>;
}
