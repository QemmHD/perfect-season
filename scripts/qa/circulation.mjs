// Implemented by Codex. Real signed copy registrations, public realtime counts and persisted disposal retry.
import { launch, fixture, shot } from './browser.mjs';
const browser = await launch();
async function acknowledged(f,uid){
 for(let i=0;i<90;i++){const p=await f.current();if(!p.ut.owned.some(c=>c.uid===uid)&&!p.ut.retirements?.some(c=>c.uid===uid))return p;await f.page.waitForTimeout(500);}
 throw Error('Persisted copy retirement was not acknowledged');
}
try {
  for (const sport of ['nba', 'nfl']) {
    const a = await fixture(browser, sport, 'Codex Serial A'),
      b = await fixture(browser, sport, 'Codex Serial B');
    let chosen;
    for(let i=0;i<90;i++){
      chosen=(await a.current()).ut.owned.find(c=>c.mint&&!/:(goat|spotlight):/.test(c.cardId));
      if(chosen)break;
      await a.page.waitForTimeout(500);
    }
    if(!chosen)throw Error('No numbered ordinary fixture card after registration');
    const mount = async (page) =>
      page.evaluate(
        async ({ chosen, sport }) => {
          const React = (await import('/node_modules/.vite/deps/react.js')).default,
            dom = await import('/node_modules/.vite/deps/react-dom_client.js');
          const { getPool } = await import('/src/ut/pool.ts');
          const { rateCard } = await import('/src/ut/rate.ts');
          const { UtCard } = await import('/src/ut/CardArt.tsx');
          const { CardSerial } = await import('/src/ut/CardSerial.tsx');
          const pool = await getPool(),
            rc = rateCard(pool.byId.get(chosen.cardId), chosen.level);
          const host = document.createElement('div');host.className='qa-serial-panel';
          host.style =
            'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04121a;gap:24px;padding:24px';
          document.body.append(host);
          const root = (dom.createRoot ?? dom.default.createRoot)(host);
          root.render(
            React.createElement(
              React.Fragment,
              null,
              React.createElement(UtCard, { rc, w: 190, mint: chosen.mint, attrs: true }),
              React.createElement(CardSerial, { mint: chosen.mint, cardId: chosen.cardId, sport }),
            ),
          );
        },
        { chosen, sport },
      );
    await a.page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await mount(a.page);
    const count = () => a.page.locator('.qa-serial-panel .utc-stamp b').last().innerText().then(Number);
    await a.page.waitForFunction(() => document.querySelector('.qa-serial-panel .utc-stamp') && !document.querySelector('.qa-serial-panel .utc-stamp.cached'), null, {
      timeout: 30000,
    });
    // Initial fixture batches can still be finishing. Explicit counts use the edition, not a sum of all players/cards.
    await a.page.waitForTimeout(1200);
    const before = await count();
    const other = await b.page.evaluate(
      async ({ sport, chosen }) => {
        const { syncCopies } = await import('/src/ut/registry.ts');
        return (await syncCopies(sport, [{ uid: 'peer:' + crypto.randomUUID(), cardId: chosen.cardId, level: chosen.level }]))[0];
      },
      { sport, chosen },
    );
    await a.page.waitForFunction(
      (total) => Number(document.querySelector('.qa-serial-panel .utc-stamp b:last-child')?.textContent) === total,
      other.active,
      { timeout: 12000 },
    );
    if (other.mint.serial <= chosen.mint.serial) throw Error('Pull serial was reused');
    await shot(a.page, 'serial-' + sport + '-live');
    const sold = await b.page.evaluate(
      async ({ sport, other, level }) => {
        const { syncCopies } = await import('/src/ut/registry.ts');
        const task = { uid: other.uid, cardId: other.cardId, level, reason: 'sold' };
        const a = await syncCopies(sport, [task]),
          b = await syncCopies(sport, [task]);
        if (a[0].active !== b[0].active) throw Error('Retry changed circulation');
        return b[0];
      },
      { sport, other, level: chosen.level },
    );
    await a.page.waitForFunction((total) => Number(document.querySelector('.qa-serial-panel .utc-stamp b:last-child')?.textContent) === total, sold.active, {
      timeout: 12000,
    });
    if (sold.active !== other.active - 1) throw Error('Sold copy did not decrease active total');
    // Exercise the real Quick Sell confirmation when the peer owns this fixture edition.
    const peerOwned=(await b.current()).ut.owned.find(c=>c.cardId===chosen.cardId&&c.mint);
    let uiSell=false;
    if(peerOwned){
      await b.page.getByRole('button',{name:/Ultimate Team:/}).click();
      await b.page.locator('.ut-tabs button').filter({hasText:'CLUB'}).click();
      const imageLabel=await b.page.evaluate(async c=>{const {getPool}=await import('/src/ut/pool.ts');const {ratedOf}=await import('/src/ut/pool.ts');const {TIER_NAMES}=await import('/src/ut/rate.ts');const rc=ratedOf(await getPool(),c),l=rc.line;return l.name+', '+rc.ovr+' overall '+rc.pos+', '+l.season+' '+l.teamName+', '+TIER_NAMES[rc.tier]+', issue number '+c.mint.serial;},peerOwned);
      await b.page.getByRole('img',{name:imageLabel,exact:true}).locator('..').click();
      await b.page.getByRole('button',{name:/^QUICK SELL/}).click();
      await b.page.getByRole('button',{name:/^SELL ·/}).click();
      await acknowledged(b,peerOwned.uid);
      uiSell=true;
    }
    // Queue a real owned copy for SBC while offline, reload, reconnect and require acknowledgement.
    await a.context.setOffline(true);
    await a.page.evaluate(async (chosen) => {
      const { loadProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { removeCards } = await import('/src/ut/storage.ts');
      const p = loadProfile();
      saveProfile({ ...p, ut: removeCards(p.ut, [chosen.uid], 'sbc') });
    }, chosen);
    const offline = await a.current();
    if (!offline.ut.retirements?.some((c) => c.uid === chosen.uid)) throw Error('Offline SBC retirement not persisted');
    await a.context.setOffline(false);
    await a.page.reload();
    await acknowledged(a,chosen.uid);
    const after = await a.current();
    const finalTotal=await b.page.evaluate(async({sport,id})=>{const {countSnapshot}=await import('/src/ut/registry.ts');return (await countSnapshot(sport,'inspect',[id])).counts[id];},{sport,id:chosen.cardId});
    if(finalTotal!==sold.active-1-Number(uiSell))throw Error('SBC/Quick Sell totals did not settle exactly once');
    if (after.ut.owned.some((c) => c.uid === chosen.uid)) throw Error('Sync resurrected consumed card');
    for (const c of offline.ut.owned)
      if (!after.ut.owned.some((x) => x.uid === c.uid && x.level === c.level && x.xp === c.xp)) throw Error('Other progress changed');
    if (a.errors.length || b.errors.length) throw Error([...a.errors, ...b.errors].join(';'));
    console.log(
      JSON.stringify({
        sport,
        firstIssue: chosen.mint.serial,
        nextIssue: other.mint.serial,
        before,
        afterPull: other.active,
        afterSold: sold.active,
        offlineSbcRecovered: true,
        uiQuickSell:uiSell,
        otherCopiesPreserved: after.ut.owned.length,
        errors: [],
      }),
    );
    await a.context.close();
    await b.context.close();
  }
} finally {
  await browser.close();
}
