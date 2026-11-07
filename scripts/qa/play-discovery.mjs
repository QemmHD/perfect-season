// Codex (OpenAI): isolated Play discovery/route/phone layout QA; no real owner or account loaded.
import assert from 'node:assert/strict';
import { launch, fixture, shot } from './browser.mjs';
const browser=await launch();
try {
 for(const sport of (process.argv[2]?[process.argv[2]]:['nba','nfl','soccer'])) {
  const f=await fixture(browser,sport,'Play Discovery QA');
  try {
   await f.page.getByRole('button',{name:/Ultimate Team:/}).click();
   await f.page.locator('.ut-tabs button').filter({hasText:'PLAY'}).click();
   await f.page.getByRole('button',{name:'ALL MODES',exact:true}).waitFor({timeout:60000});
   await shot(f.page,'play-'+sport+'-all');
   await f.page.getByRole('button',{name:'QUICK PLAY',exact:true}).click();
   assert.equal(await f.page.locator('.play-mode').count(),sport==='soccer'?1:2);
   await shot(f.page,'play-'+sport+'-quick');
   await f.page.getByRole('button',{name:'RUNS',exact:true}).click();
   assert.equal(await f.page.locator('.play-mode').filter({hasText:'UT DRAFT'}).count(),1);
   assert.equal(await f.page.locator('.play-mode').filter({hasText:'CLUB CUPS'}).count(),1);
   await shot(f.page,'play-'+sport+'-runs');
   await f.page.getByRole('button',{name:'ONLINE',exact:true}).click();
   assert.equal(await f.page.locator('.play-mode').count(),0);
   await f.page.getByRole('button',{name:'FIND MATCH',exact:true}).waitFor();
   for(const width of [390,320]) {
    await f.page.setViewportSize({width,height:width===320?568:844});
    assert.ok(await f.page.locator('.play-discovery').evaluate(el=>el.scrollWidth-el.clientWidth)<=1);
    await shot(f.page,'play-'+sport+'-online-'+width);
   }
   assert.deepEqual(f.errors,[]);
   console.log(JSON.stringify({sport,filters:true,clubCups:true,overflow:false,errors:f.errors}));
  } catch(e) {
   console.log(JSON.stringify({sport,errors:f.errors,body:(await f.page.locator('body').innerText()).slice(0,2000)}));throw e;
  } finally { await f.context.close(); }
 }
} finally { await browser.close(); }
