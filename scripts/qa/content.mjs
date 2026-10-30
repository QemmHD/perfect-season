// Implemented by Codex. Uses only new localhost test profiles and the registry's `inspect` namespace.
import { launch, fixture, shot, dismissPack } from './browser.mjs';
const browser = await launch();
try {
  for (const sport of ['nba', 'nfl']) {
    const { page, context, current, errors, original } = await fixture(browser, sport);
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.getByRole('button', { name: /Collection Gallery/ }).click();
    await page.getByRole('button', { name: /COLLECTION REWARDS/ }).click();
    const claim = page.getByRole('button', { name: 'CLAIM', exact: true });
    await claim.first().waitFor();
    await claim.first().click();
    await page.waitForTimeout(350);
    let result = await current();
    if (result.coins !== 10100 || result.ut.collectionClaims.length !== 1) throw Error('Collection claim failed');
    await shot(page, 'collection-rewards-' + sport);
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await page.locator('.ut-tabs button').filter({ hasText: 'STORE' }).click();
    let aborted = false;
    await page.route('**/functions/v1/card-registry', async (route) => {
      if (route.request().method() === 'POST' && !aborted) {
        aborted = true;
        await route.abort();
      } else await route.continue();
    });
    await page.locator('.s-spotlight .ut-buy').click();
    await page.getByRole('button', { name: 'RETRY SAME PACK' }).waitFor({ timeout: 25000 });
    const pending = await current();
    if (pending.coins !== 10100 || !pending.ut.pendingPromo || pending.ut.owned.length !== original.ut.owned.length) throw Error('Failed pack charged coins or lost journal');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.getByRole('dialog', { name: 'Opening Spotlight Pack', exact: true }).waitFor({ timeout: 30000 });
    result = await current();
    if (result.coins !== 6600 || result.ut.owned.length !== original.ut.owned.length + (sport === 'nba' ? 8 : 16) || result.ut.pendingPromo)
      throw Error('Recovered pack settled incorrectly');
    for (const card of original.ut.owned) if (!result.ut.owned.some((c) => Object.entries(card).every(([k,v])=>JSON.stringify(c[k])===JSON.stringify(v)))) throw Error('Original card changed');
    await shot(page, 'spotlight-pack-' + sport);
    await dismissPack(page);
    await page.locator('.ut-tabs button').filter({ hasText: 'STORE' }).click();
    await page.getByRole('button', { name: 'Open your Spotlight Reward', exact: true }).click();
    await page.getByRole('dialog', { name: 'Opening Spotlight Reward', exact: true }).waitFor({ timeout: 30000 });
    await dismissPack(page);
    result = await current();
    const minted = result.ut.owned.filter((c) => c.mint);
    if (!minted.length) throw Error('Numbered reward missing');
    const reward = minted.at(-1);
    const info = await page.evaluate(async (id) => {
      const rc = (await (await import('/src/ut/pool.ts')).getPool()).base.get(id);
      return { name: rc.line.name, ovr: rc.ovr };
    }, reward.cardId);
    await page.locator('.ut-tabs button').filter({ hasText: 'CLUB' }).click();
    if (result.ut.duplicateStorage?.includes(reward.uid)) await page.getByRole('button', { name: /DUPLICATE STORAGE/ }).click();
    const escaped = info.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page
      .getByRole('button', { name: new RegExp('^' + escaped + ', ' + info.ovr + '(,|$)') })
      .first()
      .click();
    await page.getByText('WORLDWIDE EDITION NUMBER', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.ut-card-serial small')?.textContent.includes('Live copies in circulation.'), null, { timeout: 20000 });
    await shot(page, 'registered-card-' + sport);
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await page.locator('.ut-tabs button').filter({ hasText: 'HOME' }).click();
    await page.getByRole('button', { name: /Take on the greats/ }).click();
    await page.getByRole('heading', { name: 'Dynasty Nights', exact: true }).waitFor();
    await shot(page, 'spotlight-events-' + sport);
    const beforeEvent = await current();
    await page.getByRole('button', { name: 'PLAY MATCH', exact: true }).click();
    await page.getByRole('button', { name: /^SIM/ }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /^SIM/ }).click();
    await page.getByRole('heading', { name: /WIN|LOSS/, exact: true }).waitFor({ timeout: 45000 });
    result = await current();
    const won=(await page.getByRole('heading',{name:/WIN|LOSS/,exact:true}).innerText()).trim()==='WIN';
    const expected=(beforeEvent.ut.events?.dynasty??0)+(won?1:0);
    if((result.ut.events?.dynasty??0)!==expected)throw Error('Event progress did not match the displayed result');
    if(result.ut.record.w+result.ut.record.l!==beforeEvent.ut.record.w+beforeEvent.ut.record.l+1)throw Error('Event result did not settle exactly once');
    const match=result.ut.hq?.history?.at(-1);
    if(match?.mode!=='event'||match.won!==won)throw Error('Event history does not match the result');
    if (errors.length) throw Error(errors.join(';'));
    console.log(
      JSON.stringify({
        sport,
        originalCardsPreserved: original.ut.owned.length,
        paidPackRecovered: true,
        registeredCopies: minted.length,
        eventCleared: result.ut.events?.dynasty ?? 0,
        eventOutcome: won ? 'win' : 'loss',
        eventSettledExactlyOnce: true,
        errors,
      })
    );
    await context.close();
  }
} finally {
  await browser.close();
}
