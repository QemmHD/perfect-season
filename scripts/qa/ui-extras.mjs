// Codex: unchanged companion surfaces remain consistent and reachable after the shared-sheet polish.
import assert from 'node:assert/strict';
import {launch,fixture,shot} from './browser.mjs';
const browser=await launch();
try{
 for(const sport of (process.env.PS_UI_EXTRA_SPORT?[process.env.PS_UI_EXTRA_SPORT]:['nba','nfl'])){
  const {page,context,current,original,errors}=await fixture(browser,sport,'Codex UI');
  await page.getByRole('button',{name:/Ultimate Team:/}).click().catch(async e=>{console.log(JSON.stringify({sport,errors,body:(await page.locator('body').innerText()).slice(0,1800)}));await shot(page,'extra-failure-'+sport);throw e;});
  await page.locator('.ut-tabs button').filter({hasText:/^PLAY$/}).click();
  await page.getByRole('button',{name:/DIVISION RIVALS/}).click();
  await page.locator('.rivals-page').waitFor();await shot(page,'ui-'+sport+'-rivals');
  assert.equal(await page.locator('.ut-tabs [aria-current="page"]').innerText(),'PLAY');
  await page.getByRole('button',{name:'Back to Play',exact:true}).click();
  await page.getByRole('button',{name:'Back to the Ultimate Team home',exact:true}).click();
  await page.getByRole('button',{name:'Leave Ultimate Team',exact:true}).click();
  await page.getByRole('button',{name:/TRAINING CAMP/}).click();
  await page.getByRole('button',{name:'Leave Training Camp',exact:true}).waitFor();await shot(page,'ui-'+sport+'-training');
  await page.getByRole('button',{name:'Leave Training Camp',exact:true}).click();
  const after=await current();assert.equal(after.coins,original.coins);assert.deepEqual(after.ut.squad,original.ut.squad);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({sport,rivalsReachable:true,trainingReachable:true,walletAndSquadPreserved:true,errors}));await context.close();
 }
}finally{await browser.close();}
