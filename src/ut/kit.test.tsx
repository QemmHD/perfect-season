// Claude, 2026-11-10 (studio overhaul, team ut): the UT visual kit (kit.tsx, ut-system.css).
/// <reference types="vite/client" />
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sound = vi.hoisted(() => ({ tapHaptic: vi.fn(), coin: vi.fn() }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../lib/sound', () => ({ tapHaptic: sound.tapHaptic, sfx: { coin: sound.coin } }));
vi.mock('../ui/motion', () => ({ reducedMotion: () => motion.reduced }));

import {
  ClaimButton,
  Countdown,
  countdownText,
  countdownTone,
  EmptyState,
  GoChip,
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
  onPointerDown: (e: unknown) => void;
  onClick: (e: unknown) => void;
  disabled?: boolean;
  className: string;
};
/** ClaimButton has no hooks, so calling it gives the <button> element and its real handlers. */
const claim = (p: Parameters<typeof ClaimButton>[0]) => ClaimButton(p) as React.ReactElement<ButtonProps>;

beforeEach(() => {
  sound.tapHaptic.mockClear();
  sound.coin.mockClear();
  motion.reduced = false;
});

describe('ClaimButton: the haptic fires only from its pointer handler', () => {
  it('rendering never fires a haptic or a sound', () => {
    const html = renderToStaticMarkup(<ClaimButton onClaim={() => {}} />);
    expect(html).toContain('class="ut-k-claim"');
    expect(html).toContain('CLAIM');
    expect(sound.tapHaptic).not.toHaveBeenCalled();
    expect(sound.coin).not.toHaveBeenCalled();
  });
  it('pointerdown ticks once; the claim on click never ticks', () => {
    const onClaim = vi.fn();
    const el = claim({ onClaim });
    el.props.onPointerDown({ isPrimary: true });
    expect(sound.tapHaptic).toHaveBeenCalledTimes(1);
    expect(onClaim).not.toHaveBeenCalled();
    const btn = fakeButton();
    el.props.onClick({ currentTarget: btn });
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(sound.coin).toHaveBeenCalledTimes(1);
    expect(sound.tapHaptic).toHaveBeenCalledTimes(1);
    expect(btn.attrs.has('data-burst')).toBe(true);
  });
  it('keyboard or assistive activation (click with no pointer) claims without a haptic', () => {
    const onClaim = vi.fn();
    claim({ onClaim }).props.onClick({ currentTarget: fakeButton() });
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(sound.tapHaptic).not.toHaveBeenCalled();
  });
  it('a disabled button never ticks', () => {
    const el = claim({ onClaim: () => {}, disabled: true });
    el.props.onPointerDown({ isPrimary: true });
    expect(el.props.disabled).toBe(true);
    expect(sound.tapHaptic).not.toHaveBeenCalled();
  });
  it('no spark burst under reduced motion (the claim and sound still happen)', () => {
    motion.reduced = true;
    const onClaim = vi.fn();
    const btn = fakeButton();
    claim({ onClaim }).props.onClick({ currentTarget: btn });
    expect(btn.attrs.has('data-burst')).toBe(false);
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(sound.coin).toHaveBeenCalledTimes(1);
  });
  it('kit.tsx calls tapHaptic in exactly one place: the pointer handler', () => {
    const src = KIT_SOURCE;
    const calls = [...src.matchAll(/tapHaptic\(/g)];
    expect(calls).toHaveLength(1);
    const before = src.slice(0, calls[0].index);
    expect(before.lastIndexOf('onPointerDown')).toBeGreaterThan(before.lastIndexOf('onClick'));
    expect(before.lastIndexOf('onPointerDown')).toBeGreaterThan(before.lastIndexOf('export function ClaimButton'));
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
  it('one motion spec: push 200, pop 160, tab 120, sheet 240; all 0 under reduced motion', () => {
    expect(MOTION).toEqual({ push: 200, pop: 160, tab: 120, sheet: 240 });
    expect(motionMs('push')).toBe(200);
    motion.reduced = true;
    expect(['push', 'pop', 'tab', 'sheet'].map((k) => motionMs(k as keyof typeof MOTION))).toEqual([0, 0, 0, 0]);
  });
  it('the CSS turns the burst, sheen and screen motion off under reduced motion, and its tokens match', () => {
    const css = KIT_CSS;
    const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const sel of ['.ut-k-claim::before', '.ut-k-primary::before', '.ut-k-claim[data-burst]::after', '.ut-push-in', '.ut-sheet-in']) expect(rm).toContain(sel);
    expect(rm).toContain('animation: none');
    for (const [k, ms] of Object.entries(MOTION)) expect(css).toContain('--ut-' + k + ': ' + ms + 'ms');
    expect(css).toContain('--ut-title: 20px');
  });
});
