// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): the box score and the match grade never
// go over the match channel (match-box.ts stripLocal, used on every onProgress update in Match.tsx).
import { describe, expect, it } from 'vitest';
import MATCH_SOURCE from './Match.tsx?raw';
import { stripLocal } from './match-box';

describe('stripLocal', () => {
  it('drops box and grade, keeps the shared fields', () => {
    const p = { score: 7, drive: 2, done: true, ends: ['TD', 'PUNT'], plays: 9, box: { us: [], them: [] }, grade: { letter: 'A' } };
    const w = stripLocal(p);
    expect(w).toEqual({ score: 7, drive: 2, done: true, ends: ['TD', 'PUNT'], plays: 9 });
    expect(JSON.stringify(w)).not.toMatch(/box|grade/);
    expect(p.box).toBeDefined();
  });
  it('returns the same object when there is nothing to drop', () => {
    const p = { score: 1, drive: 1, done: false, ends: ['2'] };
    expect(stripLocal(p)).toBe(p);
  });
  it('Match.tsx sends every progress update through it', () => {
    expect(MATCH_SOURCE).toContain('arcade: stripLocal(p)');
    expect(MATCH_SOURCE).not.toMatch(/arcade: p \}/);
  });
});
