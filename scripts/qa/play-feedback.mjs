// Codex (OpenAI): real manual components with an accelerated clock in isolated profiles; no rewards.
import assert from 'node:assert/strict';
import {launch,fixture,shot} from './browser.mjs';
const browser=await launch();
try{for(const sport of (process.env.PS_QA_SPORT?[process.env.PS_QA_SPORT]:['nba','nfl','soccer'])){
 const f=await fixture(browser,sport,'Coach QA'),page=f.page;
 if(sport==='nba')await page.route('**/src/game/hoops2/render.ts*',async route=>{
  const response=await route.fetch();const body=await response.text();
  await route.fulfill({response,body:body+`\n;const qaDraw=HoopsRenderer.prototype.draw;HoopsRenderer.prototype.draw=function(ctx,p,...args){const h=p.handler===null?null:p.bodies[p.handler];window.__coachLive={act:h?.act,lastMoveAt:h?.lastMoveAt,ended:!!p.end};return qaDraw.call(this,ctx,p,...args);};\n`});
 });
 await page.evaluate(async sport=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default,dom=await import('/node_modules/.vite/deps/react-dom_client.js');
  const {loadProfile}=await import('/src/lib/profile.ts'),{getPool}=await import('/src/ut/pool.ts'),{teamsOf}=await import('/src/ut/teams.ts'),{kitsFor}=await import('/src/game/uniforms.ts');
  const pool=await getPool(),p=loadProfile(),sq={};for(const [slot,uid] of Object.entries(p.ut.squad)){const c=p.ut.owned.find(c=>c.uid===uid);if(c)sq[slot]={line:pool.byId.get(c.cardId),level:c.level};}
  const teams=teamsOf(sport,sq,sq,'coach-qa'),k=kitsFor(null,null,sport),host=document.createElement('div');document.body.append(host);const root=(dom.createRoot??dom.default.createRoot)(host);window.__coachRoot=root;
  const props={seed:'coach-qa:'+sport,rivalName:'RIVAL',rival:null,defIQ:1,timeScale:sport==='nba'?2:8,onProgress:()=>{},onDone:()=>{}};
  if(sport==='nba'){const {Hoops2}=await import('/src/game/hoops2/Hoops2.tsx');root.render(React.createElement(Hoops2,{...props,five:teams.five,rivalFive:teams.rivalFive,possessions:8,ourKit:k.mine,theirKit:k.theirs,court:k.court}));}
  else if(sport==='nfl'){const {Football2}=await import('/src/game/football2/Football2.tsx');root.render(React.createElement(Football2,{...props,offense:teams.offense,rivalDefense:teams.rivalDefense,drives:2,ourKit:k.mine,theirKit:k.theirs,field:k.field}));}
  else{const {Soccer2}=await import('/src/game/soccer2/Soccer2.tsx'),{cardSquad,soccerKitsFor}=await import('/src/game/soccer2/arcade.ts');root.render(React.createElement(Soccer2,{...props,kits:soccerKitsFor(null,null),us:cardSquad(teams.soccerCards.us,{name:'You',abbr:'YOU',c1:'#19e3c9',c2:'#0b2631'}),them:cardSquad(teams.soccerCards.them,{name:'Rival',abbr:'RIV',c1:'#9b7bff',c2:'#5b3fd1'})}));}
 },sport);
 await page.locator('.hg2-canvas').waitFor();
 if(sport==='nba'){await page.getByRole('button',{name:'Cross over',exact:true}).waitFor();await page.getByRole('button',{name:'Cross over',exact:true}).click();await page.waitForFunction(()=>window.__coachLive?.act==='cross');const moveAt=await page.evaluate(()=>window.__coachLive.lastMoveAt);assert.ok(Number.isFinite(moveAt));await page.getByRole('button',{name:'Spin move',exact:true}).click();await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.__coachLive.lastMoveAt),moveAt);await page.getByText('MOVE RECHARGING · KEEP YOUR DRIBBLE',{exact:true}).waitFor();await page.waitForTimeout(800);await page.getByRole('button',{name:'Step back',exact:true}).click();await page.waitForFunction(at=>window.__coachLive?.lastMoveAt>at,moveAt);}
 else if(sport==='nfl')await page.getByRole('button',{name:'SNAP',exact:true}).click();
 else await page.getByRole('button',{name:'KICK OFF',exact:true}).click();
 const toggle=page.getByRole('button',{name:/LAST PLAY/});await toggle.waitFor({timeout:30000});await toggle.click();await page.getByRole('region',{name:'Last play breakdown'}).waitFor();
 const text=await page.getByRole('region',{name:'Last play breakdown'}).innerText();assert.ok(text.length>60);
 for(const [width,height] of [[390,844],[320,568],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(200);if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();const box=await page.locator('.play-readout-card').boundingBox();if(box){assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.ok(box.y>=0&&box.y+box.height<=height+1,JSON.stringify({sport,width,height,box}));}if(box){for(const control of ['.hg2-stick','.hg2-pass','.hg2-shoot','.fb2-stick','.fb2-burst']){const el=page.locator(control).first();const b=await el.count()?await el.boundingBox():null;if(b)assert.ok(box.x+box.width<=b.x||b.x+b.width<=box.x||box.y+box.height<=b.y||b.y+b.height<=box.y,'Readout overlaps '+control);}}if(sport==='nba'){const skills=await page.locator('.hg2-skills').boundingBox();for(const control of ['.hg2-pass','.hg2-shoot','.hg2-stick']){const b=await page.locator(control).boundingBox();if(skills&&b)assert.ok(skills.x+skills.width<=b.x||b.x+b.width<=skills.x||skills.y+skills.height<=b.y||b.y+b.height<=skills.y,'Dribble buttons overlap '+control);}}await shot(page,'coach-'+sport+'-'+width);}
 await page.evaluate(()=>window.__coachRoot.unmount());const after=await f.current();assert.equal(after.coins,f.original.coins);for(const c of f.original.ut.owned)assert.ok(after.ut.owned.some(x=>x.uid===c.uid&&x.cardId===c.cardId&&x.level===c.level&&x.xp===c.xp));assert.deepEqual(f.errors,[]);
 console.log(JSON.stringify({sport,engineFeedback:true,manualControls:true,originalProgress:true,errors:f.errors}));await f.context.close();
}}finally{await browser.close();}
