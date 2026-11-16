import {describe,expect,it} from 'vitest';
import {EDGE_MAX,fitFor,portraitRotation,stageBox,topEdge,visibleViewport,type Fit} from './stage-layout';
describe('visible phone viewport and stable app scale',()=>{
 for(const [w,h] of [[393,852],[390,844],[375,667],[430,932],[320,568]]){
  it('fills '+w+'×'+h+' without cropping or side gutters, including safe areas',()=>{
   for(const safe of [[59,0,34,0],[0,0,0,0]] as [number,number,number,number][]){
    const v=visibleViewport({width:w,height:h,visual:{width:w,height:h,offsetLeft:0,offsetTop:0,scale:1}}),b=stageBox(v,safe);
    expect(b.k*390).toBeCloseTo(w,8);expect(b.h*b.k).toBeCloseTo(h,8);expect(b.sat*b.k).toBe(safe[0]);expect(b.sab*b.k).toBeCloseTo(safe[2],8);expect(b.transform).toContain('translate(0px,0px)');
   }
  });
 }
 it('uses the visible height rather than a stale larger layout viewport under browser controls',()=>{
  const v=visibleViewport({width:393,height:852,visual:{width:393,height:743,offsetLeft:0,offsetTop:0,scale:1}});
  expect(v.h).toBe(743);expect(stageBox(v,[59,0,34,0]).h*stageBox(v,[59,0,34,0]).k).toBeCloseTo(743,8);
 });
 it('accepts an accurate visual viewport when a standalone root reports one status bar short',()=>{
  expect(visibleViewport({width:393,height:793,visual:{width:393,height:852,offsetLeft:0,offsetTop:0,scale:1}}).h).toBe(852);
 });
 it('does not force a screen-height fallback over an actually smaller visible viewport',()=>{
  expect(visibleViewport({width:393,height:793,visual:{width:393,height:793,offsetLeft:0,offsetTop:0,scale:1}}).h).toBe(793);
 });
 it('typing does not rotate or shrink the whole upright app',()=>{
  const full=stageBox({w:393,h:852,x:0,y:0},[59,0,34,0]);
  const v=visibleViewport({width:393,height:852,visual:{width:393,height:310,offsetLeft:0,offsetTop:120,scale:1}});
  const rot=portraitRotation(v.w,v.h,true,0),keyboard=stageBox(v,[59,0,34,0],rot);
  expect(rot).toBe(0);expect(keyboard.k).toBe(full.k);expect(keyboard.k*390).toBe(393);expect(v.y).toBe(120);expect(keyboard.h*keyboard.k).toBeCloseTo(310,8);
 });
 it('leaves browser pinch zoom to the browser instead of applying a second app zoom',()=>{
  expect(visibleViewport({width:393,height:852,visual:{width:196.5,height:426,offsetLeft:20,offsetTop:40,scale:2}})).toEqual({w:393,h:852,x:0,y:0});
 });
 it('supports actual landscape orientation and maps island/indicator insets onto the portrait frame',()=>{
  for(const angle of [90,270]){
   const rot=portraitRotation(852,393,true,angle),safe:[number,number,number,number]=angle===90?[0,34,0,59]:[0,59,0,34];
   const b=stageBox({w:852,h:393,x:0,y:0},safe,rot);expect(b.k*390).toBe(393);expect(b.h*b.k).toBeCloseTo(852,8);expect(b.sat*b.k).toBe(59);expect(b.sab*b.k).toBeCloseTo(34,8);
  }
 });
 it('centers short desktop/tablet frames entirely inside the visible viewport',()=>{
  const b=stageBox({w:900,h:400,x:0,y:0},[0,0,0,0]);expect(b.framed).toBe(true);expect(b.h*b.k).toBeLessThanOrEqual(400);expect(b.k*390).toBeLessThanOrEqual(900);
 });
 it('has bounded fallback values when the browser reports unavailable initial dimensions',()=>{
  expect(visibleViewport({width:0,height:NaN,visual:null})).toEqual({w:390,h:844,x:0,y:0});
 });
});

