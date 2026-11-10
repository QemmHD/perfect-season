// Players QA (studio overhaul, players-1): the keep-list probe. What the audits say works well in the
// player drawing must survive the overhaul (audit-likeness-animation-perf.md Part 4, audit-nfl.md and
// audit-nba.md "what works"). Three kinds of evidence per item:
//
// 1. Anchor: the code that draws it is still there (a pattern searched across the renderer, the
//    players-owned selection modules and the shared pixel code, so moving code between files is fine).
// 2. Observed: during an autoplay match the renderer's own state reached the condition (an NFL burner
//    in the open field, a tackler winding up, a posterizer...), and the game canvas of that exact
//    frame is saved as `<tag>-keep-<sport>-<item>.png` to look at. A condition the match never reached
//    is reported as not observed, not as a failure.
// 3. Measured: the heavy-man stride and sprint lean appear in the sprite keys; the posterizer plays in
//    slow motion (game time runs below 0.7x real time after it); club portraits fill a few a frame
//    (the 6 ms pump: the fill spans several frames and no frame's work balloons).
//
//   node scripts/qa/players-keep.mjs [--sport nba,nfl] [--secs 40] [--vp 393] [--tag before] [--out DIR]
// An item FAILS when its anchor is gone or a measurement contradicts it.
import fs from 'node:fs';
import path from 'node:path';
import { appUrl, emit, installProbe, listOf, matchUrl, needServer, newContext, openUt, OUT, opts, ROOT, round, utFixture, wait, watchErrors, withBrowser, dismissDialogs } from './players-lib.mjs';

const sports = listOf(opts.sport, ['nba', 'nfl']);
const secs = Number(opts.secs ?? 40);
const vp = String(opts.vp ?? '393');
const tag = String(opts.tag ?? 'before');

const FILES = {
  nfl: ['src/game/football2/render.ts', 'src/game/pixel'],
  nba: ['src/game/hoops2/render.ts', 'src/game/hoops2/Hoops2.tsx', 'src/game/pixel'],
  all: ['src/game/pixel', 'src/game/hoops2/render.ts', 'src/game/football2/render.ts', 'src/game/soccer2/render.ts'],
  cards: ['src/ut/CardArt.tsx', 'src/game/pixel', 'src/ui'],
};
const ITEMS = [
  { id: 'nfl-afterimage', sport: 'nfl', label: 'SPD 92+ ball carrier in the open field leaves an afterimage', files: FILES.nfl, re: [/SPD\s*\?\?\s*0\)\s*>=\s*92/, /afterimage/i] },
  { id: 'nfl-leap', sport: 'nfl', label: 'SPC 85+ receivers high-point a high ball', files: FILES.nfl, re: [/SPC\s*\?\?\s*0\)\s*>=\s*85/] },
  { id: 'nfl-bobble', sport: 'nfl', label: 'CTH under 70: the ball pops up off his hands', files: FILES.nfl, re: [/CTH\s*\?\?\s*\d+\)\s*<\s*70/] },
  { id: 'nfl-heavy-gait', sport: 'nfl', label: "the lineman's heavier gait (wider base, slower stride)", files: FILES.nfl, re: [/heaviness\(/, /widen\(/] },
  { id: 'nfl-fire', sport: 'nfl', label: 'On Fire flames off the quarterback', files: FILES.nfl, re: [/p\.fire\s*&&\s*p\.carrier\s*===\s*p\.qb/] },
  { id: 'nfl-stamina', sport: 'nfl', label: "the runner's stamina bar", files: FILES.nfl, re: [/p\.stamina\s*<\s*0\.99/] },
  { id: 'nfl-ring', sport: 'nfl', label: 'the tackler ring that tightens and reddens before a dive', files: FILES.nfl, re: [/windAt\s*===\s*Infinity/, /windupOf\(b\)/] },
  { id: 'nba-posterized', sport: 'nba', label: 'the posterized fall', files: FILES.nba, re: [/fallKind\s*===\s*'posterized'/] },
  { id: 'nba-ankles', sport: 'nba', label: 'the ankle-breaker slip', files: FILES.nba, re: [/clipMeta\('slip'\)/, /ankles/] },
  { id: 'nba-poster-slowmo', sport: 'nba', label: 'the posterizer in slow motion', files: FILES.nba, re: [/posterized:[\s\S]{0,400}slowUntil/] },
  { id: 'all-widen', sport: 'all', label: "the heavy man's wider stride in the sprite key", files: FILES.all, re: [/export function widen/, /'w'\s*\+\s*heavy/] },
  { id: 'all-sprint-lean', sport: 'all', label: 'the speed-rated sprint lean in the sprite key', files: FILES.all, re: [/export function sprintLean/, /'l'\s*\+\s*lean/] },
  { id: 'cards-pump', sport: 'cards', label: 'portraits drawn a few a frame (6 ms pump)', files: FILES.cards, re: [/performance\.now\(\)\s*-\s*t0\s*<\s*6\b/] },
];

function filesOf(list) {
  const out = [];
  for (const f of list) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) for (const g of fs.readdirSync(p)) /\.(ts|tsx)$/.test(g) && !/\.test\./.test(g) && out.push(path.join(p, g));
    else out.push(p);
  }
  return out;
}
const anchor = (item) => {
  const text = filesOf(item.files).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const missing = item.re.filter((r) => !r.test(text)).map(String);
  return { pass: missing.length === 0, missing };
};

