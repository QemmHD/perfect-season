// Codex: isolated admin navigation, drafts, self rewards and purchases. No live owner publication.
import assert from 'node:assert/strict';
import { launch, fixture, shot, dismissPack } from './browser.mjs';
const browser = await launch();
try {
 for (const sport of ['nba', 'nfl', 'soccer']) {
  const { page, context, current, original, errors } = await fixture(browser, sport, 'Admin Studio QA');
  await page.evaluate(() => sessionStorage.setItem('ps-admin', '03'.repeat(32)));
  const click = name => page.getByRole('button', { name, exact:true }).click();
  await click('Settings'); await click('ADMIN');
  await page.getByRole('heading',{name:'CONTROL ROOM',exact:true}).waitFor();
  await shot(page,'admin-'+sport+'-overview');
  await click('STORE PACKS'); await shot(page,'admin-'+sport+'-pack-library');
  await page.getByRole('button',{name:/Captains Pack/}).click();
  await page.getByText('Pack details',{exact:false}).click();
  await page.getByLabel('Pack name',{exact:true}).fill('Preview Captains');
  await page.getByLabel('Coin price',{exact:true}).fill('4300');
  await shot(page,'admin-'+sport+'-pack-editor');
  await click('SEND GIFTS');
  assert.equal(await page.getByRole('button',{name:'MYSELF',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('button',{name:'REVIEW GIFT',exact:true}).isVisible(),false);
  for(const mode of ['MYSELF','CHOOSE PLAYERS','RANDOM ONLINE','EVERYONE'])assert.equal(await page.getByRole('button',{name:mode,exact:true}).count(),1);
  await click('CHOOSE PLAYERS');assert.equal(await page.getByRole('button',{name:'CHOOSE REWARDS',exact:true}).isEnabled(),false);
  await page.getByText('Send to an offline player',{exact:false}).click();
  await page.getByPlaceholder('64-character public key').fill('ab'.repeat(32));
  assert.equal(await page.getByRole('button',{name:'CHOOSE REWARDS',exact:true}).isEnabled(),true);
  await click('MYSELF'); await shot(page,'admin-'+sport+'-recipients'); await click('CHOOSE REWARDS');
  await page.getByText('Club Collection packs',{exact:false}).click();
  await click('One more Captains pack');
  // Navigation never loses a gift or pack-editor draft.
  await click('STORE PACKS');assert.equal(await page.getByLabel('Pack name',{exact:true}).inputValue(),'Preview Captains');
  await click('REVIEW STORE UPDATE');await click('PUBLISH STORE UPDATE');await page.getByText('Unlock the owner account first.',{exact:true}).waitFor();
  await click('SEND GIFTS');await shot(page,'admin-'+sport+'-reward-toolbox');
  await click('REVIEW GIFT');assert.equal((await current()).ut.packs.length,original.ut.packs.length);
  await page.locator('.adm-gift-review').getByText('1 × Captains pack',{exact:true}).waitFor();
  await shot(page,'admin-'+sport+'-review');await click('GIVE TO ME');
  assert.equal((await current()).ut.packs.length,original.ut.packs.length+1);
  assert.ok((await current()).ut.packs.at(-1).kind.startsWith('studio:captains:'));
  assert.equal(await page.getByRole('button',{name:'GIVE TO ME',exact:true}).isVisible(),false);
  await click('EDIT / SEND ANOTHER');await click('CLEAR REWARDS');
  await click('Coins, XP & boosters');
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.locator('.admin-gift .admin-recipe').evaluate(el=>getComputedStyle(el).display),'grid');
   assert.ok(await page.locator('.admin').evaluate(el=>el.scrollWidth-el.clientWidth)<=1);
   await shot(page,'admin-'+sport+'-xp-'+width);
  }
  await click('Reward bundles');await click('Welcome Bundle');
  await click('REVIEW GIFT');const beforeWelcome=await current();await click('GIVE TO ME');const welcome=await current();
  assert.equal(welcome.coins,beforeWelcome.coins+5000);assert.equal(welcome.xp,beforeWelcome.xp+1000);assert.equal(welcome.inventory.double,beforeWelcome.inventory.double+3);
  await click('EDIT / SEND ANOTHER');await click('CLEAR REWARDS');await click('Packs');await click('One more Icon pack');await click('REVIEW GIFT');await click('GIVE TO ME');assert.equal((await current()).ut.packs.at(-1).kind,'admin-icon');
  await click('EDIT / SEND ANOTHER');await click('CLEAR REWARDS');
  if(sport!=='soccer'){
   await click('One more GOAT pack');await click('REVIEW GIFT');const before=await current();await click('GIVE TO ME');assert.deepEqual((await current()).ut.packs,before.ut.packs);await click('BACK TO REWARDS');await click('CLEAR REWARDS');
  }
  await click('Player cards');await page.getByRole('combobox',{name:'Reward card tier'}).selectOption('legend');await page.locator('.adm-player-results button').first().click();await shot(page,'admin-'+sport+'-specific-player');await click('REVIEW GIFT');await click('GIVE TO ME');assert.ok((await current()).ut.packs.at(-1).kind.startsWith('admin-card:'));
  await click('MY ACCOUNT');await shot(page,'admin-'+sport+'-account');await page.getByText('Card levels',{exact:false}).click();await page.getByLabel('Owned copy',{exact:true}).selectOption(original.ut.owned[0].uid);await page.getByLabel('Card level',{exact:true}).selectOption('4');await click('APPLY TO THIS COPY');
  await page.getByText('Replay & reset tools',{exact:false}).click();for(const name of ['RESET PAID GAMES','REDO CHALLENGES','RESTART LADDER','REPLAY DAILY','RESET MISSIONS','DAILY REWARD AGAIN'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
  await click('CLOSE ADMIN');await page.getByRole('button',{name:/Ultimate Team:/}).click();await page.locator('.ut-tabs button').filter({hasText:'STORE'}).click();
  const before=await current();await page.getByRole('button',{name:/Buy Captains Pack for/}).click();await page.locator('.ut-open-screen').waitFor();await dismissPack(page);const after=await current();assert.equal(after.coins,before.coins-({nba:2400,nfl:1000,soccer:2300}[sport]));
  for(const c of original.ut.owned){const got=after.ut.owned.find(x=>x.uid===c.uid);assert.ok(got);assert.equal(got.cardId,c.cardId);if(c.uid!==original.ut.owned[0].uid){assert.equal(got.level,c.level);assert.equal(got.xp,c.xp);}}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({sport,giftSteps:true,draftsPreserved:true,reviewBeforeSend:true,repeatSendGuard:true,originalTools:true,storePurchase:true,errors}));await context.close();
 }
} finally { await browser.close(); }