// Claude (studio overhaul, shell-2, 2026-11-16): the clearance below the status bar that iOS 26 blurs (Fix A).
describe('top edge below the status bar',()=>{
 // the nine phones of the shell plan: [w, h, top inset, bottom inset]
 const PHONES:Record<string,[number,number,number,number]>={
  '393':[393,852,59,34],'402':[402,874,62,34],'420':[420,912,68,34],'440':[440,956,62,34],'430':[430,932,59,34],
  '390':[390,844,47,34],'375x812':[375,812,50,34],'375':[375,667,20,0],'320':[320,568,20,0],
 };
 // what acdf3e2 computed for each phone (content then meant h - sat - sab): its room and its size class
 const BEFORE:Record<string,[number,Fit]>={
  '393':[753.2,'normal'],'402':[754.8,'normal'],'420':[752.1,'normal'],'440':[762.3,'normal'],'430':[761,'normal'],
  '390':[763,'normal'],'375x812':[757.1,'normal'],'375':[672.9,'tight'],'320':[667.9,'tight'],
 };
 const EDGE:Record<string,number>={'393':22,'402':22,'420':22,'440':22,'430':22,'390':19,'375x812':20,'375':8,'320':8};
 it('is 22 pt under a Dynamic Island, 19 to 20 under a notch, 8 under a plain status bar, never negative',()=>{
  const table:[number,number][]=[[0,0],[20,8],[24,10],[44,18],[47,19],[50,20],[54,22],[55,22],[59,22],[62,22],[68,22],[100,22],[-5,0],[NaN,0],[Infinity,0]];
  for(const [t,e] of table)expect(topEdge(t)).toBe(e);
  expect(EDGE_MAX).toBe(22);
 });
 for(const [id,[w,h,t,b]] of Object.entries(PHONES)){
  it('clears the band on '+id+' and keeps its size class',()=>{
   const box=stageBox({w,h,x:0,y:0},[t,0,b,0]);
   expect(box.sat*box.k).toBeCloseTo(t,8); // sat stays the raw inset
   expect(box.edge*box.k).toBeCloseTo(EDGE[id],8);
   expect(topEdge(t)).toBe(EDGE[id]);
   expect(box.room*box.k).toBeCloseTo(h-t-b,8);
   expect(box.content*box.k).toBeCloseTo(h-t-EDGE[id]-b,8);
   expect(box.room-box.content).toBeCloseTo(box.edge,8);
   expect(box.room).toBeCloseTo(BEFORE[id][0],1);
   expect(box.fit).toBe(BEFORE[id][1]);
   expect(box.fit).toBe(fitFor(box.room));
  });
 }
 it('never lets the edge flip a class, even on the phones closest to a threshold',()=>{
  // 393×852 has 753.2 frame px between its insets and 731.4 after the edge: 1.4 above Home's 730 line
  const box=stageBox({w:393,h:852,x:0,y:0},[59,0,34,0]);
  expect(box.content).toBeLessThan(733);expect(box.content).toBeGreaterThan(730);
  expect(fitFor(box.content-22)).toBe('tight');expect(box.fit).toBe('normal');
 });
 it('is 0 when the phone is turned sideways (the status bar is hidden) and on framed desktop or tablet layouts',()=>{
  for(const angle of [90,270]){
   const rot=portraitRotation(852,393,true,angle),safe:[number,number,number,number]=angle===90?[0,34,0,59]:[0,59,0,34];
   const b=stageBox({w:852,h:393,x:0,y:0},safe,rot);
   expect(rot).not.toBe(0);expect(b.edge).toBe(0);expect(b.sat*b.k).toBe(59);expect(b.content).toBeCloseTo(b.room,8);
  }
  const framed=stageBox({w:1024,h:768,x:0,y:0},[24,0,20,0]);
  expect(framed.framed).toBe(true);expect(framed.edge).toBe(0);expect(framed.sat).toBe(0);expect(framed.content).toBe(framed.room);
 });
 it('reports no edge without a top inset and never more room after the edge than before',()=>{
  const flat=stageBox({w:390,h:844,x:0,y:0},[0,0,0,0]);
  expect(flat.edge).toBe(0);expect(flat.content).toBe(flat.room);expect(flat.room).toBe(844);
  const keyboard=stageBox({w:393,h:30,x:0,y:0},[59,0,34,0]);
  expect(keyboard.room).toBe(0);expect(keyboard.content).toBe(0);
 });
});
