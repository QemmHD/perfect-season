// Codex (OpenAI): real Home components with explicit viewport/safe-area simulations.
// Chromium is not a real iOS standalone device; these checks prove geometry and document limits.
import assert from 'node:assert/strict';
import { launch, fixture, shot } from './browser.mjs';
const browser=await launch();
const cases=[[393,852],[390,844],[375,667],[430,932],[320,568]];
try {
 for(const standalone of [true,false]){
  const f=await fixture(browser,'soccer','Screen Fit QA',393,{isMobile:true,hasTouch:true});
  await f.page.locator('.home .playbar').waitFor({timeout:60000});
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
  const resize=async(w,h,visualH=h)=>{
   await f.page.setViewportSize({width:w,height:h});await f.page.evaluate(({w,h})=>{window.__fitVisual={width:w,height:h,offsetLeft:0,offsetTop:0,scale:1};window.__psInsets=[59,0,34,0];window.__fitAngle=0;window.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('resize'));},{w,h:visualH});await f.page.waitForTimeout(100);
  };
  for(const [w,h]of cases){
   await resize(w,h);const m=await measure();assert.ok(Math.abs(m.stage.w-w)<1);assert.ok(Math.abs(m.stage.h-h)<1);assert.ok(m.play.bottom<=h-34+1);assert.ok(m.tabs.bottom<=h+1);assert.ok(m.play.bottom<=m.tabs.y+1);assert.notEqual(m.sports,'none');assert.ok(m.docScroll<=1);await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-${w}x${h}`);
  }
  await resize(393,852,743);const bars=await measure();assert.ok(bars.tabs.bottom<=744);assert.ok(bars.play.bottom<=bars.tabs.y+1);await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-browser-controls`);
  // A keyboard shrinks only height. Its aspect ratio must not rotate or zoom the whole app.
  await resize(393,852,310);const keyboard=await measure();assert.equal(keyboard.rot,'0');assert.ok(Math.abs(keyboard.k-393/390)<.001);assert.ok(keyboard.tabs.bottom<=311);
  await resize(393,852);const restored=await measure();assert.ok(Math.abs(restored.stage.h-852)<1);assert.ok(Math.abs(restored.k-393/390)<.001);
  // Rotate using the same portrait lock contract as the installed game.
  await f.page.setViewportSize({width:852,height:393});await f.page.evaluate(()=>{window.__fitVisual={width:852,height:393,offsetLeft:0,offsetTop:0,scale:1};window.__psInsets=[0,34,0,59];window.__fitAngle=90;window.dispatchEvent(new Event('orientationchange'));visualViewport.dispatchEvent(new Event('resize'));});await f.page.waitForTimeout(400);const rotated=await measure();assert.equal(rotated.rot,'-90');assert.ok(Math.abs(rotated.stage.w-852)<1);assert.ok(Math.abs(rotated.stage.h-393)<1);await shot(f.page,`screen-fit-${standalone?'standalone':'safari'}-rotated`);
  assert.deepEqual(f.errors,[]);console.log(JSON.stringify({standalone,phoneSizes:cases,controlsHeight:743,keyboardNoRotationOrZoom:true,rotation:true,errors:f.errors}));await f.context.close();
 }
}finally{await browser.close();}
