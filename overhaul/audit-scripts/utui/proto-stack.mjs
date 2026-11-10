import { launch, fixture, settle } from './lib.mjs';
const browser = await launch();
try {
  const { page, context } = await fixture(browser, 'soccer', '393');
  await page.locator('.home .playbar').waitFor({ timeout: 60000 });
  await settle(page, 1500);
  const out = await page.evaluate(() => {
    const res = {};
    for (const [x, y] of [[100, 74], [300, 66], [37, 70], [200, 30], [200, 100]]) {
      res[x + ',' + y] = document.elementsFromPoint(x, y).map((e) => {
        const s = getComputedStyle(e);
        return (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ').join('.')) +
          ` [pos=${s.position} z=${s.zIndex} op=${s.opacity} filter=${s.filter} bf=${s.backdropFilter} mask=${s.maskImage} anim=${s.animationName} bg=${s.backgroundColor}/${s.backgroundImage.slice(0, 60)}]`;
      });
    }
    // any element anywhere with blur/backdrop/mask or opacity<1 that intersects y<90
    const hits = [];
    for (const e of document.querySelectorAll('*')) {
      const r = e.getBoundingClientRect(); if (r.top > 90 || r.bottom < 0 || r.width < 1) continue;
      const s = getComputedStyle(e), a = getComputedStyle(e, '::before'), b = getComputedStyle(e, '::after');
      for (const [n, st] of [['', s], ['::before', a], ['::after', b]]) {
        if ((st.filter && st.filter !== 'none') || (st.backdropFilter && st.backdropFilter !== 'none') || (st.maskImage && st.maskImage !== 'none') || +st.opacity < 1)
          hits.push(e.tagName + '.' + e.className + n + ' f=' + st.filter + ' bf=' + st.backdropFilter + ' m=' + st.maskImage + ' op=' + st.opacity);
      }
    }
    res.effects = hits;
    res.rootBg = getComputedStyle(document.getElementById('root')).backgroundColor;
    res.shellBg = getComputedStyle(document.querySelector('.shell')).backgroundImage;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await context.close();
} finally { await browser.close(); }
