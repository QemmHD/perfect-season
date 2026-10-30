// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import { NS_SUFFIX, sign } from '../net/nostr';
import type { UtSport } from './types';
export const REGISTRY_BASE = 'https://ryqaibujweiwwvdtswxj.supabase.co';
export const REGISTRY_URL = REGISTRY_BASE + '/functions/v1/card-registry';
// Public publishable key only. Service credentials exist solely in the function's environment.
export const REGISTRY_PUBLIC_KEY = 'sb_publishable_Zl7MIzwPXVO_2azYNqh0Bw_DYZvQRbo';
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
  activeAtPull?: number | null;
}
async function request(query: string, body?: unknown): Promise<any> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(REGISTRY_URL + query, {
      method: body ? 'POST' : 'GET',
      headers: { apikey: REGISTRY_PUBLIC_KEY, 'Content-Type': 'application/json' },
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
export async function countSnapshot(sport: UtSport, namespace=registryNamespace(), ids?:string[]):Promise<{counts:Record<string,number>;versions:Record<string,number>}> {
 const result=await request('?sport='+sport+'&ns='+encodeURIComponent(namespace)+(ids?.length?'&ids='+encodeURIComponent(JSON.stringify(ids)):''));
 const valid=(raw:Record<string,unknown>)=>Object.fromEntries(Object.entries(raw??{}).filter(([,v])=>Number.isSafeInteger(v)&&Number(v)>=0)) as Record<string,number>;
 return {counts:valid(result.activeCounts??result.counts),versions:valid(result.versions)};
}
export async function cardCounts(sport:UtSport,namespace=registryNamespace()):Promise<Record<string,number>> {return (await countSnapshot(sport,namespace)).counts;}
export interface CopyRequest { uid:string;cardId:string;level:number;reason?:'sold'|'sbc'; }
export interface CopyReply {uid:string;cardId:string;retired:boolean;mint:import('./types').CardMint;active:number;revision:number;}
export async function syncCopies(sport:UtSport,copies:CopyRequest[],namespace=registryNamespace()):Promise<CopyReply[]> {
 const content=JSON.stringify({v:1,op:'copies',sport,namespace,copies});
 const result=await request('',{event:sign(27235,[['u',REGISTRY_URL],['method','POST']],content)});
 if(!Array.isArray(result.copies)||result.copies.length!==copies.length)throw Error('Incomplete registry response');
 return result.copies.map((r:CopyReply,i:number)=>{
  const c=copies[i],m=r.mint;
  if(r.uid!==c.uid||r.cardId!==c.cardId||typeof r.retired!=='boolean'||!m||!Number.isSafeInteger(m.serial)||m.serial<1||!Number.isSafeInteger(m.totalAtPull)||m.totalAtPull<m.serial||m.namespace!==namespace||typeof m.requestId!=='string'||!Number.isSafeInteger(r.active)||r.active<0||!Number.isSafeInteger(r.revision)||r.revision<1||m.activeAtPull!==r.active)throw Error('Invalid registry copy response');
  return r;
 });
}
