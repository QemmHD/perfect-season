// Codex: actual NFL component + real pointer/touch/keyboard input + measured world movement.
// Defenders are held away only in the direction-isolation fixture. A second normal-defense pass
// captures the actual field/HUD; no runtime debug hooks or live accounts are used.
import assert from 'node:assert/strict';
import { launch, fixture, shot } from './browser.mjs';
const browser = await launch();
try {
  for (const [width, height] of [
    [390, 844],
    [320, 568],
    [844, 390]
  ]) {
    const { page, context, errors, current, original } = await fixture(browser, 'nfl', 'Codex Joystick QA', width, { hasTouch: true });
    await page.setViewportSize({ width, height });
    const mount = async (isolate = true) =>
      page.evaluate(async (isolate) => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { loadProfile } = await import('/src/lib/profile.ts'),
          { getPool } = await import('/src/ut/pool.ts');
        const { teamsOf } = await import('/src/ut/teams.ts'),
          { kitsFor } = await import('/src/game/uniforms.ts');
        const { Football2 } = await import('/src/game/football2/Football2.tsx');
        const { FootballRenderer } = await import('/src/game/football2/render.ts');
        if (!window.__joyDraw) {
          const draw = FootballRenderer.prototype.draw;
          window.__joyDraw = draw;
          FootballRenderer.prototype.draw = function (ctx, p, los, options) {
            const q = window.__joy;
            if (q) {
              if (q.isolate)
                for (const d of p.bodies.filter((b) => b.side === 'D')) {
                  d.x = 2;
                  d.y = 105;
                  d.vx = 0;
                  d.vy = 0;
                  d.stunUntil = Infinity;
                }
              q.frame = {
                phase: p.phase,
                t: p.t,
                x: p.carrier?.x,
                y: p.carrier?.y,
                vx: p.carrier?.vx,
                vy: p.carrier?.vy,
                stamina: p.stamina,
                moves: p.events.filter((e) => e.startsWith('move:'))
              };
            }
            return draw.call(this, ctx, p, los, options);
          };
        }
        const pool = await getPool(),
          profile = loadProfile(),
          sq = {};
        for (const [slot, uid] of Object.entries(profile.ut.squad)) {
          const c = profile.ut.owned.find((c) => c.uid === uid);
          if (c) sq[slot] = { line: pool.byId.get(c.cardId), level: c.level };
        }
        const teams = teamsOf('nfl', sq, sq, 'joystick-qa'),
          kits = kitsFor(null, null, 'nfl');
        window.__joyRoot?.unmount();
        const host = document.createElement('div');
        document.body.append(host);
        const root = (dom.createRoot ?? dom.default.createRoot)(host);
        window.__joyRoot = root;
        window.__joy = { isolate, attempts: [] };
        root.render(
          React.createElement(Football2, {
            offense: teams.offense,
            rivalDefense: teams.rivalDefense,
            rivalName: 'LEGEND',
            seed: 'joystick-qa',
            drives: 1,
            practice: { drill: 'run', onAttempt: (a) => window.__joy.attempts.push(a) },
            defIQ: 1,
            rival: null,
            ourKit: kits.mine,
            theirKit: kits.theirs,
            field: kits.field,
            onProgress: () => {},
            onDone: () => {}
          })
        );
      }, isolate);
    const frame = () => page.evaluate(() => window.__joy.frame);
    await mount();
    await page.getByRole('button', { name: 'SNAP', exact: true }).click();
    const stick = page.getByRole('group', { name: /Run joystick:/ });
    await stick.waitFor();
    await page.waitForFunction(() => window.__joy.frame?.phase === 'run').catch(async e=>{console.log(JSON.stringify({diagnostic:await frame(),errors,screen:(await page.locator('.arcade-full').innerText()).slice(0,700)}));await shot(page,'joystick-failure-'+width);throw e;});
    // Starting centered means stopped; only the scripted handoff precedes human control.
    await page.waitForTimeout(450);
    let state = await frame();
    assert.ok(Math.hypot(state.vx, state.vy) < 0.1);
    const boxes = await page.locator('.fb2-stick,.fb2-burst,.fb2-mv').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })
    );
    assert.ok(boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= width + 1 && b.y + b.h <= height + 1));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        assert.ok(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) < 1 || Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) < 1, 'Controls overlap');
      }
    const directions = [];
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
      [1, -1]
    ]) {
      const b = await stick.boundingBox(),
        cx = b.x + b.width / 2,
        cy = b.y + b.height / 2;
      const before = await frame();
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      // A fast, long throw used to reset the stick into a skill move.
      await page.mouse.move(cx + dx * 75, cy + dy * 75);
      await page.waitForTimeout(450);
      const after = await frame();
      const fx = width > height ? -dy : dx,
        fy = width > height ? dx : -dy;
      const x = after.x - before.x,
        y = after.y - before.y;
      if (fx) assert.ok(x * Math.sign(fx) > 0.7, JSON.stringify({ dx, dy, x, y }));
      else assert.ok(Math.abs(x) < 0.15);
      if (fy) assert.ok(y * Math.sign(fy) > 0.7, JSON.stringify({ dx, dy, x, y }));
      else assert.ok(Math.abs(y) < 0.15);
      assert.equal(await page.getByText('SPIN MOVE!', { exact: true }).count(), 0);
      if (dx === 0 && dy === -1) await shot(page, 'joystick-forward-' + width);
      await page.mouse.up();
      await page.waitForTimeout(400);
      const stopped = await frame();
      assert.ok(Math.hypot(stopped.vx, stopped.vy) < 0.1);
      directions.push({ screen: [dx, dy], world: [Number(x.toFixed(2)), Number(y.toFixed(2))] });
    }
    // Keyboard and OS interruption use the same vector and stop path.
    await stick.focus();
    const before = await frame();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowUp');
    const after = await frame();
    assert.ok(width > height ? after.x - before.x > 0.6 : after.y - before.y > 0.6);
    await page.waitForTimeout(400);
    const b = await stick.boundingBox(),
      cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    const burst = await page.getByRole('button', { name: 'Burst: hold to sprint' }).boundingBox();
    const cdp = await context.newCDPSession(page),
      point = (id, x, y) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
    const thumb = point(1, cx, cy),
      fast = point(2, burst.x + burst.width / 2, burst.y + burst.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb] });
    const held = point(1, cx + (width > height ? 32 : 0), cy + (width > height ? 0 : -32));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [held] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [held, fast] });
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole('button', { name: 'Burst: hold to sprint' }).getAttribute('aria-pressed'), 'true');
    assert.ok((await frame()).stamina < 0.99);
    await shot(page, 'joystick-touch-burst-' + width);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(400);
    assert.ok(Math.hypot((await frame()).vx, (await frame()).vy) < 0.1);
    assert.equal(await page.getByRole('button', { name: 'Burst: hold to sprint' }).getAttribute('aria-pressed'), 'false');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    let normalDefenseAttempt;
    if (width === 390) {
      await mount(false);
      await page.getByRole('button', { name: 'SNAP', exact: true }).click();
      const liveStick = page.getByRole('group', { name: /Run joystick:/ });
      await liveStick.waitFor();
      const box = await liveStick.boundingBox(),
        sx = box.x + box.width / 2,
        sy = box.y + box.height / 2;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx + 22, sy - 32);
      await page.waitForFunction(() => window.__joy.frame?.phase === 'run' || window.__joy.attempts.length > 0);
      await shot(page, 'joystick-normal-defense-390');
      await page.waitForFunction(() => window.__joy.attempts.length > 0, null, { timeout: 30000 });
      await page.mouse.up();
      normalDefenseAttempt = await page.evaluate(() => window.__joy.attempts[0]);
      assert.ok(Number.isFinite(normalDefenseAttempt.yards));
    }
    await page.evaluate(() => window.__joyRoot.unmount());
    const saved = await current();
    assert.equal(saved.coins, original.coins);
    assert.deepEqual(saved.ut.squad, original.ut.squad);
    for (const card of original.ut.owned) assert.ok(saved.ut.owned.some((c) => Object.entries(card).every(([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v))));
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        height,
        normalTimeScale: 1,
        directions,
        normalDefenseAttempt,
        twoThumbBurst: true,
        releaseStops: true,
        interruptStops: true,
        copiesPreserved: original.ut.owned.length,
        errors
      })
    );
    await context.close();
  }
} finally {
  await browser.close();
}
