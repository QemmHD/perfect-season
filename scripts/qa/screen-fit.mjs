// Codex (OpenAI): real Home components with explicit viewport/safe-area simulations.
// Chromium is not a real iOS standalone device; these checks prove geometry and document limits.
// Claude (studio overhaul, shell-2, 2026-11-16): every phone of the shell plan with its own insets, in
// Safari and with the standalone height rule forced (CDP cannot emulate display-mode); nothing a player
// reads or taps starts inside the status-bar band on Home or Ultimate Team Home; the Settings diagnostics
// show the edge; and each sport's in-game score bug sits below inset + edge.
import assert from 'node:assert/strict';
import { base, launch, fixture, shot } from './browser.mjs';
import { auditScreen, DEVICE_IDS, DEVICES, edgeOf, forceStandaloneRule, settle } from './edge-lib.mjs';
import { openUt, waitForHome } from './fixtures.mjs';
const browser=await launch();
const fail=(what,a)=>`${what}: ${JSON.stringify({text:a.textInBand,controls:a.controlInBand,lines:a.lines})}`;
try {
 for(const standalone of [true,false]){
  const f=await fixture(browser,'soccer','Screen Fit QA',393,{isMobile:true,hasTouch:true});
  await waitForHome(f.page);
  await f.page.evaluate(standalone=>{
   window.__psInsets=[59,0,34,0];window.__fitVisual={width:innerWidth,height:innerHeight,offsetLeft:0,offsetTop:0,scale:1};
   Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>standalone});
   Object.defineProperty(window,'orientation',{configurable:true,get:()=>window.__fitAngle??0});
   for(const key of ['width','height','offsetLeft','offsetTop','scale'])Object.defineProperty(visualViewport,key,{configurable:true,get:()=>window.__fitVisual[key]});
   window.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('resize'));
  },standalone);
  const measure=async()=>f.page.evaluate(()=>{
   const rect=s=>{const el=document.querySelector(s);if(!el)throw Error('Missing '+s+': '+document.body.innerText.slice(0,400));const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,bottom:r.bottom,right:r.right};};
   const stage=document.querySelector('.stage'), matrix=new DOMMatrix(getComputedStyle(stage).transform);
   return {viewport:rect('.viewport'),stage:rect('.stage'),play:rect('.home .playbar'),tabs:rect('.tabs'),sports:getComputedStyle(document.querySelector('.home .sportswitch')).display,k:Math.hypot(matrix.a,matrix.b),rot:stage.dataset.rot,docScroll:document.scrollingElement.scrollHeight-innerHeight};
  });
  const resize=async(w,h,visualH=h,insets=[59,0,34,0])=>{
   await f.page.setViewportSize({width:w,height:h});await f.page.evaluate(({w,h,insets})=>{window.__fitVisual={width:w,height:h,offsetLeft:0,offsetTop:0,scale:1};window.__psInsets=insets;window.__fitAngle=0;window.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('resize'));},{w,h:visualH,insets});
   if(standalone)await forceStandaloneRule(f.page,insets[0]);
   await f.page.waitForTimeout(100);
  };
  const band={};
  for(const id of DEVICE_IDS){
   const {w,h,insets}=DEVICES[id],[t,,b]=insets;
   await resize(w,h,h,insets);const m=await measure();assert.ok(Math.abs(m.stage.w-w)<1);assert.ok(Math.abs(m.stage.h-h)<1);assert.ok(m.play.bottom<=h-b+1);assert.ok(m.tabs.bottom<=h+1);assert.ok(m.play.bottom<=m.tabs.y+1);assert.notEqual(m.sports,'none');assert.ok(m.docScroll<=1,'document scrolls '+m.docScroll+' at '+id);
   await settle(f.page,150);
   const a=await auditScreen(f.page,id);
   assert.ok(Number.isFinite(a.topMost.y),'nothing measured on Home at '+id);
   assert.equal(a.textInBand.length,0,fail('Home text in the band at '+id,a));assert.equal(a.controlInBand.length,0,fail('Home control in the band at '+id,a));
   assert.ok(a.topMost.y>=t+edgeOf(t)-0.25,'Home topmost '+a.topMost.y+' at '+id);
   band[id]={home:a.topMost.y};
   await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-${w}x${h}`);
  }
  // Settings → diagnostics name the inset and the edge (what the owner reads off a real phone)
  await resize(393,852);
  await f.page.getByRole('button',{name:'Settings',exact:true}).click();
  const diag=await f.page.getByText(/safe \d+\/\d+ · edge \d+/).first().textContent({timeout:10000});
  assert.match(diag,/safe 59\/34 · edge 22/);
  for(let i=0;i<3&&await f.page.locator('[role=dialog]').count();i++){await f.page.keyboard.press('Escape');await f.page.waitForTimeout(320);}
  await resize(393,852,743);const bars=await measure();assert.ok(bars.tabs.bottom<=744);assert.ok(bars.play.bottom<=bars.tabs.y+1);await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-browser-controls`);
  // A keyboard shrinks only height. Its aspect ratio must not rotate or zoom the whole app.
  await resize(393,852,310);const keyboard=await measure();assert.equal(keyboard.rot,'0');assert.ok(Math.abs(keyboard.k-393/390)<.001);assert.ok(keyboard.tabs.bottom<=311);
  await resize(393,852);const restored=await measure();assert.ok(Math.abs(restored.stage.h-852)<1);assert.ok(Math.abs(restored.k-393/390)<.001);
  // Rotate using the same portrait lock contract as the installed game.
  await f.page.setViewportSize({width:852,height:393});await f.page.evaluate(()=>{window.__fitVisual={width:852,height:393,offsetLeft:0,offsetTop:0,scale:1};window.__psInsets=[0,34,0,59];window.__fitAngle=90;window.dispatchEvent(new Event('orientationchange'));visualViewport.dispatchEvent(new Event('resize'));});await f.page.waitForTimeout(400);const rotated=await measure();assert.equal(rotated.rot,'-90');assert.ok(Math.abs(rotated.stage.w-852)<1);assert.ok(Math.abs(rotated.stage.h-393)<1);await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-rotated`);
  // sideways the status bar is hidden: no edge, and the published edge follows
  assert.equal(await f.page.evaluate(()=>document.documentElement.style.getPropertyValue('--ps-edge')),'0px');
  // Ultimate Team Home: its header clears the band on every phone too
  await resize(393,852);await f.page.waitForTimeout(400);
  await openUt(f.page);await settle(f.page,600);
  for(let i=0;i<3&&await f.page.locator('[role=dialog]').count();i++){await f.page.keyboard.press('Escape');await f.page.waitForTimeout(320);}
  for(const id of DEVICE_IDS){
   const {w,h,insets}=DEVICES[id],[t]=insets;
   await resize(w,h,h,insets);await settle(f.page,150);
   const a=await auditScreen(f.page,id);
   assert.ok(Number.isFinite(a.topMost.y),'nothing measured on UT Home at '+id);
   assert.equal(a.textInBand.length,0,fail('UT Home text in the band at '+id,a));assert.equal(a.controlInBand.length,0,fail('UT Home control in the band at '+id,a));
   assert.ok(a.topMost.y>=t+edgeOf(t)-0.25,'UT Home topmost '+a.topMost.y+' at '+id);assert.ok(a.docScroll<=1);
   band[id].utHome=a.topMost.y;
  }
  await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-ut-home`);
  assert.deepEqual(f.errors,[]);console.log(JSON.stringify({standalone,phones:DEVICE_IDS,topMost:band,diagnostics:diag.replace(/^.*?(safe)/,'$1'),controlsHeight:743,keyboardNoRotationOrZoom:true,rotation:true,errors:f.errors}));await f.context.close();
 }
 // In a match the score bug sits below the band: inset + edge + 8 on every phone, in every sport.
 for(const sport of ['nba','nfl','soccer']){
  const f=await fixture(browser,sport,'Screen Fit QA',393,{isMobile:true,hasTouch:true},{insets:[59,0,34,0],height:852,standalone:true,dsf:1});
  const u=new URL(base);u.search='?'+(sport==='soccer'?'soccer-lab':'arcade')+'&auto&sport='+sport+'&seed=fit&ns=inspect&relay=ws://localhost:7777';
  await f.page.goto(u.href,{waitUntil:'domcontentloaded'});
  await f.page.locator('.arcade-full .hg2-bug').first().waitFor({timeout:90000});
  const bug={};
  for(const id of DEVICE_IDS){
   const {w,h,insets}=DEVICES[id],[t]=insets;
   await f.page.setViewportSize({width:w,height:h});
   await f.page.evaluate(ins=>{window.__psInsets=ins;window.dispatchEvent(new Event('resize'));},insets);
   await settle(f.page,250);
   const top=await f.page.evaluate(()=>document.querySelector('.arcade-full .hg2-bug').getBoundingClientRect().top);
   assert.ok(top>=t+edgeOf(t)+8-0.5,`${sport} score bug at ${top} on ${id}, want ≥ ${t+edgeOf(t)+8}`);
   bug[id]=Math.round(top*10)/10;
  }
  await shot(f.page,`screen-fit-ingame-${sport}`);
  assert.deepEqual(f.errors,[]);console.log(JSON.stringify({sport,scoreBugTop:bug,errors:f.errors}));await f.context.close();
 }
}finally{await browser.close();}
