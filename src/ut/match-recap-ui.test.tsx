// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): the recap screen (MatchRecap.tsx) as
// rendered. Under reduced motion the final state is the first frame: the One-More bar is there, it is
// the only data-primary, a level soccer score reads DRAW, and blocks with no data are not drawn.
/// <reference types="vite/client" />
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../lib/sound', () => ({ sfx: { coin: vi.fn(), count: vi.fn(), levelUp: vi.fn(), click: vi.fn() }, vibrate: vi.fn() }));
vi.mock('../lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('../ui/motion', () => ({ reducedMotion: () => motion.reduced }));

import { MatchRecap, type MatchRecapProps, RECAP_MS } from './MatchRecap';
import type { Recap } from './match-recap';
import { verdictOf } from './match-recap';
import { rateBox } from './match-ratings';
import RECAP_SOURCE from './MatchRecap.tsx?raw';

const recap = (o: Partial<Recap> = {}): Recap => ({
  verdict: verdictOf({ us: 30, them: 20, won: true }, 'nba'),
  coins: 60,
  capped: false,
  career: null,
  cards: { xp: 60, ups: [] },
  objectives: [{ id: 'daily:x:winner', group: 'daily', title: 'Find a way to win.', from: 0, to: 1, target: 1, done: true, reward: '75 coins' }],
  sp: { gained: 110, from: 100, to: 210, levelFrom: 0, levelTo: 0, next: 'Bronze Pack' },
  rivals: null,
  minutes: { plus: 4, now: 27, at: 30, next: '3 min to 75 coins + a Scout Stamp', capped: false, frozen: false },
  milestones: [],
  grade: null,
  box: null,
  scoutDrop: null,
  league: null,
  ...o,
});
const props = (o: Partial<MatchRecapProps> = {}): MatchRecapProps => ({
  sport: 'nba',
  eyebrow: 'Squad Battles · Pro · rung 4',
  me: 'You',
  rival: "'86 Boston",
  us: 30,
  them: 20,
  ends: [['3', '2'], ['2']],
  simulated: false,
  recap: recap(),
  next: { action: { id: 'after:battles', line: '1 win to Gold Pack', cta: 'NEXT', target: { app: 'match', setup: { mode: 'battles', rung: 4 } }, stake: 'Gold Pack' }, title: "PLAY '86 BOSTON", line: 'Pro · rung 5 of 8 · 1 win to a Gold Pack' },
  paidToday: { n: 3, of: 8 },
  claimable: 3,
  onClaimAll: () => {},
  onOneMore: () => {},
  onHome: () => {},
  ...o,
});
const html = (o: Partial<MatchRecapProps> = {}) => renderToStaticMarkup(<MatchRecap {...props(o)} />);

describe('MatchRecap', () => {
  it('reduced motion: the final state at once, with the One-More bar as the only primary', () => {
    const h = html();
    expect(h).toContain('data-phase="done"');
    expect(h.match(/data-primary/g)).toHaveLength(1);
    expect(h).toContain('NEXT UP · LOADED');
    expect(h).toContain('PLAY &#x27;86 BOSTON');
    expect(h).toContain('1 win to a Gold Pack');
    expect(h).toContain('CLAIM ALL · 3');
    expect(h).toContain('+4 min · 27 today');
    expect(h).toContain('Paid game 3 of 8 · +60 card XP');
  });
  it('normal motion: the bar waits for its beat (5 s), and the slam comes first', () => {
    motion.reduced = false;
    const h = html();
    motion.reduced = true;
    expect(h).toContain('data-phase="slam"');
    expect(h).not.toContain('data-primary');
    expect(RECAP_MS.bar).toBeLessThanOrEqual(5000);
    expect(RECAP_MS.bar).toBeGreaterThanOrEqual(4800);
    expect(RECAP_MS.slam).toBe(2500);
  });
  it('a level soccer score reads DRAW', () => {
    const h = html({ sport: 'soccer', us: 2, them: 2, recap: recap({ verdict: verdictOf({ us: 2, them: 2, won: true, tiebreak: true }, 'soccer') }) });
    expect(h).toMatch(/<h1[^>]*>DRAW<\/h1>/);
    expect(h).not.toMatch(/<h1[^>]*>WIN<\/h1>/);
    expect(h).toContain('A draw goes to the better squad: yours.');
  });
  it('no grade, no box: no grade tiles and no man of the match (nothing invented)', () => {
    const h = html();
    expect(h).not.toContain('mr-grade');
    expect(h).not.toContain('MAN OF THE MATCH');
  });
  it('a grade and a box show GRADE, PERFECTS, BEST HEAT, FLAWLESS and the MOTM', () => {
    const box = rateBox('nba', { lines: [{ id: 'a', name: 'Ace Guard', side: 'us', stats: { pts: 22, ast: 6 } }] });
    const h = html({ recap: recap({ grade: { letter: 'A', perfects: 9, chances: 12, heat: 100, fires: 1, flawless: true }, box }) });
    expect(h).toContain('aria-label="Grade A"');
    expect(h).toContain('PERFECTS');
    expect(h).toContain('ON FIRE');
    expect(h).toContain('FLAWLESS');
    expect(h).toContain('MAN OF THE MATCH');
    expect(h).toContain('Ace Guard');
    expect(h).toContain('22 PTS · 6 AST');
  });
  it('a capped day says so instead of counting zero; done for today turns the bar calm', () => {
    const h = html({ recap: recap({ capped: true, coins: 0 }), next: { ...props().next, action: { ...props().next.action, done: true } } });
    expect(h).toContain('Today’s 8 paid games are played');
    expect(h).toContain('data-calm=""');
    expect(h).toContain('DONE FOR TODAY');
  });
  it('timer beats use sound only: no vibration anywhere in the sequence', () => {
    expect(RECAP_SOURCE).not.toMatch(/vibrate\(|haptic\(/);
  });
});
