// The soccer read-out between attacks (Claude 2026-11-16, studio overhaul soccer-4): the gold ring's
// reasons and the new lines (TOO FAR, PRESSURE, BLOCKED, FIRST TIME ACROSS YOUR BODY, KEEPER CLAIM,
// PARRIED WIDE), the ring and the xG in the facts.
import { describe, expect, it } from 'vitest';
import { soccerFeedback } from './play-feedback';
import type { Attack, ShotInfo } from './soccer2/types';

const shot = (o: Partial<ShotInfo>): ShotInfo => ({ by: 1, greened: false, off: 0.02, power: 1, speed: 25, aim: { x: 34, h: 1 }, cross: null, cone: 2, kind: 'shot', green: 0.04, ...o });
const atk = (end: { kind: 'G' | 'S' | 'W' | 'B' | 'L' | 'O' | 'T'; text: string }, s: ShotInfo | null): Attack =>
  ({ scenario: 'build', end: { ...end, x: 0, y: 0, t: 3 }, lastShot: s, stamina: 0.8 }) as unknown as Attack;
const fact = (a: Attack, label: string) => soccerFeedback(a).facts.find((f) => f.label === label)?.value;

describe('soccerFeedback (soccer-4)', () => {
  it('names what kept the ring from gold', () => {
    expect(soccerFeedback(atk({ kind: 'W', text: 'WIDE · GOAL KICK' }, shot({ ring: 'red', why: 'range' }))).next).toMatch(/^TOO FAR/);
    expect(soccerFeedback(atk({ kind: 'S', text: 'SAVED' }, shot({ ring: 'amber', why: 'pressure' }))).next).toMatch(/^PRESSURE/);
    expect(soccerFeedback(atk({ kind: 'W', text: 'WIDE · GOAL KICK' }, shot({ ring: 'amber', why: 'first' }))).next).toMatch(/^FIRST TIME ACROSS YOUR BODY/);
    expect(fact(atk({ kind: 'S', text: 'SAVED' }, shot({ ring: 'amber', why: 'pressure' })), 'Ring')).toBe('Amber · Pressure');
    expect(fact(atk({ kind: 'W', text: 'WIDE' }, shot({ ring: 'red', why: 'range' })), 'Ring')).toBe('Red · Too far');
    expect(fact(atk({ kind: 'G', text: 'GOAL' }, shot({ greened: true, ring: 'gold' })), 'Ring')).toBe('Gold');
  });
  it('BLOCKED, KEEPER CLAIM and PARRIED WIDE', () => {
    expect(soccerFeedback(atk({ kind: 'B', text: 'BLOCKED BY X' }, shot({ ring: 'gold' }))).next).toMatch(/^BLOCKED/);
    expect(soccerFeedback(atk({ kind: 'S', text: 'KEEPER CLAIMS' }, null)).next).toMatch(/^KEEPER CLAIM/);
    expect(soccerFeedback(atk({ kind: 'L', text: 'CLEARED BY X' }, shot({ greened: true, ring: 'gold', parried: 'wide' }))).next).toMatch(/^PARRIED WIDE/);
  });
  it('a gold release that is saved says gold goes where you aim; a missed window says release on the gold', () => {
    expect(soccerFeedback(atk({ kind: 'S', text: 'SAVED' }, shot({ greened: true, ring: 'gold' }))).next).toMatch(/exactly where you aim/);
    expect(soccerFeedback(atk({ kind: 'W', text: 'WIDE' }, shot({ ring: 'gold' }))).next).toMatch(/^Release on the gold/);
  });
  it('the xG shows when the match screen has filled it in', () => {
    expect(fact(atk({ kind: 'S', text: 'SAVED' }, shot({ xg: 0.137 })), 'xG')).toBe('0.14');
    expect(fact(atk({ kind: 'S', text: 'SAVED' }, shot({})), 'xG')).toBeUndefined();
  });
});

describe('soccerFeedback (soccer-5)', () => {
  const withEv = (a: Attack, o: Partial<Attack>) => ({ ...a, ...o }) as Attack;
  it('TACKLED BETWEEN TOUCHES, HEAVY TOUCH, SHIELDED and YELLOW', () => {
    const lost = atk({ kind: 'L', text: 'TACKLED BY X' }, null);
    expect(soccerFeedback(withEv(lost, { tackled: { by: 3, gap: 2.4, poke: true } })).next).toMatch(/^TACKLED BETWEEN TOUCHES/);
    expect(fact(withEv(lost, { tackled: { by: 3, gap: 2.4, poke: true } }), 'Won off you')).toBe('Between touches · 2.4 m out');
    expect(soccerFeedback(withEv(atk({ kind: 'L', text: 'CLEARED BY X' }, null), { lostTouch: true })).next).toMatch(/^HEAVY TOUCH/);
    expect(soccerFeedback(withEv(atk({ kind: 'S', text: 'SAVED' }, null), { shielded: 1 })).next).toMatch(/^SHIELDED/);
    const card = withEv(atk({ kind: 'S', text: 'SAVED' }, null), { yellows: ['p1'] });
    expect(soccerFeedback(card).next).toMatch(/^YELLOW/);
    expect(fact(card, 'Cards')).toBe('1 yellow');
  });
});
