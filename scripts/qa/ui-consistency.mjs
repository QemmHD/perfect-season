// Codex: current-flow screenshots and concrete layout/navigation/modal regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, fixture, shot, artifacts } from './browser.mjs';
const browser=await launch(),report=[];
try{
 for(const sport of ['nba','nfl']){
  const {page,context,current,original,errors}=await fixture(browser,sport,'Codex UI Review');
  await page.getByRole('button',{name:/Ultimate Team:/}).click();
  await page.getByRole('button',{name:'PLAY HQ',exact:true}).waitFor();
  const home=async()=>{const back=page.getByRole('button',{name:'Back to the Ultimate Team home',exact:true});if(await back.count())await back.click();else await page.locator('.ut-tabs button').filter({hasText:'HOME'}).click();};
  const check=async(name,tab,{capture=true,fullTitle=true,stableCurrency=true}={})=>{
   await page.locator('.ut-title').evaluate(el=>el.getBoundingClientRect().width);
   await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   // Currency and labels must be stable; never accept a CountUp/loading frame as evidence.
   if(stableCurrency)await page.waitForFunction(expected=>{const c=document.querySelector('.ut-top .coins');return c&&c.getAttribute('aria-label')===expected+' coins'&&c.textContent.trim()===String(expected);},original.coins);
   const result=await page.evaluate(()=>{
    const head=document.querySelector('.ut-top'),back=head.querySelector('button'),title=head.querySelector('.ut-title'),wallet=head.querySelector('.coins');
    const rect=e=>({x:e.offsetLeft,w:e.offsetWidth});
    const body=document.querySelector('.ut-body>.page');
    return {back:rect(back),title:{...rect(title),text:title.textContent,clipped:title.scrollWidth>title.clientWidth+1},wallet:rect(wallet),active:document.querySelector('.ut-tabs [aria-current="page"]')?.textContent.trim(),horizontalOverflow:body?body.scrollWidth-body.clientWidth:0,font:getComputedStyle(title).fontFamily};
   });
   assert.equal(result.active,tab,name+' tab family');assert.ok(result.title.x>=result.back.x+result.back.w-1,name+' back/title collision');assert.ok(result.title.x+result.title.w<=result.wallet.x+1,name+' title/wallet collision');
   if(fullTitle)assert.equal(result.title.clipped,false,name+' clipped title');
   assert.ok(result.horizontalOverflow<=1,name+' page overflow');assert.ok(result.font.includes('Archivo'));
   if(capture){await page.locator('.toast').waitFor({state:'detached',timeout:6000}).catch(()=>{});await shot(page,'ui-'+sport+'-'+name);}
   report.push({sport,step:name,...result});
  };
  await check('01-home','HOME');
  for(const [name,button] of [['02-play','PLAY HQ'],['03-season',/SEASON PASS/],['04-objectives',/OBJECTIVES/],['05-development',/DEVELOPMENT/],['06-moments',/MOMENTS/],['07-records',/Club Records/],['08-events',/Take on the greats/],['09-gallery',/Collection Gallery/]]){
   await home();await page.getByRole('button',{name:button,exact:typeof button==='string'}).click();await check(name,name==='09-gallery'?'CLUB':'HOME');
  }
  await page.getByRole('button',{name:/COLLECTION REWARDS/}).click();const rewards=page.getByRole('dialog',{name:'Collection rewards',exact:true});await rewards.waitFor();
  for(let n=0;n<16;n++){await page.keyboard.press('Tab');assert.ok(await rewards.evaluate(el=>el.contains(document.activeElement)));}
  await page.keyboard.press('Escape');await rewards.waitFor({state:'detached'});assert.ok(await page.getByRole('button',{name:/COLLECTION REWARDS/}).evaluate(el=>el===document.activeElement));
  // Both long-title pages and the header under a large-wallet stress stay separated at each size.
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
   await page.setViewportSize({width,height});await home();await page.getByRole('button',{name:'PLAY HQ',exact:true}).click();await page.getByRole('button',{name:/CHAMPIONS CIRCUIT/}).click();
   await check('10-circuit-'+width,'HOME');
   const coin=page.locator('.ut-top .coins span').last(),text=await coin.textContent();await coin.evaluate(el=>el.textContent='123456789');
   await check('wallet-stress-'+width,'HOME',{capture:false,fullTitle:false,stableCurrency:false});await coin.evaluate((el,text)=>el.textContent=text,text);
  }
  await page.setViewportSize({width:390,height:844});await page.locator('.ut-tabs button').filter({hasText:'SQUAD'}).click();await page.getByRole('button',{name:'LINEUPS',exact:true}).click();
  const lineups=page.getByRole('dialog',{name:'Saved lineups',exact:true});await lineups.waitFor();
  const input=lineups.locator('input').first();assert.ok(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
  await input.fill('Away Squad');await lineups.getByRole('button',{name:'SAVE CURRENT',exact:true}).first().click();await page.locator('.toast').waitFor({state:'detached',timeout:6000});
  for(let n=0;n<20;n++){await page.keyboard.press('Tab');assert.ok(await lineups.evaluate(el=>el.contains(document.activeElement)));}
  await page.locator('.ut-tabs button').first().evaluate(el=>el.focus());assert.ok(await lineups.evaluate(el=>el.contains(document.activeElement)));
  await shot(page,'ui-'+sport+'-11-lineups');await lineups.getByRole('button',{name:'CLOSE',exact:true}).click();await lineups.waitFor({state:'detached'});
  assert.ok(await page.getByRole('button',{name:'LINEUPS',exact:true}).evaluate(el=>el===document.activeElement));
  await page.locator('.ut-tabs button').filter({hasText:'CLUB'}).click();await page.locator('.ut-gridcard').first().click();
  const detail=page.getByRole('dialog').last();await detail.locator('.ut-key').first().waitFor();
  const keys=await detail.locator('.ut-key').evaluateAll(els=>els.map(el=>{const a=el.querySelector('b'),b=el.querySelector('span:not(.ut-abar)'),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return {value:Number(a.textContent),numberRight:ar.right,labelLeft:br.left}}));
  assert.ok(keys.some(k=>k.value>=100));assert.ok(keys.every(k=>k.numberRight<=k.labelLeft+.5));await shot(page,'ui-'+sport+'-12-card-detail');
  await detail.getByRole('button',{name:/QUICK SELL/}).click();const confirm=page.getByRole('dialog',{name:'Quick sell?',exact:true});await confirm.waitFor();
  for(let n=0;n<8;n++){await page.keyboard.press('Tab');assert.ok(await confirm.evaluate(el=>el.contains(document.activeElement)));}
  await page.keyboard.press('Escape');await confirm.waitFor({state:'detached'});assert.ok(await detail.evaluate(el=>el.contains(document.activeElement)));
  await detail.getByRole('button',{name:'CLOSE',exact:true}).click();await detail.waitFor({state:'detached'});
  const after=await current();assert.equal(after.coins,original.coins);assert.deepEqual(after.ut.squad,original.ut.squad);
  for(const card of original.ut.owned)assert.ok(after.ut.owned.some(c=>Object.entries(card).every(([k,v])=>JSON.stringify(c[k])===JSON.stringify(v))));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({sport,steps:report.filter(r=>r.sport===sport).length,headerCollisions:0,cardStatCollisions:0,modalKeyboardAndReturn:true,originalCopies:original.ut.owned.length,walletAndSquadPreserved:true,errors}));
  await context.close();
 }
 fs.writeFileSync(path.join(artifacts,'ui-layout-report.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