/** In the page: after each drawn frame, check the keep conditions on the renderer's own state and save
 * the game canvas the first time each one holds (a few frames in, so it shows). */
function watchKeep(sport) {
  const mod = sport === 'nba' ? '/src/game/hoops2/render.ts' : '/src/game/football2/render.ts';
  return import(mod).then((R) => {
    const Cls = R.HoopsRenderer ?? R.FootballRenderer;
    const K = (window.__keep = { seen: {}, shots: {}, rate: [], posterAt: null, lastT: null, lastReal: null });
    const d0 = Cls.prototype.draw;
    const note = (id, ctx, hold = 4) => {
      const s = (K.seen[id] ??= { frames: 0 });
      s.frames++;
      if (s.frames === hold && !K.shots[id]) K.shots[id] = ctx.canvas.toDataURL('image/png');
    };
    Cls.prototype.draw = function (ctx, p, ...rest) {
      const r = d0.call(this, ctx, p, ...rest);
      const real = performance.now() / 1000;
      if (sport === 'nfl') {
        const c = p.carrier;
        if (p.fire && c === p.qb && (p.phase === 'pre' || p.phase === 'drop')) note('nfl-fire', ctx);
        if (p.phase === 'run' && c && p.stamina < 0.99) note('nfl-stamina', ctx);
        if (p.phase === 'run' && p.bodies.some((b) => b.side === 'D' && b.windAt !== Infinity)) note('nfl-ring', ctx, 2);
        if (c && p.phase === 'run' && (c.p.a.SPD ?? 0) >= 92 && Math.hypot(c.vx, c.vy) > 8.6 && !this.replay) note('nfl-afterimage', ctx, 6);
        for (const b of p.bodies) {
          const since = p.t - b.actAt;
          if (b.act === 'catch' && b === p.catcher && p.catchInfo?.high && (b.p.a.SPC ?? 0) >= 85 && since < 0.42) note('nfl-leap', ctx, 3);
          if (b === c && b.act === 'catch' && (b.p.a.CTH ?? 70) < 70 && since < 0.38) note('nfl-bobble', ctx, 3);
        }
      } else {
        for (const b of p.bodies) {
          if (b.fallKind === 'posterized' && b.act === 'fall') {
            note('nba-posterized', ctx, 6);
            if (K.posterAt === null) K.posterAt = real;
          }
          if (b.fallKind === 'ankles' && b.act === 'fall') note('nba-ankles', ctx, 6);
        }
        // game seconds per real second, around a posterizer (slow motion shows as < 0.7)
        if (K.lastT !== null && p.t >= K.lastT && real > K.lastReal) K.rate.push([real, (p.t - K.lastT) / (real - K.lastReal)]);
        if (K.rate.length > 4000) K.rate.shift();
      }
      K.lastT = p.t;
      K.lastReal = real;
      return r;
    };
  });
}

