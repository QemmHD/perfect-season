// The players QA harness's measurement math (studio overhaul, players-1): sprite keys as the three
// renderers build them, stale and effective-animation-rate summaries, size buckets, contrast and the
// isolation of every URL the harness opens. Pure functions only: no browser, no dev server.
import { appUrl, contrast, fnv, hex, listOf, matchUrl, parseArgs, parseSpriteKey, pxBucket, quantile, summariseProbe } from './players-lib.mjs';

describe('players QA harness', () => {
  it('parses the renderers’ sprite keys: who | anim | facing/dirs | px | pitch', () => {
    // NBA and NFL: who = pid|side; soccer adds the kit side
    const nba = parseSpriteKey('CLE-2010:willima01|O|mo:run:8d1w0.25l0.08|14/16|72|0.8999999999999999');
    expect(nba).toMatchObject({ who: 'CLE-2010:willima01|O', anim: 'mo:run:8d1w0.25l0.08', clip: 'run', frame: 8, fb: 14, dirs: 16, px: 72 });
    const ut = parseSpriteKey('nfl:season:2007:bradyto01:NE|O|st3|4/8|20|0.45');
    expect(ut).toMatchObject({ who: 'nfl:season:2007:bradyto01:NE|O', anim: 'st3', clip: null, frame: null, px: 20, dirs: 8 });
    const soccer = parseSpriteKey('108830:2019:BAR|A|us|mo:kick:12|3/16|38|0.6');
    expect(soccer).toMatchObject({ who: '108830:2019:BAR|A|us', clip: 'kick', frame: 12, px: 38 });
    expect(parseSpriteKey('not a sprite key')).toBeNull();
    expect(parseSpriteKey('a|b|c|x|y|z')).toBeNull();
  });

  it('buckets sizes as the audit did', () => {
    expect([12, 24, 31, 32, 47, 48, 71, 72, 200].map(pxBucket)).toEqual(['<24', '24-31', '24-31', '32-47', '32-47', '48-71', '48-71', '72+', '72+']);
  });

  it('summarises stale draws and effective animation rates', () => {
    // 600 frames at 60 fps: a near body asked for a new pose 30 times a second but was shown only
    // 6 of them; a far one got every one of its 15
    const r = {
      frames: 600,
      secs: 10,
      drawMs: [1, 2, 3],
      byPx: { '24-31': { lookups: 600, hit: 450, made: 150, stale: 0 }, '48-71': { lookups: 600, hit: 60, made: 60, stale: 480 } },
      pxHist: { 26: 600, 60: 600 },
      bySince: { '0-9': { lookups: 10, stale: 1 } },
      bodies: [
        { who: 'near|O', frames: 600, px: 60, reqChanges: 300, shownChanges: 60, stale: 480, maxStaleRun: 9, ball: 600 },
        { who: 'far|D', frames: 600, px: 26, reqChanges: 150, shownChanges: 150, stale: 0, maxStaleRun: 0, ball: 0 },
      ],
      starts: 1,
      areaNow: 1.5e6,
      areaPeak: 2.5e6,
      areaSamples: [],
      cacheEntries: 100,
      pixelDebug: null,
    };
    const s = summariseProbe(r);
    expect(s.stalePct).toBe(40);
    expect(s.byPx['48-71'].stalePct).toBe(80);
    expect(s.byPx['24-31'].stalePct).toBe(0);
    expect(s.bySinceStart['0-9'].stalePct).toBe(10);
    expect(s.fps).toBe(60);
    expect(s.animFps.all.bodies).toBe(2);
    expect(s.animFps.ball).toMatchObject({ bodies: 1, min: 6 });
    expect(s.animFps.large40).toMatchObject({ bodies: 1, min: 6, reqP50: 30 });
    expect(s.animFps.all.under10).toBe(1);
    expect(s.spritePx).toMatchObject({ min: 26, p50: 26, max: 60 });
    expect(s.spriteAreaPeakMpx).toBe(2.5);
  });

  it('measures WCAG contrast (white on the yellow badges the audit flagged)', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('rgb(255, 255, 255)', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#ffffff', '#ffe667')).toBeLessThan(1.4);
  });

  it('keeps every URL it opens on localhost with the inspect namespace and the local relay', () => {
    for (const u of [appUrl({ sport: 'nba' }), matchUrl('nfl'), matchUrl('soccer', { slowmo: 0.25 }), appUrl({ pixel: 'x' })]) {
      const url = new URL(u);
      expect(['localhost', '127.0.0.1']).toContain(url.hostname);
      expect(url.searchParams.get('ns')).toBe('inspect');
      expect(url.searchParams.get('relay')).toBe('ws://localhost:7777');
    }
    expect(new URL(matchUrl('soccer')).searchParams.has('soccer-lab')).toBe(true);
    expect(new URL(matchUrl('nba')).searchParams.has('arcade')).toBe(true);
  });

  it('parses options and quantiles, and digests stably', () => {
    expect(parseArgs(['--sport', 'nba,nfl', '--shots', '--secs=12', 'x'])).toEqual({ _: ['x'], sport: 'nba,nfl', shots: true, secs: '12' });
    expect(listOf('nba, nfl', ['soccer'])).toEqual(['nba', 'nfl']);
    expect(listOf(undefined, ['soccer'])).toEqual(['soccer']);
    expect(quantile([5, 1, 3], 0.5)).toBe(3);
    expect(quantile([], 0.5)).toBeNull();
    expect(hex(fnv('golden'))).toBe(hex(fnv('golden')));
    expect(hex(fnv('a'))).not.toBe(hex(fnv('b')));
  });
});
