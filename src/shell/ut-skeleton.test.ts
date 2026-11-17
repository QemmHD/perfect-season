// Claude (studio overhaul, shell-6): Ultimate Team's loading screen. The progress store and its
// label (pool-progress.ts), the pool reporting through it while it really loads (getPool), and the
// skeleton's chrome being UltimateTeam's own markup (so nothing shifts when UT takes over).
/// <reference types="vite/client" />
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_MS, onPoolProgress, poolLoadAbandoned, poolLoadStarted, poolPercent, poolProgress, reportPool, type PoolProgress } from './pool-progress';
import { UtLoadError, UtSkeleton, UtSkeletonBody } from './UtSkeleton';
import { rememberUtReturn } from '../ut/return-view';

const fake = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
// node's fs, read at run time (the app's tsconfig has no node types; CSS through Vite would come back empty)
const fs = (await import('node:fs' as string)) as { readFileSync(p: URL, enc: 'utf8'): string };
const src = (p: string): string => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

afterEach(() => {
  reportPool('idle');
  vi.useRealTimers();
  rememberUtReturn('hub');
});

describe('poolPercent', () => {
  const p = (o: Partial<PoolProgress>): PoolProgress => ({ phase: 'fetch', done: 0, total: 0, ms: 0, ...o });
  it('creeps through the download without ever claiming it is done, then counts the rating', () => {
    expect(poolPercent(p({ ms: 0 }))).toBe(0);
    expect(poolPercent(p({ ms: 700 }))).toBeGreaterThan(5);
    expect(poolPercent(p({ ms: 60000 }))).toBe(29);
    expect(poolPercent(p({ phase: 'rate', done: 0, total: 100 }))).toBe(40);
    expect(poolPercent(p({ phase: 'rate', done: 50, total: 100 }))).toBe(69);
    expect(poolPercent(p({ phase: 'rate', done: 100, total: 100 }))).toBe(97);
    expect(poolPercent(p({ phase: 'done' }))).toBe(100);
    expect(poolPercent(p({ phase: 'idle' }))).toBe(0);
  });
  it('is monotonic through the phases', () => {
    const seq = [p({ ms: 100 }), p({ ms: 2000 }), p({ phase: 'expand', done: 1, total: 2 }), p({ phase: 'rate', done: 10, total: 100 }), p({ phase: 'cache', done: 1, total: 2 }), p({ phase: 'done' })].map(poolPercent);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
  });
});

describe('the progress store', () => {
  it('beats at least every 250 ms while loading, and stops when done', () => {
    fake();
    const got: PoolProgress[] = [];
    const off = onPoolProgress((x) => got.push(x));
    poolLoadStarted('pool');
    vi.advanceTimersByTime(1000);
    expect(HEARTBEAT_MS).toBeLessThanOrEqual(250);
    expect(got.length).toBeGreaterThanOrEqual(1 + 1000 / HEARTBEAT_MS);
    reportPool('done', 10, 10);
    const n = got.length;
    vi.advanceTimersByTime(1000);
    expect(got.length).toBe(n);
    off();
  });
  it('keeps the start when the pool takes over from the loading screen (the label never steps back)', () => {
    fake();
    poolLoadStarted('screen');
    vi.advanceTimersByTime(800);
    poolLoadAbandoned(); // the fallback unmounts…
    poolLoadStarted('pool'); // …and UltimateTeam's effect starts the pool in the same commit
    vi.advanceTimersByTime(10);
    expect(poolProgress().phase).toBe('fetch');
    expect(poolProgress().ms).toBeGreaterThanOrEqual(800);
  });
  it('ends a load nobody took over (UT closed while its code downloaded)', () => {
    fake();
    poolLoadStarted('screen');
    poolLoadAbandoned();
    vi.advanceTimersByTime(10);
    expect(poolProgress().phase).toBe('idle');
  });
});

