// Does the HUD shot clock tick while nobody touches anything? (audit NBA-08, ported by Claude
// 2026-11-16; nba-3: measured against the engine itself). For 20 s of an untouched lab game, at 20 Hz
// and on every frame, the score bug's clock text is compared with ceil(p.clock) from the dev probe:
// the longest the text stood still while the possession ran, and every run of frames where the text
// disagreed with the engine (a run longer than one frame is a failure). Also: the warning state at
// 5 s and below.
//   node scripts/audit/nba-clock.mjs [size] [seconds]
import { context, launch, needServer, openLab, report, shot } from './nba-lib.mjs';

const size = process.argv[2] ?? '393';
const SECONDS = Number(process.argv[3] ?? 20);
await needServer();
const browser = await launch();
try {
  const { page, errors } = await context(browser, size);
  await openLab(page, { seed: 'clock' });
  const res = await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const el = document.querySelector('.ps-bug-clock');
        const frames = [];
        const at20 = [];
        let lastSample = -1;
        const t0 = performance.now();
        const f = (t) => {
          const p = window.__hg2?.possession();
          const want = p ? String(Math.max(0, Math.ceil(p.clock))) : '–';
          const shown = el?.textContent ?? '';
          frames.push({ t: t - t0, want, shown, low: el?.dataset.low === '1', clock: p ? p.clock : null, end: !!p?.end });
          if (Math.floor((t - t0) / 50) !== lastSample) {
            lastSample = Math.floor((t - t0) / 50);
            at20.push({ t: t - t0, want, shown });
          }
          if (t - t0 < ms) requestAnimationFrame(f);
          else resolve({ frames, at20 });
        };
        requestAnimationFrame(f);
      }),
    SECONDS * 1000
  );
  await shot(page, `clock-${size}`);
  // mismatch runs, in frames
  let run = 0;
  const runs = [];
  for (const fr of res.frames) {
    if (fr.want !== fr.shown) run++;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  if (run) runs.push(run);
  // the longest the shown value stood still while the possession was live
  let longest = 0;
  let since = null;
  let prev = null;
  for (const fr of res.frames) {
    const liveNow = fr.clock !== null && !fr.end;
    if (fr.shown !== prev || !liveNow) since = fr.t;
    prev = fr.shown;
    if (liveNow && since !== null) longest = Math.max(longest, fr.t - since);
  }
  const lowOk = res.frames.filter((f) => f.clock !== null && !f.end).every((f) => f.low === f.clock <= 5);
  const at20Mismatch = res.at20.filter((s) => s.want !== s.shown).length;
  report('nba-clock', {
    size,
    seconds: SECONDS,
    frames: res.frames.length,
    samples20Hz: res.at20.length,
    samples20HzMismatched: at20Mismatch,
    mismatchRunsFrames: runs,
    mismatchRunsLongerThanAFrame: runs.filter((r) => r > 1).length,
    longestStillLiveS: +(longest / 1000).toFixed(2),
    warningAtOrUnder5s: lowOk,
    errors,
  });
} finally {
  await browser.close();
}
