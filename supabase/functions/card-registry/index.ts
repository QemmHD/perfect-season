import { verifyEvent } from 'nostr-tools/pure';
import catalog from './catalog.json' with { type: 'json' };
import { chaseTier, EVENT_IDS } from './contract.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey,content-type,authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const endpoint = 'https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/card-registry';
/** Rejection sampling gives uniform integer buckets, including the exact 500 / 1,000,000 GOAT rate. */
function randomInt(n: number): number {
  const limit = Math.floor(4294967296 / n) * n;
  let v: number;
  do {
    v = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (v >= limit);
  return v % n;
}
async function database(path: string, body?: unknown) {
  const r = await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    const problem = await r.json().catch(() => ({}));
    throw new Error(problem.message?.includes('limit reached') ? problem.message : 'The card registry is unavailable. Your pack can be retried.');
  }
  return r.json();
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET') {
      const sport = url.searchParams.get('sport'),
        ns = url.searchParams.get('ns') ?? '';
      if (!['nba', 'nfl'].includes(sport ?? '') || !/^[a-z0-9]{0,16}$/.test(ns)) return answer({ error: 'Invalid count query' }, 400);
      const rows = await database('ps_card_totals?select=card_id,total&sport=eq.' + sport + '&namespace=eq.' + ns);
      return answer({ counts: Object.fromEntries(rows.map((r: { card_id: string; total: number }) => [r.card_id, Number(r.total)])) });
    }
    if (req.method !== 'POST') return answer({ error: 'Method not allowed' }, 405);
    const text = await req.text();
    if (text.length > 12000) return answer({ error: 'Request too large' }, 413);
    const { event } = JSON.parse(text);
    if (
      !event ||
      event.kind !== 27235 ||
      Math.abs(Math.floor(Date.now() / 1000) - event.created_at) > 300 ||
      !verifyEvent(event) ||
      !event.tags.some((t: string[]) => t[0] === 'u' && t[1] === endpoint) ||
      !event.tags.some((t: string[]) => t[0] === 'method' && t[1] === 'POST')
    )
      return answer({ error: 'Invalid player signature' }, 401);
    const p = JSON.parse(event.content);
    if (
      p.v !== 1 ||
      typeof p.kind !== 'string' ||
      typeof p.namespace !== 'string' ||
      typeof p.requestId !== 'string' ||
      !['nba', 'nfl'].includes(p.sport) ||
      !/^[a-z0-9]{0,16}$/.test(p.namespace) ||
      !/^[a-f0-9-]{36}$/.test(p.requestId)
    )
      return answer({ error: 'Invalid pack request' }, 400);
    const reward = p.kind.startsWith('event-spotlight:');
    if (p.kind !== 'spotlight' && (!reward || !EVENT_IDS.includes(p.kind.slice(16)))) return answer({ error: 'Unknown pack' }, 400);
    const tier = reward ? 'spotlight' : chaseTier(randomInt(1_000_000));
    const lists = catalog[p.sport as 'nba' | 'nfl'];
    const list = tier === 'gold' ? [] : lists[tier];
    const cardId = list.length ? list[randomInt(list.length)] : null;
    const receipt = await database('rpc/ps_registry_open', {
      p_actor: event.pubkey,
      p_namespace: p.namespace,
      p_sport: p.sport,
      p_request: p.requestId,
      p_kind: p.kind,
      p_card: cardId,
      p_tier: tier,
      p_seed: crypto.randomUUID(),
    });
    return answer(receipt);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return answer({ error: message }, message.includes('limit reached') ? 429 : 503);
  }
});
