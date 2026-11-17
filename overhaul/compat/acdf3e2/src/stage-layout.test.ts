import {describe,expect,it} from 'vitest';
import {portraitRotation,stageBox,visibleViewport} from './stage-layout';
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