await needServer();
const report = await withBrowser(async (browser) => {
  const items = ITEMS.map((it) => ({ ...it, anchor: anchor(it), observed: null, measured: null, shot: null }));
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const runs = [];
  for (const sport of sports) {
    const context = await newContext(browser, vp, { dpr: 1 });
    const page = await context.newPage();
    const errors = watchErrors(page);
    // a strong lineup against a weak defense: more burners in the open field, more dunks
    await page.goto(matchUrl(sport, { seed: 'keep', extra: { level: 0.97, rival: 0.3 } }), { waitUntil: 'load' });
    await installProbe(page, sport);
    await page.evaluate(watchKeep, sport);
    await wait(secs * 1000);
    const k = await page.evaluate(() => ({ seen: window.__keep.seen, shots: window.__keep.shots, rate: window.__keep.rate, posterAt: window.__keep.posterAt, keys: { heavy: window.__psProbe.heavyKeys, lean: window.__psProbe.leanKeys } }));
    for (const [id, url] of Object.entries(k.shots)) {
      const file = path.join(OUT, `${tag}-keep-${id}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      if (byId[id]) byId[id].shot = file;
    }
    for (const it of items.filter((i) => i.sport === sport)) it.observed = !!k.seen[it.id];
    if (sport === 'nba') {
      const it = byId['nba-poster-slowmo'];
      if (k.posterAt === null) it.observed = false;
      else {
        const after = k.rate.filter(([t]) => t >= k.posterAt && t < k.posterAt + 1.0).map(([, r]) => r);
        const slow = after.length ? after.filter((r) => r < 0.7).length / after.length : 0;
        it.observed = true;
        it.measured = { framesAfter: after.length, slowShare: round(slow, 2), pass: slow >= 0.5 };
      }
    }
    runs.push({ sport, secs, heavyKeys: k.keys.heavy, leanKeys: k.keys.lean, observed: Object.keys(k.seen), pageErrors: errors.slice(0, 3) });
    await context.close();
  }
  // the heavy stride and the sprint lean must show up in the sprite keys of NBA and NFL play
  const tested = runs.filter((r) => ['nba', 'nfl'].includes(r.sport));
  if (tested.length) {
    byId['all-widen'].measured = { keys: Object.fromEntries(tested.map((r) => [r.sport, r.heavyKeys])), pass: tested.every((r) => r.heavyKeys > 0) };
    byId['all-sprint-lean'].measured = { keys: Object.fromEntries(tested.map((r) => [r.sport, r.leanKeys])), pass: tested.every((r) => r.leanKeys > 0) };
    for (const it of [byId['all-widen'], byId['all-sprint-lean']]) it.observed = it.measured.pass;
    const nfl = tested.find((r) => r.sport === 'nfl');
    if (nfl) byId['nfl-heavy-gait'].measured = { heavyKeys: nfl.heavyKeys, pass: nfl.heavyKeys > 0 };
    if (nfl) byId['nfl-heavy-gait'].observed = nfl.heavyKeys > 0;
  }
  // the portrait pump: a club of 40 cards fills over several frames, no frame doing all of it
  {
    const context = await newContext(browser, vp, { dpr: 1 });
    await context.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__pump = { cost: [], filled: [] };
      window.requestAnimationFrame = (f) =>
        raf((t) => {
          const a = performance.now();
          f(t);
          window.__pump.cost.push(performance.now() - a);
          window.__pump.filled.push(document.querySelectorAll('.utc img.utc-px').length);
        });
    });
    const page = await context.newPage();
    await utFixture(page, sport0());
    await page.goto(appUrl({ sport: sport0() }), { waitUntil: 'domcontentloaded' });
    await dismissDialogs(page, 3);
    await openUt(page, 'club');
    await page.evaluate(() => {
      window.__pump.cost = [];
      window.__pump.filled = [];
    });
    await wait(2500);
    const m = await page.evaluate(() => ({ cost: window.__pump.cost, filled: window.__pump.filled, cards: document.querySelectorAll('.utc').length, withArt: document.querySelectorAll('.utc img.utc-px').length }));
    // frames in which the number of drawn portraits grew
    let grew = 0;
    for (let i = 1; i < m.filled.length; i++) if (m.filled[i] > m.filled[i - 1]) grew++;
    const maxCost = Math.max(0, ...m.cost);
    byId['cards-pump'].observed = true;
    byId['cards-pump'].measured = { cards: m.cards, withArt: m.withArt, framesThatAddedArt: grew, maxRafMs: round(maxCost, 1), pass: m.withArt > 0 && (m.withArt <= 8 || grew >= 2) };
    await context.close();
  }
  for (const it of items) it.status = !it.anchor.pass || (it.measured && it.measured.pass === false) ? 'FAIL' : 'PASS';
  return { runs, items: items.map(({ files, re, ...rest }) => rest), pass: items.every((i) => i.status === 'PASS') };
});
function sport0() {
  return sports.includes('nba') ? 'nba' : sports[0];
}
emit('players-keep-' + tag, report);
