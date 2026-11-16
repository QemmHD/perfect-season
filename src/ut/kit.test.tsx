// Claude, 2026-11-10 (studio overhaul, team ut): the UT visual kit (kit.tsx, ut-system.css).
// 2026-11-16: V2 tokens, 120-180 ms motion, haptics.ts patterns, MinutesRing and GoldBar.
/// <reference types="vite/client" />
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sound = vi.hoisted(() => ({ haptic: vi.fn(), coin: vi.fn() }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../lib/sound', () => ({ sfx: { coin: sound.coin } }));
vi.mock('../lib/haptics', () => ({ haptic: sound.haptic }));
vi.mock('../ui/motion', () => ({ reducedMotion: () => motion.reduced }));

import {
  ClaimButton,
  Countdown,
  countdownText,
  countdownTone,
  EmptyState,
  GoChip,
  GoldBar,
  MinutesRing,
  MOTION,
  motionMs,
  PrimaryButton,
  ProgressRing,
  RewardChip,
  SectionTitle,
} from './kit';
import KIT_SOURCE from './kit.tsx?raw';

/** Vitest hands `.css?raw` back empty, so the stylesheet is read with node:fs (no Node typings here). */
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(p: URL, enc: 'utf8'): string };
const KIT_CSS = fs.readFileSync(new URL('./ut-system.css', import.meta.url), 'utf8');

const MIN = 60_000,
  HOUR = 60 * MIN,
  DAY = 24 * HOUR;

/** A stand-in for the button element the click handler restarts the burst on. */
function fakeButton() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    offsetWidth: 96,
    removeAttribute: (k: string) => void attrs.delete(k),
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
  };
}

type ButtonProps = {
  onPointerDown?: (e: unknown) => void;
  onPointerCancel?: (e: unknown) => void;
  onClick: (e: unknown) => void;
  disabled?: boolean;
  className: string;
};
/** ClaimButton has no hooks, so calling it gives the <button> element and its real handlers. */
const claim = (p: Parameters<typeof ClaimButton>[0]) => ClaimButton(p) as React.ReactElement<ButtonProps>;
/** A browser touch on an element: pointerdown, then either a click (a tap) or a pointercancel (a scroll). */
function touch(el: React.ReactElement<ButtonProps>, ends: 'tap' | 'scroll', target: unknown = fakeButton()) {
  el.props.onPointerDown?.({ isPrimary: true, pointerType: 'touch' });
  if (ends === 'scroll') el.props.onPointerCancel?.({ isPrimary: true, pointerType: 'touch' });
  else el.props.onClick({ currentTarget: target, detail: 1 });
}

beforeEach(() => {
  sound.haptic.mockClear();
  sound.coin.mockClear();
  motion.reduced = false;
});

