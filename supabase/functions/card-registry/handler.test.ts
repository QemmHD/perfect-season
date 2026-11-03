// Codex (OpenAI): HTTP contract checks use a mocked database; no live player or registry writes.
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { verifyAdminPack } from './admin-packs';
import catalog from './catalog.json';
vi.mock('./admin-packs.ts', async (actual) => ({...(await actual<object>()),verifyAdminPack:vi.fn()}));
let handler:(req:Request)=>Promise<Response>;
const endpoint='https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/card-registry';
const requestId='abcd1234-abcd-4123-a123-abcd12345678';
const fetchDb=vi.fn();
beforeAll(async()=>{
 vi.stubGlobal('Deno',{serve:(fn:typeof handler)=>{handler=fn;},env:{get:(key:string)=>key==='SUPABASE_URL'?'http://registry.test':'test-only'}});
 vi.stubGlobal('fetch',fetchDb);
 await import('./index');
});
beforeEach(()=>{fetchDb.mockReset();vi.mocked(verifyAdminPack).mockReset().mockResolvedValue(null);});
afterAll(()=>vi.unstubAllGlobals());
function post(payload:object){const event=finalizeEvent({kind:27235,created_at:Math.floor(Date.now()/1000),tags:[['u',endpoint],['method','POST']],content:JSON.stringify(payload)},new Uint8Array(32).fill(4));return new Request(endpoint,{method:'POST',body:JSON.stringify({event})});}
const base={v:1,namespace:'inspect',sport:'nba',kind:'spotlight',requestId};
describe('Codex registry HTTP compatibility',()=>{
 it('rejects unsigned requests and forged GOAT awards before accessing the database',async()=>{
  expect((await handler(new Request(endpoint,{method:'POST',body:JSON.stringify({event:{}})}))).status).toBe(401);
  const r=await handler(post({...base,kind:'admin-goat',voucher:{}}));expect(r.status).toBe(403);expect(fetchDb).not.toHaveBeenCalled();
 });
 it('preserves public counts and active circulation',async()=>{
  fetchDb.mockResolvedValue(new Response(JSON.stringify([{card_id:'nba:goat:test',total:32,active_total:30,revision:34}])));
  const r=await handler(new Request(endpoint+'?sport=nba&ns=inspect'));expect(r.status).toBe(200);expect(await r.json()).toEqual({counts:{'nba:goat:test':32},activeCounts:{'nba:goat:test':30},versions:{'nba:goat:test':34}});
 });
 it('preserves the original Spotlight RPC and turns signed GOAT awards into atomic numbered receipts',async()=>{
  for(const admin of [false,true]){
   vi.mocked(verifyAdminPack).mockResolvedValue(requestId);
   const cardId=catalog.nba.goat[0];
   fetchDb.mockImplementation(async(_url,options)=>{const p=JSON.parse(options.body);return new Response(JSON.stringify({id:p.p_request,kind:p.p_kind,tier:p.p_tier,cardId:p.p_card,sport:p.p_sport,namespace:p.p_namespace,serial:12,totalAtPull:12,seed:p.p_seed}));});
   const r=await handler(post({...base,...(admin?{kind:'admin-goat',voucher:{event:{content:JSON.stringify({goatCardId:cardId})},index:0}}:{})}));
   expect(r.status).toBe(200);const body=await r.json();expect(body.kind).toBe(admin?'admin-goat':'spotlight');
   const sent=JSON.parse(fetchDb.mock.lastCall![1].body);expect(sent.p_kind).toBe('spotlight');expect(sent.p_request).toBe(requestId);if(admin){expect(body.tier).toBe('goat');expect(body.cardId).toBe(cardId);expect(body.serial).toBe(12);}
  }
 });
 it('rejects a mismatched entitlement ID or unknown chosen GOAT without a database write',async()=>{
  vi.mocked(verifyAdminPack).mockResolvedValue('00000000-0000-4000-a000-000000000000');
  expect((await handler(post({...base,kind:'admin-goat',voucher:{}}))).status).toBe(403);
  vi.mocked(verifyAdminPack).mockResolvedValue(requestId);
  expect((await handler(post({...base,kind:'admin-goat',voucher:{event:{content:JSON.stringify({goatCardId:'nba:goat:no-such-edition'})},index:0}}))).status).toBe(400);expect(fetchDb).not.toHaveBeenCalled();
 });
});