describe('getPool reports its progress', () => {
  it('fetch → rate (counted, at least every 250 ms) → done, and the pool is unchanged', async () => {
    const { getPool, buildPool } = await import('../ut/pool');
    const seen: { p: PoolProgress; t: number }[] = [];
    const off = onPoolProgress((p) => seen.push({ p, t: performance.now() }));
    const pool = await getPool();
    off();
    const phases = [...new Set(seen.map((s) => s.p.phase))];
    expect(phases[0]).toBe('fetch');
    expect(phases).toContain('rate');
    expect(phases[phases.length - 1]).toBe('done');
    const rate = seen.filter((s) => s.p.phase === 'rate');
    for (let i = 1; i < rate.length; i++) {
      expect(rate[i].t - rate[i - 1].t).toBeLessThan(250);
      expect(rate[i].p.done).toBeGreaterThanOrEqual(rate[i - 1].p.done);
    }
    expect(rate[rate.length - 1].p.total).toBe(pool.lines.length);
    // the loading path only: a pool built in one go has the same fingerprint and buckets
    const again = buildPool(pool.sport, pool.lines, pool.byId);
    expect(again.print).toBe(pool.print);
    expect(Object.keys(again.buckets.gold)).toEqual(Object.keys(pool.buckets.gold));
  }, 120000);
});

describe('the skeleton', () => {
  const html = (view: Parameters<typeof rememberUtReturn>[0]) => {
    rememberUtReturn(view);
    return renderToStaticMarkup(React.createElement(UtSkeleton, { coins: 1234, onExit: () => undefined }));
  };
  it('draws UT’s own chrome: the top bar with EXIT, the title and the coins, and the 6-tab bar', () => {
    const h = html('hub');
    expect(h).toContain('class="screen ut ut-skel ut-v-hub ut-t-hub ut-root"');
    expect(h).toContain('class="topbar ut-top"');
    expect(h).toContain('EXIT');
    expect(h).toContain('Ultimate Team');
    expect(h).toContain('aria-label="1234 coins"');
    expect(h.match(/<nav class="ut-tabs"/g)?.length).toBe(1);
    for (const t of ['HOME', 'PLAY', 'SQUAD', 'CLUB', 'CHALLENGES', 'STORE']) expect(h).toContain('<span>' + t + '</span>');
    expect(h).toMatch(/aria-current="page"[^>]*>.*?<span>HOME<\/span>/);
  });
  it('opens on the screen UT will show (a sub-screen keeps its back pill and title; a segmented tab its segments)', () => {
    const sub = html('battles');
    expect(sub).toContain('ut-v-battles ut-t-play ut-sub');
    expect(sub).toContain('Squad Battles');
    expect(sub).toContain('PLAY');
    expect(sub).toContain('ut-skel-list');
    const club = html('storage');
    expect(club).toContain('ut-segbar');
    expect(club).toContain('STORAGE');
    expect(club).toContain('ut-skel-club');
  });
  it('mirrors UltimateTeam’s chrome markup (same classes in the same order)', () => {
    const ut = src('ut/UltimateTeam.tsx');
    for (const cls of ["'topbar ut-top'", '"icon-btn pill-btn ut-back"', '"ut-title disp"', '"ut-segbar"', '"ut-body"', '"ut-tabs"', 'aria-label="Ultimate Team"', "' no-back'"]) expect(ut, cls).toContain(cls);
    // the nav.css rules the skeleton copies have the values nav.css has
    const nav = src('ut/nav.css');
    const sk = src('shell/ut-skeleton.css');
    for (const rule of ['height: 44px;', 'padding: 0 12px 0 9px;', 'font-size: 11.5px;', 'font-stretch: 78%;', 'font-size: 10.5px;', 'min-height: 48px;', 'padding: 0 16px 8px;']) {
      expect(nav).toContain(rule);
      expect(sk).toContain(rule);
    }
  });
  it('the body has a live progress label', () => {
    reportPool('rate', 50, 100);
    const h = renderToStaticMarkup(React.createElement(UtSkeletonBody, { view: 'squad' }));
    expect(h).toContain('role="status"');
    expect(h).toContain('Preparing your club');
    expect(h).toContain('69%');
  });
  it('UtLoadError has a 44-pt-plus retry and readable copy', () => {
    const h = renderToStaticMarkup(React.createElement(UtLoadError, { onRetry: () => undefined }));
    expect(h).toContain('role="alert"');
    expect(h).toMatch(/TRY AGAIN|RETRY/);
    expect(src('shell/ut-skeleton.css')).toMatch(/\.ut-load-error \.btn \{\s*min-height: 48px;/);
  });
  it('UltimateTeam uses the skeleton body and the offline-aware error while the pool loads', () => {
    const ut = src('ut/UltimateTeam.tsx');
    expect(ut).toContain('body = <UtLoadError onRetry={load} />');
    expect(ut).toContain('body = <UtSkeletonBody view={view} />');
    expect(src('App.tsx')).toMatch(/fallback=\{<UtSkeleton coins=/);
  });
});