describe('ClaimButton: the haptic fires only on a finished tap (click), never on pointerdown', () => {
  it('rendering never fires a haptic or a sound', () => {
    const html = renderToStaticMarkup(<ClaimButton onClaim={() => {}} />);
    expect(html).toContain('class="ut-k-claim"');
    expect(html).toContain('CLAIM');
    expect(sound.haptic).not.toHaveBeenCalled();
    expect(sound.coin).not.toHaveBeenCalled();
  });
  it('pointerdown alone never ticks (it may be the start of a scroll)', () => {
    const el = claim({ onClaim: () => {} });
    el.props.onPointerDown?.({ isPrimary: true, pointerType: 'touch' });
    expect(sound.haptic).not.toHaveBeenCalled();
  });
  it('a scroll that starts on the button (pointerdown, pointercancel, no click) never ticks or claims', () => {
    const onClaim = vi.fn();
    touch(claim({ onClaim }), 'scroll');
    expect(sound.haptic).not.toHaveBeenCalled();
    expect(onClaim).not.toHaveBeenCalled();
  });
  it('a tap ticks once, claims once, plays the coin sound and the burst', () => {
    const onClaim = vi.fn();
    const btn = fakeButton();
    touch(claim({ onClaim }), 'tap', btn);
    expect(sound.haptic.mock.calls).toEqual([['tick']]);
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(sound.coin).toHaveBeenCalledTimes(1);
    expect(btn.attrs.has('data-burst')).toBe(true);
  });
  it('keyboard or assistive activation (click with detail 0) claims without a haptic', () => {
    const onClaim = vi.fn();
    claim({ onClaim }).props.onClick({ currentTarget: fakeButton(), detail: 0 });
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(sound.haptic).not.toHaveBeenCalled();
  });
  it('a claim that grants a pack plays the long pattern', () => {
    touch(claim({ onClaim: () => {}, pack: true }), 'tap');
    expect(sound.haptic.mock.calls).toEqual([['long']]);
  });
  it('a disabled button is disabled (the browser sends it no click, so it never ticks)', () => {
    const el = claim({ onClaim: () => {}, disabled: true });
    expect(el.props.disabled).toBe(true);
    el.props.onPointerDown?.({ isPrimary: true });
    expect(sound.haptic).not.toHaveBeenCalled();
  });
  it('no spark burst under reduced motion (the claim and sound still happen)', () => {
    motion.reduced = true;
    const onClaim = vi.fn();
    const btn = fakeButton();
    claim({ onClaim }).props.onClick({ currentTarget: btn, detail: 1 });
    expect(btn.attrs.has('data-burst')).toBe(false);
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(sound.coin).toHaveBeenCalledTimes(1);
  });
  it('kit.tsx calls haptic() only inside onClick handlers, has no onPointerDown, and never calls sound.ts haptics directly', () => {
    const src = KIT_SOURCE;
    const calls = [...src.matchAll(/\bhaptic\(/g)];
    expect(calls.length).toBe(2);
    for (const c of calls) {
      const line = src.slice(src.lastIndexOf('\n', c.index) + 1, src.indexOf('\n', c.index));
      const before = src.slice(0, c.index);
      expect(before.lastIndexOf('onClick'), line).toBeGreaterThan(before.lastIndexOf('<button'));
    }
    expect(src).not.toMatch(/onPointerDown|tapHaptic|vibrate\(/);
  });
});

describe('Countdown', () => {
  it('formats days+hours, hours+minutes, minutes', () => {
    expect(countdownText(2 * DAY + 4 * HOUR + 30 * MIN)).toBe('2d 4h');
    expect(countdownText(3 * HOUR + 12 * MIN)).toBe('3h 12m');
    expect(countdownText(12 * MIN)).toBe('12m');
    expect(countdownText(DAY)).toBe('1d 0h');
  });
  it('rounds minutes up, so time that is left never reads 0m', () => {
    expect(countdownText(30_000)).toBe('1m');
    expect(countdownText(59 * MIN + 1)).toBe('1h 0m');
    expect(countdownText(0)).toBe('0m');
    expect(countdownText(-5 * MIN)).toBe('0m');
    expect(countdownText(Number.NaN)).toBe('0m');
  });
  it('turns amber under 24 hours, not at 24 hours', () => {
    expect(countdownTone(DAY)).toBe('calm');
    expect(countdownTone(DAY - 1)).toBe('amber');
    expect(countdownTone(MIN)).toBe('amber');
    expect(countdownTone(0)).toBe('over');
  });
  it('renders the time left with its tone and an accessible label', () => {
    const now = Date.UTC(2026, 10, 10, 12);
    const amber = renderToStaticMarkup(<Countdown to={now + 5 * HOUR} prefix="Ends in" now={() => now} />);
    expect(amber).toContain('data-tone="amber"');
    expect(amber).toContain('aria-label="Ends in 5h 0m"');
    const calm = renderToStaticMarkup(<Countdown to={now + 3 * DAY + HOUR} now={() => now} />);
    expect(calm).toContain('data-tone="calm"');
    expect(calm).toContain('3d 1h');
  });
});

describe('EmptyState requires an icon, a line and a CTA', () => {
  it('renders all three, the CTA as a real button', () => {
    const onClick = vi.fn();
    const html = renderToStaticMarkup(<EmptyState icon={<svg />} line="No rewards waiting." cta={{ label: 'PLAY A MATCH', onClick }} />);
    expect(html).toContain('No rewards waiting.');
    expect(html).toMatch(/<button[^>]*class="ut-k-go"[^>]*>PLAY A MATCH/);
    expect(html).toContain('<i aria-hidden="true"><svg></svg></i>');
  });
  it('is a type error to leave any of them out (checked by npm run typecheck)', () => {
    const cta = { label: 'GO', onClick: () => {} };
    // @ts-expect-error the CTA is required
    const noCta = <EmptyState icon={<svg />} line="Nothing here." />;
    // @ts-expect-error the icon is required
    const noIcon = <EmptyState line="Nothing here." cta={cta} />;
    // @ts-expect-error the line is required
    const noLine = <EmptyState icon={<svg />} cta={cta} />;
    expect([noCta, noIcon, noLine]).toHaveLength(3);
  });
});

describe('the other pieces', () => {
  it('PrimaryButton is the one data-primary button, with an optional second line', () => {
    const html = renderToStaticMarkup(
      <PrimaryButton onClick={() => {}} sub="About 5 min">
        PLAY
      </PrimaryButton>,
    );
    expect(html).toContain('data-primary=""');
    expect(html).toContain('<small>About 5 min</small>');
    expect((html.match(/data-primary/g) ?? []).length).toBe(1);
  });
  it('GoChip, SectionTitle, RewardChip and ProgressRing render their content', () => {
    expect(renderToStaticMarkup(<GoChip onClick={() => {}} ariaLabel="Go to Squad Battles" />)).toContain('aria-label="Go to Squad Battles"');
    expect(renderToStaticMarkup(<SectionTitle title="Live now" />)).toContain('<h2 class="ut-k-title">Live now</h2>');
    expect(renderToStaticMarkup(<RewardChip kind="coins" amount={1500} label="coins" />)).toContain('<b class="num">1,500 </b>coins');
    expect(renderToStaticMarkup(<RewardChip kind="pack" label="Gold Pack" art={<em>art</em>} />)).toContain('<em>art</em>');
    const ring = renderToStaticMarkup(<ProgressRing value={9} max={6} />);
    expect(ring).toContain('aria-label="6 of 6"');
    expect(ring).toContain('data-done=""');
  });
  it('one motion spec inside V2 C.3 120-180 ms: push 180, pop 140, tab 120, sheet 180; all 0 under reduced motion', () => {
    expect(MOTION).toEqual({ push: 180, pop: 140, tab: 120, sheet: 180 });
    for (const ms of Object.values(MOTION)) expect(ms >= 120 && ms <= 180).toBe(true);
    expect(motionMs('push')).toBe(180);
    motion.reduced = true;
    expect(['push', 'pop', 'tab', 'sheet'].map((k) => motionMs(k as keyof typeof MOTION))).toEqual([0, 0, 0, 0]);
  });
  it('the CSS turns the burst, sheen and screen motion off under reduced motion, and its tokens match', () => {
    const css = KIT_CSS;
    const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const sel of ['.ut-k-claim::before', '.ut-k-primary::before', '.ut-k-claim[data-burst]::after', '.ut-k-gold::before', '.ut-k-ring > svg circle + circle', '.ut-push-in', '.ut-sheet-in'])
      expect(rm).toContain(sel);
    expect(rm).toContain('animation: none');
    for (const [k, ms] of Object.entries(MOTION)) expect(css).toContain('--ut-' + k + ': ' + ms + 'ms');
    expect(css).toContain('--ut-title: 20px');
  });
});

describe('V2 C.3 tokens', () => {
  const TOKENS = { bg: '#071521', panel: '#0e2233', stroke: '#1d3a50', teal: '#4fe3c1', gold: '#f6b93b', violet: '#8b7cf6', red: '#ff5d5d', text: '#f2f7fa', dim: '#8aa3b5' };
  it('are defined with the design values, only on the UT screen, .ps-v2 surfaces and the kit pieces themselves', () => {
    const first = KIT_CSS.indexOf('--ps-bg:');
    const scope = KIT_CSS.slice(Math.max(KIT_CSS.lastIndexOf('}', first) + 1, KIT_CSS.lastIndexOf('*/', first) + 2), first);
    expect(scope.trim()).toBe(":where(.screen.ut, .ps-v2),\n:where([class*='ut-k-']):not(:where(.screen.ut, .ps-v2) *) {");
    for (const [k, v] of Object.entries(TOKENS)) expect(KIT_CSS).toContain('--ps-' + k + ': ' + v + ';');
    expect(KIT_CSS).not.toMatch(/:root\s*\{/);
  });
  it('a kit piece inside a themed root inherits them (so a parent can re-tint), and matches by any class position', () => {
    expect(KIT_CSS).not.toContain("[class^='ut-k-']");
    expect(KIT_CSS.match(/:where\(\[class\*='ut-k-'\]\):not\(:where\(\.screen\.ut, \.ps-v2\) \*\)/g)).toHaveLength(2);
  });
  it('press feedback reaches [data-pressed] only inside .screen.ut and .ps-v2, never app-wide', () => {
    expect(KIT_CSS).not.toMatch(/[,(]\s*\[data-pressed/);
    expect((KIT_CSS.match(/\.screen\.ut \[data-pressed='true'\], \.ps-v2 \[data-pressed='true'\]/g) ?? []).length).toBe(2);
  });
  it('the clipped primary button draws its keyboard focus ring inside the shape', () => {
    expect(KIT_CSS).toMatch(/\.ut-k-primary:focus-visible \{\s*box-shadow:\s*inset/);
  });
  it('the kit draws with them: no raw brand colours from the old palette in kit rules', () => {
    for (const old of ['var(--teal)', 'var(--gold)', 'var(--text)', 'var(--sub)', 'var(--soft)', 'var(--panel-3)', '#19e3c9', '#f5b83d']) expect(KIT_CSS, old).not.toContain(old);
  });
});

describe('MinutesRing', () => {
  it('counting: "23 / 30 min", the reward line and a ring at 23 of 30', () => {
    const html = renderToStaticMarkup(<MinutesRing minutes={23.9} target={30} reward="75 coins + stamp next" />);
    expect(html).toContain('<b class="num">23 / 30 min</b>');
    expect(html).toContain('<small>75 coins + stamp next</small>');
    expect(html).toContain('data-state="next"');
    expect(html).toContain('aria-label="Minutes: 23 / 30 min. 75 coins + stamp next"');
    expect(html).not.toContain('ut-k-dot');
  });
  it('ready: a gold dot; done: "Done for today" and a full ring', () => {
    expect(renderToStaticMarkup(<MinutesRing minutes={60} target={60} reward="Silver Pack ready" state="ready" />)).toContain('class="ut-k-dot"');
    const done = renderToStaticMarkup(<MinutesRing minutes={95} target={90} reward="Great session." state="done" />);
    expect(done).toContain('Done for today');
    expect(done).toContain('data-done=""');
  });
  it('a button only when it leads somewhere; minutes never read past the target or below 0', () => {
    const onClick = vi.fn();
    expect(renderToStaticMarkup(<MinutesRing minutes={5} target={15} reward="50 coins next" onClick={onClick} />)).toMatch(/^<button type="button" class="ut-k-mins"/);
    expect(renderToStaticMarkup(<MinutesRing minutes={5} target={15} reward="x" />)).toMatch(/^<span class="ut-k-mins"[^>]*role="group"/);
    expect(renderToStaticMarkup(<MinutesRing minutes={-3} target={15} reward="x" />)).toContain('0 / 15 min');
    expect(renderToStaticMarkup(<MinutesRing minutes={40} target={30} reward="x" />)).toContain('30 / 30 min');
  });
});

describe('GoldBar', () => {
  it('eyebrow, title, stake and one accessible name', () => {
    const html = renderToStaticMarkup(<GoldBar eyebrow="Next up" title="3 min to 75 coins" stake="+ a Scout Stamp" onClick={() => {}} />);
    expect(html).toContain('<small>Next up</small><b>3 min to 75 coins</b><em>+ a Scout Stamp</em>');
    expect(html).toContain('aria-label="Next up: 3 min to 75 coins. + a Scout Stamp"');
    expect(html).not.toContain('data-primary');
  });
  it('primary only when asked (the One-More bar); a tap ticks once, a scroll that starts on it never does', () => {
    const onClick = vi.fn();
    const el = GoldBar({ eyebrow: 'Next up · loaded', title: "Play '86 Boston", onClick, primary: true }) as React.ReactElement<ButtonProps & { 'data-primary'?: string }>;
    expect(el.props['data-primary']).toBe('');
    touch(el, 'scroll');
    expect(sound.haptic).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    touch(el, 'tap');
    expect(sound.haptic.mock.calls).toEqual([['tick']]);
    expect(onClick).toHaveBeenCalledTimes(1);
    el.props.onClick({ detail: 0 });
    expect(sound.haptic).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
