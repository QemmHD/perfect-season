// Codex (OpenAI): deployed endpoint read/rejection smoke only. Never grants or mints a card.
import assert from 'node:assert/strict';
import {launch,base} from './browser.mjs';
const browser=await launch();
try{
 const context=await browser.newContext({ignoreHTTPSErrors:!!process.env.PS_QA_PROXY});const page=await context.newPage();
 await page.route('**/__admin_registry_probe',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Registry contract probe</title>'}));
 await page.goto(new URL('/__admin_registry_probe',base).href);
 const result=await page.evaluate(async()=>{
  const {REGISTRY_URL,REGISTRY_PUBLIC_KEY}=await import('/src/ut/registry.ts');const {sign}=await import('/src/net/nostr.ts');const catalog=await (await fetch('/supabase/functions/card-registry/catalog.json')).json();
  const headers={apikey:REGISTRY_PUBLIC_KEY,'Content-Type':'application/json'};
  const counts=[];
  for(const sport of ['nba','nfl']){const cardId=catalog[sport].goat[0];const r=await fetch(REGISTRY_URL+'?'+new URLSearchParams({sport,ids:JSON.stringify([cardId])}),{headers});const body=await r.json();counts.push({sport,status:r.status,valid:!!body.counts&&!!body.activeCounts&&!!body.versions});}
  const p={v:1,sport:'nba',namespace:'adminqa',kind:'admin-goat',requestId:crypto.randomUUID(),voucher:{}};
  const event=sign(27235,[['u',REGISTRY_URL],['method','POST']],JSON.stringify(p));
  const rejected=await fetch(REGISTRY_URL,{method:'POST',headers,body:JSON.stringify({event})});
  const badSignature=await fetch(REGISTRY_URL,{method:'POST',headers,body:JSON.stringify({event:{}})});
  return {counts,forgedGoat:rejected.status,forgedError:(await rejected.json()).error,badSignature:badSignature.status};
 });
 for(const c of result.counts){assert.equal(c.status,200);assert.equal(c.valid,true);}assert.equal(result.forgedGoat,403);assert.equal(result.badSignature,401);console.log(JSON.stringify(result));await context.close();
}finally{await browser.close();}
